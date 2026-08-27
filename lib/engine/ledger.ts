/**
 * The Day ledger — the cost model's whole structure.
 *
 * #10, resolved: *"a day-by-day ledger — every Day priced individually
 * (lodging night + activities/Event spend + transport); Capsules place line
 * items onto Days; peak multipliers hit only the nights they cover; averages
 * are derived display stats, never pricing."*
 *
 * So: this module walks the trip range one calendar day at a time and hands
 * each Day its own lines. There is no per-stay rate anywhere in it and no
 * multiplication by a stay length. Making a Sydney block three days longer adds
 * three Days at whatever those three specific dates cost — which, across
 * 1 January, is a very different number in each direction.
 *
 * What a Day gets:
 *
 * - **lodging** — one night at the block's tier, in the Location's market,
 *   times whichever peak rule covers that date. Zero at a Home base.
 * - **food** and **local** — the same, plus the public-holiday surcharge on
 *   the four dates that carry one.
 * - **car** — one day held, when the block is carrying a paid car.
 * - **event** — the Capsule's own marquee spend, on the day it happens.
 * - **transport** — a Leg's fare, landed on the day it is travelled. Added by
 *   `legs.ts` afterwards, so the Day totals stay the only source of truth.
 *
 * Lodging, food and local transport are marked `living`, and only those three
 * count against the A$500 Daily cap: docs/CONTEXT.md defines the cap as
 * "lodging + food + local transport" and Event spend as the thing the thrift on
 * those lines pays for. A reef day is not a cap breach.
 */

import {
  DEFAULT_LODGING_TIER,
  MARKETS,
  PUBLIC_HOLIDAYS,
  PUBLIC_HOLIDAY_SURCHARGE,
  lodgingRate,
  peakFor,
  type LodgingTier,
  type Rate,
} from "@/lib/engine/constants";
import { locationById } from "@/lib/engine/locations";
import type {
  CapsuleEvent,
  CapsuleSpec,
  Day,
  DayLine,
  Lock,
  Placement,
} from "@/lib/engine/types";
import {
  addDays,
  anchorOn,
  daysBetween,
  formatDay,
  formatSpan,
} from "@/lib/trip-dates";

/** Money is rounded to cents at the line, so a total never drifts on floats. */
export function cents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Multiply a plan-on figure and its band by another plan-on figure and band. */
function scale(base: Rate, factor: Rate): Rate {
  return {
    plan: base.plan * factor.plan,
    band: [base.band[0] * factor.band[0], base.band[1] * factor.band[1]],
  };
}

/** AUD rate → a priced line at the Plan's FX rate. */
function line(
  id: string,
  kind: DayLine["kind"],
  label: string,
  aud: Rate,
  fx: number,
  living: boolean,
  note: string,
): DayLine {
  return {
    id,
    kind,
    label,
    aud: cents(aud.plan),
    eur: cents(aud.plan * fx),
    bandEur: [cents(aud.band[0] * fx), cents(aud.band[1] * fx)],
    living,
    note,
  };
}

/** Recompute a Day's three totals from its lines. Call after any line change. */
export function retotal(day: Day): Day {
  let total = 0;
  let living = 0;
  let low = 0;
  let high = 0;
  for (const item of day.lines) {
    total += item.eur;
    if (item.living) living += item.eur;
    low += item.bandEur[0];
    high += item.bandEur[1];
  }
  day.totalEur = cents(total);
  day.livingEur = cents(living);
  day.bandEur = [cents(low), cents(high)];
  return day;
}

export interface LedgerInput {
  startDate: string;
  endDate: string;
  placements: readonly Placement[];
  capsules: ReadonlyMap<string, CapsuleSpec>;
  lodgingTiers: Readonly<Record<string, LodgingTier>>;
  carOverrides: Readonly<Record<string, boolean>>;
  /** Event id → off, or a different AUD figure. See `PlanInput`. */
  eventOverrides?: Readonly<Record<string, boolean | number>>;
  fxRate: number;
}

/**
 * Which day of its block an Event lands on, or `null` for "not on this Plan".
 *
 * Two kinds of Event, and the difference is the whole point of `date`:
 *
 * - **Offset Events** ride with the block. The reef day is the second day of
 *   the reef Adventure wherever the reef Adventure is dragged to.
 * - **Date-locked Events** do not move, because the world has already decided
 *   when they are. They land on their own date if the block covers it, and if
 *   the block does not cover it they do not happen — see `CapsuleEvent.date`.
 */
export function eventOffset(
  event: CapsuleEvent,
  placement: Placement,
): number | null {
  if (!event.date) {
    return event.dayOffset >= 0 && event.dayOffset < placement.days
      ? event.dayOffset
      : null;
  }
  if (event.date < placement.startDate || event.date > placement.endDate) {
    return null;
  }
  return daysBetween(placement.startDate, event.date) - 1;
}

/**
 * The trip range, materialised as priced Days.
 *
 * Days a Capsule owns take that Capsule's Location and lines. Every other Day
 * is a **Buffer day** — deliberately unscheduled, and priced, because
 * docs/CONTEXT.md is explicit that Buffers still cost money (and #10 restated
 * it: a plan with honest buffers costs more nights than a packed one, and the
 * model must show that rather than rewarding jam-packing).
 *
 * A Buffer day inherits the Location of the block before it, because that is
 * where the couple physically is. Buffer days before anything is placed sit at
 * `transit` — the trip has started but has not landed.
 */
export function buildLedger(input: LedgerInput): Day[] {
  const { startDate, endDate, placements, capsules, fxRate } = input;
  const dayCount = daysBetween(startDate, endDate);

  // Capsule ownership, resolved once. A later placement wins a contested Day so
  // that an overlap reads as "the thing you dragged here", not a silent tie.
  const owner = new Map<string, { placement: Placement; offset: number }>();
  for (const placement of placements) {
    for (let offset = 0; offset < placement.days; offset += 1) {
      const date = addDays(placement.startDate, offset);
      if (date < startDate || date > endDate) continue;
      owner.set(date, { placement, offset });
    }
  }

  const days: Day[] = [];
  let lastLocationId = "transit";

  for (let index = 0; index < dayCount; index += 1) {
    const date = addDays(startDate, index);
    const held = owner.get(date);
    const capsule = held ? capsules.get(held.placement.capsuleId) : undefined;

    const locationId = capsule ? capsule.locationId : lastLocationId;
    const location = locationById(locationId);
    // A Buffer day after a day trip is spent back at the base — `returnsTo` is
    // where the last ferry goes.
    lastLocationId = location.returnsTo ?? locationId;

    const market = MARKETS[location.market];
    // The tier is keyed by **Capsule id on an Adventure day and Location id on
    // a Buffer day** — camping the Byron block and camping the sixteen Byron
    // Buffer nights are two different decisions, and a Scenario says both.
    const tierKey = capsule ? capsule.id : locationId;
    const asked: LodgingTier =
      input.lodgingTiers[tierKey] ?? DEFAULT_LODGING_TIER;
    const { tier, rate: tierRate } = lodgingRate(location.market, asked);
    const peak = peakFor(date, location.market);
    const holiday = PUBLIC_HOLIDAYS.includes(date);
    const surcharge = holiday
      ? PUBLIC_HOLIDAY_SURCHARGE
      : { plan: 1, band: [1, 1] as [number, number] };

    const lines: DayLine[] = [];

    if (!location.homeBase) {
      const lodging = scale(tierRate, peak.lodging);
      const source =
        tier === "camp" ? CAMP_SOURCE : "cost-floors-recalibrated.md §2";
      lines.push(
        line(
          `${date}:lodging`,
          "lodging",
          `${TIER_LABEL[tier]}, ${location.name}`,
          lodging,
          fxRate,
          true,
          peak.id === "none"
            ? `${market.label} ${TIER_LABEL[tier]} rate, ${source}.`
            : `${market.label} ${TIER_LABEL[tier]} rate ×${peak.lodging.plan} — ${peak.label}. ${peak.note}`,
        ),
      );
    } else {
      lines.push(
        line(
          `${date}:lodging`,
          "lodging",
          `${location.name} — home base`,
          { plan: 0, band: [0, 0] },
          fxRate,
          true,
          "Free lodging and a borrowed car. The single biggest lever in the Plan: cost-baselines §4 puts every day moved from the east coast to a Home base at about A$500 saved.",
        ),
      );
    }

    lines.push(
      line(
        `${date}:food`,
        "food",
        "Food & drink",
        scale(scale(market.food, peak.food), surcharge),
        fxRate,
        true,
        [
          `Groceries-first basket, cost-baselines §${location.homeBase ? "2.1" : "3.3"}.`,
          market.foodNote,
          holiday
            ? `Plus the ${Math.round((PUBLIC_HOLIDAY_SURCHARGE.plan - 1) * 100)}% public-holiday surcharge Australian venues charge on this date.`
            : null,
        ]
          .filter(Boolean)
          .join(" "),
      ),
    );

    lines.push(
      line(
        `${date}:local`,
        "local",
        location.homeBase ? "Fuel, borrowed car" : "Local transport",
        market.local,
        fxRate,
        true,
        location.homeBase
          ? "Fuel is not free even when the car is: A$0.16/km in Perth, cost-baselines §2.2."
          : "Transit fares for two, cost-baselines §3.3.",
      ),
    );

    lines.push(
      line(
        `${date}:activities`,
        "activities",
        "Day-to-day activities",
        scale(market.activities, surcharge),
        fxRate,
        false,
        "Walks, beaches, free galleries, the occasional entry. Marquee spend is its own line — cost-baselines §3.4 is explicit that folding a reef day into a per-day average distorts it.",
      ),
    );

    const carOn = capsule
      ? (input.carOverrides[capsule.id] ?? capsule.needsCar)
      : false;
    if (carOn && market.car.plan > 0) {
      lines.push(
        line(
          `${date}:car`,
          "car",
          "Hire car, per day held",
          scale(market.car, peak.car),
          fxRate,
          false,
          "Bare base rate at the cheapest credible operator — excess reduction deliberately excluded, per the pricing rule on #10. The band's top is the all-in figure if the card's excess cover does not stand up.",
        ),
      );
    }

    if (capsule && held) {
      for (const event of capsule.events) {
        const override = input.eventOverrides?.[event.id];
        // Switched off on this Scenario: the line is not here, and the
        // Scenario comparison is where the reader sees what that bought.
        if (override === false) continue;
        if (eventOffset(event, held.placement) !== held.offset) continue;

        const swapped = typeof override === "number";
        // A swapped figure is a decision, not a research band: it collapses
        // onto itself rather than inheriting the spread of the line it
        // replaced. A A$51 ferry does not carry a A$380 cruise's worst case.
        const aud: Rate = swapped
          ? { plan: override, band: [override, override] }
          : event.aud;

        lines.push(
          line(
            `${date}:${event.id}`,
            "event",
            event.label,
            aud,
            fxRate,
            false,
            swapped
              ? `${event.source} — swapped to A$${override} on this Scenario.`
              : event.source,
          ),
        );
      }
    }

    const day: Day = {
      date,
      index,
      locationId,
      locationName: location.name,
      market: location.market,
      homeBase: location.homeBase,
      buffer: !capsule,
      capsuleId: capsule?.id ?? null,
      capsuleName: capsule?.name ?? null,
      capsuleDay: held ? held.offset + 1 : null,
      lodgingTier: tier,
      lines,
      totalEur: 0,
      livingEur: 0,
      bandEur: [0, 0],
      peakId: peak.id === "none" ? null : peak.id,
      peakLabel: peak.id === "none" ? null : peak.label,
      peakNote: peak.id === "none" ? null : peak.note,
    };

    days.push(retotal(day));
  }

  return days;
}

const TIER_LABEL: Record<LodgingTier, string> = {
  hostel: "hostel twin",
  camp: "powered site",
  airbnb: "cheap Airbnb",
  hotel: "hotel",
};

/**
 * What a camping night costs, and the dependency it carries.
 *
 * The gear caveat is in the line's own note rather than a footnote somewhere
 * else, because it is the thing that decides whether the rung is available at
 * all: the WA blocks use the family's gear and the borrowed car, and every
 * east-coast camping night needs gear flown in or hired.
 */
const CAMP_SOURCE =
  "cost-floors-recalibrated.md §3.1 — a powered caravan-park site for two. Needs gear: WA borrows the family's, and every east-coast night needs it flown in (~€30–60 a Leg in checked bags) or hired. Nothing in a caravan park is quiet at Christmas–January; the tier buys money, not calm";

export { TIER_LABEL };

/**
 * A Lock, in words a stranger can read.
 *
 * The chip is the shortest true phrase; the sentence is the whole claim with
 * the research's own reason on the end. Both are here rather than in a
 * component because three surfaces say the same thing — the Ledger's place
 * bands, the week zoom's Capsule bands, and the day drill-in — and a constraint
 * that is worded differently in three places is three constraints to a reader.
 *
 * The chips used to read "window-lock" and "date-lock", which are this
 * codebase's words for it and nobody else's. An active constraint is the one
 * thing on the page that may never hide behind jargon: information hides,
 * constraints do not.
 */
export function describeLock(
  lock: Lock,
): { chip: string; sentence: string } | null {
  switch (lock.kind) {
    case "flexible":
      return null;
    case "window":
      return {
        chip: `best ${formatSpan(lock.from, lock.to)}`,
        sentence: `Best between ${formatDay(lock.from)} and ${formatDay(lock.to)} — ${lock.why}`,
      };
    case "date":
      return {
        chip: `fixed ${formatSpan(lock.from, lock.to)}`,
        sentence: `Has to cover ${formatSpan(lock.from, lock.to)} — ${lock.why}`,
      };
    case "weekday":
      return {
        chip: "certain days only",
        sentence: `Only runs on certain days — ${lock.why}`,
      };
  }
}

/** What a Day is for, in the few words a 90px column holds. */
export function dayHeadline(day: Day): string {
  const anchor = anchorOn(day.date);
  if (anchor) return anchor.label;
  const event = day.lines.find((item) => item.kind === "event");
  if (event) return event.label;
  if (day.buffer) return "Buffer";
  return day.capsuleName ?? day.locationName;
}
