/**
 * The two pre-programmed searches, built out of the research.
 *
 * `docs/research/flight-hubs.json` is the grid: thirteen European hubs with a
 * carrier set each, the Valencia positioning feed into every one of them, and
 * the seven Australian airports that can reach Spain on the way back. This
 * module turns that file into rows a page can rank — one row per credible
 * *itinerary*, not per airport — and scores each one through
 * `lib/flights/comfort.ts`.
 *
 * Three things are derived rather than restated, so the research file stays the
 * single source and a correction to it moves the page:
 *
 * - **Which carriers exist.** A carrier with a null fare band is the research
 *   saying "not available in December" (Cathay at Barcelona and Rome, Turkish
 *   to Perth, Qatar from Adelaide in February) and is dropped here.
 * - **What positioning costs.** Fare bands, protection, frequency and the
 *   arrival airport all come out of `positioningFromVLC`; whether a hop is a
 *   low-cost carrier — and therefore whether two hold bags have to be added
 *   before anyone compares it with a train — is derived from the carrier name.
 * - **Whether a night is needed.** Barcelona's is structural (a midday
 *   departure and no flight from Valencia at all), a wrong-airport transfer
 *   earns one, and a protected same-airport feed does not.
 *
 * **The comfort score covers the long-haul, not the positioning hop.** The
 * research's own ranking folds a Valencia→London hop into the London rows and
 * cannot fold anything into the Barcelona ones, because a train has no seat
 * score — so its numbers are not comparable hub to hub. Here every row is
 * scored from the hub outwards and the positioning move is *priced* instead,
 * in the chain. Two consequences, both intended: London's rows sit about a
 * tenth above the published table, and a hub reached by train is judged on the
 * same basis as one reached by Lufthansa.
 *
 * The other deliberate divergence is Madrid on Singapore Airlines. The research
 * ranks it 8.9 by scoring MAD→BCN as a narrowbody hop; the route grid, written
 * the same day, says SQ387 *originates* at Madrid and through-stops Barcelona
 * on the same A350. The aircraft fact wins, so the row scores 9.0 — one extra
 * ground stop on the same metal, which is exactly what the −0.25 is for.
 *
 * What is *not* derivable is the aircraft. The fare API returns a carrier and a
 * price and never says what metal is filed, and the research file is a route
 * grid, not a fleet plan — so `LONGHAUL_METAL` below carries the likely type
 * per carrier and via-point, and says for which hubs the research actually
 * confirmed it. Everywhere it did not, the sector is marked unconfirmed and the
 * comfort score takes the −0.75 the formula asks for. That penalty is the point:
 * it is the difference between a documented Barcelona A350 and an assumption.
 */

import hubsFile from "@/docs/research/flight-hubs.json";
import { AIRPORT_COORDINATES, type Coordinates } from "@/lib/airports";
import { scoreItinerary, type ComfortScore, type Sector } from "@/lib/flights/comfort";
import { OUTBOUND_HUBS, RETURN_ARRIVALS, RETURN_ORIGINS } from "@/lib/flights/grid";

/* ------------------------------------------------------------------ */
/* The research file                                                    */
/* ------------------------------------------------------------------ */

interface HubCarrier {
  carrier: string;
  via: string | null;
  stops: number | null;
  typicalDecBandEurPP?: string | null;
  typicalFebBandEurPP?: string | null;
  arrivesAt?: string;
  confidence: string;
  note?: string;
}

interface PositioningEntry {
  carrier: string;
  airport?: string;
  typicalFareEur: string | null;
  frequency: string;
  protected: boolean | string;
  note?: string;
}

interface GroundOption {
  mode: string;
  operators: string[];
  duration: string;
  typicalFareEur: string;
  frequency: string;
  onwardToTerminal?: string;
  note?: string;
}

interface OutboundHub {
  airport: string;
  city: string;
  rank: number | null;
  carriers: HubCarrier[];
  positioningFromVLC: PositioningEntry[];
  groundOption: GroundOption | null;
  taxPenaltyEurPP?: number;
  taxPenaltyNote?: string;
  overnightPracticality: string;
  overnightNote?: string;
  notes: string;
}

interface ReturnAirport {
  airport: string;
  city: string;
  rank: number | null;
  excluded?: boolean;
  carriers: HubCarrier[];
  notes: string;
}

interface HubsFile {
  meta: { structural_findings: string[] };
  outbound: OutboundHub[];
  return: ReturnAirport[];
}

const HUBS = hubsFile as unknown as HubsFile;

/* ------------------------------------------------------------------ */
/* Block hours                                                         */
/* ------------------------------------------------------------------ */

/**
 * Airports the research names that the Catalog's table never needed — every
 * European hub, and every Asian and Gulf via-point on the way to Perth.
 * [longitude, latitude], the terminal's own position.
 */
const HUB_COORDINATES: Readonly<Record<string, Coordinates>> = {
  VLC: [-0.4816, 39.4893],
  BCN: [2.0785, 41.2971],
  MAD: [-3.5676, 40.4936],
  MXP: [8.7281, 45.6306],
  BGY: [9.7042, 45.6739],
  CDG: [2.5479, 49.0097],
  ORY: [2.3594, 48.7233],
  BVA: [2.1128, 49.4544],
  LHR: [-0.4543, 51.47],
  LGW: [-0.1821, 51.1537],
  STN: [0.235, 51.885],
  LTN: [-0.3683, 51.8747],
  FRA: [8.5622, 50.0379],
  MUC: [11.7861, 48.3538],
  FCO: [12.2389, 41.8003],
  AMS: [4.7639, 52.3086],
  ZRH: [8.5492, 47.4647],
  VIE: [16.5697, 48.1103],
  IST: [28.7519, 41.2753],
  BRU: [4.4844, 50.9014],
  CRL: [4.4538, 50.4592],
  SIN: [103.9915, 1.3644],
  HKG: [113.9185, 22.308],
  DOH: [51.6081, 25.2731],
  DXB: [55.3644, 25.2532],
  AUH: [54.6511, 24.433],
  BKK: [100.7501, 13.69],
  KUL: [101.7099, 2.7456],
  CAN: [113.2988, 23.3924],
  SGN: [106.652, 10.8188],
};

const coordinatesOf = (code: string): Coordinates | null =>
  HUB_COORDINATES[code] ?? AIRPORT_COORDINATES[code] ?? null;

const RADIANS = Math.PI / 180;

function greatCircleKm(from: Coordinates, to: Coordinates): number {
  const [lon1, lat1] = from;
  const [lon2, lat2] = to;
  const dLat = (lat2 - lat1) * RADIANS;
  const dLon = (lon2 - lon1) * RADIANS;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * RADIANS) * Math.cos(lat2 * RADIANS) * Math.sin(dLon / 2) ** 2;
  return 6_371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Block hours for a sector, from the distance.
 *
 * Cruise at 850 km/h plus 36 minutes of taxi and climb reproduces the schedules
 * the research quotes to within a few minutes — Hong Kong→Perth lands on 7h40,
 * Singapore→Perth on 5h, Doha→Perth on 11h. It is only ever used as a
 * *weighting*, never shown as a timetable: the page prints durations only when
 * a live quote supplies a real one.
 */
export function blockHours(from: string, to: string): number {
  const start = coordinatesOf(from);
  const end = coordinatesOf(to);
  if (!start || !end) return 2;
  return Math.round((greatCircleKm(start, end) / 850 + 0.6) * 10) / 10;
}

/* ------------------------------------------------------------------ */
/* Carriers and metal                                                  */
/* ------------------------------------------------------------------ */

/** The research writes carrier names; the ratings file is keyed by IATA code. */
const CARRIER_IATA: Readonly<Record<string, string>> = {
  "Singapore Airlines": "SQ",
  "Qatar Airways": "QR",
  "Cathay Pacific": "CX",
  Emirates: "EK",
  Etihad: "EY",
  Qantas: "QF",
  "British Airways + Qantas": "BA",
  "Turkish Airlines": "TK",
  "Malaysia Airlines": "MH",
  "Thai Airways": "TG",
  "China Southern": "CZ",
  "Vietnam Airlines": "VN",
  Scoot: "TR",
};

/** The metal each sector of an itinerary is likely to be flown on. */
interface MetalSpec {
  /** One aircraft key per sector, in order. */
  aircraft: readonly string[];
  /** Disambiguates a carrier's two configs of one type (BA's A380s). */
  variant?: string;
  /**
   * The airports where the research actually confirms this metal. Anywhere
   * else the type is an inference from a sister route and the itinerary takes
   * the formula's −0.75.
   */
  confirmedAt?: readonly string[];
  /** True when the metal is a coin-flip everywhere — the BA retrofit. */
  neverConfirmed?: boolean;
}

/**
 * Likely metal, keyed by `carrier|via`.
 *
 * Sourced from `comfort-ratings.json`'s `carrierConfigs` where a config exists
 * and from the route notes in `flight-hubs.json` where one does not. The
 * `confirmedAt` lists are the honest part: Singapore's A350-900 is documented
 * out of Barcelona, Milan and Munich, so a Brussels departure gets the same
 * aircraft with the unconfirmed flag rather than the same score.
 */
const LONGHAUL_METAL: Readonly<Record<string, MetalSpec>> = {
  /* --- Outbound, Europe → Perth --- */
  "SQ|SIN": { aircraft: ["A350-900", "A350-900"], confirmedAt: ["BCN", "MXP", "MUC"] },
  "SQ|BCN + SIN": { aircraft: ["A350-900", "A350-900", "A350-900"], confirmedAt: ["MAD"] },
  "CX|HKG": { aircraft: ["A350-900", "A350-900"], confirmedAt: ["MAD", "MXP"] },
  "QR|DOH": { aircraft: ["A350-1000", "777-300ER"], confirmedAt: ["MAD", "BCN"] },
  "EK|DXB": { aircraft: ["A380-800", "777-300ER"], confirmedAt: ["MAD"] },
  "TG|BKK": { aircraft: ["A350-900", "787-9"], confirmedAt: [] },
  // China Southern's Madrid route is the one the research documented, and even
  // there the config is low confidence — which shows as a flagged seat score
  // rather than as the unconfirmed-metal penalty.
  "CZ|CAN": { aircraft: ["787-9", "787-9"], confirmedAt: ["MAD"] },
  "MH|KUL": { aircraft: ["A350-900", "A330-900neo"], confirmedAt: ["LHR"] },
  "VN|SGN": { aircraft: ["787-9", "787-9"], confirmedAt: [] },
  "QF|nonstop": { aircraft: ["787-9"], confirmedAt: ["LHR"] },
  "BA|SIN": { aircraft: ["A380-800", "A330-300"], variant: "UNREFURBISHED", neverConfirmed: true },
  "TR|SIN": { aircraft: ["787-9", "787-8"], confirmedAt: ["VIE"] },

  /* --- Return, Australia → Europe --- */
  "TK|SIN + IST|return": {
    aircraft: ["A350-900", "A350-900", "A350-900"],
    confirmedAt: ["SYD", "MEL"],
  },
  "SQ|SIN|return": { aircraft: ["A380-800", "A350-900"], confirmedAt: ["SYD", "MEL"] },
  "CX|HKG|return": { aircraft: ["A350-900", "A350-900"], confirmedAt: ["SYD", "MEL", "BNE"] },
  "QR|DOH|return": { aircraft: ["777-300ER", "A350-1000"], confirmedAt: ["SYD", "MEL", "BNE"] },
  "QR|MEL + DOH|return": {
    aircraft: ["777-300ER", "777-300ER", "A350-1000"],
    confirmedAt: ["CBR"],
  },
  "EK|DXB|return": { aircraft: ["A380-800", "A380-800"], confirmedAt: [] },
  "EY|AUH|return": { aircraft: ["A350-1000", "787-9"], confirmedAt: ["SYD"] },
  "CZ|CAN|return": { aircraft: ["787-9", "787-9"], confirmedAt: [] },
  "MH|KUL|return": { aircraft: ["A330-900neo", "A350-900"], confirmedAt: ["SYD", "MEL"] },
};

/**
 * Barcelona's Emirates sector is the research's own exception: the A380 was
 * downgraded to a 777 in July 2026, so this one hub does not get the Madrid
 * aircraft.
 */
const METAL_OVERRIDES: Readonly<Record<string, MetalSpec>> = {
  "EK|DXB|BCN": { aircraft: ["777-300ER", "777-300ER"], confirmedAt: ["BCN"] },
  "EY|AUH|return|MEL": { aircraft: ["787-9", "787-9"], confirmedAt: ["MEL"] },
};

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

export type Band = readonly [number, number];

/** `"1150-1700"` → `[1150, 1700]`. */
function parseBand(value: string | null | undefined): Band | null {
  if (!value) return null;
  const match = /(\d+)\s*-\s*(\d+)/.exec(value.replace(/,/g, ""));
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

/**
 * The research files are written in plain ASCII — `->` for arrows and a hyphen
 * where a dash belongs. The notes are quoted verbatim on the page, so they are
 * typeset on the way through rather than edited at the source.
 */
function tidy(text: string | undefined | null): string | null {
  if (!text) return null;
  return text.replace(/\s->\s/g, " → ").replace(/(\S) - (\S)/g, "$1 — $2");
}

/** `"BCN + SIN"` → `["BCN", "SIN"]`; `"nonstop"` and `null` → `[]`. */
function parseVia(via: string | null): string[] {
  if (!via || via === "nonstop") return [];
  return via.split("+").map((part) => part.trim());
}

/* ------------------------------------------------------------------ */
/* Positioning                                                         */
/* ------------------------------------------------------------------ */

/**
 * The carriers that sell a seat and then sell the bag separately. Two people
 * with two 23kg cases pay this before an LCC fare can be compared with a
 * train ticket or a flag-carrier feed, which is the whole argument of the
 * research's positioning-arbitrage table.
 */
const LOW_COST_CARRIERS: readonly string[] = [
  "Ryanair",
  "Wizz Air",
  "easyJet",
  "Transavia",
  "Vueling",
  "Scoot",
];

/** €35–60 per 23kg bag each way on peak December dates, two bags, one way. */
export const HOLD_BAGS_EUR_COUPLE: Band = [70, 120];

/**
 * The coach or train from the airport the cheap fare actually lands at to the
 * one the long-haul leaves from, per person.
 *
 * The research is emphatic that this is where the LCC saving goes: Bergamo→
 * Malpensa is 50–70 minutes with a change at Milano Centrale, Beauvais→CDG is
 * two and a half hours and two transfers, Stansted or Luton→Heathrow is an
 * hour and a half of National Express. One band covers them because the fares
 * are all in the same range and the range is what matters — the point is that
 * it is never zero, which is what a city-pair comparison assumes.
 */
const SURFACE_TRANSFER_EUR_PP: Band = [12, 35];

/**
 * An airport-hotel night for the couple, the figure the research's arbitrage
 * table prices a positioning move with. Two hubs move it: Zurich runs about
 * double a Milan or Rome night, and Vienna is the best value in the grid.
 */
const HOTEL_NIGHT_EUR_COUPLE: Band = [80, 140];
const HOTEL_OVERRIDES: Readonly<Record<string, Band>> = {
  ZRH: [160, 280],
  VIE: [60, 110],
};

/** UK Air Passenger Duty, ultra-long-haul economy, £106 pp from 1 Apr 2026. */
export const APD_EUR_PP = 124;

export type Protection = "protected" | "partial" | "self-transfer";
export type Overnight = "forced" | "recommended" | "optional";

export interface PositioningOption {
  id: string;
  carrier: string;
  mode: "flight" | "train";
  /** Where it actually lands, which is not always the hub. */
  arrivesAt: string;
  sameAirport: boolean;
  protection: Protection;
  frequency: string;
  fareEurPP: Band;
  /** Hold bags for the couple, when the carrier charges for them. */
  holdBagsEurCouple: Band | null;
  overnight: Overnight;
  hotelEurCouple: Band | null;
  /** The coach or train to the hub, for two, when it lands somewhere else. */
  transferEurCouple: Band | null;
  /** Fare + bags + transfer + hotel, for two. */
  totalEurCouple: Band;
  note: string | null;
  /** The surface transfer a wrong-airport arrival adds. */
  transferNote: string | null;
}

const sum = (bands: readonly (Band | null)[]): Band =>
  bands.reduce<[number, number]>(
    (total, band) => (band ? [total[0] + band[0], total[1] + band[1]] : total),
    [0, 0],
  );

function positioningFor(hub: OutboundHub): PositioningOption[] {
  const options: PositioningOption[] = [];
  const hotel = HOTEL_OVERRIDES[hub.airport] ?? HOTEL_NIGHT_EUR_COUPLE;

  for (const entry of hub.positioningFromVLC) {
    const fare = parseBand(entry.typicalFareEur);
    // A null band with a SEASONAL note is the research saying the route does
    // not operate in December — Frankfurt-Hahn and ITA's Valencia–Rome.
    if (!fare) continue;

    const arrivesAt = entry.airport ?? hub.airport;
    const sameAirport = arrivesAt === hub.airport;
    const lowCost = LOW_COST_CARRIERS.some((name) => entry.carrier.startsWith(name));
    const protection: Protection =
      entry.protected === true ? "protected" : entry.protected === "partial" ? "partial" : "self-transfer";

    // Barcelona's night is structural. Everywhere else, a same-airport
    // protected feed can be flown on the day and a cross-city transfer cannot.
    const overnight: Overnight =
      hub.airport === "BCN" ? "forced" : sameAirport && protection !== "self-transfer" ? "optional" : "recommended";

    const holdBags = lowCost ? HOLD_BAGS_EUR_COUPLE : null;
    const hotelCost = overnight === "optional" ? null : hotel;
    const transfer: Band | null = sameAirport
      ? null
      : [SURFACE_TRANSFER_EUR_PP[0] * 2, SURFACE_TRANSFER_EUR_PP[1] * 2];

    options.push({
      id: `${hub.airport}-${entry.carrier}-${arrivesAt}`.replace(/\s+/g, "-"),
      carrier: entry.carrier,
      mode: "flight",
      arrivesAt,
      sameAirport,
      protection,
      frequency: entry.frequency,
      fareEurPP: fare,
      holdBagsEurCouple: holdBags,
      overnight,
      hotelEurCouple: hotelCost,
      transferEurCouple: transfer,
      totalEurCouple: sum([[fare[0] * 2, fare[1] * 2], holdBags, transfer, hotelCost]),
      note: tidy(entry.note),
      transferNote: sameAirport
        ? null
        : (tidy(entry.note) ?? `Lands at ${arrivesAt}, not ${hub.airport}.`),
    });
  }

  if (hub.groundOption) {
    const fare = parseBand(hub.groundOption.typicalFareEur);
    if (fare) {
      // Madrid's 22:30 Cathay departure is what makes the same-day train safe;
      // Barcelona's midday one is what makes the night mandatory.
      const overnight: Overnight = hub.airport === "BCN" ? "forced" : "optional";
      const hotelCost = overnight === "forced" ? hotel : null;
      options.push({
        id: `${hub.airport}-train`,
        carrier: hub.groundOption.operators.join(" / "),
        mode: "train",
        arrivesAt: hub.airport,
        sameAirport: true,
        protection: "self-transfer",
        frequency: `${hub.groundOption.frequency}, ${hub.groundOption.duration}`,
        fareEurPP: fare,
        holdBagsEurCouple: null,
        overnight,
        hotelEurCouple: hotelCost,
        // The onward hop from the station to the terminal (Sants → El Prat,
        // Atocha → T4) is a city ticket, not a coach fare: inside the noise.
        transferEurCouple: null,
        totalEurCouple: sum([[fare[0] * 2, fare[1] * 2], hotelCost]),
        note: tidy(hub.groundOption.note),
        transferNote: tidy(hub.groundOption.onwardToTerminal),
      });
    }
  }

  // Cheapest honest total first — which is not the cheapest fare, and that is
  // the point the page is making.
  return options.sort((a, b) => a.totalEurCouple[0] - b.totalEurCouple[0]);
}

/* ------------------------------------------------------------------ */
/* The last leg home, on the return                                    */
/* ------------------------------------------------------------------ */

/**
 * Getting from where the return lands to Valencia.
 *
 * Stated rather than derived: the research's `toVLCorNearby` block is prose
 * per arrival airport, and there are only four arrival airports. The one that
 * matters is Madrid — the only European arrival that can be through-ticketed
 * home, because Barcelona→Valencia has no flight on any carrier.
 */
export interface HomeLeg {
  from: string;
  mode: "flight" | "train" | "none";
  carrier: string;
  fareEurPP: Band;
  protection: Protection;
  detail: string;
}

const HOME_LEGS: Readonly<Record<string, HomeLeg>> = {
  VLC: {
    from: "VLC",
    mode: "none",
    carrier: "—",
    fareEurPP: [0, 0],
    protection: "protected",
    detail: "Ends at Valencia's own airport. No train, no positioning flight, no second ticket.",
  },
  MAD: {
    from: "MAD",
    mode: "flight",
    carrier: "Iberia / Air Europa",
    fareEurPP: [40, 110],
    protection: "protected",
    detail:
      "The only European arrival that can be through-ticketed home: Iberia rides the same oneworld PNR as Cathay or Qatar, Air Europa the same SkyTeam PNR as China Southern. The 1h56 train (€8–55) is the cheaper unprotected alternative.",
  },
  BCN: {
    from: "BCN",
    mode: "train",
    carrier: "Renfe AVE / Euromed",
    fareEurPP: [13, 45],
    protection: "self-transfer",
    detail:
      "There is no flight between Barcelona and Valencia on any carrier. Sants → Valencia is 2h55–3h10, multiple daily, and unprotected by construction.",
  },
  LHR: {
    from: "LHR",
    mode: "flight",
    carrier: "British Airways",
    fareEurPP: [70, 180],
    protection: "protected",
    detail:
      "BA London→Valencia is oneworld, so it can ride the same ticket. The LCC alternatives from Gatwick, Stansted or Luton are €30–110 and land at the wrong London airport.",
  },
  CDG: {
    from: "CDG",
    mode: "flight",
    carrier: "Air France",
    fareEurPP: [70, 160],
    protection: "protected",
    detail: "SkyTeam, same airport, so it can ride the same ticket as the long-haul.",
  },
};

/* ------------------------------------------------------------------ */
/* Options                                                             */
/* ------------------------------------------------------------------ */

export type FlagKind = "protected" | "self-transfer" | "apd" | "gulf" | "metal" | "check" | "tip";

export interface Flag {
  kind: FlagKind;
  label: string;
  detail: string;
}

export interface SearchOption {
  id: string;
  leg: "outbound" | "return";
  origin: string;
  originCity: string;
  /** PER outbound; BCN, MAD, VLC, LHR or CDG on the return. */
  destination: string;
  carrier: string;
  /** IATA, or null for a carrier the ratings file does not cover. */
  iata: string | null;
  via: readonly string[];
  stops: number;
  /** Per person, return, economy — the research's own band. Never a quote. */
  bandEurPP: Band | null;
  comfort: ComfortScore;
  /** Surcharges the fare band deliberately excludes, for the couple. */
  surchargesEurCouple: readonly { label: string; eur: number; detail: string }[];
  /** Ways of reaching this hub from Valencia, cheapest honest total first. */
  positioning: readonly PositioningOption[];
  /** How the return gets from its arrival airport to Valencia. */
  homeLeg: HomeLeg | null;
  flags: readonly Flag[];
  note: string | null;
  confidence: string;
  /** Whether `/api/fares` covers this origin/destination pair at all. */
  searchable: boolean;
}

function sectorsFor(
  origin: string,
  destination: string,
  iata: string | null,
  via: readonly string[],
  key: string,
): Sector[] {
  const spec = METAL_OVERRIDES[`${key}|${origin}`] ?? LONGHAUL_METAL[key];
  const stops = [origin, ...via, destination];
  const confirmed = spec?.neverConfirmed
    ? false
    : (spec?.confirmedAt?.includes(origin) ?? false);

  return stops.slice(0, -1).map((from, index) => {
    const to = stops[index + 1];
    return {
      // British Airways + Qantas is the one two-carrier itinerary the research
      // names; its second sector is Qantas metal and scores as Qantas.
      carrier: iata === "BA" && index > 0 ? "QF" : (iata ?? "??"),
      aircraft: spec?.aircraft[index] ?? "787-9",
      to,
      hours: blockHours(from, to),
      metalConfirmed: confirmed,
      variant: spec?.variant,
    };
  });
}

function flagsFor(
  option: Omit<SearchOption, "flags">,
  hubNote: string | undefined,
): Flag[] {
  const flags: Flag[] = [];

  const bestProtection = option.positioning.find((entry) => entry.protection === "protected");
  if (bestProtection) {
    flags.push({
      kind: "protected",
      label: "Protected feed",
      detail: `${bestProtection.carrier} from Valencia can be ticketed onto this long-haul as a single PNR — bags checked through, and the airline owns a missed connection instead of you.`,
    });
  } else if (option.leg === "outbound" && option.positioning.length > 0) {
    flags.push({
      kind: "self-transfer",
      label: "Self-transfer",
      detail:
        "Every way into this hub from Valencia is a separate ticket. A missed connection on a sold-out mid-December Perth flight is close to uncoverable.",
    });
  }

  if (option.origin === "LHR" || option.destination === "LHR") {
    flags.push({
      kind: "apd",
      label: "UK APD",
      detail: `UK Air Passenger Duty on ultra-long-haul economy is £106 pp from 1 April 2026 — about €${APD_EUR_PP} each, €${APD_EUR_PP * 2} for the couple, that no Spanish, Italian or German origin pays. It rises again in April 2027.`,
    });
  }

  for (const adjustment of option.comfort.adjustments) {
    if (adjustment.name === "gulfHubReliability") {
      flags.push({ kind: "gulf", label: "Gulf transit", detail: adjustment.detail });
    }
    if (adjustment.name === "metalUncertainty") {
      flags.push({ kind: "metal", label: "Metal unconfirmed", detail: adjustment.detail });
    }
  }

  if (option.confidence === "CHECK") {
    flags.push({
      kind: "check",
      label: "Verify at booking",
      detail: tidy(hubNote) ?? "The research could not confirm this routing constructs as advertised.",
    });
  }

  return flags;
}

/* ------------------------------------------------------------------ */
/* Outbound                                                            */
/* ------------------------------------------------------------------ */

const SEARCHABLE_HUBS = new Set<string>(OUTBOUND_HUBS);

export function outboundOptions(): SearchOption[] {
  const options: SearchOption[] = [];

  for (const hub of HUBS.outbound) {
    const positioning = positioningFor(hub);

    for (const carrier of hub.carriers) {
      const band = parseBand(carrier.typicalDecBandEurPP);
      // No band means the research found the route unavailable in December.
      if (!band) continue;

      const iata = CARRIER_IATA[carrier.carrier] ?? null;
      const via = parseVia(carrier.via);
      const key = `${iata}|${carrier.via ?? "nonstop"}`;
      const sectors = sectorsFor(hub.airport, "PER", iata, via, key);

      const base: Omit<SearchOption, "flags"> = {
        id: `out-${hub.airport}-${iata ?? carrier.carrier}`.replace(/\s+/g, "-"),
        leg: "outbound",
        origin: hub.airport,
        originCity: hub.city,
        destination: "PER",
        carrier: carrier.carrier,
        iata,
        via,
        stops: carrier.stops ?? via.length,
        bandEurPP: band,
        comfort: scoreItinerary(sectors),
        surchargesEurCouple: hub.taxPenaltyEurPP
          ? [
              {
                label: "UK APD",
                eur: hub.taxPenaltyEurPP * 2,
                detail: tidy(hub.taxPenaltyNote) ?? "",
              },
            ]
          : [],
        positioning,
        homeLeg: null,
        note: tidy(carrier.note),
        confidence: carrier.confidence,
        searchable: SEARCHABLE_HUBS.has(hub.airport),
      };

      options.push({ ...base, flags: flagsFor(base, hub.notes) });
    }
  }

  return options;
}

/* ------------------------------------------------------------------ */
/* Return                                                              */
/* ------------------------------------------------------------------ */

/**
 * "BCN or MAD" is the research hedging about where a Gulf carrier drops you.
 * Madrid is the answer the page takes, because Madrid is the only arrival that
 * can be through-ticketed to Valencia — and the row says so.
 */
function arrivalFor(arrivesAt: string | undefined): string {
  if (!arrivesAt) return "BCN";
  if (arrivesAt.includes("MAD")) return "MAD";
  if (arrivesAt.includes("BCN")) return "BCN";
  if (arrivesAt.includes("LHR")) return "LHR";
  if (arrivesAt.includes("VLC")) return "VLC";
  return arrivesAt.slice(0, 3);
}

const RETURN_SEARCH_ORIGINS = new Set<string>(RETURN_ORIGINS);

export function returnOptions(): SearchOption[] {
  const options: SearchOption[] = [];

  for (const airport of HUBS.return) {
    if (airport.excluded) continue;
    // The grid searches the four origins the trip could plausibly end at.
    // Adelaide and Western Sydney stay in the research and out of the search:
    // one is only relevant if the itinerary already ends in South Australia,
    // the other forces an 18-hour Singapore layover.
    if (!RETURN_SEARCH_ORIGINS.has(airport.airport)) continue;

    for (const carrier of airport.carriers) {
      const band = parseBand(carrier.typicalFebBandEurPP);
      if (!band) continue;

      const iata = CARRIER_IATA[carrier.carrier] ?? null;
      const via = parseVia(carrier.via);
      const destination = arrivalFor(carrier.arrivesAt);
      const key = `${iata}|${carrier.via ?? "nonstop"}|return`;
      const sectors = sectorsFor(airport.airport, destination, iata, via, key);

      const base: Omit<SearchOption, "flags"> = {
        id: `ret-${airport.airport}-${iata ?? carrier.carrier}-${destination}`.replace(/\s+/g, "-"),
        leg: "return",
        origin: airport.airport,
        originCity: airport.city,
        destination,
        carrier: carrier.carrier,
        iata,
        via,
        stops: carrier.stops ?? via.length,
        bandEurPP: band,
        comfort: scoreItinerary(sectors),
        surchargesEurCouple:
          destination === "LHR"
            ? [
                {
                  label: "UK APD",
                  eur: APD_EUR_PP * 2,
                  detail: "Only charged on departure from the UK, so a return *into* London pays it on the onward hop home, not on the long-haul.",
                },
              ]
            : [],
        positioning: [],
        homeLeg: HOME_LEGS[destination] ?? null,
        note: tidy(carrier.note),
        confidence: carrier.confidence,
        searchable: (RETURN_ARRIVALS[airport.airport] ?? []).includes(destination),
      };

      options.push({ ...base, flags: flagsFor(base, airport.notes) });
    }
  }

  return options;
}

/* ------------------------------------------------------------------ */
/* The knowledge worth surfacing                                       */
/* ------------------------------------------------------------------ */

/** The one fact the research says to go and get: the A380 on the way home. */
export const RETURN_A380_TIP = {
  title: "The A380 you wanted is on the way home",
  body:
    "Singapore Airlines has no economy on its A380 upper deck and flies no A380 to Perth at all — but it runs SIN–SYD twice daily and SIN–MEL daily on the A380 through late March 2027, and its main-deck economy is 18.5\" at 32\" pitch: the widest seat in the whole dataset, wider than its own A350. Book the open-jaw and the couple gets the #1 airline and the A380, in the direction where they'll want to sleep. Aim for the rear taper rows, where the side blocks drop from three seats to two.",
};

/** What the search covers, said plainly under the results. */
export const SEARCH_NOTES: readonly string[] = HUBS.meta.structural_findings;
