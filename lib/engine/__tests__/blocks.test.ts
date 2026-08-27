/**
 * Place-block tests — the Ledger's sections, and the transit rows between them.
 *
 * Three properties matter and nothing else does: the blocks cover the trip
 * exactly once, no block is charged for the Leg that reached it (#53), and
 * subtotals plus transit rows reconcile with the Plan's plan-on figure to the
 * cent. Everything the page draws hangs off those.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { intoBlocks, intoLedger } from "@/lib/engine/blocks";
import { cents } from "@/lib/engine/ledger";
import { buildPlan } from "@/lib/engine/plan";
import { FIXTURES, input } from "@/lib/engine/__tests__/fixtures";

const PLAN = buildPlan(
  input({ toggled: ["fixed", "windowed", "floating"] }),
  FIXTURES,
);

const cut = () => intoBlocks(PLAN.days, PLAN.warnings, PLAN.legs);

test("the blocks cover every Day of the trip, in order, exactly once", () => {
  const blocks = cut();
  const covered = blocks.flatMap((block) =>
    block.days.map((entry) => entry.day.date),
  );

  assert.deepEqual(
    covered,
    PLAN.days.map((day) => day.date),
    "a Day belongs to exactly one block, and the run order is the calendar's",
  );
});

test("a block is one place, and a new place starts a new block", () => {
  const blocks = cut();

  for (const block of blocks) {
    assert.ok(
      block.days.every((entry) => entry.day.locationId === block.locationId),
      `${block.locationName} block holds a Day somewhere else`,
    );
  }

  for (let index = 1; index < blocks.length; index += 1) {
    assert.notEqual(
      blocks[index].locationId,
      blocks[index - 1].locationId,
      "consecutive blocks in the same place should have been one block",
    );
  }
});

test("a Buffer day stays in the block of the place it is spent in", () => {
  const blocks = cut();
  const withBuffers = blocks.filter((block) => block.bufferDays > 0);

  assert.ok(withBuffers.length > 0, "this Plan has Buffer days to place");
  for (const block of withBuffers) {
    assert.ok(
      block.days.length > block.bufferDays || block.locationId === "transit",
      "Buffer days are not hived off into a section of their own",
    );
  }
});

test("a block names the Capsules that own Days in it, and the peaks that bit", () => {
  const blocks = cut();
  const sydney = blocks.find((block) => block.locationId === "sydney");

  assert.ok(sydney, "the date-locked fixture puts a block in Sydney");
  assert.deepEqual(sydney.capsuleIds, ["fixed"]);
  assert.ok(
    sydney.peaks.some((peak) => peak.id !== "none"),
    "New Year in Sydney is a peak, and the band should say so once",
  );
});

test("a block carries the Warnings whose dates fall inside it", () => {
  const blocks = cut();

  for (const block of blocks) {
    const dates = new Set(block.days.map((entry) => entry.day.date));
    for (const warning of block.warnings) {
      assert.ok(
        warning.dates.some((date) => dates.has(date)),
        `${warning.id} does not touch ${block.locationName}`,
      );
    }
  }
});

/* ------------------------------------------------------------------ */
/* #53 — getting there is not being there                              */
/* ------------------------------------------------------------------ */

test("no block subtotal contains an inter-city Leg fare", () => {
  const fares = new Set(PLAN.legs.map((leg) => `${leg.date}:${leg.id}`));

  for (const block of cut()) {
    for (const entry of block.days) {
      assert.ok(
        entry.lines.every((line) => !fares.has(line.id)),
        `${block.locationName} still holds a Leg fare on ${entry.day.date}`,
      );
      const own = cents(
        entry.lines.reduce((total, line) => total + line.eur, 0),
      );
      assert.equal(
        entry.costEur,
        own,
        `${entry.day.date} costs what its remaining lines cost`,
      );
    }
  }
});

test("a block costs the sum of its Days' own spend", () => {
  for (const block of cut()) {
    const summed = cents(
      block.days.reduce((total, entry) => total + entry.costEur, 0),
    );
    assert.equal(
      summed,
      block.costEur,
      `${block.locationName}'s band disagrees with the rows under it`,
    );
  }
});

test("the arriving Leg is a transit row above the block, not a line inside it", () => {
  const rows = intoLedger(PLAN.days, PLAN.warnings, PLAN.legs);

  // The trip opens with the crossing from home, and it sits above the first
  // block rather than inside it — the whole point of #53. It is a chain of
  // sectors since #107, so what leads the page is the first of them.
  assert.equal(rows[0]?.kind, "transit", "the outbound crossing leads the page");
  if (rows[0].kind !== "transit") return;
  assert.equal(rows[0].transit.fromLocationId, "origin");

  const firstBlock = rows.findIndex((row) => row.kind === "block");
  assert.ok(firstBlock > 0, "every row before the first block is a journey");
  const arrival = rows[firstBlock];
  if (arrival.kind !== "block") return;

  // The last sector before that block is the one that reaches it, and it is
  // dated no later than the day the block opens.
  const reaching = rows[firstBlock - 1];
  assert.equal(reaching.kind, "transit");
  if (reaching.kind !== "transit") return;
  assert.ok(reaching.transit.date <= arrival.block.startDate);

  // And the homeward crossing trails the last block: it arrives nowhere here.
  const last = rows[rows.length - 1];
  assert.equal(last.kind, "transit");
  if (last.kind !== "transit") return;
  assert.equal(last.transit.toLocationId, "origin");
});

test("every Leg gets exactly one transit row, and every transit row a Leg", () => {
  const rows = intoLedger(PLAN.days, PLAN.warnings, PLAN.legs);
  const transits = rows.flatMap((row) =>
    row.kind === "transit" ? [row.transit] : [],
  );

  assert.deepEqual(
    transits.map((transit) => transit.id).sort(),
    PLAN.legs.map((leg) => leg.id).sort(),
    "no Leg is dropped and none is drawn twice",
  );

  for (const transit of transits) {
    const leg = PLAN.legs.find((entry) => entry.id === transit.id);
    assert.ok(leg);
    assert.equal(
      transit.costEur,
      leg.eur,
      `${transit.id} charges what the Leg charged`,
    );
  }
});

test("blocks and transit rows reconcile with the Plan's plan-on figure", () => {
  const rows = intoLedger(PLAN.days, PLAN.warnings, PLAN.legs);

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

  assert.ok(transits > 0, "this Plan has Legs to charge");
  assert.equal(
    cents(blocks + transits),
    PLAN.rollUp.planOnEur,
    "the Ledger's sections re-aggregate the Days — they never re-price them",
  );

  // The transit rows are exactly the flights split, which is the same claim
  // said from the roll-up's side.
  const flights = PLAN.rollUp.splits.find((split) => split.id === "flights");
  assert.equal(transits, flights?.amountEur);
});

test("the blocks' bands reconcile too, low and high", () => {
  const rows = intoLedger(PLAN.days, PLAN.warnings, PLAN.legs);

  for (const end of [0, 1] as const) {
    const summed = cents(
      rows.reduce(
        (total, row) =>
          total +
          (row.kind === "block"
            ? row.block.bandEur[end]
            : row.transit.bandEur[end]),
        0,
      ),
    );
    assert.equal(summed, PLAN.rollUp.bandEur[end]);
  }
});
