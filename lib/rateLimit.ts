/**
 * Fixed-window, in-memory request limiter keyed by client IP. It is per server instance,
 * so on multi-instance/serverless hosts it is a first line of defence only; use the
 * platform's rate limiting / firewall for stronger protection of the provider quota.
 */
const WINDOW_MS = 60_000;
const MAX_KEYS = 10_000;
const windows = new Map<string, { count: number; resetAt: number }>();

export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip")?.trim() || "unknown";
}

export function checkRateLimit(key: string, limit: number, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  if (limit <= 0) return { ok: true, retryAfterSec: 0 };
  if (windows.size > MAX_KEYS) {
    for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
    if (windows.size > MAX_KEYS) windows.clear();
  }
  let w = windows.get(key);
  if (!w || w.resetAt <= now) {
    w = { count: 0, resetAt: now + WINDOW_MS };
    windows.set(key, w);
  }
  w.count += 1;
  if (w.count > limit) return { ok: false, retryAfterSec: Math.max(1, Math.ceil((w.resetAt - now) / 1000)) };
  return { ok: true, retryAfterSec: 0 };
}

export function resetRateLimits(): void {
  windows.clear();
}
