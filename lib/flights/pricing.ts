/**
 * What an option actually costs, once everything the fare band leaves out is
 * added back.
 *
 * The research is blunt about this: a €50 Ryanair hop to Milan is not €50. Two
 * people with two 23kg cases pay €70–120 of hold bags the LCC band excludes,
 * the wrong-airport arrivals pay a coach transfer, an evening arrival pays for
 * a hotel, and a London departure pays €248 of Air Passenger Duty the moment
 * the ticket is issued. Add those and the positioning move costs €60–220 more
 * for the couple than the Barcelona train — which is why the research's rule is
 * that a cheaper hub only wins if it is **at least €150 per person below the
 * Barcelona band**.
 *
 * This module is that arithmetic, and it is the reason the page can put the
 * Ryanair play next to the direct Barcelona option without either one lying.
 *
 * Everything here is per couple, which is the unit the rest of the site quotes
 * (docs/CONTEXT.md). Fare bands arrive per person and are doubled once, here.
 */

import type { Band, PositioningOption, SearchOption } from "@/lib/flights/search-plan";
import type { FareTrend } from "@/lib/flights/history";

/** How many travellers. Matches the API's `ADULTS` and the Ledger's couple. */
export const TRAVELLERS = 2;

/** A quote from `/api/fares`, already per person. */
export interface LiveQuote {
  priceEur: number;
  carrier: string;
  durationMin: number | null;
  stops: number | null;
  source: "live" | "history" | "snapshot";
  fetchedAt: string | null;
  trend?: FareTrend | null;
}

export type PriceSource = "live" | "history" | "snapshot" | "estimate";

export interface PriceLine {
  label: string;
  eur: Band;
  detail: string | null;
}

export interface OptionPrice {
  /** The long-haul itself, per person. */
  fareEurPP: Band;
  fareSource: PriceSource;
  /** The positioning move the headline total assumes, if any. */
  chain: PositioningOption | null;
  /** Everything, for two people. */
  totalEurCouple: Band;
  lines: readonly PriceLine[];
  trend: FareTrend | null;
}

const double = (band: Band): Band => [band[0] * TRAVELLERS, band[1] * TRAVELLERS];

const add = (a: Band, b: Band): Band => [a[0] + b[0], a[1] + b[1]];

/**
 * Whether a live quote is describing *this* option.
 *
 * The API answers an airport pair, not an itinerary: one cheapest fare with a
 * carrier string like `"Qatar Airways"` or `"Iberia / Cathay Pacific"`. It is
 * attached to the row whose carrier it names and to no other, because a
 * Barcelona quote for China Southern says nothing about what Singapore Airlines
 * is charging that day.
 */
export function quoteMatches(option: SearchOption, quote: LiveQuote): boolean {
  const quoted = quote.carrier.toLowerCase();
  const names = [option.carrier, ...option.carrier.split(" + ")].map((name) => name.toLowerCase());
  return names.some((name) => quoted.includes(name));
}

/**
 * Price an option, optionally against a live quote and a chosen positioning
 * move. With no chain given the cheapest honest one is assumed — which is the
 * cheapest *total*, bags and hotel included, not the cheapest fare.
 */
export function priceOption(
  option: SearchOption,
  quote: LiveQuote | null,
  chain?: PositioningOption | null,
): OptionPrice {
  const matched = quote && quoteMatches(option, quote) ? quote : null;
  const fareEurPP: Band = matched
    ? [matched.priceEur, matched.priceEur]
    : (option.bandEurPP ?? [0, 0]);

  const lines: PriceLine[] = [
    {
      label: matched
        ? `${option.carrier}, ${matched.source === "live" ? "live fare" : "stored fare"}`
        : `${option.carrier}, research band`,
      eur: double(fareEurPP),
      detail: matched
        ? "Cheapest quote on the searched date, for two."
        : "A ranking signal from the research, not a quote — bought about four months out for a mid-December departure.",
    },
  ];

  let total = double(fareEurPP);

  const move = chain === undefined ? (option.positioning[0] ?? null) : chain;
  if (move) {
    total = add(total, move.totalEurCouple);
    lines.push({
      label:
        move.mode === "train"
          ? `Valencia → ${option.origin} by train`
          : `Valencia → ${move.arrivesAt} on ${move.carrier}`,
      eur: double(move.fareEurPP),
      detail: move.sameAirport ? null : move.transferNote,
    });
    if (move.transferEurCouple) {
      lines.push({
        label: `${move.arrivesAt} → ${option.origin} on the ground`,
        eur: move.transferEurCouple,
        detail:
          move.transferNote ??
          "The cheap fare lands at the wrong airport. Coach or rail for two, one way — plus the hour or three it takes.",
      });
    }
    if (move.holdBagsEurCouple) {
      lines.push({
        label: "Two hold bags",
        eur: move.holdBagsEurCouple,
        detail: "€35–60 per 23kg bag each way on peak December dates. The LCC band excludes them; the comparison cannot.",
      });
    }
    if (move.hotelEurCouple) {
      lines.push({
        label: move.overnight === "forced" ? "Night before (forced)" : "Night before",
        eur: move.hotelEurCouple,
        detail:
          move.overnight === "forced"
            ? "Not a preference: the long-haul departs at midday and no flight exists from Valencia."
            : "An evening arrival or a cross-city transfer makes the same-day connection a gamble.",
      });
    }
  }

  if (option.homeLeg && option.homeLeg.mode !== "none") {
    const home = double(option.homeLeg.fareEurPP);
    total = add(total, home);
    lines.push({
      label:
        option.homeLeg.mode === "train"
          ? `${option.destination} → Valencia by train`
          : `${option.destination} → Valencia on ${option.homeLeg.carrier}`,
      eur: home,
      detail: option.homeLeg.detail,
    });
  }

  for (const surcharge of option.surchargesEurCouple) {
    total = add(total, [surcharge.eur, surcharge.eur]);
    lines.push({
      label: surcharge.label,
      eur: [surcharge.eur, surcharge.eur],
      detail: surcharge.detail,
    });
  }

  return {
    fareEurPP,
    fareSource: matched ? matched.source : "estimate",
    chain: move,
    totalEurCouple: total,
    lines,
    trend: matched?.trend ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* The €150 rule                                                       */
/* ------------------------------------------------------------------ */

/**
 * How far below the Barcelona band a hub has to be before its positioning move
 * pays for itself: €150 per person. Below that, the saving is eaten by hold
 * bags, the hotel and the transfer, and paid for with lost protection.
 */
export const ARBITRAGE_BAR_EUR_PP = 150;

export interface Arbitrage {
  /** Per person, positive when this hub is cheaper than Barcelona. */
  deltaEurPP: number;
  clears: boolean;
  verdict: string;
}

const midpoint = (band: Band): number => (band[0] + band[1]) / 2;

/**
 * What Barcelona costs on this search, per carrier and at its cheapest.
 *
 * Both are needed. The comparison the research makes is same-carrier where one
 * exists — Singapore ex-Milan against Singapore ex-Barcelona, which is the
 * €667–689 vs Spain's-higher-floor argument — because pitting a Milan A350
 * against a Barcelona 777 measures the carrier, not the origin market. Where
 * the carrier does not fly to Barcelona at all (Thai, Malaysia, Scoot) the
 * cheapest Barcelona fare is the honest yardstick instead.
 */
export interface BarcelonaReference {
  byCarrier: Readonly<Record<string, number>>;
  cheapest: number | null;
}

/**
 * Judge a hub's fare against Barcelona's, the way the research says to.
 *
 * Options *at* Barcelona get no verdict — they are the yardstick.
 */
export function arbitrageVsBarcelona(
  option: SearchOption,
  price: OptionPrice,
  reference: BarcelonaReference,
): Arbitrage | null {
  if (option.leg !== "outbound" || option.origin === "BCN") return null;
  if (option.positioning.length === 0) return null;

  const barcelonaEurPP = reference.byCarrier[option.carrier] ?? reference.cheapest;
  if (barcelonaEurPP === null || barcelonaEurPP === undefined) return null;

  const delta = Math.round(barcelonaEurPP - midpoint(price.fareEurPP));
  const clears = delta >= ARBITRAGE_BAR_EUR_PP;

  return {
    deltaEurPP: delta,
    clears,
    verdict: clears
      ? `€${delta} pp under Barcelona — clears the €150 bar, so the positioning move pays for itself.`
      : delta > 0
        ? `Only €${delta} pp under Barcelona. Below the €150 bar the saving goes on hold bags, the hotel and the transfer — and buys lost protection.`
        : `€${Math.abs(delta)} pp *over* Barcelona before the positioning move is even paid for.`,
  };
}

/** The Barcelona fares in a priced set, per carrier and at their cheapest. */
export function barcelonaReference(
  priced: readonly { option: SearchOption; price: OptionPrice }[],
): BarcelonaReference {
  const byCarrier: Record<string, number> = {};
  const all: number[] = [];

  for (const entry of priced) {
    if (entry.option.origin !== "BCN") continue;
    const fare = midpoint(entry.price.fareEurPP);
    if (fare <= 0) continue;
    all.push(fare);
    byCarrier[entry.option.carrier] = Math.min(byCarrier[entry.option.carrier] ?? Infinity, fare);
  }

  return { byCarrier, cheapest: all.length > 0 ? Math.min(...all) : null };
}
