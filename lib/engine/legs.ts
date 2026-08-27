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
 * ## A crossing is one ticket and several sectors
 *
 * Valencia to Perth is not a flight; it is a train and two flights on one
 * Cathay ticket, and the couple has pinned it. Modelling it as a single
 * `VLC → PER` Leg drew a 13,000 km ruler line over the Indian Ocean and hid
 * both connections, which is a map of a journey nobody is taking.
 *
 * So `CROSSINGS` holds the two long journeys as the couple has actually booked
 * them — sector by sector, each with the day it departs and its scheduled block
 * hours — and `deriveLegs` expands them into real Legs. Hong Kong and Singapore
 * become Locations the trip visibly goes through (`lib/engine/locations.ts`),
 * each sector can carry its own metal and comfort later, and the globe draws
 * the chain that is on the ticket.
 *
 * Pricing does **not** follow the sectors, because the fare does not: one fare
 * buys the whole journey. Each sector is priced from the *journey's* provenance
 * — the pinned quote, or the research snapshot, or the band — and carries the
 * share of it its block hours are worth. The sectors therefore always add back
 * up to the figure the journey was quoted at, which is the only property that
 * keeps the roll-up honest.
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
 * ## Which day a Leg is dated on
 *
 * The arrival day, normally: that is the day the couple turns up somewhere and
 * the day the block opens, and it is the date a fare is quoted against.
 *
 * A red-eye breaks that, and `OVERNIGHT_DEPARTURES` is the exception. The
 * ticket, the airport and the whole of the travelling happen the evening
 * before, so the fare is dated on the day the couple *leaves*. On the reference
 * trip that is the difference between buying a Perth→Sydney seat on 26 December
 * and buying one on the 27th, which `docs/research/domestic-flights.md` calls
 * the worst-priced stretch of the Australian year.
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
import {
  EUROPEAN_AIRPORTS,
  ROUTE_GRID,
  STOPOVER_AIRPORTS,
  resolveRoute,
} from "@/lib/flights/grid";
import { addDays } from "@/lib/trip-dates";

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
 * Routes the research says are flown overnight, and the sentence that says why.
 *
 * A Leg on this list is dated on the day the couple **leaves** rather than the
 * day it lands, and the difference is not cosmetic: it decides which calendar
 * day the fare is quoted against.
 *
 * Only Perth→Sydney is on it, and `docs/research/domestic-flights.md` argues
 * for it twice. §"Which day to fly" grades **27–29 Dec** *"worst — named peak
 * days in every dataset. Avoid."* against 26 Dec as *"the best of the realistic
 * options"*, and recommends the Plan default to the 26th outright. §"Red-eyes"
 * then measures the slot: *"PER departures run 00:50 through 23:55; the last
 * service leaves Perth 23:55 and lands Sydney 06:15… worth A$80–150 pp against
 * a mid-morning departure, and it saves a hotel night."*
 *
 * So the couple drives down from Morawa on Boxing Day and flies out of Perth
 * five minutes to midnight. One travelling day carries both journeys, the
 * Sydney block still opens on the 27th — they land at dawn — and the fare is
 * keyed to a date the grid warms and the research says to buy.
 */
const OVERNIGHT_DEPARTURES: Readonly<Record<string, string>> = {
  "PER-SYD":
    "Flown as the 23:55 red-eye, landing 06:15 the next morning, so it is dated the day the couple leaves. domestic-flights.md grades 27–29 Dec the worst-priced days of the Australian year and names 26 Dec as the Plan's default; the red-eye slot is worth another A$80–150 pp and saves a hotel night. Book by 1 Oct 2026.",
};

/**
 * Anything crossing an ocean prices off the long-haul band, not a domestic row.
 *
 * The list lives in the grid rather than here because the grid is where hubs
 * get added: the Flights page's search put ten more European airports on it,
 * and a Frankfurt that this file had never heard of would have been subtracted
 * into `AUSTRALIAN` and priced as a domestic hop.
 */
const EUROPEAN: readonly string[] = EUROPEAN_AIRPORTS;

/**
 * Everything on the grid that is neither Europe nor Australia is subtracted
 * too, and `STOPOVER_AIRPORTS` is that list.
 *
 * Nothing on the grid is a stopover hub today, so this subtracts nothing — and
 * that is exactly why it is here. The set below is "the grid, minus Europe",
 * which was a true definition of *Australian* only for as long as the grid had
 * two continents on it. Now that the crossings route through Hong Kong and
 * Singapore, adding either to the grid without this line would price
 * Madrid → Hong Kong as an Australian domestic hop at €90.
 */
const AUSTRALIAN = new Set<string>(
  ROUTE_GRID.flatMap((entry): string[] => [entry.from, entry.to]).filter(
    (code) => !EUROPEAN.includes(code) && !STOPOVER_AIRPORTS.includes(code),
  ),
);

/* ------------------------------------------------------------------ */
/* The two crossings, as the couple has booked them                    */
/* ------------------------------------------------------------------ */

/**
 * One sector of a crossing: a train ride or a flight, and where it ends.
 *
 * The near end is always the far end of the sector before it, so a crossing is
 * a chain and cannot have a gap in it.
 */
interface CrossingSector {
  /**
   * The Location this sector ends at. `null` means "wherever this crossing's
   * own far end is" — the first place the Plan lands, which the Scheduler
   * decides and this table may not.
   */
  locationId: string | null;
  mode: LegMode;
  /**
   * Scheduled block hours, and the only thing that decides how the journey's
   * one fare is divided. `null` where the sector is bought separately — the
   * feeder trains are not on the airline ticket and carry their own price.
   */
  hours: number | null;
  /** EUR for the couple, `[plan, low, high]`, for a sector bought separately. */
  ownEur: readonly [number, number, number] | null;
  /** Days after the crossing starts that this sector departs. */
  departsOn: number;
  note: string;
}

interface Crossing {
  sectors: readonly CrossingSector[];
  /** The route the one ticket is quoted for — what `priceFlight` prices. */
  journey: { from: string; to: string };
}

/**
 * **Valencia → Madrid → Hong Kong → Perth.** The couple's own booking.
 *
 * `docs/research/longhaul-comfort.md` §"The Value-Comfort Line" is this exact
 * routing: *"Train Valencia → Madrid (1h56, ~25 trains/day)… MAD → HKG daily
 * from 25 October 2026. HKG → PER twice daily, 7h40… A350 on both sectors."*
 * `flight-hubs.md` adds the reason Madrid is the hub rather than Barcelona:
 * one of Cathay's two rotations departs **MAD 22:30**, *"the only long-haul in
 * the grid a same-day 1h56 train can safely feed"*, so there is no hotel night
 * on the European side.
 *
 * Departure days: the train and the 22:30 flight both go on day 0; Hong Kong is
 * reached late on day 1 and left the same evening, so the second flight departs
 * on day 1 and lands in Perth at dawn on day 2. That is the `landsAfter: 2` on
 * `mundaring-arrival`, and it is why the two Days in between are Buffer days at
 * the transit market rather than a hotel anywhere.
 */
const INBOUND: Crossing = {
  journey: { from: "MAD", to: "PER" },
  sectors: [
    {
      locationId: "madrid",
      mode: "train",
      hours: null,
      // flight-hubs.md, the positioning table: "Madrid by train, same day
      // (feeding the 22:30 Cathay) — €16–110 train, no hotel", for the couple.
      ownEur: [16, 16, 110],
      departsOn: 0,
      note: "The feeder. 1h56 and ~25 trains a day, and it is the reason the hub is Madrid: it is the only long-haul in the grid a same-day train can safely feed, so there is no hotel night in Europe. Not on the airline ticket — flight-hubs.md is explicit that a train feed is unprotected, and Iberia on the same oneworld PNR is the €90–240 upgrade that buys the protection.",
    },
    {
      locationId: "hong-kong",
      mode: "flight",
      // ~13h. The published pair is MAD 22:30 and HKG–PER at 7h40, and the
      // couple's own ~25h door-to-door leaves about four hours at Chek Lap Kok.
      hours: 13,
      ownEur: null,
      departsOn: 0,
      note: "Cathay Pacific, MAD 22:30, A350 — daily from 25 October 2026, longhaul-comfort.md §5.",
    },
    {
      locationId: null,
      mode: "flight",
      // CX171 is the A350-900 at 7h40; the couple is on the later rotation of
      // the two dailies, which is what makes Hong Kong a connection and not a
      // night. longhaul-comfort.md §4.
      hours: 7 + 40 / 60,
      ownEur: null,
      departsOn: 1,
      note: "Cathay Pacific HKG→PER, A350-900, 7h40 — a same-ticket connection rather than a stopover, landing in Perth at dawn. No hotel night at either end of the crossing.",
    },
  ],
};

/**
 * **Melbourne → Singapore → Barcelona → Valencia.** The couple's own booking.
 *
 * Singapore Airlines, and the A380 sector out of Melbourne:
 * `longhaul-comfort.md` §"A380s that actually exist" has *"SIN–MEL daily A380,
 * restored, running through late March 2027"*, and §5 has the westbound tag
 * this rides — **SQ388, SIN 23:30 → BCN 06:40+1** — as part of the SIN–BCN–MAD
 * service that opens on 26 October 2026. Barcelona has no flight to Valencia on
 * any carrier (`flight-hubs.md`: *"it is train or bus, unprotected, always"*),
 * so the last two hours home are a train.
 *
 * Every sector departs on the trip's last Day. The couple leaves Melbourne in
 * the morning, leaves Changi at 23:30 and reaches Barcelona the following
 * dawn — which is the day after the Plan ends, so the ledger has no Day for it
 * and the whole crossing is dated the day it starts.
 */
const HOMEWARD: Crossing = {
  journey: { from: "MEL", to: "BCN" },
  sectors: [
    {
      locationId: "singapore",
      mode: "flight",
      hours: 7 + 55 / 60, // SQ's MEL–SIN A380, scheduled 7h55
      ownEur: null,
      departsOn: 0,
      note: "Singapore Airlines, the daily A380 out of Melbourne — the one upper-deck sector on the whole trip, and the reason the return routes through Changi rather than a Gulf hub. longhaul-comfort.md.",
    },
    {
      locationId: "barcelona",
      mode: "flight",
      // SQ388, SIN 23:30 → BCN 06:40+1: 7h10 on the clock across seven hours
      // of time zones.
      hours: 14 + 10 / 60,
      ownEur: null,
      departsOn: 0,
      note: "SQ388, SIN 23:30 → BCN 06:40+1, A350-900 — the Barcelona service Singapore Airlines opens on 26 October 2026. February is the cheapest month of the year out of Australia, which is why this crossing is the smaller half of the ticket.",
    },
    {
      locationId: "origin",
      mode: "train",
      hours: null,
      // flight-hubs.md's positioning table: the Barcelona train is €50–120 for
      // the couple. The hotel night that table pairs with it is an outbound
      // cost — arriving at 06:40 there is nothing to sleep through.
      ownEur: [50, 50, 120],
      departsOn: 0,
      note: "The last two hours. Barcelona has no flight to Valencia on any carrier — train or bus, unprotected, always — so this is a Renfe ticket bought separately and the one unprotected link in the journey home. flight-hubs.md.",
    },
  ],
};

/**
 * Fares the couple has actually pinned: a real quote for a real routing, held
 * rather than modelled.
 *
 * This is a fourth tier above the three at the top of this file, and it outranks
 * all of them — a snapshot is what the research thought the route costs, and
 * this is what the couple was quoted for the itinerary they are booking. It
 * collapses onto itself rather than carrying a band, for the same reason a
 * swapped Event figure does in `ledger.ts`: a decision is not a range.
 *
 * It is deliberately *not* `fareOverrides`. Those are live quotes fetched per
 * tab and thrown away; this is part of the Plan.
 */
interface PinnedFare {
  /** EUR per person, one-way, for the whole journey. */
  priceEur: number;
  carrier: string;
  /** The date the quote is for. Kept for the note, not matched on. */
  quotedFor: string;
}

const PINNED_FARES: Readonly<Record<string, PinnedFare>> = {
  "MAD-PER": {
    priceEur: 872,
    carrier: "Cathay Pacific",
    quotedFor: "14 Dec 2026",
  },
};

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
  const landIndex = Math.max(0, days.indexOf(landed));

  legs.push(
    ...crossingLegs({
      crossing: INBOUND,
      input,
      startDate: days[0].date,
      fromLocationId: "origin",
      endLocationId: landed.locationId,
      // A sector may not be dated past the day the couple lands: a Scenario
      // with no transit Days at all is one where the whole crossing happens on
      // the trip's first Day, whatever the timetable says about it.
      lastOffset: landIndex,
    }),
  );

  for (let index = 1; index < days.length; index += 1) {
    const previous = days[index - 1];
    const day = days[index];
    if (previous.locationId === day.locationId) continue;
    // Arriving where the outbound crossing already said it was going.
    if (previous.locationId === "transit") continue;

    const from = locationById(previous.locationId).airport;
    const to = locationById(day.locationId).airport;
    // A red-eye is bought, flown and paid for the evening before it lands, and
    // `previous` is the Day the couple spends in the place it leaves from.
    const overnight = OVERNIGHT_DEPARTURES[`${from}-${to}`];

    legs.push(
      buildLeg({
        date: overnight ? previous.date : day.date,
        fromLocationId: previous.locationId,
        toLocationId: day.locationId,
        from,
        to,
        input,
        note: overnight
          ? `Relocation — ${previous.locationName} to ${day.locationName}. ${overnight}`
          : `Relocation — ${previous.locationName} to ${day.locationName}.`,
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
    ...crossingLegs({
      crossing: HOMEWARD,
      input,
      startDate: last.date,
      fromLocationId: last.locationId,
      endLocationId: "origin",
      // The trip has no Days left to spread this over: everything after the
      // couple leaves Melbourne happens off the end of the Plan.
      lastOffset: 0,
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
      // So a Day carrying two journeys can draw each one as what it is.
      mode: leg.mode,
    });
    retotal(day);
  }

  return { legs, days };
}

/** "Margaret River", or the IATA code where the end is home rather than a place. */
function legEndName(locationId: string, iata: string): string {
  return locationId === "origin" ? iata : locationById(locationId).name;
}

interface CrossingArgs {
  crossing: Crossing;
  input: LegInput;
  /** The Day the crossing starts from. */
  startDate: string;
  /** The Location it leaves. */
  fromLocationId: string;
  /** Where its last sector ends, which the table writes as `null`. */
  endLocationId: string;
  /** The furthest a sector may be dated past `startDate`. */
  lastOffset: number;
}

/**
 * One booked crossing, expanded into the Legs it is actually flown as.
 *
 * The chain is walked once: each sector leaves where the last one arrived, so
 * there is no way to write a crossing with a gap in it. Every flown sector is
 * priced from the *journey* — one ticket, one provenance — and carries the
 * share of that fare its block hours are worth; a sector with its own price
 * (the feeder trains, which are not on the airline ticket) carries that
 * instead and takes no share.
 */
function crossingLegs(args: CrossingArgs): Leg[] {
  const { crossing, input, startDate, endLocationId, lastOffset } = args;

  const ticketed = crossing.sectors.filter((sector) => sector.hours !== null);
  const blockHours = ticketed.reduce(
    (total, sector) => total + (sector.hours ?? 0),
    0,
  );

  const legs: Leg[] = [];
  let fromLocationId = args.fromLocationId;

  for (const sector of crossing.sectors) {
    const toLocationId = sector.locationId ?? endLocationId;
    const date = addDays(
      startDate,
      Math.min(sector.departsOn, Math.max(0, lastOffset)),
    );

    legs.push(
      buildLeg({
        date,
        fromLocationId,
        toLocationId,
        from: legEndAirport(fromLocationId),
        to: legEndAirport(toLocationId),
        input,
        mode: sector.mode,
        note: sector.note,
        quoted: sector.ownEur ? ownPrice(sector) : undefined,
        share:
          sector.hours !== null && blockHours > 0
            ? { of: crossing.journey, fraction: sector.hours / blockHours }
            : undefined,
      }),
    );

    fromLocationId = toLocationId;
  }

  return legs;
}

/** The gateway a Location is reached through; home is an airport already. */
function legEndAirport(locationId: string): string {
  return locationId === "origin"
    ? ORIGIN_AIRPORT
    : locationById(locationId).airport;
}

/** A sector bought separately, priced at the figure the research gives it. */
function ownPrice(sector: CrossingSector): Priced {
  const [plan, low, high] = sector.ownEur ?? [0, 0, 0];
  return {
    eur: cents(plan),
    bandEur: [cents(low), cents(high)],
    pricing: "band",
    onGrid: false,
    // A ticket for one journey. Nothing about a Renfe seat is a return.
    fareBasis: "one-way",
    carrier: null,
    note: `${sector.note} Bought separately from the airline ticket — flight-hubs.md's positioning table, €${low}–${high} for the couple.`,
  };
}

/** This Leg's slice of a fare quoted for a longer journey. */
interface FareShare {
  /** The route the fare is quoted for. */
  of: { from: string; to: string };
  /** Block hours of this sector over block hours of the whole journey. */
  fraction: number;
}

interface BuildLegArgs {
  date: string;
  fromLocationId: string;
  toLocationId: string;
  from: string;
  to: string;
  input: LegInput;
  note: string;
  /** Set where the itinerary decides the mode rather than the geography. */
  mode?: LegMode;
  /** A figure this Leg carries in its own right, instead of a route's. */
  quoted?: Priced;
  /** Set where this Leg is one sector of a journey bought as a whole. */
  share?: FareShare;
}

function buildLeg(args: BuildLegArgs): Leg {
  const { date, from, to, input } = args;
  const id = `${from}>${to}@${date}`;
  const override = input.legModeOverrides[id];
  // Two places reached through the same airport are a drive, not a flight:
  // nobody flies Perth → Margaret River, and pricing it as a fare would invent
  // several hundred euro out of a three-hour highway run. An island is neither.
  const mode: LegMode =
    override ??
    args.mode ??
    (isIsland(args.fromLocationId) || isIsland(args.toLocationId)
      ? "ferry"
      : from === to
        ? "drive"
        : "flight");

  const priced =
    args.quoted ??
    (mode === "drive"
      ? priceDrive(args)
      : mode === "ferry"
        ? priceFerry(args)
        : priceFlight({ ...args, id }));

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
 * Only the two long crossings are ever priced from a return figure — the
 * research quotes nothing else that way — and the direction reads off the
 * journey the fare is quoted for, not off the sector: every sector of the way
 * home carries a share of the homeward half, whatever its own two ends are.
 */
function returnShare(args: BuildLegArgs): number {
  const heading = args.share?.of.to ?? args.to;
  return AUSTRALIAN.has(heading) ? OUTBOUND_SHARE : 1 - OUTBOUND_SHARE;
}

/** Why a crossing carries part of a figure rather than all of it. */
function splitNote(args: BuildLegArgs): string {
  return returnShare(args) === OUTBOUND_SHARE
    ? " That is a return figure per person, so this crossing carries five-eighths of it — December out is the peak, against the cheapest month of the year coming home."
    : " That is a return figure per person, so this crossing carries three-eighths of it — February home is the cheapest month of the year, against a December peak out.";
}

/** Why a sector carries part of the crossing rather than all of it. */
function sectorNote(share: FareShare): string {
  return ` One ticket, ${share.of.from}–${share.of.to}, split across its sectors by scheduled block hours — this one is ${Math.round(share.fraction * 100)}% of the time in the air.`;
}

function priceFlight(args: BuildLegArgs & { id: string }): Priced {
  const { date, note, share } = args;
  // A sector is priced from the journey it belongs to, because that is what the
  // fare was quoted for. Only `onGrid` stays a question about the sector: it
  // asks whether `/api/fares` can price *this* pair, and it cannot price a
  // connection out of a through-fare.
  const from = share?.of.from ?? args.from;
  const to = share?.of.to ?? args.to;
  const fraction = share?.fraction ?? 1;

  const key = `${from}-${to}`;
  const pinned = PINNED_FARES[key] ?? PINNED_FARES[`${to}-${from}`];
  const snapshot = FARE_SNAPSHOTS[key] ?? FARE_SNAPSHOTS[`${to}-${from}`];
  const onGrid = legIsOnGrid(args.from, args.to, date);

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
    cents(
      (basis === "return" ? value * returnShare(args) : value) *
        TRAVELLERS *
        fraction,
    );
  const bandEur: [number, number] = [
    perCouple(band[0], bandBasis),
    perCouple(band[1], bandBasis),
  ];

  // A pinned quote outranks everything: it is what the couple was actually
  // offered for the itinerary they are booking, and it collapses onto itself
  // rather than carrying a band — a decision is not a range.
  if (pinned) {
    const eur = perCouple(pinned.priceEur, "one-way");
    return {
      eur,
      bandEur: [eur, eur],
      pricing: "pinned",
      onGrid,
      fareBasis: "one-way",
      carrier: pinned.carrier,
      note:
        `${note} Pinned fare: €${pinned.priceEur} per person one-way on ${pinned.carrier}, quoted for ${pinned.quotedFor} — the couple's own quote, not a modelled band.` +
        (share ? sectorNote(share) : ""),
    };
  }

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
        (snapshot.basis === "return" ? splitNote(args) : "") +
        (share ? sectorNote(share) : ""),
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
      (share ? sectorNote(share) : "") +
      (onGrid ? " The live fare replaces it when it loads." : ""),
  };
}

/**
 * Places you cannot drive to, however much the airport codes agree.
 *
 * Rottnest shares Perth's gateway with Margaret River and Morawa, and
 * `from === to` therefore read every hop on or off it as a road journey: the
 * Ledger showed *"Rottnest Island → Perth, Drive, fuel, €4"*, which is a
 * sentence about a road that is nine nautical miles of Indian Ocean
 * (kilbot/holidays#101). An island is a ferry whatever its gateway says.
 */
const ISLANDS = new Set<string>(["rottnest"]);

const isIsland = (locationId: string) => ISLANDS.has(locationId);

/**
 * What the crossing to Rottnest costs, AUD for the couple.
 *
 * `docs/research/capsule-wa-southwest.md` picks SeaLink out of Fremantle —
 * *"cheapest fare, shortest crossing"* — at **A$56–57 per adult, same-day
 * return, admission included**, and its own cost table carries the couple's
 * line: *"Ferry ex-Fremantle, SeaLink same-day return incl. admission ×2 @
 * A$57 = 114"*, band A$100–260 (Rottnest Express A$171, ex-Perth A$259).
 *
 * The Rottnest Island Authority landing fee is inside that figure: SeaLink
 * quotes fares inclusive, which is part of why it is the pick.
 */
const ROTTNEST_FERRY_AUD: readonly [number, number, number] = [114, 100, 260];

/**
 * One ticket, two crossings, so each carries half.
 *
 * The same provenance rule as the ocean crossings, applied to a A$114 boat: a
 * same-day return buys the sailing out *and* the sailing back, and charging it
 * whole to the hop that reaches the island would double the ferry the moment
 * the hop off it was priced too.
 */
const FERRY_CROSSINGS = 2;

/**
 * The ferry, priced as the ticket rather than as petrol.
 *
 * No fuel line: the drive to Fremantle is made in the family's car, which is
 * already a daily line, and the island is car-free. What this Leg costs is the
 * boat — a bookable, sells-out-early item the research says to buy *"weeks
 * ahead, mid-week, on the earliest sailing"*.
 */
function priceFerry(args: BuildLegArgs): Priced {
  const [plan, low, high] = ROTTNEST_FERRY_AUD;
  const share = (value: number) => cents((value / FERRY_CROSSINGS) * AUD_TO_EUR);

  return {
    eur: share(plan),
    bandEur: [share(low), share(high)],
    pricing: "snapshot",
    onGrid: false,
    // Half of a same-day return, which is what a ticket to an island is.
    fareBasis: "return-share",
    carrier: "SeaLink",
    note: `${args.note} SeaLink out of Fremantle, ~25 minutes: A$${plan} for the couple, same-day return with the island admission fee inside it (capsule-wa-southwest.md). One ticket buys both crossings, so this half of the day carries half of it. No fuel — the island is car-free and the run to the terminal is in the family's car. Book weeks ahead; summer sailings sell out.`,
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
