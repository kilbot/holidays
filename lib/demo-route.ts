/**
 * Static demo route for the Globe stage.
 *
 * This is the Fireworks-NYE Plan's Leg sequence rendered as geography:
 * Valencia → Barcelona → Singapore → Perth → Sydney → Cairns → Gold Coast
 * → Hobart → Melbourne. Legs are derived from the Capsule sequence in the
 * real domain model (see docs/CONTEXT.md); until the Scheduler exists this
 * module hard-codes the demo sequence so the globe has something true to draw.
 *
 * Coordinates are the real airport / city coordinates, [lon, lat].
 */

export type RoutePointKind = "origin" | "hub" | "stop" | "finish";

export interface RoutePoint {
  /** IATA code, or the city's colloquial short code for non-airport nodes. */
  code: string;
  name: string;
  /** [longitude, latitude] */
  coordinates: [number, number];
  kind: RoutePointKind;
  /** Human label for what happens here, shown on the marker popup later. */
  note: string;
}

export const ROUTE_POINTS: RoutePoint[] = [
  {
    code: "VLC",
    name: "Valencia",
    coordinates: [-0.3763, 39.4699],
    kind: "origin",
    note: "Home. Train out to Barcelona, 12 Dec.",
  },
  {
    code: "BCN",
    name: "Barcelona",
    coordinates: [2.0785, 41.2971],
    kind: "hub",
    note: "Long-haul departure — overnight in the Gòtic first.",
  },
  {
    code: "SIN",
    name: "Singapore",
    coordinates: [103.9915, 1.3644],
    kind: "hub",
    note: "Changi stopover — comfort-first routing.",
  },
  {
    code: "PER",
    name: "Perth",
    coordinates: [115.9672, -31.9403],
    kind: "stop",
    note: "Home base — family, borrowed car, Christmas anchor.",
  },
  {
    code: "SYD",
    name: "Sydney",
    coordinates: [151.1772, -33.9399],
    kind: "stop",
    note: "New Year's Eve anchor, 31 Dec.",
  },
  {
    code: "CNS",
    name: "Cairns",
    coordinates: [145.7551, -16.8858],
    kind: "stop",
    note: "Gateway to the Port Douglas reef window, from 18 Jan.",
  },
  {
    code: "OOL",
    name: "Gold Coast",
    coordinates: [153.5053, -28.1644],
    kind: "stop",
    note: "Shuttle south to Byron + Nimbin.",
  },
  {
    code: "HBA",
    name: "Hobart",
    coordinates: [147.5102, -42.8361],
    kind: "stop",
    note: "Tasmania arc begins — south to north, never the same road twice.",
  },
  {
    code: "MEL",
    name: "Melbourne",
    coordinates: [144.843, -37.669],
    kind: "finish",
    note: "Finale, then the long way home via Singapore.",
  },
];

const EARTH_RADIANS = Math.PI / 180;

/**
 * Points along the great-circle path between two coordinates.
 *
 * Mapbox will draw a straight LineString between two far-apart vertices as a
 * straight line in projected space, which on a globe cuts through the sphere's
 * geometry and reads as a ruler line rather than a flight. Interpolating the
 * great circle gives the arc a plane actually flies.
 */
function greatCircle(
  from: [number, number],
  to: [number, number],
  segments = 96,
): [number, number][] {
  const [lon1, lat1] = [from[0] * EARTH_RADIANS, from[1] * EARTH_RADIANS];
  const [lon2, lat2] = [to[0] * EARTH_RADIANS, to[1] * EARTH_RADIANS];

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
      ),
    );

  // Coincident points: nothing to interpolate.
  if (d === 0) return [from, to];

  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const a = Math.sin((1 - f) * d) / Math.sin(d);
    const b = Math.sin(f * d) / Math.sin(d);
    const x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2);
    const y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2);
    const z = a * Math.sin(lat1) + b * Math.sin(lat2);
    points.push([
      Math.atan2(y, x) / EARTH_RADIANS,
      Math.atan2(z, Math.sqrt(x * x + y * y)) / EARTH_RADIANS,
    ]);
  }
  return points;
}

export interface LegProperties {
  from: string;
  to: string;
  /** Long-haul legs are drawn heavier than the domestic hops. */
  longHaul: boolean;
}

export function routeLegsGeoJSON(): GeoJSON.FeatureCollection<
  GeoJSON.LineString,
  LegProperties
> {
  // The two ocean crossings that bookend the trip; everything else is a hop.
  const longHaulCodes = new Set(["BCN>SIN", "SIN>PER"]);

  return {
    type: "FeatureCollection",
    features: ROUTE_POINTS.slice(0, -1).map((point, index) => {
      const next = ROUTE_POINTS[index + 1];
      return {
        type: "Feature" as const,
        properties: {
          from: point.code,
          to: next.code,
          longHaul: longHaulCodes.has(`${point.code}>${next.code}`),
        },
        geometry: {
          type: "LineString" as const,
          coordinates: greatCircle(point.coordinates, next.coordinates),
        },
      };
    }),
  };
}

export interface PointProperties {
  code: string;
  name: string;
  kind: RoutePointKind;
  note: string;
  order: number;
}

export function routePointsGeoJSON(): GeoJSON.FeatureCollection<
  GeoJSON.Point,
  PointProperties
> {
  return {
    type: "FeatureCollection",
    features: ROUTE_POINTS.map((point, order) => ({
      type: "Feature" as const,
      properties: {
        code: point.code,
        name: point.name,
        kind: point.kind,
        note: point.note,
        order,
      },
      geometry: { type: "Point" as const, coordinates: point.coordinates },
    })),
  };
}

/**
 * Bounding box of the whole route, so the opening camera can be fitted to it
 * rather than guessed at a fixed zoom that only frames well on one viewport.
 * Europe lands top-left, Australia bottom-right.
 */
export const ROUTE_BOUNDS: [[number, number], [number, number]] = (() => {
  const lons = ROUTE_POINTS.map((p) => p.coordinates[0]);
  const lats = ROUTE_POINTS.map((p) => p.coordinates[1]);
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ];
})();

/**
 * Camera padding, in px, that keeps the route clear of the chrome: the
 * catalog drawer and cost HUD on the flanks, the date strip along the bottom.
 * On a phone the flanking panels are not docked, so the route can use the
 * full width.
 */
export const FRAME_PADDING = {
  desktop: { top: 90, bottom: 180, left: 320, right: 320 },
  compact: { top: 130, bottom: 215, left: 28, right: 28 },
} as const;

/** Matches the `lg:` breakpoint the layout switches on. */
export const DESKTOP_BREAKPOINT_PX = 1024;

/**
 * Below this width the opening camera is set explicitly instead of fitted.
 *
 * `fitBounds` does its sizing in projected space, and this bounding box spans
 * 152° of longitude — on a tall, narrow viewport its answer leaves the
 * Australian end of the route off the right edge. Verified at 390×844: the
 * fit drops Sydney, Melbourne and Cairns out of frame, while the camera
 * below holds the whole route. Tablet widths (768×1024 measured) fit fine.
 */
export const COMPACT_CAMERA_MAX_WIDTH_PX = 600;

/** Hand-framed on a 390×844 viewport; see COMPACT_CAMERA_MAX_WIDTH_PX. */
export const COMPACT_CAMERA = {
  center: [81, -8] as [number, number],
  zoom: 0.47,
};

/**
 * Zoom ceiling for the opening frame.
 *
 * Valencia and Melbourne are very nearly antipodal (≈157° apart), so the two
 * ends of the trip sit close to opposite edges of the visible cap. The closer
 * the camera, the smaller that cap gets — measured on a 1440×900 desktop,
 * Valencia drops behind the horizon somewhere above zoom ~1.6. Capping the
 * fit here keeps the origin marker on screen; a tighter frame would show a
 * route that appears to start over the Balkans.
 */
export const GLOBE_MAX_FIT_ZOOM = 1.55;

export const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";
