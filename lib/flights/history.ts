import type { KvClient } from "@/lib/store/kv";
export const MAX_FARE_HISTORY = 200;
export interface FareHistoryEntry { ts: string; priceEur: number; carrier: string; source: "searchapi" }
export type FareTrend = "up" | "down" | "flat";
export const fareHistoryKey = (from: string, to: string, date: string) =>
  `fares:hist:${from}-${to}:${date}`;
export async function appendFareHistory(
  kv: KvClient, from: string, to: string, date: string, entry: FareHistoryEntry,
): Promise<void> {
  const key = fareHistoryKey(from, to, date);
  await kv.listPush(key, entry);
  await kv.listTrim(key, 0, MAX_FARE_HISTORY - 1);
}
/** Read stored observations only; this module has no fare-API dependency. */
export function readFareHistory(
  kv: KvClient, from: string, to: string, date: string,
): Promise<FareHistoryEntry[]> {
  return kv.listRange<FareHistoryEntry>(fareHistoryKey(from, to, date), 0, MAX_FARE_HISTORY - 1);
}
/** Compare the newest observation with the median of all earlier observations. */
export function fareTrend(history: readonly FareHistoryEntry[]): FareTrend {
  if (history.length < 2) return "flat";
  const priors = history.slice(1).map((entry) => entry.priceEur).sort((a, b) => a - b);
  const middle = Math.floor(priors.length / 2);
  const median = priors.length % 2 === 1
    ? priors[middle]
    : (priors[middle - 1] + priors[middle]) / 2;
  return history[0].priceEur > median ? "up" : history[0].priceEur < median ? "down" : "flat";
}
