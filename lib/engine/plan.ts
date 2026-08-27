/**
 * `buildPlan` — the engine's one entry point.
 *
 * Everything else in `lib/engine/` is a stage; this is the pipeline, and the
 * order is not arbitrary:
 *
 * 1. **Schedule.** Capsules onto Days, Locks honoured, overrides winning.
 * 2. **Ledger.** Those placements become priced Days. Buffer days fall out of
 *    the gaps and are priced like any other Day.
 * 3. **Legs.** Derived from the finished Day sequence, then charged back onto
 *    the Days they are travelled — which is why they come after the ledger and
 *    before anything that adds up.
 * 4. **Weeks.** Seven-day cells for the strip. Display only.
 * 5. **Roll-up.** Re-aggregations of the Day lines. Never a second estimate.
 * 6. **Warnings.** Read the finished Plan and describe what is wrong with it.
 *    They cannot change it.
 *
 * The function is pure. Same input, same Plan — no clock, no storage, no fetch.
 * That is what makes the whole thing testable with `node --test` and no
 * dependencies, and what lets a Scenario be nothing more than a saved input.
 */

import { buildLedger } from "@/lib/engine/ledger";
import { locationById } from "@/lib/engine/locations";
import { deriveLegs } from "@/lib/engine/legs";
import { rollUp } from "@/lib/engine/rollup";
import { schedule } from "@/lib/engine/scheduler";
import { collectWarnings } from "@/lib/engine/warnings";
import { AUD_TO_EUR, AUD_TO_EUR_STRESS } from "@/lib/engine/constants";
import type {
  CapsuleSpec,
  Day,
  Plan,
  PlanInput,
  PlanWeek,
  Warning,
} from "@/lib/engine/types";
import { daysBetween, formatSpan } from "@/lib/trip-dates";

/** Sensible nothing, so a caller only has to name what it cares about. */
export const EMPTY_INPUT: PlanInput = {
  startDate: "2026-12-12",
  endDate: "2027-02-22",
  toggled: [],
  placementOverrides: {},
  dayOverrides: {},
  legModeOverrides: {},
  lodgingTiers: {},
  carOverrides: {},
  eventOverrides: {},
  fxStress: false,
  contingency: true,
  fareOverrides: {},
};

export function buildPlan(
  input: PlanInput,
  catalogue: readonly CapsuleSpec[],
): Plan {
  const capsules = new Map(catalogue.map((spec) => [spec.id, spec]));
  const toggled = input.toggled
    .map((id) => capsules.get(id))
    .filter((spec): spec is CapsuleSpec => Boolean(spec));

  const scheduled = schedule({
    startDate: input.startDate,
    endDate: input.endDate,
    capsules: toggled,
    placementOverrides: input.placementOverrides,
    dayOverrides: input.dayOverrides,
  });

  const fxRate = input.fxStress ? AUD_TO_EUR_STRESS : AUD_TO_EUR;

  const priced = buildLedger({
    startDate: input.startDate,
    endDate: input.endDate,
    placements: scheduled.placements,
    capsules,
    lodgingTiers: input.lodgingTiers,
    carOverrides: input.carOverrides,
    eventOverrides: input.eventOverrides,
    fxRate,
  });

  const { legs, days } = deriveLegs({
    days: priced,
    legModeOverrides: input.legModeOverrides,
    fareOverrides: input.fareOverrides,
  });

  const totals = rollUp({
    days,
    fxStress: input.fxStress,
    contingency: input.contingency,
  });

  const warnings = collectWarnings({
    days,
    placements: scheduled.placements,
    capsules,
    unplaced: scheduled.unplaced,
    rollUp: totals,
    startDate: input.startDate,
    endDate: input.endDate,
    fxRate,
  });

  return {
    startDate: input.startDate,
    endDate: input.endDate,
    dayCount: daysBetween(input.startDate, input.endDate),
    days,
    weeks: intoWeeks(days, warnings),
    placements: scheduled.placements,
    legs,
    warnings,
    rollUp: totals,
    unplaced: scheduled.unplaced,
  };
}

/**
 * The week as the events layer wants it: each day, and where that day is.
 *
 * Deliberately per-Day rather than a set of regions for the week — a week that
 * flies from Perth to Sydney is in two places, and only its Days know which is
 * which.
 */
export function eventDaysOf(week: PlanWeek) {
  return week.days.map((day) => ({
    date: day.date,
    regions: locationById(day.locationId).regions,
  }));
}

/** Which normals a week's weather layers read. Null while in transit. */
export function weatherOf(week: PlanWeek): string | null {
  return locationById(week.leadLocationId).weather;
}

/**
 * Seven-day cells counted from the leaving date, not from Mondays.
 *
 * The strip is a trip, not a wall calendar: week one is the first seven days
 * away. Inherited from the demo strip this replaces, because it was right.
 */
function intoWeeks(days: Day[], warnings: readonly Warning[]): PlanWeek[] {
  const weeks: PlanWeek[] = [];

  for (let start = 0; start < days.length; start += 7) {
    const slice = days.slice(start, start + 7);
    if (slice.length === 0) break;

    const lead = dominantLocation(slice);
    const dates = new Set(slice.map((day) => day.date));

    weeks.push({
      id: `w${weeks.length + 1}`,
      startDate: slice[0].date,
      endDate: slice[slice.length - 1].date,
      label: formatSpan(slice[0].date, slice[slice.length - 1].date),
      days: slice,
      leadLocationId: lead.locationId,
      leadLocationName: lead.locationName,
      handover: handoverOf(slice, lead.locationId),
      costEur: slice.reduce((total, day) => total + day.totalEur, 0),
      bufferDays: slice.filter((day) => day.buffer).length,
      warnings: warnings.filter((warning) =>
        warning.dates.some((date) => dates.has(date)),
      ),
    });
  }

  return weeks;
}

/**
 * The other places in the cell, said in the order they are actually visited
 * (#98).
 *
 * The headline place is whichever owns the most Days, which has nothing to do
 * with when it is visited: a week that spends two days in Sydney and five in
 * Tasmania is headlined *Tasmania* and the second place, Sydney, came **first**.
 * The line under it used to read "then Sydney" regardless, so on three of the
 * trip's four mixed weeks the strip described the journey running backwards —
 * including the finale, where "8–14 Feb · Melbourne / then Byron Bay" says the
 * trip ends by leaving its last stop.
 *
 * So the word is chosen from the dates rather than asserted. Each other place
 * is put before or after the headline by its own first Day in the cell, and
 * "then" survives only where it is true.
 */
function handoverOf(days: Day[], leadId: string): string | null {
  const leadStart = days.findIndex((day) => day.locationId === leadId);

  const before: string[] = [];
  const after: string[] = [];
  const seen = new Set<string>([leadId]);

  days.forEach((day, index) => {
    if (seen.has(day.locationId)) return;
    seen.add(day.locationId);
    (index < leadStart ? before : after).push(day.locationName);
  });

  if (before.length === 0 && after.length === 0) return null;
  if (before.length === 0) return `then ${after.join(" · ")}`;
  if (after.length === 0) return `after ${before.join(" · ")}`;
  return `after ${before.join(" · ")}, then ${after.join(" · ")}`;
}

/** Whichever place owns the most Days in the cell; ties go to the earlier. */
function dominantLocation(days: Day[]): Day {
  const tally = new Map<string, number>();
  for (const day of days) {
    tally.set(day.locationId, (tally.get(day.locationId) ?? 0) + 1);
  }
  let best = days[0];
  for (const day of days) {
    if ((tally.get(day.locationId) ?? 0) > (tally.get(best.locationId) ?? 0)) {
      best = day;
    }
  }
  return best;
}
