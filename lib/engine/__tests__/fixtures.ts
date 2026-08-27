/**
 * Fixture Capsules for the engine tests.
 *
 * Hand-written rather than imported from `lib/engine/capsules.ts` on purpose:
 * a test that asserts "the reef lands in its window" against the real reef
 * Capsule fails the day someone re-researches the reef, which is a change to
 * content and not to the scheduler. These exist to exercise the Lock kinds and
 * nothing else.
 */

import type { CapsuleSpec, PlanInput } from "@/lib/engine/types";
import { EMPTY_INPUT } from "@/lib/engine/plan";

export const FIXED: CapsuleSpec = {
  id: "fixed",
  name: "Fixed Thing",
  locationId: "sydney",
  days: 4,
  minDays: 2,
  lock: {
    kind: "date",
    from: "2026-12-31",
    to: "2026-12-31",
    why: "test: a date-locked block.",
  },
  needsCar: false,
  events: [
    {
      id: "fixed-event",
      label: "The Fixed Event",
      aud: { plan: 200, band: [100, 400] },
      dayOffset: 1,
      source: "test",
    },
  ],
  publishedEur: 1_000,
  tier: "deep",
};

export const WINDOWED: CapsuleSpec = {
  id: "windowed",
  name: "Windowed Thing",
  locationId: "port-douglas",
  days: 3,
  minDays: 2,
  lock: {
    kind: "window",
    from: "2027-01-18",
    to: "2027-01-25",
    why: "test: a window-locked block.",
  },
  needsCar: true,
  events: [],
  publishedEur: 900,
  tier: "deep",
};

export const WEEKDAYED: CapsuleSpec = {
  id: "weekdayed",
  name: "Saturday Thing",
  locationId: "perth",
  days: 1,
  minDays: 1,
  // 6 = Saturday, matching `weekdayOf`'s 0 = Sunday.
  lock: { kind: "weekday", weekdays: [6], why: "test: Saturdays only." },
  needsCar: false,
  events: [],
  publishedEur: 100,
  tier: "deep",
};

export const FLOATING: CapsuleSpec = {
  id: "floating",
  name: "Floating Thing",
  locationId: "melbourne",
  days: 2,
  minDays: 1,
  lock: { kind: "flexible" },
  needsCar: false,
  events: [],
  publishedEur: 400,
  tier: "deep",
};

/**
 * The arrival-locked kind. Deliberately **not** in `FIXTURES`: it would claim
 * the first days of every fixture-based suite in the engine, and those suites
 * are testing the ledger and the warnings, not this. The scheduler test opts
 * into it by name.
 */
export const ARRIVING: CapsuleSpec = {
  id: "arriving",
  name: "Arriving Thing",
  locationId: "mundaring",
  days: 2,
  minDays: 1,
  lock: { kind: "arrival", why: "test: straight off the plane." },
  needsCar: false,
  events: [],
  publishedEur: 0,
  tier: "deep",
};

export const FIXTURES: readonly CapsuleSpec[] = [
  FIXED,
  WINDOWED,
  WEEKDAYED,
  FLOATING,
];

/** An input with everything off, so a test names only what it is testing. */
export function input(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    ...EMPTY_INPUT,
    startDate: "2026-12-20",
    endDate: "2027-02-01",
    contingency: false,
    ...overrides,
  };
}
