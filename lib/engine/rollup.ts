/**
 * The cost roll-up, per the #10 spec.
 *
 * The one rule: **every figure here is a re-aggregation of the Day lines**.
 * `planOnEur` is not "computed"; it is the sum of `day.totalEur`, and the test
 * suite asserts that identity because it is the invariant the whole model rests
 * on. Splits are the same lines grouped by kind. The band is the same lines'
 * bands. Nothing is estimated a second way.
 *
 * ## Progressive disclosure (#10 decision 1)
 *
 * The type carries four levels and lets the UI choose how far to go:
 *
 * - `planOnEur` — the cheapest-realistic figure. What every surface shows.
 * - `bandEur` — the honest spread. Drill-in.
 * - `worstCaseEur` — band high, re-converted at the €0.65 stress rate. Drill-in.
 * - `contingencyEur` — the visible ~10% "stuff happens" row (#10 decision 4).
 *   One line, zeroable, never folded into anything.
 *
 * ## FX (#10 decision 3)
 *
 * One global toggle, €0.61 or €0.65. The Days are already priced at whichever
 * rate is running, so the roll-up does not re-convert them — it only needs its
 * own rate for the worst case, which is always quoted at the stress rate
 * regardless of the toggle, because that is what "worst case" means.
 */

import {
  AUD_TO_EUR,
  AUD_TO_EUR_STRESS,
  BUDGET_CEILING_EUR,
  BUDGET_FLOOR_EUR,
  CONTINGENCY_RATE,
} from "@/lib/engine/constants";
import { cents } from "@/lib/engine/ledger";
import type { CostSplit, Day, LineKind, RollUp } from "@/lib/engine/types";

/**
 * Which of the HUD's three splits a line kind belongs to.
 *
 * `activities` sits with living rather than with events on purpose: the
 * day-to-day activity line is A$40 of walks and the occasional entry, and
 * cost-baselines §3.4 is explicit that folding a marquee day into it distorts
 * everything. Marquee spend arrives as `event` lines, which is where the
 * "thrift on living funds the events" story is told.
 */
const SPLIT_OF: Record<LineKind, CostSplit["id"]> = {
  lodging: "living",
  food: "living",
  local: "living",
  activities: "living",
  car: "living",
  event: "events",
  transport: "flights",
};

export interface RollUpInput {
  days: readonly Day[];
  fxStress: boolean;
  contingency: boolean;
}

export function rollUp(input: RollUpInput): RollUp {
  const { days } = input;
  const fxRate = input.fxStress ? AUD_TO_EUR_STRESS : AUD_TO_EUR;

  let planOn = 0;
  let low = 0;
  let high = 0;
  let homeBaseNights = 0;
  let bufferDays = 0;
  let bufferEur = 0;
  const bySplit: Record<CostSplit["id"], number> = {
    flights: 0,
    living: 0,
    events: 0,
  };

  for (const day of days) {
    planOn += day.totalEur;
    low += day.bandEur[0];
    high += day.bandEur[1];
    if (day.homeBase) homeBaseNights += 1;
    if (day.buffer) {
      bufferDays += 1;
      bufferEur += day.totalEur;
    }
    for (const item of day.lines) {
      bySplit[SPLIT_OF[item.kind]] += item.eur;
    }
  }

  planOn = cents(planOn);
  const contingencyEur = input.contingency
    ? cents(planOn * CONTINGENCY_RATE)
    : 0;
  const totalEur = cents(planOn + contingencyEur);

  // The worst case re-converts the band's top at the stress rate. Fares are
  // quoted in EUR and do not move with AUD, so only the AUD share is stressed —
  // taking the ratio of the two rates over the whole band would overstate it.
  const audShare = cents(
    days.reduce(
      (total, day) =>
        total +
        day.lines.reduce(
          (dayTotal, item) => dayTotal + (item.aud === null ? 0 : item.bandEur[1]),
          0,
        ),
      0,
    ),
  );
  const eurShare = cents(high - audShare);
  const stressed = cents(
    (audShare / fxRate) * AUD_TO_EUR_STRESS + eurShare,
  );
  const worstCaseEur = cents(
    stressed + (input.contingency ? stressed * CONTINGENCY_RATE : 0),
  );

  const span = BUDGET_CEILING_EUR - BUDGET_FLOOR_EUR;
  const budgetFraction = Math.min(
    1,
    Math.max(0, (totalEur - BUDGET_FLOOR_EUR) / span),
  );

  return {
    planOnEur: planOn,
    bandEur: [cents(low), cents(high)],
    worstCaseEur,
    contingencyEur,
    contingencyOn: input.contingency,
    totalEur,
    splits: [
      {
        id: "flights",
        label: "Flights",
        amountEur: cents(bySplit.flights),
        emphasis: false,
      },
      {
        id: "living",
        label: "Living",
        amountEur: cents(bySplit.living),
        emphasis: false,
      },
      {
        id: "events",
        label: "Events",
        amountEur: cents(bySplit.events),
        emphasis: true,
      },
    ],
    homeBaseNights,
    bufferDays,
    bufferEur: cents(bufferEur),
    fxRate,
    budgetFraction,
    overBudget: totalEur > BUDGET_CEILING_EUR,
  };
}

/** "€2,075". The site's one money format. */
export function formatEur(amount: number): string {
  return `€${Math.round(amount).toLocaleString("en-GB")}`;
}

/** "€2.1k" — the week cells, where four digits do not fit. */
export function formatEurCompact(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded >= 1000) {
    const thousands = rounded / 1000;
    return `€${thousands.toFixed(thousands >= 10 ? 0 : 1)}k`;
  }
  return `€${rounded}`;
}

/** "€1,585–2,560" — a band, where a single figure would lie. */
export function formatEurBand(band: readonly [number, number]): string {
  return `${formatEur(band[0])}–${Math.round(band[1]).toLocaleString("en-GB")}`;
}
