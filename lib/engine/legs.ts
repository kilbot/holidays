/**
 * Legs — derived, never placed.
 *
 * docs/CONTEXT.md: *"Legs are derived, not placed: the Scheduler computes them
 * from the Capsule sequence and prices them from fare data, with a per-Leg
 * override for mode when the journey IS the experience."*
 *
 * So there is no Leg object anyone creates. This module walks the finished Day
 * sequence, and every time consecutive Days sit in different Locations, that is
 * a Leg. Drag a Capsule and the Legs re-derive; toggle one off and the Leg it
 * required stops existing. Nothing to keep in step.
 *
 * ## Pricing, in three tiers and a flag
 *
 * 1. **`snapshot`** — a stored research estimate for the route.
 * 2. **`band`** — no snapshot at all, so the research's own band for that kind
 *    of journey (`docs/research/domestic-flights.md` §2).
 * 3. **`computed`** — a drive. Distance × fuel, from cost-baselines §2.2. The
 *    car itself is already a Day line, so the Leg only carries the fuel.
 *
 * `onGrid` is the flag, and it is orthogonal to all three: it says
 * `lib/flights/grid.ts` covers this route on this date, so whatever figure is
 * showing is a placeholder standing in until the client hydrates the live fare
 * through `fareOverrides`. A placeholder that is labelled is honest; a blank is
 * not.
 *
 * ## One-way, return, and why it is not a display detail
 *
 * Every live quote is a **one-way**: `lib/flights/searchapi.ts` asks for
 * `flight_type=one_way`. The research's long-haul figure is a **return** —
 * `docs/research/longhaul-comfort.md` heads its price table *"Bands, per
 * person, return, open-jaw into PER / out of SYD-MEL-BNE"* and puts the
 * premium-comfort row, the stated criterion for these crossings, at
 * €1,500–2,300.
 *
 * This module used to charge that return figure to the outbound Leg and zero
 * the homeward one, with a note saying the fare was on the outbound ticket.
 * That is correct arithmetic on a return figure and catastrophic on a one-way
 * one: as soon as a live fare hydrated the outbound crossing, the Plan was
 * charging a single one-way ticket for a round trip and the entire journey home
 * — €1–2k for two — vanished from the roll-up (kilbot/holidays#90).
 *
 * So provenance decides, per figure and per Leg. A return-basis figure is split
 * across the two crossings (`OUTBOUND_SHARE`); a one-way figure is charged
 * whole to the crossing it prices. Neither rule can lose a fare, and hydrating
 * one crossing no longer says anything about the other.
 *
 * ## Mode
 *
 * Default is flight, because for this trip's distances it almost always is.
 * `legModeOverrides` flips one Leg to a drive, a train or a ferry — the
 * relocation-drive case docs/CONTEXT.md names, and the one Paul's Perth→Sydney
 * hitchhike is the reason for.
 *
 * ## Where the money lands
 *
 * A Leg's fare is pushed onto the Day it is travelled, as a `transport` line.
 * That is not a display choice: the Plan's total is the sum of its Days, so a
 * fare that lived on a Leg object and not on a Day would break the one
 * invariant the whole cost model rests on.
 */

import {
  AUD_TO_EUR,
  DRIVE_KM_PER_DAY,
  FUEL_AUD_PER_KM,
  ROAD_DISTANCE_FACTOR,
  TRAVELLERS,
} from "@/lib/engine/constants";
import { cents, retotal } from "@/lib/engine/ledger";
import { ORIGIN_AIRPORT, distanceKm, locationById } from "@/lib/engine/locations";
import type { Day, FareBasis, Leg, LegMode } from "@/lib/engine/types";
import { FARE_SNAPSHOTS } from "@/lib/flights/snapshots";
import { EUROPEAN_AIRPORTS, ROUTE_GRID, resolveRoute } from "@/lib/flights/grid";

/**
 * Research bands for routes the snapshots do not carry, EUR **per person,
 * one-way**. `docs/research/domestic-flights.md` §2 "Typical €" column.
 *
 * Every row here is a one-way, and the long-haul band is deliberately *not* a
 * row: it is quoted on a different basis and mixing the two in one table is
 * how it came to be spent as if it were a one-way.
 */
const RESEARCH_BANDS: Readonly<Record<string, [number, number]>> = {
  "PER-SYD": [245, 425], // §2 row 1, the critical Leg, 26–31 Dec
  "PER-MEL": [145, 220], // row 3
  "SYD-CNS": [90, 135], // row 8, January is this route's cheapest month
  "SYD-HBA": [80, 135], // row 5
  "MEL-HBA": [64, 107], // row 7
  "SYD-MEL": [67, 110], // row 15
  "OOL-HBA": [67, 134], // no published row; Gold Coast → Hobart, one-stop
  "CNS-OOL": [90, 160], // Cairns → Gold Coast, Jetstar
};

/** A domestic hop with no published row of its own. One-way, per person. */
const DOMESTIC_BAND: readonly [number, number] = [90, 200];

/**
 * The ocean crossing, EUR per person — and a **return**, not a one-way.
 *
 * `docs/research/longhaul-comfort.md`, the table headed *"Bands, per person,
 * return, open-jaw into PER / out of SYD-MEL-BNE"*: the premium-comfort row is
 * €1,500–2,300, and comfort-first rather than cheapest is docs/CONTEXT.md's
 * stated criterion for these two Legs. One figure, both crossings.
 */
const LONGHAUL_RETURN_BAND: readonly [number, number] = [1_500, 2_300];

/**
 * How much of a return figure the outbound crossing carries. The homeward one
 * carries the rest.
 *
 * Not half. `longhaul-comfort.md` on the same page as the band: *"The outbound
 * is peak; the return is the cheapest week of the year"* — aggregator averages
 * for Sydney→Spain are €1,344 in December against €804 in February, which is
 * five-eighths and three-eighths to within a euro. Splitting evenly would
 * under-price the December crossing, and December is both the one the couple
 * books first and the one a live one-way quote replaces first: a placeholder
 * that jumps when the real number lands is a placeholder that was lying.
 */
const OUTBOUND_SHARE = 0.625;

/**
 * Anything crossing an ocean prices off the long-haul band, not a domestic row.
 *
 * The list lives in the grid rather than here because the grid is where hubs
 * get added: the Flights page's search put ten more European airports on it,
 * and a Frankfurt that this file had never heard of would have been subtracted
 * into `AUSTRALIAN` and priced as a domestic hop.
 */
const EUROPEAN: readonly string[] = EUROPEAN_AIRPORTS;

const AUSTRALIAN = new Set<string>(
  ROUTE_GRID.flatMap((entry): string[] => [entry.from, entry.to]).filter(
    (code) => !EUROPEAN.includes(code),
  ),
);

export interface LegInput {
  days: Day[];
  legModeOverrides: Readonly<Record<string, LegMode>>;
  fareOverrides: Readonly<Record<string, number>>;
}

export interface LegResult {
  legs: Leg[];
  /** The same Days, with each Leg's fare added as a `transport` line. */
  days: Day[];
}

/**
 * Derive every Leg from the Day sequence and charge it to the Day it happens.
 *
 * The trip's two long-hauls bracket the sequence: the first Day is an arrival
 * (origin → wherever Day 1 is) and the last is a departure. They are Legs like
 * any other — the couple is flying, they are paying — and leaving them out
 * would knock €5,000-odd off a total that is supposed to reconcile.
 */
export function deriveLegs(input: LegInput): LegResult {
  const { days } = input;
  if (days.length === 0) return { legs: [], days };

  const legs: Leg[] = [];

  /**
   * `transit` is not a place you fly to.
   *
   * Since #54 gave the arrival block a `landsAfter` offset, the first Day of
   * the trip can be a Buffer at the `transit` market — the ledger's own name
   * for "the trip has started but has not landed", which is exactly what a
   * night over the Indian Ocean is. Left alone, the sequence below read that as
   * two relocations: a A$0 *drive* from Valencia to In transit, and then the
   * €3,800 crossing from In transit to Mundaring. One of those journeys does
   * not exist and the other starts in the wrong place.
   *
   * So the crossing is dated on the day the couple **leaves** and aimed at the
   * first real Location they reach, and the transit Days in between are not
   * arrivals at anything.
   */
  const landed = days.find((day) => day.locationId !== "transit") ?? days[0];

  const first = days[0];
  legs.push(
    buildLeg({
      date: first.date,
      fromLocationId: "origin",
      toLocationId: landed.locationId,
      from: ORIGIN_AIRPORT,
      to: locationById(landed.locationId).airport,
      input,
      note: "The outbound crossing. Comfort-first, not cheapest — docs/CONTEXT.md names aircraft type, layover quality and an overnight stopover as the criteria.",
    }),
  );

  for (let index = 1; index < days.length; index += 1) {
    const previous = days[index - 1];
    const day = days[index];
    if (previous.locationId === day.locationId) continue;
    // Arriving where the outbound crossing already said it was going.
    if (previous.locationId === "transit") continue;

    legs.push(
      buildLeg({
        date: day.date,
        fromLocationId: previous.locationId,
        toLocationId: day.locationId,
        from: locationById(previous.locationId).airport,
        to: locationById(day.locationId).airport,
        input,
        note: `Relocation — ${previous.locationName} to ${day.locationName}.`,
      }),
    );
  }

  // The homeward crossing, priced like any other Leg.
  //
  // It used to be zeroed here. `longhaul-comfort.md` prices the crossing as one
  // **return** and argues for an open jaw — out to Perth, home from the east
  // coast — as a variant of that one ticket rather than two one-ways, so the
  // outbound Leg carried the whole figure and this one carried a note saying
  // the fare was over there. Two Legs, one charge, no double-count.
  //
  // The flaw was that the rule was written for the band and applied to
  // everything. Live quotes are one-ways (`searchapi.ts`), so a hydrated
  // outbound crossing meant a round trip priced as a single ticket west, with
  // the journey home free (kilbot/holidays#90). `priceFlight` now splits a
  // return-basis figure across the two crossings and charges a one-way figure
  // whole, which needs no special case here at all.
  const last = days[days.length - 1];
  legs.push(
    buildLeg({
      date: last.date,
      fromLocationId: last.locationId,
      toLocationId: "origin",
      from: locationById(last.locationId).airport,
      to: ORIGIN_AIRPORT,
      input,
      note: "The homeward crossing. February is the cheapest month of the year out of Australia — longhaul-comfort.md — which is why it is the smaller half of the ticket.",
    }),
  );

  // Charge each Leg to its Day. Two Legs on one Day (a same-day connection) is
  // legal and both land — the Day is the ledger's atom, not the Leg.
  const byDate = new Map(days.map((day) => [day.date, day]));
  for (const leg of legs) {
    const day = byDate.get(leg.date);
    if (!day) continue;
    day.lines.push({
      id: `${leg.date}:${leg.id}`,
      kind: "transport",
      // Places, not airport codes: two Locations can share a gateway, and
      // "PER → PER" is not a sentence about a journey.
      label: `${legEndName(leg.fromLocationId, leg.from)} → ${legEndName(leg.toLocationId, leg.to)}${leg.mode === "flight" ? "" : ` by ${leg.mode}`}`,
      aud: null,
      eur: leg.eur,
      bandEur: leg.bandEur,
      // A Leg is Event spend, not living: docs/CONTEXT.md lists "inter-city
      // Legs" under Event spend and the Daily cap under living costs only.
      living: false,
      note: leg.note,
    });
    retotal(day);
  }

  return { legs, days };
}

/** "Margaret River", or the IATA code where the end is home rather than a place. */
function legEndName(locationId: string, iata: string): string {
  return locationId === "origin" ? iata : locationById(locationId).name;
}

interface BuildLegArgs {
  date: string;
  fromLocationId: string;
  toLocationId: string;
  from: string;
  to: string;
  input: LegInput;
  note: string;
}

function buildLeg(args: BuildLegArgs): Leg {
  const { date, from, to, input } = args;
  const id = `${from}>${to}@${date}`;
  const override = input.legModeOverrides[id];
  // Two places reached through the same airport are a drive, not a flight:
  // nobody flies Perth → Margaret River, and pricing it as a fare would invent
  // several hundred euro out of a three-hour highway run.
  const mode: LegMode = override ?? (from === to ? "drive" : "flight");

  const priced =
    mode === "drive"
      ? priceDrive(args)
      : priceFlight({ ...args, id });

  const live = input.fareOverrides[id];
  const hydrated = typeof live === "number" && Number.isFinite(live);

  return {
    id,
    date,
    fromLocationId: args.fromLocationId,
    toLocationId: args.toLocationId,
    from,
    to,
    mode,
    modeOverridden: Boolean(override),
    eur: hydrated ? cents(live) : priced.eur,
    bandEur: hydrated ? [cents(live), cents(live)] : priced.bandEur,
    pricing: priced.pricing,
    onGrid: priced.onGrid,
    // A hydrated figure came from `/api/fares`, which asks SearchAPI for
    // `flight_type=one_way`. It buys this crossing and nothing else — whatever
    // the placeholder it replaced was a price for.
    fareBasis: hydrated ? "one-way" : priced.fareBasis,
    hydrated,
    carrier: priced.carrier,
    note: hydrated
      ? `${priced.note} Live one-way fare from /api/fares, for this crossing only.`
      : priced.note,
  };
}

interface Priced {
  eur: number;
  bandEur: [number, number];
  pricing: Leg["pricing"];
  onGrid: boolean;
  fareBasis: Leg["fareBasis"];
  carrier: string | null;
  note: string;
}

/**
 * Whether `/api/fares` can answer for this route on this date at all.
 *
 * The same question `resolveRoute` answers, asked with its own function: the
 * **pair** is a whitelist, because an open origin/destination on a metered API
 * is a proxy somebody else can spend, and the **date** is a window, because a
 * date is not a resource (`lib/flights/grid.ts`).
 *
 * It used to compare the date against `entry.dates`, which is the set the cron
 * warms — a different question, and the wrong one. That is *"will this be a
 * cache hit"*, and answering it here meant every Leg on a day the cron does not
 * pay for was treated as unpriceable. The homeward crossing has fallen outside
 * the warmed set twice now, once per re-plan, and each time it silently stopped
 * being able to ask for the fare it was entitled to. `isPreWarmed` is still
 * there for callers who genuinely want to know what a cold date costs.
 */
export function legIsOnGrid(from: string, to: string, date: string): boolean {
  return resolveRoute(from, to, date) !== null;
}

/**
 * The fraction of a return-basis figure this Leg carries.
 *
 * Only the two ocean crossings are ever priced from a return figure — the
 * research quotes nothing else that way — and they are also the only Legs with
 * an `origin` end, so the direction reads straight off the Leg.
 */
function returnShare(args: BuildLegArgs): number {
  return args.toLocationId === "origin" ? 1 - OUTBOUND_SHARE : OUTBOUND_SHARE;
}

/** Why a crossing carries part of a figure rather than all of it. */
function splitNote(args: BuildLegArgs): string {
  return args.toLocationId === "origin"
    ? " That is a return figure per person, so this crossing carries three-eighths of it — February home is the cheapest month of the year, against a December peak out."
    : " That is a return figure per person, so this crossing carries five-eighths of it — December out is the peak, against the cheapest month of the year coming home.";
}

function priceFlight(args: BuildLegArgs & { id: string }): Priced {
  const { from, to, date, note } = args;
  const key = `${from}-${to}`;
  const snapshot = FARE_SNAPSHOTS[key] ?? FARE_SNAPSHOTS[`${to}-${from}`];
  const onGrid = legIsOnGrid(from, to, date);

  const domestic = AUSTRALIAN.has(from) && AUSTRALIAN.has(to);
  const published = RESEARCH_BANDS[key] ?? RESEARCH_BANDS[`${to}-${from}`];
  const band = published ?? (domestic ? DOMESTIC_BAND : LONGHAUL_RETURN_BAND);
  // Only the long-haul fallback is a return. Every published row is a one-way,
  // and so is the domestic fallback.
  const bandBasis: FareBasis =
    published || domestic ? "one-way" : "return";

  // Each figure is converted by its **own** provenance rather than by the
  // route's: a snapshot and a band can disagree about what they are prices for,
  // and guessing from the route is how the fare home went missing.
  const perCouple = (value: number, basis: FareBasis) =>
    cents((basis === "return" ? value * returnShare(args) : value) * TRAVELLERS);
  const bandEur: [number, number] = [
    perCouple(band[0], bandBasis),
    perCouple(band[1], bandBasis),
  ];

  if (snapshot) {
    return {
      eur: perCouple(snapshot.priceEur, snapshot.basis),
      bandEur,
      pricing: "snapshot",
      onGrid,
      fareBasis: snapshot.basis === "return" ? "return-share" : "one-way",
      carrier: snapshot.carrier,
      note:
        (onGrid
          ? `${note} Fare snapshot standing in until the live fare loads — this route and date are on the fares grid.`
          : `${note} Stored research estimate, ${snapshot.fetchedAt}.`) +
        (snapshot.basis === "return" ? splitNote(args) : ""),
    };
  }

  return {
    eur: bandEur[0],
    bandEur,
    pricing: "band",
    onGrid,
    fareBasis: bandBasis === "return" ? "return-share" : "one-way",
    carrier: null,
    note:
      `${note} No snapshot for this route — priced from the research band, ${domestic ? "domestic-flights.md §2" : "longhaul-comfort.md"}.` +
      (bandBasis === "return" ? splitNote(args) : "") +
      (onGrid ? " The live fare replaces it when it loads." : ""),
  };
}

/**
 * A drive, priced as fuel only.
 *
 * The hire car is already a per-day line on every Day of the block, so charging
 * the rental again here would double-count it. What a drive actually adds over
 * a flight is petrol — and days, which the Scheduler has already spent.
 */
function priceDrive(args: BuildLegArgs): Priced {
  const straight = distanceKm(args.fromLocationId, args.toLocationId);
  if (straight === null) {
    return {
      eur: 0,
      bandEur: [0, 0],
      pricing: "computed",
      onGrid: false,
      fareBasis: "one-way",
      carrier: null,
      note: `${args.note} Driven — no coordinates for one end, so the fuel is not priced.`,
    };
  }

  const km = straight * ROAD_DISTANCE_FACTOR;
  const low = km * FUEL_AUD_PER_KM.band[0] * AUD_TO_EUR;
  const high = km * FUEL_AUD_PER_KM.band[1] * AUD_TO_EUR;
  const drivingDays = Math.max(1, Math.ceil(km / DRIVE_KM_PER_DAY));

  return {
    eur: cents(km * FUEL_AUD_PER_KM.plan * AUD_TO_EUR),
    bandEur: [cents(low), cents(high)],
    pricing: "computed",
    onGrid: false,
    // Petrol for one journey. Nothing about a tank of fuel is a return.
    fareBasis: "one-way",
    carrier: null,
    note: `${args.note} Driven: ~${Math.round(km)} km at A$0.16/km (cost-baselines §2.2), about ${drivingDays} day${drivingDays === 1 ? "" : "s"} behind the wheel. Fuel only — the car is already a daily line.`,
  };
}
