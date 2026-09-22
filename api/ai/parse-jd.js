// src/server/aiHandler.ts
import https from "node:https";

// src/types/ai.ts
var AI_MODEL = "gemini-3.7-flash";
var AI_FALLBACK_MODEL = "gemini-3.8-flash";
var THINKING_LEVEL_BUDGETS = {
  LOW: 1024,
  MEDIUM: 2048,
  HIGH: 4096
};
var AI_MODE_CONFIG = {
  DAILY: { thinkingLevel: "LOW", thinkingBudget: THINKING_LEVEL_BUDGETS.LOW },
  WEEKLY: { thinkingLevel: "MEDIUM", thinkingBudget: THINKING_LEVEL_BUDGETS.MEDIUM },
  MONTHLY: { thinkingLevel: "HIGH", thinkingBudget: THINKING_LEVEL_BUDGETS.HIGH },
  NORTH_STAR: { thinkingLevel: "HIGH", thinkingBudget: THINKING_LEVEL_BUDGETS.HIGH },
  PILLAR: { thinkingLevel: "MEDIUM", thinkingBudget: THINKING_LEVEL_BUDGETS.MEDIUM },
  GOAL: { thinkingLevel: "MEDIUM", thinkingBudget: THINKING_LEVEL_BUDGETS.MEDIUM },
  BRUTAL: { thinkingLevel: "HIGH", thinkingBudget: THINKING_LEVEL_BUDGETS.HIGH },
  USER_QUERY: { thinkingLevel: "MEDIUM", thinkingBudget: THINKING_LEVEL_BUDGETS.MEDIUM }
};

// src/server/rateLimiter.ts
var InMemorySlidingWindowRateLimiter = class {
  windowMs;
  maxRequests;
  clients = /* @__PURE__ */ new Map();
  constructor(options = {}) {
    this.windowMs = options.windowMs ?? 6e4;
    this.maxRequests = options.maxRequests ?? 30;
  }
  check(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    let timestamps = this.clients.get(key);
    if (!timestamps) {
      timestamps = [];
      this.clients.set(key, timestamps);
    }
    timestamps = timestamps.filter((t) => t > windowStart);
    this.clients.set(key, timestamps);
    if (timestamps.length >= this.maxRequests) {
      const oldestInWindow = timestamps[0] ?? now;
      const resetMs = Math.max(0, oldestInWindow + this.windowMs - now);
      const retryAfterSeconds = Math.max(1, Math.ceil(resetMs / 1e3));
      return {
        allowed: false,
        limit: this.maxRequests,
        remaining: 0,
        resetMs,
        retryAfterSeconds
      };
    }
    timestamps.push(now);
    return {
      allowed: true,
      limit: this.maxRequests,
      remaining: this.maxRequests - timestamps.length,
      resetMs: this.windowMs
    };
  }
  reset(key) {
    if (key) {
      this.clients.delete(key);
    } else {
      this.clients.clear();
    }
  }
};
var defaultRateLimiter = new InMemorySlidingWindowRateLimiter({
  windowMs: 6e4,
  maxRequests: 30
});

// src/server/aiHandler.ts
var MAX_BODY_BYTES = 512 * 1024;
async function readRequestBody(req, maxBytes) {
  const anyReq = req;
  if (anyReq.body !== void 0 && anyReq.body !== null) {
    if (typeof anyReq.body === "string") return anyReq.body;
    return JSON.stringify(anyReq.body);
  }
  if (anyReq.readableEnded || anyReq.complete) {
    return "";
  }
  return new Promise((resolve, reject) => {
    let bodyBuffer = "";
    let byteCount = 0;
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve(bodyBuffer);
      }
    }, 5e3);
    const onData = (chunk) => {
      const len = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk));
      byteCount += len;
      if (byteCount > maxBytes) {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          cleanup();
          reject(new Error(`Payload too large. Max allowed: ${maxBytes} bytes`));
        }
        return;
      }
      bodyBuffer += chunk.toString("utf8");
    };
    const onEnd = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        cleanup();
        resolve(bodyBuffer);
      }
    };
    const onError = (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        cleanup();
        reject(err);
      }
    };
    const cleanup = () => {
      req.removeListener("data", onData);
      req.removeListener("end", onEnd);
      req.removeListener("error", onError);
    };
    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
    if (anyReq.readableEnded || anyReq.complete) {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        cleanup();
        resolve(bodyBuffer);
      }
    }
  });
}
function isTransientStatus(statusCode) {
  return statusCode === 503 || statusCode === 429 || statusCode === 500 || statusCode === 502 || statusCode === 504;
}
function isPermanentStatus(statusCode) {
  return statusCode === 400 || statusCode === 401 || statusCode === 403 || statusCode === 404;
}
function calculateBackoffDelay(attempt, baseBackoffMs) {
  if (baseBackoffMs <= 0) return 0;
  const exponential = baseBackoffMs * Math.pow(2, attempt - 1);
  const jitter = Math.floor(Math.random() * (baseBackoffMs * 0.5));
  return exponential + jitter;
}
async function performGeminiHttpRequest(model, payload, apiKey, timeoutMs) {
  let modelPayload = payload;
  if (model !== AI_MODEL && model !== AI_FALLBACK_MODEL) {
    try {
      const parsed = JSON.parse(payload);
      if (parsed.generationConfig?.thinkingConfig) {
        delete parsed.generationConfig.thinkingConfig;
        modelPayload = JSON.stringify(parsed);
      }
    } catch {
    }
  }
  return new Promise((resolve, reject) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const req = https.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(modelPayload)
        },
        timeout: timeoutMs
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          resolve({ statusCode: res.statusCode || 500, body: responseBody });
        });
      }
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Gemini API call to ${model} timed out after ${timeoutMs / 1e3}s`));
    });
    req.on("error", (err) => reject(err));
    req.write(modelPayload);
    req.end();
  });
}
async function executeGeminiWithFallback(payload, apiKey, optionsOrTimeout = 3e4) {
  const options = typeof optionsOrTimeout === "number" ? { timeoutMs: optionsOrTimeout } : optionsOrTimeout;
  const primaryModel = options.primaryModel || AI_MODEL;
  const fallbackModel = options.fallbackModel || AI_FALLBACK_MODEL;
  const maxPrimaryRetries = options.maxPrimaryRetries ?? 2;
  const maxFallbackRetries = options.maxFallbackRetries ?? 1;
  const baseBackoffMs = options.baseBackoffMs ?? 600;
  const timeoutMs = options.timeoutMs ?? 3e4;

  let totalAttempts = 0;
  let lastError = "";

  for (let attempt = 1; attempt <= (1 + maxPrimaryRetries); attempt++) {
    totalAttempts++;
    try {
      const response = await performGeminiHttpRequest(primaryModel, payload, apiKey, timeoutMs);
      if (response.statusCode === 200) {
        if (attempt > 1) {
          console.log(`[AI Server] Primary model (${primaryModel}) succeeded on retry attempt ${attempt}.`);
        }
        return {
          body: response.body,
          modelUsed: primaryModel,
          fallbackUsed: false,
          attempts: totalAttempts
        };
      }
      lastError = `Gemini API (${primaryModel}) returned status ${response.statusCode}: ${response.body.slice(0, 300)}`;
      if (isPermanentStatus(response.statusCode)) {
        console.warn(`[AI Server] Permanent error (${response.statusCode}) from ${primaryModel}. Aborting without retry or fallback.`);
        throw new Error(lastError);
      }
      if (isTransientStatus(response.statusCode)) {
        console.warn(`[AI Server] ${primaryModel} transient failure (${response.statusCode}) on attempt ${attempt}/${1 + maxPrimaryRetries}.`);
        if (attempt <= maxPrimaryRetries) {
          const delay = calculateBackoffDelay(attempt, baseBackoffMs);
          if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
          continue;
        }
      } else {
        throw new Error(lastError);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = msg;
      if (msg.includes("status 400") || msg.includes("status 401") || msg.includes("status 403") || msg.includes("status 404")) {
        throw err;
      }
      console.warn(`[AI Server] Network/timeout error calling ${primaryModel} on attempt ${attempt}/${1 + maxPrimaryRetries}: ${msg}`);
      if (attempt <= maxPrimaryRetries) {
        const delay = calculateBackoffDelay(attempt, baseBackoffMs);
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        continue;
      }
    }
  }

  console.warn(`[AI Server] Primary model (${primaryModel}) exhausted ${1 + maxPrimaryRetries} attempts. Engaging controlled fallback to ${fallbackModel}...`);

  for (let attempt = 1; attempt <= (1 + maxFallbackRetries); attempt++) {
    totalAttempts++;
    try {
      const response = await performGeminiHttpRequest(fallbackModel, payload, apiKey, timeoutMs);
      if (response.statusCode === 200) {
        console.log(`[AI Server] Fallback model (${fallbackModel}) succeeded on attempt ${attempt}.`);
        return {
          body: response.body,
          modelUsed: fallbackModel,
          fallbackUsed: true,
          attempts: totalAttempts
        };
      }
      lastError = `Gemini Fallback API (${fallbackModel}) returned status ${response.statusCode}: ${response.body.slice(0, 300)}`;
      if (isPermanentStatus(response.statusCode)) {
        console.warn(`[AI Server] Permanent error (${response.statusCode}) from fallback model ${fallbackModel}.`);
        throw new Error(lastError);
      }
      if (isTransientStatus(response.statusCode)) {
        console.warn(`[AI Server] Fallback model (${fallbackModel}) transient failure (${response.statusCode}) on attempt ${attempt}/${1 + maxFallbackRetries}.`);
        if (attempt <= maxFallbackRetries) {
          const delay = calculateBackoffDelay(attempt, baseBackoffMs);
          if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
          continue;
        }
      } else {
        throw new Error(lastError);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = msg;
      if (msg.includes("status 400") || msg.includes("status 401") || msg.includes("status 403") || msg.includes("status 404")) {
        throw err;
      }
      console.warn(`[AI Server] Network/timeout error calling fallback ${fallbackModel} on attempt ${attempt}: ${msg}`);
      if (attempt <= maxFallbackRetries) {
        const delay = calculateBackoffDelay(attempt, baseBackoffMs);
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        continue;
      }
    }
  }

  console.error(`[AI Server] Both primary (${primaryModel}) and fallback (${fallbackModel}) models exhausted. Final error: ${lastError}`);
  throw new Error(lastError || "All Gemini models failed to respond.");
}
function extractClientKey(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.socket?.remoteAddress || "127.0.0.1";
}
var JD_EXTRACTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    company: { type: "STRING" },
    role: { type: "STRING" },
    workMode: { type: "STRING", enum: ["REMOTE", "HYBRID", "ONSITE"] },
    location: { type: "STRING" },
    minSalary: { type: "NUMBER" },
    maxSalary: { type: "NUMBER" },
    currency: { type: "STRING" },
    skills: {
      type: "ARRAY",
      items: { type: "STRING" }
    },
    summary: { type: "STRING" }
  },
  required: ["company", "role", "workMode"]
};
async function callGeminiJdExtraction(jdText, apiKey) {
  const systemPrompt = `You are a precision recruitment and job description parser.
Extract key job metadata accurately from raw, unformatted, or noisy job descriptions.
Rules:
1. company: The hiring company name. If confidential, output "Confidential".
2. role: The clean job title (strip out location tags or internal codes).
3. workMode: Strictly one of "REMOTE", "HYBRID", or "ONSITE".
4. location: City, State/Region, Country if specified.
5. minSalary and maxSalary: If provided, normalize to total annual numbers (e.g., \u20B918 LPA -> 1800000; $120k -> 120000). If not provided, omit or set to null.
6. currency: ISO code (e.g. INR, USD, EUR, GBP) if salary is present.
7. skills: Array of top 5-8 essential required technical skills or competencies.
8. summary: 1-2 sentence high-level overview of the role.
Return strictly valid JSON matching the schema.`;
  const payload = JSON.stringify({
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [
      {
        role: "user",
        parts: [{ text: `Parse this job description:

${jdText.slice(0, 1e4)}` }]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: JD_EXTRACTION_SCHEMA,
      temperature: 0.1
    }
  });
  return executeGeminiWithFallback(payload, apiKey, 3e4);
}
async function handleAiParseJdRequest(req, res, limiter = defaultRateLimiter) {
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.end();
    return;
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method Not Allowed. Use POST." }));
    return;
  }
  const clientIp = extractClientKey(req);
  const rateLimitResult = limiter.check(clientIp);
  if (!rateLimitResult.allowed) {
    res.statusCode = 429;
    res.end(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment before parsing another JD." }));
    return;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "GEMINI_API_KEY is not configured on the server." }));
    return;
  }
  try {
    const rawBody = await readRequestBody(req, MAX_BODY_BYTES);
    let parsedBody;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Invalid JSON body." }));
      return;
    }
    const { jdText } = parsedBody;
    if (!jdText || typeof jdText !== "string" || jdText.trim().length === 0) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Missing or empty "jdText" field.' }));
      return;
    }
    const execResult = await callGeminiJdExtraction(jdText, apiKey);
    const geminiData = JSON.parse(execResult.body);
    const candidateText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error("Gemini returned an empty extraction.");
    }
    const cleanJson = candidateText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const extracted = JSON.parse(cleanJson);
    res.statusCode = 200;
    res.end(JSON.stringify(extracted));
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    console.error("[JD Parser Server Error]:", rawMessage);
    const isTransient = rawMessage.includes("503") || rawMessage.includes("429") || rawMessage.includes("timed out") || rawMessage.includes("exhausted");
    const userFacingError = isTransient
      ? "Job description parsing is temporarily unavailable. Please try again shortly."
      : "Failed to extract job description details.";
    res.statusCode = isTransient ? 503 : 502;
    res.end(JSON.stringify({ error: userFacingError }));
  }
}

// api/ai/parse-jd.ts
async function handler(req, res) {
  try {
    await handleAiParseJdRequest(req, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[API Serverless Error]:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: `Serverless invocation error: ${message}` }));
    }
  }
}
export {
  handler as default
};
