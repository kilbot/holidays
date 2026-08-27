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
const isWestern = (leg: Leg) =>
  (leg.mode === "drive" || leg.mode === "ferry") && leg.date <= "2026-12-26";

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

  // And the flight east leaves from Perth on Boxing Day itself — the same day
  // as the drive home, on the 23:55 red-eye that lands at 06:15 on the 27th.
  // `domestic-flights.md` grades 27–29 December the worst-priced days of the
  // Australian year and names the 26th as the Plan's default (#107).
  const east = plan.legs.find((leg) => leg.to === "SYD");
  assert.ok(east);
  assert.equal(east.from, "PER");
  assert.equal(east.fromLocationId, "perth");
  assert.equal(east.date, "2026-12-26");

  // Sydney still starts on the 27th: they land at dawn, so the block the flight
  // opens begins the morning after the fare is dated.
  const sydney = plan.days.find((day) => day.locationId === "sydney");
  assert.equal(sydney?.date, "2026-12-27");
});

test("Boxing Day carries both journeys, and the Ledger files each where it belongs", () => {
  const boxingDay = plan.days.find((day) => day.date === "2026-12-26");
  assert.ok(boxingDay);

  const journeys = boxingDay.lines.filter((line) => line.kind === "transport");
  assert.equal(journeys.length, 2, "the drive down and the flight out");
  assert.deepEqual(
    journeys.map((line) => line.mode),
    ["drive", "flight"],
    "in the order they are travelled, and each knowing what it is",
  );

  // The fuel line is a couple of tanks; the fare is the biggest domestic
  // number on the Plan. Both are on one Day and neither is inside a block.
  const rows = intoLedger(plan.days, plan.warnings, plan.legs);
  const onTheDay = rows.filter(
    (row) => row.kind === "transit" && row.transit.date === "2026-12-26",
  );
  assert.equal(onTheDay.length, 2);

  const perth = rows.findIndex(
    (row) => row.kind === "block" && row.block.startDate === "2026-12-26",
  );
  const sydney = rows.findIndex(
    (row) => row.kind === "block" && row.block.locationId === "sydney",
  );
  const drive = rows.findIndex((row) => row.id === "PER>PER@2026-12-26");
  const flight = rows.findIndex((row) => row.id === "PER>SYD@2026-12-26");

  assert.ok(drive < perth, "the drive opens the Perth day");
  assert.ok(perth < flight, "the flight leaves after it");
  assert.ok(flight < sydney, "and opens Sydney, which starts the next morning");
});

test("every relocation inside WA is a road or a boat, and the Morawa run is both ways", () => {
  const surface = plan.legs.filter(isWestern);
  assert.deepEqual(
    surface.map((leg) => `${leg.fromLocationId}>${leg.toLocationId}`),
    [
      "mundaring>perth",
      "perth>margaret-river",
      "margaret-river>rottnest",
      "rottnest>morawa",
      // The one the couple said was missing: 370 km back down the Midlands
      // road on Boxing Day, before the red-eye east that same night.
      "morawa>perth",
    ],
  );

  // Nobody flies Perth → Margaret River, and every one of these shares the
  // PER gateway — which is what makes it surface travel rather than a fare.
  for (const leg of surface) {
    assert.equal(leg.from, "PER");
    assert.equal(leg.to, "PER");
    assert.equal(leg.modeOverridden, false, "by geography, not by knob");
  }

  // …and the two that touch the island are the boat, not the road. You cannot
  // drive to Rottnest, and the Ledger used to price the crossing as €4 of
  // petrol (kilbot/holidays#101).
  const modes = new Map(
    surface.map((leg) => [`${leg.fromLocationId}>${leg.toLocationId}`, leg.mode]),
  );
  assert.equal(modes.get("margaret-river>rottnest"), "ferry");
  assert.equal(modes.get("rottnest>morawa"), "ferry");
  assert.equal(modes.get("morawa>perth"), "drive");
});

test("the Rottnest crossing is one SeaLink ticket, charged once", () => {
  const boats = plan.legs.filter((leg) => leg.mode === "ferry");
  assert.equal(boats.length, 2, "out on the first ferry, back on the last");

  for (const boat of boats) {
    assert.equal(boat.carrier, "SeaLink");
    assert.equal(boat.fareBasis, "return-share", "half a same-day return each");
    assert.match(boat.note, /Fremantle/);
    assert.ok(
      !/A\$0\.16\/km|Fuel only/.test(boat.note),
      "a boat does not burn petrol by the kilometre",
    );
  }

  // A$114 for the couple, same-day return including the island admission fee —
  // capsule-wa-southwest.md's own cost line. Charged once across both hops.
  const total = boats.reduce((sum, leg) => sum + leg.eur, 0);
  assert.equal(Math.round(total * 100) / 100, Math.round(114 * 0.61 * 100) / 100);

  // …and the ferry is no longer *also* an Event line on the island day, which
  // is what charging it twice would look like.
  const ashore = plan.days.find((day) => day.capsuleId === "rottnest-island");
  assert.ok(ashore);
  const gear = ashore.lines.find((line) => line.id.endsWith(":rotto-ferry"));
  assert.ok(gear, "the bikes and the snorkel gear are still bought");
  assert.equal(gear.aud, 130, "bikes A$86 and snorkel A$44, and no boat");
});

test("a WA drive is priced as fuel and nothing else", () => {
  const morawaRun = plan.legs.find(
    (leg) => leg.id === "PER>PER@2026-12-26" && leg.mode === "drive",
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

test("each WA journey is a transit row in the Ledger", () => {
  const rows = intoLedger(plan.days, plan.warnings, plan.legs);
  const transits = new Map(
    rows
      .filter((row) => row.kind === "transit")
      .map((row) => [row.id, row.kind === "transit" ? row.transit : null]),
  );

  for (const leg of plan.legs.filter(isWestern)) {
    const transit = transits.get(leg.id);
    assert.ok(transit, `${leg.id} has a row of its own`);
    assert.equal(transit.mode, leg.mode, "drawn as what it is, road or water");
    // The row shows places, not the airport code all five of them share.
    assert.notEqual(transit.fromName, transit.toName);
    assert.equal(transit.costEur, leg.eur, "the row is the charged line");
  }
});
