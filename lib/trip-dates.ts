/**
 * Calendar primitives for the date strip, plus the dated commitments the
 * research names.
 *
 * Dates are plain ISO day strings ("2026-12-25") everywhere, and every bit of
 * arithmetic goes through UTC. A trip planned in Valencia for a country
 * thirteen hours ahead has no business letting the viewer's timezone shift a
 * day boundary: 25 December is 25 December wherever the browser thinks it is.
 *
 * The strip's whole coordinate system is the **window** — 1 Dec 2026 to 28 Feb
 * 2027, 90 days. The rail is that window at a fixed scale, so a deadline tick
 * never moves when the trip range changes; only the range bar does.
 */

/** Earliest day the trip can start. */
export const WINDOW_START = "2026-12-01";
/** Latest day the trip can end. */
export const WINDOW_END = "2027-02-28";

/**
 * Shortest trip the strip can draw. Below a week there is no week strip, and
 * the couple is not flying to Australia for five days.
 */
export const MIN_TRIP_DAYS = 7;

const MS_PER_DAY = 86_400_000;

function toUtc(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Days from the window's first day. `WINDOW_START` is 0. */
export function dayIndex(iso: string): number {
  return Math.round((toUtc(iso) - toUtc(WINDOW_START)) / MS_PER_DAY);
}

/** Inverse of `dayIndex`. */
export function isoAt(index: number): string {
  return fromUtc(toUtc(WINDOW_START) + index * MS_PER_DAY);
}

export function addDays(iso: string, days: number): string {
  return fromUtc(toUtc(iso) + days * MS_PER_DAY);
}

/** Inclusive: 12 Dec → 12 Dec is one day, not zero. */
export function daysBetween(startIso: string, endIso: string): number {
  return Math.round((toUtc(endIso) - toUtc(startIso)) / MS_PER_DAY) + 1;
}

/** Total days on the rail — 90, Dec through Feb. */
export const WINDOW_DAYS = daysBetween(WINDOW_START, WINDOW_END);

export function clampToWindow(iso: string): string {
  return isoAt(Math.min(WINDOW_DAYS - 1, Math.max(0, dayIndex(iso))));
}

export type RangeEnd = "start" | "end";

export interface TripRange {
  start: string;
  end: string;
}

/**
 * Move one end of the trip.
 *
 * The only place the range's rules live, so the rail's drag, the rail's arrow
 * keys and the header's typed date all obey exactly the same ones: stay inside
 * the window, and never let the two ends come closer than a week. The ends
 * push rather than swap — dragging the leaving date past the return date parks
 * it a week short instead of turning the trip inside out.
 */
export function moveRangeEnd(
  range: TripRange,
  end: RangeEnd,
  iso: string,
): TripRange {
  const index = dayIndex(clampToWindow(iso));
  if (end === "start") {
    const limit = dayIndex(range.end) - (MIN_TRIP_DAYS - 1);
    return { ...range, start: isoAt(Math.min(index, limit)) };
  }
  const limit = dayIndex(range.start) + (MIN_TRIP_DAYS - 1);
  return { ...range, end: isoAt(Math.max(index, limit)) };
}

/** 0 = Sunday, matching `Date.getUTCDay`. */
export function weekdayOf(iso: string): number {
  return new Date(toUtc(iso)).getUTCDay();
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "25 Dec" — the strip's default density. */
export function formatDay(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

/** "25 Dec 2026" — for the header chips and anything read aloud. */
export function formatDayYear(iso: string): string {
  return `${formatDay(iso)} ${iso.slice(0, 4)}`;
}

/** "Fri 25" — the day cells, where the column already says the month. */
export function formatWeekdayDay(iso: string): string {
  return `${WEEKDAYS[weekdayOf(iso)]} ${Number(iso.slice(8, 10))}`;
}

/** "Fri" — for a band that spans days the column headings already date. */
export function weekdayName(iso: string): string {
  return WEEKDAYS[weekdayOf(iso)];
}

/** "Mon–Fri", or just "Mon" for a single day. */
export function formatWeekdaySpan(startIso: string, endIso: string): string {
  const from = weekdayName(startIso);
  return startIso === endIso ? from : `${from}–${weekdayName(endIso)}`;
}

/** "12–18 Dec", collapsing the month when both ends share one. */
export function formatSpan(startIso: string, endIso: string): string {
  if (startIso === endIso) return formatDay(startIso);
  const sameMonth = startIso.slice(0, 7) === endIso.slice(0, 7);
  return sameMonth
    ? `${Number(startIso.slice(8, 10))}–${formatDay(endIso)}`
    : `${formatDay(startIso)}–${formatDay(endIso)}`;
}

/** Which normals column a day reads from. The window is Dec/Jan/Feb only. */
export function monthKey(iso: string): "dec" | "jan" | "feb" {
  const month = Number(iso.slice(5, 7));
  if (month === 12) return "dec";
  return month === 1 ? "jan" : "feb";
}

/* ------------------------------------------------------------------ */
/* Anchors                                                             */
/* ------------------------------------------------------------------ */

export interface Anchor {
  date: string;
  label: string;
  place: string;
  /** Hard anchors cannot move at all; the soft one only wants a good city. */
  hard: boolean;
  note: string;
}

/**
 * The three fixed date+place commitments from docs/CONTEXT.md. They are
 * calendar dates, not offsets into the trip, so dragging the handles moves the
 * trip past them rather than dragging them along.
 */
export const ANCHORS: Anchor[] = [
  {
    date: "2026-12-25",
    label: "Christmas",
    place: "Perth",
    hard: true,
    note: "Family Christmas at the Perth home base. Hard anchor.",
  },
  {
    date: "2026-12-31",
    label: "NYE",
    place: "Sydney",
    hard: true,
    note: "Sydney Harbour fireworks. Hard anchor — the trip is shaped around it.",
  },
  {
    date: "2027-01-26",
    label: "Australia Day",
    place: "city TBD",
    hard: false,
    note: "Soft anchor: be somewhere good for it, city decided by itinerary flow.",
  },
];

export function anchorOn(iso: string): Anchor | undefined {
  return ANCHORS.find((anchor) => anchor.date === iso);
}

/**
 * An Anchor, in words a stranger can read.
 *
 * A pin on a day says *something* is fixed; it does not say what, or how hard,
 * or why the rest of the trip is bending around it. Wherever the pin shows, the
 * sentence has to be one hover or one tap away — an active constraint is the
 * one thing on this page that may never hide (#56).
 */
export function describeAnchor(anchor: Anchor): string {
  const when = formatDay(anchor.date);
  return anchor.hard
    ? `${anchor.label} — fixed to ${when} in ${anchor.place}. It does not move; the trip slides around it. ${anchor.note}`
    : `${anchor.label} — wants ${when} somewhere good, but no fixed place. ${anchor.note}`;
}

/* ------------------------------------------------------------------ */
/* Deadlines                                                           */
/* ------------------------------------------------------------------ */

export interface Deadline {
  id: string;
  label: string;
  /** What happens if it is missed. One line — this is a strip, not a doc. */
  detail: string;
  /** Where the claim comes from, so a reader can go check it. */
  source: string;
  tone: "urgent" | "warn";
}

/**
 * Dated commitments that fall inside the window, so they can sit on the rail
 * at their true position.
 */
export interface WindowDeadline extends Deadline {
  date: string;
  /** Set where the deadline is a span rather than a moment. */
  endDate?: string;
}

/**
 * Deadlines that fall *before* the window opens. There is no rail position for
 * October, so these are the banner — the clocks that are already ticking.
 */
export interface PreTripDeadline extends Deadline {
  date: string;
}

export const WINDOW_DEADLINES: WindowDeadline[] = [
  {
    id: "opera-house-forecourt",
    date: "2026-12-26",
    label: "Opera House Forecourt tickets, 10:00 AEDT",
    detail:
      "6,000 free tickets, max 6 per booking, gone in minutes in prior years — and it is the day of the PER→SYD flight. Whoever is not driving books it from a phone.",
    source: "docs/research/capsule-sydney-nye.md §11",
    tone: "urgent",
  },
  {
    id: "nye-lodging-block",
    date: "2026-12-29",
    endDate: "2027-01-01",
    label: "NYE lodging ×2.5–3.0",
    detail:
      "Sydney rates run 2.5–3× normal across this block, minimum three nights and prepaid. Re-snapshot the modelled rates in October 2026.",
    source: "docs/research/capsule-sydney-nye.md §9",
    tone: "warn",
  },
];

export const PRE_TRIP_DEADLINES: PreTripDeadline[] = [
  {
    id: "book-per-syd",
    date: "2026-10-01",
    label: "Book PER→SYD by 1 Oct",
    detail:
      "The critical Leg, 26–31 Dec. A$400–700 booked early against A$800–1,200 left late; the red-eye is cheapest.",
    source: "docs/research/domestic-flights.md",
    tone: "urgent",
  },
  {
    id: "pitp-tickets",
    date: "2026-11-01",
    label: "Party In The Paddock tickets, early Nov",
    detail:
      "Research flags this HIGH: set a reminder for late October 2026 and buy in the first release.",
    source: "docs/research/events-dec-feb.json",
    tone: "urgent",
  },
];
