/**
 * What is on the Plan, and what that does to the money.
 *
 * The regression these pin is #58: *"adding and removing adventures, and the
 * budget doesn't change — locked at some arbitrary number."* The arbitrary
 * number was €24,541 — the reference Scenario with all eight researched
 * Adventures on — and it was arbitrary in the precise sense that no control on
 * the site could move it. `usePlan` merged the Scenario's `toggled` list with
 * the shortlist's *placed* marks using a union, and a union cannot subtract.
 *
 * So the assertions below are mostly about the total *moving*. A test that only
 * checked `planMembership` returned the right ids would have passed against a
 * version of the engine that then priced them all the same way.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { capsuleCatalogue } from "@/lib/engine/capsules";
import { planMembership, type VerdictMap } from "@/lib/engine/membership";
import { buildPlan } from "@/lib/engine/plan";
import { DEFAULT_SCENARIO } from "@/lib/engine/scenario-doc";
import { scenarioTotals } from "@/lib/engine/scenarios";

const SEED = DEFAULT_SCENARIO.input;

/** The rollup total for one set of shortlist verdicts over the reference trip. */
function totalWith(marks: VerdictMap): number {
  const onPlan = planMembership(SEED.toggled, marks);
  return buildPlan({ ...SEED, toggled: onPlan }, capsuleCatalogue(onPlan))
    .rollUp.totalEur;
}

/* ------------------------------------------------------------------ */
/* The rule                                                            */
/* ------------------------------------------------------------------ */

test("an unmarked Capsule falls back to the Scenario's own list", () => {
  assert.deepEqual(planMembership(["a", "b"], {}), ["a", "b"]);
});

test("a *placed* verdict puts a Capsule on a Plan that did not have it", () => {
  assert.deepEqual(planMembership(["a"], { b: "placed" }), ["a", "b"]);
});

test("*interested* takes a seeded Capsule off the Plan — the bench costs nothing", () => {
  assert.deepEqual(planMembership(["a", "b"], { b: "interested" }), ["a"]);
});

test("*discarded* takes it off too", () => {
  assert.deepEqual(planMembership(["a", "b"], { a: "discarded" }), ["b"]);
});

test("membership is sorted, so an unchanged Plan is the same array", () => {
  assert.deepEqual(planMembership(["c", "a"], { b: "placed" }), ["a", "b", "c"]);
});

/* ------------------------------------------------------------------ */
/* #58: the total has to move                                          */
/* ------------------------------------------------------------------ */

test("taking a researched Adventure off the Plan changes the rollup total", () => {
  const seeded = totalWith({});
  const without = totalWith({ "tasmania-arc": "interested" });

  assert.ok(
    seeded > 0 && without > 0,
    "both Plans should price to something",
  );
  assert.notEqual(
    without,
    seeded,
    "removing Tasmania must move the total — this is the #58 regression",
  );
  assert.ok(
    without < seeded,
    `a trip with one fewer Adventure should not cost more (${without} vs ${seeded})`,
  );
});

test("discarding a second Adventure moves it again", () => {
  const one = totalWith({ "tasmania-arc": "interested" });
  const two = totalWith({
    "tasmania-arc": "interested",
    "melbourne-party": "discarded",
  });
  assert.ok(two < one, `${two} should be under ${one}`);
});

test("putting a Catalog idea on the Plan changes the total the other way", () => {
  const seeded = totalWith({});
  const richer = totalWith({
    "coral-bay-ningaloo-reef-off-the-beach": "placed",
  });
  assert.ok(richer > seeded, `${richer} should be over ${seeded}`);
});

test("re-marking every Adventure *placed* leaves the reference trip alone", () => {
  const marks = Object.fromEntries(
    SEED.toggled.map((id) => [id, "placed" as const]),
  );
  assert.equal(totalWith(marks), totalWith({}));
});

/* ------------------------------------------------------------------ */
/* The comparison rows use the same rule                               */
/* ------------------------------------------------------------------ */

test("scenarioTotals applies the verdicts, so the rows agree with the headline", () => {
  const marks: VerdictMap = { "tasmania-arc": "interested" };
  const onPlan = planMembership(SEED.toggled, marks);
  const catalogue = capsuleCatalogue(onPlan);

  const [row] = scenarioTotals(
    { scenarios: [DEFAULT_SCENARIO], currentId: DEFAULT_SCENARIO.id },
    catalogue,
    marks,
  );

  assert.equal(row.totalEur, totalWith(marks));
  assert.notEqual(row.totalEur, totalWith({}));
});
