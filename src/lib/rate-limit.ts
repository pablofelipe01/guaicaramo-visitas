/**
 * Sliding-window in-memory rate limiter.
 *
 * Works for single-process / single-instance deployments (Node.js server).
 * For multi-instance / serverless (Vercel Edge), replace this with
 * Upstash Redis + @upstash/ratelimit when needed.
 */

interface Bucket {
  timestamps: number[];
  /** Scheduled cleanup timer ID (avoids a growing Map on idle servers). */
  timer: ReturnType<typeof setTimeout> | null;
}

const store = new Map<string, Bucket>();

/**
 * @param key       Unique identifier for the requester (e.g. `visitor:1.2.3.4`)
 * @param limit     Maximum allowed requests within the window
 * @param windowMs  Rolling window in milliseconds
 * @returns `true` if the request is allowed, `false` if the limit is exceeded
 */
export function isAllowed(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

  let bucket = store.get(key);

  if (!bucket) {
    bucket = { timestamps: [], timer: null };
    store.set(key, bucket);
  }

  // Drop timestamps outside the current window
  bucket.timestamps = bucket.timestamps.filter(t => t > cutoff);

  if (bucket.timestamps.length >= limit) {
    return false;
  }

  bucket.timestamps.push(now);

  // Auto-evict the key from the store after the window expires
  if (bucket.timer) clearTimeout(bucket.timer);
  bucket.timer = setTimeout(() => store.delete(key), windowMs);

  return true;
}
