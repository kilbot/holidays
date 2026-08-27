/**
 * What sits on the globe besides the route.
 *
 * Two layers of Capsule, matching the two tiers the site already keeps apart:
 * the eight researched Capsules are always on, at their real bases; the
 * Catalog's 413 shallow ideas appear only once a traveller marks one
 * *interested*, and then only as a dot at the airport it is reached through.
 *
 * Shortlisting an idea putting it on the map is the point: the sift's whole
 * job is turning 413 rows into a handful worth looking at, and "worth looking
 * at" is a geographic question — three interested ideas clustered around
 * Alice Springs is a fact about the trip that no list view can show.
 *
 * Ideas are grouped by airport rather than plotted individually because the
 * Catalog is airport-resolution data: two ideas out of Hobart would otherwise
 * be two dots at exactly the same pixel. One dot, a count, and the list is in
 * the popup.
 */

import {
  airportCodeOf,
  airportCoordinates,
  type Coordinates,
} from "@/lib/airports";
import { CATALOG, type CatalogIdea } from "@/lib/catalog";
import { DEEP_CAPSULES } from "@/lib/deep-capsules";
import type { ShortlistMap } from "@/lib/shortlist";

export interface CapsuleMarkerProperties {
  id: string;
  name: string;
  /** The airport the Capsule is reached through — how a Leg finds it. */
  airport: string;
}

export function capsuleMarkersGeoJSON(): GeoJSON.FeatureCollection<
  GeoJSON.Point,
  CapsuleMarkerProperties
> {
  return {
    type: "FeatureCollection",
    features: DEEP_CAPSULES.map((capsule) => ({
      type: "Feature" as const,
      properties: {
        id: capsule.id,
        name: capsule.name,
        airport: capsule.airport,
      },
      geometry: { type: "Point" as const, coordinates: capsule.base },
    })),
  };
}

export interface InterestedCluster {
  /** IATA code the ideas share. */
  code: string;
  coordinates: Coordinates;
  ideas: CatalogIdea[];
}

/**
 * The *interested* Catalog ideas, grouped by the airport that reaches them.
 *
 * Ideas whose `nearest_airport` carries no mappable code ("varies", "n/a" —
 * twelve of the 413) are left off rather than guessed at.
 */
export function interestedClusters(marks: ShortlistMap): InterestedCluster[] {
  const byCode = new Map<string, InterestedCluster>();

  for (const idea of CATALOG) {
    if (marks[idea.id] !== "interested") continue;
    const code = airportCodeOf(idea.nearest_airport);
    const coordinates = code ? airportCoordinates(idea.nearest_airport) : null;
    if (!code || !coordinates) continue;

    const existing = byCode.get(code);
    if (existing) existing.ideas.push(idea);
    else byCode.set(code, { code, coordinates, ideas: [idea] });
  }

  return [...byCode.values()];
}

export interface InterestedProperties {
  code: string;
  count: number;
  /** The single idea's id when the dot stands for exactly one. */
  soleId: string;
  label: string;
}

export function interestedGeoJSON(
  clusters: readonly InterestedCluster[],
): GeoJSON.FeatureCollection<GeoJSON.Point, InterestedProperties> {
  return {
    type: "FeatureCollection",
    features: clusters.map((cluster) => ({
      type: "Feature" as const,
      properties: {
        code: cluster.code,
        count: cluster.ideas.length,
        soleId: cluster.ideas.length === 1 ? cluster.ideas[0].id : "",
        label:
          cluster.ideas.length === 1
            ? cluster.ideas[0].name
            : `${cluster.ideas.length} ideas · ${cluster.code}`,
      },
      geometry: { type: "Point" as const, coordinates: cluster.coordinates },
    })),
  };
}

/**
 * The researched Capsules a Leg touches — the ones based at either endpoint.
 *
 * Endpoint matching is on the Capsule's own gateway airport, which is the
 * relationship the Leg actually has to it: flying PER→SYD is how you reach
 * both WA Capsules' base and Sydney's, and saying so is the point of
 * highlighting them.
 */
export function capsulesOnLeg(legId: string): string[] {
  const [from, to] = legId.split(">");
  return DEEP_CAPSULES.filter(
    (capsule) => capsule.airport === from || capsule.airport === to,
  ).map((capsule) => capsule.id);
}
