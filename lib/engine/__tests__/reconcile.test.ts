/**
 * Reconciliation against the real research corpus.
 *
 * The other suites run on fixtures, deliberately: they test the scheduler and
 * the ledger, and a fixture is the only way to do that without the tests
 * failing every time someone re-researches Tasmania.
 *
 * This one is different. It runs the default Scenario — all nine researched
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
import { ANCHORS, weekdayOf } from "@/lib/trip-dates";

const plan = buildPlan(
  DEFAULT_SCENARIO.input,
  // The default Scenario carries two Catalog ideas as well as the nine
  // researched Adventures, and `capsuleCatalogue` only builds a Catalog spec
  // for an id it is handed — so the reconciliation has to hand it the Scenario's
  // own list, not an empty one, or the two would be silently dropped.
  capsuleCatalogue(DEFAULT_SCENARIO.input.toggled),
);

test("the default Scenario places all nine Adventures and both WA evenings", () => {
  assert.equal(plan.placements.length, 11);
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

test("the arrival block leads the calendar, and nothing else can", () => {
  const first = plan.placements[0];
  assert.equal(first.capsuleId, "mundaring-arrival");
  assert.equal(first.startDate, plan.startDate, "the day the trip lands");
  assert.equal(plan.days[0].locationId, "mundaring");
  assert.equal(plan.days[0].homeBase, true, "free lodging, borrowed car");
});

test("the Perth music night is on a Friday or a Saturday", () => {
  const placed = plan.placements.find(
    (placement) => placement.capsuleId === "perth-live-music-night",
  );
  assert.ok(placed, "the music night is on the default Scenario");
  assert.ok(
    [5, 6].includes(weekdayOf(placed.startDate)),
    `${placed.startDate} is a ${weekdayOf(placed.startDate)}`,
  );
});

test("Fremantle fish and chips buys nothing the ledger is not already charging", () => {
  const day = plan.days.find(
    (entry) => entry.capsuleId === "fremantle-fish-and-chips",
  );
  assert.ok(day, "it is on the calendar");
  assert.deepEqual(
    day.lines.filter((line) => line.kind === "event"),
    [],
    "A$30–70 on the harbour is under the living floor — a place to be, not a thing to buy",
  );
});

test("no proposal takes a hard Anchor's own day but the block that owns it", () => {
  for (const anchor of ANCHORS) {
    if (!anchor.hard) continue;
    const holders = plan.placements.filter(
      (placement) =>
        placement.startDate <= anchor.date && placement.endDate >= anchor.date,
    );
    for (const holder of holders) {
      assert.equal(
        holder.capsuleId,
        "sydney-nye",
        `${holder.capsuleId} took ${anchor.label} (${anchor.date})`,
      );
    }
  }

  // Christmas is nobody's block: it is a Buffer day at the Perth Home base,
  // which is what a family Christmas looks like in this model.
  const christmas = plan.days.find((day) => day.date === "2026-12-25");
  assert.equal(christmas?.buffer, true);
  assert.equal(christmas?.homeBase, true);
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
