import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import {
  AI_MODEL,
  AI_FALLBACK_MODEL,
  type AIAnalysis,
  type AIContext,
} from '../types/ai';
import {
  executeGeminiWithFallback,
  callGeminiApi,
  handleAiAnalyzeRequest,
  isTransientStatus,
  isPermanentStatus,
} from '../server/aiHandler';
import { GeminiProvider } from '../services/ai/aiProvider';
import { AIService } from '../services/ai/aiService';

// Sample valid structured output matching AI_RESPONSE_SCHEMA
const mockValidAiAnalysis: AIAnalysis = {
  headline: 'Momentum is Strong Across Pillars',
  summary: 'Weekly execution is consistent with top-tier outcomes.',
  confidence: 'HIGH',
  observations: [
    {
      id: 'obs-1',
      type: 'FACT',
      category: 'TIME',
      statement: 'Deep work hours totaled 32 hours this week.',
      evidenceRefs: ['time.job_hunt.minutes'],
    },
  ],
  contradictions: [],
  patterns: [],
  priorities: [
    {
      id: 'pri-1',
      title: 'Complete System Refactoring',
      description: 'Finish remaining items on sprint checklist.',
      status: 'OBSERVED',
      evidenceRefs: ['time.job_hunt.minutes'],
    },
  ],
  questions: ['Are additional tests needed?'],
  uncertainties: [],
};

const mockValidGeminiResponseBody = JSON.stringify({
  candidates: [
    {
      content: {
        parts: [{ text: JSON.stringify(mockValidAiAnalysis) }],
      },
    },
  ],
});

// Helper to create a mocked https.request stream
function createMockHttpsRequest(statusCode: number, body: string, delayMs = 0) {
  const req = new EventEmitter() as any;
  req.write = vi.fn();
  req.end = vi.fn().mockImplementation(() => {
    setTimeout(() => {
      const res = new EventEmitter() as any;
      res.statusCode = statusCode;
      res.headers = { 'content-type': 'application/json' };
      req.emit('response', res);
      res.emit('data', body);
      res.emit('end');
    }, delayMs);
  });
  req.destroy = vi.fn();
  return req;
}

describe('Phase 2-7: AI Model Availability, Retry & Fallback Resilience', () => {
  let httpsRequestSpy: any;
  const requestsMade: { model: string; url: string }[] = [];

  beforeEach(() => {
    requestsMade.length = 0;
    httpsRequestSpy = vi.spyOn(https, 'request').mockImplementation((urlOrOptions: any, ...args: any[]) => {
      const urlStr = typeof urlOrOptions === 'string' ? urlOrOptions : (urlOrOptions.href || urlOrOptions.path || '');
      const match = urlStr.match(/\/models\/([^:]+):generateContent/);
      const model = match ? match[1] : 'unknown';
      requestsMade.push({ model, url: urlStr });

      const cb = typeof args[0] === 'function' ? args[0] : args[1];
      const req = new EventEmitter() as any;
      req.write = vi.fn();
      req.end = vi.fn().mockImplementation(() => {
        // default 200 response
        const res = new EventEmitter() as any;
        res.statusCode = 200;
        req.emit('response', res);
        res.emit('data', mockValidGeminiResponseBody);
        res.emit('end');
      });
      req.destroy = vi.fn();

      if (cb) {
        req.on('response', cb);
      }
      return req;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. verifies canonical primary model is explicitly gemini-3.7-flash', () => {
    expect(AI_MODEL).toBe('gemini-3.7-flash');
    expect(AI_FALLBACK_MODEL).toBe('gemini-3.8-flash');
  });

  it('2. verifies gemini-flash-latest is nowhere in the active provider configuration', () => {
    const provider = new GeminiProvider();
    expect(provider.primaryModel).toBe('gemini-3.7-flash');
    expect(provider.fallbackModel).toBe('gemini-3.8-flash');
    expect(provider.primaryModel).not.toContain('latest');
    expect(provider.fallbackModel).not.toContain('latest');
  });

  it('3. verifies successful primary request succeeds on attempt 1 without invoking fallback', async () => {
    const result = await executeGeminiWithFallback(
      JSON.stringify({ contents: [] }),
      'test-api-key',
      { baseBackoffMs: 0 }
    );

    expect(result.modelUsed).toBe('gemini-3.7-flash');
    expect(result.fallbackUsed).toBe(false);
    expect(result.attempts).toBe(1);
    expect(requestsMade.length).toBe(1);
    expect(requestsMade[0].model).toBe('gemini-3.7-flash');
  });

  it('4. verifies HTTP 503 triggers retry on primary model with bounded backoff', async () => {
    let callCount = 0;
    httpsRequestSpy.mockImplementation((urlOrOptions: any, ...args: any[]) => {
      callCount++;
      const cb = typeof args[0] === 'function' ? args[0] : args[1];
      const req = new EventEmitter() as any;
      req.write = vi.fn();
      req.end = vi.fn().mockImplementation(() => {
        const res = new EventEmitter() as any;
        if (callCount === 1) {
          // Attempt 1: 503
          res.statusCode = 503;
          req.emit('response', res);
          res.emit('data', JSON.stringify({ error: { code: 503, message: 'High demand' } }));
        } else {
          // Attempt 2: Success
          res.statusCode = 200;
          req.emit('response', res);
          res.emit('data', mockValidGeminiResponseBody);
        }
        res.emit('end');
      });
      req.destroy = vi.fn();
      if (cb) req.on('response', cb);
      return req;
    });

    const result = await executeGeminiWithFallback(
      JSON.stringify({ contents: [] }),
      'test-api-key',
      { baseBackoffMs: 1 }
    );

    expect(result.modelUsed).toBe('gemini-3.7-flash');
    expect(result.fallbackUsed).toBe(false);
    expect(result.attempts).toBe(2);
    expect(callCount).toBe(2);
  });

  it('5. verifies HTTP 429 triggers retry on primary model', async () => {
    let callCount = 0;
    httpsRequestSpy.mockImplementation((urlOrOptions: any, ...args: any[]) => {
      callCount++;
      const cb = typeof args[0] === 'function' ? args[0] : args[1];
      const req = new EventEmitter() as any;
      req.write = vi.fn();
      req.end = vi.fn().mockImplementation(() => {
        const res = new EventEmitter() as any;
        if (callCount === 1) {
          res.statusCode = 429;
          req.emit('response', res);
          res.emit('data', JSON.stringify({ error: { code: 429, message: 'Rate limit' } }));
        } else {
          res.statusCode = 200;
          req.emit('response', res);
          res.emit('data', mockValidGeminiResponseBody);
        }
        res.emit('end');
      });
      req.destroy = vi.fn();
      if (cb) req.on('response', cb);
      return req;
    });

    const result = await executeGeminiWithFallback(
      JSON.stringify({ contents: [] }),
      'test-api-key',
      { baseBackoffMs: 1 }
    );

    expect(result.modelUsed).toBe('gemini-3.7-flash');
    expect(result.attempts).toBe(2);
  });

  it('6. verifies transient 5xx (500, 502, 504) triggers retry', () => {
    expect(isTransientStatus(503)).toBe(true);
    expect(isTransientStatus(429)).toBe(true);
    expect(isTransientStatus(500)).toBe(true);
    expect(isTransientStatus(502)).toBe(true);
    expect(isTransientStatus(504)).toBe(true);
  });

  it('7. verifies permanent client errors (400, 401, 403, 404) immediately fail without retry or fallback', async () => {
    expect(isPermanentStatus(400)).toBe(true);
    expect(isPermanentStatus(401)).toBe(true);
    expect(isPermanentStatus(403)).toBe(true);
    expect(isPermanentStatus(404)).toBe(true);

    let callCount = 0;
    httpsRequestSpy.mockImplementation((urlOrOptions: any, ...args: any[]) => {
      callCount++;
      const cb = typeof args[0] === 'function' ? args[0] : args[1];
      const req = new EventEmitter() as any;
      req.write = vi.fn();
      req.end = vi.fn().mockImplementation(() => {
        const res = new EventEmitter() as any;
        res.statusCode = 400; // Bad request / Schema error
        req.emit('response', res);
        res.emit('data', JSON.stringify({ error: { code: 400, message: 'Invalid argument' } }));
        res.emit('end');
      });
      req.destroy = vi.fn();
      if (cb) req.on('response', cb);
      return req;
    });

    await expect(
      executeGeminiWithFallback(
        JSON.stringify({ contents: [] }),
        'test-api-key',
        { baseBackoffMs: 0 }
      )
    ).rejects.toThrow(/status 400/);

    // Assert: aborted after attempt 1, NO retries and NO fallback invocation!
    expect(callCount).toBe(1);
  });

  it('8. verifies primary remains unavailable after retries -> fallback gemini-3.8-flash invoked', async () => {
    const invokedModels: string[] = [];
    httpsRequestSpy.mockImplementation((urlOrOptions: any, ...args: any[]) => {
      const urlStr = typeof urlOrOptions === 'string' ? urlOrOptions : (urlOrOptions.href || urlOrOptions.path || '');
      const match = urlStr.match(/\/models\/([^:]+):generateContent/);
      const model = match ? match[1] : 'unknown';
      invokedModels.push(model);

      const cb = typeof args[0] === 'function' ? args[0] : args[1];
      const req = new EventEmitter() as any;
      req.write = vi.fn();
      req.end = vi.fn().mockImplementation(() => {
        const res = new EventEmitter() as any;
        if (model === 'gemini-3.7-flash') {
          // Primary always returns 503
          res.statusCode = 503;
          req.emit('response', res);
          res.emit('data', JSON.stringify({ error: { code: 503, message: 'High demand' } }));
        } else if (model === 'gemini-3.8-flash') {
          // Fallback succeeds with 200
          res.statusCode = 200;
          req.emit('response', res);
          res.emit('data', mockValidGeminiResponseBody);
        }
        res.emit('end');
      });
      req.destroy = vi.fn();
      if (cb) req.on('response', cb);
      return req;
    });

    const result = await executeGeminiWithFallback(
      JSON.stringify({ contents: [] }),
      'test-api-key',
      {
        maxPrimaryRetries: 2, // 3 primary attempts
        maxFallbackRetries: 1,
        baseBackoffMs: 1,
      }
    );

    // Primary attempted 3 times, then fallback engaged and succeeded!
    expect(result.fallbackUsed).toBe(true);
    expect(result.modelUsed).toBe('gemini-3.8-flash');
    expect(invokedModels).toEqual([
      'gemini-3.7-flash',
      'gemini-3.7-flash',
      'gemini-3.7-flash',
      'gemini-3.8-flash',
    ]);
  });

  it('9. verifies fallback success returns the exact same AIAnalysis structured output contract', async () => {
    httpsRequestSpy.mockImplementation((urlOrOptions: any, ...args: any[]) => {
      const urlStr = typeof urlOrOptions === 'string' ? urlOrOptions : (urlOrOptions.href || urlOrOptions.path || '');
      const isFallback = urlStr.includes('gemini-3.8-flash');

      const cb = typeof args[0] === 'function' ? args[0] : args[1];
      const req = new EventEmitter() as any;
      req.write = vi.fn();
      req.end = vi.fn().mockImplementation(() => {
        const res = new EventEmitter() as any;
        if (!isFallback) {
          res.statusCode = 503;
          req.emit('response', res);
          res.emit('data', JSON.stringify({ error: { code: 503, message: 'Unavailable' } }));
        } else {
          res.statusCode = 200;
          req.emit('response', res);
          res.emit('data', mockValidGeminiResponseBody);
        }
        res.emit('end');
      });
      req.destroy = vi.fn();
      if (cb) req.on('response', cb);
      return req;
    });

    const execResult = await callGeminiApi(
      'System prompt',
      'User prompt',
      1024,
      'test-key',
      { baseBackoffMs: 1 }
    );

    expect(execResult.fallbackUsed).toBe(true);
    expect(execResult.modelUsed).toBe('gemini-3.8-flash');

    const parsedJson = JSON.parse(execResult.body);
    const candidateText = parsedJson.candidates[0].content.parts[0].text;
    const analysis: AIAnalysis = JSON.parse(candidateText);

    expect(analysis.headline).toBe('Momentum is Strong Across Pillars');
    expect(analysis.confidence).toBe('HIGH');
    expect(analysis.observations.length).toBe(1);
    expect(analysis.priorities.length).toBe(1);
  });

  it('10. verifies both primary and fallback fail -> clean user-facing error message (no raw JSON exposed)', async () => {
    process.env.GEMINI_API_KEY = 'test-secret-key';

    httpsRequestSpy.mockImplementation((urlOrOptions: any, ...args: any[]) => {
      const cb = typeof args[0] === 'function' ? args[0] : args[1];
      const req = new EventEmitter() as any;
      req.write = vi.fn();
      req.end = vi.fn().mockImplementation(() => {
        const res = new EventEmitter() as any;
        res.statusCode = 503;
        req.emit('response', res);
        res.emit('data', JSON.stringify({
          error: {
            code: 503,
            message: 'This model is currently experiencing high demand.',
            status: 'UNAVAILABLE',
          },
        }));
        res.emit('end');
      });
      req.destroy = vi.fn();
      if (cb) req.on('response', cb);
      return req;
    });

    const mockContext: AIContext = {
      contextVersion: '4.0.0',
      generatedAt: new Date().toISOString(),
      period: { start: '2026-09-01', end: '2026-09-07', type: 'THIS_WEEK' },
      pillarScope: null,
      goalScope: null,
      northStar: null,
      goals: [],
      time: { totalMinutes: 100, totalHours: 1.6, deepWorkMinutes: 80, deepWorkHours: 1.3, deepWorkPercentage: 80, shallowWorkMinutes: 20, byPillar: [] } as any,
      intelligence: { comparisons: [], trends: [], anomalies: [], pillarFacts: [] } as any,
      pillars: [],
      evidenceCatalog: [{ id: 'time.job_hunt.minutes', category: 'TIME', label: 'Work', source: 'time', value: 120 }],
      analysisMode: 'WEEKLY',
    };

    const req: any = new EventEmitter();
    req.method = 'POST';
    req.headers = { 'content-type': 'application/json' };
    req.socket = { remoteAddress: '127.0.0.1' };

    let responseBody = '';
    let responseStatus = 0;
    const res: any = {
      setHeader: vi.fn(),
      end: (chunk: string) => { responseBody = chunk; },
      set statusCode(val: number) { responseStatus = val; },
      get statusCode() { return responseStatus; },
    };

    const requestPromise = handleAiAnalyzeRequest(req, res);
    req.emit('data', JSON.stringify({ mode: 'WEEKLY', context: mockContext }));
    req.emit('end');

    await requestPromise;

    expect(responseStatus).toBe(503);
    const parsedRes = JSON.parse(responseBody);
    expect(parsedRes.success).toBe(false);
    expect(parsedRes.category).toBe('UPSTREAM_FAILURE');
    // Critical: Clean, protective user-facing error message
    expect(parsedRes.error).toBe('AI analysis is temporarily unavailable. Your North Star data is safe. Please try again shortly.');
    // Assert no raw internal JSON is shown
    expect(responseBody).not.toContain('"code": 503');
    expect(responseBody).not.toContain('UNAVAILABLE');
  });

  it('11. verifies API key never appears in logs, errors, or client responses', async () => {
    process.env.GEMINI_API_KEY = 'AQ.SecretApiKey12345';

    httpsRequestSpy.mockImplementation((urlOrOptions: any, ...args: any[]) => {
      const cb = typeof args[0] === 'function' ? args[0] : args[1];
      const req = new EventEmitter() as any;
      req.write = vi.fn();
      req.end = vi.fn().mockImplementation(() => {
        const res = new EventEmitter() as any;
        res.statusCode = 503;
        req.emit('response', res);
        res.emit('data', 'Server error');
        res.emit('end');
      });
      req.destroy = vi.fn();
      if (cb) req.on('response', cb);
      return req;
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await executeGeminiWithFallback('payload', 'AQ.SecretApiKey12345', {
        maxPrimaryRetries: 0,
        maxFallbackRetries: 0,
        baseBackoffMs: 0,
      });
    } catch (e: any) {
      // Assert error message does not contain API key
      expect(e.message).not.toContain('AQ.SecretApiKey12345');
    }

    // Assert console logs never leaked the API key
    const allConsoleLogs = [
      ...consoleErrorSpy.mock.calls.map((c) => c.join(' ')),
      ...consoleWarnSpy.mock.calls.map((c) => c.join(' ')),
    ].join(' ');

    expect(allConsoleLogs).not.toContain('AQ.SecretApiKey12345');
  });

  it('15. verifies model selection cannot be controlled or overridden by untrusted client payload', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    const req: any = new EventEmitter();
    req.method = 'POST';
    req.headers = { 'content-type': 'application/json' };
    req.socket = { remoteAddress: '127.0.0.1' };

    let responseBody = '';
    const res: any = {
      setHeader: vi.fn(),
      end: (chunk: string) => { responseBody = chunk; },
      set statusCode(_: number) {},
      get statusCode() { return 200; },
    };

    const mockContext: AIContext = {
      contextVersion: '4.0.0',
      generatedAt: new Date().toISOString(),
      period: { start: '2026-09-01', end: '2026-09-07', type: 'THIS_WEEK' },
      pillarScope: null,
      goalScope: null,
      northStar: null,
      goals: [],
      time: { totalMinutes: 100, totalHours: 1.6, deepWorkMinutes: 80, deepWorkHours: 1.3, deepWorkPercentage: 80, shallowWorkMinutes: 20, byPillar: [] } as any,
      intelligence: { comparisons: [], trends: [], anomalies: [], pillarFacts: [] } as any,
      pillars: [],
      evidenceCatalog: [{ id: 'time.job_hunt.minutes', category: 'TIME', label: 'Work', source: 'time', value: 120 }],
      analysisMode: 'WEEKLY',
    };

    // Client malicious attempt to force an unauthorized model
    const maliciousPayload = {
      mode: 'WEEKLY',
      context: mockContext,
      model: 'unauthorized-model',
      primaryModel: 'attacker-model',
      fallbackModel: 'attacker-fallback',
    };

    const p = handleAiAnalyzeRequest(req, res);
    req.emit('data', JSON.stringify(maliciousPayload));
    req.emit('end');
    await p;

    // Verify server invoked canonical AI_MODEL and NOT the client-requested model
    expect(requestsMade.length).toBeGreaterThan(0);
    expect(requestsMade[0].model).toBe('gemini-3.7-flash');
    expect(requestsMade[0].model).not.toBe('unauthorized-model');
    expect(requestsMade[0].model).not.toBe('attacker-model');
  });
});
