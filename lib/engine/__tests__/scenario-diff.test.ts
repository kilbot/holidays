/**
 * The diff derivation, against the three seeded Scenarios.
 *
 * These are the rows `/scenarios` shows under each name, so the tests are
 * written as the claims the page makes out loud: "Comfortable is about €3.2k
 * cheaper and keeps all 73 days", "Aggressive is fourteen days shorter". If the
 * seeds change, these fail — which is the intent. The page's summary is derived
 * from the inputs precisely so it cannot drift from them, and a test that
 * tolerated any answer would give that away.
 *
 * The money and day figures come through `scenarioTotals`, the same call the
 * page makes, so the numbers asserted here are the numbers rendered.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { capsuleCatalogue } from "@/lib/engine/capsules";
import { EMPTY_INPUT } from "@/lib/engine/plan";
import {
  AGGRESSIVE_SCENARIO,
  COMFORTABLE_SCENARIO,
  DEFAULT_SCENARIO,
  INITIAL_STATE,
} from "@/lib/engine/scenario-doc";
import {
  diffChangeCount,
  diffScenarios,
  formatSigned,
  formatSignedEur,
  type DiffSubject,
} from "@/lib/engine/scenario-diff";
import { scenarioTotals } from "@/lib/engine/scenarios";
import type { PlanInput } from "@/lib/engine/types";

/* ------------------------------------------------------------------ */
/* Subjects, built exactly as the page builds them                     */
/* ------------------------------------------------------------------ */

const catalogueIds = [
  ...new Set(INITIAL_STATE.scenarios.flatMap((s) => s.input.toggled)),
].sort();

const totals = scenarioTotals(INITIAL_STATE, capsuleCatalogue(catalogueIds));

function subject(id: string): DiffSubject {
  const scenario = INITIAL_STATE.scenarios.find((s) => s.id === id);
  const total = totals.find((t) => t.id === id);
  assert.ok(scenario && total, `seeded Scenario ${id} is missing`);
  return {
    input: scenario.input,
    totalEur: total.totalEur,
    dayCount: total.dayCount,
  };
}

const fireworks = subject(DEFAULT_SCENARIO.id);
const comfortable = subject(COMFORTABLE_SCENARIO.id);
const aggressive = subject(AGGRESSIVE_SCENARIO.id);

/** A subject over a bare input, for the unit cases below. */
const bare = (input: Partial<PlanInput>): DiffSubject => ({
  input: { ...EMPTY_INPUT, ...input },
  totalEur: 0,
  dayCount: 0,
});

/* ------------------------------------------------------------------ */
/* A Scenario against itself                                           */
/* ------------------------------------------------------------------ */

test("a Scenario read against itself differs in nothing", () => {
  const diff = diffScenarios(fireworks, fireworks);
  assert.equal(diff.identical, true);
  assert.equal(diff.eur, 0);
  assert.equal(diff.days, 0);
  assert.equal(diffChangeCount(diff), 0);
});

test("live fares are not a Scenario decision, so they are not a difference", () => {
  // The same trip, one copy carrying the fares this tab happened to fetch.
  const withFares = bare({
    toggled: ["a"],
    fareOverrides: { "syd-mel-2027-01-04": 412 },
  });
  const without = bare({ toggled: ["a"] });
  assert.equal(diffScenarios(withFares, without).identical, true);
});

test("writing a default explicitly is not a change", () => {
  const stated = bare({ contingency: true, eventOverrides: { "tas-tasman": true } });
  const silent = bare({});
  const diff = diffScenarios(stated, silent);
  assert.equal(diff.contingencyChanged, false);
  assert.deepEqual(diff.eventsOff, []);
  assert.deepEqual(diff.eventsRepriced, []);
});

/* ------------------------------------------------------------------ */
/* Comfortable, against the reference trip                             */
/* ------------------------------------------------------------------ */

test("Comfortable is cheaper than Fireworks NYE and keeps every day", () => {
  const diff = diffScenarios(comfortable, fireworks);

  assert.equal(diff.identical, false);
  assert.ok(
    diff.eur < -2_000,
    `expected Comfortable at least €2,000 cheaper, got ${diff.eur}`,
  );
  // §5's promise: all 73 days survive. The savings are shape, not length.
  assert.equal(diff.days, 0);
  assert.equal(diff.datesMoved, false);
});

test("Comfortable adds the Perth city day and drops no Adventure", () => {
  const diff = diffScenarios(comfortable, fireworks);
  assert.deepEqual(diff.adventuresRemoved, []);
  assert.deepEqual(diff.adventuresAdded, [
    "perth-city-kings-park-cottesloe-and-boola-bardip",
  ]);
});

test("Comfortable's Event triage reads as two lines off and one re-priced", () => {
  const diff = diffScenarios(comfortable, fireworks);
  assert.deepEqual(diff.eventsOff, ["gbr-poseidon", "tas-tasman"]);
  assert.deepEqual(diff.eventsRepriced, ["tas-wineglass"]);
  assert.deepEqual(diff.eventsKept, []);
});

test("Comfortable's tents and drags are counted, not summed into the money", () => {
  const diff = diffScenarios(comfortable, fireworks);
  assert.deepEqual(diff.lodgingChanged, [
    "byron",
    "margaret-river",
    "tasmania-arc",
  ]);
  assert.deepEqual(diff.placementsChanged, [
    "perth-city-kings-park-cottesloe-and-boola-bardip",
    "sydney-nye",
  ]);
});

/* ------------------------------------------------------------------ */
/* Aggressive                                                          */
/* ------------------------------------------------------------------ */

test("Aggressive is shorter, cheaper, and says so through its dates", () => {
  const diff = diffScenarios(aggressive, fireworks);
  assert.equal(diff.datesMoved, true);
  assert.equal(diff.days, -14, "ending on 8 February costs a fortnight");
  assert.ok(
    diff.eur < diffScenarios(comfortable, fireworks).eur,
    "Aggressive is the cheaper of the two savings paths",
  );
});

test("Aggressive keeps all eight Adventures — what it drops is February", () => {
  const diff = diffScenarios(aggressive, fireworks);
  assert.deepEqual(diff.adventuresAdded, []);
  assert.deepEqual(diff.adventuresRemoved, []);
  assert.ok(diff.eventsOff.includes("mel-laneway"));
  assert.ok(diff.lodgingChanged.includes("sydney-nye"));
});

/* ------------------------------------------------------------------ */
/* Direction, both ways                                                */
/* ------------------------------------------------------------------ */

test("the diff is signed from the subject, so reversing it reverses it", () => {
  const forward = diffScenarios(comfortable, aggressive);
  const back = diffScenarios(aggressive, comfortable);

  assert.equal(forward.eur, -back.eur);
  assert.equal(forward.days, -back.days);
  assert.deepEqual(forward.adventuresAdded, back.adventuresRemoved);
  assert.deepEqual(forward.adventuresRemoved, back.adventuresAdded);
  assert.deepEqual(forward.eventsOff, back.eventsKept);
  assert.equal(diffChangeCount(forward), diffChangeCount(back));
});

/* ------------------------------------------------------------------ */
/* The knobs a Scenario carries on its own                             */
/* ------------------------------------------------------------------ */

test("the two global toggles are differences in their own right", () => {
  const stressed = bare({ fxStress: true, contingency: false });
  const diff = diffScenarios(stressed, bare({}));
  assert.equal(diff.fxStressChanged, true);
  assert.equal(diff.contingencyChanged, true);
  assert.equal(diff.identical, false);
  assert.equal(diffChangeCount(diff), 2);
});

test("a Leg driven instead of flown, and a car dropped, both count", () => {
  const diff = diffScenarios(
    bare({
      legModeOverrides: { "syd-mel": "drive" },
      carOverrides: { "margaret-river": false },
    }),
    bare({}),
  );
  assert.deepEqual(diff.legModesChanged, ["syd-mel"]);
  assert.deepEqual(diff.carsChanged, ["margaret-river"]);
});

/* ------------------------------------------------------------------ */
/* Signed figures                                                      */
/* ------------------------------------------------------------------ */

test("signed money carries a real minus sign and thousands separators", () => {
  assert.equal(formatSignedEur(1_240), "+€1,240");
  assert.equal(formatSignedEur(-3_237), "−€3,237");
  assert.equal(formatSignedEur(0), "€0");
  // Rounded to the euro, like every other figure on the site.
  assert.equal(formatSignedEur(-0.4), "€0");
  assert.equal(formatSignedEur(1_499.6), "+€1,500");
});

test("signed counts read as changes rather than as quantities", () => {
  assert.equal(formatSigned(3), "+3");
  assert.equal(formatSigned(-14), "−14");
  assert.equal(formatSigned(0), "0");
});
