"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Star, X } from "lucide-react";

import { GlobeControls } from "@/components/globe-controls";
import { LegPopup } from "@/components/leg-popup";
import { openCatalogIdea, openDeepCapsule } from "@/lib/capsule-focus";
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
  COMPACT_CAMERA,
  COMPACT_CAMERA_MAX_WIDTH_PX,
  DESKTOP_BREAKPOINT_PX,
  FRAME_PADDING,
  GLOBE_MAX_FIT_ZOOM,
  LEG_FACTS,
  MAP_STYLE,
  ROUTE_BOUNDS,
  routeLegsGeoJSON,
  routePointsGeoJSON,
} from "@/lib/demo-route";
import type { Coordinates } from "@/lib/airports";

const SOURCE_LEGS = "route-legs";
const SOURCE_POINTS = "route-points";
const SOURCE_CAPSULES = "capsule-bases";
const SOURCE_INTERESTED = "interested-ideas";

/** Layers a click is allowed to land on, most specific first. */
const CAPSULE_LAYERS = ["capsules-dot", "capsules-halo"];
const INTERESTED_LAYERS = ["interested-dot", "interested-halo"];
const LEG_LAYERS = ["legs-hit"];

function framePadding(width: number) {
  return width >= DESKTOP_BREAKPOINT_PX
    ? FRAME_PADDING.desktop
    : FRAME_PADDING.compact;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
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

export function GlobeStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [bearing, setBearing] = useState(0);
  const [anchored, setAnchored] = useState<Anchored | null>(null);

  const { marks } = useShortlist();
  const clusters = useMemo(() => interestedClusters(marks), [marks]);

  const failure = MAPBOX_TOKEN
    ? mapError
    : "No Mapbox token — set NEXT_PUBLIC_MAPBOX_TOKEN.";

  /** Set by the map effect so the React controls can drive the camera. */
  const frameRouteRef = useRef<(animate: boolean) => void>(() => {});

  const resetNorth = useCallback(() => {
    mapRef.current?.easeTo({
      bearing: 0,
      pitch: 0,
      duration: prefersReducedMotion() ? 0 : 600,
    });
  }, []);

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
      // clamping at 0.8 pushed the Australian end off the right edge.
      minZoom: 0.3,
      maxZoom: 8,
    });
    mapRef.current = map;

    const frameRoute = (animate: boolean) => {
      const width = container.clientWidth;
      const duration = animate && !prefersReducedMotion() ? 900 : 0;

      if (width < COMPACT_CAMERA_MAX_WIDTH_PX) {
        map.easeTo({ ...COMPACT_CAMERA, bearing: 0, pitch: 0, duration });
        return;
      }

      map.fitBounds(ROUTE_BOUNDS, {
        padding: framePadding(width),
        maxZoom: GLOBE_MAX_FIT_ZOOM,
        bearing: 0,
        pitch: 0,
        duration,
      });
    };
    frameRouteRef.current = frameRoute;

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
    map.scrollZoom.disable(); // page scroll should not fight the globe on mobile

    // The compass has to know which way is up.
    map.on("rotate", () => setBearing(map.getBearing()));

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

      map.addSource(SOURCE_LEGS, { type: "geojson", data: routeLegsGeoJSON() });
      map.addSource(SOURCE_POINTS, { type: "geojson", data: routePointsGeoJSON() });
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

      // Long-haul solid and heavy, domestic hops dashed and light — the two
      // ocean crossings are the expensive, committed part of the Plan.
      // Split across two layers because `line-dasharray` is not
      // data-driven-styleable, so it cannot branch on a feature property.
      map.addLayer({
        id: "legs-longhaul",
        type: "line",
        source: SOURCE_LEGS,
        filter: ["==", ["get", "longHaul"], true],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": arc, "line-width": 2.4, "line-opacity": 1 },
      });

      map.addLayer({
        id: "legs-hops",
        type: "line",
        source: SOURCE_LEGS,
        filter: ["==", ["get", "longHaul"], false],
        layout: { "line-cap": "butt", "line-join": "round" },
        paint: {
          "line-color": arc,
          "line-width": 1.6,
          "line-opacity": 0.95,
          "line-dasharray": [2.5, 1.8],
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

      /* ---- The eight researched Capsules, always on ---- */
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

      map.addLayer({
        id: "point-labels",
        type: "symbol",
        source: SOURCE_POINTS,
        layout: {
          "text-field": ["get", "code"],
          "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
          "text-size": 11,
          "text-offset": [0, 1.1],
          "text-anchor": "top",
          "text-letter-spacing": 0.08,
          // The route's own labels always draw: they are the point of the
          // stage, and they must not lose placement to Mapbox's country
          // names, least of all at the crowded Australian end. They still
          // reserve space, so the country names move aside rather than
          // disappearing wholesale.
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": text,
          "text-halo-color": halo,
          "text-halo-width": 1.8,
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

        // Route markers that stand for a researched Capsule open its card. The
        // stops on this route *are* the Capsules' own gateways, so the mapping
        // is a lookup rather than a nearest-neighbour search — and the two hubs
        // with nothing researched behind them (Barcelona, Singapore) simply
        // stay inert, cursor and all.
        const code = hit.routePoint?.properties?.code;
        if (typeof code === "string" && DEEP_CAPSULE_BY_ROUTE_CODE[code]) {
          openDeepCapsule(DEEP_CAPSULE_BY_ROUTE_CODE[code]);
          return;
        }

        const legId = hit.leg?.properties?.id;
        if (typeof legId === "string" && LEG_FACTS[legId]) {
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
        const routeCode = hit.routePoint?.properties?.code;
        const actionable =
          hit.capsule ||
          hit.interested ||
          hit.leg ||
          (typeof routeCode === "string" &&
            Boolean(DEEP_CAPSULE_BY_ROUTE_CODE[routeCode]));
        canvas.style.cursor = actionable ? "pointer" : "";
      });

      frameRoute(false);
      setBearing(map.getBearing());
      setReady(true);
    });

    // Mapbox latches onto the container's size at construction, which in a
    // dvh layout is often stale by the time fonts settle or the browser
    // chrome resolves. Observing the container covers both that first
    // correction and later window resizes.
    const refit = () => {
      map.resize();
      if (!userMoved && map.isStyleLoaded()) frameRoute(false);
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
  const selectedLegId = anchored?.kind === "leg" ? anchored.id : null;
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setFilter("legs-selected", ["==", ["get", "id"], selectedLegId ?? ""]);
    map.setFilter("capsules-lit", [
      "in",
      ["get", "id"],
      ["literal", selectedLegId ? capsulesOnLeg(selectedLegId) : []],
    ]);
  }, [selectedLegId, ready]);

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
    anchored?.kind === "airport"
      ? clusters.find((entry) => entry.code === anchored.code)
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

      {ready && (
        <GlobeControls
          bearing={bearing}
          onZoomIn={() => zoomBy(1)}
          onZoomOut={() => zoomBy(-1)}
          onResetNorth={resetNorth}
          onFrameRoute={() => frameRouteRef.current(true)}
        />
      )}

      {/* Anchored popups. Positioned in a container that spans the stage and
          translated onto the projected point, so the panel keeps its own
          layout while the anchor does the moving. `-translate-x-1/2` centres
          it on the point; it sits above, with the clamp keeping it on screen. */}
      {anchored?.screen && (
        <div
          className="pointer-events-none absolute inset-0 z-30"
          onClick={() => setAnchored(null)}
        >
          <div
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full"
            style={{
              left: `clamp(150px, ${anchored.screen.x}px, calc(100% - 150px))`,
              top: `clamp(230px, ${anchored.screen.y - 14}px, calc(100% - 20px))`,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            {anchored.kind === "leg" ? (
              <LegPopup
                key={anchored.id}
                legId={anchored.id}
                onClose={() => setAnchored(null)}
              />
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
