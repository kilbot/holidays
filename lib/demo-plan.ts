/**
 * Static Plan totals for the cost HUD.
 *
 * Numbers match the "Fireworks NYE" Scenario the prototype showed, which in
 * turn adds up the capsule research in `docs/research/`. The Budget band is
 * the couple's, from docs/CONTEXT.md: €12,000–€20,000.
 *
 * The week strip that used to live here moved to `lib/trip-plan.ts` in #27,
 * where it is derived from the trip's dates rather than hard-coded. €14,280 is
 * still the reference the strip's demo re-estimate is quoted against; #26
 * recomputes it from toggles.
 */

export const BUDGET_FLOOR_EUR = 12_000;
export const BUDGET_CEILING_EUR = 20_000;

export interface CostSplit {
  id: "flights" | "living" | "events";
  label: string;
  amountEur: number;
  /** Event spend is the deliberate splurge line — it gets the accent. */
  emphasis: boolean;
}

export interface PlanWarning {
  label: string;
  detail: string;
  tone: "warn" | "over";
}

export const DEMO_PLAN = {
  scenarioName: "Fireworks NYE",
  totalEur: 14_280,
  splits: [
    { id: "flights", label: "Flights", amountEur: 5_340, emphasis: false },
    { id: "living", label: "Living", amountEur: 5_660, emphasis: false },
    { id: "events", label: "Events", amountEur: 3_280, emphasis: true },
  ] satisfies CostSplit[],
  warning: {
    label: "NYE week ×2.6 lodging",
    detail: "31 Dec blows the A$500/couple daily cap. Nothing is blocked — decide.",
    tone: "warn",
  } satisfies PlanWarning,
} as const;

/**
 * What the demo Plan assumes each drawn Leg costs, per couple, in EUR.
 *
 * The €5,340 flights split above is a single number; a Leg popup on the globe
 * needs it broken out, so this is that same number decomposed. It is the demo
 * Plan's own arithmetic, not research: the eight drawn Legs sum to €3,380 and
 * the return long-haul the route does not draw (Melbourne home via Singapore,
 * `DEMO_RETURN_LEG_EUR`) carries the remaining €1,960.
 *
 * These are the figures a Leg popup labels "estimate". The four Legs that are
 * in `lib/flights/grid.ts` fetch a real fare instead and say so.
 */
export const DEMO_LEG_FARES_EUR: Readonly<Record<string, number>> = {
  "VLC>BCN": 90,
  "BCN>SIN": 1_280,
  "SIN>PER": 860,
  "PER>SYD": 330,
  "SYD>CNS": 190,
  "CNS>OOL": 220,
  "OOL>HBA": 290,
  "HBA>MEL": 120,
};

/** The homeward long-haul, which the route ends before drawing. */
export const DEMO_RETURN_LEG_EUR = 1_960;

/** Where the total sits inside the Budget band, 0–1, clamped. */
export function budgetFraction(totalEur: number): number {
  const span = BUDGET_CEILING_EUR - BUDGET_FLOOR_EUR;
  return Math.min(1, Math.max(0, (totalEur - BUDGET_FLOOR_EUR) / span));
}

export function formatEur(amount: number): string {
  return `€${amount.toLocaleString("en-GB")}`;
}

/** Compact form for the week cells: €2.1k. */
export function formatEurCompact(amount: number): string {
  if (amount >= 1000) {
    const thousands = amount / 1000;
    return `€${thousands.toFixed(thousands >= 10 ? 0 : 1)}k`;
  }
  return `€${amount}`;
}
