/**
 * Fetch the road geometry for every drive on the Plan, once, and check it in.
 *
 * ```
 * npm run fetch:polylines            # prints what it would fetch
 * npm run fetch:polylines -- --write # fetches, simplifies, writes the JSON
 * ```
 *
 * ## Why a script and a checked-in file
 *
 * A drive is not a great circle. Perth to Margaret River is three hours down
 * the Bussell Highway and the coast road back; drawn as the straight line the
 * globe was drawing, it reads as a flight path over the Darling Scarp and says
 * nothing about the day it actually is (#95). Mapbox Directions knows the road,
 * and the public token the map already carries covers it.
 *
 * What it does not cover is asking it again on every page load. There are five
 * drives on the reference trip and their coordinates change when somebody edits
 * `lib/engine/locations.ts`, which is roughly never — so the honest shape is a
 * **build-time fact**: fetch once, simplify, commit the result, and let the
 * renderer read a file. Deterministic, no runtime spend, no key on the client
 * beyond the one that is already there, and a map that draws the same roads
 * offline as online.
 *
 * ## What it fetches
 *
 * Every drive pair the three seeded Scenarios contain, plus `EXTRA_PAIRS`
 * below — the shapes the WA leg takes when the couple drags it around, so a
 * rearranged calendar still finds a road. Endpoints come from
 * `resolveEndpoint`, the same resolver the map draws from, so a polyline can
 * never start somewhere the arc does not.
 *
 * Pairs Directions cannot route are recorded in the run's summary and left out
 * of the file. That is not a failure: Rottnest is an island, and the ferry to
 * it is supposed to be a straight dotted line rather than an invented road.
 *
 * Run through the same loader the tests use, so the script reads the project's
 * own TypeScript rather than keeping a second copy of the geography:
 * `node --import ./lib/engine/__tests__/alias-hook.mjs --env-file=.env.local`.
 */

import { writeFile } from "node:fs/promises";

import { capsuleCatalogue } from "@/lib/engine/capsules";
import { buildPlan } from "@/lib/engine/plan";
import {
  AGGRESSIVE_SCENARIO,
  COMFORTABLE_SCENARIO,
  DEFAULT_SCENARIO,
} from "@/lib/engine/scenario-doc";
import { pairKeyOf, POLYLINE_MAX_POINTS } from "@/lib/route-polylines";
import { resolveEndpoint } from "@/lib/route-geo";

const write = process.argv.includes("--write");
const OUT = new URL("../lib/route-polylines.json", import.meta.url);

/**
 * Drives the seeded Scenarios do not currently contain but a drag can produce.
 *
 * The WA leg is one base and four destinations, and which of them are adjacent
 * depends on where the Scheduler puts the blocks: move Rottnest a day and the
 * Christmas run starts from the Hills instead. Fetching the base's other pairs
 * now costs four requests and means a rearranged calendar still draws roads.
 */
const EXTRA_PAIRS = [
  ["mundaring", "margaret-river"],
  ["margaret-river", "mundaring"],
  ["mundaring", "morawa"],
  ["morawa", "mundaring"],
  ["perth", "morawa"],
  ["perth", "mundaring"],
];

/** Every drive pair the seeded Plans contain, as location-id pairs. */
function pairsFromScenarios() {
  const pairs = [];
  for (const scenario of [
    DEFAULT_SCENARIO,
    COMFORTABLE_SCENARIO,
    AGGRESSIVE_SCENARIO,
  ]) {
    const plan = buildPlan(
      scenario.input,
      capsuleCatalogue(scenario.input.toggled),
    );
    for (const leg of plan.legs) {
      if (leg.mode !== "drive") continue;
      pairs.push([leg.fromLocationId, leg.toLocationId, leg.from, leg.to]);
    }
  }
  return pairs;
}

/**
 * Douglas–Peucker, so a 1,700-point highway becomes a line that still looks
 * like the highway.
 *
 * Tolerance is in degrees and the search is for the coarsest one that comes in
 * under the cap: simplifying to a fixed tolerance would leave a short suburban
 * run over-detailed and a 400 km one still too big.
 */
function simplify(points, maxPoints) {
  if (points.length <= maxPoints) return points;
  let tolerance = 0.0005;
  let out = points;
  for (let attempt = 0; attempt < 24 && out.length > maxPoints; attempt += 1) {
    out = douglasPeucker(points, tolerance);
    tolerance *= 1.6;
  }
  return out;
}

function douglasPeucker(points, tolerance) {
  if (points.length < 3) return points;

  const [first] = points;
  const last = points[points.length - 1];
  let index = 0;
  let worst = 0;

  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicular(points[i], first, last);
    if (distance > worst) {
      worst = distance;
      index = i;
    }
  }

  if (worst <= tolerance) return [first, last];
  return [
    ...douglasPeucker(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...douglasPeucker(points.slice(index), tolerance),
  ];
}

/** Point-to-segment distance in degrees. Good enough at these latitudes. */
function perpendicular(point, start, end) {
  const [x, y] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = Math.max(
    0,
    Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

/**
 * One coordinate per line rather than `JSON.stringify`'s six.
 *
 * The file is read by people as well as by the renderer — it is the thing a
 * reviewer checks when a road looks wrong — and a thousand coordinates spread
 * over six thousand lines is neither readable nor a reviewable diff.
 */
function serialise(entries) {
  const blocks = entries.map((entry) => {
    const coords = entry.coords
      .map(([lon, lat]) => `      [${lon}, ${lat}]`)
      .join(",\n");
    return [
      "  {",
      `    "pairKey": ${JSON.stringify(entry.pairKey)},`,
      `    "km": ${entry.km},`,
      `    "fetchedAt": ${JSON.stringify(entry.fetchedAt)},`,
      `    "source": ${JSON.stringify(entry.source)},`,
      '    "coords": [',
      coords,
      "    ]",
      "  }",
    ].join("\n");
  });
  return `[\n${blocks.join(",\n")}\n]\n`;
}

/** Six decimals is ~11 cm. Anything more is bytes nobody can see. */
const round = ([lon, lat]) => [
  Math.round(lon * 1e6) / 1e6,
  Math.round(lat * 1e6) / 1e6,
];

async function fetchRoute(token, from, to) {
  const coordinates = `${from[0]},${from[1]};${to[0]},${to[1]}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}` +
    `?geometries=geojson&overview=full&access_token=${token}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${await response.text()}`);
  }
  const body = await response.json();
  if (body.code !== "Ok" || !body.routes?.length) {
    return { route: null, reason: body.code ?? "NoRoute" };
  }
  const route = body.routes[0];
  return {
    route: route.geometry.coordinates,
    km: Math.round(route.distance / 100) / 10,
  };
}

const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
if (!token) {
  console.error(
    "No NEXT_PUBLIC_MAPBOX_TOKEN. Run with --env-file=.env.local (npm run fetch:polylines).",
  );
  process.exit(1);
}

const wanted = new Map();
for (const [fromId, toId, from, to] of [
  ...pairsFromScenarios(),
  ...EXTRA_PAIRS.map(([fromId, toId]) => [fromId, toId, "PER", "PER"]),
]) {
  const key = pairKeyOf(fromId, toId);
  // One direction per road: `roadBetween` reads a stored road backwards, and a
  // divided carriageway is not visible at the scale any of this is drawn.
  if (wanted.has(key) || wanted.has(pairKeyOf(toId, fromId))) continue;
  wanted.set(key, { fromId, toId, from, to });
}

console.log(`${wanted.size} unique drive pairs:`);
for (const key of wanted.keys()) console.log(`  ${key}`);
if (!write) {
  console.log("\nDry run. Re-run with --write to fetch and save.");
  process.exit(0);
}

const fetchedAt = new Date().toISOString().slice(0, 10);
const routes = [];
const skipped = [];

for (const [pairKey, pair] of wanted) {
  const from = resolveEndpoint(pair.fromId, pair.from);
  const to = resolveEndpoint(pair.toId, pair.to);
  if (!from.at || !to.at) {
    skipped.push(`${pairKey}: no coordinates for one end`);
    continue;
  }

  try {
    const { route, reason, km } = await fetchRoute(token, from.at, to.at);
    if (!route) {
      skipped.push(`${pairKey}: ${reason} — drawn straight`);
      continue;
    }
    const coords = simplify(route, POLYLINE_MAX_POINTS).map(round);
    routes.push({
      pairKey,
      coords,
      km,
      fetchedAt,
      source: "mapbox-directions",
    });
    console.log(`  ${pairKey}: ${km} km, ${route.length} → ${coords.length} pts`);
  } catch (error) {
    skipped.push(`${pairKey}: ${error.message}`);
  }
}

routes.sort((a, b) => a.pairKey.localeCompare(b.pairKey));
await writeFile(OUT, serialise(routes));

console.log(`\nWrote ${routes.length} routes to lib/route-polylines.json`);
for (const line of skipped) console.log(`  skipped ${line}`);
