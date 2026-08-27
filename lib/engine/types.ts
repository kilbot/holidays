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
 *
 * `arrival` is the fifth kind and the only **relative** one: it names the
 * trip's own first day rather than a calendar date. docs/CONTEXT.md's
 * semi-fixed Anchor — *"the first days after landing are spent with Paul's dad
 * in Mundaring Hills"* — is a claim about landing, not about 12 December, and
 * writing it as a window would quietly desynchronise the moment the couple
 * drags the leaving date. Dragging the rail moves an arrival-locked block with
 * it; every other Lock stays where the calendar put it.
 *
 * `landsAfter` is how many Days of the trip are spent getting there before the
 * block can start. Valencia to Perth is twenty-odd hours with a Changi
 * overnight, so a 14 December departure is a 15 December arrival, and the day
 * in between is a Buffer at the `transit` market — which is what the ledger
 * already calls a Day the trip has started but not landed on. Zero is legal and
 * means the block starts on the leaving date itself.
 */
export type Lock =
  | { kind: "flexible" }
  | { kind: "window"; from: string; to: string; why: string }
  | {
      kind: "weekday";
      weekdays: readonly number[];
      /**
       * Optional corridor the weekday rule applies inside.
       *
       * A weekday alone is not always the whole constraint. Rottnest wants a
       * mid-week ferry *and* the couple to be in Western Australia; without the
       * second half the Scheduler will happily propose a Perth day trip for a
       * Monday in January when they are in Queensland, which is what #54 found
       * once the calendar got busy enough to push it there. Absent means the
       * whole trip, which is what every weekday Lock meant before.
       */
      from?: string;
      to?: string;
      why: string;
    }
  | { kind: "date"; from: string; to: string; why: string }
  | { kind: "arrival"; landsAfter: number; why: string };

/** An Event spend line a Capsule brings with it. docs/CONTEXT.md, Event spend. */
export interface CapsuleEvent {
  id: string;
  label: string;
  /** AUD per couple. The deliberate splurge the daily thrift pays for. */
  aud: Rate;
  /** Which day of the Capsule it lands on, 0-based. Ignored when `date` is set. */
  dayOffset: number;
  /**
   * A **calendar date** the Event is nailed to, when it has one.
   *
   * `dayOffset` counts into the block, which is right for "the reef day is the
   * second day of the reef Adventure wherever it lands" and wrong for anything
   * the world has already dated. New Year's Eve is 31 December: with the Sydney
   * block proposed on 28 December, an offset of 2 charged the vantage point and
   * the provisions to the **30th** (#64 §7.2). Laneway is the Friday it is on.
   *
   * When this is set, the Event lands on this date and nowhere else — and if
   * the block does not cover the date, the Event **does not happen and is not
   * charged**. That is the honest reading rather than a clamp: a Melbourne
   * block moved to the first week of February is a Melbourne block without a
   * festival, and charging it two festival tickets would be a lie the total
   * would carry. A block dragged off its own date-Lock already reports a
   * `lock-violated` Warning, which is where the reader is told why.
   */
  date?: string;
  /** Where the figure comes from. */
  source: string;
}

/**
 * What the Scheduler needs to know about a Capsule to place it.
 *
 * Deliberately not `DeepCapsule` or `CatalogIdea`: the engine is pure and those
 * types drag in 415 rows of catalog JSON and 1,800 lines of research prose.
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
  /**
   * How the journey was made — `transport` lines only.
   *
   * On the line rather than looked up from the Leg because a Day can carry more
   * than one journey and every surface that draws an icon for one needs to know
   * which: Boxing Day is a 370 km drive *and* a red-eye, and a row that drew a
   * plane beside both was the second half of kilbot/holidays#101.
   */
  mode?: LegMode;
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
 * What a quoted figure is a price **for**.
 *
 * Provenance, and it decides money rather than wording. SearchAPI is asked for
 * `flight_type=one_way` (`lib/flights/searchapi.ts`), so every live quote pays
 * for exactly one crossing. The research's long-haul figure is the opposite:
 * `docs/research/longhaul-comfort.md` heads its table *"Bands, per person,
 * **return**, open-jaw into PER / out of SYD-MEL-BNE"*, so one figure covers
 * both crossings.
 *
 * Charging that return figure to the outbound Leg and nothing to the homeward
 * one was right about the band and wrong about everything else: the moment a
 * live one-way fare replaced the outbound placeholder the Plan lost the entire
 * journey home, €1–2k for two (kilbot/holidays#90). So the basis travels with
 * the figure, and `lib/engine/legs.ts` converts by it.
 */
export type FareBasis = "one-way" | "return" | "return-share";

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
   * Where the figure came from. `pinned` is a quote the couple actually holds
   * for the itinerary they are booking, `snapshot` a stored research estimate
   * for the route, `band` the research's own range for that kind of journey,
   * `computed` a drive priced from distance and fuel.
   */
  pricing: "pinned" | "snapshot" | "band" | "computed";
  /**
   * Whether `lib/flights/grid.ts` covers this route on this date, so
   * `/api/fares` has a real answer and whatever is above is a placeholder the
   * client can replace with a live quote.
   *
   * Its own field since #90. It used to be a fourth `pricing` value, which
   * conflated *where the figure came from* with *whether a live one exists* —
   * and the Leg that suffered for it was the homeward crossing, which is on
   * the grid, has no snapshot of its own, and was therefore labelled `band`
   * and never asked for the live fare it could have had.
   */
  onGrid: boolean;
  /**
   * What this Leg's own figure is a price for.
   *
   * Never `"return"`: a Leg is one crossing, so a return-basis figure is split
   * across the two of them before it lands here — `"return-share"` is the Leg
   * saying it is carrying part of a larger ticket rather than a quote of its
   * own.
   */
  fareBasis: Exclude<FareBasis, "return">;
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
  /**
   * Where else the week goes, in visiting order: "then Sydney" when the other
   * place follows the headline one, "after Sydney" when it came first. Null
   * when the week is all one place.
   */
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
  /**
   * Capsule id → how many days this Scenario gives the block.
   *
   * The Adventure's own `days.ideal` is the research's answer to "how long is
   * this worth"; this is the couple's answer to "how long can we give it". They
   * are different questions, and #54 was the first time the second one had no
   * way to be asked: the directive was *way more time in North Queensland than
   * New South Wales*, and the only honest way to say that is to give Byron its
   * researched three-night minimum instead of its five-night ideal.
   *
   * Clamped to the Adventure's `minDays` and to the trip, so a Scenario can
   * shorten a block to the shortest version the research says is still worth
   * doing and no further. Lengthening works too and is not clamped upward — a
   * couple who wants nine nights in Byron is allowed nine nights in Byron.
   *
   * Absent means the researched ideal, which is what every Scenario said before
   * this field existed.
   */
  dayOverrides: Readonly<Record<string, number>>;
  /** Leg id → mode. For when the journey IS the experience. */
  legModeOverrides: Readonly<Record<string, LegMode>>;
  /** Capsule id (or location id, for Buffer stretches) → tier. */
  lodgingTiers: Readonly<Record<string, LodgingTier>>;
  /** Capsule id → whether the block holds a paid car. Defaults to the spec. */
  carOverrides: Readonly<Record<string, boolean>>;
  /**
   * Event id → off, or a different AUD figure. The Scenario-level knob for
   * **Event triage** (#65 §4.2, ordered by the #10 cost spec, which lists
   * adding and removing an Event as a knob a Scenario holds).
   *
   * `false` takes the line off this Scenario entirely — the second reef boat,
   * the Tasman Island cruise, the festival ticket. A number replaces the
   * plan-on figure and collapses the band onto it, which is how an operator
   * swap is expressed: the Wineglass Bay cruise at A$320 becomes the Bruny
   * Island ferry at A$51 without inventing a second Capsule. `true` is the
   * default and means the same as absent, so a Scenario can say "yes, on
   * purpose" about a line it has thought about.
   *
   * It is deliberately **not** a way to add an Event that no Capsule carries:
   * an Event belongs to an Adventure, and an Adventure that is off the Plan
   * spends nothing. Toggling the Adventure is how you add one.
   */
  eventOverrides: Readonly<Record<string, boolean | number>>;
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
