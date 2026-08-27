/**
 * The demo Plan, re-derived from whatever dates the strip is set to.
 *
 * This is **not** the Scheduler (docs/CONTEXT.md) and it is not the itinerary
 * engine — #25 owns that, and #25 is blocked on the cost model. What lives here
 * is the smallest thing that makes the strip honest while the dates move: a
 * fixed sequence of blocks with baseline lengths and baseline costs, stretched
 * or squeezed to fit the range the handles are set to.
 *
 * The reference trip is the "Fireworks NYE" Scenario the prototype showed:
 * 12 Dec 2026 → 22 Feb 2027, 73 days, €14,280. At those dates every number
 * below is the baseline verbatim; away from them, every money figure is demo
 * math and the strip says so out loud.
 */

import { DEMO_PLAN } from "@/lib/demo-plan";
import {
  ANCHORS,
  addDays,
  anchorOn,
  daysBetween,
  formatSpan,
  type Anchor,
} from "@/lib/trip-dates";
import type { WeatherLocationId } from "@/lib/weather";

export const DEFAULT_TRIP_START = "2026-12-12";
export const DEFAULT_TRIP_END = "2027-02-22";

/**
 * The Daily cap in EUR — A$500 per couple (docs/CONTEXT.md) at the research's
 * own A$1 = €0.61. A ceiling on a paid day's living costs, not a target; a Day
 * above it gets a warning, never a refusal.
 */
export const DAILY_CAP_EUR = Math.round(500 * 0.61);

/** One block of the trip: a place, for a while, at a price. */
export interface PlanSegment {
  id: string;
  place: string;
  /** Why the block costs what it costs. */
  detail: string;
  /** Length at the reference trip, in days. The ten sum to 73. */
  nominalDays: number;
  /** Cost at the reference trip, EUR per couple. The ten sum to €14,280. */
  costEur: number;
  /**
   * The part of `costEur` that does not care how long you stay: a long-haul
   * fare, a festival ticket, a reef boat day. Only the remainder is nightly,
   * so a longer block adds nights rather than re-buying the flight.
   */
  fixedEur: number;
  /** Which normals the weather ribbon reads. Null while in transit. */
  weather: WeatherLocationId | null;
  /** Region prefixes the events layer filters on for this block. */
  regions: string[];
  /** Deliberately unscheduled — a Buffer block, not leftover slack. */
  buffer?: boolean;
  /** Home base: free lodging and a borrowed car. */
  homeBase?: boolean;
}

/**
 * The ten blocks, in order.
 *
 * Costs are the shell's own week figures, normalised: as placeholders they
 * summed to €16,180 against a €14,280 Plan total, which made the strip
 * contradict the cost HUD standing right above it. They are scaled by
 * 14,280/16,180 and rounded to €10, so the strip's arithmetic now closes.
 * The `fixedEur` split is a reading of each block's research — the Changi Line
 * is almost entirely fare, the Buffer is almost entirely nights.
 */
export const PLAN_SEGMENTS: PlanSegment[] = [
  {
    id: "changi-line",
    place: "The Changi Line",
    detail: "VLC → BCN → SIN → PER",
    nominalDays: 7,
    costEur: 3_360,
    fixedEur: 3_200,
    weather: null,
    regions: [],
  },
  {
    id: "perth-family",
    place: "Perth · family",
    detail: "Home base — free lodging, borrowed car",
    nominalDays: 7,
    costEur: 260,
    fixedEur: 0,
    weather: "perth",
    regions: ["WA"],
    homeBase: true,
  },
  {
    id: "south-west",
    place: "Margaret River + Rotto",
    detail: "Christmas anchor, then the south-west loop",
    nominalDays: 5,
    costEur: 1_410,
    fixedEur: 520,
    weather: "margaret_river",
    regions: ["WA"],
  },
  {
    id: "sydney-nye",
    place: "Sydney NYE",
    detail: "Opera House Forecourt · lodging ×2.6",
    nominalDays: 4,
    costEur: 1_890,
    fixedEur: 700,
    weather: "sydney",
    regions: ["NSW"],
  },
  {
    id: "sydney-blue-mts",
    place: "Sydney + Blue Mts",
    detail: "The cheap side of 1 Jan",
    nominalDays: 7,
    costEur: 790,
    fixedEur: 90,
    weather: "sydney",
    regions: ["NSW"],
  },
  {
    id: "buffer",
    place: "Buffer",
    detail: "Unbooked — stay longer or move early",
    nominalDays: 7,
    costEur: 420,
    fixedEur: 0,
    weather: "sydney",
    regions: ["NSW"],
    buffer: true,
  },
  {
    id: "port-douglas",
    place: "Port Douglas reef",
    detail: "Window opens — off-peak fares, no school holidays",
    nominalDays: 9,
    costEur: 1_770,
    fixedEur: 780,
    weather: "port_douglas",
    regions: ["QLD"],
  },
  {
    id: "byron-nimbin",
    place: "Byron + Nimbin",
    detail: "Post-holiday prices, Nimbin day trip",
    nominalDays: 8,
    costEur: 940,
    fixedEur: 140,
    weather: "byron_bay",
    regions: ["NSW-Northern-Rivers"],
  },
  {
    id: "tasmania",
    place: "Tasmania · PITP",
    detail: "Party In The Paddock, then the south–north arc",
    nominalDays: 14,
    costEur: 2_120,
    fixedEur: 720,
    weather: "hobart",
    regions: ["TAS"],
  },
  {
    id: "melbourne-home",
    place: "Melbourne, then home",
    detail: "Laneway Fri · St Kilda Fest · MEL → VLC",
    nominalDays: 5,
    costEur: 1_320,
    fixedEur: 1_060,
    weather: "melbourne",
    regions: ["VIC"],
  },
];

/** 73 days — the reference trip every scaled figure is quoted against. */
export const BASELINE_DAYS = PLAN_SEGMENTS.reduce(
  (total, segment) => total + segment.nominalDays,
  0,
);

/* ------------------------------------------------------------------ */
/* Demo math                                                           */
/* ------------------------------------------------------------------ */

/**
 * DEMO MATH — the whole cost model of this ticket lives in this function.
 *
 * Re-pricing a block of the trip that got longer or shorter:
 *
 *     nightly  = (costEur − fixedEur) / nominalDays
 *     repriced = fixedEur + nightly × days
 *
 * That is all. Nights scale, one-off buys do not. What it deliberately does
 * NOT do is anything the real cost model will: no fare curve (a December
 * PER→SYD seat is not a linear function of the date), no NYE multiplier that
 * follows the block when it moves off 31 Dec, no lodging tier, no Daily cap.
 * #25 replaces this with the real thing once the cost model lands. Until then
 * every number derived from it is labelled "demo math" in the UI, because a
 * confident wrong price is worse than an obvious placeholder.
 */
export function repriceSegment(segment: PlanSegment, days: number): number {
  const nightly = (segment.costEur - segment.fixedEur) / segment.nominalDays;
  return segment.fixedEur + nightly * days;
}

/**
 * Split the trip's days across the blocks, keeping their proportions.
 *
 * Largest-remainder, so the day counts always add up to exactly the trip
 * length instead of drifting by a day or two of rounding. A block whose share
 * rounds below one day drops out of the Plan — the strip reports that as a
 * warning rather than silently pretending Tasmania fits into a fortnight.
 */
function allocateDays(totalDays: number): number[] {
  const scale = totalDays / BASELINE_DAYS;
  const exact = PLAN_SEGMENTS.map((segment) => segment.nominalDays * scale);
  const days = exact.map(Math.floor);

  let remaining = totalDays - days.reduce((total, value) => total + value, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (const { index } of byRemainder) {
    if (remaining <= 0) break;
    days[index] += 1;
    remaining -= 1;
  }
  return days;
}

/* ------------------------------------------------------------------ */
/* Derived plan                                                        */
/* ------------------------------------------------------------------ */

export interface PlanDay {
  date: string;
  segment: PlanSegment;
  /** Demo math. Nightly rate, plus this block's one-off buys if it owns them. */
  costEur: number;
  anchor?: Anchor;
}

export interface PlanWeek {
  id: string;
  startDate: string;
  endDate: string;
  /** "12–18 Dec". */
  label: string;
  days: PlanDay[];
  /** The block holding most of the week. */
  lead: PlanSegment;
  /** Set where the week straddles blocks: "then Sydney NYE". */
  handover: string | null;
  costEur: number;
  anchors: Anchor[];
}

/**
 * The week as the events layer wants it: each day, and where that day is.
 *
 * Deliberately per-day rather than a set of regions for the week — a week that
 * flies from Perth to Sydney is in two places, and only its days know which is
 * which.
 */
export function eventDaysOf(week: PlanWeek) {
  return week.days.map((day) => ({
    date: day.date,
    regions: day.segment.regions,
  }));
}

export interface DerivedPlan {
  startDate: string;
  endDate: string;
  dayCount: number;
  /** Nights at a Home base — the ones that cost nothing. */
  freeLodgingNights: number;
  /** Demo math: the re-estimated Plan total. €14,280 at the reference trip. */
  totalEur: number;
  /** How far the total has moved from the €14,280 baseline. */
  deltaEur: number;
  days: PlanDay[];
  weeks: PlanWeek[];
  /** Blocks the trip is now too short to hold. */
  droppedSegments: PlanSegment[];
  /** Anchors the range no longer covers. Informs; never blocks. */
  missedAnchors: Anchor[];
  /** True while the dates are the reference trip's, where nothing is scaled. */
  atBaseline: boolean;
}

export function derivePlan(startDate: string, endDate: string): DerivedPlan {
  const dayCount = daysBetween(startDate, endDate);
  const allocation = allocateDays(dayCount);

  const days: PlanDay[] = [];
  const droppedSegments: PlanSegment[] = [];
  let cursor = 0;

  PLAN_SEGMENTS.forEach((segment, index) => {
    const length = allocation[index];
    if (length === 0) {
      droppedSegments.push(segment);
      return;
    }

    const repriced = repriceSegment(segment, length);
    const nightly = (repriced - segment.fixedEur) / length;

    // The one-off buys land on a single Day rather than being smeared across
    // the block: a Day is priced individually (docs/CONTEXT.md), and the whole
    // point of the day zoom is that one Day can cost €1,000 and the next €30.
    // They land on the block's anchor day where it has one — 31 Dec is when
    // the NYE money is actually spent — otherwise on its first day.
    const dates = Array.from({ length }, (_, offset) =>
      addDays(startDate, cursor + offset),
    );
    const anchorDate = dates.find((date) => anchorOn(date));
    const lumpDate = anchorDate ?? dates[0];

    for (const date of dates) {
      days.push({
        date,
        segment,
        costEur: nightly + (date === lumpDate ? segment.fixedEur : 0),
        anchor: anchorOn(date),
      });
    }
    cursor += length;
  });

  const totalEur = days.reduce((total, day) => total + day.costEur, 0);
  const freeLodgingNights = days.filter((day) => day.segment.homeBase).length;

  return {
    startDate,
    endDate,
    dayCount,
    freeLodgingNights,
    totalEur: Math.round(totalEur),
    deltaEur: Math.round(totalEur) - DEMO_PLAN.totalEur,
    days,
    weeks: intoWeeks(days),
    droppedSegments,
    missedAnchors: ANCHORS.filter(
      (anchor) => anchor.date < startDate || anchor.date > endDate,
    ),
    atBaseline:
      startDate === DEFAULT_TRIP_START && endDate === DEFAULT_TRIP_END,
  };
}

/**
 * Seven-day cells counted from the leaving date, not from Mondays. The strip
 * is a trip, not a wall calendar: week one is the first seven days away.
 */
function intoWeeks(days: PlanDay[]): PlanWeek[] {
  const weeks: PlanWeek[] = [];

  for (let start = 0; start < days.length; start += 7) {
    const slice = days.slice(start, start + 7);
    const lead = dominantSegment(slice);
    const others = slice
      .map((day) => day.segment)
      .filter((segment, index, all) => all.indexOf(segment) === index)
      .filter((segment) => segment !== lead);

    weeks.push({
      id: `w${weeks.length + 1}`,
      startDate: slice[0].date,
      endDate: slice[slice.length - 1].date,
      label: formatSpan(slice[0].date, slice[slice.length - 1].date),
      days: slice,
      lead,
      handover:
        others.length > 0
          ? `then ${others.map((segment) => segment.place).join(" · ")}`
          : null,
      costEur: Math.round(
        slice.reduce((total, day) => total + day.costEur, 0),
      ),
      anchors: slice
        .map((day) => day.anchor)
        .filter((anchor): anchor is Anchor => Boolean(anchor)),
    });
  }

  return weeks;
}

/** Whichever block owns the most days in the cell; ties go to the earlier. */
function dominantSegment(days: PlanDay[]): PlanSegment {
  const tally = new Map<PlanSegment, number>();
  for (const day of days) {
    tally.set(day.segment, (tally.get(day.segment) ?? 0) + 1);
  }
  let best = days[0].segment;
  for (const [segment, count] of tally) {
    if (count > (tally.get(best) ?? 0)) best = segment;
  }
  return best;
}
