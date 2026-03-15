import { rateLimit, RATE_LIMITS } from "../rate-limit";

describe("rateLimit", () => {
  // Use unique keys per test to avoid cross-test contamination
  let testId = 0;
  const uniqueKey = () => `test-${Date.now()}-${testId++}`;

  it("should allow first request", () => {
    const key = uniqueKey();
    const result = rateLimit(key, { maxRequests: 5, windowSeconds: 60 });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.retryAfterSeconds).toBe(0);
  });

  it("should decrement remaining count", () => {
    const key = uniqueKey();
    const config = { maxRequests: 3, windowSeconds: 60 };

    const r1 = rateLimit(key, config);
    expect(r1.remaining).toBe(2);

    const r2 = rateLimit(key, config);
    expect(r2.remaining).toBe(1);

    const r3 = rateLimit(key, config);
    expect(r3.remaining).toBe(0);
  });

  it("should block after max requests exceeded", () => {
    const key = uniqueKey();
    const config = { maxRequests: 2, windowSeconds: 60 };

    rateLimit(key, config); // 1st
    rateLimit(key, config); // 2nd

    const blocked = rateLimit(key, config); // 3rd - should be blocked
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("should use different counters for different keys", () => {
    const key1 = uniqueKey();
    const key2 = uniqueKey();
    const config = { maxRequests: 1, windowSeconds: 60 };

    rateLimit(key1, config); // exhaust key1
    const blocked = rateLimit(key1, config);
    expect(blocked.allowed).toBe(false);

    const key2Result = rateLimit(key2, config);
    expect(key2Result.allowed).toBe(true);
  });

  it("should have sensible preset values", () => {
    expect(RATE_LIMITS.login.maxRequests).toBe(5);
    expect(RATE_LIMITS.login.windowSeconds).toBe(15 * 60);

    expect(RATE_LIMITS.register.maxRequests).toBe(3);
    expect(RATE_LIMITS.register.windowSeconds).toBe(60 * 60);

    expect(RATE_LIMITS.passwordReset.maxRequests).toBe(3);
    expect(RATE_LIMITS.verificationResend.maxRequests).toBe(3);
  });
});
