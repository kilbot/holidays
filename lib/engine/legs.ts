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
 * ## Pricing, in four tiers
 *
 * 1. **`grid`** — `lib/flights/grid.ts` covers this route on this date, so
 *    `/api/fares` has a real answer. The figure here is the stored snapshot,
 *    standing in until the client hydrates the live fare through
 *    `fareOverrides`. A placeholder that is labelled is honest; a blank is not.
 * 2. **`snapshot`** — a stored research estimate for the route, with no live
 *    path for this date.
 * 3. **`band`** — no snapshot at all, so the research's own band for that kind
 *    of journey (`docs/research/domestic-flights.md` §2).
 * 4. **`computed`** — a drive. Distance × fuel, from cost-baselines §2.2. The
 *    car itself is already a Day line, so the Leg only carries the fuel.
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
import type { Day, Leg, LegMode } from "@/lib/engine/types";
import { FARE_SNAPSHOTS } from "@/lib/flights/snapshots";
import { ROUTE_GRID } from "@/lib/flights/grid";

/**
 * Research bands for routes the snapshots do not carry, EUR **per person**,
 * one-way. `docs/research/domestic-flights.md` §2 "Typical €" column, with the
 * long-hauls from `longhaul-comfort.md` §Price bands (comfort-first, which is
 * the stated criterion for the crossings — not cheapest).
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
  LONGHAUL: [1_500, 2_300], // longhaul-comfort.md, premium-comfort band
};

/** Anything crossing an ocean prices off the long-haul band, not a domestic row. */
const EUROPEAN: readonly string[] = ["VLC", "BCN", "MAD", "MXP"];

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

  const first = days[0];
  legs.push(
    buildLeg({
      date: first.date,
      fromLocationId: "origin",
      toLocationId: first.locationId,
      from: ORIGIN_AIRPORT,
      to: locationById(first.locationId).airport,
      input,
      note: "The outbound crossing. Comfort-first, not cheapest — docs/CONTEXT.md names aircraft type, layover quality and an overnight stopover as the criteria.",
    }),
  );

  for (let index = 1; index < days.length; index += 1) {
    const previous = days[index - 1];
    const day = days[index];
    if (previous.locationId === day.locationId) continue;

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

  const last = days[days.length - 1];
  legs.push(
    buildLeg({
      date: last.date,
      fromLocationId: last.locationId,
      toLocationId: "origin",
      from: locationById(last.locationId).airport,
      to: ORIGIN_AIRPORT,
      input,
      note: "The homeward crossing.",
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
      label: `${leg.from} → ${leg.to}${leg.mode === "flight" ? "" : ` by ${leg.mode}`}`,
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
  const mode: LegMode = override ?? "flight";

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
    hydrated,
    carrier: priced.carrier,
    note: hydrated ? `${priced.note} Live fare from /api/fares.` : priced.note,
  };
}

interface Priced {
  eur: number;
  bandEur: [number, number];
  pricing: Leg["pricing"];
  carrier: string | null;
  note: string;
}

/** Whether `/api/fares` can answer for this route on this date at all. */
export function legIsOnGrid(from: string, to: string, date: string): boolean {
  return ROUTE_GRID.some(
    (entry) =>
      entry.from === from &&
      entry.to === to &&
      entry.dates.some((gridDate) => gridDate === date),
  );
}

function priceFlight(args: BuildLegArgs & { id: string }): Priced {
  const { from, to, date, note } = args;
  const key = `${from}-${to}`;
  const snapshot = FARE_SNAPSHOTS[key] ?? FARE_SNAPSHOTS[`${to}-${from}`];
  const onGrid = legIsOnGrid(from, to, date);

  const domestic = AUSTRALIAN.has(from) && AUSTRALIAN.has(to);
  const band =
    RESEARCH_BANDS[key] ??
    RESEARCH_BANDS[`${to}-${from}`] ??
    (domestic ? [90, 200] : RESEARCH_BANDS.LONGHAUL);

  if (snapshot) {
    const perPerson = snapshot.priceEur;
    return {
      eur: cents(perPerson * TRAVELLERS),
      bandEur: [cents(band[0] * TRAVELLERS), cents(band[1] * TRAVELLERS)],
      pricing: onGrid ? "grid" : "snapshot",
      carrier: snapshot.carrier,
      note: onGrid
        ? `${note} Fare snapshot standing in until the live fare loads — this route and date are on the fares grid.`
        : `${note} Stored research estimate, ${snapshot.fetchedAt}.`,
    };
  }

  return {
    eur: cents(band[0] * TRAVELLERS),
    bandEur: [cents(band[0] * TRAVELLERS), cents(band[1] * TRAVELLERS)],
    pricing: "band",
    carrier: null,
    note: `${note} No snapshot for this route — priced from the research band, ${domestic ? "domestic-flights.md §2" : "longhaul-comfort.md"}.`,
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
    carrier: null,
    note: `${args.note} Driven: ~${Math.round(km)} km at A$0.16/km (cost-baselines §2.2), about ${drivingDays} day${drivingDays === 1 ? "" : "s"} behind the wheel. Fuel only — the car is already a daily line.`,
  };
}
