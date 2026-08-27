/**
 * The engine's vocabulary, in the domain's own words.
 *
 * Every name here is defined in `docs/CONTEXT.md` — Day, Slot, Lock, Buffer
 * day, Anchor, Capsule, Leg, Plan, Scenario, Scheduler, Warning. Where this
 * file adds a type the glossary does not name (DayLine, Placement, RollUp) it
 * is machinery, and the comment says what glossary term it serves.
 *
 * Two invariants hold across everything below, and the tests enforce them:
 *
 * - **The Plan's cost is the sum of its Days.** No total is computed any other
 *   way. Splits, bands and worst cases are re-aggregations of the same lines.
 * - **Nothing refuses.** A Lock that cannot be honoured, a Budget that is blown
 *   and a week with no Buffer in it all produce Warnings and a Plan. The site
 *   informs; the Travellers decide.
 */

import type { LodgingTier, MarketId, Rate } from "@/lib/engine/constants";

/* ------------------------------------------------------------------ */
/* Places                                                              */
/* ------------------------------------------------------------------ */

/**
 * Where a Day is. A Location is finer-grained than a market — Port Douglas and
 * Cairns are one cost regime and two places, and the Legs care about the
 * difference because a relocation is a change of place.
 */
export interface Location {
  id: string;
  name: string;
  market: MarketId;
  /** IATA of the airport a Leg to here flies into. */
  airport: string;
  /**
   * Where the place actually is, [longitude, latitude] — not its gateway.
   * Margaret River is three hours from the Perth airport it is reached
   * through, so a drive priced off the airport would cost nothing.
   */
  coords: [number, number] | null;
  /** Free lodging and a borrowed car. docs/CONTEXT.md, Home base. */
  homeBase: boolean;
  /**
   * Where the couple sleeps after a day here. Set on day-trip Locations
   * (Rottnest) so a Buffer day following one falls back to the base rather
   * than parking eleven unscheduled days on an island with no beds.
   */
  returnsTo?: string;
  /** Which normals the weather layers read. Null in transit. */
  weather: string | null;
  /** Region prefixes the events layer filters on. */
  regions: string[];
}

/* ------------------------------------------------------------------ */
/* Locks and Capsules                                                  */
/* ------------------------------------------------------------------ */

/**
 * A Capsule's scheduling constraint. docs/CONTEXT.md, Lock.
 *
 * `date` and `window` look alike and are not: a date-lock names days the
 * Capsule must cover (NYE is on 31 December or it is not NYE), a window-lock
 * names a range it must sit inside (the reef wants 18–31 January, anywhere in
 * there). The Scheduler treats the first as immovable and the second as a
 * corridor to find the cheapest week in.
 */
export type Lock =
  | { kind: "flexible" }
  | { kind: "window"; from: string; to: string; why: string }
  | { kind: "weekday"; weekdays: readonly number[]; why: string }
  | { kind: "date"; from: string; to: string; why: string };

/** An Event spend line a Capsule brings with it. docs/CONTEXT.md, Event spend. */
export interface CapsuleEvent {
  id: string;
  label: string;
  /** AUD per couple. The deliberate splurge the daily thrift pays for. */
  aud: Rate;
  /** Which day of the Capsule it lands on, 0-based. */
  dayOffset: number;
  /** Where the figure comes from. */
  source: string;
}

/**
 * What the Scheduler needs to know about a Capsule to place it.
 *
 * Deliberately not `DeepCapsule` or `CatalogIdea`: the engine is pure and those
 * types drag in 413 rows of catalog JSON and 1,800 lines of research prose.
 * `lib/engine/capsules.ts` adapts them into this.
 */
export interface CapsuleSpec {
  id: string;
  name: string;
  locationId: string;
  /** Days on the calendar the Capsule wants. */
  days: number;
  /** The shortest version that is still worth doing. */
  minDays: number;
  lock: Lock;
  /** Paid car for the whole block. False at a Home base — the car is borrowed. */
  needsCar: boolean;
  events: readonly CapsuleEvent[];
  /**
   * The research's own all-in plan-on figure, EUR per couple. **Not an input**
   * to the ledger — the ledger prices the Days from `constants.ts`. This rides
   * along so the drill-in can show the cross-check, which is the honest way to
   * surface that the published figure used mid-tier lodging (#10).
   */
  publishedEur: number | null;
  /** `deep` is a researched Capsule; `catalog` is a sifted idea marked Plan. */
  tier: "deep" | "catalog";
}

/* ------------------------------------------------------------------ */
/* Placements                                                         */
/* ------------------------------------------------------------------ */

/** Where a Capsule ended up, and who decided. */
export interface Placement {
  capsuleId: string;
  startDate: string;
  endDate: string;
  days: number;
  /** A drag beats a proposal, always. docs/CONTEXT.md, Scheduler. */
  origin: "proposed" | "override";
  /** True when the placement sits outside its own Lock. Warned, never blocked. */
  lockViolated: boolean;
  /** Capsule ids this block overlaps. Empty in the normal case. */
  overlaps: string[];
}

/* ------------------------------------------------------------------ */
/* The Day ledger                                                      */
/* ------------------------------------------------------------------ */

export type LineKind =
  | "lodging"
  | "food"
  | "local"
  | "activities"
  | "car"
  | "event"
  | "transport";

/**
 * One priced thing on one Day. The atom of the whole cost model — every total
 * on the site is a sum of these and nothing else.
 */
export interface DayLine {
  id: string;
  kind: LineKind;
  label: string;
  /** AUD per couple, at the plan-on figure. Null for EUR-native lines (fares). */
  aud: number | null;
  /** EUR per couple, plan-on, at the Plan's FX rate. */
  eur: number;
  /** [low, high] EUR — the honest spread, for the drill-in and the worst case. */
  bandEur: [number, number];
  /**
   * Counts against the Daily cap. Lodging, food and local transport only —
   * docs/CONTEXT.md is explicit that Event spend and Legs sit outside it.
   */
  living: boolean;
  /** One line of provenance, shown on drill-in. */
  note: string;
}

/** One calendar day of the Plan, priced individually. docs/CONTEXT.md, Day. */
export interface Day {
  date: string;
  /** 0-based day of the trip. */
  index: number;
  locationId: string;
  locationName: string;
  market: MarketId;
  homeBase: boolean;
  /** Deliberately unscheduled, and still priced. docs/CONTEXT.md, Buffer day. */
  buffer: boolean;
  /** The Capsule that owns this Day, if any. */
  capsuleId: string | null;
  capsuleName: string | null;
  /** Which day of that Capsule, 1-based, for "day 3 of 5". */
  capsuleDay: number | null;
  lodgingTier: LodgingTier;
  lines: DayLine[];
  /** Sum of every line. The Day's price. */
  totalEur: number;
  /** Lodging + food + local transport. What the Daily cap is measured against. */
  livingEur: number;
  bandEur: [number, number];
  /** The peak rule that bit, for the drill-in. Null on an ordinary day. */
  peakId: string | null;
  peakLabel: string | null;
  peakNote: string | null;
}

/* ------------------------------------------------------------------ */
/* Legs                                                                */
/* ------------------------------------------------------------------ */

export type LegMode = "flight" | "drive" | "train" | "ferry";

/**
 * A movement between places. **Derived, never placed** — the Scheduler puts
 * Capsules on Days and the Legs fall out of the sequence. docs/CONTEXT.md, Leg.
 */
export interface Leg {
  /** "PER>SYD@2026-12-29" — route and date, so a re-derive is idempotent. */
  id: string;
  date: string;
  fromLocationId: string;
  toLocationId: string;
  from: string;
  to: string;
  mode: LegMode;
  /** True when the mode came from a per-Leg override rather than the default. */
  modeOverridden: boolean;
  /** EUR per couple, plan-on. */
  eur: number;
  bandEur: [number, number];
  /**
   * `grid` means `lib/flights/grid.ts` covers this route and date, so
   * `/api/fares` has a real answer and the figure here is the stored snapshot
   * standing in until the client hydrates it. `snapshot` is a stored research
   * estimate with no live path. `band` is the research's own range for the
   * kind of journey. `computed` is a drive, priced from distance and fuel.
   */
  pricing: "grid" | "snapshot" | "band" | "computed";
  /** Set once a live fetch has replaced the placeholder. */
  hydrated: boolean;
  carrier: string | null;
  note: string;
}

/* ------------------------------------------------------------------ */
/* Warnings                                                            */
/* ------------------------------------------------------------------ */

export type WarningKind =
  | "lock-violated"
  | "anchor-missed"
  | "zero-buffer"
  | "jam-packed"
  | "daily-cap"
  | "budget-ceiling"
  | "overlap"
  | "unplaced";

/**
 * The site's only enforcement mechanism, and it does not enforce anything.
 * docs/CONTEXT.md, Warning: a badge on the offending Days and lines. Data.
 */
export interface Warning {
  id: string;
  kind: WarningKind;
  /** `over` is the red treatment, `warn` the amber. */
  tone: "warn" | "over";
  /** Six words at most — this lands on a badge. */
  label: string;
  /** One sentence. What is wrong and what it costs. */
  detail: string;
  /** The Days it sits on. Empty where it is about the Plan as a whole. */
  dates: string[];
  capsuleId: string | null;
}

/* ------------------------------------------------------------------ */
/* Roll-up                                                             */
/* ------------------------------------------------------------------ */

/** The three lines the cost HUD splits by. docs/CONTEXT.md, Event spend. */
export interface CostSplit {
  id: "flights" | "living" | "events";
  label: string;
  amountEur: number;
  /** Event spend is the deliberate splurge — it gets the accent. */
  emphasis: boolean;
}

/**
 * What the Plan costs, at every level of disclosure the spec asks for.
 *
 * #10 decision 1: the plan-on figure is what every surface shows; the band, the
 * worst case, the contingency and the sources are drill-in. This type carries
 * all of them so the UI can decide how much to say, rather than the engine
 * deciding for it.
 */
export interface RollUp {
  /** The headline. Exactly the sum of every Day's total. */
  planOnEur: number;
  /** [low, high] — every line's band, summed. */
  bandEur: [number, number];
  /** Band high, re-converted at the €0.65 stress rate. The honest ceiling. */
  worstCaseEur: number;
  /** ~10% of plan-on, or zero when switched off. Never hidden padding. */
  contingencyEur: number;
  contingencyOn: boolean;
  /** plan-on + contingency. What the Budget bar is drawn against. */
  totalEur: number;
  splits: CostSplit[];
  /** Free-lodging nights — the lever the whole cost model is about. */
  homeBaseNights: number;
  /** Buffer days, and what they cost. First-class, so they are counted. */
  bufferDays: number;
  bufferEur: number;
  /** The rate this roll-up ran at. 0.61, or 0.65 with the stress toggle on. */
  fxRate: number;
  /** Where `totalEur` sits in the €12k–20k band, 0–1, clamped. */
  budgetFraction: number;
  overBudget: boolean;
}

/* ------------------------------------------------------------------ */
/* Weeks                                                               */
/* ------------------------------------------------------------------ */

/** Seven-day cells counted from the leaving date, not from Mondays. */
export interface PlanWeek {
  id: string;
  startDate: string;
  endDate: string;
  /** "12–18 Dec". */
  label: string;
  days: Day[];
  /** The place holding most of the week. */
  leadLocationId: string;
  leadLocationName: string;
  /** "then Sydney" where the week straddles places. */
  handover: string | null;
  costEur: number;
  /** Buffer days in the cell. Zero over a whole week is a Warning. */
  bufferDays: number;
  /** Warnings whose dates fall inside the cell. */
  warnings: Warning[];
}

/* ------------------------------------------------------------------ */
/* Input and output                                                    */
/* ------------------------------------------------------------------ */

/**
 * Everything a Plan is a function of. Two Plans built from equal inputs are
 * equal — the Scheduler is deterministic and nothing here is read from a clock.
 */
export interface PlanInput {
  startDate: string;
  endDate: string;
  /** Capsule ids toggled on. Order is irrelevant; the Scheduler sorts. */
  toggled: readonly string[];
  /** Capsule id → start date. A drag. Beats the Scheduler's proposal. */
  placementOverrides: Readonly<Record<string, string>>;
  /** Leg id → mode. For when the journey IS the experience. */
  legModeOverrides: Readonly<Record<string, LegMode>>;
  /** Capsule id (or location id, for Buffer stretches) → tier. */
  lodgingTiers: Readonly<Record<string, LodgingTier>>;
  /** Capsule id → whether the block holds a paid car. Defaults to the spec. */
  carOverrides: Readonly<Record<string, boolean>>;
  /** #10 decision 3: one global FX stress toggle, 0.61 / 0.65. */
  fxStress: boolean;
  /** #10 decision 4: the contingency row, zeroable. */
  contingency: boolean;
  /** Live fares, once the client has fetched them. Leg id → EUR per couple. */
  fareOverrides: Readonly<Record<string, number>>;
}

/** A Plan. docs/CONTEXT.md: Capsules, dates, Legs, and the resulting cost. */
export interface Plan {
  startDate: string;
  endDate: string;
  dayCount: number;
  days: Day[];
  weeks: PlanWeek[];
  placements: Placement[];
  legs: Leg[];
  warnings: Warning[];
  rollUp: RollUp;
  /** Capsules toggled on that the range has no room for at all. */
  unplaced: string[];
}
