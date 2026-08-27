"use client";

/**
 * The one hook the UI reads the Plan through.
 *
 * Three sources feed it and it is worth being explicit about which is which,
 * because they have very different lifetimes:
 *
 * 1. **The current Scenario** (`scenarios.ts`) — dates, toggles, drags, knobs.
 *    Persisted, and the thing a Fork will eventually share.
 * 2. **The Catalog shortlist** (`shortlist.ts`) — every idea marked *placed*,
 *    which is exactly docs/CONTEXT.md's "on the Plan — give it calendar days".
 *    Persisted separately, because the sift outlives any one Scenario.
 * 3. **Live fares** — fetched from `/api/fares` for the Legs the fares grid
 *    covers. Deliberately **not** persisted: a fare is true for a few hours,
 *    and a stale one saved into a Scenario would be a lie with a timestamp.
 *
 * `buildPlan` is pure, so the whole thing is a `useMemo` over those three. No
 * Plan is ever mutated, and nothing has to be kept in step by hand.
 */

import { useEffect, useMemo, useSyncExternalStore } from "react";

import { capsuleCatalogue } from "@/lib/engine/capsules";
import { buildPlan } from "@/lib/engine/plan";
import { useScenarios, type ScenarioApi } from "@/lib/engine/scenarios";
import type { LegMode, Plan, PlanInput } from "@/lib/engine/types";
import { useShortlist } from "@/lib/shortlist";
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
  scenarios: ScenarioApi;
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

export function usePlan(): PlanApi {
  const scenarios = useScenarios();
  const { marks } = useShortlist();
  const fares = useSyncExternalStore(subscribeFares, readFares, noFares);

  const input = scenarios.current.input;

  // Catalog ideas marked *placed* are Capsules the Scheduler has to find days
  // for. Ideas marked *interested* sit on the bench and cost nothing —
  // docs/CONTEXT.md is explicit that the bench occupies no calendar Days.
  const placed = useMemo(
    () =>
      Object.entries(marks)
        .filter(([, state]) => state === "placed")
        .map(([id]) => id)
        .sort(),
    [marks],
  );

  const catalogue = useMemo(() => capsuleCatalogue(placed), [placed]);

  const plan = useMemo(
    () =>
      buildPlan(
        {
          ...input,
          // The Scheduler places every researched Capsule that is toggled on,
          // plus every Catalog idea marked Plan. The two lists are merged here
          // rather than in the Scenario so that marking an idea Plan takes
          // effect in every Scenario at once, which is what the sift means.
          toggled: [...new Set([...input.toggled, ...placed])],
          fareOverrides: { ...input.fareOverrides, ...fares },
        },
        catalogue,
      ),
    [input, placed, catalogue, fares],
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

  return {
    plan,
    scenarios,
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
    toggle: (capsuleId) =>
      patch({
        toggled: input.toggled.includes(capsuleId)
          ? input.toggled.filter((id) => id !== capsuleId)
          : [...input.toggled, capsuleId],
      }),
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
