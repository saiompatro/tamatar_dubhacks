// Small in-memory sliding-window limiter for the public landing demo. Per server instance,
// so it caps abuse and cost on a single function; it isn't a global quota.

const hits = new Map<string, number[]>();

/** True if `key` may make another request: at most `max` in the last `windowMs`. */
export function allow(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}
