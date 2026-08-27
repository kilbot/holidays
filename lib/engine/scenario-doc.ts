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

export interface Scenario {
  id: string;
  name: string;
  /** ISO instant. Display only — nothing sorts or expires on it. */
  createdAt: string;
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
}

/* ------------------------------------------------------------------ */
/* The default Scenario                                                */
/* ------------------------------------------------------------------ */

/**
 * "Fireworks NYE" — the reference trip, with all eight researched Capsules on.
 * It is a starting position, not a recommendation: everything in it can be
 * toggled off, dragged, or forked.
 */
export const DEFAULT_SCENARIO: Scenario = {
  id: "fireworks-nye",
  name: "Fireworks NYE",
  createdAt: "2026-08-27T00:00:00.000Z",
  input: {
    ...EMPTY_INPUT,
    toggled: [
      "margaret-river",
      "rottnest-island",
      "sydney-nye",
      "gbr-port-douglas",
      "fnq-wildlife",
      "byron-nimbin",
      "tasmania-arc",
      "melbourne-party",
    ],
  },
};

export const INITIAL_STATE: ScenarioState = {
  scenarios: [DEFAULT_SCENARIO],
  currentId: DEFAULT_SCENARIO.id,
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
    ...(typeof raw.adoptedFrom === "string"
      ? { adoptedFrom: raw.adoptedFrom }
      : {}),
  };
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
  if (!isRecord(raw) || !Array.isArray(raw.scenarios)) return INITIAL_STATE;

  const scenarios = raw.scenarios
    .map(parseScenario)
    .filter((scenario): scenario is Scenario => scenario !== null);

  if (scenarios.length === 0) return INITIAL_STATE;

  const currentId =
    typeof raw.currentId === "string" &&
    scenarios.some((scenario) => scenario.id === raw.currentId)
      ? raw.currentId
      : scenarios[0].id;

  return { scenarios, currentId };
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
