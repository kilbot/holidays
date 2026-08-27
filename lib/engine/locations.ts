/**
 * Where the Plan can be.
 *
 * A Location is a place with a cost regime and an airport. It is coarser than
 * a Capsule (Margaret River and the caves and the Wilyabrup loop are one
 * Location) and finer than a market (Port Douglas and Hobart are both "a paid
 * city" and are not the same place).
 *
 * The table is deliberately small and hand-written rather than derived from the
 * 415-row Catalog: these are the places the researched Capsules actually
 * happen, and a Catalog idea that names an airport outside this list gets a
 * synthetic Location built from `lib/airports.ts` at the generic `regional`
 * rate — honest about knowing only the airport.
 */

import { AIRPORT_COORDINATES, type Coordinates } from "@/lib/airports";
import type { MarketId } from "@/lib/engine/constants";
import type { Location } from "@/lib/engine/types";

/** Where the couple leaves from and returns to. */
export const ORIGIN_AIRPORT = "VLC";

/**
 * The hubs the two crossings are flown through, as Locations.
 *
 * They are Locations rather than bare airport codes for one reason: every
 * surface that names an end of a Leg — the Ledger's transit rows, the day
 * lines, the globe's stop labels — reads `locationById(...).name`, and an id
 * nothing recognises comes back named "HKG". A connection the couple spends
 * five hours in is still a place they go, and the map should say Hong Kong.
 *
 * No Day is ever spent at one. `landsAfter` puts the couple in Perth the
 * morning after the second sector leaves, and the research's own routing has
 * no hotel night at either hub — so these carry the `transit` regime, which is
 * the ledger's name for "the trip has started and has not landed", and price
 * nothing because nothing is placed here.
 *
 * The coordinates are the terminals, and that is exact rather than
 * approximate: unlike Port Douglas, a connection genuinely *is* its airport.
 */
const STOPOVER_LOCATIONS: readonly Location[] = [
  {
    id: "madrid",
    name: "Madrid",
    market: "transit",
    airport: "MAD",
    coords: [-3.5676, 40.4722], // Barajas T4, where the 22:30 Cathay leaves from
    homeBase: false,
    weather: null,
    regions: [],
  },
  {
    id: "hong-kong",
    name: "Hong Kong",
    market: "transit",
    airport: "HKG",
    coords: [113.9185, 22.308], // Chek Lap Kok
    homeBase: false,
    weather: null,
    regions: [],
  },
  {
    id: "singapore",
    name: "Singapore",
    market: "transit",
    airport: "SIN",
    coords: [103.9915, 1.3644], // Changi
    homeBase: false,
    weather: null,
    regions: [],
  },
  {
    id: "barcelona",
    name: "Barcelona",
    market: "transit",
    airport: "BCN",
    coords: [2.0785, 41.2971], // El Prat, where the train home starts
    homeBase: false,
    weather: null,
    regions: [],
  },
];

export const LOCATIONS: readonly Location[] = [
  {
    id: "transit",
    name: "In transit",
    market: "transit",
    airport: ORIGIN_AIRPORT,
    coords: null,
    homeBase: false,
    weather: null,
    regions: [],
  },
  ...STOPOVER_LOCATIONS,
  {
    id: "perth",
    name: "Perth",
    market: "home-base-city",
    airport: "PER",
    coords: [115.8613, -31.9523], // Perth CBD, not the airport
    homeBase: true,
    weather: "perth",
    regions: ["WA"],
  },
  {
    id: "mundaring",
    name: "Mundaring Hills",
    // Home base #3, docs/CONTEXT.md: Paul's dad, free lodging, a borrowed car.
    // It prices on the Perth card rather than `home-base-regional` because the
    // block's outings are Perth outings — the Hills are 35 km from Northbridge,
    // not 350 — and the extra fuel that run costs is exactly what the A$10–30
    // band on the Perth `local` rate is for. `docs/research/perth-live-music.md`
    // measures the run: 40–50 min to Northbridge, 55–65 to North Fremantle.
    market: "home-base-city",
    airport: "PER",
    coords: [116.1667, -31.9000], // Mundaring township, in the Perth Hills
    homeBase: true,
    weather: "perth",
    regions: ["WA"],
  },
  {
    id: "morawa",
    name: "Morawa",
    // Home base #2, docs/CONTEXT.md: the sister's farm, and since #54 the place
    // the Christmas hard Anchor actually happens. `home-base-regional` rather
    // than `home-base-city` because it is 370 km up the Midlands road from
    // Perth and everything is a drive — the A$30/day fuel line is the wheatbelt
    // being the wheatbelt, not a rate-card guess.
    market: "home-base-regional",
    airport: "PER",
    coords: [116.0100, -29.2100], // Morawa township, WA wheatbelt
    homeBase: true,
    // After Christmas the couple drives back down to Perth; the Buffer days
    // that follow are Perth days, not four more days on the farm.
    returnsTo: "perth",
    weather: "perth",
    regions: ["WA"],
  },
  {
    id: "margaret-river",
    name: "Margaret River",
    // Paid nights, but the car is the family's — the Capsule carries no hire.
    market: "regional",
    airport: "PER",
    coords: [115.0750, -33.9550], // Margaret River township
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
    coords: [115.5200, -32.0060], // Thomson Bay settlement
    homeBase: true,
    // Summer accommodation on the island is allocated by ballot; the day ends
    // on the last ferry back, and the Buffer days after it are Perth days.
    returnsTo: "perth",
    weather: "perth",
    regions: ["WA"],
  },
  {
    id: "sydney",
    name: "Sydney",
    market: "sydney",
    airport: "SYD",
    coords: [151.2093, -33.8688],
    homeBase: false,
    weather: "sydney",
    regions: ["NSW"],
  },
  {
    id: "port-douglas",
    name: "Port Douglas",
    market: "cairns",
    airport: "CNS",
    coords: [145.4650, -16.4840], // 60 km north of the Cairns airport
    homeBase: false,
    weather: "port_douglas",
    regions: ["QLD"],
  },
  {
    id: "byron",
    name: "Byron Bay",
    market: "regional",
    airport: "OOL",
    coords: [153.6120, -28.6434], // the Cape Byron end
    homeBase: false,
    weather: "byron_bay",
    regions: ["NSW-Northern-Rivers"],
  },
  {
    id: "tasmania",
    name: "Tasmania",
    market: "hobart",
    airport: "HBA",
    coords: [147.3272, -42.8821], // Hobart, where the arc starts
    homeBase: false,
    weather: "hobart",
    regions: ["TAS"],
  },
  {
    id: "melbourne",
    name: "Melbourne",
    market: "melbourne",
    airport: "MEL",
    coords: [144.9800, -37.7980], // Fitzroy / Collingwood, not the CBD
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
    // Only the airport is known — which is the honest resolution for a Catalog
    // idea whose sweep recorded a `nearest_airport` and nothing else.
    coords: AIRPORT_COORDINATES[iata] ?? null,
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

/**
 * Where a Location is, for pricing a drive — the place itself, falling back to
 * its gateway airport. Port Douglas is 60 km from the airport it flies into and
 * Margaret River is three hours from Perth's; a drive priced off the airports
 * would cost nothing at all.
 */
export function coordinatesOf(locationId: string): Coordinates | null {
  const location = locationById(locationId);
  return location.coords ?? AIRPORT_COORDINATES[location.airport] ?? null;
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
