/**
 * Which route/date pairs `/api/fares` is allowed to price.
 *
 * The grid is a whitelist, not a search engine: a request outside it 404s. That
 * is what keeps a metered API from being an open proxy, and it is also what the
 * nightly cron warms, so everything on this list is normally a cache hit by the
 * time anyone asks for it.
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
 * The date sets are deliberately three days wide rather than a fortnight. Every
 * date multiplies the cron's call count by the number of routes, and a search
 * grid that cannot be warmed is a search grid that answers slowly and burns
 * quota interactively. Three dates around each anchor is enough to show whether
 * the date is bending the price without turning the page into a fare calendar.
 */

export interface RouteGridEntry {
  from: string;
  to: string;
  dates: readonly string[];
  ttlSeconds: number;
  minEur: number;
  maxEur: number;
}

/** Long-haul bounds: below €400 or above €3,500 pp is a parsing error, not a fare. */
const LONGHAUL = { ttlSeconds: 86_400, minEur: 400, maxEur: 3_500 } as const;

/**
 * The outbound search dates. The middle one is the page's default — the
 * leaving date the trip has been planned around — with a day either side so a
 * hub whose long-haul is 5x weekly (Barcelona) can still show a fare.
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
  { from: "PER", to: "SYD", dates: ["2026-12-24", "2026-12-26", "2026-12-28"], ttlSeconds: 21_600, minEur: 80, maxEur: 900 },
  { from: "SYD", to: "CNS", dates: ["2027-01-16", "2027-01-20"], ttlSeconds: 21_600, minEur: 30, maxEur: 500 },
  { from: "OOL", to: "HBA", dates: ["2027-02-01", "2027-02-04"], ttlSeconds: 21_600, minEur: 30, maxEur: 500 },
  { from: "HBA", to: "MEL", dates: ["2027-02-08", "2027-02-12"], ttlSeconds: 21_600, minEur: 25, maxEur: 400 },
  { from: "PER", to: "MEL", dates: ["2026-12-24", "2026-12-26", "2026-12-28"], ttlSeconds: 21_600, minEur: 30, maxEur: 600 },
  { from: "SYD", to: "MEL", dates: ["2027-01-16", "2027-01-18", "2027-01-20"], ttlSeconds: 21_600, minEur: 30, maxEur: 600 },
];

export const ROUTE_GRID: readonly RouteGridEntry[] = [
  ...outboundRoutes,
  ...returnRoutes,
  ...domesticRoutes,
];
