/**
 * A `KvClient` over a `Map`.
 *
 * This is the whole reason `lib/store/kv.ts` defines an interface rather than
 * handing out a Redis client: the adopt rules, the id generator and the guards
 * are logic, and logic should be testable with `node --test` and no network.
 *
 * It round-trips through JSON deliberately. Real Redis stores bytes, so a test
 * that shared object references with the store would let a mutation the code
 * did not intend look like a successful write.
 */

import type { KvClient } from "@/lib/store/kv";

export interface FakeKv extends KvClient {
  readonly map: Map<string, string>;
  /** Every key touched by a write, for asserting on what a route did. */
  readonly writes: string[];
}

export function fakeKv(seed: Record<string, unknown> = {}): FakeKv {
  const map = new Map<string, string>();
  const writes: string[] = [];
  for (const [key, value] of Object.entries(seed)) {
    map.set(key, JSON.stringify(value));
  }
  return {
    map,
    writes,
    async getJson<T>(key: string): Promise<T | null> {
      const raw = map.get(key);
      return raw === undefined ? null : (JSON.parse(raw) as T);
    },
    async setJson(key, value) {
      writes.push(key);
      map.set(key, JSON.stringify(value));
    },
    async setJsonIfAbsent(key, value) {
      if (map.has(key)) return false;
      writes.push(key);
      map.set(key, JSON.stringify(value));
      return true;
    },
    async incrementWithTtl(key) {
      const raw = map.get(key);
      const next = (raw === undefined ? 0 : Number(JSON.parse(raw))) + 1;
      writes.push(key);
      map.set(key, JSON.stringify(next));
      return next;
    },
    async listPush(key, value) {
      const values = map.has(key) ? (JSON.parse(map.get(key)!) as unknown[]) : [];
      writes.push(key);
      map.set(key, JSON.stringify([value, ...values]));
    },
    async listTrim(key, start, end) {
      const values = map.has(key) ? (JSON.parse(map.get(key)!) as unknown[]) : [];
      writes.push(key);
      map.set(key, JSON.stringify(values.slice(start, end + 1)));
    },
    async listRange<T>(key: string, start: number, end: number) {
      const values = map.has(key) ? (JSON.parse(map.get(key)!) as T[]) : [];
      return values.slice(start, end + 1);
    },
  };
}
