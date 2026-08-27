/**
 * Event lines: where they land, and the Scenario knob that switches them.
 *
 * Two engine preconditions #64 asked for before any block reshape could ship:
 *
 * 1. **A date-locked Event pins to its date**, not to an offset into the block.
 *    The Sydney block is proposed on 28 December, so the offset put New Year's
 *    Eve on the 30th — a Plan that looked right and was wrong.
 * 2. **`eventOverrides`** lets a Scenario switch a boat day off or swap it for a
 *    cheaper operator, which is what makes the savings menu's Event triage
 *    expressible as a saved Plan rather than a paragraph.
 *
 * Fixtures, not the research corpus — these test the mechanism.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { buildPlan } from "@/lib/engine/plan";
import { eventOffset } from "@/lib/engine/ledger";
import { parseInput } from "@/lib/engine/scenario-doc";
import type { CapsuleSpec, Placement } from "@/lib/engine/types";
import { input } from "@/lib/engine/__tests__/fixtures";

/** A four-day Sydney block carrying one dated Event and one that floats. */
const BLOCK: CapsuleSpec = {
  id: "party",
  name: "The Party",
  locationId: "sydney",
  days: 4,
  minDays: 2,
  lock: { kind: "flexible" },
  needsCar: false,
  events: [
    {
      id: "dated",
      label: "The dated thing",
      aud: { plan: 300, band: [200, 400] },
      dayOffset: 0,
      date: "2026-12-31",
      source: "test",
    },
    {
      id: "floating",
      label: "The floating thing",
      aud: { plan: 100, band: [100, 100] },
      dayOffset: 1,
      source: "test",
    },
  ],
  publishedEur: 0,
  tier: "deep",
};

const placement = (startDate: string, days: number): Placement => ({
  capsuleId: BLOCK.id,
  startDate,
  endDate: new Date(
    Date.parse(`${startDate}T00:00:00Z`) + (days - 1) * 86_400_000,
  )
    .toISOString()
    .slice(0, 10),
  days,
  origin: "override",
  lockViolated: false,
  overlaps: [],
});

const plan = (overrides: Parameters<typeof input>[0] = {}) =>
  buildPlan(
    input({
      startDate: "2026-12-28",
      endDate: "2027-01-06",
      toggled: ["party"],
      placementOverrides: { party: "2026-12-28" },
      ...overrides,
    }),
    [BLOCK],
  );

const lineOn = (built: ReturnType<typeof plan>, date: string, id: string) =>
  built.days
    .find((day) => day.date === date)
    ?.lines.find((entry) => entry.id === `${date}:${id}`);

/* ------------------------------------------------------------------ */
/* 1. Date-locked Events                                               */
/* ------------------------------------------------------------------ */

test("a dated Event lands on its date, not on its offset", () => {
  const built = plan();
  assert.ok(lineOn(built, "2026-12-31", "dated"), "on New Year's Eve");
  assert.equal(
    lineOn(built, "2026-12-28", "dated"),
    undefined,
    "not on the first day of the block, which is what the offset said",
  );
});

test("an undated Event still rides with the block", () => {
  const built = plan();
  assert.ok(lineOn(built, "2026-12-29", "floating"), "day two of the block");

  const dragged = plan({ placementOverrides: { party: "2026-12-30" } });
  assert.ok(lineOn(dragged, "2026-12-31", "floating"), "and it followed");
});

test("a block that does not cover the date does not buy the ticket", () => {
  const moved = plan({ placementOverrides: { party: "2027-01-02" } });
  assert.equal(
    moved.days.reduce(
      (total, day) =>
        total +
        day.lines.filter((entry) => entry.id.endsWith(":dated")).length,
      0,
    ),
    0,
    "no New Year's Eve, no vantage point to pay for",
  );
  assert.ok(
    lineOn(moved, "2027-01-03", "floating"),
    "and the floating Event moved with the block",
  );
});

test("eventOffset reads the placement, not the calendar at large", () => {
  const dated = BLOCK.events[0];
  assert.equal(eventOffset(dated, placement("2026-12-28", 4)), 3);
  assert.equal(eventOffset(dated, placement("2026-12-31", 4)), 0);
  assert.equal(eventOffset(dated, placement("2027-01-02", 4)), null);

  const floating = BLOCK.events[1];
  assert.equal(eventOffset(floating, placement("2026-12-28", 4)), 1);
  assert.equal(
    eventOffset(floating, placement("2026-12-28", 1)),
    null,
    "a block shrunk below the offset drops the Event rather than inventing a day",
  );
});

/* ------------------------------------------------------------------ */
/* 2. eventOverrides                                                   */
/* ------------------------------------------------------------------ */

test("false takes an Event off the Plan", () => {
  const on = plan();
  const off = plan({ eventOverrides: { dated: false } });

  assert.ok(lineOn(on, "2026-12-31", "dated"));
  assert.equal(lineOn(off, "2026-12-31", "dated"), undefined);
  assert.equal(
    Math.round(on.rollUp.planOnEur - off.rollUp.planOnEur),
    Math.round(300 * on.rollUp.fxRate),
    "and the Plan is cheaper by exactly that line",
  );
});

test("true is the same as saying nothing", () => {
  assert.equal(
    plan({ eventOverrides: { dated: true } }).rollUp.planOnEur,
    plan().rollUp.planOnEur,
  );
});

test("a number swaps the figure and collapses the band onto it", () => {
  const swapped = plan({ eventOverrides: { dated: 51 } });
  const line = lineOn(swapped, "2026-12-31", "dated");
  assert.ok(line);
  assert.equal(line.aud, 51);
  assert.deepEqual(line.bandEur, [line.eur, line.eur]);
  assert.match(line.note, /swapped to A\$51/);
});

test("zero is a swap, not an absence — the line stays visible", () => {
  const line = lineOn(plan({ eventOverrides: { dated: 0 } }), "2026-12-31", "dated");
  assert.ok(line, "a free thing is still a thing on the day");
  assert.equal(line.eur, 0);
});

/* ------------------------------------------------------------------ */
/* 3. Repair, never reject                                             */
/* ------------------------------------------------------------------ */

test("the parser defaults eventOverrides rather than rejecting the Scenario", () => {
  assert.deepEqual(parseInput({ startDate: "2026-12-12" }).eventOverrides, {});
  assert.deepEqual(
    parseInput({ eventOverrides: "not a record" }).eventOverrides,
    {},
  );
});

test("the parser keeps the knobs it understands and drops the rest", () => {
  assert.deepEqual(
    parseInput({
      eventOverrides: {
        off: false,
        on: true,
        swapped: 51,
        free: 0,
        negative: -100,
        infinite: Number.POSITIVE_INFINITY,
        text: "cheap",
        nested: { aud: 12 },
      },
    }).eventOverrides,
    { off: false, on: true, swapped: 51, free: 0 },
  );
});

test("a round trip through JSON survives", () => {
  const before = input({
    toggled: ["party"],
    eventOverrides: { dated: false, floating: 51 },
  });
  assert.deepEqual(parseInput(JSON.parse(JSON.stringify(before))), before);
});
