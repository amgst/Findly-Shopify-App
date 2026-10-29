// Tiny in-memory fixed-window rate limiter (per process). Use Redis if you run several instances.
const buckets = new Map<string, { count: number; reset: number }>();

export function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "local"
  );
}

export function rateLimit(request: Request, name: string, limit: number, windowMs: number) {
  const key = `${name}:${clientIp(request)}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    if (buckets.size > 50_000) buckets.clear();
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  b.count++;
  return b.count <= limit;
}
