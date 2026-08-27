/**
 * Reconciliation against the real research corpus.
 *
 * The other suites run on fixtures, deliberately: they test the scheduler and
 * the ledger, and a fixture is the only way to do that without the tests
 * failing every time someone re-researches Tasmania.
 *
 * This one is different. It runs the default Scenario — all eight researched
 * Capsules, the reference dates — through the whole pipeline and asserts the
 * invariant the entire cost model rests on: **the Plan's total is the sum of
 * its Days, to the cent**. If a Leg ever gets priced onto a Leg object instead
 * of onto a Day, or a roll-up ever estimates something a second way, this is
 * what catches it.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { capsuleCatalogue } from "@/lib/engine/capsules";
import { cents } from "@/lib/engine/ledger";
import { buildPlan } from "@/lib/engine/plan";
import { DEFAULT_SCENARIO } from "@/lib/engine/scenarios";

const plan = buildPlan(DEFAULT_SCENARIO.input, capsuleCatalogue([]));

test("the default Scenario places all eight researched Capsules", () => {
  assert.equal(plan.placements.length, 8);
  assert.deepEqual(plan.unplaced, []);
  for (const placement of plan.placements) {
    assert.equal(
      placement.lockViolated,
      false,
      `${placement.capsuleId} at ${placement.startDate}`,
    );
    assert.deepEqual(placement.overlaps, [], placement.capsuleId);
  }
});

test("the two hard Anchors are honoured out of the box", () => {
  const on = (date: string) => plan.days.find((day) => day.date === date);

  assert.equal(on("2026-12-25")?.homeBase, true, "Christmas at a Home base");
  assert.equal(on("2026-12-31")?.locationId, "sydney", "NYE in Sydney");

  assert.equal(
    plan.warnings.filter((warning) => warning.kind === "anchor-missed").length,
    0,
  );
});

test("the roll-up reconciles with the ledger, to the cent", () => {
  const summed = cents(
    plan.days.reduce((total, day) => total + day.totalEur, 0),
  );
  assert.equal(plan.rollUp.planOnEur, summed);

  const splits = cents(
    plan.rollUp.splits.reduce((total, split) => total + split.amountEur, 0),
  );
  assert.equal(splits, plan.rollUp.planOnEur);

  const weeks = cents(
    plan.weeks.reduce((total, week) => total + week.costEur, 0),
  );
  assert.equal(weeks, plan.rollUp.planOnEur, "the strip agrees with the HUD");

  const lines = cents(
    plan.days.reduce(
      (total, day) =>
        total + day.lines.reduce((sum, line) => sum + line.eur, 0),
      0,
    ),
  );
  assert.equal(lines, plan.rollUp.planOnEur, "and both agree with the lines");
});

test("every Leg's fare is charged to a Day", () => {
  for (const leg of plan.legs) {
    const day = plan.days.find((entry) => entry.date === leg.date);
    assert.ok(day, `${leg.id} lands on a Day`);
    const line = day.lines.find((entry) => entry.id.endsWith(leg.id));
    assert.ok(line, `${leg.id} is a line on ${leg.date}`);
    assert.equal(line.eur, leg.eur);
  }
});

test("the crossing is priced once, not twice", () => {
  const crossings = plan.legs.filter(
    (leg) => leg.fromLocationId === "origin" || leg.toLocationId === "origin",
  );
  assert.equal(crossings.length, 2, "out and back");
  assert.ok(crossings[0].eur > 0, "the outbound carries the return fare");
  assert.equal(crossings[1].eur, 0, "and the homeward carries nothing");
});
