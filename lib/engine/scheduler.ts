/**
 * The Scheduler.
 *
 * docs/CONTEXT.md: *"the engine that places a toggled Capsule onto the calendar
 * automatically: honouring Locks, inserting Buffer days, preferring cheap
 * feasible weeks. Its placements are proposals — the Travellers drag to adjust;
 * it never has the final word."*
 *
 * Every clause of that is load-bearing, and this is how each is met.
 *
 * ## It never has the final word
 *
 * `placementOverrides` is applied **first**, before any proposing happens, and
 * an overridden block is immovable for the rest of the pass. A drag is not a
 * hint the Scheduler gets to reconsider; it is the answer.
 *
 * ## It never refuses
 *
 * There is no failure path. A Capsule that cannot fit anywhere legal is placed
 * anyway — at the best spot its Lock allows, overlapping whatever is already
 * there — and the overlap comes back as a Warning. docs/CONTEXT.md: "Nothing is
 * ever blocked or refused — the site informs, the Travellers decide."
 *
 * ## It is deterministic
 *
 * Same input, same output, always. Two things make that true: the ordering is a
 * total order (specificity, then length, then id — no ties left to sort
 * stability), and candidate scoring breaks ties on the earlier date. Nothing
 * consults a clock or a random number.
 *
 * ## The algorithm, in full
 *
 * 1. **Order the Capsules by how little freedom they have.** Date-locked first,
 *    then window-locked, then weekday-locked, then flexible; longer before
 *    shorter inside a tier; id as the final tiebreak. Placing the immovable
 *    things first is the whole trick — a flexible Capsule that got the reef's
 *    only legal week would push the reef out of its window.
 * 2. **For each, enumerate candidate start dates** inside the trip range that
 *    its Lock permits.
 * 3. **Score each candidate** and take the best (see `scoreCandidate`).
 * 4. **Reserve the block plus one trailing Buffer day.** docs/CONTEXT.md:
 *    "capsules are never scheduled edge to edge". If the block only fits
 *    without its Buffer, it takes that and `warnings.ts` reports the missing
 *    Buffer — the honest outcome, not a refusal.
 * 5. **If no candidate is free at all**, place at the Lock's earliest legal
 *    start regardless of what is there, and record the overlap.
 *
 * Days no Capsule claims are Buffer days. They are not leftovers: the ledger
 * prices them and the roll-up counts them.
 */

import type { CapsuleSpec, Lock, Placement } from "@/lib/engine/types";
import { addDays, daysBetween, weekdayOf } from "@/lib/trip-dates";

/** One Buffer day after each block, so nothing is scheduled edge to edge. */
export const BUFFER_DAYS_AFTER_BLOCK = 1;

/** Lower sorts first: the less freedom a Lock leaves, the earlier it is placed. */
const LOCK_RANK: Record<Lock["kind"], number> = {
  date: 0,
  window: 1,
  weekday: 2,
  flexible: 3,
};

export interface ScheduleInput {
  startDate: string;
  endDate: string;
  capsules: readonly CapsuleSpec[];
  placementOverrides: Readonly<Record<string, string>>;
}

export interface ScheduleResult {
  placements: Placement[];
  /** Toggled Capsules the range is too short to hold even overlapping. */
  unplaced: string[];
}

/** Does a Lock permit a block of `days` starting here? */
export function lockAllows(lock: Lock, startDate: string, days: number): boolean {
  const endDate = addDays(startDate, days - 1);
  switch (lock.kind) {
    case "flexible":
      return true;
    case "window":
      // Inside the corridor, both ends.
      return startDate >= lock.from && endDate <= lock.to;
    case "date":
      // Must cover the locked span. NYE on the 30th is not NYE.
      return startDate <= lock.from && endDate >= lock.to;
    case "weekday":
      return lock.weekdays.includes(weekdayOf(startDate));
  }
}

/** Where a Lock would like to start, when nothing else constrains it. */
function preferredStart(lock: Lock, startDate: string): string {
  if (lock.kind === "window" || lock.kind === "date") {
    return lock.from > startDate ? lock.from : startDate;
  }
  return startDate;
}

export function schedule(input: ScheduleInput): ScheduleResult {
  const { startDate, endDate } = input;
  const tripDays = daysBetween(startDate, endDate);
  const taken = new Map<string, string>(); // date → capsule id
  const placements: Placement[] = [];
  const unplaced: string[] = [];

  const free = (date: string, days: number) => {
    for (let offset = 0; offset < days; offset += 1) {
      if (taken.has(addDays(date, offset))) return false;
    }
    return true;
  };

  const claim = (placement: Placement) => {
    for (let offset = 0; offset < placement.days; offset += 1) {
      taken.set(addDays(placement.startDate, offset), placement.capsuleId);
    }
    placements.push(placement);
  };

  const overlapsAt = (date: string, days: number) => {
    const hit = new Set<string>();
    for (let offset = 0; offset < days; offset += 1) {
      const held = taken.get(addDays(date, offset));
      if (held) hit.add(held);
    }
    return [...hit];
  };

  // ---- 1. Overrides, first and immovable. -------------------------------
  const overridden = new Set<string>();
  for (const capsule of ordered(input.capsules)) {
    const start = input.placementOverrides[capsule.id];
    if (!start) continue;
    overridden.add(capsule.id);

    const days = Math.min(capsule.days, tripDays);
    // A drag can land a block off the end of the trip; it gets clamped back so
    // the ledger has Days to hang it on, and keeps its own dates otherwise.
    const latest = addDays(endDate, -(days - 1));
    const clamped = start < startDate ? startDate : start > latest ? latest : start;

    claim({
      capsuleId: capsule.id,
      startDate: clamped,
      endDate: addDays(clamped, days - 1),
      days,
      origin: "override",
      lockViolated: !lockAllows(capsule.lock, clamped, days),
      overlaps: overlapsAt(clamped, days),
    });
  }

  // ---- 2. Propose the rest. ---------------------------------------------
  for (const capsule of ordered(input.capsules)) {
    if (overridden.has(capsule.id)) continue;

    if (tripDays < capsule.minDays) {
      unplaced.push(capsule.id);
      continue;
    }

    // Shrink to the trip before shrinking below the Capsule's own floor: a
    // 9-night Tasmania in a 6-day trip is a 6-day Tasmania with a Warning, not
    // an absence.
    const days = Math.max(1, Math.min(capsule.days, tripDays));

    let best: { start: string; score: number } | null = null;
    const lastStart = tripDays - days;

    for (let offset = 0; offset <= lastStart; offset += 1) {
      const start = addDays(startDate, offset);
      if (!lockAllows(capsule.lock, start, days)) continue;
      if (!free(start, days)) continue;

      const score = scoreCandidate(start, days, endDate, free);
      // Strictly greater, so the earliest of equally good weeks wins.
      if (!best || score > best.score) best = { start, score };
    }

    if (best) {
      claim({
        capsuleId: capsule.id,
        startDate: best.start,
        endDate: addDays(best.start, days - 1),
        days,
        origin: "proposed",
        lockViolated: false,
        overlaps: [],
      });
      continue;
    }

    // ---- 3. No legal free window. Place it anyway. ----------------------
    const fallbackRaw = preferredStart(capsule.lock, startDate);
    const latest = addDays(endDate, -(days - 1));
    const fallback =
      fallbackRaw < startDate
        ? startDate
        : fallbackRaw > latest
          ? latest
          : fallbackRaw;

    claim({
      capsuleId: capsule.id,
      startDate: fallback,
      endDate: addDays(fallback, days - 1),
      days,
      origin: "proposed",
      lockViolated: !lockAllows(capsule.lock, fallback, days),
      overlaps: overlapsAt(fallback, days),
    });
  }

  placements.sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || a.capsuleId.localeCompare(b.capsuleId),
  );
  return { placements, unplaced };
}

/**
 * How good a candidate start is. Higher wins; ties go to the earlier date
 * because the loop only replaces on a strict improvement.
 *
 * Two things are scored, and only two, because a scoring function nobody can
 * predict is worse than a crude one everybody can:
 *
 * - **A trailing Buffer day** is worth a lot (+10). This is what stops the
 *   Scheduler packing blocks edge to edge, which docs/CONTEXT.md calls out as
 *   the failure mode the whole Buffer concept exists to prevent.
 * - **A leading Buffer day** is worth less (+4): arriving somewhere the day
 *   after leaving somewhere else is normal; leaving the moment a block ends is
 *   what burns people out.
 *
 * Cheap-week preference lives in the Lock windows rather than here. The
 * research already encodes it — "from ~18 January, the day operator off-peak
 * pricing starts", "from Thursday 28 January, the day NSW school holidays end"
 * are price findings expressed as windows — and a scorer that re-derived it
 * from the peak table would fight those windows rather than respect them.
 */
function scoreCandidate(
  start: string,
  days: number,
  endDate: string,
  free: (date: string, days: number) => boolean,
): number {
  let score = 0;

  const after = addDays(start, days);
  if (after > endDate || free(after, BUFFER_DAYS_AFTER_BLOCK)) score += 10;

  const before = addDays(start, -1);
  if (free(before, 1)) score += 4;

  return score;
}

/**
 * Least freedom first, then longest, then id.
 *
 * The id tiebreak is not decoration: without it the order would depend on the
 * order the toggles happened to arrive in, and the same Plan would schedule
 * differently on a reload.
 */
function ordered(capsules: readonly CapsuleSpec[]): CapsuleSpec[] {
  return [...capsules].sort(
    (a, b) =>
      LOCK_RANK[a.lock.kind] - LOCK_RANK[b.lock.kind] ||
      b.days - a.days ||
      a.id.localeCompare(b.id),
  );
}
