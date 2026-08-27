/**
 * The globe's geography, tested where it can be wrong.
 *
 * Two things matter here and nothing else does. First, that the arcs are the
 * **current Plan's** Legs in the Plan's own order — the bug in #87 was a map
 * drawing Sydney → Cairns while the itinerary flew Sydney → Hobart → Cairns,
 * and the only way that stays fixed is a test that reads the Legs and the
 * features from the same Plan. Second, that the coordinate resolver never
 * loses a Leg quietly: every tier is exercised, including the one where
 * nothing places an end and the map has to say so rather than throw.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { AIRPORT_COORDINATES } from "@/lib/airports";
import { capsuleCatalogue } from "@/lib/engine/capsules";
import { buildPlan } from "@/lib/engine/plan";
import { DEFAULT_SCENARIO } from "@/lib/engine/scenario-doc";
import type { Leg } from "@/lib/engine/types";
import {
  buildRoute,
  greatCircle,
  legEndsAtAirports,
  resolveEndpoint,
  routeArcsGeoJSON,
  routeStops,
  unmappedLegs,
} from "@/lib/route-geo";

/** The reference Scenario, built exactly as the Plan page builds it. */
function referencePlan() {
  const input = DEFAULT_SCENARIO.input;
  return buildPlan(input, capsuleCatalogue(input.toggled));
}

/** A Leg with only the fields the geometry reads. */
function leg(partial: Partial<Leg>): Leg {
  return {
    id: "AAA>BBB@2027-01-01",
    date: "2027-01-01",
    fromLocationId: "sydney",
    toLocationId: "tasmania",
    from: "SYD",
    to: "HBA",
    mode: "flight",
    modeOverridden: false,
    eur: 0,
    bandEur: [0, 0],
    pricing: "band",
    onGrid: false,
    fareBasis: "one-way",
    hydrated: false,
    carrier: null,
    note: "",
    ...partial,
  };
}

/* ------------------------------------------------------------------ */
/* The resolver                                                        */
/* ------------------------------------------------------------------ */

test("a researched Location resolves to the place, not its gateway", () => {
  const end = resolveEndpoint("port-douglas", "CNS");
  assert.equal(end.source, "place");
  assert.equal(end.name, "Port Douglas");
  assert.equal(end.approximate, false);
  // Port Douglas is 60 km north of the Cairns terminal; the marker belongs on
  // the town, which is the whole reason the tier order starts here.
  assert.ok(end.at);
  assert.ok(end.at[1] > -16.6, "should be north of the airport");
});

test("home resolves through the international gateways, by name", () => {
  const end = resolveEndpoint("origin", "VLC");
  assert.equal(end.source, "airport");
  // The engine calls home by its IATA code, which is right for a ledger row
  // and cryptic as the one label on the European side of the map.
  assert.equal(end.name, "Valencia");
  // A crossing's end genuinely is the terminal, so this is exact.
  assert.equal(end.approximate, false);
  assert.deepEqual(end.at, [-0.3763, 39.4699]);
});

test("an international Leg lands at the terminal, not at the block that follows", () => {
  // The bug the whole rule exists for (#95): the crossing is aimed at the
  // first Location of the trip, so tier 1 answered with that town's own
  // coordinates and the 13,000 km arc terminated inland instead of at PER.
  const crossing = leg({
    id: "VLC>PER@2026-12-14",
    fromLocationId: "origin",
    toLocationId: "margaret-river",
    from: "VLC",
    to: "PER",
  });
  assert.equal(legEndsAtAirports(crossing), true);

  const [arc] = routeArcsGeoJSON([crossing]).features;
  const landing = arc.geometry.coordinates[arc.geometry.coordinates.length - 1];
  assert.deepEqual(landing, AIRPORT_COORDINATES.PER);
  assert.equal(arc.properties.approximate, false, "a terminal is not a guess");
  assert.ok(arc.geometry.coordinates.length > 2, "and still a flown curve");

  // The town keeps its own marker: the rule is about the arc, not the place.
  const stop = routeStops([crossing]).features.find(
    (feature) => feature.properties.id === "margaret-river",
  );
  assert.ok(stop);
  assert.deepEqual(stop.geometry.coordinates, [115.075, -33.955]);
});

test("a domestic hop stays on the places it joins", () => {
  const hop = leg({
    id: "PER>SYD@2026-12-27",
    fromLocationId: "perth",
    toLocationId: "sydney",
    from: "PER",
    to: "SYD",
  });
  assert.equal(legEndsAtAirports(hop), false);

  const [arc] = routeArcsGeoJSON([hop]).features;
  // Perth CBD, not the terminal 11 km east of it. (The great circle's first
  // vertex is the interpolation of the start, so this is a proximity check.)
  const [lon, lat] = arc.geometry.coordinates[0];
  assert.ok(Math.abs(lon - 115.8613) < 0.01 && Math.abs(lat + 31.9523) < 0.01);
  assert.ok(Math.abs(lon - AIRPORT_COORDINATES.PER[0]) > 0.05);
  // …and a drive between two ends of the same gateway is never a crossing.
  assert.equal(
    legEndsAtAirports({ ...hop, mode: "drive", to: "PER", toLocationId: "morawa" }),
    false,
  );
});

test("an airport-only Location is placed at its terminal and marked approximate", () => {
  const end = resolveEndpoint("airport:BME", "BME");
  assert.equal(end.source, "airport");
  assert.equal(end.approximate, true);
  assert.deepEqual(end.at, [122.2322, -17.9447]);
});

test("an unplaceable end comes back null rather than throwing", () => {
  const end = resolveEndpoint("airport:ZZZ", "ZZZ");
  assert.equal(end.source, "unknown");
  assert.equal(end.at, null);
});

test("a Leg with an unplaceable end is reported, not drawn", () => {
  const legs = [
    leg({ id: "SYD>HBA@2027-01-13" }),
    leg({
      id: "HBA>ZZZ@2027-01-22",
      fromLocationId: "tasmania",
      toLocationId: "airport:ZZZ",
      from: "HBA",
      to: "ZZZ",
    }),
  ];

  const route = buildRoute(legs);
  assert.deepEqual(
    route.arcs.features.map((feature) => feature.properties.id),
    ["SYD>HBA@2027-01-13"],
  );
  assert.equal(route.unmapped.length, 1);
  assert.equal(route.unmapped[0].id, "HBA>ZZZ@2027-01-22");
  assert.match(route.unmapped[0].reason, /No coordinates for/);
  // And the stop nothing could place is not on the map either.
  assert.ok(
    !route.stops.features.some((f) => f.properties.id === "airport:ZZZ"),
  );
});

test("an approximate end is drawn straight, with a title saying why", () => {
  const [arc] = routeArcsGeoJSON([
    leg({
      fromLocationId: "tasmania",
      toLocationId: "airport:BME",
      from: "HBA",
      to: "BME",
    }),
  ]).features;

  assert.equal(arc.properties.approximate, true);
  assert.equal(arc.geometry.coordinates.length, 2, "straight, not interpolated");
  assert.match(arc.properties.title, /we know only the airport for BME/);
});

test("a placed pair is interpolated along the great circle", () => {
  const [arc] = routeArcsGeoJSON([leg({})]).features;
  assert.equal(arc.properties.approximate, false);
  assert.ok(arc.geometry.coordinates.length > 2);
});

test("great circles survive their two degenerate cases", () => {
  const same = greatCircle([151.2, -33.9], [151.2, -33.9]);
  assert.deepEqual(same, [
    [151.2, -33.9],
    [151.2, -33.9],
  ]);

  const antipodal = greatCircle([0, 0], [180, 0]);
  assert.ok(
    antipodal.every(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat)),
    "no NaN into a Mapbox source",
  );
});

/* ------------------------------------------------------------------ */
/* The live route                                                      */
/* ------------------------------------------------------------------ */

test("the arcs are the current Plan's Legs, in the Plan's order", () => {
  const plan = referencePlan();
  const route = buildRoute(plan.legs, plan.days);

  assert.deepEqual(
    route.arcs.features.map((feature) => feature.properties.id),
    plan.legs.map((leg) => leg.id),
  );

  // The bug this whole module exists for: the map must draw the Plan's own
  // sequence, never a hardcoded one. The Plan's order has changed once already
  // (the zigzag fix in #92 made these assertions stale) — so derive the
  // expected pairs from the engine's Legs rather than naming any pair here.
  const pairs = route.arcs.features.map(
    (feature) => `${feature.properties.from}>${feature.properties.to}`,
  );
  const planPairs = plan.legs.map((leg) => `${leg.from}>${leg.to}`);
  assert.deepEqual(pairs, planPairs, "arcs mirror the Plan's leg pairs exactly");
  // And the retired static demo sequence must not leak back in unless the
  // Plan itself contains it.
  for (const stale of ["SYD>CNS", "OOL>HBA"]) {
    if (!planPairs.includes(stale)) {
      assert.ok(!pairs.includes(stale), `${stale} is not resurrected`);
    }
  }
});

test("modes carry through, so a drive can be drawn as a drive", () => {
  const plan = referencePlan();
  const route = buildRoute(plan.legs, plan.days);
  const modes = new Map(
    route.arcs.features.map((f) => [f.properties.id, f.properties.mode]),
  );
  for (const leg of plan.legs) {
    assert.equal(modes.get(leg.id), leg.mode);
  }
  assert.ok([...modes.values()].includes("drive"), "the Perth drives are drives");
});

test("the crossings are long-haul and the hops are not", () => {
  const plan = referencePlan();
  const byPair = new Map(
    buildRoute(plan.legs, plan.days).arcs.features.map((f) => [
      `${f.properties.from}>${f.properties.to}`,
      f.properties.longHaul,
    ]),
  );
  assert.equal(byPair.get("VLC>PER"), true);
  assert.equal(byPair.get("PER>SYD"), false);
});

test("stops are Locations in flown order, deduplicated", () => {
  const plan = referencePlan();
  const stops = routeStops(plan.legs, plan.days);
  const ids = stops.features.map((feature) => feature.properties.id);

  assert.equal(new Set(ids).size, ids.length, "no place twice");
  assert.equal(ids[0], "origin");
  // Three stays share the Perth gateway and all three are on the map.
  assert.ok(ids.includes("margaret-river"));
  assert.ok(ids.includes("rottnest"));
  assert.ok(ids.includes("perth"));

  // Exactly one of them carries the always-on label.
  const perthMajors = stops.features.filter(
    (feature) => feature.properties.code === "PER" && feature.properties.major,
  );
  assert.equal(perthMajors.length, 1);
});

test("stops carry the nights and the Adventure the marker opens", () => {
  const plan = referencePlan();
  const sydney = routeStops(plan.legs, plan.days).features.find(
    (feature) => feature.properties.id === "sydney",
  );
  assert.ok(sydney);
  assert.ok(sydney.properties.nights > 0);
  assert.equal(sydney.properties.capsuleId, "sydney-nye");
});

test("the bounds hold every stop the route draws", () => {
  const plan = referencePlan();
  const route = buildRoute(plan.legs, plan.days);
  const bounds = route.bounds;
  assert.ok(bounds);

  for (const feature of route.stops.features) {
    const [lon, lat] = feature.geometry.coordinates;
    assert.ok(lon >= bounds[0][0] && lon <= bounds[1][0]);
    assert.ok(lat >= bounds[0][1] && lat <= bounds[1][1]);
  }
});

test("an empty Plan draws nothing and says so quietly", () => {
  const route = buildRoute([], []);
  assert.equal(route.arcs.features.length, 0);
  assert.equal(route.stops.features.length, 0);
  assert.equal(route.bounds, null);
  assert.deepEqual(unmappedLegs([]), []);
});
