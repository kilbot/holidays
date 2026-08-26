"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import {
  GLOBE_HOME_VIEW,
  MAP_STYLE,
  routeLegsGeoJSON,
  routePointsGeoJSON,
} from "@/lib/demo-route";

const SOURCE_LEGS = "route-legs";
const SOURCE_POINTS = "route-points";

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

export function GlobeStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      setFailure("No Mapbox token — set NEXT_PUBLIC_MAPBOX_TOKEN.");
      return;
    }

    mapboxgl.accessToken = token;

    const sea = tokenColor("--sb-sea", "#5fa8c7");
    const accent = tokenColor("--sb-accent", "#ff6b4a");
    const text = tokenColor("--sb-text", "#e9e4d8");
    const ink = tokenColor("--sb-ink", "#0e1622");

    const map = new mapboxgl.Map({
      container,
      style: MAP_STYLE,
      projection: { name: "globe" },
      center: GLOBE_HOME_VIEW.center,
      zoom: GLOBE_HOME_VIEW.zoom,
      pitch: GLOBE_HOME_VIEW.pitch,
      bearing: GLOBE_HOME_VIEW.bearing,
      attributionControl: false,
      // The globe is a stage, not a map to get lost in: keep it in one hemisphere.
      minZoom: 0.8,
      maxZoom: 8,
    });
    mapRef.current = map;

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
      setFailure(event.error?.message ?? "Mapbox failed to load.");
    });

    map.on("style.load", () => {
      // Atmosphere: the globe should read as a planet in space, not a sphere
      // on a flat backdrop.
      map.setFog({
        color: "rgb(18, 30, 46)",
        "high-color": "rgb(26, 48, 74)",
        "horizon-blend": 0.02,
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
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": text,
          "text-halo-color": ink,
          "text-halo-width": 1.4,
          "text-opacity": 0.9,
        },
      });

      setReady(true);
    });

    const handleResize = () => map.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="absolute inset-0 bg-[#070c14]">
      <div ref={containerRef} className="absolute inset-0" />

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
