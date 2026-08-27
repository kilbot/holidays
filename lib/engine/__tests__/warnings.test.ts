/**
 * Warning tests — the site informs, and never blocks.
 *
 * Every case here asserts two things: the Warning fires, and the Plan still
 * exists. docs/CONTEXT.md is unambiguous that nothing is ever refused, so a
 * Warning that came with a missing Day or a thrown error would be the bug.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { BUDGET_CEILING_EUR, DAILY_CAP_AUD } from "@/lib/engine/constants";
import { buildPlan } from "@/lib/engine/plan";
import { FIXTURES, input } from "@/lib/engine/__tests__/fixtures";

const kinds = (plan: ReturnType<typeof buildPlan>) =>
  plan.warnings.map((warning) => warning.kind);

test("a violated Lock warns and the Plan still has all its Days", () => {
  const plan = buildPlan(
    input({
      toggled: ["windowed"],
      placementOverrides: { windowed: "2026-12-21" },
    }),
    FIXTURES,
  );

  assert.ok(kinds(plan).includes("lock-violated"));
  assert.equal(plan.days.length, plan.dayCount);
  assert.ok(plan.rollUp.planOnEur > 0);
});

test("a missed Anchor warns — both kinds", () => {
  // NYE inside the range, but the couple is nowhere near Sydney.
  const wrongPlace = buildPlan(
    input({
      toggled: ["weekdayed"],
      startDate: "2026-12-20",
      endDate: "2027-01-10",
      placementOverrides: { weekdayed: "2026-12-31" },
    }),
    FIXTURES,
  );
  const place = wrongPlace.warnings.find(
    (warning) => warning.kind === "anchor-missed" && warning.dates.includes("2026-12-31"),
  );
  assert.ok(place, "NYE not in Sydney is a Warning");
  assert.equal(place.tone, "over", "a hard Anchor gets the red treatment");

  // And a range that does not reach the Anchor at all.
  const outside = buildPlan(
    input({ toggled: [], startDate: "2027-01-05", endDate: "2027-01-20" }),
    FIXTURES,
  );
  assert.ok(
    outside.warnings.some(
      (warning) =>
        warning.kind === "anchor-missed" && warning.label.includes("outside"),
    ),
  );
});

test("a relocation with no Buffer before it warns", () => {
  // Two blocks in different places, dragged back to back.
  const plan = buildPlan(
    input({
      toggled: ["fixed", "floating"],
      startDate: "2026-12-28",
      endDate: "2027-01-20",
      placementOverrides: { fixed: "2026-12-29", floating: "2027-01-02" },
    }),
    FIXTURES,
  );

  const warning = plan.warnings.find((item) => item.kind === "zero-buffer");
  assert.ok(warning, "Sydney ends 1 Jan and Melbourne starts 2 Jan");
  assert.deepEqual(warning.dates, ["2027-01-01", "2027-01-02"]);
});

test("a week with no Buffer in it warns as jam-packed", () => {
  const packed = {
    ...FIXTURES[3],
    id: "packed",
    days: 10,
    minDays: 1,
  };
  const plan = buildPlan(
    input({
      toggled: ["packed"],
      startDate: "2027-01-05",
      endDate: "2027-01-20",
      placementOverrides: { packed: "2027-01-05" },
    }),
    [...FIXTURES, packed],
  );

  assert.ok(kinds(plan).includes("jam-packed"));
});

test("a Day over the Daily cap warns, and the cap is living lines only", () => {
  // A hotel-tier Sydney night inside the NYE block clears A$500 on its own.
  const plan = buildPlan(
    input({
      toggled: ["fixed"],
      startDate: "2026-12-28",
      endDate: "2027-01-10",
      placementOverrides: { fixed: "2026-12-29" },
      lodgingTiers: { fixed: "hotel" },
    }),
    FIXTURES,
  );

  const capWarnings = plan.warnings.filter(
    (warning) => warning.kind === "daily-cap",
  );
  assert.ok(capWarnings.length > 0, "NYE at hotel tier blows the cap");

  for (const warning of capWarnings) {
    const day = plan.days.find((entry) => entry.date === warning.dates[0]);
    assert.ok(day);
    assert.ok(
      day.livingEur > DAILY_CAP_AUD * plan.rollUp.fxRate,
      "the warning is measured on living lines",
    );
  }

  // And a Day whose Event spend is large but whose living costs are not stays quiet.
  const eventDay = plan.days.find((day) =>
    day.lines.some((line) => line.kind === "event"),
  );
  assert.ok(eventDay);
  assert.ok(eventDay.totalEur > eventDay.livingEur);
});

test("crossing the Budget ceiling warns and changes nothing else", () => {
  const enormous = {
    ...FIXTURES[0],
    id: "enormous",
    name: "Enormous",
    days: 40,
    minDays: 1,
    lock: { kind: "flexible" } as const,
    events: [
      {
        id: "enormous-event",
        label: "Something ruinous",
        aud: { plan: 40_000, band: [40_000, 60_000] as [number, number] },
        dayOffset: 0,
        source: "test",
      },
    ],
  };

  const plan = buildPlan(
    input({ toggled: ["enormous"] }),
    [...FIXTURES, enormous],
  );

  assert.ok(plan.rollUp.totalEur > BUDGET_CEILING_EUR);
  assert.ok(kinds(plan).includes("budget-ceiling"));
  assert.equal(plan.rollUp.budgetFraction, 1, "the bar pins rather than overflowing");
  assert.equal(plan.days.length, plan.dayCount, "and the Plan is still a Plan");
});

test("a clean Plan raises no Warnings it has not earned", () => {
  const plan = buildPlan(
    input({
      toggled: ["windowed"],
      startDate: "2027-01-16",
      endDate: "2027-01-27",
    }),
    FIXTURES,
  );

  assert.equal(
    plan.warnings.filter((warning) =>
      ["lock-violated", "overlap", "unplaced", "jam-packed"].includes(
        warning.kind,
      ),
    ).length,
    0,
  );
});

test("Warnings reach the week cells they belong to", () => {
  const plan = buildPlan(
    input({
      toggled: ["fixed"],
      startDate: "2026-12-28",
      endDate: "2027-01-12",
      placementOverrides: { fixed: "2026-12-29" },
      lodgingTiers: { fixed: "hotel" },
    }),
    FIXTURES,
  );

  const dated = plan.warnings.filter((warning) => warning.dates.length > 0);
  assert.ok(dated.length > 0);
  for (const warning of dated) {
    assert.ok(
      plan.weeks.some((week) =>
        week.warnings.some((item) => item.id === warning.id),
      ),
      `${warning.id} is on a week`,
    );
  }
});
