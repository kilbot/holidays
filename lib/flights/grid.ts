/**
 * Which routes `/api/fares` is allowed to price, and on which days.
 *
 * The grid is a **route** whitelist, not a search engine: a pair that is not on
 * this list 404s. That is what keeps a metered API from being an open proxy.
 * The *dates* are no longer a whitelist (#61) — see `resolveRoute` below. Every
 * route entry still carries the three days the weekly cron warms, so those are
 * normally a cache hit by the time anyone asks for them, and they stay the
 * page's defaults; but any day in the trip window is now a legal question to
 * ask about a known route, because "there are only three dates to choose from"
 * was the page lying about what a fare calendar is.
 *
 * Three tiers live here:
 *
 * 1. **The Flights page's outbound search** — every credible European hub in
 *    `docs/research/flight-hubs.json` to Perth. One fetch per hub, thirteen
 *    hubs, so the page can rank Barcelona against Milan against Vienna on the
 *    same date instead of assuming the answer.
 * 2. **The Flights page's return search** — the four east-coast origins to the
 *    European arrival points that actually exist for them. Barcelona and Madrid
 *    for all four; Valencia only from Sydney and Melbourne, because Turkish is
 *    the only carrier that ends at Valencia's own airport and it does not serve
 *    Brisbane or Canberra.
 * 3. **The demo Plan's domestic hops**, which pre-date the Flights page and
 *    keep their own dates because `lib/demo-route.ts` names them.
 *
 * The **warmed** date sets are deliberately three days wide rather than a
 * fortnight. Every warmed date multiplies the cron's call count by the number
 * of routes, and a grid that cannot be warmed is one that answers slowly and
 * burns quota interactively. Three dates around each anchor is what the cron
 * pays for; the other eighty-seven days of the window are reachable, and the
 * page states what reaching a cold one costs before it spends anything.
 */

import { WINDOW_END, WINDOW_START } from "@/lib/trip-dates";

export interface RouteGridEntry {
  from: string;
  to: string;
  /**
   * The days the cron warms — the cheap defaults, not the legal set. Any day in
   * the fare window can be asked about; these are the ones already paid for.
   */
  dates: readonly string[];
  ttlSeconds: number;
  /** Per-route sanity bounds on a quote. A number outside them is discarded. */
  minEur: number;
  maxEur: number;
}

/* ------------------------------------------------------------------ */
/* The window                                                          */
/* ------------------------------------------------------------------ */

/**
 * The days a known route may be priced on: the trip window itself, 1 Dec 2026
 * to 28 Feb 2027 — the same ninety days `lib/trip-dates.ts` draws the rail
 * over, so the Flights page and the Plan cannot disagree about when the trip
 * is. Stated as an alias rather than re-typed, because two constants holding
 * the same dates is one constant and a future bug.
 */
export const FARE_WINDOW_START = WINDOW_START;
export const FARE_WINDOW_END = WINDOW_END;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whether a string is a real calendar day inside the window.
 *
 * The round-trip through `Date.UTC` is the part that matters: ISO day strings
 * sort chronologically, so a plain `>=`/`<=` pair would happily accept
 * "2026-13-45", which is between the two bounds as text and is not a date.
 */
export function inFareWindow(date: string | null | undefined): date is string {
  if (!date || !ISO_DAY.test(date)) return false;
  const [year, month, day] = date.split("-").map(Number);
  if (new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== date) {
    return false;
  }
  return date >= FARE_WINDOW_START && date <= FARE_WINDOW_END;
}

/** The grid entry for an airport pair, or null when the pair is not on it. */
export function routeFor(
  from: string | null | undefined,
  to: string | null | undefined,
): RouteGridEntry | null {
  return ROUTE_GRID.find((entry) => entry.from === from && entry.to === to) ?? null;
}

/** Whether the cron pays for this day on this route — a near-certain cache hit. */
export function isPreWarmed(route: RouteGridEntry, date: string): boolean {
  return route.dates.includes(date);
}

/**
 * The route a fare request is asking about, or null if there is not one.
 *
 * Two checks, and they are different in kind. The **pair** is a whitelist and
 * always will be: an open origin/destination parameter on a metered API is a
 * proxy someone else can spend. The **date** is a window, because a date is not
 * a resource — pricing BCN→PER on 3 January costs exactly what pricing it on
 * 14 December costs, and refusing it only made the page pretend the world had
 * three days in it. The route's own `minEur`/`maxEur` still judge whatever
 * comes back, so a nonsense quote on a newly-legal date is discarded exactly as
 * it would have been on a warmed one.
 */
export function resolveRoute(
  from: string | null | undefined,
  to: string | null | undefined,
  date: string | null | undefined,
): RouteGridEntry | null {
  if (!inFareWindow(date)) return null;
  return routeFor(from, to);
}

/** User directive: "ballpark suffices" — keep long-haul quotes for seven days. */
const LONGHAUL = { ttlSeconds: 604_800, minEur: 400, maxEur: 3_500 } as const;

/** User directive: "ballpark suffices" — keep domestic quotes for 72 hours. */
const DOMESTIC_TTL_SECONDS = 259_200;

/**
 * The warmed outbound dates. The middle one is the page's default — the
 * leaving date the trip has been planned around — with a day either side so a
 * hub whose long-haul is 5x weekly (Barcelona) can still show a fare. Every
 * other December, January and February day is selectable; these three are the
 * ones the cron has already paid for.
 */
export const OUTBOUND_SEARCH_DATES = ["2026-12-12", "2026-12-14", "2026-12-16"] as const;
export const OUTBOUND_DEFAULT_DATE = "2026-12-14";

/** The return dates, around the late-February departure the Scenarios assume. */
export const RETURN_SEARCH_DATES = ["2027-02-20", "2027-02-22", "2027-02-24"] as const;
export const RETURN_DEFAULT_DATE = "2027-02-22";

/**
 * The thirteen European hubs the outbound search covers, in the research's own
 * rank order. Every one of them has at least one credible one-stop to Perth;
 * the ones that do not (Gold Coast's mirror image — cities whose only long-haul
 * dead-ends) never made it into the research file.
 */
export const OUTBOUND_HUBS = [
  "BCN",
  "MAD",
  "MXP",
  "CDG",
  "LHR",
  "FRA",
  "MUC",
  "FCO",
  "AMS",
  "ZRH",
  "VIE",
  "IST",
  "BRU",
] as const;

/** East-coast origins for the return, and where each can actually land in Europe. */
export const RETURN_ORIGINS = ["SYD", "MEL", "BNE", "CBR"] as const;

/**
 * Valencia is only searchable from Sydney and Melbourne: the single-ticket
 * SYD/MEL→SIN→IST→VLC Turkish itinerary is the only thing that ends there, and
 * Turkish serves neither Brisbane nor Canberra.
 */
export const RETURN_ARRIVALS: Readonly<Record<string, readonly string[]>> = {
  SYD: ["BCN", "MAD", "VLC"],
  MEL: ["BCN", "MAD", "VLC"],
  BNE: ["BCN", "MAD"],
  CBR: ["BCN", "MAD"],
};

/**
 * Every airport on this grid that is in Europe.
 *
 * `lib/engine/legs.ts` decides whether a Leg prices off a domestic band or the
 * long-haul band by asking whether both ends are Australian, and it works that
 * out by subtracting this set from the grid. Adding a hub above without adding
 * it here would quietly price Frankfurt→Rome as an Australian domestic hop.
 */
export const EUROPEAN_AIRPORTS: readonly string[] = ["VLC", ...OUTBOUND_HUBS];

/**
 * Airports on neither continent: the hubs the crossings connect through.
 *
 * Empty of grid routes today, and named anyway, because `lib/engine/legs.ts`
 * works out what is *Australian* by subtracting Europe from this grid. That was
 * a true definition only for as long as the grid had two continents on it, and
 * the crossings now route through Hong Kong and Singapore
 * (`lib/engine/legs.ts`, `CROSSINGS`). Adding either pair here without listing
 * the hub below would quietly price Madrid → Hong Kong as a domestic hop.
 */
export const STOPOVER_AIRPORTS: readonly string[] = ["SIN", "HKG"];

/**
 * Dates the demo Plan's own Leg popups price against, which are *not* the
 * search dates: `lib/demo-route.ts` puts the Barcelona crossing on 13 December
 * and the Australian departure in mid-February. They ride on the same route
 * entries rather than duplicate ones, so the cron warms each pair once.
 */
const DEMO_PLAN_DATES: Readonly<Record<string, readonly string[]>> = {
  "BCN-PER": ["2026-12-10", "2026-12-20"],
  "MAD-PER": ["2026-12-10", "2026-12-20"],
  "MXP-PER": ["2026-12-10", "2026-12-20"],
  "SYD-BCN": ["2027-02-10", "2027-02-23"],
  "MEL-BCN": ["2027-02-10", "2027-02-23"],
  "BNE-BCN": ["2027-02-10", "2027-02-23"],
};

function longHaul(from: string, to: string, searchDates: readonly string[]): RouteGridEntry {
  return {
    from,
    to,
    dates: [...searchDates, ...(DEMO_PLAN_DATES[`${from}-${to}`] ?? [])],
    ...LONGHAUL,
  };
}

const outboundRoutes: readonly RouteGridEntry[] = [
  // Valencia itself is not a hub — nothing flies VLC→PER on one ticket without
  // a hub — but the pair stays on the grid as the reference quote an aggregator
  // gives when asked the naive question, which is what the page is arguing with.
  longHaul("VLC", "PER", OUTBOUND_SEARCH_DATES),
  ...OUTBOUND_HUBS.map((hub) => longHaul(hub, "PER", OUTBOUND_SEARCH_DATES)),
];

const returnRoutes: readonly RouteGridEntry[] = RETURN_ORIGINS.flatMap((origin) =>
  (RETURN_ARRIVALS[origin] ?? []).map((arrival) =>
    longHaul(origin, arrival, RETURN_SEARCH_DATES),
  ),
);

const domesticRoutes: readonly RouteGridEntry[] = [
  { from: "PER", to: "SYD", dates: ["2026-12-24", "2026-12-26", "2026-12-28"], ttlSeconds: DOMESTIC_TTL_SECONDS, minEur: 80, maxEur: 900 },
  { from: "SYD", to: "CNS", dates: ["2027-01-16", "2027-01-20"], ttlSeconds: DOMESTIC_TTL_SECONDS, minEur: 30, maxEur: 500 },
  { from: "OOL", to: "HBA", dates: ["2027-02-01", "2027-02-04"], ttlSeconds: DOMESTIC_TTL_SECONDS, minEur: 30, maxEur: 500 },
  { from: "HBA", to: "MEL", dates: ["2027-02-08", "2027-02-12"], ttlSeconds: DOMESTIC_TTL_SECONDS, minEur: 25, maxEur: 400 },
  { from: "PER", to: "MEL", dates: ["2026-12-24", "2026-12-26", "2026-12-28"], ttlSeconds: DOMESTIC_TTL_SECONDS, minEur: 30, maxEur: 600 },
  { from: "SYD", to: "MEL", dates: ["2027-01-16", "2027-01-18", "2027-01-20"], ttlSeconds: DOMESTIC_TTL_SECONDS, minEur: 30, maxEur: 600 },
];

export const ROUTE_GRID: readonly RouteGridEntry[] = [
  ...outboundRoutes,
  ...returnRoutes,
  ...domesticRoutes,
];
