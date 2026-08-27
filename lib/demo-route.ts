/**
 * The route the globe draws before it has a Plan — and the camera constants
 * it draws every route with.
 *
 * The nine points below were the whole route once: a fixed illustration from
 * the prototype era, standing in for a Scheduler that did not exist yet. It
 * does now, so the arcs come from the current Scenario's derived Legs
 * (`lib/route-geo.ts`), and this list has one job left — a **skeleton**. The
 * stage is server-rendered and the Scenarios live in the client's own store,
 * so there is a frame or two before the real itinerary is knowable, and a
 * globe that draws nothing at all in that gap reads as a globe that is broken.
 *
 * It is a skeleton, not a claim: nothing is priced off it, nothing is clicked
 * on it, and it is replaced the moment the store is read.
 *
 * It still has to be the *same shape* as what replaces it, or the first frame
 * is a flicker of a different trip. The hubs are therefore the couple's own
 * pinned inbound routing — train to Madrid, Cathay to Hong Kong, Hong Kong to
 * Perth (`lib/engine/legs.ts`, `INBOUND`) — and not the Barcelona–Singapore
 * pair the research once defaulted to.
 *
 * Coordinates are the real airport / city coordinates, [lon, lat].
 */

import { routeFromPoints, type SkeletonPoint } from "@/lib/route-geo";

export const ROUTE_POINTS: readonly SkeletonPoint[] = [
  {
    code: "VLC",
    name: "Valencia",
    coordinates: [-0.3763, 39.4699],
    kind: "origin",
    modeOut: "train",
  },
  {
    code: "MAD",
    name: "Madrid",
    coordinates: [-3.5676, 40.4722],
    kind: "hub",
  },
  {
    code: "HKG",
    name: "Hong Kong",
    coordinates: [113.9185, 22.308],
    kind: "hub",
  },
  {
    code: "PER",
    name: "Perth",
    coordinates: [115.9672, -31.9403],
    kind: "stop",
  },
  {
    code: "SYD",
    name: "Sydney",
    coordinates: [151.1772, -33.9399],
    kind: "stop",
  },
  {
    code: "CNS",
    name: "Cairns",
    coordinates: [145.7551, -16.8858],
    kind: "stop",
  },
  {
    code: "OOL",
    name: "Gold Coast",
    coordinates: [153.5053, -28.1644],
    kind: "stop",
  },
  {
    code: "HBA",
    name: "Hobart",
    coordinates: [147.5102, -42.8361],
    kind: "stop",
  },
  {
    code: "MEL",
    name: "Melbourne",
    coordinates: [144.843, -37.669],
    kind: "finish",
  },
];

/** The skeleton, in the shapes the live route is built into. */
export const SKELETON_ROUTE = routeFromPoints(ROUTE_POINTS);

/**
 * Australia, corner to corner — the frame the globe opens on (#81).
 *
 * The route's own bounds answer "where does this trip go?", which is a
 * question you can only ask once you already care. The first frame has a
 * different job: a globe that opens on the Indian Ocean with a thread across
 * it is a diagram, and the traveller looking over your shoulder has no idea
 * which of those specks is the point. Opening *inside* Australia, filling the
 * screen with it, says what the trip is before a word is read — and getting
 * back to the whole route is the one button already sitting on the stage.
 *
 * Mainland plus Tasmania, and nothing else: the external territories put the
 * box out past Christmas Island and Norfolk and would zoom the continent back
 * down to make room for two dots nobody is flying to.
 *
 *   west   113.15°E  Steep Point, WA — the mainland's western tip
 *   east   153.64°E  Cape Byron, NSW — its eastern one, and a Capsule
 *   north  −10.69°   Cape York, QLD
 *   south  −43.65°   South East Cape, Tasmania
 *
 * The arcs run off-view at this zoom, Hong Kong and Valencia with them. That
 * is the trade the frame is making, not a bug in it.
 */
export const AUSTRALIA_BOUNDS: [[number, number], [number, number]] = [
  [113.15, -43.65],
  [153.64, -10.69],
];

/**
 * Camera padding, in px, that keeps the route clear of the chrome: the
 * catalog drawer and cost HUD on the flanks, the date strip along the bottom.
 * On a phone the flanking panels are not docked, so the route can use the
 * full width.
 */
export const FRAME_PADDING = {
  desktop: { top: 64, bottom: 156, left: 304, right: 288 },
  compact: { top: 110, bottom: 200, left: 28, right: 28 },
} as const;

/** Matches the `lg:` breakpoint the layout switches on. */
export const DESKTOP_BREAKPOINT_PX = 1024;

/**
 * Below this width the opening camera is set explicitly instead of fitted.
 *
 * `fitBounds` does its sizing in projected space, and the route's bounding box
 * spans ~152° of longitude — on a tall, narrow viewport its answer leaves the
 * Australian end of the route off the right edge. Verified at 390×844: the
 * fit drops Sydney, Melbourne and Cairns out of frame, while the camera
 * below holds the whole route. Tablet widths (768×1024 measured) fit fine.
 *
 * It stays a hand-framed camera now that the route is live because the span it
 * was framed for is the span every Scenario has: they all leave from Valencia
 * and they all come back to it, so the box is Europe-to-Australia whatever
 * happens in between.
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

/**
 * The globe commits to daylight, in both themes.
 *
 * `dark-v11` matched the chrome's dark palette and made the actual point of
 * the page — a continent worth flying 15,000km to look at — a grey smudge.
 * `outdoors-v12` is the brightest of the classic styles that still carries
 * real information: green landcover, terrain shading, blue water, and the
 * national parks and reserves that half the Catalog is about. It is a classic
 * style rather than Standard, which means `addLayer`, `setFog` and
 * `queryRenderedFeatures` all behave exactly as the route layers already
 * expect. The route holds its contrast against it through the `--sb-map-*`
 * tokens, which do not flip with the theme.
 */
export const MAP_STYLE = "mapbox://styles/mapbox/outdoors-v12";
