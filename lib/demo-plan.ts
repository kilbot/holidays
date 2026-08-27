/**
 * Static Plan totals and week strip for the shell.
 *
 * Numbers match the "Fireworks NYE" Scenario the prototype showed, which in
 * turn adds up the capsule research in `docs/research/`. The Budget band is
 * the couple's, from docs/CONTEXT.md: €12,000–€20,000.
 *
 * Static for this iteration — #26 recomputes it from toggles, #27 from dates.
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
  dayCount: 73,
  freeLodgingNights: 41,
} as const;

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

export type WeekDot = "event" | "weather" | "warning" | "good";

export interface PlanWeek {
  id: string;
  /** e.g. "12 Dec" — the Monday (or trip start) of the week cell. */
  startLabel: string;
  /** Where the couple wakes up that week. */
  place: string;
  /** Sub-line: why the week costs what it costs. */
  detail: string;
  costEur: number;
  dots: WeekDot[];
  /** Marks the week that owns a hard Anchor. */
  anchor?: boolean;
  /** Marks a week that is mostly Buffer — deliberately unscheduled. */
  buffer?: boolean;
}

export const DEMO_WEEKS: PlanWeek[] = [
  {
    id: "w1",
    startLabel: "12 Dec",
    place: "The Changi Line",
    detail: "VLC → BCN → SIN → PER",
    costEur: 3_800,
    dots: ["weather"],
  },
  {
    id: "w2",
    startLabel: "19 Dec",
    place: "Perth · family",
    detail: "Home base — free lodging, borrowed car",
    costEur: 290,
    dots: ["good"],
  },
  {
    id: "w3",
    startLabel: "26 Dec",
    place: "Margaret River + Rotto",
    detail: "Christmas anchor, then the south-west loop",
    costEur: 1_600,
    dots: ["event"],
    anchor: true,
  },
  {
    id: "w4",
    startLabel: "31 Dec",
    place: "Sydney NYE",
    detail: "Opera House Forecourt · lodging ×2.6",
    costEur: 2_140,
    dots: ["event", "warning"],
    anchor: true,
  },
  {
    id: "w5",
    startLabel: "4 Jan",
    place: "Sydney + Blue Mts",
    detail: "The cheap side of 1 Jan",
    costEur: 900,
    dots: ["good"],
  },
  {
    id: "w6",
    startLabel: "11 Jan",
    place: "Buffer",
    detail: "Unbooked — stay longer or move early",
    costEur: 480,
    dots: [],
    buffer: true,
  },
  {
    id: "w7",
    startLabel: "18 Jan",
    place: "Port Douglas reef",
    detail: "Window opens — off-peak fares, no school holidays",
    costEur: 2_000,
    dots: ["weather"],
  },
  {
    id: "w8",
    startLabel: "27 Jan",
    place: "Byron + Nimbin",
    detail: "Post-holiday prices, Nimbin day trip",
    costEur: 1_070,
    dots: ["event"],
  },
  {
    id: "w9",
    startLabel: "4 Feb",
    place: "Tasmania · PITP",
    detail: "Party In The Paddock, then the south-north arc",
    costEur: 2_400,
    dots: ["event", "weather"],
  },
  {
    id: "w10",
    startLabel: "18 Feb",
    place: "Melbourne, then home",
    detail: "Laneway Fri · St Kilda Fest · MEL → VLC",
    costEur: 1_500,
    dots: ["event"],
  },
];

export const TRIP_WINDOW_LABEL = "12 Dec 2026 — 22 Feb 2027";
