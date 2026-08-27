/**
 * The key-value store, in four verbs.
 *
 * Server-only. Nothing under `components/` may import this file — the tokens
 * `Redis.fromEnv()` reads are secrets, and a client bundle that touched them
 * would ship them to every visitor. The API routes are the only callers.
 *
 * ## Why an interface and not the Redis client
 *
 * `KvClient` is deliberately narrower than Redis and speaks in this project's
 * terms: documents in, documents out. Three things fall out of that.
 *
 * 1. **Serialisation is settled in one place.** `@upstash/redis` JSON-encodes
 *    on write and attempts a JSON parse on read, which is convenient right up
 *    until a value comes back as a string because it did not look like JSON.
 *    The adapter below normalises that; no caller ever sees the ambiguity.
 * 2. **The tests get a Map.** `lib/store/__tests__/fake-kv.ts` implements these
 *    four methods over a `Map` in about thirty lines, so the adopt logic and
 *    the guards are testable with `node --test` and no network.
 * 3. **The seam is honest.** Nothing above this file knows the store is Redis,
 *    which is the same boundary `ScenarioStore` draws on the client.
 *
 * ## Lazy, not top-level
 *
 * `Redis.fromEnv()` throws when `KV_REST_API_URL` is missing, and `next build`
 * prerenders route modules in an environment that may not have it. So the
 * client is built on first use inside a plain getter function — not a Proxy,
 * which would make every property access on the module a function call and
 * turn a missing-env failure into a stack trace pointing at the wrong line.
 */

import { Redis } from "@upstash/redis";

/** What this project needs a key-value store to do. Nothing more. */
export interface KvClient {
  /** The document at `key`, or null. */
  getJson<T>(key: string): Promise<T | null>;
  /** Write the document, overwriting whatever was there. */
  setJson(key: string, value: unknown): Promise<void>;
  /**
   * Write only if the key is free. Returns whether this call did the writing —
   * how the bootstrap refuses to overwrite a Plan that already exists.
   */
  setJsonIfAbsent(key: string, value: unknown): Promise<boolean>;
  /**
   * Increment a counter and make sure it expires. Returns the value after the
   * increment. The write throttle is the only caller.
   */
  incrementWithTtl(key: string, ttlSeconds: number): Promise<number>;
  /** Put an observation at the front of a list. */
  listPush(key: string, value: unknown): Promise<void>;
  /** Keep an inclusive slice of a list. */
  listTrim(key: string, start: number, end: number): Promise<void>;
  /** Read an inclusive slice of a list. */
  listRange<T>(key: string, start: number, end: number): Promise<T[]>;
}

/**
 * Upstash's client, wearing this project's interface.
 *
 * `get` is defensive on purpose: the client parses JSON when it recognises it
 * and hands back the raw string when it does not, and a document that fails to
 * parse is a document we do not have.
 */
function upstashClient(redis: Redis): KvClient {
  return {
    async getJson<T>(key: string): Promise<T | null> {
      const value = await redis.get<T | string>(key);
      if (value === null || value === undefined) return null;
      if (typeof value !== "string") return value as T;
      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    },
    async setJson(key, value) {
      await redis.set(key, JSON.stringify(value));
    },
    async setJsonIfAbsent(key, value) {
      const result = await redis.set(key, JSON.stringify(value), { nx: true });
      return result === "OK";
    },
    async incrementWithTtl(key, ttlSeconds) {
      const count = await redis.incr(key);
      // Only the call that created the counter sets its lifetime, so a burst of
      // writes cannot keep pushing the window out in front of itself.
      if (count === 1) await redis.expire(key, ttlSeconds);
      return count;
    },
    async listPush(key, value) {
      await redis.lpush(key, value);
    },
    async listTrim(key, start, end) {
      await redis.ltrim(key, start, end);
    },
    async listRange<T>(key: string, start: number, end: number): Promise<T[]> {
      return redis.lrange<T>(key, start, end);
    },
  };
}

let client: KvClient | null = null;

/**
 * The store. Built on first call, reused after that.
 *
 * Throws if the Upstash integration's env vars are absent, which is the right
 * failure: a write that silently went nowhere would be worse than a 500.
 */
export function getKv(): KvClient {
  if (!client) client = upstashClient(Redis.fromEnv());
  return client;
}

/**
 * Swap the store. For tests, which pass a Map-backed fake — and the reason
 * `plans.ts` takes a `KvClient` as an argument rather than reaching for this.
 */
export function setKvClient(next: KvClient | null): void {
  client = next;
}
