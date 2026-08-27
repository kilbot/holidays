/**
 * The comfort score's contract.
 *
 * The research file (`docs/research/comfort-ratings.json`) publishes both its
 * worked examples and a ranked table of real December 2026 itineraries, which
 * makes it its own test fixture: if this module cannot reproduce the numbers
 * the researcher published, one of the two is wrong. The block hours below are
 * the research's own, so these tests exercise the formula and the resolution
 * rules rather than the great-circle estimate the Flights page feeds them.
 *
 * The one deliberate divergence from the file is recorded in "the Lufthansa
 * upper-deck play" below.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  airlineScoreOf,
  bracketWeights,
  comfortBand,
  credentialsOf,
  DEFAULT_AIRLINE_WEIGHT,
  middleEastTransitsOf,
  MIDDLE_EAST_TRANSIT_HUBS,
  rawScoreOf,
  reweigh,
  scoreItinerary,
  seatScoreOf,
  sourcesFor,
  topPickAcrossBracket,
  WEIGHT_BRACKET,
  type Sector,
} from "@/lib/flights/comfort";

const sector = (partial: Partial<Sector> & Pick<Sector, "carrier" | "aircraft" | "hours">): Sector => ({
  to: "SIN",
  metalConfirmed: true,
  ...partial,
});

/**
 * The four itineraries the evidence audit checked by hand across the weight
 * bracket, at the research's own block hours. They are shared fixtures rather
 * than inline literals because the weight tests below have to compare the same
 * four journeys at nine different settings.
 */
const SINGAPORE_SECTORS: readonly Sector[] = [
  sector({ carrier: "SQ", aircraft: "A350-900", hours: 13, to: "SIN" }),
  sector({ carrier: "SQ", aircraft: "A350-900", hours: 5, to: "PER" }),
];

const CATHAY_SECTORS: readonly Sector[] = [
  sector({ carrier: "CX", aircraft: "A350-900", hours: 13, to: "HKG" }),
  sector({ carrier: "CX", aircraft: "A350-900", hours: 7.7, to: "PER" }),
];

const MALAYSIA_SECTORS: readonly Sector[] = [
  sector({ carrier: "MH", aircraft: "A350-900", hours: 12.5, to: "KUL" }),
  sector({ carrier: "MH", aircraft: "A330-900neo", hours: 5.3, to: "PER" }),
];

const QATAR_SECTORS: readonly Sector[] = [
  sector({ carrier: "QR", aircraft: "A350-1000", hours: 7, to: "DOH" }),
  sector({ carrier: "QR", aircraft: "777-300ER", hours: 11, to: "PER" }),
];

describe("the research's worked examples", () => {
  it("scores Singapore Airlines BCN-SIN-PER at 9.3", () => {
    const result = scoreItinerary([
      sector({ carrier: "SQ", aircraft: "A350-900", hours: 13, to: "SIN" }),
      sector({ carrier: "SQ", aircraft: "A350-900", hours: 5, to: "PER" }),
    ]);

    assert.equal(result.airlineScore, 9.5);
    assert.equal(result.seatScore, 9);
    assert.deepEqual(result.adjustments, []);
    assert.equal(result.score, 9.3);
  });

  it("costs exactly 0.3 points to draw the 787-10 on the Perth sector", () => {
    const result = scoreItinerary([
      sector({ carrier: "SQ", aircraft: "A350-900", hours: 13, to: "SIN" }),
      sector({ carrier: "SQ", aircraft: "787-10", hours: 5, to: "PER" }),
    ]);

    assert.equal(result.seatScore, 8.4);
    assert.equal(result.score, 9);
  });

  /**
   * 6.9, where the file's ranked table published 7.1 before the evidence audit.
   * The 0.2 is the cabin-altitude adjustment the audit added (issue #69): the
   * eleven-hour Perth sector is a 777-300ER pressurised to ~8,000 ft, and Muhm
   * et al. (2007) is the strongest evidence in the whole literature. The audit
   * predicted exactly this pair of moves — Qatar 7.1 → 6.9, Emirates 6.4 → 6.2
   * — and verified by hand that nothing reorders.
   */
  it("scores Qatar MAD-DOH-PER at 6.9, and 8.1 before the adjustments", () => {
    const result = scoreItinerary([
      sector({ carrier: "QR", aircraft: "A350-1000", hours: 7, to: "DOH" }),
      sector({ carrier: "QR", aircraft: "777-300ER", hours: 11, to: "PER" }),
    ]);

    assert.equal(result.airlineScore, 9);
    assert.equal(result.seatScore, 7.1);
    assert.deepEqual(
      result.adjustments.map((adjustment) => [adjustment.name, adjustment.points]),
      [
        ["gulfHubReliability", -1],
        ["cabinAltitude", -0.25],
      ],
    );
    assert.equal(result.score, 6.9);
    assert.equal(rawScoreOf(result), 8.1);
  });

  it("charges cabin altitude per sector, and never on a 6,000 ft type", () => {
    // The A350 and the 787 hold ~6,000 ft, so neither takes it however long
    // the sector — which is the one evidence-backed thing the 787's narrow
    // seat gives back, and why Qantas' 16h40 nonstop is unpenalised.
    const lowCabin = scoreItinerary([
      sector({ carrier: "SQ", aircraft: "A350-900", hours: 13, to: "SIN" }),
      sector({ carrier: "SQ", aircraft: "787-10", hours: 5, to: "PER" }),
    ]);
    assert.equal(lowCabin.adjustments.some((a) => a.name === "cabinAltitude"), false);

    // Two long sectors at ~8,000 ft is two lots of the penalty, not one.
    const twice = scoreItinerary([
      sector({ carrier: "VN", aircraft: "777-300ER", hours: 11, to: "SGN" }),
      sector({ carrier: "VN", aircraft: "777-300ER", hours: 7, to: "PER" }),
    ]);
    assert.equal(twice.adjustments.find((a) => a.name === "cabinAltitude")?.points, -0.5);

    // Short sectors are under the six-hour threshold, whatever the cabin.
    const short = scoreItinerary([
      sector({ carrier: "QF", aircraft: "A330-300", hours: 5.2, to: "PER" }),
      sector({ carrier: "QF", aircraft: "A330-300", hours: 4, to: "SIN" }),
    ]);
    assert.equal(short.adjustments.some((a) => a.name === "cabinAltitude"), false);
  });

  it("reproduces the Lufthansa upper-deck play — the best seat, and still eighth", () => {
    const result = scoreItinerary([
      sector({ carrier: "LH", aircraft: "A320/A321", hours: 2.3, to: "MUC" }),
      sector({ carrier: "LH", aircraft: "A380-800", variant: "upper deck", hours: 10.75, to: "BKK" }),
      sector({ carrier: "TG", aircraft: "787-8", hours: 7, to: "PER" }),
    ]);

    // The seat that wins the dataset outright, on the itinerary that does not.
    assert.equal(result.sectors[1].seatScore, 9.5);
    assert.equal(result.airlineScore, 6.3);
    assert.deepEqual(
      result.adjustments.map((adjustment) => adjustment.name),
      ["extraSector"],
    );

    // 6.8, where the file's worked example says 6.7. The gap is the Bangkok
    // sector: the example scores Thai's 787-8 at 6.0, while the file's own
    // aircraft table scores every 787 at 6.5 and carries no Thai config to
    // override it. The documented resolution rules are followed here, so the
    // 0.5 the example subtracts by hand is not applied — it is 0.1 on the
    // combined score and it does not move the row's rank.
    assert.equal(result.score, 6.8);
  });
});

describe("the published ranking, rebuilt", () => {
  /** Rank 4: Malaysia Airlines LHR-KUL-PER, the quiet 2-4-2 answer. */
  it("scores Malaysia LHR-KUL-PER at 7.5", () => {
    const result = scoreItinerary([
      sector({ carrier: "MH", aircraft: "A350-900", hours: 12.5, to: "KUL" }),
      sector({ carrier: "MH", aircraft: "A330-900neo", hours: 5.3, to: "PER" }),
    ]);

    assert.equal(result.seatScore, 8.7);
    assert.equal(result.score, 7.5);
  });

  /** Rank 6 and rank 9: the same booking, before and after the retrofit coin-flip. */
  it("scores the BA A380 upper deck at 6.9 best case and 6.1 once the metal is a coin-flip", () => {
    const positioning = sector({ carrier: "BA", aircraft: "A320/A321", hours: 2.4, to: "LHR" });
    const perth = sector({ carrier: "QF", aircraft: "A330-300", hours: 5.2, to: "PER" });

    const bestCase = scoreItinerary([
      positioning,
      sector({ carrier: "BA", aircraft: "A380-800", variant: "UNREFURBISHED", hours: 13, to: "SIN" }),
      perth,
    ]);
    assert.equal(bestCase.airlineScore, 6.8);
    assert.equal(bestCase.seatScore, 7.6);
    assert.equal(bestCase.score, 6.9);

    const coinFlip = scoreItinerary([
      positioning,
      sector({
        carrier: "BA",
        aircraft: "A380-800",
        variant: "UNREFURBISHED",
        hours: 13,
        to: "SIN",
        metalConfirmed: false,
      }),
      perth,
    ]);
    assert.equal(coinFlip.score, 6.1);
  });

  /** Rank 7=: the famous nonstop — narrowest seat, longest sit. */
  it("scores the Qantas Perth nonstop at 6.7", () => {
    const result = scoreItinerary([
      sector({ carrier: "BA", aircraft: "A320/A321", hours: 2.4, to: "LHR" }),
      sector({ carrier: "QF", aircraft: "787-9", hours: 16.7, to: "PER" }),
    ]);

    assert.equal(result.airlineScore, 7.4);
    assert.equal(result.seatScore, 5.9);
    assert.equal(result.score, 6.7);
  });

  /**
   * Rank 8: Emirates, an A380 on the wrong half of the journey — and, since the
   * audit, the second of the two rows that take the cabin-altitude penalty. The
   * eleven-hour Perth sector is the same 8,000 ft 777-300ER as Qatar's.
   */
  it("scores Emirates MAD-DXB-PER at 6.2", () => {
    const result = scoreItinerary([
      sector({ carrier: "EK", aircraft: "A380-800", hours: 7.3, to: "DXB" }),
      sector({ carrier: "EK", aircraft: "777-300ER", hours: 11.2, to: "PER" }),
    ]);

    assert.equal(result.seatScore, 6.7);
    assert.equal(result.score, 6.2);
  });

  /** The return leg the research calls out: the A380 the couple actually gets. */
  it("scores the Singapore A380 return at 9.3 and Turkish end-to-Valencia at 7.7", () => {
    const singapore = scoreItinerary([
      sector({ carrier: "SQ", aircraft: "A380-800", hours: 8, to: "SIN" }),
      sector({ carrier: "SQ", aircraft: "A350-900", hours: 13, to: "BCN" }),
    ]);
    assert.equal(singapore.score, 9.3);

    const turkish = scoreItinerary([
      sector({ carrier: "TK", aircraft: "A350-900", hours: 8, to: "SIN" }),
      sector({ carrier: "TK", aircraft: "A350-900", hours: 11.5, to: "IST" }),
      sector({ carrier: "TK", aircraft: "A350-900", hours: 4, to: "VLC" }),
    ]);
    assert.equal(turkish.score, 7.7);
  });
});

describe("seat-score resolution", () => {
  it("prefers the carrier's config over the aircraft type", () => {
    // The type table scores every 777-300ER at 6.0; Qatar's Perth config is 5.5.
    assert.equal(seatScoreOf("QR", "777-300ER").seatScore, 5.5);
    assert.equal(seatScoreOf("QR", "777-300ER").seatSource, "config");
    assert.equal(seatScoreOf("VN", "777-300ER").seatScore, 6);
    assert.equal(seatScoreOf("VN", "777-300ER").seatSource, "type");
  });

  it("splits BA's two A380 layouts by variant", () => {
    assert.equal(seatScoreOf("BA", "A380-800", "UNREFURBISHED").seatScore, 8);
    assert.equal(seatScoreOf("BA", "A380-800", "REFURBISHED").seatScore, 6.5);
  });

  it("uses the wildcard config for a positioning narrowbody, whoever flies it", () => {
    for (const carrier of ["IB", "FR", "W6", "LH"]) {
      const seat = seatScoreOf(carrier, "A320/A321");
      assert.equal(seat.seatScore, 5.5);
      assert.equal(seat.seatSource, "config");
    }
  });

  it("marks a type-only answer as low confidence", () => {
    const result = scoreItinerary([
      sector({ carrier: "TG", aircraft: "787-9", hours: 11, to: "BKK" }),
      sector({ carrier: "TG", aircraft: "787-9", hours: 7, to: "PER" }),
    ]);
    assert.equal(result.lowConfidence, true);
    assert.equal(result.sectors[0].seatSource, "type");
  });

  it("falls back to the generic narrowbody for an aircraft nobody has measured", () => {
    const seat = seatScoreOf("SQ", "Concorde");
    assert.equal(seat.seatScore, 5.5);
    assert.equal(seat.seatSource, "unknown");
  });
});

describe("adjustments", () => {
  it("charges the Gulf transit once, however many Gulf sectors there are", () => {
    const result = scoreItinerary([
      sector({ carrier: "EY", aircraft: "787-9", hours: 14, to: "AUH" }),
      sector({ carrier: "EY", aircraft: "787-9", hours: 7, to: "AUH" }),
    ]);
    assert.equal(result.adjustments.filter((a) => a.name === "gulfHubReliability").length, 1);
  });

  it("charges 0.25 for every sector past the second", () => {
    const legs = (count: number) =>
      scoreItinerary(
        Array.from({ length: count }, () => sector({ carrier: "SQ", aircraft: "A350-900", hours: 5, to: "SIN" })),
      );

    assert.deepEqual(legs(2).adjustments, []);
    assert.equal(legs(3).adjustments[0].points, -0.25);
    assert.equal(legs(4).adjustments[0].points, -0.5);
  });

  it("keeps a short positioning hop from dragging down a long journey", () => {
    const direct = scoreItinerary([
      sector({ carrier: "SQ", aircraft: "A350-900", hours: 13, to: "SIN" }),
      sector({ carrier: "SQ", aircraft: "A350-900", hours: 5, to: "PER" }),
    ]);
    const positioned = scoreItinerary([
      sector({ carrier: "LH", aircraft: "A320/A321", hours: 2.3, to: "FRA" }),
      sector({ carrier: "SQ", aircraft: "A350-900", hours: 12.5, to: "SIN" }),
      sector({ carrier: "SQ", aircraft: "A350-900", hours: 5, to: "PER" }),
    ]);

    // A 2h20 hop on a 6.5 airline in a 5.5 seat, third sector included, is
    // worth about a point — not the four points a plain average would charge.
    assert.ok(direct.score !== null && positioned.score !== null);
    assert.ok(direct.score - positioned.score < 1.2, `dropped ${direct.score - positioned.score}`);
  });

  it("never reports a score outside 0-10", () => {
    const result = scoreItinerary([
      sector({ carrier: "MU", aircraft: "777-300ER", hours: 12, to: "DXB" }),
      sector({ carrier: "MU", aircraft: "777-300ER", hours: 11, to: "PER" }),
      sector({ carrier: "MU", aircraft: "A320/A321", hours: 2, to: "VLC" }),
      sector({ carrier: "MU", aircraft: "A320/A321", hours: 2, to: "MAD" }),
    ]);
    assert.ok(result.score !== null && result.score >= 0 && result.score <= 10);
  });
});

describe("carriers the research does not rate", () => {
  it("returns no score for Scoot rather than inventing one", () => {
    assert.equal(airlineScoreOf("TR"), null);

    const result = scoreItinerary([
      sector({ carrier: "TR", aircraft: "787-8", hours: 12, to: "SIN" }),
      sector({ carrier: "TR", aircraft: "787-8", hours: 5, to: "PER" }),
    ]);

    assert.equal(result.unrated, true);
    assert.equal(result.score, null);
    assert.equal(result.airlineScore, null);
    // The seat is still measurable, and still reported.
    assert.equal(result.seatScore, 6.5);
    assert.equal(comfortBand(result.score), "unrated");
  });

  it("does not let one unrated sector be averaged away", () => {
    const result = scoreItinerary([
      sector({ carrier: "FR", aircraft: "A320/A321", hours: 2, to: "VIE" }),
      sector({ carrier: "TR", aircraft: "787-8", hours: 12, to: "SIN" }),
      sector({ carrier: "TR", aircraft: "787-8", hours: 5, to: "PER" }),
    ]);
    assert.equal(result.score, null);
  });
});

describe("bands", () => {
  it("puts the recommendation at the top and the value floor below it", () => {
    assert.equal(comfortBand(9.3), "top");
    assert.equal(comfortBand(8.5), "top");
    assert.equal(comfortBand(7.7), "good");
    assert.equal(comfortBand(6.9), "fair");
    assert.equal(comfortBand(5.5), "poor");
    assert.equal(comfortBand(null), "unrated");
  });
});

describe("the Middle East hub set", () => {
  it("is the three airports the Gulf adjustment names, and nothing else", () => {
    // Read out of `gulfHubReliability.appliesTo` rather than typed beside it,
    // so the −1.0 and the Flights page's exclusion cannot come to disagree.
    // If a reworded justification empties this set, the exclusion silently
    // stops working — which is what this line is here to catch.
    assert.deepEqual([...MIDDLE_EAST_TRANSIT_HUBS].sort(), ["AUH", "DOH", "DXB"]);
  });

  it("does not count Istanbul — it is an ordinary via (kilbot/holidays#60)", () => {
    assert.equal(MIDDLE_EAST_TRANSIT_HUBS.includes("IST"), false);
    assert.deepEqual(middleEastTransitsOf(["SIN", "IST"]), []);
  });

  it("finds the excluded hub inside a multi-stop routing, in order flown", () => {
    assert.deepEqual(middleEastTransitsOf(["MEL", "DOH"]), ["DOH"]);
    assert.deepEqual(middleEastTransitsOf(["SIN"]), []);
  });
});

/* ------------------------------------------------------------------ */
/* The evidence audit, made computable (kilbot/holidays#69)            */
/* ------------------------------------------------------------------ */

describe("carrier credentials", () => {
  it("gives Cathay the economy award first, because this trip flies economy", () => {
    const cathay = credentialsOf("CX");
    assert.ok(cathay);
    assert.equal(cathay.name, "Cathay Pacific");
    assert.equal(cathay.stars, 5);
    assert.equal(cathay.honours[0], "Skytrax World's Best Economy Class 2025");
    assert.ok(cathay.honours.includes("#2 AirlineRatings 2026"));
    // Airline ratings are somebody else's ratings, and the chip says so.
    assert.equal(cathay.evidence.label, "rated");
  });

  it("leads Singapore with the two economy-specific firsts it actually holds", () => {
    const singapore = credentialsOf("SQ");
    assert.ok(singapore);
    assert.equal(singapore.honours[0], "#1 long-haul AirlineRatings 2026");
    assert.ok(
      singapore.honours.some((honour) => honour.startsWith("Flyers' Choice 2026")),
      singapore.honours.join(" · "),
    );
    // The Flyers' Choice entry is a paragraph in the file; the line takes the claim.
    assert.equal(
      singapore.honours.find((honour) => honour.startsWith("Flyers' Choice")),
      "Flyers' Choice 2026 · Preferred Economy Airline — 1st",
    );
  });

  it("does not turn a 62nd place into a credential", () => {
    const vietnam = credentialsOf("VN");
    assert.ok(vietnam);
    assert.equal(
      vietnam.honours.some((honour) => honour.includes("Skytrax 2025")),
      false,
      vietnam.honours.join(" · "),
    );
  });

  it("has nothing to say about a carrier the research does not rate", () => {
    assert.equal(credentialsOf("TR"), null);
  });

  it("rides on every scored sector, so a row can show it without the dataset", () => {
    const result = scoreItinerary([
      sector({ carrier: "SQ", aircraft: "A350-900", hours: 13, to: "SIN" }),
      sector({ carrier: "SQ", aircraft: "A350-900", hours: 5, to: "PER" }),
    ]);
    assert.equal(result.sectors[0].credentials?.name, "Singapore Airlines");
  });
});

describe("evidence labels", () => {
  it("labels the airline axis rated and the seat mapping judgment", () => {
    const result = scoreItinerary([
      sector({ carrier: "SQ", aircraft: "A350-900", hours: 13, to: "SIN" }),
      sector({ carrier: "SQ", aircraft: "A350-900", hours: 5, to: "PER" }),
    ]);

    assert.equal(result.sectors[0].credentials?.evidence.label, "rated");
    // The inches are measured; the 0–10 mapping of them is not.
    assert.equal(result.sectors[0].seatEvidence.dimensions?.label, "measured");
    assert.equal(result.sectors[0].seatEvidence.score.label, "judgment");
    assert.deepEqual(result.sectors[0].seatDimensions, {
      widthIn: 18,
      pitchIn: 32,
      layout: "3-3-3",
    });
  });

  it("carries no measured dimensions when the seat came from the type table", () => {
    const seat = seatScoreOf("VN", "777-300ER");
    assert.equal(seat.seatSource, "type");
    assert.equal(seat.seatDimensions, null);
    assert.equal(seat.seatEvidence.dimensions, null);
    assert.equal(seat.seatEvidence.score.label, "judgment");
  });

  it("labels every adjustment, and only cabin altitude as measured", () => {
    const result = scoreItinerary([
      sector({ carrier: "QR", aircraft: "A350-1000", hours: 7, to: "DOH" }),
      sector({ carrier: "QR", aircraft: "777-300ER", hours: 11, to: "PER", metalConfirmed: false }),
    ]);

    const labels = Object.fromEntries(
      result.adjustments.map((adjustment) => [adjustment.name, adjustment.evidence.label]),
    );
    assert.deepEqual(labels, {
      gulfHubReliability: "judgment",
      metalUncertainty: "judgment",
      cabinAltitude: "measured",
    });
    // Every chip has an explanation behind it, or the label is decoration.
    for (const adjustment of result.adjustments) {
      assert.ok(adjustment.evidence.note.length > 40, adjustment.name);
    }
  });

  it("says the weight is a judgment, and quotes the bracket", () => {
    const result = scoreItinerary([sector({ carrier: "SQ", aircraft: "A350-900", hours: 13 })]);
    assert.equal(result.weights.evidence.label, "judgment");
    assert.ok(result.weights.evidence.note.includes("0.30-0.70"));
  });

  it("resolves the studies the panel links to, with somewhere to click", () => {
    const sources = sourcesFor(["muhm2007", "anjani2021width", "ban2019", "vink2012"]);
    assert.equal(sources.length, 4);
    for (const source of sources) {
      assert.ok(source.href?.startsWith("https://"), `${source.id}: ${source.href}`);
      assert.ok(source.finding.length > 40, source.id);
    }
    assert.equal(sources[0].label, "Muhm et al. 2007, New England Journal of Medicine");
  });
});

describe("the airline-vs-aircraft weight", () => {
  const singapore = () =>
    scoreItinerary([
      sector({ carrier: "SQ", aircraft: "A350-900", hours: 13, to: "SIN" }),
      sector({ carrier: "SQ", aircraft: "A350-900", hours: 5, to: "PER" }),
    ]);

  it("starts where the research put it, and reports what it used", () => {
    assert.equal(DEFAULT_AIRLINE_WEIGHT, 0.55);
    assert.deepEqual(
      { airline: singapore().weights.airline, aircraft: singapore().weights.aircraft },
      { airline: 0.55, aircraft: 0.45 },
    );
  });

  it("moves the score the way the weight says", () => {
    // 9.5 airline against 9.0 seat: airline-heavy is worth more here.
    assert.equal(scoreItinerary(SINGAPORE_SECTORS, 0.3).score, 9.2);
    assert.equal(scoreItinerary(SINGAPORE_SECTORS, 0.7).score, 9.4);
    // Malaysia is the other way round — a mediocre airline in a very good seat.
    assert.equal(scoreItinerary(MALAYSIA_SECTORS, 0.3).score, 8);
    assert.equal(scoreItinerary(MALAYSIA_SECTORS, 0.7).score, 7.2);
  });

  it("clamps to the bracket rather than accepting a weight nobody argued for", () => {
    assert.equal(scoreItinerary(SINGAPORE_SECTORS, 0).score, scoreItinerary(SINGAPORE_SECTORS, WEIGHT_BRACKET.min).score);
    assert.equal(scoreItinerary(SINGAPORE_SECTORS, 1).score, scoreItinerary(SINGAPORE_SECTORS, WEIGHT_BRACKET.max).score);
  });

  it("reweighs an already-scored itinerary to exactly what scoring it again gives", () => {
    // The slider re-ranks from the scores the page already holds; the day this
    // identity breaks is the day the slider starts lying about the formula.
    for (const weight of bracketWeights()) {
      for (const sectors of [SINGAPORE_SECTORS, MALAYSIA_SECTORS, QATAR_SECTORS]) {
        assert.equal(
          reweigh(scoreItinerary(sectors), weight).score,
          scoreItinerary(sectors, weight).score,
          `${weight}`,
        );
      }
    }
  });

  it("steps in twentieths from 0.30 to 0.70 and stops there", () => {
    const stops = bracketWeights();
    assert.equal(stops[0], WEIGHT_BRACKET.min);
    assert.equal(stops[stops.length - 1], WEIGHT_BRACKET.max);
    assert.equal(stops.length, 9);
  });
});

describe("the top pick across the bracket", () => {
  /**
   * The reassurance the page prints, pinned.
   *
   * The audit checked by hand that Singapore Airlines wins at 0.30, 0.55 and
   * 0.70 — it leads on both axes, so the weight cannot dethrone it, and the
   * slider only rearranges the middle of the table. The page states that in
   * words, so it has to keep being true of the seeded itineraries.
   */
  const seeded = [
    { id: "SQ BCN-SIN-PER", comfort: scoreItinerary(SINGAPORE_SECTORS) },
    { id: "CX MAD-HKG-PER", comfort: scoreItinerary(CATHAY_SECTORS) },
    { id: "MH LHR-KUL-PER", comfort: scoreItinerary(MALAYSIA_SECTORS) },
    { id: "QR MAD-DOH-PER", comfort: scoreItinerary(QATAR_SECTORS) },
  ];

  it("is Singapore at every weight in the bracket", () => {
    const verdict = topPickAcrossBracket(seeded);
    assert.equal(verdict.winner?.id, "SQ BCN-SIN-PER");
    assert.equal(verdict.stable, true);
    assert.equal(verdict.atMin, 9.2);
    assert.equal(verdict.atMax, 9.4);

    for (const weight of bracketWeights()) {
      const ranked = [...seeded].sort(
        (a, b) => (reweigh(b.comfort, weight).score ?? 0) - (reweigh(a.comfort, weight).score ?? 0),
      );
      assert.equal(ranked[0].id, "SQ BCN-SIN-PER", `at ${weight}`);
    }
  });

  it("is the middle of the table that the weight actually rearranges", () => {
    // The trade the slider exists to expose. Aircraft-heavy, Malaysia's 2-4-2
    // A350 is a point and a half clear of Qatar; airline-heavy, Qatar's five
    // stars have closed the whole gap — the audit's own hand-worked table has
    // them both at 7.2 there, which is a values question, not a measurement.
    const at = (index: number, weight: number) => reweigh(seeded[index].comfort, weight).score ?? 0;
    const gapAt = (weight: number) => at(2, weight) - at(3, weight);

    assert.ok(gapAt(WEIGHT_BRACKET.min) >= 1.5, `${gapAt(WEIGHT_BRACKET.min)}`);
    assert.ok(gapAt(WEIGHT_BRACKET.max) <= 0, `${gapAt(WEIGHT_BRACKET.max)}`);
  });

  it("has no winner to report when nothing in the list is rated", () => {
    const verdict = topPickAcrossBracket([
      { id: "TR", comfort: scoreItinerary([sector({ carrier: "TR", aircraft: "787-8", hours: 12 })]) },
    ]);
    assert.equal(verdict.winner, null);
    assert.equal(verdict.stable, false);
  });
});
