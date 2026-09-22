// src/types/ai.ts
var AI_MODEL = "gemini-3.7-flash";
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
function handleAiHealthRequest(_req, res) {
  res.setHeader("Content-Type", "application/json");
  res.statusCode = 200;
  res.end(
    JSON.stringify({
      status: "ok",
      model: AI_MODEL
    })
  );
}

// api/ai/health.ts
function handler(req, res) {
  try {
    handleAiHealthRequest(req, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[API Serverless Error]:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ status: "error", error: message }));
    }
  }
}
export {
  handler as default
};
