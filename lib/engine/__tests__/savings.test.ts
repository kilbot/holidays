/**
 * The two savings Scenarios, reconciled against the audit that priced them.
 *
 * `docs/research/savings-menu-draft.md` (#65) worked out two complete
 * waterfalls by hand — Comfortable at €17,914 and Aggressive at €15,530 — and
 * the seeded Scenarios are supposed to *be* those waterfalls, expressed in
 * `PlanInput` and priced by the engine rather than by a spreadsheet.
 *
 * #54 then re-planned the trip out from under both waterfalls — new dates, a
 * Christmas that moved 370 km, a Tasmania that moved a fortnight — so the
 * reconciliation against the audit's own totals is retired below, with the
 * figures kept as a record and the claim that survives them asserted instead.
 * These still assert the things the audit promised would *survive* each path,
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

/**
 * The same Scenario with the Mundaring arrival block off.
 *
 * `savings-menu-draft.md` was written before the arrival block existed (#54),
 * so the audit's two waterfalls priced a Plan whose first days were Margaret
 * River. Reconciling today's total against that figure would be comparing two
 * different trips and calling the difference an error, so the reconciliation
 * takes the block back off and compares like with like. What the block costs is
 * then its own assertion, below, where it can be read rather than absorbed.
 */
const withoutArrival = (scenario: Scenario): Plan => {
  const toggled = scenario.input.toggled.filter(
    (id) => id !== "mundaring-arrival",
  );
  return buildPlan(
    { ...scenario.input, toggled },
    capsuleCatalogue(toggled),
  );
};

const on = (plan: Plan, date: string) =>
  plan.days.find((day) => day.date === date);

const hasEvent = (plan: Plan, id: string) =>
  plan.days.some((day) => day.lines.some((line) => line.id.endsWith(`:${id}`)));

/* ------------------------------------------------------------------ */
/* The three totals                                                    */
/* ------------------------------------------------------------------ */

/**
 * The audit's two figures, kept as a record rather than as a target.
 *
 * `savings-menu-draft.md` (#65) priced Comfortable at €17,914 and Aggressive at
 * €15,530 against a 12 Dec – 22 Feb trip whose Christmas was a Perth Buffer
 * day, whose Tasmania sat in mid-January and whose January middle was eleven
 * idle days in Sydney. #54 re-planned all four of those things, so those totals
 * now describe a trip that does not exist, and asserting today's engine against
 * them would be asserting that the re-plan never happened.
 *
 * They are recorded here because the audit is still the reason these two
 * Scenarios have the levers they have, and because a reader who finds €17,914
 * in the research needs to be told, in the place they would go looking, why the
 * site says something else. What is asserted instead is the thing the audit was
 * actually for: that each path is a real, ordered, large saving against the
 * ceiling.
 */
const AUDIT_EUR = { comfortable: 17_914, aggressive: 15_530 };

/**
 * The one adjustment the audit needs, because it is older than the arithmetic:
 * kilbot/holidays#90's fare re-basis.
 *
 * Every waterfall in `savings-menu-draft.md` was computed while the two ocean
 * crossings were charged as a single €1,900-per-person **return** on the
 * outbound Leg, with the homecoming carrying nothing. They are now priced per
 * crossing — five-eighths of that snapshot out, and the homeward Leg from its
 * own source, which is `longhaul-comfort.md`'s band rather than a snapshot
 * because no MEL–VLC snapshot exists. That is €300 off plan-on, €330 with the
 * 10% contingency on top, and it is the **same** €330 for all three Scenarios
 * because all three fly the same two crossings — which is its own test, below.
 *
 * Named rather than folded into a wider tolerance: the €150 band is what says
 * "the engine and the spreadsheet agree", and widening it to swallow a known,
 * explainable change would retire the only test that can catch an unknown one.
 */
const FARE_REBASIS_EUR = 330;

test("Aggressive still lands within €150 of the audit's €15,530, less the fare re-basis", () => {
  // The one waterfall the re-plan left standing, and it is not luck: Aggressive
  // was always the shortest, flattest version — every eligible block camped,
  // a hostel twin on the harbour, no cruises — so moving the *shape* of the
  // trip moved it least. The one adjustment is the crossings, above.
  const expected = AUDIT_EUR.aggressive - FARE_REBASIS_EUR;
  const drift = Math.abs(aggressive.rollUp.totalEur - expected);
  assert.ok(
    drift <= TOLERANCE_EUR,
    `engine says €${Math.round(aggressive.rollUp.totalEur)}, audit says €${AUDIT_EUR.aggressive} less €${FARE_REBASIS_EUR} = €${expected} — €${Math.round(drift)} apart`,
  );
});

test("Comfortable has left the audit behind, and the re-plan is why", () => {
  // €17,914 priced eleven idle post-NYE days in Sydney, and re-homing them to
  // Perth was this Scenario's largest single lever. #54 spends four days there
  // instead, so most of that lever is now in the ceiling itself — the gap is
  // the re-plan, not an error, and it is recorded rather than papered over.
  const drift = AUDIT_EUR.comfortable - comfortable.rollUp.totalEur;
  assert.ok(
    drift > TOLERANCE_EUR,
    `€${Math.round(comfortable.rollUp.totalEur)} is within €${TOLERANCE_EUR} of the audit again — if the trips have converged, reinstate the reconciliation`,
  );
  assert.ok(
    comfortable.rollUp.totalEur < AUDIT_EUR.comfortable,
    "and the re-plan made it cheaper, not dearer",
  );
});

/**
 * The arrival block is a rounding, whichever way it falls.
 *
 * It does not add days, it displaces them, so its effect on a total is whatever
 * the re-plan around it comes to — a rise when it pushes Margaret River into
 * more paid nights, a fall when it takes them out. Both have been true during
 * #54. The assertion worth keeping is the magnitude: this is noise on a €19,000
 * trip and not a lever, and a golden number here would only have to be re-typed
 * every time the rate card or the calendar moves.
 */
test("the arrival block is a re-plan, not a lever", () => {
  for (const [name, scenario, priced_] of [
    ["default", DEFAULT_SCENARIO, base],
    ["comfortable", COMFORTABLE_SCENARIO, comfortable],
    ["aggressive", AGGRESSIVE_SCENARIO, aggressive],
  ] as const) {
    const delta = Math.abs(
      priced_.rollUp.totalEur - withoutArrival(scenario).rollUp.totalEur,
    );
    assert.ok(
      delta < 250,
      `${name}: €${Math.round(delta)} is too big to call a re-plan`,
    );
  }
});

test("all three Scenarios fly the same two crossings, priced the same way", () => {
  // The claim `FARE_REBASIS_EUR` rests on: #90 is a constant offset across the
  // ladder rather than a per-Scenario correction, because every Scenario pays
  // for the same journey out and the same journey home. If one ever changes
  // where it flies home from, this is what says so.
  const crossings = (plan: Plan) =>
    plan.legs
      .filter(
        (leg) => leg.fromLocationId === "origin" || leg.toLocationId === "origin",
      )
      .map((leg) => Math.round(leg.eur));

  assert.deepEqual(crossings(comfortable), crossings(base));
  assert.deepEqual(crossings(aggressive), crossings(base));
});

test("both paths clear the A$10,000 target the ticket set", () => {
  // #65: cut at least A$10,000 ≈ €6,100 from the default Plan. The floors did
  // most of it before either Scenario made a single choice.
  // The gap narrowed on #54 and the reason is worth knowing: Comfortable's
  // biggest lever was re-homing eleven idle post-NYE Sydney days to Perth, and
  // the default now spends four days there rather than eleven. The lever is
  // still real; there is simply less of it left to pull.
  assert.ok(
    base.rollUp.totalEur - comfortable.rollUp.totalEur > 2_000,
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

test("Comfortable keeps every day the ceiling has, and every Adventure", () => {
  assert.equal(comfortable.endDate, "2027-02-14");
  assert.equal(comfortable.dayCount, base.dayCount, "the same calendar");
  // Laneway is gone from every Scenario since the return moved in to 14
  // February: the festival is on the 19th and the trip is home. That is a
  // consequence of the couple's own date, not of this savings path.
  assert.equal(hasEvent(comfortable, "mel-laneway"), false);
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
  // Comfortable has *more* Buffer days than the ceiling, not fewer, and every
  // one of them is a decision: the Perth block claims three, and the blocks
  // Comfortable does not buy — the two WA evenings and the four Far North
  // Queensland ideas — hand theirs back. Derived rather than written down, so
  // it stays true when the shape of either Scenario moves again.
  const handedBack = base.placements
    .filter(
      (placement) =>
        !COMFORTABLE_SCENARIO.input.toggled.includes(placement.capsuleId),
    )
    .reduce((total, placement) => total + placement.days, 0);
  assert.ok(handedBack > 0, "the ceiling buys blocks this path does not");

  // The Perth block is the one this path buys and the ceiling does not.
  const bought = comfortable.placements
    .filter(
      (placement) =>
        !base.placements.some(
          (entry) => entry.capsuleId === placement.capsuleId,
        ),
    )
    .reduce((total, placement) => total + placement.days, 0);
  assert.ok(bought > 0, "and this path buys one the ceiling does not");

  // …and a block on both paths can be a different length on each. The
  // reference trip's WA sequence (#95) trims the arrival block and Christmas
  // to their published floor rungs and gives Sydney a seventh night; this path
  // keeps the researched lengths, so the difference is counted rather than
  // assumed away.
  const stretched = comfortable.placements.reduce((total, placement) => {
    const held = base.placements.find(
      (entry) => entry.capsuleId === placement.capsuleId,
    );
    return held ? total + (placement.days - held.days) : total;
  }, 0);

  assert.equal(
    comfortable.days.filter((day) => day.buffer).length,
    base.days.filter((day) => day.buffer).length +
      handedBack -
      bought -
      stretched,
    "the Perth block, the blocks Comfortable does not buy and the lengths that differ account for all of it",
  );
});

test("Aggressive keeps all ten Adventures and loses February", () => {
  assert.equal(aggressive.endDate, "2027-02-08");
  assert.equal(aggressive.placements.length, 10);
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

test("the WA leg runs in the order the couple asked for", () => {
  // #95, from the live map: *arrive Perth → Mundaring base, with the Perth and
  // Fremantle days driven in from it → Margaret River → Rottnest → Morawa for
  // Christmas → back to Perth → fly east.* Asserted as the sequence of places
  // rather than as dates, so the Scheduler is free to reflow it when the
  // leaving date moves and this still says what the couple said.
  const sequence: string[] = [];
  for (const day of base.days) {
    if (day.date > "2026-12-28") break;
    if (day.locationId === "transit") continue;
    if (sequence[sequence.length - 1] !== day.locationId) {
      sequence.push(day.locationId);
    }
  }

  assert.deepEqual(sequence, [
    "mundaring",
    "perth", // the Fremantle evening and the Northbridge gig, from the Hills
    "margaret-river",
    "rottnest",
    "morawa",
    "perth", // back down the Midlands road on Boxing Day
    "sydney",
  ]);

  // Christmas Day is at the sister's farm, which is the whole point of the
  // block and the one date in the sequence that cannot move.
  const christmas = base.days.find((day) => day.date === "2026-12-25");
  assert.equal(christmas?.locationId, "morawa");

  // And the flight east leaves from Perth, the morning after the drive home.
  const east = base.legs.find((leg) => leg.to === "SYD");
  assert.ok(east);
  assert.equal(east.from, "PER");
  assert.equal(east.fromLocationId, "perth");
  assert.equal(east.date, "2026-12-27");
});

test("the default Scenario's shape is untouched by the recalibration", () => {
  // #64 re-prices the reference trip; it does not re-plan it. Same dates, same
  // Adventures, no overrides of any kind — only the rate card moved. The count
  // is nine since #54 added the Mundaring arrival block to every seed.
  assert.equal(DEFAULT_SCENARIO.input.startDate, "2026-12-14");
  assert.equal(DEFAULT_SCENARIO.input.endDate, "2027-02-14");
  // Ten researched Adventures, the two WA evenings and the four Far North
  // Queensland ideas #54 put on the bench.
  assert.equal(DEFAULT_SCENARIO.input.toggled.length, 16);
  // Still nothing dragged, nothing camped and no Event switched off: the
  // reference trip is shaped by Locks and dates, never by a drag. The knobs it
  // does hold are block **lengths** — Byron at its researched three-night
  // floor, which is the "more North Queensland" directive stated rather than
  // implied, and the three the WA sequence costs (#95).
  assert.deepEqual(DEFAULT_SCENARIO.input.placementOverrides, {});
  assert.deepEqual(DEFAULT_SCENARIO.input.lodgingTiers, {});
  assert.deepEqual(DEFAULT_SCENARIO.input.eventOverrides, {});
  assert.deepEqual(DEFAULT_SCENARIO.input.dayOverrides, {
    "byron-nimbin": 3,
    "mundaring-arrival": 2,
    "morawa-christmas": 3,
    "sydney-nye": 7,
  });
});
