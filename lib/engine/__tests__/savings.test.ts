/**
 * The two savings Scenarios, reconciled against the audit that priced them.
 *
 * `docs/research/savings-menu-draft.md` (#65) worked out two complete
 * waterfalls by hand — Comfortable at €17,914 and Aggressive at €15,530 — and
 * the seeded Scenarios are supposed to *be* those waterfalls, expressed in
 * `PlanInput` and priced by the engine rather than by a spreadsheet.
 *
 * These tests are the reconciliation. They assert the engine's own figure lands
 * within €150 of the audit's, which is the point of the exercise: if the two
 * disagree by more than a rounding, one of them is wrong and it matters which.
 * They also assert the things the audit promised would *survive* each path,
 * because a total that hits its target by quietly dropping New Year's Eve is
 * not the plan anybody agreed to.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { capsuleCatalogue } from "@/lib/engine/capsules";
import { buildPlan } from "@/lib/engine/plan";
import {
  AGGRESSIVE_SCENARIO,
  COMFORTABLE_SCENARIO,
  DEFAULT_SCENARIO,
  INITIAL_STATE,
  parseScenarioState,
  type Scenario,
} from "@/lib/engine/scenario-doc";
import type { Plan } from "@/lib/engine/types";

/** How far the engine may sit from the audit before somebody has to explain. */
const TOLERANCE_EUR = 150;

const priced = (scenario: Scenario): Plan =>
  buildPlan(scenario.input, capsuleCatalogue(scenario.input.toggled));

const base = priced(DEFAULT_SCENARIO);
const comfortable = priced(COMFORTABLE_SCENARIO);
const aggressive = priced(AGGRESSIVE_SCENARIO);

const on = (plan: Plan, date: string) =>
  plan.days.find((day) => day.date === date);

const hasEvent = (plan: Plan, id: string) =>
  plan.days.some((day) => day.lines.some((line) => line.id.endsWith(`:${id}`)));

/* ------------------------------------------------------------------ */
/* The three totals                                                    */
/* ------------------------------------------------------------------ */

test("Comfortable lands within €150 of the audit's €17,914", () => {
  const drift = Math.abs(comfortable.rollUp.totalEur - 17_914);
  assert.ok(
    drift <= TOLERANCE_EUR,
    `engine says €${Math.round(comfortable.rollUp.totalEur)}, audit says €17,914 — €${Math.round(drift)} apart`,
  );
});

test("Aggressive lands within €150 of the audit's €15,530", () => {
  const drift = Math.abs(aggressive.rollUp.totalEur - 15_530);
  assert.ok(
    drift <= TOLERANCE_EUR,
    `engine says €${Math.round(aggressive.rollUp.totalEur)}, audit says €15,530 — €${Math.round(drift)} apart`,
  );
});

test("both paths clear the A$10,000 target the ticket set", () => {
  // #65: cut at least A$10,000 ≈ €6,100 from the default Plan. The floors did
  // most of it before either Scenario made a single choice.
  assert.ok(
    base.rollUp.totalEur - comfortable.rollUp.totalEur > 3_000,
    "Comfortable is meaningfully cheaper than the reference trip",
  );
  assert.ok(
    aggressive.rollUp.totalEur < comfortable.rollUp.totalEur,
    "and Aggressive is cheaper again",
  );
  assert.ok(
    comfortable.rollUp.totalEur < 18_441,
    "the ticket's own ≤€18,441 target, measured on the total the HUD shows",
  );
});

test("the ladder is strictly ordered — default, Comfortable, Aggressive", () => {
  const totals = [
    base.rollUp.totalEur,
    comfortable.rollUp.totalEur,
    aggressive.rollUp.totalEur,
  ];
  assert.deepEqual(totals, [...totals].sort((a, b) => b - a));
});

/* ------------------------------------------------------------------ */
/* What each path keeps                                                */
/* ------------------------------------------------------------------ */

test("every seeded Scenario honours both hard Anchors", () => {
  for (const [name, plan] of [
    ["default", base],
    ["comfortable", comfortable],
    ["aggressive", aggressive],
  ] as const) {
    assert.equal(on(plan, "2026-12-25")?.homeBase, true, `${name}: Christmas`);
    assert.equal(on(plan, "2026-12-31")?.locationId, "sydney", `${name}: NYE`);
    assert.equal(
      plan.warnings.filter((warning) => warning.kind === "anchor-missed").length,
      0,
      name,
    );
    assert.deepEqual(plan.unplaced, [], `${name}: nothing dropped off`);
  }
});

test("New Year's Eve is charged to New Year's Eve, in every Scenario", () => {
  // The reshaped block starts on 30 December. Before the date-pin this line
  // landed on 1 January there and on 30 December in the default Plan.
  for (const plan of [base, comfortable, aggressive]) {
    const nye = on(plan, "2026-12-31");
    assert.ok(
      nye?.lines.some((line) => line.id.endsWith(":nye-night")),
      `the vantage point is on the 31st, not ${plan.startDate}+2`,
    );
  }
});

test("Comfortable keeps the Melbourne festival weekend and the 22 Feb ending", () => {
  assert.equal(comfortable.endDate, "2027-02-22");
  assert.equal(comfortable.dayCount, base.dayCount, "all 73 days survive");
  assert.ok(hasEvent(comfortable, "mel-laneway"), "Laneway is still bought");
  assert.ok(hasEvent(comfortable, "gbr-wavelength"), "one reef day survives");
  assert.ok(hasEvent(comfortable, "gbr-rainforest"), "and the rainforest day");
  assert.ok(hasEvent(comfortable, "tas-mona"), "MONA survives");
  assert.ok(hasEvent(comfortable, "byron-surf"), "the surf lesson survives");
  assert.ok(hasEvent(comfortable, "rotto-ferry"), "Rottnest survives");
});

test("Comfortable gives up exactly the three boat lines it says it does", () => {
  assert.equal(hasEvent(comfortable, "gbr-poseidon"), false, "reef day II");
  assert.equal(hasEvent(comfortable, "tas-tasman"), false, "Tasman Island");

  const bruny = comfortable.days
    .flatMap((day) => day.lines)
    .find((line) => line.id.endsWith(":tas-wineglass"));
  assert.ok(bruny, "the Tasmania boat day is still a day");
  assert.equal(bruny.aud, 51, "swapped for the Bruny Island ferry");
});

test("Comfortable re-homes the post-NYE gap without teleporting", () => {
  const january = comfortable.days.filter(
    (day) => day.date >= "2027-01-05" && day.date <= "2027-01-12",
  );
  const home = january.filter((day) => day.homeBase);
  assert.ok(home.length >= 6, `${home.length} of those days are at a Home base`);

  // Buffers move; they do not vanish. The trip is the same length and the two
  // extra flights are on the Plan, priced.
  const west = comfortable.legs.find(
    (leg) => leg.fromLocationId === "sydney" && leg.toLocationId === "perth",
  );
  assert.ok(west, "the flight west is a real Leg");
  assert.ok(west.eur > 0, "and it is not free");
  assert.equal(
    comfortable.days.filter((day) => day.buffer).length,
    base.days.filter((day) => day.buffer).length - 3,
    "the three-day Perth block is the only thing that stopped being a Buffer",
  );
});

test("Aggressive keeps all eight Adventures and loses February", () => {
  assert.equal(aggressive.endDate, "2027-02-08");
  assert.equal(aggressive.placements.length, 8);
  assert.equal(
    hasEvent(aggressive, "mel-laneway"),
    false,
    "no festival to buy a ticket for",
  );
  // The Melbourne block is off its own date-Lock and the Plan says so rather
  // than silently pretending the weekend still works.
  assert.ok(
    aggressive.warnings.some(
      (warning) =>
        warning.kind === "lock-violated" && warning.capsuleId === "melbourne-party",
    ),
    "the Warning is the honest part",
  );
});

test("Aggressive camps everywhere the research offers a tent, and nowhere else", () => {
  const camping = aggressive.days.filter((day) => day.lodgingTier === "camp");
  assert.ok(camping.length > 20, `${camping.length} nights under canvas`);
  for (const day of camping) {
    assert.notEqual(day.market, "sydney", "no tent on the harbour");
    assert.notEqual(day.market, "melbourne");
  }

  const sydney = aggressive.days.filter((day) => day.market === "sydney");
  assert.ok(sydney.length > 0);
  for (const day of sydney) {
    assert.equal(day.lodgingTier, "hostel", `${day.date} is a hostel twin`);
  }
});

/* ------------------------------------------------------------------ */
/* Seeding                                                             */
/* ------------------------------------------------------------------ */

test("a fresh browser gets all three Scenarios, with the reference trip current", () => {
  assert.deepEqual(
    INITIAL_STATE.scenarios.map((scenario) => scenario.id),
    ["fireworks-nye", "comfortable-10k", "aggressive-15k"],
  );
  assert.equal(INITIAL_STATE.currentId, DEFAULT_SCENARIO.id);
});

test("the seeded state survives a round trip through the parser", () => {
  const reparsed = parseScenarioState(JSON.parse(JSON.stringify(INITIAL_STATE)));
  assert.deepEqual(reparsed, INITIAL_STATE);

  // And prices identically on the far side, which is the only claim that
  // matters: a Scenario is a saved input and nothing else.
  for (const scenario of reparsed.scenarios) {
    const before = INITIAL_STATE.scenarios.find(
      (entry) => entry.id === scenario.id,
    );
    assert.ok(before);
    assert.equal(priced(scenario).rollUp.totalEur, priced(before).rollUp.totalEur);
  }
});

test("the default Scenario's shape is untouched by the recalibration", () => {
  // #64 re-prices the reference trip; it does not re-plan it. Same dates, same
  // eight Adventures, no overrides of any kind — only the rate card moved.
  assert.equal(DEFAULT_SCENARIO.input.startDate, "2026-12-12");
  assert.equal(DEFAULT_SCENARIO.input.endDate, "2027-02-22");
  assert.equal(DEFAULT_SCENARIO.input.toggled.length, 8);
  assert.deepEqual(DEFAULT_SCENARIO.input.placementOverrides, {});
  assert.deepEqual(DEFAULT_SCENARIO.input.lodgingTiers, {});
  assert.deepEqual(DEFAULT_SCENARIO.input.eventOverrides, {});
});
