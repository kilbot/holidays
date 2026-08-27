/**
 * A Scenario as a **document** — the shape, and how to rebuild one from bytes
 * of unknown provenance.
 *
 * This module was lifted out of `scenarios.ts` when #30 put Scenarios on a
 * server. `scenarios.ts` is `"use client"` and holds React hooks, and a route
 * handler cannot import it; the parsing, though, is exactly what the server
 * needs most — a `PUT` body is *more* untrustworthy than a localStorage string,
 * not less. So the pure half lives here, with no React, no `window`, and no
 * `"use client"`, and both sides import it.
 *
 * The rule the parsers follow, on both sides of the wire: **never reject, always
 * repair**. A Scenario written by an older build is missing whichever knobs have
 * been added since, and the right answer to a missing knob is its default —
 * never a discarded Scenario, never a 400, and never a crash.
 */

import { isLodgingTier } from "@/lib/engine/constants";
import { EMPTY_INPUT } from "@/lib/engine/plan";
import type { PlanInput } from "@/lib/engine/types";
import { parsePins, type FlightPin } from "@/lib/flights/watchlist";

export interface Scenario {
  id: string;
  name: string;
  /** ISO instant. Display only — nothing sorts or expires on it. */
  createdAt: string;
  /**
   * ISO instant of the last change to this Scenario's name or input.
   *
   * Absent on a Scenario nobody has touched since it was made, which is why it
   * is optional rather than seeded equal to `createdAt`: "made on the 27th" and
   * "made on the 27th and edited on the 27th" are different sentences, and only
   * one of them is true of a seed. `lastEditedAt()` folds the two for display.
   *
   * The Plan document has its own `updatedAt` and it answers a different
   * question — when the *server* last accepted a write, for the whole Plan. It
   * cannot say which of three Scenarios has been worked on, which is exactly
   * what `/scenarios` was asked for.
   */
  updatedAt?: string;
  input: PlanInput;
  /**
   * The Fork this Scenario was adopted from, if it was.
   *
   * docs/CONTEXT.md, Fork: *"the Travellers can **adopt** one (copy it into
   * their own Scenario list)"*. Recording which Fork makes adopting idempotent
   * — clicking Adopt twice on the same Fork produces one Scenario, not two —
   * and lets the UI say where a Scenario came from, which matters when the
   * couple is looking at a list that mixes their own forks with a friend's.
   */
  adoptedFrom?: string;
}

export interface ScenarioState {
  scenarios: Scenario[];
  /** Exactly one Scenario is the current Plan. */
  currentId: string;
  /**
   * Flights the couple is watching (kilbot/holidays#68).
   *
   * **Plan-level, not per Scenario**, and that is the whole decision. A pin is a
   * dated observation of what an airline was charging — a fact about the world,
   * not about a calendar variant — so it must not appear and disappear as the
   * couple flips between "Fireworks NYE" and "Aggressive". The alternative was
   * a `pins` field on `PlanInput`, and it would have meant a Fork carrying
   * somebody else's watchlist and an adopt merging two of them.
   *
   * It sits in this document rather than in a browser because the trip has two
   * travellers and two phones: a fare pinned on one has to be there on the
   * other, which is the same reason the Scenarios are here.
   *
   * Required rather than optional on purpose. Every writer that builds a
   * `ScenarioState` by hand — fork, duplicate, remove, the hydrate — is a place
   * the watchlist could silently be dropped, and a compiler error at each of
   * them is cheaper than the bug report.
   */
  pins: FlightPin[];
}

/* ------------------------------------------------------------------ */
/* The seeded Scenarios                                                */
/* ------------------------------------------------------------------ */

/**
 * The nine researched Adventures, which every seeded Scenario keeps.
 *
 * `mundaring-arrival` leads because the calendar does: docs/CONTEXT.md makes
 * the first days after landing a semi-fixed Anchor, and it is arrival-locked in
 * `capsules.ts` so the Scheduler puts it on the trip's own first day in every
 * Scenario, whatever the leaving date is. It is on all three seeds rather than
 * just the default for the same reason Christmas is: a savings Scenario that
 * saved money by skipping Paul's dad is not a savings Scenario, and the block
 * is the cheapest three days on the calendar anyway.
 */
const ADVENTURES = [
  "mundaring-arrival",
  "margaret-river",
  "rottnest-island",
  "sydney-nye",
  "gbr-port-douglas",
  "fnq-wildlife",
  "byron-nimbin",
  "tasmania-arc",
  "melbourne-party",
] as const;

/**
 * The two WA evenings the #54 research put on the bench.
 *
 * Catalog ideas rather than researched Adventures, and they belong to the
 * default Scenario alone: they are **Event spend**, and the two savings paths
 * exist to show what Event spend gets cut. Putting them on all three would make
 * the side-by-side say less, not more.
 *
 * - `perth-live-music-night` is weekday-locked to Friday or Saturday in
 *   `capsules.ts`, off `docs/research/perth-live-music.md`. Its cost is a
 *   transport story — A$165 driving with one person sober, A$330 by rideshare
 *   from Mundaring — and the plan-on figure is the floor, as everywhere else.
 * - `fremantle-fish-and-chips` contributes **no Event line at all**: A$30–70 on
 *   the harbour is under the living floor the ledger already charges, so it is
 *   a place to be rather than a thing to buy. It is here because a Plan whose
 *   cheapest idea is a A$243 ferry is not describing this trip honestly.
 */
const WA_EVENINGS = ["perth-live-music-night", "fremantle-fish-and-chips"];

/**
 * "The All-Stops Tour" — the reference trip: **the everything version, the
 * ceiling the other Scenarios cut from.** All nine researched Adventures on,
 * both WA evenings booked, nothing traded away anywhere.
 *
 * The couple renamed it on the live Plan (*"belt-and-suspenders… all the hits —
 * Perth, Cairns, Tasmania… this is the most expensive it would get"*), and this
 * is that name brought back into the seed so a future re-seed keeps it.
 *
 * **The id stays `fireworks-nye` and must.** `scripts/seed-scenarios.mjs` adds
 * seeded Scenarios to the live document by id and leaves everything matching
 * alone, so the id is what stops a re-seed appending a duplicate of a Scenario
 * that is already there under a name the couple chose. A rename is a change of
 * label, not of identity — the same rule `rename()` follows for the couple's
 * own Scenarios.
 *
 * It is a starting position and not a recommendation: everything in it can be
 * toggled off, dragged, or forked.
 */
export const DEFAULT_SCENARIO: Scenario = {
  id: "fireworks-nye",
  name: "The All-Stops Tour",
  createdAt: "2026-08-27T00:00:00.000Z",
  input: {
    ...EMPTY_INPUT,
    toggled: [...ADVENTURES, ...WA_EVENINGS],
  },
};

/**
 * The Perth city day the re-homed January gap is built around.
 *
 * Kings Park, Cottesloe and Boola Bardip is a Catalog idea rather than a
 * researched Adventure, and it is doing something specific here: **a Buffer day
 * inherits the place of the block before it**, so parking a Perth-located block
 * in the post-NYE gap is what turns eight idle Sydney days at €188 into eight
 * Home-base days at €48. Its own Event line is zero — the Catalog quotes A$0–200
 * all-in and the ledger already charges more than that in living costs, so it
 * contributes a place to be rather than a thing to buy.
 *
 * This is savings-menu lever 5, and it is the one lever the audit assumed a
 * Scenario could express and could not: `PlanInput` has no "send the Buffers
 * home" field. Toggling a Home-base block into the gap says the same thing in
 * the vocabulary the model already has, and says it more honestly — the couple
 * is not teleporting, they are flying back to Perth and the two extra Legs are
 * priced.
 */
const PERTH_CITY_DAYS = "perth-city-kings-park-cottesloe-and-boola-bardip";

/**
 * "Comfortable — A$10k off". `docs/research/savings-menu-draft.md` §5.
 *
 * Keeps all 73 days, all nine Adventures at their ideal length, **both
 * Melbourne festivals**, both reef weather-buffer days and the whole WA family
 * stretch. Pays for it with calendar shape, three boat lines and a tent:
 *
 * | lever | expressed as |
 * |---|---|
 * | 4 · NYE reshape, 28 Dec–2 Jan → 30 Dec–4 Jan | a placement override |
 * | 5 · re-home the post-NYE gap to Perth | a Perth block in the gap |
 * | 6 · drop reef day II | `eventOverrides` |
 * | 7 · drop the Tasman Island cruise | `eventOverrides` |
 * | 8 · Wineglass Bay cruise → the Bruny Island ferry | `eventOverrides`, A$51 |
 * | 9 · camp on Margaret River and Tasmania | `lodgingTiers`, by Capsule id |
 * | 12 · camp the sixteen-night Byron Buffer | `lodgingTiers`, by Location id |
 *
 * Levers 1–3 — the rate floors and the mechanical Event corrections — are not
 * here because they are not choices. They are in `constants.ts` and
 * `capsules.ts` and they apply to *every* Scenario, the All-Stops Tour
 * included.
 *
 * **Given up:** two Pennicott cruises, the second reef boat and its intro
 * dives, and about 28 nights under canvas. **Depends on** camping gear reaching
 * Tasmania and the Northern Rivers — `cost-floors-recalibrated.md` §3.3.
 */
export const COMFORTABLE_SCENARIO: Scenario = {
  id: "comfortable-10k",
  name: "Comfortable — A$10k off",
  createdAt: "2026-08-27T00:00:00.000Z",
  input: {
    ...EMPTY_INPUT,
    toggled: [...ADVENTURES, PERTH_CITY_DAYS],
    placementOverrides: {
      // Two nights before NYE bought back as two after 1 January, when the
      // Sydney rate collapses from ×2.5 to ×1.2. The research's own rule.
      "sydney-nye": "2026-12-30",
      // The day after Sydney ends is a Buffer, and the flight west is the day
      // after that — a relocation with no Buffer in front of it is a Warning,
      // and a cheaper Plan carrying an extra Warning is not cheaper.
      [PERTH_CITY_DAYS]: "2027-01-06",
    },
    eventOverrides: {
      // The fifth reef night buys *another chance* at a reef day, not a second
      // guaranteed one. One boat, one rainforest day, two weather buffers.
      "gbr-poseidon": false,
      // capsule-tasmania.md calls this "the first A$360 to cut if the Budget
      // bites". The Budget bites.
      "tas-tasman": false,
      // Wineglass Bay is a free 3–11 km walk, and the document calls the cruise
      // the alternative to the walk rather than an addition. A$51 buys the
      // Bruny Island ferry instead, which is a different day rather than a
      // cheaper version of the same one.
      "tas-wineglass": 51,
    },
    lodgingTiers: {
      "margaret-river": "camp",
      "tasmania-arc": "camp",
      // By Location, not Capsule: this is the sixteen-night February Buffer,
      // not the five-night Byron block.
      byron: "camp",
    },
  },
};

/**
 * "Aggressive — A$15k off". `docs/research/savings-menu-draft.md` §6.
 *
 * The floor of the floor, and **not a recommendation**. 59 days instead of 73,
 * no Melbourne festivals, no second reef day, no cruises, camping on every
 * eligible block and Buffer, a hostel twin across the Sydney fortnight.
 *
 * Every hard Anchor survives — Christmas in Perth, New Year's Eve on the
 * harbour, all nine Adventures still on the Plan at their researched ideal
 * length. What goes is February: ending on the 8th costs fourteen days, the
 * Laneway ticket and the free St Kilda weekend.
 *
 * The Melbourne block carries a `lock-violated` Warning on purpose. Its Lock
 * covers 19–21 February and this trip is home by then; the block falls back to
 * 4–7 February, which is a Melbourne long weekend without the festivals. The
 * Warning is the Plan saying so out loud, which is exactly what a Warning is
 * for — and the Laneway line drops on its own, because a date-locked Event on a
 * block that does not cover its date is not a thing you can buy.
 */
export const AGGRESSIVE_SCENARIO: Scenario = {
  id: "aggressive-15k",
  name: "Aggressive — A$15k off",
  createdAt: "2026-08-27T00:00:00.000Z",
  input: {
    ...EMPTY_INPUT,
    endDate: "2027-02-08",
    toggled: [...ADVENTURES],
    placementOverrides: {
      "sydney-nye": "2026-12-30",
      "melbourne-party": "2027-02-04",
    },
    eventOverrides: {
      "gbr-poseidon": false,
      "tas-tasman": false,
      "tas-wineglass": 51,
      // Stated rather than left to the calendar. The block no longer covers
      // 19 February so the line would drop anyway; saying it here records the
      // decision instead of leaving it as an accident of the dates.
      "mel-laneway": false,
    },
    lodgingTiers: {
      // Blocks and Buffers are separate decisions and this Scenario makes both
      // the same way: a tent everywhere the research offers one.
      "margaret-river": "camp",
      "tasmania-arc": "camp",
      tasmania: "camp",
      "gbr-port-douglas": "camp",
      "fnq-wildlife": "camp",
      "port-douglas": "camp",
      "byron-nimbin": "camp",
      byron: "camp",
      // No tent on the harbour — recalibrated §3.4. Sydney's cheap rung is a
      // private twin with shared facilities, across the trip's dearest
      // fortnight.
      "sydney-nye": "hostel",
      sydney: "hostel",
    },
  },
};

/**
 * What a browser with no saved Plan starts with, and what the canonical Plan
 * document is seeded with: the reference trip, and the two savings paths #65
 * priced, so the couple can flip between them and feel the difference rather
 * than read about it.
 *
 * "The All-Stops Tour" is the current one — the everything version, and the
 * ceiling the other two cut from. They are alternatives sitting beside it, which is what docs/CONTEXT.md means by a Scenario — *"exactly one
 * is marked as the current Plan"*.
 */
export const INITIAL_STATE: ScenarioState = {
  scenarios: [DEFAULT_SCENARIO, COMFORTABLE_SCENARIO, AGGRESSIVE_SCENARIO],
  currentId: DEFAULT_SCENARIO.id,
  // Nothing is watched until somebody watches something. Seeding a pin would be
  // the site pretending to have found a fare it never fetched.
  pins: [],
};

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * Rebuild a `PlanInput` from whatever came out of storage — or off the wire.
 *
 * Field by field, with `EMPTY_INPUT` as the floor. Nothing is copied across
 * that this function did not name and type-check, which is what makes it safe
 * to hand a `PUT` body straight to it: an attacker controls the bytes, but the
 * only thing they can put in a `PlanInput` is a `PlanInput`.
 */
export function parseInput(raw: unknown): PlanInput {
  if (!isRecord(raw)) return EMPTY_INPUT;

  const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];

  const record = <T,>(value: unknown, ok: (item: unknown) => item is T) => {
    if (!isRecord(value)) return {};
    const clean: Record<string, T> = {};
    for (const [key, item] of Object.entries(value)) {
      if (ok(item)) clean[key] = item;
    }
    return clean;
  };

  const isString = (item: unknown): item is string => typeof item === "string";
  const isNumber = (item: unknown): item is number =>
    typeof item === "number" && Number.isFinite(item);
  const isBoolean = (item: unknown): item is boolean =>
    typeof item === "boolean";
  // An Event knob is a switch or a replacement figure, and nothing else — a
  // negative swap would be a Scenario that earns money, so it is repaired to
  // absent rather than trusted.
  const isEventKnob = (item: unknown): item is boolean | number =>
    isBoolean(item) || (isNumber(item) && item >= 0);

  return {
    startDate:
      typeof raw.startDate === "string" ? raw.startDate : EMPTY_INPUT.startDate,
    endDate:
      typeof raw.endDate === "string" ? raw.endDate : EMPTY_INPUT.endDate,
    toggled: strings(raw.toggled),
    placementOverrides: record(raw.placementOverrides, isString),
    legModeOverrides: record(
      raw.legModeOverrides,
      isString,
    ) as PlanInput["legModeOverrides"],
    lodgingTiers: record(raw.lodgingTiers, isLodgingTier),
    carOverrides: record(raw.carOverrides, isBoolean),
    eventOverrides: record(raw.eventOverrides, isEventKnob),
    fxStress: raw.fxStress === true,
    contingency: raw.contingency !== false,
    fareOverrides: record(raw.fareOverrides, isNumber),
  };
}

/** One Scenario, repaired. */
export function parseScenario(raw: unknown): Scenario | null {
  if (!isRecord(raw) || typeof raw.id !== "string") return null;
  return {
    id: raw.id,
    name: typeof raw.name === "string" ? raw.name : "Untitled",
    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : DEFAULT_SCENARIO.createdAt,
    input: parseInput(raw.input),
    ...(typeof raw.updatedAt === "string" ? { updatedAt: raw.updatedAt } : {}),
    ...(typeof raw.adoptedFrom === "string"
      ? { adoptedFrom: raw.adoptedFrom }
      : {}),
  };
}

/**
 * When this Scenario was last worked on — edited if it ever has been, made if
 * not. The one date `/scenarios` shows, so both cases read the same way.
 */
export function lastEditedAt(scenario: Scenario): string {
  return scenario.updatedAt ?? scenario.createdAt;
}

/**
 * A whole `ScenarioState`, repaired, falling back to the reference trip.
 *
 * The `currentId` check is the invariant from docs/CONTEXT.md — *"exactly one
 * is marked as the current Plan"* — enforced on read rather than trusted: a
 * `currentId` naming a Scenario that is not in the list would leave the site
 * with no Plan at all.
 */
export function parseScenarioState(raw: unknown): ScenarioState {
  if (!isRecord(raw)) return INITIAL_STATE;

  // Parsed before the Scenarios and carried through both fallbacks below: the
  // watchlist and the calendar fail independently, and a document whose
  // Scenarios were unreadable should still hand back the flights the couple
  // pinned rather than take them down with it.
  const pins = parsePins(raw.pins);

  if (!Array.isArray(raw.scenarios)) return { ...INITIAL_STATE, pins };

  const scenarios = raw.scenarios
    .map(parseScenario)
    .filter((scenario): scenario is Scenario => scenario !== null);

  if (scenarios.length === 0) return { ...INITIAL_STATE, pins };

  const currentId =
    typeof raw.currentId === "string" &&
    scenarios.some((scenario) => scenario.id === raw.currentId)
      ? raw.currentId
      : scenarios[0].id;

  return { scenarios, currentId, pins };
}

/* ------------------------------------------------------------------ */
/* The Plan as a stored document                                       */
/* ------------------------------------------------------------------ */

/**
 * A `ScenarioState` with the one field storage adds: when it last changed.
 *
 * It lives here rather than in `lib/store/` because both ends of the wire need
 * it and only one of them may import a Redis client — keeping the shape and its
 * parser in the pure module is what stops a client bundle reaching for
 * `@upstash/redis` to find out what a Plan looks like.
 */
export interface PlanDoc extends ScenarioState {
  /** ISO instant of the last accepted write. The client syncs against it. */
  updatedAt: string;
}

/**
 * Repair whatever came back into a `PlanDoc`.
 *
 * Same rule as everything above: never reject, always repair. A Plan document
 * written by an older build is missing whichever knobs have been added since,
 * and the couple losing their itinerary to a schema change is a far worse
 * outcome than a defaulted toggle.
 */
export function toPlanDoc(raw: unknown): PlanDoc {
  const state = parseScenarioState(raw);
  const updatedAt =
    isRecord(raw) && typeof raw.updatedAt === "string"
      ? raw.updatedAt
      : new Date(0).toISOString();
  return { ...state, updatedAt };
}

/** A slug that is not already taken, so two "Doof NYE" forks can coexist. */
export function nextScenarioId(
  name: string,
  existing: readonly Scenario[],
): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "scenario";
  let id = base;
  let suffix = 2;
  while (existing.some((scenario) => scenario.id === id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}
