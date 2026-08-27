"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import {
  COMPACT_CAMERA,
  COMPACT_CAMERA_MAX_WIDTH_PX,
  DESKTOP_BREAKPOINT_PX,
  FRAME_PADDING,
  GLOBE_MAX_FIT_ZOOM,
  MAP_STYLE,
  ROUTE_BOUNDS,
  routeLegsGeoJSON,
  routePointsGeoJSON,
} from "@/lib/demo-route";

const SOURCE_LEGS = "route-legs";
const SOURCE_POINTS = "route-points";

function framePadding(width: number) {
  return width >= DESKTOP_BREAKPOINT_PX
    ? FRAME_PADDING.desktop
    : FRAME_PADDING.compact;
}

/**
 * Line and marker colours are read from the design tokens at mount rather
 * than hard-coded, so the globe's route stays in step with the palette.
 * Mapbox paint properties want concrete colours, not CSS variables.
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

export function GlobeStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const failure = MAPBOX_TOKEN
    ? mapError
    : "No Mapbox token — set NEXT_PUBLIC_MAPBOX_TOKEN.";

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const sea = tokenColor("--sb-sea", "#5fa8c7");
    const accent = tokenColor("--sb-accent", "#ff6b4a");
    const text = tokenColor("--sb-text", "#e9e4d8");
    const ink = tokenColor("--sb-ink", "#0e1622");

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
      // to stay visible under their terms — so it joins the attribution and
      // zoom controls on the right.
      logoPosition: "bottom-right",
      // Low enough that a phone-width viewport can still fit the whole route:
      // clamping at 0.8 pushed the Australian end off the right edge.
      minZoom: 0.3,
      maxZoom: 8,
    });
    mapRef.current = map;

    const frameRoute = (animate: boolean) => {
      const width = container.clientWidth;
      const duration = animate ? 900 : 0;

      if (width < COMPACT_CAMERA_MAX_WIDTH_PX) {
        map.easeTo({ ...COMPACT_CAMERA, duration });
        return;
      }

      map.fitBounds(ROUTE_BOUNDS, {
        padding: framePadding(width),
        maxZoom: GLOBE_MAX_FIT_ZOOM,
        duration,
      });
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
    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false, visualizePitch: false }),
      "bottom-right",
    );
    map.scrollZoom.disable(); // page scroll should not fight the globe on mobile

    map.on("error", (event) => {
      setMapError(event.error?.message ?? "Mapbox failed to load.");
    });

    map.on("style.load", () => {
      // Atmosphere: the globe should read as a planet in space, not a sphere
      // on a flat backdrop.
      map.setFog({
        color: "rgb(18, 30, 46)",
        "high-color": "rgb(26, 48, 74)",
        // Kept low: Valencia sits ~80° from the camera — near the limb, because
        // Valencia and Melbourne are very nearly antipodal and no globe
        // framing can put both in the middle. A heavier haze would swallow
        // the European end of the route entirely.
        "horizon-blend": 0.015,
        "space-color": "rgb(7, 12, 20)",
        "star-intensity": 0.12,
      });

      map.addSource(SOURCE_LEGS, { type: "geojson", data: routeLegsGeoJSON() });
      map.addSource(SOURCE_POINTS, { type: "geojson", data: routePointsGeoJSON() });

      // Wide, soft casing under the route so arcs stay visible over the
      // bright Australian landmass.
      map.addLayer({
        id: "legs-glow",
        type: "line",
        source: SOURCE_LEGS,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": sea,
          "line-width": ["case", ["get", "longHaul"], 9, 6],
          "line-opacity": 0.18,
          "line-blur": 6,
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
        paint: { "line-color": sea, "line-width": 2.2, "line-opacity": 0.95 },
      });

      map.addLayer({
        id: "legs-hops",
        type: "line",
        source: SOURCE_LEGS,
        filter: ["==", ["get", "longHaul"], false],
        layout: { "line-cap": "butt", "line-join": "round" },
        paint: {
          "line-color": sea,
          "line-width": 1.4,
          "line-opacity": 0.85,
          "line-dasharray": [2.5, 1.8],
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
            sea,
            accent,
          ],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": ink,
        },
      });

      map.addLayer({
        id: "point-labels",
        type: "symbol",
        source: SOURCE_POINTS,
        layout: {
          "text-field": ["get", "code"],
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
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
          "text-halo-color": ink,
          "text-halo-width": 1.4,
          "text-opacity": 0.9,
        },
      });

      frameRoute(false);
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

  return (
    <div className="absolute inset-0 bg-[#070c14]">
      {/* Sized with width/height, not inset-0: mapbox-gl.css sets
          `.mapboxgl-map { position: relative }` on whatever element it
          mounts into, and its stylesheet lands after Tailwind's, so an
          `absolute inset-0` container silently collapses to zero height. */}
      <div ref={containerRef} className="size-full" />

      {/* Vignette: darkens the corners the panels sit in, so glass chrome
          keeps its contrast wherever the globe happens to be bright. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 45%, transparent 40%, rgb(7 12 20 / 0.55) 100%)",
        }}
      />

      {!ready && !failure && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="sb-label animate-pulse text-[#93a0ad]">
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
