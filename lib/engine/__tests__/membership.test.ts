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
 * The fix moved membership into the Scenario alone, so most of the assertions
 * below are about the total *moving* when that list changes. A test that only
 * checked which ids came back would have passed against a version of the engine
 * that then priced them all the same way.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { capsuleCatalogue } from "@/lib/engine/capsules";
import {
  effectiveVerdicts,
  planMembership,
  type VerdictMap,
} from "@/lib/engine/membership";
import { buildPlan } from "@/lib/engine/plan";
import { DEFAULT_SCENARIO } from "@/lib/engine/scenario-doc";
import { scenarioTotals } from "@/lib/engine/scenarios";

const SEED = DEFAULT_SCENARIO.input;

/** The rollup total for one Scenario membership list. */
function totalFor(toggled: readonly string[]): number {
  const onPlan = planMembership(toggled);
  return buildPlan({ ...SEED, toggled: onPlan }, capsuleCatalogue(onPlan))
    .rollUp.totalEur;
}

/** The reference trip with one Adventure taken off, as the switch would. */
const without = (id: string) => SEED.toggled.filter((other) => other !== id);

/* ------------------------------------------------------------------ */
/* The rule                                                            */
/* ------------------------------------------------------------------ */

test("membership is the Scenario's list, deduplicated and sorted", () => {
  assert.deepEqual(planMembership(["c", "a", "c"]), ["a", "c"]);
});

test("a Capsule on the Plan reads as *placed*, verdict recorded or not", () => {
  assert.deepEqual(effectiveVerdicts(["a", "b"], {}), {
    a: "placed",
    b: "placed",
  });
});

test("the bench and the discard pile pass through untouched", () => {
  assert.deepEqual(effectiveVerdicts([], { a: "interested", b: "discarded" }), {
    a: "interested",
    b: "discarded",
  });
});

test("a stale *placed* mark the Plan no longer backs is not a verdict", () => {
  // What a discarded preview leaves behind: the Scenario has been re-read from
  // the server and knows nothing about `a`, so neither should the grid.
  assert.deepEqual(effectiveVerdicts([], { a: "placed" }), {});
});

test("being on the Plan beats a verdict that says otherwise", () => {
  assert.deepEqual(effectiveVerdicts(["a"], { a: "discarded" }), {
    a: "placed",
  });
});

/* ------------------------------------------------------------------ */
/* #58: the total has to move                                          */
/* ------------------------------------------------------------------ */

test("taking a researched Adventure off the Plan changes the rollup total", () => {
  const seeded = totalFor(SEED.toggled);
  const lighter = totalFor(without("tasmania-arc"));

  assert.ok(seeded > 0 && lighter > 0, "both Plans should price to something");
  assert.notEqual(
    lighter,
    seeded,
    "removing Tasmania must move the total — this is the #58 regression",
  );
  assert.ok(
    lighter < seeded,
    `a trip with one fewer Adventure should not cost more (${lighter} vs ${seeded})`,
  );
});

test("taking a second one off moves it again", () => {
  const one = totalFor(without("tasmania-arc"));
  const two = totalFor(
    without("tasmania-arc").filter((id) => id !== "melbourne-party"),
  );
  assert.ok(two < one, `${two} should be under ${one}`);
});

test("putting a Catalog idea on the Plan changes the total the other way", () => {
  const seeded = totalFor(SEED.toggled);
  const richer = totalFor([
    ...SEED.toggled,
    "coral-bay-ningaloo-reef-off-the-beach",
  ]);
  assert.ok(richer > seeded, `${richer} should be over ${seeded}`);
});

test("a mark that was not written through cannot contradict the Plan", () => {
  // The stale-verdict case, which is what a discarded preview leaves behind: the
  // Scenario is authoritative, so an *interested* mark on something the Plan
  // still carries reads as placed and prices as placed.
  const marks: VerdictMap = { "tasmania-arc": "interested" };
  const verdicts = effectiveVerdicts(SEED.toggled, marks);

  assert.equal(verdicts["tasmania-arc"], "placed");
  assert.equal(Object.keys(verdicts).length, SEED.toggled.length);
});

/* ------------------------------------------------------------------ */
/* The comparison rows use the same rule                               */
/* ------------------------------------------------------------------ */

test("scenarioTotals prices a Scenario exactly as the headline prices it", () => {
  const lighter = {
    ...DEFAULT_SCENARIO,
    id: "lighter",
    input: { ...SEED, toggled: without("tasmania-arc") },
  };
  const catalogue = capsuleCatalogue(SEED.toggled);

  const [row] = scenarioTotals(
    { scenarios: [lighter], currentId: lighter.id },
    catalogue,
  );

  assert.equal(row.totalEur, totalFor(without("tasmania-arc")));
  assert.notEqual(row.totalEur, totalFor(SEED.toggled));
});
