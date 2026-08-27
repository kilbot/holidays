/**
 * Every rate the cost model runs on, in one place.
 *
 * The spec (#10, resolved 2026-08-27) says these are **baked constants**,
 * editable only by editing this file — not knobs, not env vars, not settings.
 * Each one is lifted from `docs/research/cost-baselines.md` and carries the
 * section it came from, so a reader can go and check it.
 *
 * Two rules the numbers obey:
 *
 * 1. **Plan-on is the cheapest realistic figure**, not the research's mid tier.
 *    The user directive on #10 rejected mid-tier defaults outright: day-to-day
 *    is Airbnb-first, hostels if needed, floor-seeking. Where the research
 *    publishes a budget band, the plan-on figure is the bottom of it and the
 *    band travels alongside as `[low, high]`.
 * 2. **Everything is AUD per couple** unless the name says EUR. Conversion
 *    happens once, at the ledger's edge, at whichever FX rate the Plan is
 *    running (§6: €0.61 normally, €0.65 under stress).
 */

/* ------------------------------------------------------------------ */
/* Currency                                                            */
/* ------------------------------------------------------------------ */

/** A$1 in EUR. cost-baselines §6, spot 25 Aug 2026. */
export const AUD_TO_EUR = 0.61;

/**
 * The stress rate. cost-baselines §6: the 2026 trajectory has been
 * AUD-strengthening, the trip is months out, and a worst case budgeted at the
 * spot rate understates the EUR total by ~6%.
 */
export const AUD_TO_EUR_STRESS = 0.65;

/** A$500 per couple per paid day — living lines only. docs/CONTEXT.md. */
export const DAILY_CAP_AUD = 500;

/** The couple's Budget band. docs/CONTEXT.md: €6,000–10,000 per Traveller. */
export const BUDGET_FLOOR_EUR = 12_000;
export const BUDGET_CEILING_EUR = 20_000;

/**
 * The "stuff happens" row. #10 decision 4: a visible ~10%-of-plan line in the
 * drilled-in ledger — one line, zeroable, never hidden padding.
 */
export const CONTINGENCY_RATE = 0.1;

/** How many people the per-couple figures cover. */
export const TRAVELLERS = 2;

/* ------------------------------------------------------------------ */
/* Markets                                                             */
/* ------------------------------------------------------------------ */

/**
 * A market is a cost regime, not a city: everywhere that prices the same way.
 * `home-base` is the WA family house and the sister's farm — free lodging, a
 * borrowed car, and food and fuel that are emphatically not free.
 */
export type MarketId =
  | "home-base-city"
  | "home-base-regional"
  | "sydney"
  | "melbourne"
  | "hobart"
  | "cairns"
  | "regional"
  | "transit";

/** Three lodging tiers. `airbnb` is the default the whole model assumes. */
export type LodgingTier = "hostel" | "airbnb" | "hotel";

/** A plan-on figure with the honest spread the research publishes around it. */
export interface Rate {
  /** Cheapest realistic. What every surface shows. */
  plan: number;
  /** [low, high] — what the drill-in shows, and what the worst case uses. */
  band: [number, number];
}

const rate = (plan: number, low: number, high: number): Rate => ({
  plan,
  band: [low, high],
});

export interface Market {
  id: MarketId;
  label: string;
  /** AUD per night, per couple, before peak multipliers. */
  lodging: Record<LodgingTier, Rate>;
  /** AUD per couple per day: groceries-first, one cheap meal out. §2.1, §3.3. */
  food: Rate;
  /** AUD per couple per day: transit fares, or fuel in a borrowed car. §2.2. */
  local: Rate;
  /** AUD per couple per day, blended. Marquee spend is an Event line. §3.4. */
  activities: Rate;
  /** AUD per day held, bare base rate. Excess is a caveat, not a cost. §3.2. */
  car: Rate;
}

/**
 * The rate card.
 *
 * Lodging plan-on figures are the **bottom of the research's budget band**
 * (§3.1), not its mid tier. Hostel is a private twin room, not a dorm — the
 * couple is not splitting up to save A$40. The hotel tier is the deliberate
 * A$150–200-and-up exception the directive allows, priced at the research's mid
 * figure because that is what a warranted night actually costs.
 *
 * Car rates are the **corrected budget-operator floor** added to §3.2 after the
 * user challenge: A$45/day mainland, A$85/day Tasmania in January, bare base
 * rate, no excess reduction. The band's top is the earlier all-in figure, which
 * is what it costs if the credit-card excess cover turns out not to stand up.
 */
export const MARKETS: Readonly<Record<MarketId, Market>> = {
  "home-base-city": {
    id: "home-base-city",
    label: "Perth · home base",
    lodging: {
      hostel: rate(0, 0, 0),
      airbnb: rate(0, 0, 0),
      hotel: rate(0, 0, 0),
    },
    food: rate(45, 45, 85),
    local: rate(10, 10, 30),
    activities: rate(20, 20, 60),
    car: rate(0, 0, 0),
  },
  "home-base-regional": {
    id: "home-base-regional",
    label: "Regional WA · home base",
    lodging: {
      hostel: rate(0, 0, 0),
      airbnb: rate(0, 0, 0),
      hotel: rate(0, 0, 0),
    },
    food: rate(45, 45, 85),
    local: rate(30, 30, 50),
    activities: rate(20, 20, 60),
    car: rate(0, 0, 0),
  },
  sydney: {
    id: "sydney",
    label: "Sydney",
    lodging: {
      hostel: rate(120, 100, 160),
      airbnb: rate(180, 180, 230),
      hotel: rate(350, 300, 400),
    },
    food: rate(110, 110, 220),
    local: rate(20, 19, 40),
    activities: rate(40, 40, 120),
    car: rate(45, 45, 110),
  },
  melbourne: {
    id: "melbourne",
    label: "Melbourne",
    lodging: {
      hostel: rate(100, 90, 140),
      airbnb: rate(150, 150, 200),
      hotel: rate(280, 230, 320),
    },
    food: rate(110, 110, 220),
    local: rate(20, 19, 40),
    activities: rate(40, 40, 120),
    car: rate(45, 45, 110),
  },
  hobart: {
    id: "hobart",
    label: "Tasmania",
    lodging: {
      hostel: rate(100, 90, 140),
      airbnb: rate(150, 150, 200),
      hotel: rate(250, 220, 300),
    },
    food: rate(110, 110, 220),
    local: rate(20, 19, 40),
    activities: rate(40, 40, 120),
    // §3.2, corrected floor: independents A$38–43 off-peak, ~×2 for January.
    car: rate(85, 85, 165),
  },
  cairns: {
    id: "cairns",
    label: "Far North Queensland",
    lodging: {
      hostel: rate(90, 80, 120),
      airbnb: rate(120, 120, 170),
      hotel: rate(200, 180, 240),
    },
    food: rate(110, 110, 220),
    local: rate(20, 19, 40),
    activities: rate(40, 40, 120),
    car: rate(45, 45, 120),
  },
  regional: {
    id: "regional",
    label: "Regional",
    lodging: {
      hostel: rate(100, 90, 140),
      airbnb: rate(150, 130, 200),
      hotel: rate(250, 220, 300),
    },
    food: rate(110, 110, 220),
    local: rate(20, 19, 40),
    activities: rate(40, 40, 120),
    car: rate(45, 45, 110),
  },
  transit: {
    id: "transit",
    label: "In transit",
    lodging: {
      hostel: rate(0, 0, 0),
      airbnb: rate(0, 0, 0),
      hotel: rate(0, 0, 0),
    },
    // Airport and onboard food for a couple crossing the world. §3.3 basket.
    food: rate(60, 40, 120),
    local: rate(20, 10, 60),
    activities: rate(0, 0, 0),
    car: rate(0, 0, 0),
  },
};

/* ------------------------------------------------------------------ */
/* Peak multipliers                                                    */
/* ------------------------------------------------------------------ */

/**
 * A dated multiplier on a Day's living lines.
 *
 * Per #10's structural directive these apply to **the specific nights they
 * cover**, never to a whole stay: a Sydney block that straddles 31 December
 * pays the NYE multiplier on the nights inside the window and ×1.0 on the rest.
 * Move the block off the window and the multiplier does not follow it.
 */
export interface PeakRule {
  id: string;
  label: string;
  /** Inclusive ISO date bounds. */
  from: string;
  to: string;
  /** Only bites in these markets. Absent means everywhere. */
  markets?: readonly MarketId[];
  lodging: Rate;
  food: Rate;
  car: Rate;
  /** One line, for the drill-in. */
  note: string;
}

/**
 * Ordered — **first match wins**, so the narrow rules come before the wide
 * ones. Every figure is cost-baselines §1's peak table.
 *
 * The NYE rule runs 29 Dec – 1 Jan rather than sitting on 31 December alone.
 * That is the ticket's own framing and it matches §5's finding: harbourside
 * properties want three nights minimum, prepaid, so the ×2.5–3.0 is a block
 * booking rather than a night. Charging it to one night would make 31 December
 * look like an outlier the couple could dodge by moving hotels.
 */
export const PEAK_RULES: readonly PeakRule[] = [
  {
    id: "cairns-january",
    label: "Cairns wet season",
    from: "2027-01-01",
    to: "2027-01-31",
    markets: ["cairns"],
    lodging: rate(0.8, 0.8, 0.9),
    food: rate(1, 1, 1),
    car: rate(1, 1, 1),
    note: "January is Cairns' low season and runs counter to the rest of the country.",
  },
  {
    id: "nye",
    label: "Sydney NYE",
    from: "2026-12-29",
    to: "2027-01-01",
    markets: ["sydney"],
    lodging: rate(2.5, 2.5, 3),
    food: rate(1.2, 1.2, 1.2),
    car: rate(1.3, 1.3, 1.8),
    note: "Sydney's market ADR hit A$1,009 at 95.4% occupancy on 31 Dec 2025 — ×3.0 on its annual average. Three-night prepaid minimums make it a block, not a night.",
  },
  {
    id: "christmas",
    label: "Christmas",
    from: "2026-12-24",
    to: "2026-12-26",
    lodging: rate(1.5, 1.5, 2),
    food: rate(1.1, 1.1, 1.1),
    car: rate(1.3, 1.3, 1.8),
    note: "Christmas Day and Boxing Day hotel rates run at 150–200% of normal.",
  },
  {
    id: "between",
    label: "Between the holidays",
    from: "2026-12-27",
    to: "2026-12-30",
    lodging: rate(1.4, 1.4, 1.8),
    food: rate(1, 1, 1),
    car: rate(1.3, 1.3, 1.8),
    note: "The dead week still prices as peak everywhere on the east coast.",
  },
  {
    id: "school-holidays",
    label: "Summer school holidays",
    from: "2027-01-02",
    to: "2027-01-26",
    lodging: rate(1.2, 1.2, 1.4),
    food: rate(1, 1, 1),
    car: rate(1.3, 1.3, 1.6),
    note: "The Australian summer school-holiday window is over 40 days; the demand cliff is the school return, ~28 January.",
  },
  {
    id: "shoulder",
    label: "After the school return",
    from: "2027-01-27",
    to: "2027-02-28",
    lodging: rate(1, 1, 1.1),
    food: rate(1, 1, 1),
    car: rate(1, 1, 1.2),
    note: "The cheapest paid-city window of the trip.",
  },
  {
    id: "early-december",
    label: "Early December",
    from: "2026-12-01",
    to: "2026-12-23",
    lodging: rate(1, 1, 1.1),
    food: rate(1, 1, 1),
    car: rate(1, 1, 1.2),
    note: "Before the holiday demand starts.",
  },
];

/** ×1.0 on everything — what a Day outside every rule pays. */
export const NO_PEAK: PeakRule = {
  id: "none",
  label: "Ordinary day",
  from: "0000-01-01",
  to: "9999-12-31",
  lodging: rate(1, 1, 1),
  food: rate(1, 1, 1),
  car: rate(1, 1, 1),
  note: "No peak multiplier applies.",
};

/**
 * Public-holiday surcharge on hospitality bills. cost-baselines §1: 10–15% on
 * the whole bill, standard practice where disclosed, on these four dates.
 */
export const PUBLIC_HOLIDAYS: readonly string[] = [
  "2026-12-25",
  "2026-12-26",
  "2027-01-01",
  "2027-01-26",
];

export const PUBLIC_HOLIDAY_SURCHARGE: Rate = rate(1.1, 1.1, 1.15);

/** Which peak rule a Day in a market pays. First match wins; else ×1.0. */
export function peakFor(date: string, market: MarketId): PeakRule {
  for (const rule of PEAK_RULES) {
    if (date < rule.from || date > rule.to) continue;
    if (rule.markets && !rule.markets.includes(market)) continue;
    return rule;
  }
  return NO_PEAK;
}

/* ------------------------------------------------------------------ */
/* Ground transport                                                    */
/* ------------------------------------------------------------------ */

/**
 * AUD per kilometre in a car, fuel only. cost-baselines §2.2: A$2.00/L in
 * Perth and A$2.15/L regional at 8 L/100 km.
 */
export const FUEL_AUD_PER_KM: Rate = rate(0.16, 0.16, 0.17);

/**
 * Great-circle kilometres understate a road: highways bend, and the coast road
 * to Margaret River is not a straight line. A flat factor is cruder than a
 * routing API and honest about being an estimate.
 */
export const ROAD_DISTANCE_FACTOR = 1.25;

/** How far a couple will drive in a day before it stops being a holiday. */
export const DRIVE_KM_PER_DAY = 700;
