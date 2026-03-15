/**
 * Simple in-memory rate limiter using sliding window.
 * Suitable for single-instance deployments. For multi-instance,
 * replace with Redis-based solution.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of Array.from(store)) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface RateLimitConfig {
  /** Max number of requests allowed in the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, {
      count: 1,
      resetAt: now + config.windowSeconds * 1000,
    });
    return { allowed: true, remaining: config.maxRequests - 1, retryAfterSeconds: 0 };
  }

  if (entry.count >= config.maxRequests) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count, retryAfterSeconds: 0 };
}

/** Rate limit presets for common use cases */
export const RATE_LIMITS = {
  /** Login: 5 attempts per 15 minutes per email */
  login: { maxRequests: 5, windowSeconds: 15 * 60 },
  /** Register: 3 attempts per hour per IP */
  register: { maxRequests: 3, windowSeconds: 60 * 60 },
  /** Password reset: 3 attempts per 15 minutes per email */
  passwordReset: { maxRequests: 3, windowSeconds: 15 * 60 },
  /** Email verification resend: 3 per hour per email */
  verificationResend: { maxRequests: 3, windowSeconds: 60 * 60 },
} as const;
