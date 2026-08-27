/**
 * Scheduler tests — Locks are honoured, drags win, and nothing ever refuses.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { buildPlan } from "@/lib/engine/plan";
import { lockAllows, schedule } from "@/lib/engine/scheduler";
import { weekdayOf } from "@/lib/trip-dates";
import { ARRIVING, FIXTURES, input } from "@/lib/engine/__tests__/fixtures";

const placementOf = (plan: ReturnType<typeof buildPlan>, id: string) =>
  plan.placements.find((placement) => placement.capsuleId === id);

test("a date-locked Capsule covers its date", () => {
  const plan = buildPlan(input({ toggled: ["fixed"] }), FIXTURES);
  const placed = placementOf(plan, "fixed");

  assert.ok(placed);
  assert.ok(placed.startDate <= "2026-12-31");
  assert.ok(placed.endDate >= "2026-12-31");
  assert.equal(placed.lockViolated, false);
});

test("a window-locked Capsule sits inside its window", () => {
  const plan = buildPlan(input({ toggled: ["windowed"] }), FIXTURES);
  const placed = placementOf(plan, "windowed");

  assert.ok(placed);
  assert.ok(placed.startDate >= "2027-01-18", placed.startDate);
  assert.ok(placed.endDate <= "2027-01-25", placed.endDate);
});

test("a weekday-locked Capsule lands on its weekday", () => {
  const plan = buildPlan(input({ toggled: ["weekdayed"] }), FIXTURES);
  const placed = placementOf(plan, "weekdayed");

  assert.ok(placed);
  assert.equal(weekdayOf(placed.startDate), 6, "Saturday");
});

test("an arrival-locked Capsule starts on the trip's first day", () => {
  const specs = [...FIXTURES, ARRIVING];
  const plan = buildPlan(input({ toggled: ["arriving"] }), specs);
  const placed = placementOf(plan, "arriving");

  assert.ok(placed);
  assert.equal(placed.startDate, "2026-12-20", "the leaving date, not a date");
  assert.equal(placed.lockViolated, false);
});

test("the arrival block follows the leaving date, and the others do not", () => {
  const specs = [...FIXTURES, ARRIVING];
  const later = buildPlan(
    input({ startDate: "2026-12-27", toggled: ["arriving", "fixed"] }),
    specs,
  );

  assert.equal(placementOf(later, "arriving")?.startDate, "2026-12-27");
  // The date-locked block stayed on New Year's Eve: only `arrival` is relative.
  assert.ok(placementOf(later, "fixed")!.startDate <= "2026-12-31");
  assert.ok(placementOf(later, "fixed")!.endDate >= "2026-12-31");
});

test("the arrival block gets the first days even against a block that wants them", () => {
  const specs = [...FIXTURES, ARRIVING];
  const plan = buildPlan(
    input({ toggled: ["floating", "arriving"] }),
    specs,
  );

  const arriving = placementOf(plan, "arriving");
  const floating = placementOf(plan, "floating");
  assert.equal(arriving?.startDate, "2026-12-20");
  assert.deepEqual(arriving?.overlaps, []);
  // The flexible block would otherwise have taken the trip's opening days.
  assert.ok(floating!.startDate > arriving!.endDate, floating!.startDate);
});

test("a proposal never takes Christmas or New Year's Eve", () => {
  // `floating` is two flexible days in a 44-day range: without the Anchor rule
  // it scores the whole calendar, hard Anchors included.
  const plan = buildPlan(input({ toggled: ["floating"] }), FIXTURES);
  const placed = placementOf(plan, "floating");

  assert.ok(placed);
  for (const date of ["2026-12-25", "2026-12-31"]) {
    assert.ok(
      placed.startDate > date || placed.endDate < date,
      `${placed.startDate}–${placed.endDate} covers ${date}`,
    );
  }
});

test("the block whose date-Lock names the Anchor still gets it", () => {
  // `fixed` is date-locked to 31 December. The rule that keeps everything else
  // off New Year's Eve must not keep off the block that exists to cover it.
  const plan = buildPlan(input({ toggled: ["fixed"] }), FIXTURES);
  const placed = placementOf(plan, "fixed");

  assert.ok(placed);
  assert.ok(placed.startDate <= "2026-12-31" && placed.endDate >= "2026-12-31");
  assert.equal(placed.lockViolated, false);
  assert.deepEqual(placed.overlaps, []);
});

test("all five Locks hold when every Capsule is on at once", () => {
  const specs = [...FIXTURES, ARRIVING];
  const plan = buildPlan(
    input({ toggled: specs.map((capsule) => capsule.id) }),
    specs,
  );

  for (const capsule of specs) {
    const placed = placementOf(plan, capsule.id);
    assert.ok(placed, `${capsule.id} was placed`);
    assert.equal(
      placed.lockViolated,
      false,
      `${capsule.id} landed inside its Lock`,
    );
    assert.ok(
      lockAllows(capsule.lock, placed.startDate, placed.days, plan.startDate),
      `${capsule.id} at ${placed.startDate}`,
    );
  }
});

test("the least-free Capsule is placed first, whatever order the toggles arrive in", () => {
  const forwards = buildPlan(
    input({ toggled: ["floating", "weekdayed", "windowed", "fixed"] }),
    FIXTURES,
  );
  const backwards = buildPlan(
    input({ toggled: ["fixed", "windowed", "weekdayed", "floating"] }),
    FIXTURES,
  );

  assert.deepEqual(forwards.placements, backwards.placements);
});

test("a drag beats the Scheduler's proposal, even a bad one", () => {
  const plan = buildPlan(
    input({
      toggled: ["windowed"],
      placementOverrides: { windowed: "2026-12-22" },
    }),
    FIXTURES,
  );
  const placed = placementOf(plan, "windowed");

  assert.ok(placed);
  assert.equal(placed.startDate, "2026-12-22");
  assert.equal(placed.origin, "override");
  assert.equal(placed.lockViolated, true, "outside its window, and placed anyway");

  const warning = plan.warnings.find((item) => item.kind === "lock-violated");
  assert.ok(warning, "and the site says so");
  assert.equal(warning.capsuleId, "windowed");
});

test("a Buffer day is left after a block rather than packing edge to edge", () => {
  const plan = buildPlan(
    input({ toggled: ["fixed", "windowed"], startDate: "2026-12-20", endDate: "2027-02-01" }),
    FIXTURES,
  );

  for (const placement of plan.placements) {
    const dayAfter = plan.days.find((day) => day.date > placement.endDate);
    if (!dayAfter) continue;
    assert.equal(
      dayAfter.buffer,
      true,
      `the day after ${placement.capsuleId} should be a Buffer`,
    );
  }
});

test("an impossible fit is still placed, and reported as an overlap", () => {
  // Two Capsules, one legal week between them, and no room for both.
  const both = [
    { ...FIXTURES[1], id: "a", name: "A" },
    { ...FIXTURES[1], id: "b", name: "B", days: 7 },
  ];
  const result = schedule({
    startDate: "2027-01-18",
    endDate: "2027-01-25",
    capsules: both,
    placementOverrides: {},
    dayOverrides: {},
  });

  assert.equal(result.placements.length, 2, "nothing is refused");
  assert.equal(result.unplaced.length, 0);
  assert.ok(
    result.placements.some((placement) => placement.overlaps.length > 0),
    "the collision is recorded rather than resolved",
  );
});

test("a Capsule the trip is too short for is reported, not silently dropped", () => {
  const plan = buildPlan(
    input({
      toggled: ["windowed"],
      startDate: "2027-01-18",
      endDate: "2027-01-18",
    }),
    FIXTURES,
  );

  assert.deepEqual(plan.unplaced, ["windowed"]);
  const warning = plan.warnings.find((item) => item.kind === "unplaced");
  assert.ok(warning);
});

test("Legs are derived from the Day sequence, not placed", () => {
  const plan = buildPlan(
    input({ toggled: ["fixed", "windowed", "floating"] }),
    FIXTURES,
  );

  // Every Leg's date is a Day where the Location changed, or an end of the trip.
  for (const leg of plan.legs) {
    const index = plan.days.findIndex((day) => day.date === leg.date);
    assert.ok(index >= 0, `${leg.id} lands on a Day of the trip`);
    if (index === 0 || index === plan.days.length - 1) continue;
    assert.notEqual(
      plan.days[index - 1].locationId,
      plan.days[index].locationId,
      `${leg.id} sits on a relocation`,
    );
  }

  // And each one is charged to that Day, so the totals still reconcile.
  for (const leg of plan.legs) {
    const day = plan.days.find((entry) => entry.date === leg.date);
    assert.ok(
      day?.lines.some((line) => line.id.endsWith(leg.id)),
      `${leg.id} is a transport line on ${leg.date}`,
    );
  }
});

test("a per-Leg mode override changes how the Leg is priced", () => {
  const base = buildPlan(input({ toggled: ["fixed", "floating"] }), FIXTURES);
  const relocation = base.legs.find(
    (leg) => leg.fromLocationId !== "origin" && leg.toLocationId !== "origin",
  );
  assert.ok(relocation, "there is at least one relocation to override");

  const driven = buildPlan(
    input({
      toggled: ["fixed", "floating"],
      legModeOverrides: { [relocation.id]: "drive" },
    }),
    FIXTURES,
  );
  const overridden = driven.legs.find((leg) => leg.id === relocation.id);

  assert.ok(overridden);
  assert.equal(overridden.mode, "drive");
  assert.equal(overridden.modeOverridden, true);
  assert.equal(overridden.pricing, "computed");
  assert.notEqual(overridden.eur, relocation.eur);
});
