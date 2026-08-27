/**
 * Where the Plan can be.
 *
 * A Location is a place with a cost regime and an airport. It is coarser than
 * a Capsule (Margaret River and the caves and the Wilyabrup loop are one
 * Location) and finer than a market (Port Douglas and Hobart are both "a paid
 * city" and are not the same place).
 *
 * The table is deliberately small and hand-written rather than derived from the
 * 413-row Catalog: these are the places the researched Capsules actually
 * happen, and a Catalog idea that names an airport outside this list gets a
 * synthetic Location built from `lib/airports.ts` at the generic `regional`
 * rate — honest about knowing only the airport.
 */

import { AIRPORT_COORDINATES, type Coordinates } from "@/lib/airports";
import type { MarketId } from "@/lib/engine/constants";
import type { Location } from "@/lib/engine/types";

/** Where the couple leaves from and returns to. */
export const ORIGIN_AIRPORT = "VLC";

export const LOCATIONS: readonly Location[] = [
  {
    id: "transit",
    name: "In transit",
    market: "transit",
    airport: ORIGIN_AIRPORT,
    homeBase: false,
    weather: null,
    regions: [],
  },
  {
    id: "perth",
    name: "Perth",
    market: "home-base-city",
    airport: "PER",
    homeBase: true,
    weather: "perth",
    regions: ["WA"],
  },
  {
    id: "margaret-river",
    name: "Margaret River",
    // Paid nights, but the car is the family's — the Capsule carries no hire.
    market: "regional",
    airport: "PER",
    homeBase: false,
    weather: "margaret_river",
    regions: ["WA"],
  },
  {
    id: "rottnest",
    // A day trip: the couple sleeps at the Perth Home base either side of it.
    name: "Rottnest Island",
    market: "home-base-city",
    airport: "PER",
    homeBase: true,
    weather: "perth",
    regions: ["WA"],
  },
  {
    id: "sydney",
    name: "Sydney",
    market: "sydney",
    airport: "SYD",
    homeBase: false,
    weather: "sydney",
    regions: ["NSW"],
  },
  {
    id: "port-douglas",
    name: "Port Douglas",
    market: "cairns",
    airport: "CNS",
    homeBase: false,
    weather: "port_douglas",
    regions: ["QLD"],
  },
  {
    id: "byron",
    name: "Byron Bay",
    market: "regional",
    airport: "OOL",
    homeBase: false,
    weather: "byron_bay",
    regions: ["NSW-Northern-Rivers"],
  },
  {
    id: "tasmania",
    name: "Tasmania",
    market: "hobart",
    airport: "HBA",
    homeBase: false,
    weather: "hobart",
    regions: ["TAS"],
  },
  {
    id: "melbourne",
    name: "Melbourne",
    market: "melbourne",
    airport: "MEL",
    homeBase: false,
    weather: "melbourne",
    regions: ["VIC"],
  },
];

const BY_ID = new Map(LOCATIONS.map((location) => [location.id, location]));

/**
 * A Location by id, inventing one for a Catalog idea that names an airport we
 * have no researched place for. The invented Location is marked by its id
 * (`airport:XXX`) so the UI can say "we only know the airport" rather than
 * pretending Cooktown is a researched base.
 */
export function locationById(id: string): Location {
  const known = BY_ID.get(id);
  if (known) return known;

  const iata = id.startsWith("airport:") ? id.slice(8) : id.toUpperCase();
  return {
    id,
    name: iata,
    market: marketForAirport(iata),
    airport: iata,
    homeBase: false,
    weather: null,
    regions: [],
  };
}

/** The Location a Catalog idea's `nearest_airport` puts it at. */
export function locationIdForAirport(iata: string): string {
  const known = LOCATIONS.find(
    (location) => location.airport === iata && location.id !== "transit",
  );
  return known ? known.id : `airport:${iata}`;
}

/**
 * Which cost regime an unresearched airport falls into. Only the four the
 * research actually priced get their own; everything else is `regional`, which
 * is the honest answer for a Catalog idea nobody has costed properly yet.
 */
function marketForAirport(iata: string): MarketId {
  if (iata === "SYD") return "sydney";
  if (iata === "MEL" || iata === "AVV") return "melbourne";
  if (iata === "HBA" || iata === "LST") return "hobart";
  if (iata === "CNS") return "cairns";
  if (iata === "PER") return "home-base-city";
  return "regional";
}

/** Where a Location is, for pricing a drive. Null where the airport is unknown. */
export function coordinatesOf(locationId: string): Coordinates | null {
  const location = locationById(locationId);
  return AIRPORT_COORDINATES[location.airport] ?? null;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle kilometres between two Locations. Null if either has no dot. */
export function distanceKm(fromId: string, toId: string): number | null {
  const from = coordinatesOf(fromId);
  const to = coordinatesOf(toId);
  if (!from || !to) return null;

  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const [lon1, lat1] = from;
  const [lon2, lat2] = to;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}
