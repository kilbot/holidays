/**
 * What the search derives from the research, and what it must never invent.
 *
 * The rows on the Flights page are read out of `flight-hubs.json` rather than
 * typed out again, which makes the derivation itself the thing worth pinning:
 * a carrier the research marked unavailable must not appear, a low-cost fare
 * must not be comparable until its hold bags are added, and Barcelona must
 * never grow a positioning flight that does not exist.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  arbitrageVsBarcelona,
  barcelonaReference,
  cheapestFloor,
  DEFAULT_RULES,
  groupByDefaultRules,
  heldBackBy,
  LONGHAUL_CAP_EUR_PP,
  overCap,
  perPersonTotal,
  priceOption,
  quoteMatches,
  type LiveQuote,
} from "@/lib/flights/pricing";
import {
  blockHours,
  excludedByDefault,
  outboundOptions,
  returnOptions,
  type SearchOption,
} from "@/lib/flights/search-plan";

const outbound = outboundOptions();
const returns = returnOptions();
const at = (origin: string, carrier: string) =>
  outbound.find((option) => option.origin === origin && option.carrier === carrier);

describe("what the search covers", () => {
  it("searches every European hub in the research and nothing else", () => {
    const hubs = [...new Set(outbound.map((option) => option.origin))].sort();
    assert.deepEqual(hubs, [
      "AMS", "BCN", "BRU", "CDG", "FCO", "FRA", "IST", "LHR", "MAD", "MUC", "MXP", "VIE", "ZRH",
    ]);
    assert.ok(outbound.every((option) => option.searchable));
  });

  it("drops the carriers the research marked unavailable in the window", () => {
    // Cathay's Barcelona and Rome services are summer-seasonal and suspended
    // for winter; Turkish does not serve Perth at all.
    assert.equal(at("BCN", "Cathay Pacific"), undefined);
    assert.equal(at("FCO", "Cathay Pacific"), undefined);
    assert.equal(at("IST", "Turkish Airlines"), undefined);
    // Qatar's Adelaide service does not fly in February, and Adelaide is not a
    // searched origin — but the Gold Coast exclusion must hold either way.
    assert.ok(returns.every((option) => option.origin !== "OOL"));
  });

  it("returns only from the four origins the trip could end at", () => {
    const origins = [...new Set(returns.map((option) => option.origin))].sort();
    assert.deepEqual(origins, ["BNE", "CBR", "MEL", "SYD"]);
  });

  it("estimates block hours close enough to the published schedules", () => {
    // The research quotes HKG–PER at 7h40 and SIN–PER at about 5h.
    assert.ok(Math.abs(blockHours("HKG", "PER") - 7.7) < 0.3, `${blockHours("HKG", "PER")}`);
    assert.ok(Math.abs(blockHours("SIN", "PER") - 5.2) < 0.4, `${blockHours("SIN", "PER")}`);
    assert.ok(Math.abs(blockHours("DOH", "PER") - 11) < 0.8, `${blockHours("DOH", "PER")}`);
    // The research quotes the Perth nonstop as "16h40" and as "17h+"; the
    // published QF9 block is about 17h20. Anywhere in that range is right.
    const nonstop = blockHours("LHR", "PER");
    assert.ok(nonstop > 16.5 && nonstop < 18, `${nonstop}`);
  });
});

describe("the metal each itinerary flies", () => {
  const scoreOf = (leg: typeof outbound, origin: string, carrier: string) =>
    leg.find((option) => option.origin === origin && option.carrier === carrier)?.comfort.score;

  /**
   * These four are the research's own published scores, and they only come out
   * right if the metal table is being found: a missed key falls back to a
   * generic 787 and the unconfirmed penalty, which is a silent 1.5-point drop.
   */
  it("reproduces the published scores for the headline itineraries", () => {
    assert.equal(scoreOf(outbound, "BCN", "Singapore Airlines"), 9.3);
    assert.equal(scoreOf(outbound, "MAD", "Cathay Pacific"), 9);
    assert.equal(scoreOf(outbound, "MAD", "Qatar Airways"), 7.1);
    assert.equal(scoreOf(outbound, "MAD", "Emirates"), 6.4);
    assert.equal(scoreOf(returns, "SYD", "Turkish Airlines"), 7.7);
    assert.equal(scoreOf(returns, "SYD", "Singapore Airlines"), 9.3);
    assert.equal(scoreOf(returns, "SYD", "Cathay Pacific"), 9);
  });

  it("gives Barcelona the 777 Emirates downgraded it to, not Madrid's A380", () => {
    const barcelona = at("BCN", "Emirates");
    assert.ok(barcelona);
    assert.deepEqual(
      barcelona.comfort.sectors.map((sector) => sector.sector.aircraft),
      ["777-300ER", "777-300ER"],
    );
    assert.ok((barcelona.comfort.score ?? 0) < (scoreOf(outbound, "MAD", "Emirates") ?? 0));
  });

  it("flies one sector per hop, with real block hours on each", () => {
    for (const option of [...outbound, ...returns]) {
      assert.equal(
        option.comfort.sectors.length,
        option.via.length + 1,
        `${option.id} has ${option.comfort.sectors.length} sectors for ${option.via.length} via-points`,
      );
      for (const sector of option.comfort.sectors) {
        assert.ok(sector.sector.hours > 0.5, `${option.id}: ${sector.sector.hours}h sector`);
      }
    }
  });
});

describe("positioning from Valencia", () => {
  it("gives Barcelona a train and no flight, because none exists", () => {
    const bcn = at("BCN", "Singapore Airlines");
    assert.ok(bcn);
    assert.deepEqual(
      [...new Set(bcn.positioning.map((move) => move.mode))],
      ["train"],
    );
    assert.equal(bcn.positioning[0].overnight, "forced");
  });

  it("keeps the Frankfurt-Hahn feed out: it is summer-seasonal", () => {
    const fra = at("FRA", "Singapore Airlines");
    assert.ok(fra);
    assert.ok(fra.positioning.every((move) => move.arrivesAt !== "HHN"));
    assert.ok(fra.positioning.some((move) => move.carrier === "Lufthansa" && move.protection === "protected"));
  });

  it("charges two hold bags on a low-cost hop and none on a flag carrier", () => {
    const mxp = at("MXP", "Singapore Airlines");
    assert.ok(mxp);
    const ryanair = mxp.positioning.find((move) => move.carrier === "Ryanair" && move.arrivesAt === "MXP");
    assert.ok(ryanair);
    assert.deepEqual(ryanair.holdBagsEurCouple, [70, 120]);
    assert.equal(ryanair.protection, "self-transfer");

    const madrid = at("MAD", "Cathay Pacific");
    const iberia = madrid?.positioning.find((move) => move.carrier === "Iberia");
    assert.ok(iberia);
    assert.equal(iberia.holdBagsEurCouple, null);
    assert.equal(iberia.protection, "protected");
    // Madrid's 22:30 Cathay departure is what makes the night optional.
    assert.equal(iberia.overnight, "optional");
  });

  it("marks a wrong-airport arrival as needing the night before", () => {
    const mxp = at("MXP", "Singapore Airlines");
    const bergamo = mxp?.positioning.find((move) => move.arrivesAt === "BGY");
    assert.ok(bergamo);
    assert.equal(bergamo.sameAirport, false);
    assert.equal(bergamo.overnight, "recommended");
    assert.ok(bergamo.hotelEurCouple);
  });
});

describe("the honest total", () => {
  it("prices the €19 Bergamo fare above the €25 Malpensa one, for two", () => {
    const mxp = at("MXP", "Singapore Airlines");
    assert.ok(mxp);
    const bergamo = mxp.positioning.find((move) => move.arrivesAt === "BGY");
    const malpensa = mxp.positioning.find((move) => move.carrier === "Wizz Air");
    assert.ok(bergamo && malpensa);
    // Bergamo is the cheaper fare and the dearer journey once the couple's
    // bags, the night before and the coach to Malpensa are counted.
    assert.ok(bergamo.fareEurPP[0] < malpensa.fareEurPP[0]);
    assert.ok(bergamo.totalEurCouple[0] >= malpensa.totalEurCouple[0]);
  });

  it("adds the couple's UK Air Passenger Duty to every London departure", () => {
    const london = at("LHR", "Qantas");
    assert.ok(london);
    const price = priceOption(london, null);
    assert.ok(price.lines.some((line) => line.label === "UK APD" && line.eur[0] === 248));
  });

  it("adds the last leg home on the return, and nothing at all for Turkish", () => {
    const turkish = returns.find(
      (option) => option.origin === "SYD" && option.carrier === "Turkish Airlines",
    );
    assert.ok(turkish);
    assert.equal(turkish.destination, "VLC");
    assert.equal(turkish.homeLeg?.mode, "none");
    assert.ok(priceOption(turkish, null).lines.every((line) => !line.label.includes("→ Valencia")));

    const cathay = returns.find(
      (option) => option.origin === "SYD" && option.carrier === "Cathay Pacific",
    );
    assert.ok(cathay);
    assert.equal(cathay.destination, "MAD");
    assert.equal(cathay.homeLeg?.protection, "protected");
    assert.ok(priceOption(cathay, null).lines.some((line) => line.label.includes("Valencia")));
  });
});

describe("live quotes", () => {
  const quote = (carrier: string): LiveQuote => ({
    priceEur: 1_180,
    carrier,
    durationMin: 1_400,
    stops: 1,
    source: "live",
    fetchedAt: "2026-08-27T09:00:00.000Z",
  });

  it("attaches a quote to the carrier it names and to no other", () => {
    const singapore = at("BCN", "Singapore Airlines");
    const qatar = at("BCN", "Qatar Airways");
    assert.ok(singapore && qatar);
    assert.equal(quoteMatches(singapore, quote("Singapore Airlines")), true);
    assert.equal(quoteMatches(qatar, quote("Singapore Airlines")), false);
    // The API often names both operating carriers on a through fare.
    assert.equal(quoteMatches(qatar, quote("Iberia / Qatar Airways")), true);
  });

  it("labels an unmatched row as an estimate and a matched one as live", () => {
    const singapore = at("BCN", "Singapore Airlines");
    assert.ok(singapore);
    assert.equal(priceOption(singapore, null).fareSource, "estimate");
    assert.equal(priceOption(singapore, quote("Singapore Airlines")).fareSource, "live");
    assert.deepEqual(priceOption(singapore, quote("Singapore Airlines")).fareEurPP, [1_180, 1_180]);
  });
});

describe("the €150 rule", () => {
  const priced = outbound.map((option) => ({ option, price: priceOption(option, null) }));
  const reference = barcelonaReference(priced);
  const verdict = (origin: string, carrier: string) => {
    const entry = priced.find((e) => e.option.origin === origin && e.option.carrier === carrier);
    assert.ok(entry, `${origin} ${carrier}`);
    return arbitrageVsBarcelona(entry.option, entry.price, reference);
  };

  it("gives Barcelona itself no verdict — it is the yardstick", () => {
    assert.equal(verdict("BCN", "Qatar Airways"), null);
  });

  it("compares like with like where the carrier flies both hubs", () => {
    // Singapore ex-Milan against Singapore ex-Barcelona, not against whatever
    // the cheapest Barcelona fare happens to be.
    const milan = verdict("MXP", "Singapore Airlines");
    assert.ok(milan);
    assert.equal(milan.deltaEurPP, 125);
    assert.equal(milan.clears, false);
  });

  it("clears the bar only for the genuine budget floor", () => {
    const vienna = verdict("VIE", "Scoot");
    assert.ok(vienna);
    assert.equal(vienna.clears, true);
    assert.ok(vienna.deltaEurPP >= 150);
  });
});

describe("the two default rules", () => {
  const priced = (options: readonly SearchOption[]) =>
    options.map((option) => ({ option, price: priceOption(option, null) }));
  const outboundPriced = priced(outbound);
  const returnPriced = priced(returns);

  it("marks every Gulf itinerary and no other", () => {
    const gulf = [...outbound, ...returns].filter((option) => excludedByDefault(option));
    const carriers = [...new Set(gulf.map((option) => option.carrier))].sort();
    assert.deepEqual(carriers, ["Emirates", "Etihad", "Qatar Airways"]);
    assert.ok(gulf.every((option) => option.middleEastTransit.length > 0));
  });

  it("leaves Istanbul alone — the via, and the hub", () => {
    // Turkish's SYD/MEL–SIN–IST–VLC is the only itinerary ending at Valencia's
    // own airport; excluding it would cost the trip its best return.
    const turkish = returns.filter((option) => option.carrier === "Turkish Airlines");
    assert.ok(turkish.length > 0);
    assert.ok(turkish.every((option) => !excludedByDefault(option)));
    // And departing Istanbul is only excluded when the routing itself is Gulf.
    const istanbul = outbound.filter((option) => option.origin === "IST");
    assert.deepEqual(
      istanbul.filter((option) => excludedByDefault(option)).map((option) => option.carrier),
      ["Qatar Airways"],
    );
  });

  it("ranks nothing that breaks either rule", () => {
    const { ranked } = groupByDefaultRules(outboundPriced, DEFAULT_RULES);
    assert.ok(ranked.length > 0);
    for (const row of ranked) {
      assert.equal(row.option.middleEastTransit.length, 0, row.option.id);
      assert.ok(perPersonTotal(row.price)[0] <= LONGHAUL_CAP_EUR_PP, row.option.id);
    }
  });

  it("files a row that breaks both rules under the routing one, once", () => {
    const { ranked, viaMiddleEast, overCap } = groupByDefaultRules(outboundPriced, DEFAULT_RULES);
    assert.equal(ranked.length + viaMiddleEast.length + overCap.length, outboundPriced.length);
    // Qatar ex-Madrid is €1,158 pp on the research band: Gulf and over the cap.
    const madrid = viaMiddleEast.find((row) => row.option.id === "out-MAD-QR");
    assert.ok(madrid);
    assert.ok(overCap.every((row) => row.option.middleEastTransit.length === 0));
    const held = heldBackBy(madrid.option, madrid.price, DEFAULT_RULES);
    assert.deepEqual(held, { middleEast: ["DOH"], overCap: true, capEurPP: 1_000 });
  });

  it("measures the cap on the whole chain, per person, at the cheap end", () => {
    // Vienna on Scoot is €730 pp all in — fare, the Austrian feed, the hotel.
    const vienna = outboundPriced.find((row) => row.option.id === "out-VIE-TR");
    assert.ok(vienna);
    assert.equal(Math.round(perPersonTotal(vienna.price)[0]), 730);
    assert.equal(overCap(vienna.price, 1_000), false);
    assert.equal(overCap(vienna.price, 700), true);
  });

  it("gives both rules back when they are switched off", () => {
    const open = groupByDefaultRules(outboundPriced, { maxEurPP: 3_000, avoidMiddleEast: false });
    assert.equal(open.viaMiddleEast.length, 0);
    assert.equal(open.overCap.length, 0);
    assert.equal(open.ranked.length, outboundPriced.length);
  });

  it("keeps Canberra's only return, which is Qatar's, out of the default ranking", () => {
    // Worth pinning: the rule does not merely reorder this search, it empties
    // one of its four origins. The row is still on the page, in the band.
    const canberra = returnPriced.filter((row) => row.option.origin === "CBR");
    assert.equal(canberra.length, 1);
    const { ranked, viaMiddleEast } = groupByDefaultRules(returnPriced, DEFAULT_RULES);
    assert.ok(ranked.every((row) => row.option.origin !== "CBR"));
    assert.ok(viaMiddleEast.some((row) => row.option.origin === "CBR"));
  });

  it("measures the floor against everything, rules included", () => {
    const floor = cheapestFloor(returnPriced);
    assert.ok(floor);
    // China Southern SYD–CAN–MAD: the cheapest thing in the return search, and
    // the ruler the rest of the page quotes its distance from.
    assert.equal(floor.option.carrier, "China Southern");
    const cheapest = Math.min(...returnPriced.map((row) => perPersonTotal(row.price)[0]));
    assert.equal(perPersonTotal(floor.price)[0], cheapest);
  });

  it("does not let a Gulf fare become the Barcelona yardstick", () => {
    // Qatar and Emirates are Barcelona's two cheapest carriers. Measuring
    // every other hub against a routing the trip will not book would call them
    // all expensive by comparison with something that is not on offer.
    const reference = barcelonaReference(outboundPriced);
    const gulfAtBarcelona = outboundPriced.filter(
      (row) => row.option.origin === "BCN" && excludedByDefault(row.option),
    );
    assert.ok(gulfAtBarcelona.length > 0);
    for (const row of gulfAtBarcelona) {
      assert.equal(reference.byCarrier[row.option.carrier], undefined);
      assert.ok(reference.cheapest !== null && reference.cheapest > row.price.fareEurPP[0]);
    }
  });
});
