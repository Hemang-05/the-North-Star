// ============================================================================
// PERSONAL OS — Server AI Rate Limiter Abstraction
// Decouples rate limiting policy & storage from the HTTP endpoint handler.
// Default: Sliding window in-memory limiter (30 requests/minute/client IP).
// Ready for future Redis / distributed store swap without changing aiHandler contract.
// ============================================================================

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
  retryAfterSeconds?: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
  reset?(key?: string): void;
}

export interface SlidingWindowRateLimiterOptions {
  windowMs?: number; // default: 60,000 (1 minute)
  maxRequests?: number; // default: 30 requests / window
}

/**
 * In-memory sliding-window log implementation of RateLimiter.
 * Tracks timestamps per client key and prunes records older than windowMs.
 */
export class InMemorySlidingWindowRateLimiter implements RateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly clients: Map<string, number[]> = new Map();

  constructor(options: SlidingWindowRateLimiterOptions = {}) {
    this.windowMs = options.windowMs ?? 60_000;
    this.maxRequests = options.maxRequests ?? 30;
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let timestamps = this.clients.get(key);
    if (!timestamps) {
      timestamps = [];
      this.clients.set(key, timestamps);
    }

    // Retain only timestamps within the sliding window
    timestamps = timestamps.filter((t) => t > windowStart);
    this.clients.set(key, timestamps);

    if (timestamps.length >= this.maxRequests) {
      const oldestInWindow = timestamps[0] ?? now;
      const resetMs = Math.max(0, oldestInWindow + this.windowMs - now);
      const retryAfterSeconds = Math.max(1, Math.ceil(resetMs / 1000));

      return {
        allowed: false,
        limit: this.maxRequests,
        remaining: 0,
        resetMs,
        retryAfterSeconds,
      };
    }

    // Add current request timestamp
    timestamps.push(now);

    return {
      allowed: true,
      limit: this.maxRequests,
      remaining: this.maxRequests - timestamps.length,
      resetMs: this.windowMs,
    };
  }

  reset(key?: string): void {
    if (key) {
      this.clients.delete(key);
    } else {
      this.clients.clear();
    }
  }
}

/**
 * Standard singleton instance configured for 30 requests/minute/client IP.
 */
export const defaultRateLimiter: RateLimiter = new InMemorySlidingWindowRateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
});
