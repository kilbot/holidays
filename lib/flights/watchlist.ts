/**
 * The watchlist: a fare, remembered on the day it looked good.
 *
 * kilbot/holidays#68, in the user's own words: *"sometimes you find a flight
 * you think is good, but then you forget which day it was."* The Flights page
 * is a search — thirteen origins, ninety choosable days, three controls that
 * re-rank the whole table — and a search has no memory. Everything the couple
 * learns by moving the date strip is gone the moment they move it again.
 *
 * A **pin** is that memory: the quote as it stood, with the day it stood on.
 * Not a bookmark to a row (the rows are derived, and they re-rank), and not a
 * booking (nothing here books anything) — a dated observation the page can put
 * next to today's number and say what has happened since.
 *
 * Three rules the model holds to, and each one is a decision the obvious
 * implementation gets wrong:
 *
 * 1. **A pin never spends a fare call.** The current price it is compared
 *    against comes from the history store and nowhere else. Twenty pins that
 *    each fetched on load would be twenty metered calls per page view, which is
 *    the couple's monthly quota gone in a week of browsing — so a pin with
 *    nothing stored since says exactly that, and stays useful anyway.
 * 2. **The drift compares like with like.** The number a pin tracks is the
 *    **long-haul fare, per person** — the one figure the store actually
 *    observes. The row's headline is the all-in total for two, and it moves
 *    with the positioning chain, the bags and the hotel as well as with the
 *    fare; drifting one against the other would report a €40 change that was
 *    really a €0 change and a different coach ticket. The same rule holds
 *    across carriers: the store records the *cheapest* fare seen each day,
 *    whoever flies it, so the newest observation is only this pin's "now" when
 *    it names this pin's carrier. A Cathay Pacific pin shown a China Southern
 *    floor as its current price would be reporting a €34 "drop" that was really
 *    a different airline.
 * 3. **A pin taken against a research band is not an observation.** It is
 *    recorded, because the couple pinned it and losing it would be worse, but
 *    it carries its `fareSource` so the watchlist can say "estimate when you
 *    pinned it" rather than inventing a drift from a number nobody quoted.
 *
 * Pure data, no React, no store, no `window` — the same shape as
 * `lib/engine/scenario-doc.ts`, and for the same reason: pins live in the
 * shared Plan document, so both ends of the wire parse them with this file.
 */

import type { PriceSource } from "@/lib/flights/pricing";

/**
 * How many flights the couple may watch at once.
 *
 * The ticket says ~20 and the number is doing real work: the watchlist sits
 * *above* the search it belongs to, so every pin is height the ranking does not
 * get, and twenty rows is already a screenful. It is also the fan-out of the
 * history read that draws them — one KV read per pin — which is why the API
 * enforces the same ceiling rather than trusting the client's.
 */
export const MAX_PINS = 20;

export type PinLeg = "outbound" | "return";

/**
 * One remembered quote.
 *
 * Deliberately flat and small: this is stored inside the Plan document, which
 * is read whole on every page load and written whole on every knob change, and
 * twenty pins holding a copy of their `SearchOption` would be a Plan several
 * times larger than the itinerary it exists to hold.
 */
export interface FlightPin {
  /** `outbound|bcn-sq-sin|2026-12-12` — one pin per row per day. */
  id: string;
  leg: PinLeg;
  /** The searched itinerary, so jump-to-search can find the row again. */
  optionId: string;
  from: string;
  to: string;
  /** The day that was searched. Half of what the couple forgets. */
  date: string;
  carrier: string;
  /**
   * The long-haul fare per person as it stood, and where it came from. The
   * drift is measured on this and on nothing else — see rule 2 above.
   */
  fareEurPP: number | null;
  fareSource: PriceSource;
  /** The row's headline at pin time: everything, for two. Display only. */
  totalEurCouple: number | null;
  /** The comfort score as it was scored then. Null for an unrated carrier. */
  comfort: number | null;
  /** ISO instant. What makes this a dated observation rather than a bookmark. */
  pinnedAt: string;
}

export const pinIdOf = (leg: PinLeg, optionId: string, date: string): string =>
  `${leg}|${optionId}|${date}`;

/** `"BCN-PER"` — the route key the history store and the API speak in. */
export const pinRouteOf = (pin: Pick<FlightPin, "from" | "to">): string =>
  `${pin.from}-${pin.to}`;

/** Everything a pin needs, minus the id, which is derived from three of them. */
export type NewPin = Omit<FlightPin, "id">;

export const pinOf = (pin: NewPin): FlightPin => ({
  ...pin,
  id: pinIdOf(pin.leg, pin.optionId, pin.date),
});

/**
 * Whether a stored fare is something that was actually quoted.
 *
 * `"estimate"` and `"snapshot"` are the research's own band — the same number
 * on all ninety days — so a difference between one of those and today's fare is
 * not a price change, it is the difference between a guess and a quote.
 */
export const isObserved = (source: PriceSource): boolean =>
  source === "live" || source === "history";

/* ------------------------------------------------------------------ */
/* The list                                                            */
/* ------------------------------------------------------------------ */

export interface AddPinResult {
  pins: FlightPin[];
  /** True when the cap refused the pin. The UI owes the couple a sentence. */
  full: boolean;
}

/**
 * Put a pin at the front of the list.
 *
 * Newest first, because the question a watchlist answers is "what did I just
 * find" at least as often as "what am I watching" — and a list that re-sorted
 * itself by departure date would move a row out from under the cursor that
 * pinned it.
 *
 * Re-pinning something already pinned is **idempotent, and re-dates nothing**.
 * The whole value of a pin is the instant it was taken; a second click that
 * silently refreshed the quote-at-pin-time would erase the only thing the
 * watchlist knows that the search does not.
 */
export function addPin(
  pins: readonly FlightPin[],
  pin: FlightPin,
): AddPinResult {
  if (pins.some((existing) => existing.id === pin.id)) {
    return { pins: [...pins], full: false };
  }
  if (pins.length >= MAX_PINS) return { pins: [...pins], full: true };
  return { pins: [pin, ...pins], full: false };
}

export function removePin(
  pins: readonly FlightPin[],
  id: string,
): FlightPin[] {
  return pins.filter((pin) => pin.id !== id);
}

export const isPinned = (pins: readonly FlightPin[], id: string): boolean =>
  pins.some((pin) => pin.id === id);

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** A price, or null. Negative fares are repaired to absent rather than trusted. */
const priceOr = (value: unknown): number | null =>
  isFiniteNumber(value) && value >= 0 ? value : null;

const PRICE_SOURCES: readonly PriceSource[] = [
  "live",
  "history",
  "snapshot",
  "estimate",
];

/**
 * Rebuild the watchlist from whatever came out of storage — or off the wire.
 *
 * Same rule as the rest of the Plan document (`lib/engine/scenario-doc.ts`):
 * **never reject, always repair**. A watchlist written by an older build is
 * missing whichever fields have been added since, and a Plan that refused to
 * load because one pin had a bad price would cost the couple their itinerary to
 * save them from a wrong number.
 *
 * Only the four fields that make a pin *identifiable* are load-bearing — leg,
 * option, date, and the airport pair. Without them there is nothing to compare
 * against and nothing to jump to, so such an entry is dropped rather than
 * repaired into a pin that points nowhere. Everything else has a defensible
 * default, and `null` is one of them: "no price recorded" is a thing the
 * watchlist can say out loud.
 */
export function parsePins(raw: unknown): FlightPin[] {
  if (!Array.isArray(raw)) return [];

  const pins: FlightPin[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;

    const leg = record.leg === "return" ? "return" : record.leg === "outbound" ? "outbound" : null;
    const optionId = typeof record.optionId === "string" ? record.optionId : null;
    const date = typeof record.date === "string" ? record.date : null;
    const from = typeof record.from === "string" ? record.from : null;
    const to = typeof record.to === "string" ? record.to : null;
    if (!leg || !optionId || !date || !from || !to) continue;

    // Recomputed rather than trusted: the id is a function of three fields
    // above it, and a stored id that disagrees with them would give one pin two
    // identities — pinned in the list, unpinned on the row it came from.
    const id = pinIdOf(leg, optionId, date);
    if (seen.has(id)) continue;
    seen.add(id);

    const source = record.fareSource;
    pins.push({
      id,
      leg,
      optionId,
      from,
      to,
      date,
      carrier: typeof record.carrier === "string" ? record.carrier : "Unknown carrier",
      fareEurPP: priceOr(record.fareEurPP),
      fareSource: PRICE_SOURCES.includes(source as PriceSource)
        ? (source as PriceSource)
        : "estimate",
      totalEurCouple: priceOr(record.totalEurCouple),
      comfort: isFiniteNumber(record.comfort) ? record.comfort : null,
      pinnedAt:
        typeof record.pinnedAt === "string" ? record.pinnedAt : new Date(0).toISOString(),
    });

    // The cap is enforced on read as well as on write, so a document that
    // arrived over the cap — an older build, a hand-edited Plan, two devices
    // racing — cannot make the page fan out past what the API will answer.
    if (pins.length >= MAX_PINS) break;
  }

  return pins;
}

/* ------------------------------------------------------------------ */
/* Drift                                                               */
/* ------------------------------------------------------------------ */

export type DriftDirection = "up" | "down" | "flat";

/** The newest stored observation, as the history store hands it over. */
export interface PinQuote {
  priceEur: number;
  carrier: string;
}

export interface PinDrift {
  /**
   * The newest stored fare for this route and day, per person — and only when
   * that observation names the pin's own carrier. The store keeps the cheapest
   * fare seen each day, whoever flies it; another carrier's floor is not this
   * pin's "now".
   */
  currentEurPP: number | null;
  /** Current minus pinned, per person. Null when there is nothing to compare. */
  deltaEur: number | null;
  direction: DriftDirection | null;
  /**
   * Why there is no delta, when there is none:
   *
   * - `"unpriced"` — nothing was recorded when the pin was taken.
   * - `"estimate"` — the pin was taken against the research band, so the
   *   difference would be guess-versus-quote rather than a price change.
   * - `"nothing-since"` — no observation of this route and day is stored, so
   *   the honest answer is that nobody has looked since.
   * - `"different-carrier"` — the newest observation is another carrier's
   *   cheapest-of-the-day, so the difference would be airline-versus-airline
   *   rather than a price change.
   */
  reason: "unpriced" | "estimate" | "nothing-since" | "different-carrier" | null;
  /**
   * The day's stored floor, when it belongs to another carrier: the newest
   * observation, carried separately so the UI can *label* it as the cheapest
   * on this day rather than passing it off as this pin's current price. Null
   * whenever `currentEurPP` already tells the story.
   */
  cheapest: { eurPP: number; carrier: string } | null;
}

/**
 * What has happened to this fare since it was pinned.
 *
 * Rounded to the euro, because a drift chip reading "▲€39.62 since pinned" is
 * claiming a precision that a cheapest-fare-of-the-day figure does not have.
 * Anything under a euro reads as flat, which is what it is.
 *
 * The carrier check is exact string equality, deliberately: both sides of the
 * comparison — the pin's carrier and the stored entry's — are written by the
 * same `parseFlight` in `lib/flights/searchapi.ts`, so a mismatch is a real
 * difference, not a formatting one.
 */
export function driftOf(pin: FlightPin, quote: PinQuote | null): PinDrift {
  const matches = quote !== null && quote.carrier === pin.carrier;
  const current = matches ? Math.round(quote.priceEur) : null;
  const cheapest =
    quote !== null && !matches
      ? { eurPP: Math.round(quote.priceEur), carrier: quote.carrier }
      : null;

  const noDelta = (reason: NonNullable<PinDrift["reason"]>): PinDrift => ({
    currentEurPP: current,
    deltaEur: null,
    direction: null,
    reason,
    cheapest,
  });

  if (pin.fareEurPP === null) return noDelta("unpriced");
  if (!isObserved(pin.fareSource)) return noDelta("estimate");
  if (quote === null) return noDelta("nothing-since");
  if (current === null) return noDelta("different-carrier");

  const deltaEur = current - Math.round(pin.fareEurPP);
  return {
    currentEurPP: current,
    deltaEur,
    direction: deltaEur > 0 ? "up" : deltaEur < 0 ? "down" : "flat",
    reason: null,
    cheapest,
  };
}
