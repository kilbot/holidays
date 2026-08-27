/**
 * The recalibrated floors — `docs/research/cost-floors-recalibrated.md` (#64).
 *
 * These assert the *shape* of the rate card and the rules that hang off it,
 * not every figure in it: a test that restates A$140 is a second copy of the
 * constant, and it fails when the October re-snapshot moves it, which is the
 * moment the constant is *supposed* to move. What is worth locking down is the
 * behaviour the recalibration introduced —
 *
 * - camping exists, and only where the research offers it;
 * - a tier a market does not offer is repaired to the default, never crashed on
 *   and never guessed at;
 * - the ladder inside every market still climbs;
 * - the Adventure cards and the ledger quote the same figure, which is the
 *   whole reason the recalibration happened.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { capsuleCatalogue } from "@/lib/engine/capsules";
import {
  DEFAULT_LODGING_TIER,
  LODGING_TIERS,
  MARKETS,
  homeBaseDayDeltaAud,
  lodgingRate,
  lodgingTiersFor,
  type MarketId,
} from "@/lib/engine/constants";
import { buildPlan } from "@/lib/engine/plan";
import { DEFAULT_SCENARIO } from "@/lib/engine/scenario-doc";
import { DEEP_CAPSULES, costLadder } from "@/lib/deep-capsules";
import { WINDOW_END } from "@/lib/trip-dates";

const PAID: MarketId[] = [
  "sydney",
  "melbourne",
  "hobart",
  "cairns",
  "regional",
];

/* ------------------------------------------------------------------ */
/* The camping tier                                                    */
/* ------------------------------------------------------------------ */

test("camping is offered on the road-trip markets and nowhere else", () => {
  // cost-floors-recalibrated.md §3.4. Sydney and Melbourne have metropolitan
  // holiday parks and they are an hour from what those blocks are for.
  const camps = PAID.filter((market) => lodgingTiersFor(market).includes("camp"));
  assert.deepEqual(camps.sort(), ["cairns", "hobart", "regional"]);
});

test("a camping night is the cheapest paid bed in its market", () => {
  for (const market of PAID) {
    const tiers = lodgingTiersFor(market);
    if (!tiers.includes("camp")) continue;
    const camp = lodgingRate(market, "camp").rate.plan;
    for (const tier of tiers) {
      if (tier === "camp") continue;
      assert.ok(
        camp < lodgingRate(market, tier).rate.plan,
        `${market}: camp A$${camp} should undercut ${tier}`,
      );
    }
  }
});

test("asking for a tier a market does not offer repairs to the default", () => {
  const asked = lodgingRate("sydney", "camp");
  assert.equal(asked.tier, DEFAULT_LODGING_TIER, "no tent on the harbour");
  assert.equal(asked.substituted, true);
  assert.equal(asked.rate.plan, lodgingRate("sydney", "airbnb").rate.plan);
});

test("every market's ladder climbs, and every rate carries a band", () => {
  for (const id of Object.keys(MARKETS) as MarketId[]) {
    const offered = lodgingTiersFor(id);
    assert.ok(offered.includes(DEFAULT_LODGING_TIER), `${id} has a default`);

    let last = -1;
    for (const tier of offered) {
      const { rate } = lodgingRate(id, tier);
      assert.ok(rate.plan >= last, `${id}: ${tier} breaks the ladder`);
      assert.ok(rate.band[0] <= rate.plan, `${id}/${tier} band floor`);
      assert.ok(rate.band[1] >= rate.plan, `${id}/${tier} band ceiling`);
      last = rate.plan;
    }
  }
});

test("LODGING_TIERS is the whole vocabulary, cheapest first", () => {
  assert.deepEqual([...LODGING_TIERS], ["camp", "hostel", "airbnb", "hotel"]);
});

/* ------------------------------------------------------------------ */
/* The food floor                                                      */
/* ------------------------------------------------------------------ */

test("a paid-market food day costs less than a lodging night, and says why", () => {
  for (const market of PAID) {
    const food = MARKETS[market].food;
    assert.ok(
      food.plan < lodgingRate(market, DEFAULT_LODGING_TIER).rate.plan,
      `${market}: a day's food should not out-cost a night's bed`,
    );
    // §4 lets a builder either couple the food rate to the lodging tier or
    // state the assumption. This is the second, and the note is the contract.
    assert.match(MARKETS[market].foodNote ?? "", /kitchen/i, market);
  }
});

test("a home-base day is still not free", () => {
  const home = MARKETS["home-base-city"];
  assert.equal(lodgingRate("home-base-city", "airbnb").rate.plan, 0);
  assert.ok(home.food.plan > 0, "groceries at the family house are groceries");
  assert.ok(home.local.plan > 0, "fuel is not free even when the car is");
});

/* ------------------------------------------------------------------ */
/* The headline lever, restated honestly                               */
/* ------------------------------------------------------------------ */

test("the home-base lever is derived from the rate card, not written down", () => {
  const delta = homeBaseDayDeltaAud();
  const sydney =
    lodgingRate("sydney", DEFAULT_LODGING_TIER).rate.plan +
    MARKETS.sydney.food.plan +
    MARKETS.sydney.local.plan;
  const perth =
    MARKETS["home-base-city"].food.plan + MARKETS["home-base-city"].local.plan;
  assert.equal(delta, sydney - perth);

  // #64 finding 5: the research's A$500 headline was a mid-tier figure. It is
  // still the biggest per-day lever in the model and it is not A$500 any more.
  assert.ok(delta > 100, "still the biggest single lever");
  assert.ok(delta < 300, "and no longer the A$500 the old copy promised");
});

/* ------------------------------------------------------------------ */
/* The card and the ledger agree                                       */
/* ------------------------------------------------------------------ */

/**
 * The default Scenario, run over a window wide enough for every Lock.
 *
 * The card-versus-ledger check below is a claim about the **Adventures**, not
 * about any one calendar: "the figure on the Margaret River card is the figure
 * the ledger charges for Margaret River". Since #54 moved the couple's return
 * in to 14 February, the default Plan no longer reaches Melbourne's 19–21
 * February festival weekend, so the block lands off its own date-Lock and the
 * Laneway line correctly drops — and comparing a card that includes Laneway to a
 * ledger that cannot buy it would be comparing two different questions.
 *
 * So this file prices the same toggles against the full trip window. The
 * shortened return is a decision about the trip, and `savings.test.ts` is where
 * that decision is asserted.
 */
const plan = buildPlan(
  { ...DEFAULT_SCENARIO.input, endDate: WINDOW_END },
  capsuleCatalogue(DEFAULT_SCENARIO.input.toggled),
);

/**
 * What the top rung of a ladder may be called.
 *
 * "As published" is the normal one and means the figure the Adventure's own
 * research document first wrote up. `mundaring-arrival` has no research
 * document — it comes from docs/CONTEXT.md's Anchor directive — so it has no
 * published figure to quote, and its ceiling is the same block taken as a
 * paying visitor instead. Both are ceilings; only one is a quotation, and the
 * label is where a reader is told which they are looking at.
 */
const CEILING_LABELS = ["As published", "If you paid for it"];

test("every Adventure's ladder reads floor → plan-on → ceiling", () => {
  for (const capsule of DEEP_CAPSULES) {
    const rungs = costLadder(capsule.cost);
    assert.ok(rungs.length >= 2, `${capsule.id} has a ladder`);
    assert.ok(
      CEILING_LABELS.includes(rungs.at(-1)?.label ?? ""),
      `${capsule.id}: top rung is "${rungs.at(-1)?.label}"`,
    );

    for (let i = 1; i < rungs.length; i += 1) {
      assert.ok(
        rungs[i].eur > rungs[i - 1].eur,
        `${capsule.id}: ${rungs[i].label} (€${rungs[i].eur}) should sit above ${rungs[i - 1].label} (€${rungs[i - 1].eur})`,
      );
    }

    const planOn = capsule.cost.ideal;
    // "Plan on", or "Plan on" with a word saying what the figure covers —
    // Rottnest's is "Plan on, ashore", because the SeaLink crossing is a Leg
    // and not part of the day the card is pricing (kilbot/holidays#101).
    assert.ok(
      planOn.label.startsWith("Plan on"),
      `${capsule.id}: middle rung is "${planOn.label}"`,
    );
    assert.equal(planOn.days, capsule.days.ideal, `${capsule.id} plan-on days`);
    assert.ok(
      planOn.eur < capsule.cost.max.eur,
      `${capsule.id}: the floor should undercut the published figure`,
    );
    // Every recalibrated rung is quoted in both currencies at the model's own
    // rate. The published rung keeps the research's own pair, rounding and
    // all — it is a quotation, not a calculation.
    for (const rung of rungs) {
      if (rung.band) continue;
      assert.ok(
        Math.abs(rung.aud * 0.61 - rung.eur) < 2,
        `${capsule.id}/${rung.label}: A$${rung.aud} ≠ €${rung.eur}`,
      );
    }
  }
});

test("the card's plan-on figure is what the Plan actually charges", () => {
  // The mismatch #64 was raised to kill: Margaret River said €1,375 on the card
  // and the ledger charged €888. Within €5 of the block's own Days and Events,
  // Legs excluded — they are their own line in the Plan.
  for (const placement of plan.placements) {
    const capsule = DEEP_CAPSULES.find((entry) => entry.id === placement.capsuleId);
    if (!capsule) continue;
    if (placement.days !== capsule.days.ideal) continue;

    const charged = plan.days
      .filter((day) => day.capsuleId === capsule.id)
      .reduce(
        (total, day) =>
          total +
          day.lines
            .filter((entry) => entry.kind !== "transport")
            .reduce((sum, entry) => sum + entry.eur, 0),
        0,
      );

    assert.ok(
      Math.abs(charged - capsule.cost.ideal.eur) <= 5,
      `${capsule.id}: card says €${capsule.cost.ideal.eur}, ledger charges €${Math.round(charged)}`,
    );
  }
});

test("the recalibration removed the Plan's only Daily-cap breach", () => {
  // #64 finding 1: the four NYE nights priced at A$602–615 of living cost
  // against a A$500 ceiling — the only breach in the default Plan, and the
  // right one to lose, because the cap is a ceiling the Plan was never meant
  // to touch.
  assert.deepEqual(
    plan.warnings.filter((warning) => warning.kind === "daily-cap"),
    [],
  );
});
