/**
 * Burn-down tests — the curve has to end where the roll-up says it ends.
 *
 * That is the only interesting property. A chart that draws its own arithmetic
 * will eventually disagree with the headline above it, and the disagreement
 * will be invisible until someone adds up the days by hand.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { BUDGET_CEILING_EUR, CONTINGENCY_RATE } from "@/lib/engine/constants";
import { burnDown } from "@/lib/engine/burn-down";
import { buildPlan } from "@/lib/engine/plan";
import { FIXTURES, input } from "@/lib/engine/__tests__/fixtures";

const TRIP = {
  toggled: ["fixed", "windowed"],
  startDate: "2026-12-20",
  endDate: "2027-01-24",
};

function curve(overrides: Partial<Parameters<typeof input>[0]> = {}) {
  const plan = buildPlan(input({ ...TRIP, ...overrides }), FIXTURES);
  return {
    plan,
    burn: burnDown({
      days: plan.days,
      fxRate: plan.rollUp.fxRate,
      contingency: plan.rollUp.contingencyOn,
    }),
  };
}

test("the curve's last point is the roll-up's total", () => {
  const { plan, burn } = curve();

  assert.equal(burn.points.length, plan.dayCount);
  assert.ok(
    Math.abs(burn.planOnTotal - plan.rollUp.totalEur) < 0.05,
    `burn-down ends at €${burn.planOnTotal}, roll-up says €${plan.rollUp.totalEur}`,
  );
  assert.ok(
    Math.abs(burn.worstTotal - plan.rollUp.worstCaseEur) < 0.05,
    `worst case ends at €${burn.worstTotal}, roll-up says €${plan.rollUp.worstCaseEur}`,
  );
});

test("the identity survives both knobs", () => {
  for (const contingency of [true, false]) {
    for (const fxStress of [true, false]) {
      const { plan, burn } = curve({ contingency, fxStress });
      assert.ok(
        Math.abs(burn.planOnTotal - plan.rollUp.totalEur) < 0.05,
        `contingency ${contingency}, fx stress ${fxStress}: €${burn.planOnTotal} vs €${plan.rollUp.totalEur}`,
      );
      assert.ok(
        Math.abs(burn.worstTotal - plan.rollUp.worstCaseEur) < 0.05,
        `contingency ${contingency}, fx stress ${fxStress}: worst €${burn.worstTotal} vs €${plan.rollUp.worstCaseEur}`,
      );
    }
  }
});

test("both curves only ever rise, and worst case never dips under plan-on", () => {
  const { burn } = curve();

  for (let i = 1; i < burn.points.length; i += 1) {
    const previous = burn.points[i - 1];
    const point = burn.points[i];
    assert.ok(
      point.planOnEur >= previous.planOnEur,
      `plan-on fell on ${point.date}`,
    );
    assert.ok(point.worstEur >= previous.worstEur, `worst fell on ${point.date}`);
    assert.ok(
      point.worstEur >= point.planOnEur - 0.05,
      `worst case (€${point.worstEur}) under plan-on (€${point.planOnEur}) on ${point.date}`,
    );
  }
});

test("a day's own cost is the step between two points", () => {
  const { plan, burn } = curve();

  const index = 5;
  const step = burn.points[index].planOnEur - burn.points[index - 1].planOnEur;
  assert.ok(
    Math.abs(step - plan.days[index].totalEur) < 0.05,
    `step €${step} should be the Day's own €${plan.days[index].totalEur}`,
  );
  assert.ok(Math.abs(step - burn.points[index].dayEur) < 0.05);
});

test("remaining is the ceiling minus what has been spent", () => {
  const { burn } = curve();
  for (const point of burn.points) {
    assert.ok(
      Math.abs(point.remainingEur - (BUDGET_CEILING_EUR - point.planOnEur)) <
        0.05,
    );
  }
});

test("the crossing is the first day at or over the ceiling, plan-on first", () => {
  const { burn } = curve();

  if (burn.crossing === null) {
    // Nothing on either curve may have reached the ceiling.
    for (const point of burn.points) {
      assert.ok(point.planOnEur < BUDGET_CEILING_EUR);
      assert.ok(point.worstEur < BUDGET_CEILING_EUR);
    }
    return;
  }

  const series = burn.crossing.series === "plan-on" ? "planOnEur" : "worstEur";
  const at = burn.points.findIndex((point) => point.index === burn.crossing!.index);
  assert.ok(at >= 0);
  assert.ok(burn.points[at][series] >= BUDGET_CEILING_EUR);
  if (at > 0) assert.ok(burn.points[at - 1][series] < BUDGET_CEILING_EUR);

  // Plan-on wins the tie: if plan-on crossed at all, that is the one reported.
  const planOnCrossed = burn.points.some(
    (point) => point.planOnEur >= BUDGET_CEILING_EUR,
  );
  assert.equal(burn.crossing.series, planOnCrossed ? "plan-on" : "worst");
});

test("the contingency toggle lifts the whole curve, not just the end", () => {
  const off = curve({ contingency: false }).burn;
  const on = curve({ contingency: true }).burn;

  for (let i = 0; i < off.points.length; i += 1) {
    const expected = off.points[i].planOnEur * (1 + CONTINGENCY_RATE);
    assert.ok(
      Math.abs(on.points[i].planOnEur - expected) < 0.05,
      `day ${i}: €${on.points[i].planOnEur} should be €${expected}`,
    );
  }
});

test("an empty trip is a curve with no points and no crossing", () => {
  const burn = burnDown({ days: [], fxRate: 0.61, contingency: true });
  assert.deepEqual(burn.points, []);
  assert.equal(burn.planOnTotal, 0);
  assert.equal(burn.worstTotal, 0);
  assert.equal(burn.crossing, null);
});
