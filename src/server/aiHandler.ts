// ============================================================================
// PERSONAL OS — Server AI Endpoint Handler
// Server-side boundary protecting the Gemini API key.
// Handles validation, quota/size limits, Gemini 3.7 Flash invocation,
// response validation, and evidence reference verification.
// ============================================================================

import type { IncomingMessage, ServerResponse } from 'node:http';
import https from 'node:https';
import {
  AI_MODEL,
  AI_MODE_CONFIG,
  type AIAnalysis,
  type AIAnalysisMode,
  type AIContext,
} from '../types/ai.ts';
import { buildAISystemPrompt, buildAIUserPrompt } from '../services/ai/aiPrompts.ts';
import { defaultRateLimiter, type RateLimiter } from './rateLimiter.ts';

export const MAX_BODY_BYTES = 512 * 1024; // 512KB limit
export const MAX_USER_QUERY_CHARS = 1000;

export const ALLOWED_MODES: Set<AIAnalysisMode> = new Set([
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'NORTH_STAR',
  'PILLAR',
  'GOAL',
  'BRUTAL',
  'USER_QUERY',
]);

export const AI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline: { type: 'STRING' },
    summary: { type: 'STRING' },
    confidence: { type: 'STRING', enum: ['LOW', 'MEDIUM', 'HIGH'] },
    observations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          type: { type: 'STRING', enum: ['FACT', 'INFERENCE', 'UNCERTAINTY'] },
          category: { type: 'STRING', enum: ['TIME', 'GOAL', 'OUTCOME', 'ALIGNMENT', 'FINANCIAL'] },
          statement: { type: 'STRING' },
          evidenceRefs: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['id', 'type', 'category', 'statement', 'evidenceRefs'],
      },
    },
    patterns: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          title: { type: 'STRING' },
          description: { type: 'STRING' },
          pillarIds: { type: 'ARRAY', items: { type: 'STRING' } },
          significance: { type: 'STRING', enum: ['HIGH', 'MEDIUM', 'LOW'] },
          evidenceRefs: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['id', 'title', 'description', 'pillarIds', 'significance', 'evidenceRefs'],
      },
    },
    contradictions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          statedIntent: { type: 'STRING' },
          observedReality: { type: 'STRING' },
          severity: { type: 'STRING', enum: ['CRITICAL', 'WARNING', 'NOTE'] },
          evidenceRefs: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['id', 'statedIntent', 'observedReality', 'severity', 'evidenceRefs'],
      },
    },
    risks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          title: { type: 'STRING' },
          description: { type: 'STRING' },
          pillarId: { type: 'STRING' },
          severity: { type: 'STRING', enum: ['HIGH', 'MEDIUM', 'LOW'] },
          mitigationFact: { type: 'STRING' },
        },
        required: ['id', 'title', 'description', 'severity'],
      },
    },
    opportunities: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          title: { type: 'STRING' },
          description: { type: 'STRING' },
          pillarId: { type: 'STRING' },
        },
        required: ['id', 'title', 'description'],
      },
    },
    priorities: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          rank: { type: 'INTEGER' },
          area: { type: 'STRING' },
          rationale: { type: 'STRING' },
          nature: { type: 'STRING', enum: ['OBSERVED', 'INFERRED', 'PRIORITY', 'OPTIONAL_SUGGESTION'] },
        },
        required: ['id', 'rank', 'area', 'rationale', 'nature'],
      },
    },
    goalAnalysis: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          goalId: { type: 'STRING' },
          goalTitle: { type: 'STRING' },
          status: { type: 'STRING' },
          varianceExplanation: { type: 'STRING' },
          trajectory: { type: 'STRING', enum: ['IMPROVING', 'STABLE', 'DETERIORATING', 'UNKNOWN'] },
          evidenceRefs: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['goalId', 'goalTitle', 'status', 'varianceExplanation', 'trajectory', 'evidenceRefs'],
      },
    },
  },
  required: [
    'headline',
    'summary',
    'confidence',
    'observations',
    'patterns',
    'contradictions',
    'risks',
    'opportunities',
    'priorities',
    'goalAnalysis',
  ],
};

export interface AnalyzeRequestBody {
  mode: AIAnalysisMode;
  context: AIContext;
  thinkingBudgetOverride?: number;
}

/**
 * Validates request payload against security and schema constraints.
 */
export function validateAnalyzeRequest(body: unknown): { valid: true; data: AnalyzeRequestBody } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be an object' };
  }

  const { mode, context } = body as Partial<AnalyzeRequestBody>;

  if (!mode || !ALLOWED_MODES.has(mode)) {
    return { valid: false, error: `Invalid or missing analysisMode: "${mode}"` };
  }

  if (!context || typeof context !== 'object') {
    return { valid: false, error: 'Missing or invalid context object' };
  }

  if (context.contextVersion !== '4.0.0') {
    return { valid: false, error: `Unsupported contextVersion: "${context.contextVersion}". Expected "4.0.0"` };
  }

  if (!context.period || !context.period.start || !context.period.end) {
    return { valid: false, error: 'Context missing required period boundaries' };
  }

  if (!Array.isArray(context.goals) || !context.time || !context.intelligence) {
    return { valid: false, error: 'Context missing required goals, time, or intelligence sections' };
  }

  if (!Array.isArray(context.evidenceCatalog)) {
    return { valid: false, error: 'Context missing required evidenceCatalog array' };
  }

  if (context.userQuery && context.userQuery.length > MAX_USER_QUERY_CHARS) {
    return { valid: false, error: `userQuery exceeds maximum allowed length of ${MAX_USER_QUERY_CHARS} characters` };
  }

  return { valid: true, data: body as AnalyzeRequestBody };
}

/**
 * Validates and filters evidence references in the parsed AI output
 * against the supplied catalog to guarantee zero fabricated evidence IDs.
 */
export function sanitizeEvidenceReferences(analysis: AIAnalysis, validIds: Set<string>): AIAnalysis {
  const sanitizeRefs = (refs?: string[]): string[] => {
    if (!Array.isArray(refs)) return [];
    return refs.filter((id) => typeof id === 'string' && validIds.has(id));
  };

  return {
    ...analysis,
    observations: (analysis.observations || []).map((obs) => ({
      ...obs,
      evidenceRefs: sanitizeRefs(obs.evidenceRefs),
    })),
    patterns: (analysis.patterns || []).map((pat) => ({
      ...pat,
      evidenceRefs: sanitizeRefs(pat.evidenceRefs),
    })),
    contradictions: (analysis.contradictions || []).map((con) => ({
      ...con,
      evidenceRefs: sanitizeRefs(con.evidenceRefs),
    })),
    goalAnalysis: (analysis.goalAnalysis || []).map((ga) => ({
      ...ga,
      evidenceRefs: sanitizeRefs(ga.evidenceRefs),
    })),
  };
}

/**
 * Dispatches request directly to Google Gemini 3.7 Flash using the server-side API key.
 */
export async function callGeminiApi(
  systemPrompt: string,
  userPrompt: string,
  thinkingBudget: number,
  apiKey: string
): Promise<string> {
  const payload = JSON.stringify({
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: AI_RESPONSE_SCHEMA,
      thinkingConfig: {
        thinkingBudget,
      },
    },
  });

  return new Promise((resolve, reject) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${apiKey}`;
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 45000,
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(responseBody);
          } else {
            reject(new Error(`Gemini API returned status ${res.statusCode}: ${responseBody.slice(0, 300)}`));
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Gemini API call timed out after 45s'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Extracts client identity key (e.g. IP address) for rate limiting.
 */
export function extractClientKey(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

/**
 * Handles incoming HTTP requests for `/api/ai/health`.
 * Exposes strictly status and model, NEVER server configuration, keys, or secrets.
 */
export function handleAiHealthRequest(_req: IncomingMessage, res: ServerResponse): void {
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(
    JSON.stringify({
      status: 'ok',
      model: AI_MODEL,
    })
  );
}

/**
 * Handles incoming Node HTTP requests for `/api/ai/analyze`.
 */
export async function handleAiAnalyzeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  limiter: RateLimiter = defaultRateLimiter
): Promise<void> {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
    return;
  }

  // 1. Rate limiting check
  const clientKey = extractClientKey(req);
  const rateLimitResult = limiter.check(clientKey);

  res.setHeader('X-RateLimit-Limit', String(rateLimitResult.limit));
  res.setHeader('X-RateLimit-Remaining', String(rateLimitResult.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(rateLimitResult.resetMs / 1000)));

  if (!rateLimitResult.allowed) {
    res.statusCode = 429;
    if (rateLimitResult.retryAfterSeconds) {
      res.setHeader('Retry-After', String(rateLimitResult.retryAfterSeconds));
    }
    res.end(
      JSON.stringify({
        success: false,
        category: 'RATE_LIMITED',
        error: `Rate limit exceeded. Max ${rateLimitResult.limit} requests per minute. Try again in ${rateLimitResult.retryAfterSeconds}s.`,
        retryAfterSeconds: rateLimitResult.retryAfterSeconds,
      })
    );
    return;
  }

  // 2. Read request body with size bounds
  let bodyBuffer = '';
  let byteCount = 0;

  for await (const chunk of req) {
    byteCount += chunk.length;
    if (byteCount > MAX_BODY_BYTES) {
      res.statusCode = 413;
      res.end(JSON.stringify({ success: false, error: `Payload too large. Max allowed: ${MAX_BODY_BYTES} bytes` }));
      return;
    }
    bodyBuffer += chunk.toString('utf8');
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(bodyBuffer);
  } catch {
    res.statusCode = 400;
    res.end(JSON.stringify({ success: false, error: 'Malformed JSON payload' }));
    return;
  }

  // 2. Validate request
  const validation = validateAnalyzeRequest(parsedJson);
  if (!validation.valid) {
    res.statusCode = 400;
    res.end(JSON.stringify({ success: false, error: validation.error }));
    return;
  }

  const { mode, context, thinkingBudgetOverride } = validation.data;

  // 3. Obtain API key strictly from server environment
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.statusCode = 503;
    res.end(
      JSON.stringify({
        success: false,
        category: 'CONFIG_MISSING',
        error: 'GEMINI_API_KEY is not configured on the server. Set it in .env or environment variables.',
      })
    );
    return;
  }

  // 4. Determine thinking budget from mode config
  const modeConfig = AI_MODE_CONFIG[mode];
  const thinkingBudget = typeof thinkingBudgetOverride === 'number'
    ? thinkingBudgetOverride
    : modeConfig.thinkingBudget;

  const systemPrompt = buildAISystemPrompt(mode);
  const userPrompt = buildAIUserPrompt(context);

  // 5. Call Gemini 3.7 Flash API
  const startTime = Date.now();
  try {
    const rawResponse = await callGeminiApi(systemPrompt, userPrompt, thinkingBudget, apiKey);
    const latencyMs = Date.now() - startTime;

    const geminiJson = JSON.parse(rawResponse);
    const candidateText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      throw new Error('Gemini response missing candidate text part');
    }

    const analysisParsed: AIAnalysis = JSON.parse(candidateText);

    // 6. Verify evidence catalog references
    const validEvidenceIds = new Set(context.evidenceCatalog.map((e) => e.id));
    const sanitizedAnalysis = sanitizeEvidenceReferences(analysisParsed, validEvidenceIds);

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        analysis: sanitizedAnalysis,
        provider: 'gemini',
        model: AI_MODEL,
        mode,
        latencyMs,
        createdAt: new Date().toISOString(),
      })
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Layer 4 AI Server Error]:', message);

    res.statusCode = 502;
    res.end(
      JSON.stringify({
        success: false,
        category: 'UPSTREAM_FAILURE',
        error: message,
      })
    );
  }
}
