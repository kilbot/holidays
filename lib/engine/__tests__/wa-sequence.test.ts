/**
 * The Western Australian leg, as the couple described it (#95).
 *
 * Everything WA is asserted here rather than spread across the scheduler and
 * ledger suites, because the leg is one claim with several halves: the **order**
 * the couple asked for, the **drives** that hold it together, and the fact that
 * every one of those drives is a priced Leg the Ledger shows a row for. Break
 * any half and the map goes back to the thing that was reported — a crossing
 * that ended in the vineyards and three hundred kilometres of driving that was
 * nowhere on the page.
 *
 * These read the reference Scenario rather than a fixture on purpose. The
 * complaint was about the seeded default, and a fixture cannot be wrong about
 * it.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { intoLedger } from "@/lib/engine/blocks";
import { capsuleCatalogue } from "@/lib/engine/capsules";
import { FUEL_AUD_PER_KM } from "@/lib/engine/constants";
import { buildPlan } from "@/lib/engine/plan";
import { DEFAULT_SCENARIO } from "@/lib/engine/scenario-doc";
import type { Leg } from "@/lib/engine/types";

const plan = buildPlan(
  DEFAULT_SCENARIO.input,
  capsuleCatalogue(DEFAULT_SCENARIO.input.toggled),
);

/** The WA leg ends when the couple flies east. */
const isWestern = (leg: Leg) => leg.mode === "drive" && leg.date < "2026-12-27";

test("the WA leg runs in the order the couple asked for", () => {
  // #95, from the live map: *arrive Perth → Mundaring base, with the Perth and
  // Fremantle days driven in from it → Margaret River → Rottnest → Morawa for
  // Christmas → back to Perth → fly east.* Asserted as the sequence of places
  // rather than as dates, so the Scheduler is free to reflow it when the
  // leaving date moves and this still says what the couple said.
  const sequence: string[] = [];
  for (const day of plan.days) {
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
  const christmas = plan.days.find((day) => day.date === "2026-12-25");
  assert.equal(christmas?.locationId, "morawa");

  // And the flight east leaves from Perth, the morning after the drive home.
  const east = plan.legs.find((leg) => leg.to === "SYD");
  assert.ok(east);
  assert.equal(east.from, "PER");
  assert.equal(east.fromLocationId, "perth");
  assert.equal(east.date, "2026-12-27");
});

test("every relocation inside WA is a drive, and the Morawa run is both ways", () => {
  const drives = plan.legs.filter(isWestern);
  assert.deepEqual(
    drives.map((leg) => `${leg.fromLocationId}>${leg.toLocationId}`),
    [
      "mundaring>perth",
      "perth>margaret-river",
      "margaret-river>rottnest",
      "rottnest>morawa",
      // The one the couple said was missing: 370 km back down the Midlands
      // road on Boxing Day, before the flight east the next morning.
      "morawa>perth",
    ],
  );

  // Nobody flies Perth → Margaret River, and every one of these shares the
  // PER gateway, which is exactly what makes it a drive.
  for (const leg of drives) {
    assert.equal(leg.from, "PER");
    assert.equal(leg.to, "PER");
    assert.equal(leg.modeOverridden, false, "a drive by geography, not by knob");
  }
});

test("a WA drive is priced as fuel and nothing else", () => {
  const morawaRun = plan.legs.find(
    (leg) => leg.id === "PER>PER@2026-12-26",
  );
  assert.ok(morawaRun, "the drive home from Christmas");
  assert.equal(morawaRun.pricing, "computed");
  assert.equal(morawaRun.carrier, null);

  // The car is Dad's and the farm's, so the Leg carries petrol and no hire.
  assert.match(morawaRun.note, /A\$0\.16\/km/);
  assert.match(morawaRun.note, /Fuel only/);
  assert.equal(FUEL_AUD_PER_KM.plan, 0.16, "cost-baselines §2.2");

  // ~370 km of wheatbelt at A$0.16/km is a couple of tanks, not a fare: tens
  // of euro, never hundreds. Bounded rather than golden, because the road
  // distance moves when the coordinates do.
  assert.ok(morawaRun.eur > 20 && morawaRun.eur < 80, `€${morawaRun.eur}`);

  const block = plan.days.find((day) => day.date === "2026-12-24");
  assert.ok(block);
  assert.ok(
    !block.lines.some((line) => line.kind === "car"),
    "a borrowed car is never a daily hire line",
  );
});

test("each WA drive is a transit row in the Ledger", () => {
  const rows = intoLedger(plan.days, plan.warnings, plan.legs);
  const transits = new Map(
    rows
      .filter((row) => row.kind === "transit")
      .map((row) => [row.id, row.kind === "transit" ? row.transit : null]),
  );

  for (const leg of plan.legs.filter(isWestern)) {
    const transit = transits.get(leg.id);
    assert.ok(transit, `${leg.id} has a row of its own`);
    assert.equal(transit.mode, "drive");
    // The row shows places, not the airport code all five of them share.
    assert.notEqual(transit.fromName, transit.toName);
    assert.equal(transit.costEur, leg.eur, "the row is the charged line");
  }
});
