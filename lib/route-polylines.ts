/**
 * The roads, as checked-in geometry.
 *
 * A flight is a great circle and a drive is not: Perth to Margaret River is
 * three hours down the Bussell Highway, and the straight line the globe used to
 * draw for it made a day behind the wheel look like a second flight (#95). The
 * shape of the actual road comes from Mapbox Directions, fetched once by
 * `scripts/fetch-route-polylines.mjs` and committed as `route-polylines.json`.
 *
 * **Checked in rather than fetched at runtime**, deliberately. There are five
 * drives on the reference trip and their ends move only when somebody edits
 * `lib/engine/locations.ts`; a per-load Directions call would spend quota and
 * add a network dependency to answer a question whose answer is in the
 * repository. The refresh is a script somebody runs on purpose, which is the
 * same shape the fare snapshots already have.
 *
 * A pair with no entry — Rottnest, which has no road to it, and any Location
 * added since the last refresh — falls back to the straight line the map drew
 * before. The fallback is the ferry's correct rendering as well as the
 * unknown's, which is why it is a silent one.
 */

import type { Coordinates } from "@/lib/airports";
import ROUTE_POLYLINES from "@/lib/route-polylines.json";

/**
 * How many points a stored road may have.
 *
 * Mapbox returns the full geometry — 1,700-odd points for the run up to Morawa
 * — which is more detail than a line 1.8 px wide on a globe can show and more
 * bytes than the first paint should carry. Two hundred holds every bend that
 * reads at continent zoom and is small enough that all of them together are a
 * few tens of kilobytes.
 */
export const POLYLINE_MAX_POINTS = 200;

/** One stored road. The script writes these; nothing else does. */
export interface RoutePolyline {
  /** "mundaring>perth" — Location ids, in the direction driven. */
  pairKey: string;
  coords: Coordinates[];
  /** Road kilometres Directions reported, before simplification. */
  km?: number;
  /** ISO date of the fetch, so a stale file can be spotted. */
  fetchedAt: string;
  source: "mapbox-directions";
}

/** The key a pair of Locations is stored under. */
export function pairKeyOf(fromLocationId: string, toLocationId: string): string {
  return `${fromLocationId}>${toLocationId}`;
}

// The JSON is data the script wrote to this shape; TypeScript only knows it as
// arrays of numbers, and this is the one place that is reconciled.
const ROADS = new Map(
  (ROUTE_POLYLINES as unknown as RoutePolyline[]).map((road) => [
    road.pairKey,
    road,
  ]),
);

/**
 * The road between two Locations, in the direction asked for — or null when
 * nothing has been fetched for them.
 *
 * The reverse of a stored road is that road backwards. Roads are not quite
 * symmetric (one-way streets, and Directions may pick a different exit), but
 * they are symmetric enough at the scale this is drawn, and halving the number
 * of stored routes is worth more than a divided carriageway nobody can see.
 */
export function roadBetween(
  fromLocationId: string,
  toLocationId: string,
): Coordinates[] | null {
  const forward = ROADS.get(pairKeyOf(fromLocationId, toLocationId));
  if (forward) return forward.coords;

  const backward = ROADS.get(pairKeyOf(toLocationId, fromLocationId));
  if (backward) return [...backward.coords].reverse();

  return null;
}

/** Every stored road, for the tests and for anything that audits the file. */
export function storedRoads(): readonly RoutePolyline[] {
  return ROUTE_POLYLINES as unknown as RoutePolyline[];
}
