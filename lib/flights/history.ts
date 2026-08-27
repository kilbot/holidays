import type { KvClient } from "@/lib/store/kv";
import { inFareWindow } from "@/lib/flights/grid";

export const MAX_FARE_HISTORY = 200;
export interface FareHistoryEntry { ts: string; priceEur: number; carrier: string; source: "searchapi" }
export type FareTrend = "up" | "down" | "flat";
export const fareHistoryKey = (from: string, to: string, date: string) =>
  `fares:hist:${from}-${to}:${date}`;

/* ------------------------------------------------------------------ */
/* The coverage index                                                  */
/* ------------------------------------------------------------------ */

/**
 * One key per route naming every date that route holds an observation for.
 *
 * Without it, "which days are already paid for" costs a `lrange` per day per
 * route — ninety days across fourteen origins is 1,260 round trips to answer a
 * question the page needs before it draws a single dot. So each history write
 * also stamps a date into a small map, and `/api/fares/coverage` reads one key
 * per route.
 *
 * It is a derived index, not a source: the history lists remain the record, and
 * an index entry that went missing costs a dot on a calendar, not a fare. That
 * is the whole reason the read-modify-write below is left unlocked — the cron
 * warms sequentially, an interactive fetch that raced it would drop one date
 * from one map until the next warm, and locking a hobby site's fare cache to
 * prevent a missing dot is the wrong trade.
 */
export const fareCoverageKey = (from: string, to: string) => `fares:cov:${from}-${to}`;

/** The newest observation for one date, small enough to hold ninety of. */
export interface FareCoverageEntry { priceEur: number; ts: string }

/** Date → newest observation, for one route. */
export type FareCoverage = Record<string, FareCoverageEntry>;

export async function readFareCoverage(
  kv: KvClient, from: string, to: string,
): Promise<FareCoverage> {
  const stored = await kv.getJson<FareCoverage>(fareCoverageKey(from, to));
  if (!stored || typeof stored !== "object") return {};
  // Dates outside the window cannot be asked about, so they are not coverage —
  // dropping them on read keeps a grid edit from stranding entries nothing can
  // reach, and keeps the map's size bounded by the window rather than by time.
  const inWindow: FareCoverage = {};
  for (const [date, entry] of Object.entries(stored)) {
    if (inFareWindow(date) && entry && typeof entry.priceEur === "number") inWindow[date] = entry;
  }
  return inWindow;
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

/**
 * Record one observation: onto the route/date list, and into the route's index.
 *
 * Both writes happen here and nowhere else, so the rule the ticket set — the
 * fare API is the only thing that ever writes history, and browsing never does
 * — holds for the coverage index for free.
 */
export async function appendFareHistory(
  kv: KvClient, from: string, to: string, date: string, entry: FareHistoryEntry,
): Promise<void> {
  const key = fareHistoryKey(from, to, date);
  await kv.listPush(key, entry);
  await kv.listTrim(key, 0, MAX_FARE_HISTORY - 1);

  const coverage = await readFareCoverage(kv, from, to);
  coverage[date] = { priceEur: entry.priceEur, ts: entry.ts };
  await kv.setJson(fareCoverageKey(from, to), coverage);
}

/** Read stored observations only; this module has no fare-API dependency. */
export function readFareHistory(
  kv: KvClient, from: string, to: string, date: string,
): Promise<FareHistoryEntry[]> {
  return kv.listRange<FareHistoryEntry>(fareHistoryKey(from, to, date), 0, MAX_FARE_HISTORY - 1);
}
/* ------------------------------------------------------------------ */
/* One route-day, over time                                            */
/* ------------------------------------------------------------------ */

/**
 * How many observations of one route-day travel to the browser.
 *
 * The stored list holds up to `MAX_FARE_HISTORY`; a sparkline 96px wide cannot
 * show two hundred points, and twenty pins × two hundred points is a payload
 * out of all proportion to a chart the size of a word. Thirty is more than the
 * weekly cron will produce in half a year and still small enough that the whole
 * watchlist fits in one modest response.
 */
export const WATCH_SERIES_POINTS = 30;

/** One dot on a pin's sparkline. The carrier is on the current quote, not here. */
export interface FareSeriesPoint {
  ts: string;
  priceEur: number;
}

/**
 * Everything the watchlist needs about one pinned route-day — from the store,
 * and only from the store.
 *
 * kilbot/holidays#68 is explicit that **pins never trigger API calls**: twenty
 * watched flights refreshing themselves on every page load would be twenty
 * metered calls a visit, which is the couple's month gone in a week of
 * browsing. So a pin with nothing stored comes back with `current: null` and no
 * points, and the page says nobody has looked since — which is true, and more
 * useful than a number that cost €0.02 to invent.
 */
export interface FareSeries {
  /** `"BCN-PER"`, as the request asked for it. */
  route: string;
  from: string;
  to: string;
  date: string;
  /** Oldest first — the order a line is drawn in. */
  points: FareSeriesPoint[];
  /** The newest observation, or null when this route-day has never been priced. */
  current: { priceEur: number; carrier: string; ts: string } | null;
  /** Computed from the whole stored list, not from the truncated points. */
  trend: FareTrend | null;
}

export async function readFareSeries(
  kv: KvClient,
  from: string,
  to: string,
  date: string,
): Promise<FareSeries> {
  // Newest first, which is how the list is written and how `fareTrend` reads it.
  const history = await readFareHistory(kv, from, to, date);
  const latest = history[0] ?? null;

  return {
    route: `${from}-${to}`,
    from,
    to,
    date,
    points: history
      .slice(0, WATCH_SERIES_POINTS)
      .map((entry) => ({ ts: entry.ts, priceEur: entry.priceEur }))
      .reverse(),
    current: latest
      ? { priceEur: latest.priceEur, carrier: latest.carrier, ts: latest.ts }
      : null,
    trend: history.length > 0 ? fareTrend(history) : null,
  };
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
