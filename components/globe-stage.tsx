"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Star, X } from "lucide-react";

import { GlobeControls } from "@/components/globe-controls";
import { LegPopup } from "@/components/leg-popup";
import {
  CARD_SLIDEOVER_WIDTH_PX,
  FOCUS_FLIGHT_MS,
  FOCUS_ZOOM,
  NO_PADDING,
  capsuleLocation,
  fitPadding,
  focusPadding,
  framePadding,
} from "@/lib/capsule-camera";
import {
  openCatalogIdea,
  openDeepCapsule,
  useCapsuleFocus,
} from "@/lib/capsule-focus";
import { formatEurBand } from "@/lib/catalog";
import { DEEP_CAPSULE_BY_ROUTE_CODE } from "@/lib/deep-capsules";
import {
  capsuleMarkersGeoJSON,
  capsulesOnLeg,
  interestedClusters,
  interestedGeoJSON,
} from "@/lib/globe-markers";
import { useShortlist } from "@/lib/shortlist";
import {
  AUSTRALIA_BOUNDS,
  COMPACT_CAMERA,
  COMPACT_CAMERA_MAX_WIDTH_PX,
  GLOBE_MAX_FIT_ZOOM,
  MAP_STYLE,
  SKELETON_ROUTE,
} from "@/lib/demo-route";
import { usePlan } from "@/lib/engine/use-plan";
import type { CapsuleSpec, Leg, LegMode } from "@/lib/engine/types";
import {
  buildRoute,
  type RouteArcProperties,
  type RouteBounds,
} from "@/lib/route-geo";
import type { Coordinates } from "@/lib/airports";

const SOURCE_LEGS = "route-legs";
const SOURCE_POINTS = "route-points";
const SOURCE_CAPSULES = "capsule-bases";
const SOURCE_INTERESTED = "interested-ideas";

/** Layers a click is allowed to land on, most specific first. */
const CAPSULE_LAYERS = ["capsules-dot", "capsules-halo"];
const INTERESTED_LAYERS = ["interested-dot", "interested-halo"];
const LEG_LAYERS = ["legs-hit"];

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* ---- The client store, and the frame before it ---- */

// Nothing to subscribe to: the answer changes exactly once, when React
// finishes hydrating, and `useSyncExternalStore` reports that transition for
// free. Module-level so the subscription is not torn down every render.
const NEVER_CHANGES = () => () => {};

/**
 * Whether the client's own store has been read yet.
 *
 * The Scenarios live in localStorage, which the server never saw, so the first
 * render — on the server and again during hydration — cannot know which
 * itinerary this browser is holding. Drawing the *default* Scenario in that
 * gap would be a route that flickers into a different one a frame later; a
 * blank globe would be worse. So the skeleton draws, and the moment this flips
 * the real Legs replace it.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    NEVER_CHANGES,
    () => true,
    () => false,
  );
}

/**
 * Line and marker colours are read from the design tokens at mount rather
 * than hard-coded, so the globe's route stays in step with the palette.
 * Mapbox paint properties want concrete colours, not CSS variables.
 *
 * The route reads the `--sb-map-*` tokens rather than the chrome's, because
 * the map commits to daylight in both themes and the ink has to hold contrast
 * against green, blue and pale desert rather than against a panel.
 */
function tokenColor(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

/** Inlined at build time, so a missing token is knowable during render. */
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/** Great-circle angle between two points, in degrees. */
function angularDistance(a: Coordinates, b: Coordinates): number {
  const rad = Math.PI / 180;
  const [lon1, lat1] = [a[0] * rad, a[1] * rad];
  const [lon2, lat2] = [b[0] * rad, b[1] * rad];
  const cos =
    Math.sin(lat1) * Math.sin(lat2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  return Math.acos(Math.min(1, Math.max(-1, cos))) / rad;
}

/**
 * Whether a coordinate is on the near face of the globe.
 *
 * `map.project()` answers for points behind the planet too, and the answer is
 * a plausible-looking screen position on the wrong side of the sphere — a
 * popup anchored to Sydney would follow the traveller round to Portugal. The
 * visible cap shrinks as the camera closes in; 84° is comfortably inside it at
 * the zooms this stage uses and errs towards hiding a popup near the limb,
 * where its leader line would be lying about which point it belongs to anyway.
 */
function onNearFace(map: mapboxgl.Map, at: Coordinates): boolean {
  const center = map.getCenter();
  return angularDistance([center.lng, center.lat], at) < 84;
}

/**
 * The Adventure a stop marker stands for, or null.
 *
 * Live stops carry the Capsule id of the days spent there, which is the honest
 * answer: the Day sequence already knows. The skeleton's stops have no Plan
 * behind them, so they fall back to the gateway table — which is all the
 * pre-hydration route ever knew.
 */
function capsuleOfStop(properties: Record<string, unknown>): string | null {
  const capsuleId = properties.capsuleId;
  if (typeof capsuleId === "string" && capsuleId) return capsuleId;
  const code = properties.code;
  return typeof code === "string"
    ? (DEEP_CAPSULE_BY_ROUTE_CODE[code] ?? null)
    : null;
}

/** Open the card behind a stop. False when there is nothing behind it. */
function openStop(
  properties: Record<string, unknown>,
  capsules: ReadonlyMap<string, CapsuleSpec>,
): boolean {
  const capsuleId = capsuleOfStop(properties);
  if (!capsuleId) return false;
  // A Catalog idea toggled onto the Plan is a stop like any other, and its
  // card is a different one.
  if (capsules.get(capsuleId)?.tier === "catalog") openCatalogIdea(capsuleId);
  else openDeepCapsule(capsuleId);
  return true;
}

/**
 * The anchored popup, dropped if the route no longer holds what it points at.
 *
 * Leg ids carry their date (`PER>SYD@2026-12-28`), so switching to a Scenario
 * that leaves two days later replaces every id on the map. Without this the
 * panel would sit there describing a flight this Plan does not have.
 */
function stillOnTheRoute(
  anchored: Anchored | null,
  legs: ReadonlyMap<string, Leg>,
): Anchored | null {
  if (anchored?.kind === "leg" && !legs.has(anchored.id)) return null;
  return anchored;
}

/** Where an anchored popup currently sits, in stage pixels. */
interface ScreenPoint {
  x: number;
  y: number;
}

type Anchored = (
  | { kind: "leg"; id: string }
  | { kind: "airport"; code: string }
) & {
  /** The geography the popup belongs to. */
  at: Coordinates;
  /**
   * Its projection. Held in state rather than computed during render because
   * `map.project` reads a mutable ref, and re-derived on every camera frame by
   * the effect below — the popup has to travel with its point as the globe
   * turns. Null once the point rotates behind the planet.
   */
  screen: ScreenPoint | null;
};

/**
 * Where the open card's Adventure is, marked on the ground it flew to.
 *
 * The pulse is the point: after a two-second flight across a hemisphere the
 * eye needs telling which of the dots now on screen is the one that was asked
 * for, and a ring that breathes says it without adding a colour or a shape the
 * map does not already use. It is slow (2.6s) and it is off under
 * `prefers-reduced-motion`, where the dot and its name are the whole message
 * and were always the part carrying the information.
 *
 * Rendered through a portal into a `mapboxgl.Marker`'s element so that Mapbox
 * owns the projection — including fading the marker out when the flight leaves
 * its point around the back of the globe, which the anchored popups above have
 * to work out for themselves.
 */
function FocusMarker({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="relative flex size-3.5 items-center justify-center">
        <span className="absolute size-full animate-ping rounded-full bg-[var(--sb-map-stop)] opacity-40 [animation-duration:2.6s] motion-reduce:hidden" />
        <span className="relative size-3.5 rounded-full border-2 border-[var(--sb-map-halo)] bg-[var(--sb-map-stop)] shadow-[0_1px_5px_rgb(0_0_0/0.5)]" />
      </span>
      <span className="line-clamp-2 max-w-[168px] rounded-full bg-[rgb(6_10_16/0.78)] px-2 py-[3px] text-center text-[10px] leading-[1.25] font-semibold text-balance text-[rgb(255_253_248/0.95)] backdrop-blur-sm">
        {name}
      </span>
    </div>
  );
}

export function GlobeStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [anchored, setAnchored] = useState<Anchored | null>(null);

  const { marks } = useShortlist();
  const clusters = useMemo(() => interestedClusters(marks), [marks]);

  /* ---- The route the globe is actually drawing (#87) ----
     The arcs are the current Scenario's derived Legs — the same objects the
     Ledger's transit rows read — so a Scenario switched on /scenarios, a
     dragged block or a Leg flipped to a drive all redraw the map by the same
     path they redraw everything else. Until the client store is read there is
     no itinerary to know, and the static skeleton stands in. */
  const { plan, capsules } = usePlan();
  const hydrated = useHydrated();
  const route = useMemo(
    () => (hydrated ? buildRoute(plan.legs, plan.days) : SKELETON_ROUTE),
    [hydrated, plan.legs, plan.days],
  );

  /** The clicked arc's Leg, for the popup: money, mode, provenance. */
  const legById = useMemo(
    () => new Map(plan.legs.map((leg) => [leg.id, leg])),
    [plan.legs],
  );
  /** The drawn arc's own properties — the names, and why it is dotted. */
  const arcById = useMemo(
    () =>
      new Map(
        route.arcs.features.map((feature) => [
          feature.properties.id,
          feature.properties,
        ]),
      ),
    [route.arcs],
  );

  // What the detail card is showing, and where on Earth that is. Null while
  // nothing is open, and also for the twelve Catalog entries that are a route
  // rather than a place — see `capsuleLocation`.
  const focus = useCapsuleFocus();
  const location = useMemo(() => capsuleLocation(focus), [focus]);

  /**
   * The anchored popup, if a card is not standing in front of it.
   *
   * An open card and an anchored popup are two answers to "what is here" and
   * only one of them can be on screen: the card's flight is about to take the
   * popup's point off the edge of the world. The popup is hidden rather than
   * dismissed, because closing the card flies back to a frame that holds the
   * Leg it was anchored to — so it returns where it was, still pointing at
   * the arc the traveller was reading about.
   */
  const popup = focus ? null : stillOnTheRoute(anchored, legById);

  /**
   * The anchored popup, readable from a camera effect that must not re-run
   * when it moves. Its `screen` field is rewritten on every frame of every
   * flight, so listing `anchored` among the flight effect's dependencies
   * would restart the flight mid-air.
   */
  const anchoredRef = useRef<Anchored | null>(null);
  useEffect(() => {
    anchoredRef.current = anchored;
  }, [anchored]);

  /**
   * The live route, readable from the map's own handlers.
   *
   * Mapbox's click handler and the camera helpers are installed once, when the
   * style loads, and they outlive every re-render — so the route they consult
   * has to be a box they read rather than a value they closed over. Rebuilding
   * the map when the Scenario changes would be the alternative, and it would
   * throw away the traveller's camera on every knob.
   */
  const routeRef = useRef(route);
  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  const legsRef = useRef(legById);
  useEffect(() => {
    legsRef.current = legById;
  }, [legById]);

  /** Which card a stop marker opens: a researched Adventure or a Catalog idea. */
  const capsulesRef = useRef(capsules);
  useEffect(() => {
    capsulesRef.current = capsules;
  }, [capsules]);

  /**
   * True while the camera is somewhere a card put it.
   *
   * Read by the resize handler below, which otherwise re-frames the route on
   * every container resize and would quietly undo the flight — a phone
   * rotating, or the browser's own chrome resolving a second after load.
   */
  const flownRef = useRef(false);

  // The marker's host element. Created once and handed to Mapbox, with the
  // contents rendered into it by React, so the label is written in JSX next to
  // the rest of the design tokens rather than assembled by hand.
  const [markerElement] = useState<HTMLDivElement | null>(() => {
    if (typeof document === "undefined") return null;
    const element = document.createElement("div");
    // Inert: the map underneath keeps every click, including the one that
    // opens a different Adventure.
    element.style.pointerEvents = "none";
    return element;
  });

  const failure = MAPBOX_TOKEN
    ? mapError
    : "No Mapbox token — set NEXT_PUBLIC_MAPBOX_TOKEN.";

  /**
   * Set by the map effect so the React controls can drive the camera.
   *
   * `frameRoute` is the "frame the whole route" button: the whole trip, and
   * from then on that is the frame the stage rests in. `frameResting` is what
   * a resize and a closing card use — back to whatever seat the stage is
   * currently in, which at load is Australia.
   */
  const frameRouteRef = useRef<(animate: boolean) => void>(() => {});
  const frameRestingRef = useRef<
    (animate: boolean, keepLegsInView?: boolean) => void
  >(() => {});

  const zoomBy = useCallback((delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      zoom: map.getZoom() + delta,
      duration: prefersReducedMotion() ? 0 : 300,
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const arc = tokenColor("--sb-map-arc", "#0d4d66");
    const casing = tokenColor("--sb-map-casing", "#ffffff");
    const accent = tokenColor("--sb-map-stop", "#d2402a");
    const good = tokenColor("--sb-map-capsule", "#146c3a");
    const text = tokenColor("--sb-map-label", "#14232f");
    const halo = tokenColor("--sb-map-halo", "#ffffff");

    const map = new mapboxgl.Map({
      container,
      style: MAP_STYLE,
      projection: { name: "globe" },
      // Real framing happens via fitBounds once the style is up; these are
      // only the pre-fit defaults.
      center: [75, 0],
      zoom: 1.3,
      attributionControl: false,
      // Bottom-left is where the catalog drawer lives, and Mapbox's logo has
      // to stay visible under their terms — so it joins the attribution on
      // the right. The zoom buttons are ours now (see GlobeControls).
      logoPosition: "bottom-right",
      // Low enough that a phone-width viewport can still fit the whole route:
      // clamping at 0.8 pushed the Australian end off the right edge. The
      // ceiling is street level, so a scroll into Fremantle or Port Douglas
      // keeps rewarding the traveller instead of stopping at the metro area.
      minZoom: 0.3,
      maxZoom: 12,
      /* ---- North is up, always (#56) ----
         A globe you can spin is a globe you can get lost on: two drags and
         north is off to the left with nothing on screen saying so. The old
         answer was a compass button to put it back, which is chrome that
         exists only to undo a gesture nobody asked for. Taking the gesture
         away is the smaller surface and the better map — this is a route
         across the world, not a 3D scene, and every mental model the
         traveller has of Australia has north at the top.

         Pitch goes with it: a pitched globe is what makes a drag feel like
         rotation in the first place, and none of the route's markers or
         labels gain anything from it. */
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      // Effortless zoom (#56): plain wheel, no modifier key. The Plan page's
      // shell is a fixed-height `overflow-hidden` stage, so there is no page
      // scroll for the map to fight; the panels floating over it are separate
      // scroll containers that never chain into the canvas.
      scrollZoom: true,
      doubleClickZoom: true,
    });
    mapRef.current = map;

    // The two rotation gestures that survive the constructor flags: two-finger
    // twist on a touch screen, and shift+arrow on the keyboard. Zoom and pan
    // keep working on both — it is only the bearing that is nailed down.
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();

    /**
     * Which frame the stage rests in.
     *
     * Australia at load; the "frame the whole route" button hands the seat to
     * the route, and from then on that is what a resize or a closing card
     * comes back to. Without this the button's frame would survive exactly
     * until the next container resize.
     */
    let resting: "australia" | "route" = "australia";

    /**
     * The opening frame: Australia, filling the stage (#81).
     *
     * `fitBounds` rather than a hand-picked centre and zoom, for the same
     * reason the route frame uses it — the answer has to be right on a 375px
     * phone and a 1440px laptop, and those want different zooms. Padding is
     * sticky on the transform (see `capsule-camera`), so this states its own:
     * the same reservation the route frame makes for the docked chrome, which
     * is what keeps the continent out from under the shortlist and the date
     * strip rather than merely on screen.
     *
     * No `maxZoom`: the route frame needs one to keep Valencia on the near
     * face of the globe, and this frame has no far end to protect.
     */
    const frameAustralia = (animate: boolean) => {
      map.fitBounds(AUSTRALIA_BOUNDS, {
        padding: fitPadding(
          framePadding(container.clientWidth),
          container.clientWidth,
          container.clientHeight,
        ),
        bearing: 0,
        pitch: 0,
        duration: animate && !prefersReducedMotion() ? 900 : 0,
      });
    };

    /**
     * The whole trip, framed — on the **live** route's own bounds.
     *
     * Which is the point of the button: a Scenario that never leaves the east
     * coast should frame the east coast, not the box the prototype's nine
     * points happened to make. An itinerary with nothing drawable falls back to
     * the continent, because a `fitBounds` on nothing is a Mapbox error.
     */
    const frameRoute = (animate: boolean) => {
      const width = container.clientWidth;
      const duration = animate && !prefersReducedMotion() ? 900 : 0;
      const bounds: RouteBounds = routeRef.current.bounds ?? AUSTRALIA_BOUNDS;

      if (width < COMPACT_CAMERA_MAX_WIDTH_PX) {
        // `NO_PADDING` because COMPACT_CAMERA was hand-framed against an
        // unpadded camera: padding is sticky, so an open card's reservation
        // has to be cleared here or the restored frame is the old one shoved
        // sideways.
        map.easeTo({
          ...COMPACT_CAMERA,
          bearing: 0,
          pitch: 0,
          padding: NO_PADDING,
          duration,
        });
        return;
      }

      map.fitBounds(bounds, {
        padding: fitPadding(framePadding(width), width, container.clientHeight),
        maxZoom: GLOBE_MAX_FIT_ZOOM,
        bearing: 0,
        pitch: 0,
        duration,
      });
    };

    // Pressing the button is what moves the resting seat; nothing else does.
    frameRouteRef.current = (animate: boolean) => {
      resting = "route";
      frameRoute(animate);
    };

    // `keepLegsInView` is the closing card's escape hatch: an anchored Leg
    // popup is context the restored frame has to hold, and the Barcelona and
    // Singapore arcs are not in the Australia frame. It borrows the route
    // frame for that one call without taking the seat.
    frameRestingRef.current = (animate: boolean, keepLegsInView = false) => {
      if (keepLegsInView || resting === "route") frameRoute(animate);
      else frameAustralia(animate);
    };

    // Once the traveller moves the globe themselves, it is theirs — resizes
    // stop yanking the camera back to the route. Listening on the canvas
    // rather than on map events keeps our own framing calls from tripping it.
    let userMoved = false;
    const markUserMoved = () => {
      userMoved = true;
    };
    const canvas = map.getCanvas();
    canvas.addEventListener("pointerdown", markUserMoved);
    canvas.addEventListener("wheel", markUserMoved, { passive: true });

    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    map.on("error", (event) => {
      setMapError(event.error?.message ?? "Mapbox failed to load.");
    });

    map.on("style.load", () => {
      // Atmosphere: a daylit planet in space, not a sphere on a flat backdrop.
      // Space stays deep blue rather than black — the globe should look
      // photographed from orbit on a clear day, which is the register the
      // bright style is going for.
      map.setFog({
        color: "rgb(198, 222, 244)",
        "high-color": "rgb(126, 176, 232)",
        // Kept low: Valencia sits ~80° from the camera — near the limb, because
        // Valencia and Melbourne are very nearly antipodal and no globe
        // framing can put both in the middle. A heavier haze would swallow
        // the European end of the route entirely.
        "horizon-blend": 0.02,
        "space-color": "rgb(16, 30, 56)",
        "star-intensity": 0.08,
      });

      // Whatever the route is at style-load — the skeleton if the client store
      // has not been read yet. The effect below keeps both in step from there.
      map.addSource(SOURCE_LEGS, {
        type: "geojson",
        data: routeRef.current.arcs,
      });
      map.addSource(SOURCE_POINTS, {
        type: "geojson",
        data: routeRef.current.stops,
      });
      map.addSource(SOURCE_CAPSULES, {
        type: "geojson",
        data: capsuleMarkersGeoJSON(),
      });
      // Starts empty and is filled by the shortlist effect below: at first
      // paint nothing is marked, and the marks live in localStorage which the
      // server never saw.
      map.addSource(SOURCE_INTERESTED, {
        type: "geojson",
        data: interestedGeoJSON([]),
      });

      // A solid white casing under the route rather than the old soft glow.
      // On a terrain style the ground is never one colour — coastline,
      // relief shading and park green all run under these arcs — and a
      // cartographic casing is what keeps a thin line legible over all of it.
      map.addLayer({
        id: "legs-glow",
        type: "line",
        source: SOURCE_LEGS,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": casing,
          "line-width": ["case", ["get", "longHaul"], 6, 4.5],
          "line-opacity": 0.75,
          "line-blur": 0.4,
        },
      });

      /* ---- One layer per mode (#87) ----
         How a Leg is travelled is the first thing the map should say about
         it: the Nullarbor variant is only interesting *because* it is three
         days of driving instead of four hours of flying, and an arc that
         looks like every other arc says nothing about that trade. So a
         flight is a solid line, a drive is dashed, a ferry is dotted and a
         train is dash-dot.

         One layer each because `line-dasharray` is not data-driven-styleable
         and cannot branch on a feature property. Width still can, so the
         long-haul weighting rides along inside each mode: the ocean
         crossings stay the heavy, committed part of the Plan. */
      const modeLayer = (spec: {
        mode: LegMode;
        width: number;
        /** Null draws a solid line. */
        dashes?: number[];
        /** Round caps turn a near-zero dash into a row of dots. */
        cap?: "butt" | "round";
      }) =>
        map.addLayer({
          id: `legs-${spec.mode}`,
          type: "line",
          source: SOURCE_LEGS,
          filter: [
            "all",
            ["==", ["get", "mode"], spec.mode],
            ["==", ["get", "approximate"], false],
          ],
          layout: {
            "line-cap": spec.cap ?? (spec.dashes ? "butt" : "round"),
            "line-join": "round",
          },
          paint: {
            "line-color": arc,
            "line-width": [
              "case",
              ["get", "longHaul"],
              spec.width * 1.5,
              spec.width,
            ],
            "line-opacity": ["case", ["get", "longHaul"], 1, 0.95],
            ...(spec.dashes ? { "line-dasharray": spec.dashes } : {}),
          },
        });

      modeLayer({ mode: "flight", width: 1.6 });
      modeLayer({ mode: "drive", width: 1.8, dashes: [2.2, 1.6] });
      modeLayer({ mode: "train", width: 1.7, dashes: [4, 1.4, 1, 1.4] });
      modeLayer({ mode: "ferry", width: 2, dashes: [0.1, 2.4], cap: "round" });

      // An arc whose ends are only known to their gateway airports. Drawn
      // straight rather than flown, and finely dotted, because a great circle
      // between two guesses is a precise-looking claim about a vague one. The
      // popup says which end is the guess.
      map.addLayer({
        id: "legs-approx",
        type: "line",
        source: SOURCE_LEGS,
        filter: ["==", ["get", "approximate"], true],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": arc,
          "line-width": 1.5,
          "line-opacity": 0.7,
          "line-dasharray": [0.1, 2.6],
        },
      });

      // The selected Leg, lit. A separate layer rather than a data-driven
      // width on the two above, because the selection has to survive the
      // long-haul / hop split and both of those already own their filter.
      map.addLayer({
        id: "legs-selected",
        type: "line",
        source: SOURCE_LEGS,
        filter: ["==", ["get", "id"], ""],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": accent, "line-width": 3, "line-opacity": 0.95 },
      });

      // Invisible and fat: a 1.4px dashed arc is not a click target. This is
      // the thing the pointer actually hits.
      map.addLayer({
        id: "legs-hit",
        type: "line",
        source: SOURCE_LEGS,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": arc, "line-width": 22, "line-opacity": 0 },
      });

      /* ---- Interested Catalog ideas, at their nearest airport ---- */
      map.addLayer({
        id: "interested-halo",
        type: "circle",
        source: SOURCE_INTERESTED,
        paint: {
          "circle-radius": ["+", 7, ["min", ["get", "count"], 5]],
          "circle-color": accent,
          "circle-opacity": 0.14,
        },
      });
      map.addLayer({
        id: "interested-dot",
        type: "circle",
        source: SOURCE_INTERESTED,
        paint: {
          "circle-radius": 3.4,
          "circle-color": accent,
          "circle-opacity": 0.85,
          "circle-stroke-width": 1,
          "circle-stroke-color": halo,
        },
      });
      // The count only draws where there is one, so a lone idea is a clean dot.
      map.addLayer({
        id: "interested-count",
        type: "symbol",
        source: SOURCE_INTERESTED,
        filter: [">", ["get", "count"], 1],
        layout: {
          "text-field": ["to-string", ["get", "count"]],
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
          "text-size": 9,
          "text-offset": [0, -1.3],
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": accent,
          "text-halo-color": halo,
          "text-halo-width": 1.2,
        },
      });

      /* ---- The nine researched Capsules, always on ---- */
      // Drawn under the route points: where a Capsule sits on top of its own
      // gateway the route's marker should win, because it carries the label.
      map.addLayer({
        id: "capsules-halo",
        type: "circle",
        source: SOURCE_CAPSULES,
        paint: {
          "circle-radius": 10,
          "circle-color": good,
          "circle-opacity": 0.12,
        },
      });
      // The highlight ring, filtered to the Capsules on the selected Leg.
      map.addLayer({
        id: "capsules-lit",
        type: "circle",
        source: SOURCE_CAPSULES,
        filter: ["in", ["get", "id"], ["literal", []]],
        paint: {
          "circle-radius": 13,
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-width": 1.6,
          "circle-stroke-color": accent,
          "circle-stroke-opacity": 0.9,
        },
      });
      map.addLayer({
        id: "capsules-dot",
        type: "circle",
        source: SOURCE_CAPSULES,
        paint: {
          "circle-radius": 4.2,
          "circle-color": halo,
          "circle-stroke-width": 2,
          "circle-stroke-color": good,
        },
      });
      // Names only once the camera is close enough for them to mean something.
      map.addLayer({
        id: "capsules-label",
        type: "symbol",
        source: SOURCE_CAPSULES,
        minzoom: 2.6,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
          "text-size": 10,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
          "text-max-width": 9,
        },
        paint: {
          "text-color": good,
          "text-halo-color": halo,
          "text-halo-width": 1.8,
        },
      });

      map.addLayer({
        id: "points-halo",
        type: "circle",
        source: SOURCE_POINTS,
        paint: {
          "circle-radius": ["case", ["==", ["get", "kind"], "stop"], 11, 9],
          "circle-color": accent,
          "circle-opacity": 0.16,
        },
      });

      map.addLayer({
        id: "points",
        type: "circle",
        source: SOURCE_POINTS,
        paint: {
          "circle-radius": ["case", ["==", ["get", "kind"], "hub"], 3.2, 4.4],
          "circle-color": [
            "case",
            ["==", ["get", "kind"], "hub"],
            arc,
            accent,
          ],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": halo,
        },
      });

      /* The stops carry their **place** names now, not their gateway codes.
         A live route's stops are Locations, and three of the reference trip's
         eight share the Perth gateway — "PER, PER, PER" stacked on one corner
         of the continent was the old label layer's answer and it named
         nothing. Margaret River, Rottnest Island and Perth are three places
         and the map can say so.

         The longest stay at each gateway keeps the always-on treatment: those
         labels are the point of the stage and must not lose placement to
         Mapbox's country names. The rest wait for a camera close enough for
         them to separate. */
      map.addLayer({
        id: "point-labels",
        type: "symbol",
        source: SOURCE_POINTS,
        filter: ["==", ["get", "major"], true],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
          "text-size": 11,
          "text-offset": [0, 1.1],
          "text-anchor": "top",
          "text-letter-spacing": 0.04,
          "text-max-width": 8,
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": text,
          "text-halo-color": halo,
          "text-halo-width": 1.8,
        },
      });

      map.addLayer({
        id: "point-labels-minor",
        type: "symbol",
        source: SOURCE_POINTS,
        filter: ["==", ["get", "major"], false],
        minzoom: 3.2,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
          "text-size": 10,
          "text-offset": [0, 1.1],
          "text-anchor": "top",
          "text-max-width": 8,
        },
        paint: {
          "text-color": text,
          "text-halo-color": halo,
          "text-halo-width": 1.6,
        },
      });

      /* ---------------- Interaction ---------------- */

      /**
       * What the pointer is over, in priority order.
       *
       * One handler rather than Mapbox's per-layer `map.on('click', layer, …)`
       * delegation, because that delegation cannot be stopped: layer handlers
       * and the bare `map.on('click')` all fire off the same internal dispatch,
       * so a "click the ocean to dismiss" handler would fire on every hit too
       * and close the popup the layer handler had just opened. Asking the
       * question once, in the order the markers overlap, is the honest shape.
       *
       * The order is smallest-target-first: a Capsule marker sitting on its own
       * gateway airport should win over the route node under it, and both
       * should win over the 22px invisible ribbon along the Leg.
       */
      const hitAt = (point: mapboxgl.Point) => {
        const query = (layers: string[]) =>
          map.queryRenderedFeatures(point, { layers })[0];

        return {
          capsule: query(CAPSULE_LAYERS),
          interested: query(INTERESTED_LAYERS),
          routePoint: query(["points", "points-halo"]),
          leg: query(LEG_LAYERS),
        };
      };

      map.on("click", (event) => {
        const hit = hitAt(event.point);

        const capsuleId = hit.capsule?.properties?.id;
        if (typeof capsuleId === "string") {
          openDeepCapsule(capsuleId);
          return;
        }

        if (hit.interested) {
          const { code, soleId } = hit.interested.properties ?? {};
          const geometry = hit.interested.geometry;
          if (typeof code === "string" && geometry.type === "Point") {
            // One idea needs no list — go straight to its card.
            if (typeof soleId === "string" && soleId) {
              openCatalogIdea(soleId);
              return;
            }
            const at = geometry.coordinates as Coordinates;
            setAnchored({ kind: "airport", code, at, screen: map.project(at) });
            return;
          }
        }

        // A stop that stands for an Adventure opens its card. The Day sequence
        // already knows which one — the marker carries the Capsule id of the
        // days spent there, so this is a lookup rather than a
        // nearest-neighbour search, and it is right for a Catalog idea toggled
        // onto the Plan as well as for the eight researched ones. A stop with
        // nothing behind it (the skeleton's Barcelona and Singapore, a Buffer
        // stretch) stays inert, cursor and all.
        const stop = hit.routePoint?.properties;
        if (stop) {
          const opened = openStop(stop, capsulesRef.current);
          if (opened) return;
        }

        const legId = hit.leg?.properties?.id;
        if (typeof legId === "string" && legsRef.current.has(legId)) {
          // Anchored where it was clicked, not at the arc's midpoint: the
          // midpoint of a Barcelona→Singapore great circle is over Iran, and
          // a popup that jumps 4,000km from the pointer reads as a bug.
          const at: Coordinates = [event.lngLat.lng, event.lngLat.lat];
          setAnchored({ kind: "leg", id: legId, at, screen: map.project(at) });
          return;
        }

        // A genuine miss: bare ocean dismisses whatever is open.
        setAnchored(null);
      });

      map.on("mousemove", (event) => {
        const hit = hitAt(event.point);
        const legId = hit.leg?.properties?.id;
        const actionable =
          hit.capsule ||
          hit.interested ||
          (typeof legId === "string" && legsRef.current.has(legId)) ||
          (hit.routePoint?.properties
            ? Boolean(capsuleOfStop(hit.routePoint.properties))
            : false);
        canvas.style.cursor = actionable ? "pointer" : "";
      });

      frameAustralia(false);
      setReady(true);
    });

    // Mapbox latches onto the container's size at construction, which in a
    // dvh layout is often stale by the time fonts settle or the browser
    // chrome resolves. Observing the container covers both that first
    // correction and later window resizes.
    const refit = () => {
      map.resize();
      // `flownRef` keeps a resize from undoing an open card's flight; without
      // it, a phone rotating mid-read snaps the camera back to the route.
      if (!userMoved && !flownRef.current && map.isStyleLoaded()) {
        frameRestingRef.current(false);
      }
    };

    const observer = new ResizeObserver(refit);
    observer.observe(container);
    window.addEventListener("resize", refit);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", refit);
      canvas.removeEventListener("pointerdown", markUserMoved);
      canvas.removeEventListener("wheel", markUserMoved);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  /* ---- The redraw ----
     Everything that can change the itinerary — a Scenario selected on
     /scenarios, a block dragged, an Adventure toggled, a Leg flipped to a
     drive, the client store finishing its read — arrives here as a new
     `route`, and the map is told twice: new geometry, and (once the store is
     up) a route frame that fits the new bounds. */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const arcs = map.getSource(SOURCE_LEGS);
    if (arcs?.type === "geojson") arcs.setData(route.arcs);
    const stops = map.getSource(SOURCE_POINTS);
    if (stops?.type === "geojson") stops.setData(route.stops);
  }, [route, ready]);

  // Shortlist marks live outside React's tree and change while the map is up.
  const interested = useMemo(() => interestedGeoJSON(clusters), [clusters]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const source = map.getSource(SOURCE_INTERESTED);
    if (source?.type === "geojson") source.setData(interested);
  }, [interested, ready]);

  // The selected Leg lights its arc and rings the Capsules at its endpoints —
  // "this flight is how you reach those three".
  const selectedLegId = popup?.kind === "leg" ? popup.id : null;
  const selectedArc: RouteArcProperties | undefined = selectedLegId
    ? arcById.get(selectedLegId)
    : undefined;
  const selectedFrom = selectedArc?.from;
  const selectedTo = selectedArc?.to;
  /** The Leg itself — the popup's every figure comes off this one object. */
  const selectedLeg: Leg | undefined = selectedLegId
    ? legById.get(selectedLegId)
    : undefined;
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setFilter("legs-selected", ["==", ["get", "id"], selectedLegId ?? ""]);
    map.setFilter("capsules-lit", [
      "in",
      ["get", "id"],
      [
        "literal",
        selectedFrom && selectedTo ? capsulesOnLeg(selectedFrom, selectedTo) : [],
      ],
    ]);
  }, [selectedLegId, selectedFrom, selectedTo, ready]);

  /* ---- The flight (#75) ----
     Opening an Adventure's card takes the globe to it. The plan is a list of
     names to anyone who does not already know Australia, and watching the
     camera travel to the top of Queensland answers "where is that?" in the
     one register a map is better at than prose. */
  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!ready || !map || !container) return;

    if (!focus) {
      // Card closed: back to the frame the stage was resting in, and by the
      // same call that drew it at load, so it is the same frame rather than a
      // near miss. Only when a flight actually took the camera away — a card
      // that never flew should not re-frame a globe the traveller had spun
      // themselves.
      //
      // An anchored popup is the one piece of context that outranks the
      // resting frame: it is still pointing at a Leg, and the Leg it points
      // at may be a Barcelona–Singapore arc the Australia frame does not
      // hold. With one open, the restore borrows the whole-route frame so the
      // popup comes back where it was, still on its arc.
      if (flownRef.current) {
        flownRef.current = false;
        frameRestingRef.current(true, Boolean(anchoredRef.current));
      }
      return;
    }

    // A card with no resolvable coordinates: it just opens. No flight, no
    // marker, no complaint, and the camera stays exactly where it was.
    if (!location) return;

    flownRef.current = true;
    const camera = {
      center: location.at,
      zoom: FOCUS_ZOOM,
      // Reserves the slide-over's width, so the place lands in the map the
      // card leaves visible rather than behind it.
      padding: focusPadding(container.clientWidth),
      bearing: 0,
      pitch: 0,
    };

    if (prefersReducedMotion()) {
      // A jump, not a flight — and deliberately ours rather than Mapbox's.
      // `flyTo` would collapse to a jump on its own here, but only because
      // `essential` is left unset; setting `essential: true` (the flag that
      // makes an animation ignore the preference) is the one thing that would
      // be wrong, so the branch is written out instead of implied.
      map.easeTo({ ...camera, duration: 0 });
      return;
    }

    map.flyTo({ ...camera, duration: FOCUS_FLIGHT_MS, curve: 1.42 });
  }, [focus, location, ready]);

  // The marker for the place just flown to. Mapbox owns its projection, which
  // includes fading it out if the point ends up behind the planet.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !markerElement || !location) return;
    const marker = new mapboxgl.Marker({
      element: markerElement,
      // The element hangs its label below the dot, so the dot is its top edge;
      // the offset lifts it back onto the coordinate.
      anchor: "top",
      offset: [0, -7],
    })
      .setLngLat(location.at)
      .addTo(map);
    return () => {
      marker.remove();
    };
  }, [location, ready, markerElement]);

  // Escape closes the popup, as it does the Capsule card.
  useEffect(() => {
    if (!anchored) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAnchored(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anchored]);

  // An open popup travels with its point. Subscribing to `move` rather than
  // re-projecting during render keeps the mutable map out of the render path.
  const anchorAt = anchored?.at;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !anchorAt) return;
    const reproject = () => {
      const visible = onNearFace(map, anchorAt);
      setAnchored((current) =>
        current && current.at === anchorAt
          ? { ...current, screen: visible ? map.project(anchorAt) : null }
          : current,
      );
    };
    map.on("move", reproject);
    return () => {
      map.off("move", reproject);
    };
  }, [anchorAt]);

  const cluster =
    popup?.kind === "airport"
      ? clusters.find((entry) => entry.code === popup.code)
      : undefined;

  return (
    <div className="absolute inset-0 bg-[#070c14]">
      {/* Sized with width/height, not inset-0: mapbox-gl.css sets
          `.mapboxgl-map { position: relative }` on whatever element it
          mounts into, and its stylesheet lands after Tailwind's, so an
          `absolute inset-0` container silently collapses to zero height. */}
      <div ref={containerRef} className="size-full" />

      {/* Vignette: darkens the corners the panels sit in, so glass chrome
          keeps its contrast wherever the globe happens to be bright. Lighter
          since the style went to daylight — the point now is to seat the
          panels, not to dim the continent they are floating over. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(115% 85% at 50% 45%, transparent 55%, rgb(7 12 20 / 0.42) 100%)",
        }}
      />

      {markerElement && location
        ? createPortal(<FocusMarker name={location.name} />, markerElement)
        : null}

      {ready && (
        <GlobeControls
          onZoomIn={() => zoomBy(1)}
          onZoomOut={() => zoomBy(-1)}
          onFrameRoute={() => frameRouteRef.current(true)}
          // An open card takes the right-hand column; the stack steps left of
          // it so the map it leaves visible is still a map you can zoom.
          clearRight={focus ? CARD_SLIDEOVER_WIDTH_PX + 12 : undefined}
        />
      )}

      {/* Anchored popups. Positioned in a container that spans the stage and
          translated onto the projected point, so the panel keeps its own
          layout while the anchor does the moving. `-translate-x-1/2` centres
          it on the point; it sits above, with the clamp keeping it on screen. */}
      {popup?.screen && (
        <div
          className="pointer-events-none absolute inset-0 z-30"
          onClick={() => setAnchored(null)}
        >
          <div
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full"
            style={{
              left: `clamp(150px, ${popup.screen.x}px, calc(100% - 150px))`,
              top: `clamp(230px, ${popup.screen.y - 14}px, calc(100% - 20px))`,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            {popup.kind === "leg" ? (
              selectedLeg &&
              selectedArc && (
                <LegPopup
                  key={popup.id}
                  leg={selectedLeg}
                  fromName={selectedArc.fromName}
                  toName={selectedArc.toName}
                  approximateNote={
                    selectedArc.approximate ? selectedArc.title : null
                  }
                  onClose={() => setAnchored(null)}
                />
              )
            ) : cluster ? (
              <div className="sb-panel relative w-[268px] p-3">
                <button
                  type="button"
                  onClick={() => setAnchored(null)}
                  aria-label="Close"
                  className="absolute top-2 right-2 flex size-6 cursor-pointer items-center justify-center rounded-md text-[var(--sb-faint)] transition-colors hover:bg-[var(--sb-panel-2)] hover:text-[var(--sb-text)] motion-reduce:transition-none"
                >
                  <X className="size-3.5" />
                </button>
                <p className="sb-label flex items-center gap-1.5 pr-6">
                  <Star className="size-3 fill-[var(--sb-accent)] text-[var(--sb-accent)]" />
                  Interested · {cluster.code}
                </p>
                <ul className="sb-scroll mt-2 flex max-h-[220px] flex-col gap-1 overflow-y-auto">
                  {cluster.ideas.map((idea) => (
                    <li key={idea.id}>
                      <button
                        type="button"
                        onClick={() => openCatalogIdea(idea.id)}
                        aria-haspopup="dialog"
                        className="flex w-full cursor-pointer items-baseline justify-between gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-[var(--sb-panel-2)] motion-reduce:transition-none"
                      >
                        <span className="line-clamp-2 text-[11px] leading-tight font-semibold">
                          {idea.name}
                        </span>
                        <span className="sb-num shrink-0 text-[10px] text-[var(--sb-dim)]">
                          {formatEurBand(idea)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {!ready && !failure && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="sb-label animate-pulse text-[#93a0ad] motion-reduce:animate-none">
            Drawing the route
          </span>
        </div>
      )}

      {failure && (
        <div className="absolute inset-0 grid place-items-center p-6">
          <div className="sb-panel max-w-sm p-5 text-center">
            <p className="sb-label mb-2">Globe unavailable</p>
            <p className="text-sm text-[var(--sb-dim)]">{failure}</p>
          </div>
        </div>
      )}
    </div>
  );
}
