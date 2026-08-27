/**
 * Place blocks and the transit rows between them — the Ledger's sections.
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
 * ## Getting there is not being there (#53)
 *
 * `legs.ts` charges every Leg's fare onto the Day it is travelled, because the
 * Plan's total is the sum of its Days and a fare living anywhere else would
 * break that. But the Day a Leg is travelled is the *first* Day of the place it
 * arrives in — so a naive block subtotal charges Margaret River for the €3,800
 * crossing from Valencia, and a four-day drive down the coast reads as a
 * five-thousand-euro adventure. That is the bug the user reported: "which makes
 * the Margaret River trip look like it's thousands of dollars."
 *
 * So this module lifts each Leg's fare back out of the block it landed in and
 * gives it a **transit row** of its own, sitting between the block it leaves and
 * the block it reaches. A block's subtotal is then what the couple spends *on
 * the ground there* — living, the car, the Event spend — and a block's cost
 * never includes the cost of reaching it.
 *
 * Nothing is re-priced. The lift is exact and by identity: the fare comes out of
 * the Day at the same figure `legs.ts` put on it, so
 *
 * > sum(block subtotals) + sum(transit rows) = the Plan's plan-on figure
 *
 * holds to the cent, and `__tests__/blocks.test.ts` asserts it.
 */

import type { Day, DayLine, Leg, LegMode, Warning } from "@/lib/engine/types";
import { cents } from "@/lib/engine/ledger";
import { locationById } from "@/lib/engine/locations";
import { addDays, formatSpan } from "@/lib/trip-dates";

/** A peak rule that bit somewhere in a block, named once however many Days it covered. */
export interface BlockPeak {
  id: string;
  label: string;
  note: string;
}

/**
 * One Day as the Ledger draws it: the priced Day, with the Leg fares travelled
 * that day lifted onto their own transit rows.
 *
 * The `Day` itself is untouched — it is the engine's atom and every other
 * surface reads its full `totalEur`. What changes here is only the attribution:
 * a row inside the Margaret River block shows what that day cost in Margaret
 * River, so the rows visibly add up to the band overhead.
 */
export interface LedgerDay {
  day: Day;
  /** `day.totalEur` less the Leg fares lifted out of it. */
  costEur: number;
  bandEur: [number, number];
  /** The lines that stay on the Day — everything except those fares. */
  lines: DayLine[];
  /** The fares that left, so the drill-in can say where they went. */
  transitLines: DayLine[];
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
  days: LedgerDay[];
  /** Capsules owning Days in the run, in the order they start. */
  capsuleIds: string[];
  capsuleNames: string[];
  /**
   * What the run costs **on the ground**: the sum of its Days' totals, less any
   * inter-city Leg fare travelled inside it. Reaching a place is a transit row,
   * not part of the place.
   */
  costEur: number;
  bandEur: [number, number];
  bufferDays: number;
  peaks: BlockPeak[];
  /** Every Warning with a date inside the run. The UI decides how loudly. */
  warnings: Warning[];
}

/**
 * A Leg, as a row of its own between two blocks.
 *
 * Everything here is read off the Leg and off the `transport` line it already
 * put on a Day. `costEur` in particular is the **line's** figure and not the
 * Leg's: they are equal by construction, and taking the one that was actually
 * charged is what makes the reconciliation an identity rather than an agreement.
 */
export interface LedgerTransit {
  /** The Leg's own id — "PER>SYD@2026-12-28". */
  id: string;
  date: string;
  fromLocationId: string;
  toLocationId: string;
  /** "Margaret River", or the IATA code where the end is home rather than a place. */
  fromName: string;
  toName: string;
  /** IATA, for the small mono pair. */
  from: string;
  to: string;
  mode: LegMode;
  /** Known for snapshot-priced flights; null for a band estimate or a drive. */
  carrier: string | null;
  pricing: Leg["pricing"];
  hydrated: boolean;
  costEur: number;
  bandEur: [number, number];
  note: string;
}

/** The Ledger, in the order it is read: blocks, with the journeys between them. */
export type LedgerRow =
  | { kind: "block"; id: string; block: LedgerBlock }
  | { kind: "transit"; id: string; transit: LedgerTransit };

/** `${leg.date}:${leg.id}` — the id `legs.ts` gives the line it charges. */
function lineIdOf(leg: Leg): string {
  return `${leg.date}:${leg.id}`;
}

/** "Margaret River", or the IATA code where the end is home rather than a place. */
function endName(locationId: string, iata: string): string {
  return locationId === "origin" ? iata : locationById(locationId).name;
}

export function intoBlocks(
  days: readonly Day[],
  warnings: readonly Warning[],
  legs: readonly Leg[],
): LedgerBlock[] {
  const lifted = new Set(legs.map(lineIdOf));

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
    const ledgerDays: LedgerDay[] = [];
    let costEur = 0;
    let low = 0;
    let high = 0;
    let bufferDays = 0;

    for (const day of run) {
      const lines: DayLine[] = [];
      const transitLines: DayLine[] = [];
      for (const line of day.lines) {
        (lifted.has(line.id) ? transitLines : lines).push(line);
      }

      const fare = transitLines.reduce((total, line) => total + line.eur, 0);
      const fareLow = transitLines.reduce(
        (total, line) => total + line.bandEur[0],
        0,
      );
      const fareHigh = transitLines.reduce(
        (total, line) => total + line.bandEur[1],
        0,
      );

      const dayCost = cents(day.totalEur - fare);
      const dayBand: [number, number] = [
        cents(day.bandEur[0] - fareLow),
        cents(day.bandEur[1] - fareHigh),
      ];

      ledgerDays.push({ day, costEur: dayCost, bandEur: dayBand, lines, transitLines });

      costEur += dayCost;
      low += dayBand[0];
      high += dayBand[1];
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
      days: ledgerDays,
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

/**
 * The whole Ledger in reading order — every block, with a transit row before the
 * block each Leg arrives in.
 *
 * A Leg is filed against the block it **opens**, because that is what arriving
 * means: the Perth → Sydney flight is the thing that starts the Sydney block,
 * and it belongs above its band rather than buried in its first day.
 *
 * Three ways a Leg finds that block, in order:
 *
 * 1. A block in the Leg's destination that starts on the day it is travelled.
 * 2. A block in the Leg's destination that starts the day **after** — the
 *    red-eye case. The Perth → Sydney flight leaves at 23:55 on Boxing Day and
 *    lands at 06:15 on the 27th, so the fare is dated the 26th and the block it
 *    opens starts the 27th. Without this the arrival row filed itself against
 *    the Perth block it was leaving, which reads as a flight to nowhere.
 * 3. Failing both, the block holding the day it is travelled — but only where
 *    the Plan actually stays at the destination. A Leg that arrives somewhere
 *    nobody sleeps is a connection: Madrid and Hong Kong on the way out,
 *    Singapore and Barcelona on the way home.
 *
 * A Leg with no block at all is filed before the next block to start after it,
 * and trails the Ledger if there is none — which is where the journey home
 * happens, and where it is read.
 */
export function intoLedger(
  days: readonly Day[],
  warnings: readonly Warning[],
  legs: readonly Leg[],
): LedgerRow[] {
  const blocks = intoBlocks(days, warnings, legs);
  const lineByDate = new Map<string, Map<string, DayLine>>();
  for (const day of days) {
    lineByDate.set(day.date, new Map(day.lines.map((line) => [line.id, line])));
  }

  // Where the Plan actually sleeps. A destination missing from this is a
  // connection, and a connection never opens a block.
  const stays = new Set(days.map((day) => day.locationId));

  const before = new Map<string, LedgerTransit[]>();
  const trailing: LedgerTransit[] = [];

  for (const leg of legs) {
    const transit = toTransit(leg, lineByDate.get(leg.date)?.get(lineIdOf(leg)));

    const startsOn = (date: string) =>
      blocks.find(
        (block) =>
          block.startDate === date && block.locationId === leg.toLocationId,
      );

    const opened =
      startsOn(leg.date) ??
      // The red-eye: it leaves the evening before the block it opens.
      startsOn(addDays(leg.date, 1)) ??
      // Falling back to the block merely *holding* the day covers the shapes
      // the Scheduler does not currently produce (a Leg on a day that is not a
      // boundary) without ever dropping a fare.
      (stays.has(leg.toLocationId)
        ? blocks.find((block) =>
            block.days.some((entry) => entry.day.date === leg.date),
          )
        : undefined) ??
      // A connection, then. It still has to be read somewhere, and the honest
      // place is in front of whatever the trip does next.
      blocks.find((block) => block.startDate >= leg.date);

    if (!opened) {
      trailing.push(transit);
      continue;
    }
    const queued = before.get(opened.id);
    if (queued) queued.push(transit);
    else before.set(opened.id, [transit]);
  }

  const rows: LedgerRow[] = [];
  for (const block of blocks) {
    for (const transit of before.get(block.id) ?? []) {
      rows.push({ kind: "transit", id: transit.id, transit });
    }
    rows.push({ kind: "block", id: block.id, block });
  }
  for (const transit of trailing) {
    rows.push({ kind: "transit", id: transit.id, transit });
  }

  return rows;
}

function toTransit(leg: Leg, line: DayLine | undefined): LedgerTransit {
  return {
    id: leg.id,
    date: leg.date,
    fromLocationId: leg.fromLocationId,
    toLocationId: leg.toLocationId,
    fromName: endName(leg.fromLocationId, leg.from),
    toName: endName(leg.toLocationId, leg.to),
    from: leg.from,
    to: leg.to,
    mode: leg.mode,
    carrier: leg.carrier,
    pricing: leg.pricing,
    hydrated: leg.hydrated,
    // The charged line, not the Leg, so the row and the lift cannot disagree.
    costEur: cents(line?.eur ?? leg.eur),
    bandEur: line ? [cents(line.bandEur[0]), cents(line.bandEur[1])] : leg.bandEur,
    note: leg.note,
  };
}
