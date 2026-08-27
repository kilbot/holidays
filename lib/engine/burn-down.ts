/**
 * The burn-down — the roll-up unrolled across the trip dates (#42).
 *
 * `rollup.ts` answers "what does the Plan cost". This answers "when does it
 * cost it", and it is the same question: the last point of the plan-on curve
 * **is** `rollUp.totalEur`, and the last point of the worst-case curve **is**
 * `rollUp.worstCaseEur`. That identity is the whole design and the test suite
 * asserts it, because the alternative — a chart that estimates the same money a
 * second way — is how a burn-down ends up disagreeing with the number printed
 * above it.
 *
 * So nothing here prices anything. It walks the Days the ledger already priced,
 * in date order, and accumulates.
 *
 * ## Two curves, one measure
 *
 * Plan-on and worst case are not two series in the "which product line is
 * this" sense: they are the same money at two confidence levels, and worst
 * case is >= plan-on at every point by construction. The chart colours them as
 * one hue at two steps for exactly that reason.
 *
 * The worst-case curve re-converts each line's band top at the €0.65 stress
 * rate — but only the AUD share, because a fare quoted in EUR does not move
 * when the Australian dollar does. That is the same correction `rollup.ts`
 * applies to the whole trip; doing it per Day is what makes the two agree.
 *
 * ## Contingency
 *
 * The contingency row is a fraction of the plan, so it accumulates with the
 * plan: both curves are scaled by `1 + CONTINGENCY_RATE` when the toggle is on.
 * That keeps the ceiling crossing honest — a Plan that only crosses €20k once
 * you count the contingency really does cross it, and hiding that until the
 * final total would be the padding-in-disguise #10 ruled out.
 *
 * ## Trip time, not calendar time
 *
 * The x-axis is the trip's own days. Booking deadlines (1 Oct fares, festival
 * on-sales) are calendar-time facts about *when to buy*, and they belong to the
 * date rail, not here: a marker at 1 October on an axis that starts in December
 * would have nowhere to stand.
 */

import {
  AUD_TO_EUR_STRESS,
  BUDGET_CEILING_EUR,
  BUDGET_FLOOR_EUR,
  CONTINGENCY_RATE,
} from "@/lib/engine/constants";
import { cents } from "@/lib/engine/ledger";
import type { Day } from "@/lib/engine/types";

/** One trip day, with the running totals as at the end of it. */
export interface BurnPoint {
  date: string;
  /** 0-based day of the trip — the x position. */
  index: number;
  /** What this one Day cost, plan-on. The tooltip's "spent today". */
  dayEur: number;
  /** Cumulative plan-on spend through the end of this Day. */
  planOnEur: number;
  /** Cumulative worst case through the end of this Day. */
  worstEur: number;
  /** Ceiling minus cumulative plan-on. Negative once the Plan is over. */
  remainingEur: number;
}

/** Where a curve first goes over the Budget ceiling. */
export interface Crossing {
  date: string;
  index: number;
  /** Which curve crossed. Plan-on crossing is the louder fact. */
  series: "plan-on" | "worst";
  /** The cumulative figure on the day of the crossing. */
  eur: number;
}

export interface BurnDown {
  points: BurnPoint[];
  /** = `rollUp.totalEur`. Asserted, not hoped. */
  planOnTotal: number;
  /** = `rollUp.worstCaseEur`. */
  worstTotal: number;
  /**
   * The first ceiling crossing, plan-on preferred over worst case.
   *
   * Null when neither curve reaches €20k, which is the Plan the couple is
   * trying to build and so the common case — the chart has to look right with
   * no crossing at all.
   */
  crossing: Crossing | null;
  floorEur: number;
  ceilingEur: number;
}

export interface BurnDownInput {
  days: readonly Day[];
  /** The rate the Days were priced at. 0.61, or 0.65 with the stress toggle. */
  fxRate: number;
  contingency: boolean;
}

/** The first index at which a rising series reaches `level`, or -1. */
function firstAtOrAbove(values: readonly number[], level: number): number {
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] >= level) return index;
  }
  return -1;
}

export function burnDown(input: BurnDownInput): BurnDown {
  const { days, fxRate } = input;
  const uplift = input.contingency ? 1 + CONTINGENCY_RATE : 1;

  const points: BurnPoint[] = [];
  let planOn = 0;
  let worst = 0;

  for (const day of days) {
    planOn += day.totalEur;

    // The band's top, with the AUD-priced lines re-converted at the stress
    // rate. `aud === null` marks a EUR-native line (a fare), which the rate
    // does not touch.
    for (const item of day.lines) {
      worst +=
        item.aud === null
          ? item.bandEur[1]
          : (item.bandEur[1] / fxRate) * AUD_TO_EUR_STRESS;
    }

    const planOnAt = cents(planOn * uplift);
    points.push({
      date: day.date,
      index: day.index,
      dayEur: cents(day.totalEur * uplift),
      planOnEur: planOnAt,
      worstEur: cents(worst * uplift),
      remainingEur: cents(BUDGET_CEILING_EUR - planOnAt),
    });
  }

  const planOnSeries = points.map((point) => point.planOnEur);
  const worstSeries = points.map((point) => point.worstEur);

  const planOnCross = firstAtOrAbove(planOnSeries, BUDGET_CEILING_EUR);
  const worstCross = firstAtOrAbove(worstSeries, BUDGET_CEILING_EUR);

  // Plan-on crossing is the louder fact — it says the cheapest realistic
  // version of this Plan is over. The worst case crossing is worth marking
  // only when plan-on does not, where it reads as "and here is what it would
  // take".
  const crossing: Crossing | null =
    planOnCross >= 0
      ? {
          date: points[planOnCross].date,
          index: points[planOnCross].index,
          series: "plan-on",
          eur: points[planOnCross].planOnEur,
        }
      : worstCross >= 0
        ? {
            date: points[worstCross].date,
            index: points[worstCross].index,
            series: "worst",
            eur: points[worstCross].worstEur,
          }
        : null;

  const last = points.at(-1);

  return {
    points,
    planOnTotal: last ? last.planOnEur : 0,
    worstTotal: last ? last.worstEur : 0,
    crossing,
    floorEur: BUDGET_FLOOR_EUR,
    ceilingEur: BUDGET_CEILING_EUR,
  };
}
