/**
 * Ledger tests — the Day is the unit, and the total is the sum of the Days.
 *
 * Run with `npm test`. See `alias-hook.mjs` for why no test framework is
 * needed to do it.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  AUD_TO_EUR,
  AUD_TO_EUR_STRESS,
  lodgingRate,
} from "@/lib/engine/constants";
import { buildPlan } from "@/lib/engine/plan";
import { cents } from "@/lib/engine/ledger";
import { FIXED, FIXTURES, WINDOWED, input } from "@/lib/engine/__tests__/fixtures";

test("a Home-base day pays no lodging, and still pays for food and fuel", () => {
  const plan = buildPlan(
    input({ toggled: ["weekdayed"], startDate: "2026-12-20", endDate: "2026-12-27" }),
    FIXTURES,
  );

  const perthDay = plan.days.find((day) => day.locationId === "perth");
  assert.ok(perthDay, "the Saturday Capsule should put a Day in Perth");

  const lodging = perthDay.lines.find((line) => line.kind === "lodging");
  assert.equal(lodging?.eur, 0, "Home base is free lodging");

  const food = perthDay.lines.find((line) => line.kind === "food");
  assert.ok(food && food.eur > 0, "food is never free");

  const local = perthDay.lines.find((line) => line.kind === "local");
  assert.ok(local && local.eur > 0, "fuel is not free even in a borrowed car");
});

test("the peak multiplier hits only the nights it covers", () => {
  const plan = buildPlan(
    input({
      toggled: ["fixed"],
      startDate: "2026-12-26",
      endDate: "2027-01-10",
      placementOverrides: { fixed: "2026-12-29" },
    }),
    FIXTURES,
  );

  const lodgingOn = (date: string) =>
    plan.days
      .find((day) => day.date === date)
      ?.lines.find((line) => line.kind === "lodging")?.eur ?? 0;

  // 29 Dec – 1 Jan is the NYE block in Sydney: ×2.5. 2 January is not.
  const nye = lodgingOn("2026-12-31");
  const after = lodgingOn("2027-01-02");
  assert.ok(nye > 0 && after > 0);
  assert.ok(
    nye > after * 2,
    `NYE lodging (€${nye}) should be more than double an ordinary January night (€${after})`,
  );

  const sydneyAirbnb = lodgingRate("sydney", "airbnb").rate.plan;
  assert.equal(nye, cents(sydneyAirbnb * 2.5 * AUD_TO_EUR));
  // 2 January falls in the school-holiday rule, ×1.2.
  assert.equal(after, cents(sydneyAirbnb * 1.2 * AUD_TO_EUR));
});

test("the Plan total is exactly the sum of its Days", () => {
  const plan = buildPlan(input({ toggled: [...FIXTURES.map((c) => c.id)] }), FIXTURES);

  const summed = cents(
    plan.days.reduce((total, day) => total + day.totalEur, 0),
  );
  assert.equal(plan.rollUp.planOnEur, summed);

  // And the splits are a partition of the same lines, not a second estimate.
  const splits = cents(
    plan.rollUp.splits.reduce((total, split) => total + split.amountEur, 0),
  );
  assert.equal(splits, plan.rollUp.planOnEur);
});

test("a Day's own total is exactly the sum of its lines", () => {
  const plan = buildPlan(input({ toggled: ["fixed", "windowed"] }), FIXTURES);

  for (const day of plan.days) {
    const summed = cents(day.lines.reduce((total, line) => total + line.eur, 0));
    assert.equal(day.totalEur, summed, `${day.date} does not add up`);
  }
});

test("the Daily cap measures living lines only, never Event spend", () => {
  const plan = buildPlan(
    input({ toggled: ["fixed"], placementOverrides: { fixed: "2026-12-29" } }),
    FIXTURES,
  );

  const eventDay = plan.days.find((day) =>
    day.lines.some((line) => line.id.endsWith("fixed-event")),
  );
  assert.ok(eventDay, "the fixture Capsule places an Event line");

  const living = cents(
    eventDay.lines
      .filter((line) => line.living)
      .reduce((total, line) => total + line.eur, 0),
  );
  assert.equal(eventDay.livingEur, living);
  assert.ok(
    eventDay.totalEur > eventDay.livingEur,
    "the Event line is in the Day total and out of the cap",
  );
});

test("Buffer days are priced, not free", () => {
  const plan = buildPlan(input({ toggled: ["fixed"] }), FIXTURES);

  const buffers = plan.days.filter((day) => day.buffer);
  assert.ok(buffers.length > 0, "a 44-day trip with one 4-day Capsule has Buffers");
  assert.ok(
    plan.rollUp.bufferEur > 0,
    "Buffer days still cost lodging and food wherever they land",
  );
  assert.equal(plan.rollUp.bufferDays, buffers.length);
});

test("the FX stress toggle moves the AUD lines and leaves the fares alone", () => {
  const base = buildPlan(input({ toggled: ["windowed"] }), FIXTURES);
  const stressed = buildPlan(
    input({ toggled: ["windowed"], fxStress: true }),
    FIXTURES,
  );

  const audLine = (plan: typeof base) =>
    plan.days[5].lines.find((line) => line.kind === "food");

  const amount = audLine(base)?.aud ?? 0;
  assert.ok(amount > 0, "the fixture Day has an AUD-denominated food line");
  assert.equal(audLine(base)?.eur, cents(amount * AUD_TO_EUR));
  assert.equal(
    audLine(stressed)?.eur,
    cents(amount * AUD_TO_EUR_STRESS),
    "an AUD line converts at the stress rate",
  );

  const fare = (plan: typeof base) =>
    plan.legs[0].eur;
  assert.equal(
    fare(stressed),
    fare(base),
    "fares are quoted in EUR and do not move with the AUD",
  );
});

test("the contingency row is visible, proportional and zeroable", () => {
  const off = buildPlan(input({ toggled: ["fixed"], contingency: false }), FIXTURES);
  const on = buildPlan(input({ toggled: ["fixed"], contingency: true }), FIXTURES);

  assert.equal(off.rollUp.contingencyEur, 0);
  assert.equal(off.rollUp.totalEur, off.rollUp.planOnEur);

  assert.equal(on.rollUp.planOnEur, off.rollUp.planOnEur, "it is never hidden padding");
  assert.equal(on.rollUp.contingencyEur, cents(on.rollUp.planOnEur * 0.1));
  assert.equal(
    on.rollUp.totalEur,
    cents(on.rollUp.planOnEur + on.rollUp.contingencyEur),
  );
});

test("the band brackets the plan-on figure, and the worst case tops the band", () => {
  const plan = buildPlan(input({ toggled: [FIXED.id, WINDOWED.id] }), FIXTURES);
  const { planOnEur, bandEur, worstCaseEur } = plan.rollUp;

  assert.ok(bandEur[0] <= planOnEur, "the band's floor is at or below plan-on");
  assert.ok(bandEur[1] >= planOnEur, "the band's ceiling is at or above plan-on");
  assert.ok(
    worstCaseEur >= bandEur[1],
    "the worst case is the band's top re-converted at €0.65",
  );
});

test("the same input always builds the same Plan", () => {
  const twice = () =>
    JSON.stringify(buildPlan(input({ toggled: [...FIXTURES.map((c) => c.id)] }), FIXTURES));
  assert.equal(twice(), twice());
});
