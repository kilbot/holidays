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

import {
  excludedByDefault,
  type Band,
  type PositioningOption,
  type SearchOption,
} from "@/lib/flights/search-plan";
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
/* The two default rules                                               */
/* ------------------------------------------------------------------ */

/**
 * The most the couple will pay per person to cross to Australia: €1,000.
 *
 * A hard limit from the user (2026-08-27), not a target and not a preference
 * the comfort score is allowed to outvote — the sibling of "no Middle East
 * transits", and applied the same way: a row over it is held out of the default
 * ranking rather than deleted, because an expensive routing can still be the
 * interesting one and the site never refuses (docs/CONTEXT.md).
 *
 * It is where the page's price slider *starts*, not a value baked into the
 * ranking. A number that silently decided what the list looked like would read
 * as the world being that shape; a slider sitting at €1,000 reads as a choice,
 * and can be moved to see what the choice cost.
 *
 * Three things it is careful about:
 *
 * - **Per person, and per *journey*.** The cap is measured against the whole
 *   chain — the long-haul, the positioning hop into the hub, its hold bags,
 *   the night before, the ride home from the arrival airport and the UK's APD
 *   — halved. A €900 fare reached by a €300 positioning move is not under a
 *   €1,000 cap, and pretending otherwise is exactly the arithmetic this module
 *   exists to stop.
 * - **Long-haul only.** It is a rule about the crossing, so it lives here,
 *   next to the fare bands, and never reaches the Australian domestic Legs the
 *   Plan prices through `lib/leg-fare.ts`.
 * - **Judged on the cheap end of the band.** A research band is a range, not a
 *   quote; a row banded €908–1,355 pp can be bought at €1,000 and belongs in
 *   the ranking. So the test is whether the *cheapest* honest total clears the
 *   cap, and a live quote — which is a single number, not a band — settles it
 *   properly the moment one lands.
 */
export const LONGHAUL_CAP_EUR_PP = 1_000;

/**
 * How far the page's price slider travels.
 *
 * €400 is under the cheapest thing in the research and €3,000 is over the
 * dearest, so both ends of the slider are places where the setting stops
 * mattering — which is what makes it legible: the couple can see the rule
 * switch itself off in either direction rather than wondering whether the
 * track ran out before the answer did.
 */
export const LONGHAUL_CAP_RANGE_EUR_PP = { min: 400, max: 3_000, step: 50 } as const;

/**
 * The two rules the default view applies, as settings rather than as facts.
 *
 * Both are the couple's own, and a constraint the visitor cannot see is a
 * constraint they will misread as the world being that shape. So each one is a
 * labelled control with these as its starting position, the summary above the
 * results says both out loud in a sentence, and the rows either rule holds back
 * stay on the page behind a count. `LONGHAUL_CAP_EUR_PP` is where the slider
 * starts, not a ceiling on where it can go.
 */
export interface DefaultRules {
  /** The slider's value: the most one person may pay for the whole journey. */
  maxEurPP: number;
  /** The toggle: whether Gulf routings are held out of the ranking. */
  avoidMiddleEast: boolean;
}

export const DEFAULT_RULES: DefaultRules = {
  maxEurPP: LONGHAUL_CAP_EUR_PP,
  avoidMiddleEast: true,
};

/** Everything this option costs, halved: the unit the cap is written in. */
export function perPersonTotal(price: OptionPrice): Band {
  return [price.totalEurCouple[0] / TRAVELLERS, price.totalEurCouple[1] / TRAVELLERS];
}

/** Whether even the cheap end of the journey is over the price setting. */
export function overCap(price: OptionPrice, maxEurPP: number): boolean {
  return perPersonTotal(price)[0] > maxEurPP;
}

/** Why a row is not in the default ranking. `null` means it is. */
export interface HeldBack {
  /** The Gulf hubs it transits — `docs/CONTEXT.md`, "No Middle East transits". */
  middleEast: readonly string[];
  /** True when the cheapest per-person total is over the price setting. */
  overCap: boolean;
}

export function heldBackBy(
  option: SearchOption,
  price: OptionPrice,
  rules: DefaultRules,
): HeldBack | null {
  const middleEast = rules.avoidMiddleEast ? option.middleEastTransit : [];
  const over = overCap(price, rules.maxEurPP);
  if (middleEast.length === 0 && !over) return null;
  return { middleEast, overCap: over };
}

/**
 * Split a priced search three ways: what the rules rank, and one group per
 * reason they do not.
 *
 * A row can break both rules, and the Gulf ones frequently do. It is filed
 * under the Middle East — the rule that is about where the aeroplane goes
 * rather than what it costs, and the one the couple asked for first — and
 * carries both reasons on its face, so nothing is listed twice and nothing
 * loses half of its explanation.
 */
export function groupByDefaultRules<T extends { option: SearchOption; price: OptionPrice }>(
  rows: readonly T[],
  rules: DefaultRules,
): { ranked: T[]; viaMiddleEast: T[]; overCap: T[] } {
  const ranked: T[] = [];
  const viaMiddleEast: T[] = [];
  const dear: T[] = [];

  for (const row of rows) {
    const held = heldBackBy(row.option, row.price, rules);
    if (!held) ranked.push(row);
    else if (held.middleEast.length > 0) viaMiddleEast.push(row);
    else dear.push(row);
  }

  return { ranked, viaMiddleEast, overCap: dear };
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
 *
 * That fallback is why the reference has to know about the Middle East rule.
 * Barcelona's two cheapest carriers are Qatar and Emirates, both excluded
 * (docs/CONTEXT.md), and a yardstick made of a fare the trip will not book
 * would tell every other hub it was expensive by comparison with a routing
 * that is not on offer. The bar is the cheapest Barcelona fare the couple
 * would actually take.
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
    if (excludedByDefault(entry.option)) continue;
    const fare = midpoint(entry.price.fareEurPP);
    if (fare <= 0) continue;
    all.push(fare);
    byCarrier[entry.option.carrier] = Math.min(byCarrier[entry.option.carrier] ?? Infinity, fare);
  }

  return { byCarrier, cheapest: all.length > 0 ? Math.min(...all) : null };
}
