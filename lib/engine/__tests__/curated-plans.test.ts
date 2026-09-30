/**
 * The lettered Plans (2026-09-30): Scenarios are curated, not created on the
 * site, so each seeded Scenario carries a fixed letter, and a Plan written as a
 * brief keeps its write-up.
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

test("every seeded Scenario has a letter, in the order they were made", () => {
  assert.deepEqual(
    INITIAL_STATE.scenarios.map((scenario) =>
      planLetter(scenario.id, INITIAL_STATE.scenarios),
    ),
    ["A", "B", "C", "D"],
  );
});

test("letters are unique and every curated Plan is a seeded Scenario", () => {
  const letters = CURATED_PLANS.map((plan) => plan.letter);
  assert.equal(new Set(letters).size, letters.length);
  const seeded = new Set(INITIAL_STATE.scenarios.map((scenario) => scenario.id));
  for (const plan of CURATED_PLANS) assert.ok(seeded.has(plan.id), plan.id);
});

test("a Scenario from before the letters takes the next free one", () => {
  const scenarios = [
    ...INITIAL_STATE.scenarios,
    { id: "someones-copy" },
    { id: "an-adopted-fork" },
  ];
  assert.equal(planLetter("someones-copy", scenarios), "E");
  assert.equal(planLetter("an-adopted-fork", scenarios), "F");
});

test("Plan D is Adeline's pick, and its write-up is on disk", () => {
  assert.equal(planLetter(ADELINE_SCENARIO.id, INITIAL_STATE.scenarios), "D");
  assert.equal(
    planTitle("D", ADELINE_SCENARIO.name),
    "Plan D · Adeline's pick — west to east",
  );
  const plan = curatedPlanBySlug("plan-d");
  assert.equal(plan?.id, ADELINE_SCENARIO.id);
  assert.ok(
    existsSync(path.join(process.cwd(), "content", "plans", plan!.writeup!.file)),
  );
});

test("Plan D's calendar follows the written weeks, west to east", () => {
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
