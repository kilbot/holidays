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
 * Since the evidence audit (kilbot/holidays#69) it carries two more things:
 *
 * - **Every component says how much of it is evidence.** `measured`, `rated`
 *   or `judgment`, with the audit's own one-line explanation attached, because
 *   "is this empirical?" has a different answer for the seat than for the
 *   airline than for the weight between them.
 * - **The weight is a parameter, not a constant.** The literature brackets it
 *   at 0.30–0.70 and points in both directions inside that, so the number is
 *   the couple's to set and this module takes it as an argument.
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
/* Epistemics                                                          */
/* ------------------------------------------------------------------ */

/**
 * How much of a component is evidence and how much is us (kilbot/holidays#69).
 *
 * The audit's own three labels, kept as the dataset writes them:
 *
 * - **measured** — a controlled study measured the effect and reported a
 *   direction and a significance. The magnitude in 0–10 points is still a
 *   mapping choice.
 * - **rated** — the input is a third-party rating, an expert aggregate or a
 *   published physical measurement: real data, but not a causal finding about
 *   comfort.
 * - **judgment** — no literature located. The number is a defensible guess and
 *   says so rather than dressing itself as evidence.
 *
 * Every component the breakdown shows carries one, with the audit's own
 * one-line explanation attached, because the answer to "is this empirical?" is
 * different for each half of the formula and a single answer for the whole
 * score would be a lie in one direction or the other.
 */
export type EvidenceLabel = "measured" | "rated" | "judgment";

export interface Evidence {
  label: EvidenceLabel;
  /** The audit's own sentence, verbatim — what the chip's tooltip quotes. */
  note: string;
}

const evidenceOf = (
  label: EvidenceLabel | undefined,
  note: string | undefined,
  fallback: Evidence,
): Evidence => (label ? { label, note: note ?? fallback.note } : fallback);

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
    skytraxStars?: number;
    skytraxStarsAsOf?: string;
    reviewScore?: {
      skytraxWorldAirlineAwardsRank2025?: number | null;
      skytraxCategoryWins2025?: readonly string[];
      airlineRatingsOverallRank2026?: number | null;
      airlineRatingsLongHaulRank2026?: number | null;
      airlineRatingsFlyersChoice2026?: string | null;
      airlineRatingsCategory?: string | null;
      apex2026?: string | null;
    };
    evidence?: EvidenceLabel;
    evidenceNote?: string;
  }[];
  aircraft: readonly {
    type: string;
    baseScore0to10: number;
    evidence?: EvidenceLabel;
    evidenceNote?: string;
    cabinAltitudeFt?: number;
  }[];
  carrierConfigs: readonly {
    carrier: string;
    type: string;
    variant?: string;
    route?: string;
    economySeatWidthIn?: number;
    pitchIn?: number;
    layout?: string;
    configScore0to10: number;
    confidence: string;
    note?: string;
    evidence?: {
      dimensions?: EvidenceLabel;
      score?: EvidenceLabel;
      note?: string;
    };
  }[];
  formula: {
    airlineWeight: number;
    aircraftWeight: number;
    weightsEvidence?: EvidenceLabel;
    weightsEvidenceNote?: string;
    adjustments: readonly {
      name: string;
      points: number;
      appliesTo: string;
      justification?: string;
      evidence?: EvidenceLabel;
      evidenceNote?: string;
    }[];
    citations: readonly {
      id: string;
      authors: string;
      year: number;
      title: string;
      venue: string;
      finding: string;
      limitation?: string;
      url?: string;
      doi?: string;
    }[];
  };
}

const RATINGS = ratingsFile as unknown as RatingsFile;

const AIRLINES = new Map(RATINGS.airlines.map((airline) => [airline.iata, airline]));
const AIRCRAFT = new Map(RATINGS.aircraft.map((type) => [type.type, type]));

const adjustment = (name: string) =>
  RATINGS.formula.adjustments.find((entry) => entry.name === name);

const adjustmentPoints = (name: string): number => adjustment(name)?.points ?? 0;

const GULF_PENALTY = adjustmentPoints("gulfHubReliability");
const METAL_PENALTY = adjustmentPoints("metalUncertainty");
const SECTOR_PENALTY = adjustmentPoints("extraSector");
const CABIN_ALTITUDE_PENALTY = adjustmentPoints("cabinAltitude");

const adjustmentEvidence = (name: string, fallback: Evidence): Evidence =>
  evidenceOf(adjustment(name)?.evidence, adjustment(name)?.evidenceNote, fallback);

const JUDGMENT: Evidence = {
  label: "judgment",
  note: "No literature located. The number is a defensible guess and is presented as one.",
};

/* ------------------------------------------------------------------ */
/* The weight, and the bracket the evidence leaves it in               */
/* ------------------------------------------------------------------ */

/**
 * How much of the score is the airline and how much is the aeroplane.
 *
 * The default is the research's own 0.55/0.45 — and the audit's finding is that
 * this number is the *least* evidenced thing in the formula, not the most. The
 * literature brackets it rather than setting it, because it splits by which
 * outcome you measure: Vink et al. (2012) put legroom at the top of physical
 * comfort (r = 0.718), which read alone argues ~0.30/0.70; Ban & Kim (2019,
 * n = 9,632) put seat comfort at β = 0.080 against 0.320 for the airline-run
 * factors, which argues 80/20 the other way. Ahmadpour et al. (2016) show both
 * literatures are measuring one spectrum, so they genuinely disagree.
 *
 * `formula.weightsEvidenceNote` is the long version. The bracket is written
 * here as a constant because it is a bound on a *control*, not a datum: the
 * 0.30 and 0.70 are the two ends of the published disagreement, and the page
 * lets the couple pick anywhere inside it.
 */
export const WEIGHT_BRACKET = {
  min: 0.3,
  max: 0.7,
  /** Fine enough to feel continuous, coarse enough that every stop is sayable. */
  step: 0.05,
} as const;

/** The research's own weight — where the slider starts. */
export const DEFAULT_AIRLINE_WEIGHT = RATINGS.formula.airlineWeight;

export const WEIGHT_EVIDENCE: Evidence = evidenceOf(
  RATINGS.formula.weightsEvidence,
  RATINGS.formula.weightsEvidenceNote,
  JUDGMENT,
);

/** Clamped to the bracket, because a weight outside it is not a reading of anything. */
const withinBracket = (weight: number): number =>
  Math.min(WEIGHT_BRACKET.max, Math.max(WEIGHT_BRACKET.min, weight));

/* ------------------------------------------------------------------ */
/* Cabin altitude                                                      */
/* ------------------------------------------------------------------ */

/**
 * The one adjustment with a controlled trial behind it.
 *
 * Muhm et al. (2007, *NEJM* 357(1):18–27) put 502 subjects in a blinded
 * hypobaric chamber for a 20-hour simulated flight: reported discomfort was
 * greater at 7,000–8,000 ft than at all lower altitudes combined, and appeared
 * after 3–9 hours. The audit added it to the dataset (`cabinAltitude`) because
 * the best-evidenced variable in the whole literature was being scored at zero.
 *
 * Both numbers below are the adjustment's own `appliesTo`, which reads: "Each
 * sector of 6 block hours or more flown on an aircraft type whose cabin is
 * pressurised to ~8,000 ft (aircraft[].cabinAltitudeFt >= 7500)". They are
 * named here rather than parsed out of that prose because they are thresholds
 * on numbers the file gives structurally — unlike the Gulf hub set, which
 * exists nowhere else.
 *
 * The six hours is deliberately the conservative end of the measured 3–9 hour
 * onset window: at three hours Malaysia's KUL–PER and Qantas' SIN–PER would
 * take it too, and the audit checked by hand that nothing reorders either way.
 */
const HIGH_CABIN_ALTITUDE_FT = 7500;
const CABIN_ALTITUDE_MIN_HOURS = 6;

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
  ...new Set((adjustment("gulfHubReliability")?.appliesTo ?? "").match(/\b[A-Z]{3}\b/g) ?? []),
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

/**
 * What an airline has actually won, fleet-wide.
 *
 * The point the user made (#69): *"I didn't know Cathay was number two in the
 * world."* The airline half of the score is 55% of it and reads as a bare
 * number — 9.0 — when behind that number sits a 5-star Skytrax certification,
 * the world's best economy class of 2025 and second place on AirlineRatings.
 * Those are the reasons, and they were invisible.
 *
 * **These are airline-wide honours and nothing else.** They are awarded to a
 * carrier across its whole fleet and every cabin it sells; they say nothing
 * about which aeroplane this particular itinerary puts the couple on for
 * thirteen hours. That distinction is the whole reason the seat axis exists,
 * so the panel states it in words rather than letting a row of accolades imply
 * a seat.
 */
export interface CarrierCredentials {
  carrier: string;
  name: string;
  /** Skytrax star certification — an audit, not a vote. */
  stars: number | null;
  /** When that certification was checked: "2026", or "2026-03" for Qantas. */
  starsAsOf: string | null;
  /** Ordered most economy-specific first; the row shows the first few. */
  honours: readonly string[];
  airlineScore: number;
  evidence: Evidence;
}

/** The seat's geometry, as the research measured it for this exact config. */
export interface SeatDimensions {
  widthIn: number | null;
  pitchIn: number | null;
  layout: string | null;
}

/**
 * The seat axis splits in two, and only one half is measured.
 *
 * `dimensions` are physical measurements from aeroLOPA, carrier publications
 * or seat guides. `score` is this file's mapping of those inches onto 0–10 —
 * and the audit found that mapping over-weights width against pitch by about
 * 2× versus the measured 4:1 exchange rate (Anjani et al. 2021). Labelling the
 * two together as one number would claim the measurement for the mapping.
 */
export interface SeatEvidence {
  dimensions: Evidence | null;
  score: Evidence;
}

export interface SectorScore {
  sector: Sector;
  /** The carrier's own name, when the research rates it. */
  carrierName: string | null;
  airlineScore: number | null;
  /** What this carrier has won fleet-wide, when the research rates it. */
  credentials: CarrierCredentials | null;
  seatScore: number;
  seatSource: SeatSource;
  /** The research's confidence in the config, when one matched. */
  seatConfidence: string | null;
  /** The config's note, which is what the breakdown shows one click in. */
  seatNote: string | null;
  /** Width, pitch and layout for this sector's actual metal. */
  seatDimensions: SeatDimensions | null;
  /** Cabin pressurisation for the type, in feet — the Muhm 2007 variable. */
  cabinAltitudeFt: number | null;
  seatEvidence: SeatEvidence;
}

export interface Adjustment {
  name: string;
  label: string;
  points: number;
  detail: string;
  evidence: Evidence;
}

/** The two halves of the formula, as this score was actually computed. */
export interface Weights {
  airline: number;
  aircraft: number;
  evidence: Evidence;
}

export interface ComfortScore {
  /** 0–10 to one decimal, or `null` when a carrier is outside the dataset. */
  score: number | null;
  airlineScore: number | null;
  seatScore: number;
  /** What the two halves were weighted at — the slider's current setting. */
  weights: Weights;
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

/** "Preferred Economy Airline — 1st (passenger vote, 11 Aug 2026); …" → the claim. */
const firstClause = (text: string): string => text.split(";")[0].split(" (")[0].trim();

/**
 * The carrier's honours, most economy-specific first.
 *
 * The order is the argument. An award for economy class outranks an award for
 * the airline, because this trip flies economy and a Business-Class trophy is
 * somebody else's news — which is exactly why Cathay's *World's Best Economy
 * Class* leads its line and Qatar's Qsuite win appears nowhere. Ranks come
 * next, most recent list first, and the dates ride with them: the Skytrax
 * ranks are the 2025 vintage because the 2026 awards are not announced until
 * 18 September 2026, and a rank with no year on it would read as current.
 */
export function credentialsOf(carrier: string): CarrierCredentials | null {
  const airline = AIRLINES.get(carrier);
  if (!airline) return null;

  const review = airline.reviewScore ?? {};
  const honours: string[] = [];

  // Skytrax category wins, economy first — the most on-point award in the file.
  const wins = [...(review.skytraxCategoryWins2025 ?? [])].sort(
    (a, b) => Number(b.includes("Economy")) - Number(a.includes("Economy")),
  );
  for (const win of wins) honours.push(`Skytrax ${win} 2025`);

  if (review.airlineRatingsCategory) {
    honours.push(`AirlineRatings ${firstClause(review.airlineRatingsCategory)}`);
  }
  if (review.airlineRatingsLongHaulRank2026 === 1) {
    honours.push("#1 long-haul AirlineRatings 2026");
  }
  if (review.airlineRatingsFlyersChoice2026?.includes("Economy")) {
    honours.push(`Flyers' Choice 2026 · ${firstClause(review.airlineRatingsFlyersChoice2026)}`);
  }
  if (typeof review.airlineRatingsOverallRank2026 === "number") {
    honours.push(`#${review.airlineRatingsOverallRank2026} AirlineRatings 2026`);
  }
  // Below tenth, a world rank stops being a credential and starts being a fact.
  if (
    typeof review.skytraxWorldAirlineAwardsRank2025 === "number" &&
    review.skytraxWorldAirlineAwardsRank2025 <= 10
  ) {
    honours.push(`#${review.skytraxWorldAirlineAwardsRank2025} Skytrax 2025`);
  }
  if (review.apex2026) honours.push(`APEX ${review.apex2026} 2026`);

  return {
    carrier,
    name: airline.name,
    stars: airline.skytraxStars ?? null,
    starsAsOf: airline.skytraxStarsAsOf ?? null,
    honours,
    airlineScore: airline.normalizedScore0to10,
    evidence: evidenceOf(airline.evidence, airline.evidenceNote, {
      label: "rated",
      note: "Third-party ratings and passenger votes, not a measurement of comfort.",
    }),
  };
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
): Pick<
  SectorScore,
  | "seatScore"
  | "seatSource"
  | "seatConfidence"
  | "seatNote"
  | "seatDimensions"
  | "seatEvidence"
  | "cabinAltitudeFt"
> {
  const config =
    RATINGS.carrierConfigs.find(
      (entry) =>
        entry.carrier === carrier && entry.type === aircraft && matchesVariant(entry, variant),
    ) ??
    // `*` is the research's own wildcard: one generic European narrowbody
    // config standing in for every positioning hop, whoever operates it.
    RATINGS.carrierConfigs.find((entry) => entry.carrier === "*" && entry.type === aircraft);

  const type = AIRCRAFT.get(aircraft);
  const cabinAltitudeFt = type?.cabinAltitudeFt ?? null;

  if (config) {
    const note =
      config.evidence?.note ??
      "Width, pitch and layout are physical measurements; the 0–10 score is a mapping of them.";
    return {
      seatScore: config.configScore0to10,
      seatSource: "config",
      seatConfidence: config.confidence,
      seatNote: config.note ?? null,
      seatDimensions: {
        widthIn: config.economySeatWidthIn ?? null,
        pitchIn: config.pitchIn ?? null,
        layout: config.layout ?? null,
      },
      seatEvidence: {
        dimensions: evidenceOf(config.evidence?.dimensions, note, { label: "rated", note }),
        score: evidenceOf(config.evidence?.score, note, { ...JUDGMENT, note }),
      },
      cabinAltitudeFt,
    };
  }

  if (type) {
    return {
      seatScore: type.baseScore0to10,
      seatSource: "type",
      seatConfidence: null,
      seatNote: null,
      seatDimensions: null,
      seatEvidence: {
        // No config matched, so there is no measured geometry for this sector —
        // only the type's own average, which is a judgment about a fleet.
        dimensions: null,
        score: evidenceOf(type.evidence, type.evidenceNote, JUDGMENT),
      },
      cabinAltitudeFt,
    };
  }

  // Nothing matched. The dataset's own floor for a seat nobody has measured is
  // the generic narrowbody, and the row says so rather than pretending.
  return {
    seatScore: 5.5,
    seatSource: "unknown",
    seatConfidence: null,
    seatNote: null,
    seatDimensions: null,
    seatEvidence: {
      dimensions: null,
      score: {
        label: "judgment",
        note: "Nobody has measured this type for this dataset. The score is the file's generic-narrowbody floor, used so the row can say so rather than pretend.",
      },
    },
    cabinAltitudeFt: null,
  };
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
 * Combine the two halves at a given weight. The one line of arithmetic every
 * caller shares, so `scoreItinerary` and `reweigh` cannot drift apart.
 */
function combine(
  airlineScore: number | null,
  seatScore: number,
  penalty: number,
  airline: number,
): number | null {
  if (airlineScore === null) return null;
  const raw = airline * airlineScore + round2(1 - airline) * seatScore + penalty;
  return round1(Math.min(10, Math.max(0, raw)));
}

const weightsAt = (airline: number): Weights => ({
  airline: round2(airline),
  aircraft: round2(1 - airline),
  evidence: WEIGHT_EVIDENCE,
});

/**
 * Score an itinerary.
 *
 * Block-hour weighting is what keeps a 2h20 positioning hop from dragging down
 * a 20-hour journey, and equally what stops a good short sector from rescuing
 * a bad long one — Qatar's problem exactly: the best Europe sector in the file
 * bolted to its narrowest aircraft on the eleven-hour leg.
 *
 * `airlineWeight` defaults to the research's 0.55 and is clamped to the
 * evidence bracket. It is a parameter rather than a constant because the audit
 * found no principled basis for any point inside 0.30–0.70, and a number with
 * no principle behind it belongs under the reader's hand rather than baked
 * into the function that ranks their holiday (kilbot/holidays#69).
 */
export function scoreItinerary(
  sectors: readonly Sector[],
  airlineWeight: number = DEFAULT_AIRLINE_WEIGHT,
): ComfortScore {
  const scored: SectorScore[] = sectors.map((sector) => ({
    sector,
    carrierName: airlineNameOf(sector.carrier),
    airlineScore: airlineScoreOf(sector.carrier),
    credentials: credentialsOf(sector.carrier),
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
      evidence: adjustmentEvidence("gulfHubReliability", JUDGMENT),
    });
  }

  if (sectors.some((sector) => !sector.metalConfirmed)) {
    adjustments.push({
      name: "metalUncertainty",
      label: "Metal unconfirmed",
      points: METAL_PENALTY,
      detail:
        "At least one sector's aircraft is a schedule intention rather than a booking guarantee — an inferred type, or a fleet mid-retrofit. The carrier is contractual; the aeroplane is not.",
      evidence: adjustmentEvidence("metalUncertainty", JUDGMENT),
    });
  }

  const extra = Math.max(0, sectors.length - 2);
  if (extra > 0) {
    adjustments.push({
      name: "extraSector",
      label: extra === 1 ? "Third sector" : `${extra + 2} sectors`,
      points: round2(SECTOR_PENALTY * extra),
      detail: "Every sector past the second is another boarding, another bag transfer and another thing to miss.",
      evidence: adjustmentEvidence("extraSector", JUDGMENT),
    });
  }

  // The only component with a controlled trial behind it, and the only one the
  // formula was missing until the audit: hours spent at ~8,000 ft, per sector.
  const highCabins = scored.filter(
    (s) =>
      s.cabinAltitudeFt !== null &&
      s.cabinAltitudeFt >= HIGH_CABIN_ALTITUDE_FT &&
      s.sector.hours >= CABIN_ALTITUDE_MIN_HOURS,
  );
  if (highCabins.length > 0) {
    const hours = round1(highCabins.reduce((total, s) => total + s.sector.hours, 0));
    adjustments.push({
      name: "cabinAltitude",
      label: highCabins.length === 1 ? "Cabin at 8,000 ft" : `${highCabins.length} sectors at 8,000 ft`,
      points: round2(CABIN_ALTITUDE_PENALTY * highCabins.length),
      detail: `${hours}h on ${listSectorTypes(highCabins)}, pressurised to about 8,000 ft rather than the 6,000 ft an A350, 787 or A380 holds. Muhm et al. (2007, NEJM), 502 subjects in a blinded 20-hour chamber trial: discomfort at 7,000–8,000 ft was greater than at all lower altitudes combined, and set in after 3–9 hours.`,
      evidence: adjustmentEvidence("cabinAltitude", {
        label: "measured",
        note: "A controlled trial measured this effect. The magnitude in points is still a mapping choice.",
      }),
    });
  }

  const penalty = adjustments.reduce((total, entry) => total + entry.points, 0);
  const weight = withinBracket(airlineWeight);

  return {
    score: combine(airlineScore, seatScore, penalty, weight),
    airlineScore: airlineScore === null ? null : round1(airlineScore),
    seatScore: round1(seatScore),
    weights: weightsAt(weight),
    adjustments,
    sectors: scored,
    unrated,
    lowConfidence: scored.some((s) => s.seatSource !== "config"),
  };
}

/** "a 777-300ER" / "a 777-300ER and an A330-300" — the metal that earns a penalty. */
function listSectorTypes(sectors: readonly SectorScore[]): string {
  const types = [...new Set(sectors.map((s) => s.sector.aircraft))];
  const article = (type: string) => `${/^[AEIOU8]/.test(type) ? "an" : "a"} ${type}`;
  if (types.length === 1) return article(types[0]);
  return `${types.slice(0, -1).map(article).join(", ")} and ${article(types[types.length - 1])}`;
}

/**
 * The same itinerary at a different airline/aircraft weight.
 *
 * Re-derived from the sector scores the itinerary already carries rather than
 * re-resolving the dataset, which is what lets the slider move a whole page of
 * ranked rows in one render — and what keeps the ratings file on the server,
 * where the Flights page put it. The identity `reweigh(scoreItinerary(s), w)`
 * ≡ `scoreItinerary(s, w)` is pinned in the tests, because the day those two
 * disagree is the day the slider starts lying about the formula.
 */
export function reweigh(comfort: ComfortScore, airlineWeight: number): ComfortScore {
  const weight = withinBracket(airlineWeight);
  if (weight === comfort.weights.airline) return comfort;

  const seatScore = weighted(comfort.sectors, (s) => s.seatScore);
  const airlineScore = comfort.unrated
    ? null
    : weighted(comfort.sectors, (s) => s.airlineScore ?? 0);
  const penalty = comfort.adjustments.reduce((total, entry) => total + entry.points, 0);

  return {
    ...comfort,
    score: combine(airlineScore, seatScore, penalty, weight),
    weights: weightsAt(weight),
  };
}

/* ------------------------------------------------------------------ */
/* Is the answer the same across the bracket?                          */
/* ------------------------------------------------------------------ */

/** Every weight the slider can stop on, low to high. */
export function bracketWeights(): number[] {
  const stops: number[] = [];
  for (
    let weight = WEIGHT_BRACKET.min;
    weight <= WEIGHT_BRACKET.max + 1e-9;
    weight += WEIGHT_BRACKET.step
  ) {
    stops.push(round2(weight));
  }
  return stops;
}

export interface BracketVerdict<T> {
  /** True when one itinerary tops the list at every weight in the bracket. */
  stable: boolean;
  /** The itinerary that wins at the default weight, whether or not it is stable. */
  winner: T | null;
  /** Its score at the two ends of the bracket — the honest spread. */
  atMin: number | null;
  atMax: number | null;
}

/**
 * Whether the weight actually changes the answer.
 *
 * The audit checked this by hand for the seeded itineraries and found the top
 * pick invariant across the whole 0.30–0.70 bracket: Singapore Airlines leads
 * on both axes, so it wins at every setting and the slider only rearranges the
 * middle of the table. That is a genuinely reassuring thing to be told while
 * looking at a control that could otherwise read as "the ranking is arbitrary"
 * — so the page says it, computed live from the rows on screen rather than
 * quoted from the research, because a hardcoded reassurance is exactly the
 * kind of claim that quietly stops being true.
 */
export function topPickAcrossBracket<T extends { comfort: ComfortScore }>(
  entries: readonly T[],
): BracketVerdict<T> {
  const best = (weight: number): T | null =>
    entries.reduce<T | null>((leader, entry) => {
      const score = reweigh(entry.comfort, weight).score;
      if (score === null) return leader;
      const leading = leader === null ? null : reweigh(leader.comfort, weight).score;
      return leading === null || score > leading ? entry : leader;
    }, null);

  const winner = best(DEFAULT_AIRLINE_WEIGHT);
  if (winner === null) return { stable: false, winner: null, atMin: null, atMax: null };

  return {
    stable: bracketWeights().every((weight) => best(weight) === winner),
    winner,
    atMin: reweigh(winner.comfort, WEIGHT_BRACKET.min).score,
    atMax: reweigh(winner.comfort, WEIGHT_BRACKET.max).score,
  };
}

/**
 * The score before the adjustments — what the itinerary would rate if the Gulf
 * guidance lifted or the seat map confirmed. The research quotes it for Qatar
 * ("7.1, 8.1 raw") and the breakdown shows it for the same reason.
 */
export function rawScoreOf(comfort: ComfortScore): number | null {
  // Computed from the two published halves rather than by adding the penalties
  // back onto a rounded total, so the number the panel prints as "raw" is the
  // one a reader gets by multiplying out the line above it.
  return combine(comfort.airlineScore, comfort.seatScore, 0, comfort.weights.airline);
}

/* ------------------------------------------------------------------ */
/* Where any of this can be checked                                    */
/* ------------------------------------------------------------------ */

export interface Source {
  id: string;
  /** "Muhm et al. 2007, NEJM" — short enough to sit in a line of fine print. */
  label: string;
  finding: string;
  limitation: string | null;
  href: string | null;
}

/** A DOI is a link once you put a resolver in front of it. */
const linkFor = (citation: RatingsFile["formula"]["citations"][number]): string | null =>
  citation.url ?? (citation.doi ? `https://doi.org/${citation.doi}` : null);

const shortAuthors = (authors: string): string => {
  const surname = authors.split(",")[0].trim();
  return authors.includes("&") || authors.split(",").length > 2 ? `${surname} et al.` : surname;
};

/**
 * The studies behind the labels, by citation id.
 *
 * The panel names four of the nineteen — the two that carry the `measured`
 * labels and the two that disagree about the weight — because a fine-print
 * line with nineteen references in it is not a citation, it is a wall. The
 * rest live in `docs/research/comfort-ratings.json`, `formula.citations`.
 */
export function sourcesFor(ids: readonly string[]): Source[] {
  return ids.flatMap((id) => {
    const citation = RATINGS.formula.citations.find((entry) => entry.id === id);
    if (!citation) return [];
    return [
      {
        id,
        label: `${shortAuthors(citation.authors)} ${citation.year}, ${citation.venue.split(/[:0-9]/)[0].trim()}`,
        finding: citation.finding,
        limitation: citation.limitation ?? null,
        href: linkFor(citation),
      },
    ];
  });
}

/**
 * The one date that expires half the airline axis.
 *
 * Skytrax's 2026 World Airline Awards are announced on 18 September 2026,
 * three weeks after this research was done, so every Skytrax *rank* in the
 * dataset is the 2025 vintage. The star certifications are current; the ranks
 * are not, and the panel says which is which rather than letting a reader take
 * "#3 Skytrax" for this year's placing. Recorded in the research file under
 * `meta.dataSourceCaveats`.
 */
export const SKYTRAX_REFRESH_DATE = "18 September 2026";

/** How a score reads as a word, for the badge's label and its colour. */
export type ComfortBand = "top" | "good" | "fair" | "poor" | "unrated";

export function comfortBand(score: number | null): ComfortBand {
  if (score === null) return "unrated";
  if (score >= 8.5) return "top";
  if (score >= 7.5) return "good";
  if (score >= 6.5) return "fair";
  return "poor";
}
