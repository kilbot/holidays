"use client";

import { useState } from "react";
import { ChevronUp, Lock, Pin, TriangleAlert, Zap } from "lucide-react";

import { eventsForDays, type EventHit, type TripEvent } from "@/lib/events";
import {
  anchorOn,
  describeAnchor,
  formatSpan,
  formatWeekdayDay,
  formatWeekdaySpan,
  monthKey,
} from "@/lib/trip-dates";
import {
  DAILY_CAP_AUD,
  describeLock,
  formatEur,
  type CapsuleSpec,
  type Day,
  type PlanWeek,
} from "@/lib/engine";
import { eventDaysOf, weatherOf } from "@/lib/engine/plan";
import {
  ENSO,
  ensoTiltFor,
  normalsFor,
  tiltSummary,
  weatherLocation,
  type WeatherLocationId,
} from "@/lib/weather";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Bands                                                               */
/* ------------------------------------------------------------------ */

/**
 * A run of consecutive days of the week that share one fact.
 *
 * The week zoom used to repeat that fact in every cell it touched, which is how
 * one Sydney festival became five truncated copies of its own name (#56). A
 * band says it once and spans the days it is true for, which is both shorter
 * and more honest: the thing being described is the run, not the day.
 */
interface Band {
  /** 0-based index into `week.days`, inclusive both ends. */
  from: number;
  to: number;
}

interface PlaceBand extends Band {
  key: string;
  locationName: string;
  capsuleId: string | null;
  capsuleName: string | null;
  buffer: boolean;
}

interface EventBand extends Band {
  key: string;
  event: TripEvent;
  urgency: EventHit["urgency"];
  recurring: boolean;
}

/** Runs of days sharing a place — and, inside it, a Capsule. */
function placeBands(days: Day[]): PlaceBand[] {
  const bands: PlaceBand[] = [];
  days.forEach((day, index) => {
    const last = bands[bands.length - 1];
    const same =
      last &&
      last.locationName === day.locationName &&
      last.capsuleName === day.capsuleName;
    if (same) {
      last.to = index;
      // A run is only a Buffer run if every day in it is one.
      last.buffer = last.buffer && day.buffer;
      return;
    }
    bands.push({
      key: `${day.date}-place`,
      from: index,
      to: index,
      locationName: day.locationName,
      capsuleId: day.capsuleId,
      capsuleName: day.capsuleName,
      buffer: day.buffer,
    });
  });
  return bands;
}

/**
 * One band per contiguous run of days an event touches.
 *
 * Split rather than merged across gaps on purpose: a Saturday market that lands
 * twice in a week is two Saturdays, and a single Sat–Sat band would claim it
 * runs for seven days. Sorted by start column so the grid's own row flow packs
 * them into lanes — see the container's comment.
 */
function eventBands(days: Day[], hits: EventHit[]): EventBand[] {
  const index = new Map(days.map((day, position) => [day.date, position]));
  const byEvent = new Map<
    string,
    { hit: EventHit; positions: Set<number> }
  >();

  for (const hit of hits) {
    const entry = byEvent.get(hit.event.id) ?? { hit, positions: new Set() };
    for (const [date, position] of index) {
      if (hit.start <= date && hit.end >= date) entry.positions.add(position);
    }
    byEvent.set(hit.event.id, entry);
  }

  const bands: EventBand[] = [];
  for (const [id, { hit, positions }] of byEvent) {
    const sorted = [...positions].sort((a, b) => a - b);
    let run: Band | null = null;
    for (const position of sorted) {
      if (run && position === run.to + 1) {
        run.to = position;
        continue;
      }
      if (run) bands.push({ ...run, key: `${id}-${run.from}`, event: hit.event, urgency: hit.urgency, recurring: hit.recurring });
      run = { from: position, to: position };
    }
    if (run) {
      bands.push({ ...run, key: `${id}-${run.from}`, event: hit.event, urgency: hit.urgency, recurring: hit.recurring });
    }
  }

  // Urgent first so the ones the research says to book early take the top lanes,
  // then by start column — which is what makes the grid's row flow pack greedily.
  const rank = { high: 0, medium: 1, none: 2 };
  return bands.sort(
    (a, b) => rank[a.urgency] - rank[b.urgency] || a.from - b.from,
  );
}

/** Lanes past this go behind a count: four rows of bands is already a wall. */
const MAX_EVENT_BANDS = 6;

/* ------------------------------------------------------------------ */
/* The day row                                                         */
/* ------------------------------------------------------------------ */

/**
 * One Day, reduced to what only it can say.
 *
 * Everything shared with its neighbours — the place, the Capsule, the festival
 * running all week — is a band above or below it now, so what is left in the
 * cell is the date, the money, and the two marks that are per-day facts: the
 * pin on an Anchor and the triangle on a day that blows the cap. Two lines
 * instead of five, and nothing in it truncates.
 */
function DayCell({
  day,
  capEur,
  open,
  onToggle,
}: {
  day: Day;
  capEur: number;
  open: boolean;
  onToggle: () => void;
}) {
  const anchor = anchorOn(day.date);
  const overCap = day.livingEur > capEur;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      // Anchors are calendar commitments, not plan items: the trip slides
      // around them and they never move, so they are pinned rather than
      // draggable — here and on the rail above.
      title={
        anchor
          ? `${anchor.label} — pinned. ${anchor.note}`
          : `${day.locationName}${day.capsuleName ? ` · ${day.capsuleName}` : ""}. Open the day's lines.`
      }
      aria-roledescription={anchor ? "pinned anchor day" : undefined}
      className={cn(
        "flex cursor-pointer flex-col gap-0.5 rounded-md border px-1.5 py-1 text-left transition-colors motion-reduce:transition-none",
        anchor
          ? "border-[color-mix(in_srgb,var(--sb-accent)_55%,transparent)] bg-[color-mix(in_srgb,var(--sb-accent)_11%,var(--sb-panel-2))]"
          : "border-[var(--sb-line)] bg-[color-mix(in_srgb,var(--sb-panel-2)_55%,transparent)]",
        day.buffer && !anchor && "border-dashed",
        open
          ? "ring-1 ring-[var(--sb-accent)]"
          : "hover:border-[color-mix(in_srgb,var(--sb-dim)_45%,transparent)]",
      )}
    >
      <span className="flex items-center justify-between gap-1">
        <span className="sb-num text-[10px] text-[var(--sb-faint)]">
          {formatWeekdayDay(day.date)}
        </span>
        {anchor && (
          <Pin
            className="size-2.5 shrink-0 text-[var(--sb-accent)]"
            aria-label="pinned anchor"
          />
        )}
      </span>

      <span
        className={cn(
          "sb-num flex items-baseline gap-1 text-[11px] font-medium",
          overCap ? "text-[var(--sb-over)]" : "text-[var(--sb-text)]",
        )}
        title={
          overCap
            ? `Living costs are €${Math.round(day.livingEur)}, above the A$${DAILY_CAP_AUD} / €${Math.round(capEur)} daily cap for a couple. Event spend and Legs sit outside the cap.`
            : undefined
        }
      >
        {formatEur(day.totalEur)}
        {overCap && <TriangleAlert className="size-2.5 shrink-0" />}
      </span>
    </button>
  );
}

/**
 * The drill-in: every line, its band, and where the rate came from.
 *
 * A full-width row under the grid rather than an inflating cell. A cell wide
 * enough to hold a line item is a cell that has stolen a seventh of the week
 * from its neighbours; down here the lines get columns instead, which is both
 * more room and less movement.
 */
function DayLines({
  day,
  capEur,
  capsules,
}: {
  day: Day;
  capEur: number;
  capsules: ReadonlyMap<string, CapsuleSpec>;
}) {
  const lines = day.lines.filter(
    (line) => line.eur !== 0 || line.kind === "lodging",
  );
  // Every constraint holding this day in place, in plain words. A `title` is a
  // pointer affordance and half the site is read on a phone, so the tap path
  // has to say the same thing the hover does.
  const anchor = anchorOn(day.date);
  const spec = day.capsuleId ? capsules.get(day.capsuleId) : undefined;
  const lock = spec ? describeLock(spec.lock) : null;
  const pinned = [
    anchor && describeAnchor(anchor),
    lock && spec && `${spec.name}: ${lock.sentence}`,
  ].filter(Boolean) as string[];

  return (
    <div className="mt-1.5 rounded-md border border-[color-mix(in_srgb,var(--sb-accent)_35%,var(--sb-line))] bg-[color-mix(in_srgb,var(--sb-panel-2)_60%,transparent)] px-2 py-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-[10.5px] leading-tight font-semibold">
          {formatWeekdayDay(day.date)}
          <span className="ml-1.5 font-normal text-[var(--sb-dim)]">
            {day.locationName}
            {day.capsuleName ? ` · ${day.capsuleName}` : ""}
          </span>
        </p>
        {day.peakLabel && (
          <p
            className="text-[9.5px] leading-snug text-[var(--sb-warn)]"
            title={day.peakNote ?? undefined}
          >
            {day.peakLabel}
          </p>
        )}
      </div>

      <dl className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-4 gap-y-0.5">
        {lines.map((line) => (
          <div key={line.id} title={line.note} className="min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <dt
                className={cn(
                  "truncate text-[10px] leading-tight",
                  line.living
                    ? "text-[var(--sb-dim)]"
                    : "text-[var(--sb-accent)]",
                )}
              >
                {line.label}
              </dt>
              <dd className="sb-num shrink-0 text-[10px] text-[var(--sb-text)]">
                {formatEur(line.eur)}
              </dd>
            </div>
            {line.bandEur[0] !== line.bandEur[1] && (
              <p className="sb-num text-[9px] text-[var(--sb-faint)]">
                {formatEur(line.bandEur[0])}–
                {Math.round(line.bandEur[1]).toLocaleString("en-GB")}
                {line.aud !== null && ` · A$${Math.round(line.aud)}`}
              </p>
            )}
          </div>
        ))}
      </dl>

      {pinned.map((sentence) => (
        <p
          key={sentence}
          className="mt-1 flex gap-1 border-t border-[var(--sb-line)] pt-1 text-[9.5px] leading-snug text-[var(--sb-accent)]"
        >
          <Pin className="mt-px size-2.5 shrink-0" aria-hidden />
          <span>{sentence}</span>
        </p>
      ))}

      <p className="mt-1 border-t border-[var(--sb-line)] pt-1 text-[9.5px] leading-snug text-[var(--sb-faint)]">
        Living {formatEur(day.livingEur)} of the €{Math.round(capEur)} cap
        {day.livingEur > capEur ? " — over" : ""}. Events and Legs sit outside
        it.
      </p>
    </div>
  );
}

/**
 * The week as a seven-column calendar: places over it, days in it, events under.
 *
 * All three rows are `grid-cols-7` with the same gap, so a band that says
 * `grid-column: 3 / span 4` lands exactly over the four cells it is about.
 *
 * The event rows lean on plain (non-dense) grid flow: with every band given an
 * explicit column and the list sorted by start column, the auto-placement
 * cursor only ever moves forward, so a band that starts after the previous one
 * ended shares its row and one that overlaps drops to the next. That is greedy
 * lane packing, done by the layout engine rather than by arithmetic here.
 */
function WeekGrid({
  week,
  hits,
  capEur,
  capsules,
  openDay,
  onToggleDay,
}: {
  week: PlanWeek;
  hits: EventHit[];
  capEur: number;
  capsules: ReadonlyMap<string, CapsuleSpec>;
  openDay: string | null;
  onToggleDay: (date: string) => void;
}) {
  const days = week.days;
  const places = placeBands(days);
  const events = eventBands(days, hits);
  const shown = events.slice(0, MAX_EVENT_BANDS);
  const day = days.find((entry) => entry.date === openDay) ?? null;

  const span = (band: Band) => ({
    gridColumn: `${band.from + 1} / span ${band.to - band.from + 1}`,
  });

  return (
    // Below `lg` seven columns cannot hold a price, so the calendar keeps its
    // shape and scrolls sideways instead of shrinking into unreadability.
    <div className="sb-scroll -mx-0.5 overflow-x-auto px-0.5 pb-1 lg:overflow-x-visible lg:pb-0">
      <div className="min-w-[520px] lg:min-w-0">
        <div className="grid grid-cols-7 gap-1">
          {places.map((place, index) => {
            // Three Capsules in one town is three bands, and repeating the
            // town's name across all three is the same fault the day cells had.
            // The place is said once per run of days in it; the bands after
            // that carry only what changed.
            const sameTown =
              index > 0 && places[index - 1].locationName === place.locationName;
            // Why this block is *here* and not somewhere cheaper. A padlock
            // where a Capsule is pinned to dates, and the research's own reason
            // one hover away — or one tap, in the day drill-in below (#56).
            const spec = place.capsuleId
              ? capsules.get(place.capsuleId)
              : undefined;
            const lock = spec ? describeLock(spec.lock) : null;
            return (
              <p
                key={place.key}
                style={span(place)}
                title={[
                  `${place.locationName}${place.capsuleName ? ` · ${place.capsuleName}` : ""} — ${formatWeekdaySpan(days[place.from].date, days[place.to].date)}`,
                  lock?.sentence,
                ]
                  .filter(Boolean)
                  .join("\n\n")}
                className={cn(
                  "truncate rounded-md px-1.5 py-0.5 text-[11px] leading-tight font-semibold",
                  place.buffer
                    ? "bg-[color-mix(in_srgb,var(--sb-panel-2)_60%,transparent)] text-[var(--sb-dim)] italic"
                    : "bg-[color-mix(in_srgb,var(--sb-accent)_14%,transparent)] text-[var(--sb-text)]",
                )}
              >
                {sameTown ? (
                  <span aria-hidden className="text-[var(--sb-faint)]">
                    ↳{" "}
                  </span>
                ) : (
                  place.locationName
                )}
                {place.capsuleName && (
                  <span
                    className={cn(
                      sameTown ? "" : "font-normal text-[var(--sb-dim)]",
                    )}
                  >
                    {sameTown ? "" : " · "}
                    {place.capsuleName}
                  </span>
                )}
                {!place.capsuleName && place.buffer && (
                  <span className="font-normal">{sameTown ? "" : " · "}buffer</span>
                )}
                {lock && (
                  <span className="ml-1 inline-flex items-baseline gap-0.5 font-normal text-[var(--sb-accent)]">
                    <Lock className="size-2.5 shrink-0 translate-y-[1px]" aria-hidden />
                    <span className="text-[9.5px]">{lock.chip}</span>
                  </span>
                )}
              </p>
            );
          })}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((entry) => (
            <DayCell
              key={entry.date}
              day={entry}
              capEur={capEur}
              open={openDay === entry.date}
              onToggle={() => onToggleDay(entry.date)}
            />
          ))}
        </div>

        {shown.length > 0 && (
          <div className="mt-1 grid grid-cols-7 gap-1">
            {shown.map((band) => (
              <p
                key={band.key}
                style={span(band)}
                title={`${band.event.name} — ${band.event.place}, ${formatWeekdaySpan(days[band.from].date, days[band.to].date)}${band.recurring ? " (weekly)" : ""}${band.urgency !== "none" ? `. ${band.event.booking_urgency}` : ""}`}
                className={cn(
                  "flex min-w-0 items-center gap-1 truncate rounded-[4px] border-l-2 px-1.5 py-px text-[10px] leading-tight",
                  band.urgency === "high"
                    ? "border-[var(--sb-over)] bg-[color-mix(in_srgb,var(--sb-over)_12%,transparent)]"
                    : band.urgency === "medium"
                      ? "border-[var(--sb-warn)] bg-[color-mix(in_srgb,var(--sb-warn)_12%,transparent)]"
                      : "border-[var(--sb-line)] bg-[color-mix(in_srgb,var(--sb-panel-2)_55%,transparent)]",
                )}
              >
                {band.urgency !== "none" && (
                  <Zap
                    className={cn(
                      "size-2.5 shrink-0",
                      band.urgency === "high"
                        ? "text-[var(--sb-over)]"
                        : "text-[var(--sb-warn)]",
                    )}
                    aria-label={`booking urgency ${band.urgency}`}
                  />
                )}
                <span className="truncate font-medium">{band.event.name}</span>
                <span className="sb-num shrink-0 text-[var(--sb-faint)]">
                  {formatWeekdaySpan(
                    days[band.from].date,
                    days[band.to].date,
                  )}
                </span>
              </p>
            ))}
          </div>
        )}

        {events.length > shown.length && (
          <p className="mt-1 text-[9.5px] text-[var(--sb-faint)]">
            +{events.length - shown.length} more on in the research this week
          </p>
        )}

        {day && (
          <DayLines day={day} capEur={capEur} capsules={capsules} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The side column                                                     */
/* ------------------------------------------------------------------ */

/**
 * The week's weather, at two depths.
 *
 * The numbers and the flags are the headline; the El Niño tilt, its confidence
 * and the provenance of the whole thing are three paragraphs that used to sit
 * open in a panel the globe was supposed to be visible behind. Same bargain as
 * everything else on this page: the summary is always on, the reasoning is one
 * click away.
 */
function WeatherPanel({ week }: { week: PlanWeek }) {
  const [open, setOpen] = useState(false);
  const id = weatherOf(week) as WeatherLocationId | null;

  if (!id) {
    return (
      <p className="text-[10px] leading-snug text-[var(--sb-faint)]">
        In transit — no base to read normals for.
      </p>
    );
  }

  const location = weatherLocation(id);
  const month = monthKey(week.startDate);
  const normals = normalsFor(id, month);
  const tilt = ensoTiltFor(id);
  const flags = [
    location.flags.stinger_season && "stingers",
    location.flags.cyclone_window && "cyclone season",
    location.flags.bushfire_months.includes(month) && "fire season",
  ].filter(Boolean) as string[];

  return (
    <div>
      <p className="sb-label text-[9px]">
        {location.name} normals
        <span className="sb-num ml-1.5 text-[var(--sb-faint)]">{month}</span>
      </p>

      <p className="sb-num mt-0.5 text-[12px] font-medium">
        {normals.avg_high_c}° / {normals.avg_low_c}°
        <span className="ml-1.5 text-[10px] font-normal text-[var(--sb-dim)]">
          {normals.rain_days_ge_1mm} wet · {normals.humidity} · sea{" "}
          {normals.sea_surface_temp_c}°
        </span>
      </p>

      {(flags.length > 0 || tilt) && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {flags.map((flag) => (
            <span
              key={flag}
              className="rounded-full bg-[color-mix(in_srgb,var(--sb-warn)_16%,transparent)] px-1.5 py-px text-[9px] font-semibold text-[var(--sb-warn)]"
            >
              {flag}
            </span>
          ))}
          {tilt && (
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              aria-expanded={open}
              className="cursor-pointer rounded-full bg-[color-mix(in_srgb,var(--sb-sea)_16%,transparent)] px-1.5 py-px text-[9px] font-semibold text-[var(--sb-sea)] transition-colors hover:bg-[color-mix(in_srgb,var(--sb-sea)_26%,transparent)] motion-reduce:transition-none"
            >
              El Niño: {tiltSummary(tilt)}
            </button>
          )}
        </div>
      )}

      {open && tilt && (
        <p className="mt-1.5 text-[9.5px] leading-snug text-[var(--sb-dim)]">
          {tilt.detail}{" "}
          <span className="text-[var(--sb-faint)]">
            ({tilt.confidence} confidence.) {ENSO.state}, as at {ENSO.as_at}.
            Historical analogue, not a forecast — BOM&apos;s Dec–Feb outlook is
            not out yet.
          </span>
        </p>
      )}
    </div>
  );
}

/** The week's Warnings, in full. The dots on the strip point here. */
function WarningList({ week }: { week: PlanWeek }) {
  if (week.warnings.length === 0) return null;

  return (
    <div>
      <p className="sb-label mb-1 text-[9px]">Worth knowing</p>
      <ul className="flex flex-col gap-1">
        {week.warnings.map((warning) => (
          <li key={warning.id} className="flex gap-1.5">
            <TriangleAlert
              className={cn(
                "mt-px size-3 shrink-0",
                warning.tone === "over"
                  ? "text-[var(--sb-over)]"
                  : "text-[var(--sb-warn)]",
              )}
            />
            <div className="min-w-0">
              <p
                className={cn(
                  "text-[10.5px] leading-tight font-semibold",
                  warning.tone === "over"
                    ? "text-[var(--sb-over)]"
                    : "text-[var(--sb-warn)]",
                )}
              >
                {warning.label}
              </p>
              <p className="text-[9.5px] leading-snug text-[var(--sb-dim)]">
                {warning.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The panel                                                           */
/* ------------------------------------------------------------------ */

/**
 * One week, opened out into its Days.
 *
 * Rewritten for #56. The shape it replaces gave every Day a tall cell and let
 * each of them repeat whatever its neighbours were also saying; on a real week
 * that meant seven near-empty boxes, five copies of one festival's truncated
 * name, and a panel that took 577px of a 900px screen to say very little. What
 * is here now is a calendar: the place is a band over the days it covers, each
 * event is a band over the days it runs, and the Day cell keeps only the date
 * and its price. The "On this week" list is gone with the repetition it was
 * duplicating — the bands are the list, and they are in the right columns.
 *
 * The panel is sized to its content and only capped for the screen it is on, so
 * the globe underneath stays visible with a week open.
 */
export function WeekZoom({
  week,
  id,
  capEur,
  capsules,
  onClose,
}: {
  week: PlanWeek;
  id: string;
  /** The Daily cap at the Plan's own FX rate. */
  capEur: number;
  /** The specs the Plan was built from, so a band can say what pins it. */
  capsules: ReadonlyMap<string, CapsuleSpec>;
  onClose: () => void;
}) {
  const hits = eventsForDays(eventDaysOf(week));
  const [openDay, setOpenDay] = useState<string | null>(null);

  return (
    <div
      id={id}
      role="region"
      aria-label={`${week.label} — day view`}
      // A ceiling rather than a height: most weeks come in well under it, and
      // the ones that do not scroll inside their own box rather than pushing
      // the globe off the screen. `min-h-0` is what lets the strip's own
      // ceiling squeeze this further on a short screen — it is the flexible
      // part of the strip, because it is the part that already scrolls.
      className="sb-scroll-seen mt-2 max-h-[min(34vh,320px)] min-h-0 shrink overflow-y-auto rounded-xl border border-[color-mix(in_srgb,var(--sb-accent)_28%,var(--sb-line))] bg-[color-mix(in_srgb,var(--sb-panel-2)_45%,transparent)] p-2"
    >
      {/* One line of chrome for the whole panel: what week this is, what it
          costs, and the way out. Before #56 the label and a full-width CLOSE
          WEEK bar were two rows of their own, top and bottom. */}
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <p className="sb-label truncate text-[9px]">
          {formatSpan(week.startDate, week.endDate)}
          <span className="sb-num ml-1.5 text-[var(--sb-faint)]">
            {week.days.length} days
          </span>
          <span className="sb-num ml-1.5 text-[var(--sb-text)]">
            {formatEur(week.costEur)}
          </span>
        </p>
        <button
          type="button"
          onClick={onClose}
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.13em] text-[var(--sb-faint)] uppercase transition-colors hover:bg-[var(--sb-panel-2)] hover:text-[var(--sb-text)] motion-reduce:transition-none"
        >
          Close
          <ChevronUp className="size-3" />
        </button>
      </div>

      <div className="flex flex-col gap-2.5 lg:flex-row">
        <div className="min-w-0 lg:flex-1">
          <WeekGrid
            week={week}
            hits={hits}
            capEur={capEur}
            capsules={capsules}
            openDay={openDay}
            onToggleDay={(date) =>
              setOpenDay((current) => (current === date ? null : date))
            }
          />
        </div>

        <div className="flex shrink-0 flex-col gap-2 lg:w-[228px] lg:border-l lg:border-[var(--sb-line)] lg:pl-2.5">
          <WeatherPanel week={week} />
          <WarningList week={week} />
        </div>
      </div>
    </div>
  );
}
