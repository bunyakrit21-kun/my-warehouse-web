/**
 * Simple in-memory sliding-window rate limiter for anti-spam use (e.g. signup).
 * Not distributed — each server instance tracks its own counts, so this is a
 * best-effort deterrent, not a hard guarantee, if traffic spans many instances.
 */
const hits = new Map<string, number[]>();

export function isRateLimited(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter(t => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > maxAttempts;
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
