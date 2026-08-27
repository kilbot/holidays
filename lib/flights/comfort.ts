/**
 * The comfort score — `docs/research/comfort-ratings.json`, made computable.
 *
 * Comfort-first is the site's stated criterion for long-haul Legs
 * (docs/CONTEXT.md), and #49 turned it into arithmetic:
 *
 *     comfortScore = 0.55 × airlineScore + 0.45 × seatScore
 *
 * with both halves **weighted by block hours** across the sectors, and three
 * subtractions on top: a Gulf transit, unconfirmed metal, and every sector
 * past the second. This module is that formula and nothing else — no fares, no
 * routes, no React. Everything it knows comes out of the research file, weights
 * and penalty points included, so a revised dataset moves the rankings without
 * a code change.
 *
 * Two decisions worth keeping:
 *
 * - **The seat score resolves through the carrier's config, not the aircraft
 *   type.** Japan Airlines has held the best-economy-seat title for six years
 *   flying the same airframe everyone else scores 6.5 on; the whole difference
 *   is one seat per row. A type-only answer is therefore a fallback, and it is
 *   flagged as low confidence when it happens.
 * - **An unrated carrier scores nothing at all rather than something invented.**
 *   The research covers 21 airlines and deliberately excludes low-cost
 *   long-haul; Scoot is the honest floor of the Vienna option and there is no
 *   defensible number to give it. `score` comes back `null`, the row still
 *   shows its price, and it sorts last on comfort. Making one up would put a
 *   fabricated figure next to twenty researched ones.
 */

import ratingsFile from "@/docs/research/comfort-ratings.json";

/* ------------------------------------------------------------------ */
/* The research file                                                    */
/* ------------------------------------------------------------------ */

/**
 * What this module reads out of the dataset.
 *
 * Declared rather than inferred: TypeScript widens a hand-written JSON array
 * into a union of every shape in it, so `variant` — present on four configs of
 * twenty-two — is not accessible on the inferred type. The cast is the file's
 * one type boundary, and the fields below are the contract it has to keep.
 */
interface RatingsFile {
  airlines: readonly {
    iata: string;
    name: string;
    normalizedScore0to10: number;
    confidence?: string;
  }[];
  aircraft: readonly { type: string; baseScore0to10: number }[];
  carrierConfigs: readonly {
    carrier: string;
    type: string;
    variant?: string;
    route?: string;
    configScore0to10: number;
    confidence: string;
    note?: string;
  }[];
  formula: {
    airlineWeight: number;
    aircraftWeight: number;
    adjustments: readonly {
      name: string;
      points: number;
      appliesTo: string;
      justification?: string;
    }[];
  };
}

const RATINGS = ratingsFile as unknown as RatingsFile;

const AIRLINES = new Map(RATINGS.airlines.map((airline) => [airline.iata, airline]));
const AIRCRAFT = new Map(RATINGS.aircraft.map((type) => [type.type, type]));

const { airlineWeight, aircraftWeight } = RATINGS.formula;

const adjustmentPoints = (name: string): number =>
  RATINGS.formula.adjustments.find((adjustment) => adjustment.name === name)?.points ?? 0;

const GULF_PENALTY = adjustmentPoints("gulfHubReliability");
const METAL_PENALTY = adjustmentPoints("metalUncertainty");
const SECTOR_PENALTY = adjustmentPoints("extraSector");

/**
 * The airports the Gulf adjustment names, read out of the adjustment itself.
 *
 * `appliesTo` is prose — "Any Dec 2026 - Jan 2027 itinerary transiting DOH, DXB
 * or AUH" — but the only all-caps triples in it are the airport codes, so the
 * set can be lifted from the research rather than typed out beside it. That
 * matters more than it looks: the same three airports now carry two different
 * consequences — this −1.0, and the Flights page's default exclusion
 * (docs/CONTEXT.md, "No Middle East transits") — and a hand-copied list is
 * exactly how those two would come to disagree about what the Gulf is.
 *
 * Istanbul is deliberately not among them and must not be added: the rule is
 * about Gulf airspace in the December window, and IST is an ordinary via-point
 * with an ordinary via-routing label (kilbot/holidays#60).
 *
 * `lib/__tests__/comfort.test.ts` pins the three the file resolves to, so a
 * reworded justification cannot quietly empty the set.
 */
export const MIDDLE_EAST_TRANSIT_HUBS: readonly string[] = [
  ...new Set(
    (
      RATINGS.formula.adjustments.find((adjustment) => adjustment.name === "gulfHubReliability")
        ?.appliesTo ?? ""
    ).match(/\b[A-Z]{3}\b/g) ?? [],
  ),
];

/** Which of the excluded hubs an itinerary actually touches, in order flown. */
export function middleEastTransitsOf(stops: readonly string[]): string[] {
  return stops.filter((stop) => MIDDLE_EAST_TRANSIT_HUBS.includes(stop));
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

/** One flown sector of an itinerary. */
export interface Sector {
  /** Operating carrier, IATA. `"TR"` and friends are legal and score `null`. */
  carrier: string;
  /** Aircraft key, matched against the research's config and type tables. */
  aircraft: string;
  /** Where this sector lands — the Gulf test reads it. */
  to: string;
  /** Block hours. Approximate is fine: this only sets the weighting. */
  hours: number;
  /**
   * Whether the metal is confirmed for *this* routing at booking time. False
   * for the BA retrofit coin-flip and for every case where a type is inferred
   * by analogy with a hub the research actually checked.
   */
  metalConfirmed: boolean;
  /** Disambiguates two configs of one type — e.g. BA's two A380 layouts. */
  variant?: string;
}

/** How a sector's seat score was arrived at. */
export type SeatSource = "config" | "type" | "unknown";

export interface SectorScore {
  sector: Sector;
  /** The carrier's own name, when the research rates it. */
  carrierName: string | null;
  airlineScore: number | null;
  seatScore: number;
  seatSource: SeatSource;
  /** The research's confidence in the config, when one matched. */
  seatConfidence: string | null;
  /** The config's note, which is what the breakdown shows one click in. */
  seatNote: string | null;
}

export interface Adjustment {
  name: string;
  label: string;
  points: number;
  detail: string;
}

export interface ComfortScore {
  /** 0–10 to one decimal, or `null` when a carrier is outside the dataset. */
  score: number | null;
  airlineScore: number | null;
  seatScore: number;
  adjustments: readonly Adjustment[];
  sectors: readonly SectorScore[];
  /** True when any carrier is unrated, which is what makes `score` null. */
  unrated: boolean;
  /** True when any sector fell back to a bare aircraft type. */
  lowConfidence: boolean;
}

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

/** The airline axis. `null` means "not in the dataset", never "bad". */
export function airlineScoreOf(carrier: string): number | null {
  return AIRLINES.get(carrier)?.normalizedScore0to10 ?? null;
}

export function airlineNameOf(carrier: string): string | null {
  return AIRLINES.get(carrier)?.name ?? null;
}

/**
 * Whether a config is the one a sector meant.
 *
 * Word-anchored on purpose: BA's two A380 layouts are `REFURBISHED` and
 * `UNREFURBISHED`, and a plain substring test matches the wrong one — the
 * coin-flip config would silently win every lookup for the good seat.
 */
const matchesVariant = (
  config: RatingsFile["carrierConfigs"][number],
  variant: string | undefined,
): boolean => {
  if (!variant) return true;
  const haystack = `${config.variant ?? ""} ${config.route ?? ""}`;
  const needle = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${needle}`, "i").test(haystack);
};

/**
 * The seat axis, resolved the way the research says to: the carrier's own
 * config first, the wildcard config for a generic positioning narrowbody
 * second, the bare aircraft type last and flagged.
 */
export function seatScoreOf(
  carrier: string,
  aircraft: string,
  variant?: string,
): Pick<SectorScore, "seatScore" | "seatSource" | "seatConfidence" | "seatNote"> {
  const config =
    RATINGS.carrierConfigs.find(
      (entry) =>
        entry.carrier === carrier && entry.type === aircraft && matchesVariant(entry, variant),
    ) ??
    // `*` is the research's own wildcard: one generic European narrowbody
    // config standing in for every positioning hop, whoever operates it.
    RATINGS.carrierConfigs.find((entry) => entry.carrier === "*" && entry.type === aircraft);

  if (config) {
    return {
      seatScore: config.configScore0to10,
      seatSource: "config",
      seatConfidence: config.confidence,
      seatNote: config.note ?? null,
    };
  }

  const type = AIRCRAFT.get(aircraft);
  if (type) {
    return {
      seatScore: type.baseScore0to10,
      seatSource: "type",
      seatConfidence: null,
      seatNote: null,
    };
  }

  // Nothing matched. The dataset's own floor for a seat nobody has measured is
  // the generic narrowbody, and the row says so rather than pretending.
  return { seatScore: 5.5, seatSource: "unknown", seatConfidence: null, seatNote: null };
}

/* ------------------------------------------------------------------ */
/* The score                                                           */
/* ------------------------------------------------------------------ */

/** Scores are published to one decimal; the penalties are quarter-points. */
const round1 = (value: number): number => Math.round(value * 10) / 10;
const round2 = (value: number): number => Math.round(value * 100) / 100;

function weighted(sectors: readonly SectorScore[], pick: (s: SectorScore) => number): number {
  const hours = sectors.reduce((total, sector) => total + sector.sector.hours, 0);
  if (hours === 0) return 0;
  return sectors.reduce((total, s) => total + s.sector.hours * pick(s), 0) / hours;
}

/**
 * Score an itinerary.
 *
 * Block-hour weighting is what keeps a 2h20 positioning hop from dragging down
 * a 20-hour journey, and equally what stops a good short sector from rescuing
 * a bad long one — Qatar's problem exactly: the best Europe sector in the file
 * bolted to its narrowest aircraft on the eleven-hour leg.
 */
export function scoreItinerary(sectors: readonly Sector[]): ComfortScore {
  const scored: SectorScore[] = sectors.map((sector) => ({
    sector,
    carrierName: airlineNameOf(sector.carrier),
    airlineScore: airlineScoreOf(sector.carrier),
    ...seatScoreOf(sector.carrier, sector.aircraft, sector.variant),
  }));

  const seatScore = weighted(scored, (s) => s.seatScore);
  const unrated = scored.some((s) => s.airlineScore === null);
  const airlineScore = unrated ? null : weighted(scored, (s) => s.airlineScore ?? 0);

  const adjustments: Adjustment[] = [];

  const gulf = sectors.find((sector) => MIDDLE_EAST_TRANSIT_HUBS.includes(sector.to));
  if (gulf) {
    adjustments.push({
      name: "gulfHubReliability",
      label: "Gulf transit",
      points: GULF_PENALTY,
      detail: `Connecting at ${gulf.to} in the December window. A reliability call, not a comfort one: EASA's Persian Gulf conflict-zone guidance was still live when this was researched, and the trip has a hard Christmas anchor.`,
    });
  }

  if (sectors.some((sector) => !sector.metalConfirmed)) {
    adjustments.push({
      name: "metalUncertainty",
      label: "Metal unconfirmed",
      points: METAL_PENALTY,
      detail:
        "At least one sector's aircraft is a schedule intention rather than a booking guarantee — an inferred type, or a fleet mid-retrofit. The carrier is contractual; the aeroplane is not.",
    });
  }

  const extra = Math.max(0, sectors.length - 2);
  if (extra > 0) {
    adjustments.push({
      name: "extraSector",
      label: extra === 1 ? "Third sector" : `${extra + 2} sectors`,
      points: round2(SECTOR_PENALTY * extra),
      detail: "Every sector past the second is another boarding, another bag transfer and another thing to miss.",
    });
  }

  const penalty = adjustments.reduce((total, adjustment) => total + adjustment.points, 0);
  const raw =
    airlineScore === null
      ? null
      : airlineWeight * airlineScore + aircraftWeight * seatScore + penalty;

  return {
    score: raw === null ? null : round1(Math.min(10, Math.max(0, raw))),
    airlineScore: airlineScore === null ? null : round1(airlineScore),
    seatScore: round1(seatScore),
    adjustments,
    sectors: scored,
    unrated,
    lowConfidence: scored.some((s) => s.seatSource !== "config"),
  };
}

/**
 * The score before the adjustments — what the itinerary would rate if the Gulf
 * guidance lifted or the seat map confirmed. The research quotes it for Qatar
 * ("7.1, 8.1 raw") and the breakdown shows it for the same reason.
 */
export function rawScoreOf(comfort: ComfortScore): number | null {
  if (comfort.airlineScore === null) return null;
  const penalty = comfort.adjustments.reduce((total, adjustment) => total + adjustment.points, 0);
  return round1((comfort.score ?? 0) - penalty);
}

/** How a score reads as a word, for the badge's label and its colour. */
export type ComfortBand = "top" | "good" | "fair" | "poor" | "unrated";

export function comfortBand(score: number | null): ComfortBand {
  if (score === null) return "unrated";
  if (score >= 8.5) return "top";
  if (score >= 7.5) return "good";
  if (score >= 6.5) return "fair";
  return "poor";
}
