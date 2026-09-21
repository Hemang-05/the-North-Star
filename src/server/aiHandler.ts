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

export type ValidateAnalyzeResult =
  | { valid: true; data: AnalyzeRequestBody; error?: never }
  | { valid: false; error: string; data?: never };

/**
 * Reads HTTP request body with byte size bounds.
 */
export async function readRequestBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  const anyReq = req as any;
  if (anyReq.body !== undefined && anyReq.body !== null) {
    if (typeof anyReq.body === 'string') return anyReq.body;
    return JSON.stringify(anyReq.body);
  }

  let bodyBuffer = '';
  let byteCount = 0;

  for await (const chunk of req) {
    byteCount += chunk.length;
    if (byteCount > maxBytes) {
      throw new Error(`Payload too large. Max allowed: ${maxBytes} bytes`);
    }
    bodyBuffer += chunk.toString('utf8');
  }

  return bodyBuffer;
}

/**
 * Validates request payload against security and schema constraints.
 */
export function validateAnalyzeRequest(body: unknown): ValidateAnalyzeResult {
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

  return executeGeminiWithFallback(payload, apiKey, 45000);
}

/**
 * Executes a Gemini generateContent request with automatic fallback
 * when the primary model experiences high demand spikes (503), rate limits (429), or 404s.
 */
export async function executeGeminiWithFallback(
  payload: string,
  apiKey: string,
  timeoutMs: number = 30000
): Promise<string> {
  const models = [AI_MODEL, 'gemini-3.6-flash'];
  let lastError = '';

  for (const model of models) {
    try {
      const response = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const req = https.request(
          url,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            },
            timeout: timeoutMs,
          },
          (res) => {
            let responseBody = '';
            res.on('data', (chunk) => {
              responseBody += chunk;
            });
            res.on('end', () => {
              resolve({ statusCode: res.statusCode || 500, body: responseBody });
            });
          }
        );

        req.on('timeout', () => {
          req.destroy();
          reject(new Error(`Gemini API call to ${model} timed out after ${timeoutMs / 1000}s`));
        });

        req.on('error', (err) => reject(err));
        req.write(payload);
        req.end();
      });

      if (response.statusCode === 200) {
        return response.body;
      }

      // If high demand (503), not found (404), or rate limited (429), log and try fallback
      lastError = `Gemini API (${model}) returned status ${response.statusCode}: ${response.body.slice(0, 300)}`;
      if (response.statusCode === 503 || response.statusCode === 404 || response.statusCode === 429) {
        console.warn(`[AI Server] ${model} unavailable (status ${response.statusCode}). Attempting fallback model...`);
        continue;
      }

      // Client error (e.g. 400 bad schema), fail immediately
      throw new Error(lastError);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = msg;
      console.warn(`[AI Server] Error calling ${model}: ${msg}. Attempting fallback...`);
    }
  }

  throw new Error(lastError || 'All Gemini models failed to respond.');
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
  try {
    bodyBuffer = await readRequestBody(req, MAX_BODY_BYTES);
  } catch (err: unknown) {
    res.statusCode = 413;
    const msg = err instanceof Error ? err.message : `Payload too large. Max allowed: ${MAX_BODY_BYTES} bytes`;
    res.end(JSON.stringify({ success: false, error: msg }));
    return;
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

// ============================================================================
// JOB DESCRIPTION (JD) PARSING ENDPOINT
// ============================================================================

export const JD_EXTRACTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    company: { type: 'STRING' },
    role: { type: 'STRING' },
    workMode: { type: 'STRING', enum: ['REMOTE', 'HYBRID', 'ONSITE'] },
    location: { type: 'STRING' },
    minSalary: { type: 'NUMBER' },
    maxSalary: { type: 'NUMBER' },
    currency: { type: 'STRING' },
    skills: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    summary: { type: 'STRING' },
  },
  required: ['company', 'role', 'workMode'],
};

export async function callGeminiJdExtraction(
  jdText: string,
  apiKey: string
): Promise<string> {
  const systemPrompt = `You are a precision recruitment and job description parser.
Extract key job metadata accurately from raw, unformatted, or noisy job descriptions.
Rules:
1. company: The hiring company name. If confidential, output "Confidential".
2. role: The clean job title (strip out location tags or internal codes).
3. workMode: Strictly one of "REMOTE", "HYBRID", or "ONSITE".
4. location: City, State/Region, Country if specified.
5. minSalary and maxSalary: If provided, normalize to total annual numbers (e.g., ₹18 LPA -> 1800000; $120k -> 120000). If not provided, omit or set to null.
6. currency: ISO code (e.g. INR, USD, EUR, GBP) if salary is present.
7. skills: Array of top 5-8 essential required technical skills or competencies.
8. summary: 1-2 sentence high-level overview of the role.
Return strictly valid JSON matching the schema.`;

  const payload = JSON.stringify({
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: `Parse this job description:\n\n${jdText.slice(0, 10000)}` }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: JD_EXTRACTION_SCHEMA,
      temperature: 0.1,
    },
  });

  return executeGeminiWithFallback(payload, apiKey, 30000);
}

/**
 * Handles HTTP requests for `/api/ai/parse-jd`.
 */
export async function handleAiParseJdRequest(
  req: IncomingMessage,
  res: ServerResponse,
  limiter: RateLimiter = defaultRateLimiter
): Promise<void> {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method Not Allowed. Use POST.' }));
    return;
  }

  // Rate Limiting
  const clientIp = req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || 'local';
  const rateLimitResult = limiter.check(clientIp);
  if (!rateLimitResult.allowed) {
    res.statusCode = 429;
    res.end(JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment before parsing another JD.' }));
    return;
  }

  // API Key Check
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: 'GEMINI_API_KEY is not configured on the server.' }));
    return;
  }

  try {
    const rawBody = await readRequestBody(req, MAX_BODY_BYTES);
    let parsedBody: { jdText?: string };
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Invalid JSON body.' }));
      return;
    }

    const { jdText } = parsedBody;
    if (!jdText || typeof jdText !== 'string' || jdText.trim().length === 0) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Missing or empty "jdText" field.' }));
      return;
    }

    const rawResponse = await callGeminiJdExtraction(jdText, apiKey);
    const geminiData = JSON.parse(rawResponse);
    const candidateText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      throw new Error('Gemini returned an empty extraction.');
    }

    // Defensive: strip markdown fences if present
    const cleanJson = candidateText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const extracted = JSON.parse(cleanJson);
    res.statusCode = 200;
    res.end(JSON.stringify(extracted));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[JD Parser Server Error]:', message);
    res.statusCode = 502;
    res.end(JSON.stringify({ error: message }));
  }
}
