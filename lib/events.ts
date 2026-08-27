/**
 * The events layer — what is on, where, while the couple is there.
 *
 * `docs/research/events-dec-feb.json` is imported straight from the research
 * (same reasoning as `lib/weather.ts`: one copy, one truth). Its first entry is
 * a meta record rather than an event, and its `dates` field is deliberately
 * free text — the research would have had to lie to fit "2nd Sunday of every
 * month" or "TBA, re-check Oct 2026" into an ISO pair. So the parsing lives
 * here, and it is conservative on purpose: an entry it cannot read with
 * confidence produces no ticks at all rather than a tick on a guessed day.
 *
 * Three readable shapes come out of the 63 entries:
 *
 * - **dated** — one or more ISO dates, optionally joined into a span
 *   ("2026-12-27 to 2027-01-01", or three city dates on one tour line).
 * - **listed** — a recurring event whose research already enumerated the
 *   occurrences that land in the window ("In window: 13 Dec 2026, …").
 * - **weekly** — a weekday-locked market ("Every Saturday 07:30-11:30"), which
 *   becomes a tick on each matching weekday inside the range asked for.
 *
 * Everything else — TBA, defunct, out of window — parses to nothing.
 */

import { addDays, daysBetween, weekdayOf } from "@/lib/trip-dates";

import eventsFile from "@/docs/research/events-dec-feb.json";

export interface TripEvent {
  id: string;
  name: string;
  place: string;
  /** "WA", "NSW-Northern-Rivers", "multi" — free-form, matched by prefix. */
  region: string;
  dates: string;
  dates_status: string;
  category: string;
  tags: string[];
  /** "her" (psytrance/markets), "him" (sport, minor), "both". */
  travellers: string;
  why_it_matters: string;
  rough_ticket_cost_couple_aud?: string;
  on_sale_status?: string;
  booking_urgency?: string;
  /** high | medium | low | none | blocked. */
  sway: string;
}

interface EventsMeta {
  id: "meta";
  researched: string;
  structural_finding: string;
}

const [meta, ...rest] = eventsFile as unknown as [EventsMeta, ...TripEvent[]];

export const EVENTS_META = meta;
export const EVENTS: TripEvent[] = rest;

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

type Schedule =
  | { kind: "dated"; spans: Array<{ start: string; end: string }> }
  | { kind: "weekly"; weekdays: number[] }
  | { kind: "none" };

const ISO = /\d{4}-\d{2}-\d{2}/g;
const WEEKDAY_NAMES = [
  "sunday", "monday", "tuesday", "wednesday",
  "thursday", "friday", "saturday",
];

/** "13 Dec 2026" as it appears in the research's "In window:" lists. */
const LISTED = /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/gi;
const MONTH_NUMBER: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function parseSchedule(dates: string): Schedule {
  const listed = dates.includes("In window:")
    ? [...dates.slice(dates.indexOf("In window:")).matchAll(LISTED)]
    : [];
  if (listed.length > 0) {
    return {
      kind: "dated",
      spans: listed.map((match) => {
        const iso = `${match[3]}-${MONTH_NUMBER[match[2].toLowerCase()]}-${match[1].padStart(2, "0")}`;
        return { start: iso, end: iso };
      }),
    };
  }

  const isoDates = [...dates.matchAll(ISO)];
  if (isoDates.length > 0) {
    const spans: Array<{ start: string; end: string }> = [];
    for (let i = 0; i < isoDates.length; i += 1) {
      const current = isoDates[i];
      const next = isoDates[i + 1];
      // Two ISO dates joined by "to" or a dash are one span; anything else
      // (a semicolon, a comma, a city name in brackets) makes them separate
      // occurrences of the same event.
      const joiner = next
        ? dates
            .slice(current.index + current[0].length, next.index)
            .replace(/\d{1,2}:\d{2}/g, "")
            .trim()
        : "";
      if (next && /^(to|-|–|—|through)$/i.test(joiner)) {
        spans.push({ start: current[0], end: next[0] });
        i += 1;
      } else {
        spans.push({ start: current[0], end: current[0] });
      }
    }
    return { kind: "dated", spans };
  }

  // No dates at all: a weekday-locked recurring event, or unreadable. Only
  // weekdays inside the "every …" clause count — one research line reads
  // "every Friday …; Community Market 3rd Saturday of the month", and that
  // third Saturday is not a weekly tick.
  const lower = dates.toLowerCase();
  const everyAt = lower.indexOf("every");
  if (everyAt < 0) return { kind: "none" };
  const clause = lower.slice(everyAt).split(";")[0];
  const weekdays = WEEKDAY_NAMES.map((name, index) =>
    clause.includes(name) ? index : -1,
  ).filter((index) => index >= 0);
  return weekdays.length > 0 ? { kind: "weekly", weekdays } : { kind: "none" };
}

/** Parsed once at module load — 63 entries of regex is not per-render work. */
const SCHEDULES = new Map<string, Schedule>(
  EVENTS.map((event) => [event.id, parseSchedule(event.dates)]),
);

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export type BookingUrgency = "high" | "medium" | "none";

/**
 * How hard the research leans on booking early. The field is prose ("HIGH -
 * set a reminder for late October 2026"), so only its first word is load
 * bearing; "n/a - not reachable" is a no, not a maybe.
 */
export function bookingUrgency(event: TripEvent): BookingUrgency {
  const value = (event.booking_urgency ?? "").trim().toLowerCase();
  if (value.startsWith("high")) return "high";
  if (value.startsWith("medium")) return "medium";
  return "none";
}

export interface EventHit {
  event: TripEvent;
  /** First day of this occurrence inside the range asked for. */
  start: string;
  end: string;
  /** True where the date comes from a weekday rule, not a published date. */
  recurring: boolean;
  urgency: BookingUrgency;
}

function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Events touching [startIso, endIso], narrowed to the regions given.
 *
 * Matching is exact against the research's own region strings, one tour line
 * ("NSW / QLD / VIC") splitting into three. Exact rather than prefix on
 * purpose: "NSW-Northern-Rivers" is its own region in this data, and a Byron
 * hinterland craft market drawn onto a Sydney week is noise dressed as data.
 * Pass no regions and the filter is dropped.
 */
export function eventsBetween(
  startIso: string,
  endIso: string,
  regions?: string[],
): EventHit[] {
  const hits: EventHit[] = [];

  for (const event of EVENTS) {
    if (regions && regions.length > 0) {
      const eventRegions = event.region.split("/").map((part) => part.trim());
      if (!eventRegions.some((region) => regions.includes(region))) continue;
    }

    const schedule = SCHEDULES.get(event.id);
    if (!schedule || schedule.kind === "none") continue;

    if (schedule.kind === "dated") {
      for (const span of schedule.spans) {
        if (!overlaps(span.start, span.end, startIso, endIso)) continue;
        hits.push({
          event,
          start: span.start < startIso ? startIso : span.start,
          end: span.end > endIso ? endIso : span.end,
          recurring: false,
          urgency: bookingUrgency(event),
        });
      }
      continue;
    }

    // Weekly: walk the range rather than the calendar. Ranges here are a week
    // or a trip, never long enough for this to matter.
    for (let offset = 0; offset < daysBetween(startIso, endIso); offset += 1) {
      const day = addDays(startIso, offset);
      if (!schedule.weekdays.includes(weekdayOf(day))) continue;
      hits.push({
        event,
        start: day,
        end: day,
        recurring: true,
        urgency: bookingUrgency(event),
      });
    }
  }

  return hits.sort((a, b) => a.start.localeCompare(b.start));
}

/** Events touching one day — what the day cells in the week zoom show. */
export function eventsOn(iso: string, regions?: string[]): EventHit[] {
  return eventsBetween(iso, iso, regions);
}

/**
 * Events across a run of days, each day asked about its own regions.
 *
 * A week that straddles two places has two different answers to "what is on",
 * and asking the week as a whole gets both wrong: it would put a Sydney
 * festival on the Margaret River days it overlaps. Days know where they are;
 * weeks only know where they mostly are.
 */
export function eventsForDays(
  days: Array<{ date: string; regions: string[] }>,
): EventHit[] {
  return days
    .flatMap((day) => eventsOn(day.date, day.regions))
    .sort((a, b) => a.start.localeCompare(b.start));
}
