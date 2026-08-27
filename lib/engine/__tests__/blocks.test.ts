/**
 * Place-block tests — the Ledger's sections.
 *
 * Two properties matter and nothing else does: the blocks cover the trip
 * exactly once, and their subtotals reconcile with the Plan's plan-on figure.
 * Everything the page draws hangs off those.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { intoBlocks } from "@/lib/engine/blocks";
import { cents } from "@/lib/engine/ledger";
import { buildPlan } from "@/lib/engine/plan";
import { FIXTURES, input } from "@/lib/engine/__tests__/fixtures";

const PLAN = buildPlan(
  input({ toggled: ["fixed", "windowed", "floating"] }),
  FIXTURES,
);

test("the blocks cover every Day of the trip, in order, exactly once", () => {
  const blocks = intoBlocks(PLAN.days, PLAN.warnings);
  const covered = blocks.flatMap((block) => block.days.map((day) => day.date));

  assert.deepEqual(
    covered,
    PLAN.days.map((day) => day.date),
    "a Day belongs to exactly one block, and the run order is the calendar's",
  );
});

test("a block is one place, and a new place starts a new block", () => {
  const blocks = intoBlocks(PLAN.days, PLAN.warnings);

  for (const block of blocks) {
    assert.ok(
      block.days.every((day) => day.locationId === block.locationId),
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

test("the block subtotals sum to the Plan's plan-on figure", () => {
  const blocks = intoBlocks(PLAN.days, PLAN.warnings);
  const summed = cents(
    blocks.reduce((total, block) => total + block.costEur, 0),
  );

  assert.equal(
    summed,
    PLAN.rollUp.planOnEur,
    "the Ledger's sections re-aggregate the Days — they never re-price them",
  );
});

test("a Buffer day stays in the block of the place it is spent in", () => {
  const blocks = intoBlocks(PLAN.days, PLAN.warnings);
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
  const blocks = intoBlocks(PLAN.days, PLAN.warnings);
  const sydney = blocks.find((block) => block.locationId === "sydney");

  assert.ok(sydney, "the date-locked fixture puts a block in Sydney");
  assert.deepEqual(sydney.capsuleIds, ["fixed"]);
  assert.ok(
    sydney.peaks.some((peak) => peak.id !== "none"),
    "New Year in Sydney is a peak, and the band should say so once",
  );
});

test("a block carries the Warnings whose dates fall inside it", () => {
  const blocks = intoBlocks(PLAN.days, PLAN.warnings);

  for (const block of blocks) {
    const dates = new Set(block.days.map((day) => day.date));
    for (const warning of block.warnings) {
      assert.ok(
        warning.dates.some((date) => dates.has(date)),
        `${warning.id} does not touch ${block.locationName}`,
      );
    }
  }
});
