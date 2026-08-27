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
  comfortBand,
  rawScoreOf,
  scoreItinerary,
  seatScoreOf,
  type Sector,
} from "@/lib/flights/comfort";

const sector = (partial: Partial<Sector> & Pick<Sector, "carrier" | "aircraft" | "hours">): Sector => ({
  to: "SIN",
  metalConfirmed: true,
  ...partial,
});

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

  it("scores Qatar MAD-DOH-PER at 7.1, and 8.1 before the Gulf adjustment", () => {
    const result = scoreItinerary([
      sector({ carrier: "QR", aircraft: "A350-1000", hours: 7, to: "DOH" }),
      sector({ carrier: "QR", aircraft: "777-300ER", hours: 11, to: "PER" }),
    ]);

    assert.equal(result.airlineScore, 9);
    assert.equal(result.seatScore, 7.1);
    assert.deepEqual(
      result.adjustments.map((adjustment) => [adjustment.name, adjustment.points]),
      [["gulfHubReliability", -1]],
    );
    assert.equal(result.score, 7.1);
    assert.equal(rawScoreOf(result), 8.1);
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

  /** Rank 8: Emirates, an A380 on the wrong half of the journey. */
  it("scores Emirates MAD-DXB-PER at 6.4", () => {
    const result = scoreItinerary([
      sector({ carrier: "EK", aircraft: "A380-800", hours: 7.3, to: "DXB" }),
      sector({ carrier: "EK", aircraft: "777-300ER", hours: 11.2, to: "PER" }),
    ]);

    assert.equal(result.seatScore, 6.7);
    assert.equal(result.score, 6.4);
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
