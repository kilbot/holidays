"use client";

/**
 * The one hook the UI reads the Plan through.
 *
 * Three sources feed it and it is worth being explicit about which is which,
 * because they have very different lifetimes:
 *
 * 1. **The current Scenario** (`scenarios.ts`) — dates, what is on the Plan,
 *    drags, knobs. Persisted, synced, and the thing a Fork shares. Since #58
 *    this is the *only* say in what the Scheduler places.
 * 2. **The Catalog shortlist** (`shortlist.ts`) — the bench and the discard
 *    pile, per browser. It no longer decides membership; it writes membership
 *    through to the Scenario and reads back a reconciled verdict.
 * 3. **Live fares** — fetched from `/api/fares` for the Legs the fares grid
 *    covers. Deliberately **not** persisted: a fare is true for a few hours,
 *    and a stale one saved into a Scenario would be a lie with a timestamp.
 *
 * `buildPlan` is pure, so the whole thing is a `useMemo` over those three. No
 * Plan is ever mutated, and nothing has to be kept in step by hand.
 */

import { useEffect, useMemo, useSyncExternalStore } from "react";

import { capsuleCatalogue } from "@/lib/engine/capsules";
import {
  effectiveVerdicts,
  planMembership,
} from "@/lib/engine/membership";
import { buildPlan } from "@/lib/engine/plan";
import {
  scenarioTotals,
  useScenarios,
  type ScenarioApi,
  type ScenarioTotal,
} from "@/lib/engine/scenarios";
import type { CapsuleSpec, LegMode, Plan, PlanInput } from "@/lib/engine/types";
import {
  countMarks,
  useShortlist,
  type MarkedState,
  type ShortlistCounts,
  type ShortlistMap,
} from "@/lib/shortlist";
import { TRAVELLERS } from "@/lib/engine/constants";
import { moveRangeEnd, type RangeEnd } from "@/lib/trip-dates";

/* ------------------------------------------------------------------ */
/* Live fares                                                          */
/* ------------------------------------------------------------------ */

/**
 * Leg id → EUR per couple, for as long as the tab is open.
 *
 * Module-level rather than component state so the cost HUD and the strip see
 * the same fare, and so a re-mount does not re-fetch. `inFlight` stops the two
 * mounted consumers racing each other for the same route.
 */
const liveFares = new Map<string, number>();
const inFlight = new Set<string>();
const fareListeners = new Set<() => void>();

let fareSnapshot: Readonly<Record<string, number>> = {};

function publishFares() {
  fareSnapshot = Object.fromEntries(liveFares);
  for (const listener of fareListeners) listener();
}

function subscribeFares(listener: () => void): () => void {
  fareListeners.add(listener);
  return () => fareListeners.delete(listener);
}

const readFares = () => fareSnapshot;

// One frozen object, not a fresh one per call: `useSyncExternalStore` compares
// snapshots by reference and a new `{}` each render is an infinite loop.
const NO_FARES: Readonly<Record<string, number>> = Object.freeze({});
const noFares = () => NO_FARES;

/**
 * Fetch what `/api/fares` can answer for, and leave the rest alone.
 *
 * Rejects nothing. An unreachable API, a 503 from an exhausted quota or a
 * malformed body all leave the snapshot figure in place, labelled as a
 * snapshot — which is the honest fallback and the one `lib/leg-fare.ts`
 * already takes for the globe's Leg popups.
 */
async function hydrateFare(id: string, from: string, to: string, date: string) {
  if (liveFares.has(id) || inFlight.has(id)) return;
  inFlight.add(id);
  try {
    const response = await fetch(
      `/api/fares?from=${from}&to=${to}&date=${date}`,
    );
    if (!response.ok) return;
    const body: unknown = await response.json();
    if (!body || typeof body !== "object") return;
    const perPerson = (body as { priceEur?: unknown }).priceEur;
    if (typeof perPerson !== "number" || !Number.isFinite(perPerson)) return;
    liveFares.set(id, Math.round(perPerson * TRAVELLERS));
    publishFares();
  } catch {
    // The snapshot stands. A popup that says "—" is worse than one that says
    // "fare snapshot".
  } finally {
    inFlight.delete(id);
  }
}

/* ------------------------------------------------------------------ */
/* The hook                                                            */
/* ------------------------------------------------------------------ */

export interface PlanApi {
  plan: Plan;
  /**
   * The Capsule specs this Plan was built from, by id.
   *
   * A `Day` carries the Capsule's name but not its Lock, and a Lock is a claim
   * about *why* a block sits where it does — which the Ledger's place bands say
   * out loud. Handing the specs out here beats every reader rebuilding the
   * catalogue from the shortlist and hoping it matches the one the Plan used.
   */
  capsules: ReadonlyMap<string, CapsuleSpec>;
  scenarios: ScenarioApi;
  /** Every Scenario's headline numbers, computed the same way as this one's. */
  totals: ScenarioTotal[];
  /** The current Scenario's input, for a knob that wants to read one value. */
  input: PlanInput;
  /** Change one field of the input. Everything downstream re-derives. */
  patch: (changes: Partial<PlanInput>) => void;
  /** Move one end of the trip, through the same clamp the rail uses. */
  moveRange: (end: RangeEnd, date: string) => void;
  /** Toggle a Capsule on or off the Plan. */
  toggle: (capsuleId: string) => void;
  /** A drag. Beats the Scheduler, always. */
  place: (capsuleId: string, startDate: string) => void;
  /** Clear a drag and let the Scheduler propose again. */
  unplace: (capsuleId: string) => void;
  setLegMode: (legId: string, mode: LegMode) => void;
}

/** The shortlist as every sift surface should read it. */
export interface PlanShortlist {
  /**
   * Verdicts reconciled against the Plan — `effectiveVerdicts` says how.
   *
   * Read this, never the raw `useShortlist().marks`, anywhere a verdict is
   * *shown* or *filtered on*. The raw marks know nothing about the researched
   * Adventures the reference Scenario starts with, and they keep a stale
   * *placed* long after a discarded preview put the Plan back.
   */
  marks: ShortlistMap;
  counts: ShortlistCounts;
  /** Record a verdict. Membership follows it into the Scenario. */
  mark: (id: string, state: MarkedState) => void;
}

/**
 * The sift's view of the shortlist, without building a Plan.
 *
 * `/adventures` renders 415 cards and re-sifts them on every keystroke; running
 * the Scheduler and the ledger to find out which pins to draw would be absurd.
 * Membership is one array off the current Scenario.
 */
export function usePlanShortlist(): PlanShortlist {
  const scenarios = useScenarios();
  const { marks, toggle: mark } = useShortlist();
  const toggled = scenarios.current.input.toggled;

  const effective = useMemo(
    () => effectiveVerdicts(toggled, marks),
    [toggled, marks],
  );

  return {
    marks: effective,
    counts: countMarks(effective),
    mark,
  };
}

export function usePlan(): PlanApi {
  const scenarios = useScenarios();
  const { toggle: mark } = useShortlist();
  const fares = useSyncExternalStore(subscribeFares, readFares, noFares);

  const input = scenarios.current.input;

  // What the Scheduler has to find days for. Just the Scenario's own list since
  // #58: the shortlist used to be unioned in here, which could add a Capsule to
  // the Plan and never take one off.
  const onPlan = useMemo(() => planMembership(input.toggled), [input.toggled]);

  // Specs for every id any Scenario might reach for, not just this one's: the
  // comparison rows below price the alternates, and a Scenario whose Capsules
  // were missing from the catalogue would silently price as a cheaper trip.
  const catalogueIds = useMemo(() => {
    const ids = new Set<string>();
    for (const scenario of scenarios.scenarios) {
      for (const id of scenario.input.toggled) ids.add(id);
    }
    return [...ids].sort();
  }, [scenarios.scenarios]);

  const catalogue = useMemo(
    () => capsuleCatalogue(catalogueIds),
    [catalogueIds],
  );

  const capsules = useMemo(
    () => new Map(catalogue.map((spec) => [spec.id, spec])),
    [catalogue],
  );

  const plan = useMemo(
    () =>
      buildPlan(
        { ...input, toggled: onPlan, fareOverrides: { ...input.fareOverrides, ...fares } },
        catalogue,
      ),
    [input, onPlan, catalogue, fares],
  );

  // Fetch the Legs the grid covers. Runs after render, once per Leg per tab.
  useEffect(() => {
    for (const leg of plan.legs) {
      if (leg.pricing !== "grid" || leg.hydrated) continue;
      void hydrateFare(leg.id, leg.from, leg.to, leg.date);
    }
  }, [plan.legs]);

  const patch = (changes: Partial<PlanInput>) =>
    scenarios.update({ ...input, ...changes });

  // Cheap enough to do eagerly: a Scenario is a saved input and building one
  // is the same pure pass this hook already runs for the current Plan.
  const totals = useMemo(
    () =>
      scenarioTotals(
        { scenarios: scenarios.scenarios, currentId: scenarios.currentId },
        catalogue,
        fares,
      ),
    [scenarios.scenarios, scenarios.currentId, catalogue, fares],
  );

  return {
    plan,
    capsules,
    scenarios,
    totals,
    input,
    patch,
    moveRange: (end, date) => {
      const moved = moveRangeEnd(
        { start: input.startDate, end: input.endDate },
        end,
        date,
      );
      patch({ startDate: moved.start, endDate: moved.end });
    },
    // One gesture, one writer. `setMark` records the verdict *and* writes the
    // Scenario's `toggled` list, so a caller here and a click on a shortlist
    // row cannot disagree about what is on the Plan.
    toggle: (capsuleId) =>
      mark(capsuleId, onPlan.includes(capsuleId) ? "interested" : "placed"),
    place: (capsuleId, startDate) =>
      patch({
        placementOverrides: { ...input.placementOverrides, [capsuleId]: startDate },
      }),
    unplace: (capsuleId) => {
      const next = { ...input.placementOverrides };
      delete next[capsuleId];
      patch({ placementOverrides: next });
    },
    setLegMode: (legId, mode) =>
      patch({ legModeOverrides: { ...input.legModeOverrides, [legId]: mode } }),
  };
}
