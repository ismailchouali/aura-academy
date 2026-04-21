// Simple in-memory rate limiter for API protection
const attempts = new Map<string, { count: number; resetAt: number }>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of attempts) {
    if (val.resetAt < now) attempts.delete(key);
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number; // time window in milliseconds
}

export function rateLimit(
  key: string,
  config: RateLimitConfig = { maxAttempts: 5, windowMs: 15 * 60 * 1000 } // 5 attempts per 15 min
): { success: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || record.resetAt < now) {
    // New window
    attempts.set(key, { count: 1, resetAt: now + config.windowMs });
    return { success: true, remaining: config.maxAttempts - 1, resetIn: config.windowMs };
  }

  if (record.count >= config.maxAttempts) {
    const resetIn = record.resetAt - now;
    return { success: false, remaining: 0, resetIn };
  }

  record.count++;
  return { success: true, remaining: config.maxAttempts - record.count, resetIn: record.resetAt - now };
}
