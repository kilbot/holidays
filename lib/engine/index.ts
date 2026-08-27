/**
 * The itinerary engine (#25).
 *
 * `docs/CONTEXT.md` is the model; this is the implementation of it. The whole
 * public surface is here, and the shape of it is the argument:
 *
 * ```ts
 * const plan = buildPlan(input, capsuleCatalogue(placedCatalogIds));
 * ```
 *
 * One pure function. A Plan is a function of its input, so a Scenario is a
 * saved input, a Fork is a shared input, undo is a previous input, and a
 * side-by-side comparison is two calls. Nothing accumulates state.
 *
 * The modules, and where to look for what:
 *
 * | module | owns |
 * |---|---|
 * | `constants.ts` | every rate, from `docs/research/cost-baselines.md` |
 * | `types.ts` | the domain's vocabulary |
 * | `locations.ts` | where the Plan can be, and how far apart |
 * | `scheduler.ts` | Capsules onto Days: Locks, Buffers, overrides |
 * | `ledger.ts` | Days priced individually — the cost model's structure |
 * | `legs.ts` | Legs derived from the Day sequence, and priced |
 * | `rollup.ts` | totals, bands, worst case, contingency, splits |
 * | `warnings.ts` | what is wrong, as data |
 * | `plan.ts` | the pipeline |
 * | `capsules.ts` | research content → `CapsuleSpec` |
 * | `scenarios.ts` | saved inputs, and the seam #30 replaces |
 * | `use-plan.ts` | the React store the UI reads |
 */

export {
  AUD_TO_EUR,
  AUD_TO_EUR_STRESS,
  BUDGET_CEILING_EUR,
  BUDGET_FLOOR_EUR,
  CONTINGENCY_RATE,
  DAILY_CAP_AUD,
  MARKETS,
  PEAK_RULES,
  TRAVELLERS,
  peakFor,
  type LodgingTier,
  type MarketId,
} from "@/lib/engine/constants";

export { LOCATIONS, locationById } from "@/lib/engine/locations";

export { buildPlan, EMPTY_INPUT } from "@/lib/engine/plan";
export { buildLedger, dayHeadline, TIER_LABEL } from "@/lib/engine/ledger";
export { schedule, lockAllows } from "@/lib/engine/scheduler";
export { deriveLegs, legIsOnGrid } from "@/lib/engine/legs";
export {
  rollUp,
  formatEur,
  formatEurBand,
  formatEurCompact,
} from "@/lib/engine/rollup";
export { collectWarnings, JAM_PACKED_RUN } from "@/lib/engine/warnings";
export {
  capsuleCatalogue,
  DEEP_SPECS,
  publishedTotalEur,
} from "@/lib/engine/capsules";

export type {
  CapsuleEvent,
  CapsuleSpec,
  CostSplit,
  Day,
  DayLine,
  Leg,
  LegMode,
  LineKind,
  Location,
  Lock,
  Placement,
  Plan,
  PlanInput,
  PlanWeek,
  RollUp,
  Warning,
  WarningKind,
} from "@/lib/engine/types";

/** The Daily cap in EUR at the model rate. A ceiling, never a target. */
export const DAILY_CAP_EUR = Math.round(500 * 0.61);
