/**
 * The itinerary, as geography.
 *
 * The globe used to draw `lib/demo-route.ts` — a fixed nine-point sequence from
 * the prototype era. That was true of a Plan nobody has any more: the engine
 * derives Legs from the Day sequence (`lib/engine/legs.ts`), so the itinerary
 * flies Sydney → Hobart → Cairns while the old list still drew Sydney → Cairns
 * → Gold Coast → Hobart. Two answers to "where does this trip go", and the map
 * had the wrong one (#87).
 *
 * So this module turns the **current Scenario's Legs** into the two things the
 * map draws — arcs and stops — plus the bounds that frame them. It is pure and
 * React-free: the same Legs the Ledger's transit rows read go in, GeoJSON comes
 * out, and the stage does nothing but hand it to Mapbox.
 *
 * ## One resolver, four tiers
 *
 * A Leg names two ends: a Location id (`margaret-river`, `origin`) and an IATA
 * code (`PER`, `VLC`). Neither is a coordinate, and the places worth drawing
 * are not their airports — Port Douglas is 60 km north of the Cairns terminal
 * and Margaret River is three hours from Perth's. `resolveEndpoint` is the one
 * place that answers "where is this end?", in the order of how much we actually
 * know:
 *
 * 1. **place** — the Location's own coordinates (`lib/engine/locations.ts`).
 * 2. **capsule** — a researched Capsule's base, where the Location table has no
 *    coordinates but a Capsule runs its itinerary out of that gateway.
 * 3. **airport** — the terminal itself, from `lib/airports.ts` or the
 *    international gateways below. Exact for the origin, whose end genuinely
 *    *is* an airport; approximate for anywhere else, and said so.
 * 4. **unknown** — nothing places it, so the Leg is not drawn and is reported
 *    in `unmapped` rather than crashing the stage.
 *
 * ## …and one Leg that overrules the order
 *
 * The tiers answer "where is this place?", which is the right question for a
 * marker and the wrong one for the end of a crossing. A plane from Valencia
 * lands at **Perth**; it does not land at whichever block the Scheduler put
 * first. The engine names that Leg's far end by the Location the couple is
 * heading for (`mundaring`, and on the Plan the user was looking at,
 * `margaret-river`), so tier 1 answered with the town's own coordinates and
 * drew a 13,000 km arc terminating three hours down the Bussell Highway (#95).
 *
 * So an international Leg — one with a non-Australian gateway at either end —
 * resolves **both** its ends at their terminals through `atAirport`, whatever
 * the tiers would otherwise say. The stops are unaffected: `routeStops` asks
 * the tiers, so the marker stays on the town while the arc ends at PER.
 *
 * ## Flights are drawn; drives are looked up
 *
 * A flight's line is invented here — a great circle, because that is what an
 * aeroplane flies. A drive's is not: it is the road, from
 * `lib/route-polylines.json`, fetched once from Mapbox Directions and checked
 * in. Perth to Margaret River drawn as a great circle was a ruler line over
 * the Darling Scarp; drawn as the Bussell Highway it is recognisably the day
 * it actually is. A pair with no stored road — the Rottnest ferry, and
 * anything added since the last refresh — falls back to the line this module
 * draws, which is the ferry's correct rendering anyway.
 */

import { AIRPORT_COORDINATES, type Coordinates } from "@/lib/airports";
import { DEEP_CAPSULES } from "@/lib/deep-capsules";
import { LOCATIONS, locationById } from "@/lib/engine/locations";
import type { Day, Leg, LegMode } from "@/lib/engine/types";
import { roadBetween } from "@/lib/route-polylines";

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

const DEGREES = Math.PI / 180;

/**
 * Points along the great-circle path between two coordinates.
 *
 * Mapbox will draw a straight LineString between two far-apart vertices as a
 * straight line in projected space, which on a globe cuts through the sphere's
 * geometry and reads as a ruler line rather than a flight. Interpolating the
 * great circle gives the arc a plane actually flies.
 *
 * Two degenerate cases return the bare pair instead of interpolating, because
 * the interpolation divides by `sin(d)`: coincident ends (d = 0), and
 * antipodal ones (d = π), where there is no shortest path to pick and the
 * division would put `NaN` into a Mapbox source. Valencia and Melbourne are
 * ~157° apart, which is close enough to that pole to be worth the guard.
 */
export function greatCircle(
  from: Coordinates,
  to: Coordinates,
  segments = 96,
): Coordinates[] {
  const [lon1, lat1] = [from[0] * DEGREES, from[1] * DEGREES];
  const [lon2, lat2] = [to[0] * DEGREES, to[1] * DEGREES];

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
      ),
    );

  const spread = Math.sin(d);
  if (d === 0 || spread === 0) return [from, to];

  const points: Coordinates[] = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const a = Math.sin((1 - f) * d) / spread;
    const b = Math.sin(f * d) / spread;
    const x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2);
    const y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2);
    const z = a * Math.sin(lat1) + b * Math.sin(lat2);
    points.push([
      Math.atan2(y, x) / DEGREES,
      Math.atan2(z, Math.sqrt(x * x + y * y)) / DEGREES,
    ]);
  }
  return points;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle kilometres between two coordinates. */
export function kmBetween(from: Coordinates, to: Coordinates): number {
  const dLat = (to[1] - from[1]) * DEGREES;
  const dLon = (to[0] - from[0]) * DEGREES;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from[1] * DEGREES) *
      Math.cos(to[1] * DEGREES) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Above this, a Leg is drawn as a long-haul: heavier line, full opacity.
 *
 * The distinction the map is making is "the committed, expensive part of the
 * trip" versus "a hop", and 4,000 km is where those separate for this
 * itinerary: Perth→Sydney is 3,290 km and reads as a hop, while every crossing
 * to or from Europe is over 13,000 km. Measured rather than listed by route, so
 * a Scenario that invents a pair nobody wrote down still gets the right weight.
 */
const LONG_HAUL_KM = 4_000;

/* ------------------------------------------------------------------ */
/* Where a Leg's ends are                                              */
/* ------------------------------------------------------------------ */

/**
 * The international gateways, which `lib/airports.ts` does not carry.
 *
 * That table is the Catalog's — every `nearest_airport` in 413 Australian
 * ideas — so it has no Valencia and no Singapore. The crossings at either end
 * of every Scenario need them, and the outbound hubs are on the fares grid
 * (`lib/flights/grid.ts`), so a Scenario routed through Madrid or Istanbul
 * draws rather than vanishing.
 *
 * Each carries its city as well as its coordinates. Home is the one end of
 * every trip that has no Location behind it, and the engine calls it by its
 * IATA code — right for a ledger row, wrong for the one label on the European
 * side of a map whose whole job is saying where things are.
 */
export const GATEWAYS: Readonly<
  Record<string, { at: Coordinates; city: string }>
> = {
  VLC: { at: [-0.3763, 39.4699], city: "Valencia" }, // home: every Plan's first and last end
  BCN: { at: [2.0785, 41.2971], city: "Barcelona" },
  MAD: { at: [-3.5676, 40.4722], city: "Madrid" },
  MXP: { at: [8.7281, 45.6306], city: "Milan" },
  CDG: { at: [2.5479, 49.0097], city: "Paris" },
  LHR: { at: [-0.4543, 51.47], city: "London" },
  FRA: { at: [8.5622, 50.0379], city: "Frankfurt" },
  MUC: { at: [11.7861, 48.3537], city: "Munich" },
  FCO: { at: [12.2508, 41.8003], city: "Rome" },
  AMS: { at: [4.7639, 52.3105], city: "Amsterdam" },
  ZRH: { at: [8.5492, 47.4647], city: "Zurich" },
  VIE: { at: [16.5697, 48.1103], city: "Vienna" },
  IST: { at: [28.7519, 41.2753], city: "Istanbul" },
  BRU: { at: [4.4844, 50.9014], city: "Brussels" },
  SIN: { at: [103.9915, 1.3644], city: "Singapore" }, // the stopover the crossings use
};

/** A researched Capsule's base, by the gateway it is reached through. */
const CAPSULE_BASE_BY_AIRPORT: ReadonlyMap<string, Coordinates> = new Map(
  DEEP_CAPSULES.map((capsule) => [capsule.airport, capsule.base]),
);

/** How well an end of a Leg is placed. */
export type EndpointSource = "place" | "capsule" | "airport" | "unknown";

export interface RouteEndpoint {
  locationId: string;
  /** IATA the Leg names for this end. */
  code: string;
  /** "Margaret River", or the IATA code where the end is home rather than a place. */
  name: string;
  at: Coordinates | null;
  source: EndpointSource;
  /**
   * True when we know only which airport reaches the place, not where the place
   * is. The origin is exempt: a crossing's end genuinely *is* the terminal.
   */
  approximate: boolean;
}

/** Whether this end of a Leg is home rather than a place on the trip. */
function isOrigin(locationId: string): boolean {
  return locationId === "origin";
}

/**
 * The Locations the research actually wrote down.
 *
 * `locationById` invents one for any id it does not know, filling its
 * coordinates in from the airport table — which is the right answer for
 * pricing a drive and the wrong one for this module, because it erases the
 * difference between "Port Douglas is here" and "we only know it flies into
 * Cairns". The resolver reads the table directly so that difference survives.
 */
const KNOWN_LOCATIONS = new Map(
  LOCATIONS.map((location) => [location.id, location]),
);

export interface ResolveOptions {
  /**
   * Resolve at the terminal rather than at the place, and call it exact.
   *
   * Set for the ends of an international Leg, where the terminal is not an
   * approximation of the place — it is where the aircraft actually touches
   * down, and the drive inland is a different Leg with its own line in the
   * ledger.
   */
  atAirport?: boolean;
}

/**
 * Where one end of a Leg is — the single answer the whole map is drawn from.
 *
 * Never throws and never guesses: an end nothing places comes back with
 * `at: null` and `source: "unknown"`, which the arc builder turns into a Leg
 * that is reported rather than drawn.
 */
export function resolveEndpoint(
  locationId: string,
  code: string,
  options: ResolveOptions = {},
): RouteEndpoint {
  const home = isOrigin(locationId);
  const name = home
    ? (GATEWAYS[code]?.city ?? code)
    : locationById(locationId).name;

  if (options.atAirport) {
    const gate = AIRPORT_COORDINATES[code] ?? GATEWAYS[code]?.at ?? null;
    if (gate) {
      return {
        locationId,
        code,
        name,
        at: gate,
        source: "airport",
        // Not a guess: the crossing lands here by definition.
        approximate: false,
      };
    }
    // No coordinates for the terminal — fall through to the tiers, which is
    // better than losing the Leg over a gateway nobody has plotted yet.
  }

  const place = KNOWN_LOCATIONS.get(locationId)?.coords ?? null;
  if (place) {
    return { locationId, code, name, at: place, source: "place", approximate: false };
  }

  const base = CAPSULE_BASE_BY_AIRPORT.get(code);
  if (base) {
    return { locationId, code, name, at: base, source: "capsule", approximate: false };
  }

  const terminal = AIRPORT_COORDINATES[code] ?? GATEWAYS[code]?.at ?? null;
  if (terminal) {
    return {
      locationId,
      code,
      name,
      at: terminal,
      source: "airport",
      // Home is an airport. Anywhere else, an airport is the nearest we can put
      // it — the map says so with a dotted line rather than pretending.
      approximate: !home,
    };
  }

  return { locationId, code, name, at: null, source: "unknown", approximate: true };
}

/**
 * Whether this Leg's ends are terminals rather than places.
 *
 * True for the crossings, and only for them: a Leg is international when
 * either end is one of the `GATEWAYS` — the table is every airport outside
 * Australia the Plan can route through — or when either end is home, which is
 * an airport whether or not the gateway table has heard of it.
 *
 * Domestic hops are deliberately left on the tiers. Perth → Sydney between two
 * researched Locations is a line between two cities, and redrawing it terminal
 * to terminal would move both ends without telling the reader anything: the
 * arc that lands 60 km from Port Douglas is honest about Cairns being the
 * gateway, while a crossing that stops in the Margaret River vineyards is not
 * honest about anything.
 */
export function legEndsAtAirports(leg: {
  mode: LegMode;
  from: string;
  to: string;
  fromLocationId: string;
  toLocationId: string;
}): boolean {
  if (leg.mode !== "flight") return false;
  return (
    leg.from in GATEWAYS ||
    leg.to in GATEWAYS ||
    isOrigin(leg.fromLocationId) ||
    isOrigin(leg.toLocationId)
  );
}

/* ------------------------------------------------------------------ */
/* Arcs                                                                */
/* ------------------------------------------------------------------ */

export interface RouteArcProperties {
  /** The Leg's own id — "PER>SYD@2026-12-28". The popup is keyed on it. */
  id: string;
  date: string;
  from: string;
  to: string;
  fromName: string;
  toName: string;
  mode: LegMode;
  /** Long-hauls are drawn heavier than the domestic hops. */
  longHaul: boolean;
  /** True when an end is placed at its gateway rather than at itself. */
  approximate: boolean;
  /**
   * True when the line is the road, from `lib/route-polylines.json`, rather
   * than geometry this module invented. A drive with no stored road is drawn
   * straight and this is false — which is also the right answer for the
   * Rottnest ferry, where there is no road to fetch.
   */
  road: boolean;
  /** One sentence, shown wherever an approximate arc is explained. */
  title: string;
}

/** A Leg the map could not place, and why. Reported, never thrown. */
export interface UnmappedLeg {
  id: string;
  reason: string;
}

const MODE_VERB: Record<LegMode, string> = {
  flight: "Flight",
  drive: "Drive",
  train: "Train",
  ferry: "Ferry",
};

/** Why an arc is dotted and straight rather than a flown curve. */
function approximateTitle(from: RouteEndpoint, to: RouteEndpoint): string {
  const vague = [from, to]
    .filter((end) => end.approximate)
    .map((end) => `${end.name} at ${end.code}`)
    .join(" and ");
  return `Drawn straight: we know only the airport for ${vague}, not where the stay is.`;
}

/**
 * The Legs as lines. Order is the Legs' own — the sequence the trip flies.
 */
export function routeArcsGeoJSON(
  legs: readonly Leg[],
): GeoJSON.FeatureCollection<GeoJSON.LineString, RouteArcProperties> {
  const features: GeoJSON.Feature<GeoJSON.LineString, RouteArcProperties>[] = [];

  for (const leg of legs) {
    const ends: ResolveOptions = { atAirport: legEndsAtAirports(leg) };
    const from = resolveEndpoint(leg.fromLocationId, leg.from, ends);
    const to = resolveEndpoint(leg.toLocationId, leg.to, ends);
    if (!from.at || !to.at) continue;

    const approximate = from.approximate || to.approximate;
    // A drive follows the road where somebody has fetched it. Only where both
    // ends are placed: a road drawn to a gateway airport would be a precise
    // claim about a vague end, which is the thing the dotted line is for.
    const road =
      leg.mode === "drive" && !approximate
        ? roadBetween(leg.fromLocationId, leg.toLocationId)
        : null;

    features.push({
      type: "Feature",
      properties: {
        id: leg.id,
        date: leg.date,
        from: leg.from,
        to: leg.to,
        fromName: from.name,
        toName: to.name,
        mode: leg.mode,
        longHaul: kmBetween(from.at, to.at) >= LONG_HAUL_KM,
        approximate,
        road: Boolean(road),
        title: approximate
          ? approximateTitle(from, to)
          : road
            ? `${MODE_VERB[leg.mode]} — ${from.name} to ${to.name}, by road.`
            : `${MODE_VERB[leg.mode]} — ${from.name} to ${to.name}.`,
      },
      geometry: {
        type: "LineString",
        // An approximate end has not earned a flown curve: a great circle
        // between two guesses is a precise-looking claim about a vague one.
        coordinates:
          road ?? (approximate ? [from.at, to.at] : greatCircle(from.at, to.at)),
      },
    });
  }

  return { type: "FeatureCollection", features };
}

/** Every Leg whose ends nothing could place. */
export function unmappedLegs(legs: readonly Leg[]): UnmappedLeg[] {
  const unmapped: UnmappedLeg[] = [];
  for (const leg of legs) {
    const ends: ResolveOptions = { atAirport: legEndsAtAirports(leg) };
    const from = resolveEndpoint(leg.fromLocationId, leg.from, ends);
    const to = resolveEndpoint(leg.toLocationId, leg.to, ends);
    const lost = [from, to].filter((end) => !end.at);
    if (lost.length === 0) continue;
    unmapped.push({
      id: leg.id,
      reason: `No coordinates for ${lost.map((end) => `${end.name} (${end.code})`).join(" or ")}.`,
    });
  }
  return unmapped;
}

/* ------------------------------------------------------------------ */
/* Stops                                                               */
/* ------------------------------------------------------------------ */

export type RouteStopKind = "origin" | "hub" | "stop" | "finish";

export interface RouteStopProperties {
  /** The Location id, which is what makes two Perth-gateway stays two stops. */
  id: string;
  code: string;
  name: string;
  kind: RouteStopKind;
  /** Position in the flown sequence, 0-based. */
  order: number;
  /** Days of the Plan spent here. Zero on a pure connection. */
  nights: number;
  /** The Adventure this stop is for, so the marker can open its card. "" if none. */
  capsuleId: string;
  /**
   * The one stop at this gateway whose label draws at every zoom.
   *
   * Three of the eight stops on the reference trip are reached through Perth,
   * and three always-on labels stacked on the same corner of the continent is
   * a smudge. The longest stay at each gateway carries the region's label; the
   * others get theirs once the camera is close enough for them to separate.
   */
  major: boolean;
  approximate: boolean;
}

/**
 * The places the Legs join up, in flown order.
 *
 * Deduplicated by Location, not by airport: Margaret River, Rottnest and Perth
 * are three stops on one gateway and the trip visits all three. A Location
 * returned to later in the trip (the Comfortable Scenario flies back to Perth)
 * is one marker holding every night spent there, at the order it was first
 * reached — a second dot on the same pixel is not a second place.
 */
export function routeStops(
  legs: readonly Leg[],
  days: readonly Day[] = [],
): GeoJSON.FeatureCollection<GeoJSON.Point, RouteStopProperties> {
  const nightsByLocation = new Map<string, number>();
  const capsuleByLocation = new Map<string, string>();
  for (const day of days) {
    nightsByLocation.set(
      day.locationId,
      (nightsByLocation.get(day.locationId) ?? 0) + 1,
    );
    if (day.capsuleId && !capsuleByLocation.has(day.locationId)) {
      capsuleByLocation.set(day.locationId, day.capsuleId);
    }
  }

  const ordered: RouteEndpoint[] = [];
  for (const [index, leg] of legs.entries()) {
    if (index === 0) ordered.push(resolveEndpoint(leg.fromLocationId, leg.from));
    ordered.push(resolveEndpoint(leg.toLocationId, leg.to));
  }

  type PlacedEndpoint = RouteEndpoint & { at: Coordinates };
  const seen = new Map<string, PlacedEndpoint>();
  for (const endpoint of ordered) {
    const at = endpoint.at;
    if (!at) continue;
    if (!seen.has(endpoint.locationId)) {
      seen.set(endpoint.locationId, { ...endpoint, at });
    }
  }

  const stops = [...seen.values()];
  /**
   * The last place the trip **stays**, which is not the last place it touches.
   *
   * Since the crossings became sector pairs the final endpoint on the list is
   * Barcelona, a connection the couple spends an hour in before the train home
   * — and calling that the finish of a ten-week trip is a sentence about the
   * wrong place. The finish is Melbourne: the last stop that has nights in it.
   */
  const lastIndex = stops.reduce(
    (last, stop, index) =>
      (nightsByLocation.get(stop.locationId) ?? 0) > 0 ? index : last,
    -1,
  );

  // One always-on label per gateway: the longest stay wins it.
  const majorByCode = new Map<string, string>();
  for (const stop of stops) {
    const nights = nightsByLocation.get(stop.locationId) ?? 0;
    const held = majorByCode.get(stop.code);
    if (!held || nights > (nightsByLocation.get(held) ?? 0)) {
      majorByCode.set(stop.code, stop.locationId);
    }
  }

  return {
    type: "FeatureCollection",
    features: stops.map((stop, order) => {
      const nights = nightsByLocation.get(stop.locationId) ?? 0;
      const kind: RouteStopKind = isOrigin(stop.locationId)
        ? "origin"
        : order === lastIndex
          ? "finish"
          : nights === 0
            ? "hub"
            : "stop";
      return {
        type: "Feature" as const,
        properties: {
          id: stop.locationId,
          code: stop.code,
          name: stop.name,
          kind,
          order,
          nights,
          capsuleId: capsuleByLocation.get(stop.locationId) ?? "",
          major: majorByCode.get(stop.code) === stop.locationId,
          approximate: stop.approximate,
        },
        geometry: { type: "Point" as const, coordinates: stop.at },
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* The whole thing                                                     */
/* ------------------------------------------------------------------ */

export type RouteBounds = [[number, number], [number, number]];

/** Corner to corner of everything drawn, or null when nothing is. */
export function routeBounds(
  stops: GeoJSON.FeatureCollection<GeoJSON.Point, RouteStopProperties>,
): RouteBounds | null {
  const points = stops.features.map(
    (feature) => feature.geometry.coordinates as Coordinates,
  );
  if (points.length === 0) return null;
  const lons = points.map((point) => point[0]);
  const lats = points.map((point) => point[1]);
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ];
}

/** Everything the stage needs to draw one itinerary. */
export interface RouteGeometry {
  arcs: GeoJSON.FeatureCollection<GeoJSON.LineString, RouteArcProperties>;
  stops: GeoJSON.FeatureCollection<GeoJSON.Point, RouteStopProperties>;
  bounds: RouteBounds | null;
  /** Legs nothing could place. The stage draws the rest and says nothing. */
  unmapped: UnmappedLeg[];
}

/** The current Plan's Legs and Days, as the globe draws them. */
export function buildRoute(
  legs: readonly Leg[],
  days: readonly Day[] = [],
): RouteGeometry {
  const stops = routeStops(legs, days);
  return {
    arcs: routeArcsGeoJSON(legs),
    stops,
    bounds: routeBounds(stops),
    unmapped: unmappedLegs(legs),
  };
}

/* ------------------------------------------------------------------ */
/* The pre-hydration skeleton                                          */
/* ------------------------------------------------------------------ */

/**
 * One node of the static route the globe draws before the client store is
 * read. `lib/demo-route.ts` holds the list; this builds it into the same shapes
 * the live Legs make, so the map's layers never learn there are two sources.
 */
export interface SkeletonPoint {
  code: string;
  name: string;
  coordinates: Coordinates;
  kind: RouteStopKind;
  /** Mode of the Leg leaving this point. The last point has none. */
  modeOut?: LegMode;
}

export function routeFromPoints(
  points: readonly SkeletonPoint[],
): RouteGeometry {
  const arcs: GeoJSON.Feature<GeoJSON.LineString, RouteArcProperties>[] =
    points.slice(0, -1).map((point, index) => {
      const next = points[index + 1];
      const mode = point.modeOut ?? "flight";
      return {
        type: "Feature",
        properties: {
          id: `${point.code}>${next.code}`,
          date: "",
          from: point.code,
          to: next.code,
          fromName: point.name,
          toName: next.name,
          mode,
          longHaul: kmBetween(point.coordinates, next.coordinates) >= LONG_HAUL_KM,
          approximate: false,
          // The skeleton is a placeholder for a Plan nobody has read yet;
          // there is no Leg behind it to look a road up for.
          road: false,
          title: `${MODE_VERB[mode]} — ${point.name} to ${next.name}.`,
        },
        geometry: {
          type: "LineString",
          coordinates: greatCircle(point.coordinates, next.coordinates),
        },
      };
    });

  const stops: GeoJSON.FeatureCollection<GeoJSON.Point, RouteStopProperties> = {
    type: "FeatureCollection",
    features: points.map((point, order) => ({
      type: "Feature" as const,
      properties: {
        id: point.code,
        code: point.code,
        name: point.name,
        kind: point.kind,
        order,
        nights: 0,
        capsuleId: "",
        major: true,
        approximate: false,
      },
      geometry: { type: "Point" as const, coordinates: point.coordinates },
    })),
  };

  return {
    arcs: { type: "FeatureCollection", features: arcs },
    stops,
    bounds: routeBounds(stops),
    unmapped: [],
  };
}
