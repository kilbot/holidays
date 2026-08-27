/**
 * Warnings — the site's only enforcement mechanism, and it enforces nothing.
 *
 * docs/CONTEXT.md: *"a violated Lock, missing Buffer, jam-packed week,
 * Daily-cap blowout, or crossed Budget ceiling shows as a badge on the
 * offending Days and lines. Nothing is ever blocked or refused — the site
 * informs, the Travellers decide."*
 *
 * Every function here returns data. None of them throw, none of them mutate a
 * Plan, and none of them can prevent one. A Warning is a sentence with dates
 * attached, and the UI decides how loudly to say it.
 *
 * The seven kinds, and the rule each one enforces-by-not-enforcing:
 *
 * | kind | fires when |
 * |---|---|
 * | `lock-violated` | a placement sits outside its Capsule's own Lock |
 * | `overlap` | two Capsules claim the same Days |
 * | `unplaced` | a toggled Capsule the range has no room for at all |
 * | `anchor-missed` | Christmas is not in Perth, NYE is not in Sydney, or an Anchor date falls outside the trip |
 * | `zero-buffer` | a relocation with no Buffer day before it |
 * | `jam-packed` | seven consecutive Days with no Buffer in them |
 * | `daily-cap` | a Day's **living** lines clear A$500 for the couple |
 * | `budget-ceiling` | the total clears €20,000 |
 *
 * The Daily-cap rule is the one worth being precise about. docs/CONTEXT.md
 * defines the cap as "lodging + food + local transport" and Event spend as the
 * thing the thrift on those lines pays for. So a reef day is never a cap
 * breach, and neither is a A$1,000 flight. Only living costs are measured, and
 * `DayLine.living` is the single place that judgement is recorded.
 */

import {
  BUDGET_CEILING_EUR,
  DAILY_CAP_AUD,
  homeBaseDayDeltaAud,
} from "@/lib/engine/constants";
import type {
  CapsuleSpec,
  Day,
  Placement,
  RollUp,
  Warning,
} from "@/lib/engine/types";
import { describeLock } from "@/lib/engine/ledger";
import { ANCHORS, formatDay } from "@/lib/trip-dates";

/** How many Days without a Buffer counts as jam-packed. One full week. */
export const JAM_PACKED_RUN = 7;

export interface WarningInput {
  days: readonly Day[];
  placements: readonly Placement[];
  capsules: ReadonlyMap<string, CapsuleSpec>;
  unplaced: readonly string[];
  rollUp: RollUp;
  startDate: string;
  endDate: string;
  /** The Plan's FX rate, for expressing the AUD cap in the money on screen. */
  fxRate: number;
}

export function collectWarnings(input: WarningInput): Warning[] {
  return [
    ...lockWarnings(input),
    ...anchorWarnings(input),
    ...bufferWarnings(input),
    ...capWarnings(input),
    ...budgetWarnings(input),
  ];
}

/* ------------------------------------------------------------------ */
/* Locks                                                               */
/* ------------------------------------------------------------------ */

function lockWarnings(input: WarningInput): Warning[] {
  const out: Warning[] = [];

  for (const placement of input.placements) {
    const capsule = input.capsules.get(placement.capsuleId);
    if (!capsule) continue;

    if (placement.lockViolated) {
      out.push({
        id: `lock:${placement.capsuleId}`,
        kind: "lock-violated",
        tone: "warn",
        label: lockBreachLabel(capsule),
        detail: `${lockSentence(capsule)} It is placed ${formatDay(placement.startDate)}–${formatDay(placement.endDate)}${placement.origin === "override" ? ", where it was dragged" : ""}. Nothing is blocked — the research's reason for the dates is the thing to weigh.`,
        dates: datesOf(placement),
        capsuleId: capsule.id,
      });
    }

    if (placement.overlaps.length > 0) {
      const names = placement.overlaps
        .map((id) => input.capsules.get(id)?.name ?? id)
        .join(", ");
      out.push({
        id: `overlap:${placement.capsuleId}`,
        kind: "overlap",
        tone: "over",
        label: `${capsule.name} overlaps ${placement.overlaps.length} block${placement.overlaps.length === 1 ? "" : "s"}`,
        detail: `There was no free run of ${placement.days} days its Lock allows, so it is placed on top of ${names}. Those Days are priced once, at ${capsule.name}'s rates. Drag something, or drop an Adventure.`,
        dates: datesOf(placement),
        capsuleId: capsule.id,
      });
    }
  }

  for (const id of input.unplaced) {
    const capsule = input.capsules.get(id);
    out.push({
      id: `unplaced:${id}`,
      kind: "unplaced",
      tone: "over",
      label: `${capsule?.name ?? id} does not fit`,
      detail: `It wants at least ${capsule?.minDays ?? "?"} days and the trip is shorter than that. Lengthen the trip or take it off the Plan.`,
      dates: [],
      capsuleId: id,
    });
  }

  return out;
}

/**
 * The headline for a breached Lock, in the words that Lock actually uses.
 *
 * "Outside its window" was said of every kind, including the date-locks that
 * have no window — NYE is on 31 December or it is not NYE. Since #56 the three
 * kinds are described in one place (`describeLock`) so the Ledger's chip, the
 * week zoom's band and this sentence cannot drift apart.
 */
function lockBreachLabel(capsule: CapsuleSpec): string {
  switch (capsule.lock.kind) {
    case "window":
      return `${capsule.name} is outside its best dates`;
    case "date":
      return `${capsule.name} misses the dates it has to cover`;
    case "weekday":
      return `${capsule.name} is on the wrong days`;
    case "flexible":
      return `${capsule.name} is out of place`;
  }
}

function lockSentence(capsule: CapsuleSpec): string {
  const described = describeLock(capsule.lock);
  return described
    ? `${capsule.name}: ${described.sentence}.`
    : `${capsule.name} floats — this should not have fired.`;
}

/* ------------------------------------------------------------------ */
/* Anchors                                                             */
/* ------------------------------------------------------------------ */

/**
 * Which Location an Anchor wants. docs/CONTEXT.md names two hard ones —
 * Christmas in Perth, New Year's Eve in Sydney — and one soft: Australia Day,
 * "be somewhere good for it, city decided by itinerary flow", which is why it
 * has no Location here and only warns if the date falls outside the trip.
 */
const ANCHOR_LOCATION: Readonly<Record<string, string>> = {
  "2026-12-25": "perth",
  "2026-12-31": "sydney",
};

function anchorWarnings(input: WarningInput): Warning[] {
  const out: Warning[] = [];
  const byDate = new Map(input.days.map((day) => [day.date, day]));

  for (const anchor of ANCHORS) {
    const day = byDate.get(anchor.date);

    if (!day) {
      out.push({
        id: `anchor:${anchor.date}:outside`,
        kind: "anchor-missed",
        tone: anchor.hard ? "over" : "warn",
        label: `${anchor.label} falls outside the trip`,
        detail: `${formatDay(anchor.date)} is not in the range. ${anchor.note}`,
        dates: [],
        capsuleId: null,
      });
      continue;
    }

    const wanted = ANCHOR_LOCATION[anchor.date];
    if (!wanted) continue;
    if (day.locationId === wanted) continue;
    // Rottnest is a day trip out of the Perth home base; the couple sleeps
    // there either side of it, so it satisfies a Perth anchor.
    if (wanted === "perth" && day.homeBase) continue;

    out.push({
      id: `anchor:${anchor.date}:place`,
      kind: "anchor-missed",
      tone: anchor.hard ? "over" : "warn",
      label: `${anchor.label} is not in ${anchor.place}`,
      detail: `${formatDay(anchor.date)} lands in ${day.locationName}. ${anchor.note}`,
      dates: [anchor.date],
      capsuleId: day.capsuleId,
    });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Buffers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Two Warnings, and they are about different failures.
 *
 * `zero-buffer` is local: you flew somewhere the morning after your last
 * Capsule ended. `jam-packed` is structural: a whole week went by with nothing
 * unscheduled in it. docs/CONTEXT.md calls Buffer days first-class and #8 calls
 * refusing to be jam-packed "arguably THE differentiator vs a naive itinerary
 * packer", so both are worth saying out loud.
 */
function bufferWarnings(input: WarningInput): Warning[] {
  const out: Warning[] = [];
  const { days } = input;

  for (let index = 1; index < days.length; index += 1) {
    const previous = days[index - 1];
    const day = days[index];
    if (previous.locationId === day.locationId) continue;
    if (previous.buffer || day.buffer) continue;

    out.push({
      id: `zero-buffer:${day.date}`,
      kind: "zero-buffer",
      tone: "warn",
      label: `No buffer into ${day.locationName}`,
      detail: `${previous.capsuleName ?? previous.locationName} ends on ${formatDay(previous.date)} and ${day.capsuleName ?? day.locationName} starts the next morning. A Buffer day here costs a cheap night and buys the freedom to stay longer or leave early.`,
      dates: [previous.date, day.date],
      capsuleId: day.capsuleId,
    });
  }

  let run = 0;
  let runStart = 0;
  for (let index = 0; index < days.length; index += 1) {
    if (days[index].buffer) {
      run = 0;
      runStart = index + 1;
      continue;
    }
    run += 1;
    if (run !== JAM_PACKED_RUN) continue;

    const span = days.slice(runStart, index + 1);
    out.push({
      id: `jam-packed:${span[0].date}`,
      kind: "jam-packed",
      tone: "warn",
      label: "Jam-packed week",
      detail: `${formatDay(span[0].date)}–${formatDay(span[span.length - 1].date)} has no Buffer day in it. The Plan should refuse to be jam-packed — stay longer somewhere fun, or leave somewhere disappointing early.`,
      dates: span.map((day) => day.date),
      capsuleId: null,
    });
    run = 0;
    runStart = index + 1;
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Daily cap and Budget                                                */
/* ------------------------------------------------------------------ */

function capWarnings(input: WarningInput): Warning[] {
  const capEur = DAILY_CAP_AUD * input.fxRate;

  return input.days
    .filter((day) => day.livingEur > capEur)
    .map((day) => {
      const over = day.livingEur - capEur;
      const lodging = day.lines.find((item) => item.kind === "lodging");
      return {
        id: `cap:${day.date}`,
        kind: "daily-cap" as const,
        tone: "over" as const,
        label: `${formatDay(day.date)} blows the daily cap`,
        detail: `Living costs are €${Math.round(day.livingEur)} against the A$${DAILY_CAP_AUD} / €${Math.round(capEur)} ceiling — €${Math.round(over)} over.${day.peakLabel ? ` ${day.peakLabel}: ${day.peakNote}` : ""}${lodging ? ` The lodging line alone is €${Math.round(lodging.eur)}; a cheaper tier or a suburb on a train line is the lever.` : ""}`,
        dates: [day.date],
        capsuleId: day.capsuleId,
      };
    });
}

function budgetWarnings(input: WarningInput): Warning[] {
  const { rollUp } = input;
  if (!rollUp.overBudget) return [];

  const over = rollUp.totalEur - BUDGET_CEILING_EUR;
  return [
    {
      id: "budget:ceiling",
      kind: "budget-ceiling",
      tone: "over",
      label: "Over the budget ceiling",
      detail: `€${Math.round(rollUp.totalEur)} against a €${BUDGET_CEILING_EUR.toLocaleString("en-GB")} ceiling — €${Math.round(over)} over. Every day moved from the east coast to a Home base is about €${Math.round(paidCityDelta(input.fxRate))} back.`,
      dates: [],
      capsuleId: null,
    },
  ];
}

/**
 * What one day moved from a paid city to a Home base saves, in euros.
 *
 * Quoted at this Plan's own rates and its own FX, never at cost-baselines §4's
 * A$500 headline: that was a mid-tier figure, and #64 walked it down to A$185.
 * The arithmetic lives in `constants.ts`, next to the rates it is about.
 */
function paidCityDelta(fxRate: number): number {
  return homeBaseDayDeltaAud() * fxRate;
}

function datesOf(placement: Placement): string[] {
  const dates: string[] = [];
  const start = new Date(`${placement.startDate}T00:00:00Z`).getTime();
  for (let offset = 0; offset < placement.days; offset += 1) {
    dates.push(
      new Date(start + offset * 86_400_000).toISOString().slice(0, 10),
    );
  }
  return dates;
}
