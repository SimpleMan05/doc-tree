import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const THEMES = ["sacrifice", "hope", "unity", "dreams", "gratitude", "courage"];

export async function bumpCounters(theme) {
  const [themeCount, totalCount] = await Promise.all([
    redis.incr(`theme:${theme}`),
    redis.incr("leaves:total"),
  ]);
  return { themeCount, totalCount };
}

export async function getStats() {
  const keys = THEMES.map((t) => `theme:${t}`);
  const [counts, total] = await Promise.all([
    redis.mget(...keys),
    redis.get("leaves:total"),
  ]);
  const byTheme = {};
  THEMES.forEach((t, i) => (byTheme[t] = Number(counts[i]) || 0));
  return { byTheme, total: Number(total) || 0 };
}

// --- Leaf cache: Redis is the read-path source of truth for the tree.
// Postgres (Supabase) stays the durable write-path store, but the
// frequently-polled /api/leaves route never touches it directly.

const LEAVES_KEY = "leaves:all";

// Append a freshly-inserted leaf to the cache (called right after the
// Supabase insert succeeds). O(1), no re-read of the whole list needed.
export async function cacheLeaf(leaf) {
  await redis.rpush(LEAVES_KEY, JSON.stringify(leaf));
}

// Read all leaves from cache. Returns null if the cache is empty/missing
// so the caller knows to rehydrate — distinct from "genuinely zero leaves".
export async function getCachedLeaves() {
  const raw = await redis.lrange(LEAVES_KEY, 0, -1);
  if (!raw || raw.length === 0) return null;
  return raw.map((item) => (typeof item === "string" ? JSON.parse(item) : item));
}

// One-time rehydrate from Supabase — only runs on cold start (fresh Redis
// instance, or the cache key was evicted/flushed). Not on the hot path.
export async function rehydrateLeavesCache(fetchAllFromDb) {
  const existing = await redis.llen(LEAVES_KEY);
  if (existing > 0) return; // already warm, nothing to do

  const leaves = await fetchAllFromDb();
  if (!leaves.length) return;

  // RPUSH preserves the array order (insertion order), matching how the
  // tree expects leaves to be laid out (golden-angle spiral by index).
  const pipeline = redis.pipeline();
  leaves.forEach((leaf) => pipeline.rpush(LEAVES_KEY, JSON.stringify(leaf)));
  await pipeline.exec();
  console.log(`Rehydrated Redis leaf cache with ${leaves.length} leaves from Supabase.`);
}

export async function decrementCounters(theme) {
  await Promise.all([redis.decr(`theme:${theme}`), redis.decr("leaves:total")]);
}

export async function removeLeafFromCache(id) {
  const raw = await redis.lrange(LEAVES_KEY, 0, -1);
  const remaining = raw
    .map((item) => (typeof item === "string" ? JSON.parse(item) : item))
    .filter((leaf) => leaf.id !== id);
  await redis.del(LEAVES_KEY);
  if (remaining.length) {
    const pipeline = redis.pipeline();
    remaining.forEach((leaf) => pipeline.rpush(LEAVES_KEY, JSON.stringify(leaf)));
    await pipeline.exec();
  }
}
