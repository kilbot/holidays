/**
 * Reconciliation against the real research corpus.
 *
 * The other suites run on fixtures, deliberately: they test the scheduler and
 * the ledger, and a fixture is the only way to do that without the tests
 * failing every time someone re-researches Tasmania.
 *
 * This one is different. It runs the default Scenario — all eight researched
 * Capsules, the reference dates — through the whole pipeline and asserts the
 * invariant the entire cost model rests on: **the Plan's total is the sum of
 * its Days, to the cent**. If a Leg ever gets priced onto a Leg object instead
 * of onto a Day, or a roll-up ever estimates something a second way, this is
 * what catches it.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { intoLedger } from "@/lib/engine/blocks";
import { capsuleCatalogue } from "@/lib/engine/capsules";
import { cents } from "@/lib/engine/ledger";
import { buildPlan } from "@/lib/engine/plan";
import { DEFAULT_SCENARIO } from "@/lib/engine/scenarios";

const plan = buildPlan(DEFAULT_SCENARIO.input, capsuleCatalogue([]));

test("the default Scenario places all eight researched Capsules", () => {
  assert.equal(plan.placements.length, 8);
  assert.deepEqual(plan.unplaced, []);
  for (const placement of plan.placements) {
    assert.equal(
      placement.lockViolated,
      false,
      `${placement.capsuleId} at ${placement.startDate}`,
    );
    assert.deepEqual(placement.overlaps, [], placement.capsuleId);
  }
});

test("the two hard Anchors are honoured out of the box", () => {
  const on = (date: string) => plan.days.find((day) => day.date === date);

  assert.equal(on("2026-12-25")?.homeBase, true, "Christmas at a Home base");
  assert.equal(on("2026-12-31")?.locationId, "sydney", "NYE in Sydney");

  assert.equal(
    plan.warnings.filter((warning) => warning.kind === "anchor-missed").length,
    0,
  );
});

test("the roll-up reconciles with the ledger, to the cent", () => {
  const summed = cents(
    plan.days.reduce((total, day) => total + day.totalEur, 0),
  );
  assert.equal(plan.rollUp.planOnEur, summed);

  const splits = cents(
    plan.rollUp.splits.reduce((total, split) => total + split.amountEur, 0),
  );
  assert.equal(splits, plan.rollUp.planOnEur);

  const weeks = cents(
    plan.weeks.reduce((total, week) => total + week.costEur, 0),
  );
  assert.equal(weeks, plan.rollUp.planOnEur, "the strip agrees with the HUD");

  const lines = cents(
    plan.days.reduce(
      (total, day) =>
        total + day.lines.reduce((sum, line) => sum + line.eur, 0),
      0,
    ),
  );
  assert.equal(lines, plan.rollUp.planOnEur, "and both agree with the lines");
});

test("every Leg's fare is charged to a Day", () => {
  for (const leg of plan.legs) {
    const day = plan.days.find((entry) => entry.date === leg.date);
    assert.ok(day, `${leg.id} lands on a Day`);
    const line = day.lines.find((entry) => entry.id.endsWith(leg.id));
    assert.ok(line, `${leg.id} is a line on ${leg.date}`);
    assert.equal(line.eur, leg.eur);
  }
});

test("the Ledger reconciles: block subtotals + transit rows = plan-on", () => {
  const rows = intoLedger(plan.days, plan.warnings, plan.legs);

  const blocks = cents(
    rows.reduce(
      (total, row) => total + (row.kind === "block" ? row.block.costEur : 0),
      0,
    ),
  );
  const transits = cents(
    rows.reduce(
      (total, row) => total + (row.kind === "transit" ? row.transit.costEur : 0),
      0,
    ),
  );

  assert.equal(cents(blocks + transits), plan.rollUp.planOnEur);
  assert.equal(
    transits,
    plan.rollUp.splits.find((split) => split.id === "flights")?.amountEur,
    "the transit rows are the flights split, seen from the Ledger's side",
  );
});

test("no block is charged for the Leg that reached it (#53)", () => {
  const rows = intoLedger(plan.days, plan.warnings, plan.legs);
  const fares = new Set(plan.legs.map((leg) => `${leg.date}:${leg.id}`));

  for (const row of rows) {
    if (row.kind !== "block") continue;
    for (const entry of row.block.days) {
      assert.ok(
        entry.lines.every((line) => !fares.has(line.id)),
        `${row.block.locationName} holds a fare on ${entry.day.date}`,
      );
    }
  }

  // The reported symptom, as an assertion: the €3,800 crossing from Valencia
  // lands on the first Day of the Margaret River block, and the block's
  // subtotal must not carry it. docs/CONTEXT.md — a Leg is not a place.
  const first = rows[0];
  assert.equal(first.kind, "transit", "the outbound crossing leads the Ledger");
  if (first.kind !== "transit") return;

  const arrival = rows[1];
  assert.equal(arrival.kind, "block");
  if (arrival.kind !== "block") return;

  assert.ok(first.transit.costEur > 1_000, "the crossing is the big number");
  assert.ok(
    arrival.block.costEur < first.transit.costEur,
    `${arrival.block.locationName} should not out-cost the flight that reaches it`,
  );
});

test("the crossing is priced once, not twice", () => {
  const crossings = plan.legs.filter(
    (leg) => leg.fromLocationId === "origin" || leg.toLocationId === "origin",
  );
  assert.equal(crossings.length, 2, "out and back");
  assert.ok(crossings[0].eur > 0, "the outbound carries the return fare");
  assert.equal(crossings[1].eur, 0, "and the homeward carries nothing");
});
