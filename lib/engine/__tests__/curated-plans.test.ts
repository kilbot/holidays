/**
 * Numbered Scenarios: each seeded Scenario carries a fixed number and a write-up.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { capsuleCatalogue } from "@/lib/engine/capsules";
import {
  CURATED_PLANS,
  curatedPlanBySlug,
  planLetter,
  planTitle,
} from "@/lib/engine/curated-plans";
import { buildPlan } from "@/lib/engine/plan";
import { ADELINE_SCENARIO, INITIAL_STATE } from "@/lib/engine/scenario-doc";

test("every seeded Scenario has its curated number", () => {
  assert.deepEqual(
    INITIAL_STATE.scenarios.map((scenario) =>
      planLetter(scenario.id, INITIAL_STATE.scenarios),
    ),
    ["2", "3", "4", "1"],
  );
});

test("numbers are unique and every curated plan is a seeded Scenario", () => {
  const letters = CURATED_PLANS.map((plan) => plan.letter);
  assert.equal(new Set(letters).size, letters.length);
  const seeded = new Set(INITIAL_STATE.scenarios.map((scenario) => scenario.id));
  for (const plan of CURATED_PLANS) assert.ok(seeded.has(plan.id), plan.id);
});

test("uncurated Scenarios take the next free numbers", () => {
  const scenarios = [
    ...INITIAL_STATE.scenarios,
    { id: "someones-copy" },
    { id: "an-adopted-fork" },
  ];
  assert.equal(planLetter("someones-copy", scenarios), "5");
  assert.equal(planLetter("an-adopted-fork", scenarios), "6");
});

test("Scenario 1 is Adeline's pick", () => {
  assert.equal(planLetter(ADELINE_SCENARIO.id, INITIAL_STATE.scenarios), "1");
  assert.equal(
    planTitle("1", ADELINE_SCENARIO.name),
    "Scenario 1 · Adeline's pick — west to east",
  );
  const plan = curatedPlanBySlug("adeline-west-to-east");
  assert.equal(plan?.id, ADELINE_SCENARIO.id);
});

test("every curated plan has a write-up on disk", () => {
  for (const plan of CURATED_PLANS) {
    assert.ok(plan.writeup, plan.id);
    assert.ok(existsSync(path.join(process.cwd(), "content", "plans", plan.writeup.file)));
  }
});

test("Scenario 1's calendar follows the written weeks, west to east", () => {
  const plan = buildPlan(
    ADELINE_SCENARIO.input,
    capsuleCatalogue(ADELINE_SCENARIO.input.toggled),
  );
  assert.deepEqual(plan.unplaced, []);
  const blocks = plan.placements.map((placement) => [
    placement.capsuleId,
    placement.startDate,
    placement.days,
  ]);
  assert.deepEqual(blocks, [
    ["margaret-river", "2026-12-16", 7],
    ["perth-city-kings-park-cottesloe-and-boola-bardip", "2026-12-23", 7],
    ["sydney-nye", "2026-12-30", 7],
    ["huon-valley-cygnet-huonville-cider-and-orchards", "2027-01-06", 14],
    ["tasmania-arc", "2027-01-20", 14],
    ["byron-nimbin", "2027-02-03", 10],
  ]);
  // Nothing overlaps: one base at a time, as written.
  assert.ok(plan.placements.every((placement) => placement.overlaps.length === 0));
});
