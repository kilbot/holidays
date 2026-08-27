/**
 * Place blocks — the Ledger's sections.
 *
 * `plan.ts` already cuts the trip into seven-day cells for the strip. A
 * full-page ledger wants the other cut: **a run of consecutive Days in one
 * Location**. That is the unit the trip is actually lived and argued in — "Perth
 * · family, 14–27 Dec, free lodging" — and it is what the #33 prototype's
 * `b-band` was. A week band would cut Sydney in half on a Thursday for no
 * reason anyone travelling would recognise.
 *
 * The grouping is on `locationId` alone, not on the Capsule, and that is
 * deliberate: a Buffer day after Margaret River is still in Margaret River, and
 * docs/CONTEXT.md is explicit that Buffer days are first-class rather than
 * leftover slack. Putting them in their own section would read as an
 * interruption of the block they belong to.
 *
 * Every figure here is a re-aggregation of `Day` totals — the same rule
 * `rollup.ts` follows. Nothing is priced a second way, so the blocks' subtotals
 * sum to the Plan's plan-on figure exactly.
 */

import type { Day, Warning } from "@/lib/engine/types";
import { cents } from "@/lib/engine/ledger";
import { formatSpan } from "@/lib/trip-dates";

/** A peak rule that bit somewhere in a block, named once however many Days it covered. */
export interface BlockPeak {
  id: string;
  label: string;
  note: string;
}

/** One run of consecutive Days in one place. docs/CONTEXT.md, Day and Location. */
export interface LedgerBlock {
  /** Stable across re-derives: the place, and the day the run starts. */
  id: string;
  locationId: string;
  locationName: string;
  /** Free lodging and a borrowed car — the block badge the cost model is about. */
  homeBase: boolean;
  startDate: string;
  endDate: string;
  /** "14–27 Dec". */
  label: string;
  days: Day[];
  /** Capsules owning Days in the run, in the order they start. */
  capsuleIds: string[];
  capsuleNames: string[];
  /** Sum of the run's Day totals. */
  costEur: number;
  bandEur: [number, number];
  bufferDays: number;
  peaks: BlockPeak[];
  /** Every Warning with a date inside the run. The UI decides how loudly. */
  warnings: Warning[];
}

export function intoBlocks(
  days: readonly Day[],
  warnings: readonly Warning[],
): LedgerBlock[] {
  const runs: Day[][] = [];
  for (const day of days) {
    const current = runs[runs.length - 1];
    if (current && current[0].locationId === day.locationId) {
      current.push(day);
      continue;
    }
    runs.push([day]);
  }

  return runs.map((run) => {
    const first = run[0];
    const last = run[run.length - 1];
    const dates = new Set(run.map((day) => day.date));

    const capsuleIds: string[] = [];
    const capsuleNames: string[] = [];
    const peaks: BlockPeak[] = [];
    let costEur = 0;
    let low = 0;
    let high = 0;
    let bufferDays = 0;

    for (const day of run) {
      costEur += day.totalEur;
      low += day.bandEur[0];
      high += day.bandEur[1];
      if (day.buffer) bufferDays += 1;
      if (day.capsuleId && !capsuleIds.includes(day.capsuleId)) {
        capsuleIds.push(day.capsuleId);
        capsuleNames.push(day.capsuleName ?? day.capsuleId);
      }
      if (day.peakId && !peaks.some((peak) => peak.id === day.peakId)) {
        peaks.push({
          id: day.peakId,
          label: day.peakLabel ?? day.peakId,
          note: day.peakNote ?? "",
        });
      }
    }

    return {
      id: `${first.locationId}:${first.date}`,
      locationId: first.locationId,
      locationName: first.locationName,
      homeBase: first.homeBase,
      startDate: first.date,
      endDate: last.date,
      label: formatSpan(first.date, last.date),
      days: run,
      capsuleIds,
      capsuleNames,
      costEur: cents(costEur),
      bandEur: [cents(low), cents(high)],
      bufferDays,
      peaks,
      warnings: warnings.filter((warning) =>
        warning.dates.some((date) => dates.has(date)),
      ),
    };
  });
}
