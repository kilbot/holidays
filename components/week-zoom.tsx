"use client";

import { Pin, Zap } from "lucide-react";

import { eventsForDays, type EventHit, type TripEvent } from "@/lib/events";
import { formatDay, formatWeekdayDay, monthKey } from "@/lib/trip-dates";
import {
  DAILY_CAP_EUR,
  eventDaysOf,
  type PlanDay,
  type PlanWeek,
} from "@/lib/trip-plan";
import {
  ENSO,
  ensoTiltFor,
  normalsFor,
  tiltSummary,
  weatherLocation,
} from "@/lib/weather";
import { cn } from "@/lib/utils";

/** What a Day is for, in the two or three words a 90px column can hold. */
function dayItem(day: PlanDay, events: EventHit[]): string {
  if (day.anchor) return day.anchor.label;
  if (events.length > 0) return events[0].event.name;
  return day.segment.buffer ? "Buffer" : day.segment.detail;
}

function DayCell({ day, events }: { day: PlanDay; events: EventHit[] }) {
  const cost = Math.round(day.costEur);
  const overCap = cost > DAILY_CAP_EUR;

  return (
    <li
      // Anchors are calendar commitments, not plan items: the trip slides
      // around them and they never move, so they are pinned rather than
      // draggable — here and on the rail above.
      title={
        day.anchor
          ? `${day.anchor.label} — pinned. ${day.anchor.note}`
          : `${day.segment.place} · ${day.segment.detail}`
      }
      aria-roledescription={day.anchor ? "pinned anchor day" : undefined}
      className={cn(
        "flex min-w-[92px] flex-1 flex-col gap-0.5 rounded-lg border px-2 py-1.5",
        day.anchor
          ? "border-[color-mix(in_srgb,var(--sb-accent)_55%,transparent)] bg-[color-mix(in_srgb,var(--sb-accent)_11%,var(--sb-panel-2))]"
          : "border-[var(--sb-line)] bg-[color-mix(in_srgb,var(--sb-panel-2)_55%,transparent)]",
        day.segment.buffer && !day.anchor && "border-dashed",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="sb-num text-[10px] text-[var(--sb-faint)]">
          {formatWeekdayDay(day.date)}
        </span>
        {day.anchor && (
          <Pin
            className="size-2.5 shrink-0 text-[var(--sb-accent)]"
            aria-label="pinned anchor"
          />
        )}
      </div>

      <p className="truncate text-[11px] leading-tight font-semibold">
        {day.segment.place}
      </p>
      <p
        className={cn(
          "truncate text-[10px] leading-tight text-[var(--sb-dim)]",
          day.segment.buffer && !day.anchor && "italic",
        )}
      >
        {dayItem(day, events)}
      </p>

      <span
        className={cn(
          "sb-num mt-auto pt-1 text-[10px] font-medium",
          overCap ? "text-[var(--sb-over)]" : "text-[var(--sb-dim)]",
        )}
        title={
          overCap
            ? `Above the A$500 / €${DAILY_CAP_EUR} daily cap for a couple`
            : undefined
        }
      >
        €{cost.toLocaleString("en-GB")}
      </span>
    </li>
  );
}

interface GroupedEvent {
  event: TripEvent;
  dates: string[];
  urgency: EventHit["urgency"];
  recurring: boolean;
}

/** One line per event, however many days of the week it touches. */
function groupHits(hits: EventHit[]): GroupedEvent[] {
  const grouped = new Map<string, GroupedEvent>();
  for (const hit of hits) {
    const existing = grouped.get(hit.event.id);
    if (existing) {
      existing.dates.push(hit.start);
      continue;
    }
    grouped.set(hit.event.id, {
      event: hit.event,
      dates: [hit.start],
      urgency: hit.urgency,
      recurring: hit.recurring,
    });
  }
  // Anything the research says to book early goes to the top of the list.
  const rank = { high: 0, medium: 1, none: 2 };
  return [...grouped.values()].sort(
    (a, b) => rank[a.urgency] - rank[b.urgency] || a.dates[0].localeCompare(b.dates[0]),
  );
}

function WeatherPanel({ week }: { week: PlanWeek }) {
  const id = week.lead.weather;
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
      <div className="flex items-baseline justify-between gap-2">
        <p className="sb-label text-[9px]">{location.name} normals</p>
        <p className="sb-num text-[10px] text-[var(--sb-faint)] uppercase">
          {month}
        </p>
      </div>

      <p className="sb-num mt-1 text-[12px] font-medium">
        {normals.avg_high_c}° / {normals.avg_low_c}°
        <span className="ml-2 text-[10px] font-normal text-[var(--sb-dim)]">
          {normals.rain_days_ge_1mm} wet days · {normals.humidity} · sea{" "}
          {normals.sea_surface_temp_c}°
        </span>
      </p>

      {flags.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1">
          {flags.map((flag) => (
            <li
              key={flag}
              className="rounded-full bg-[color-mix(in_srgb,var(--sb-warn)_16%,transparent)] px-1.5 py-px text-[9px] font-semibold text-[var(--sb-warn)]"
            >
              {flag}
            </li>
          ))}
        </ul>
      )}

      {tilt && (
        <p className="mt-2 text-[10px] leading-snug text-[var(--sb-dim)]">
          <span className="font-semibold text-[var(--sb-sea)]">
            El Niño tilt: {tiltSummary(tilt)}
          </span>{" "}
          <span className="text-[var(--sb-faint)]">
            ({tilt.confidence} confidence)
          </span>{" "}
          {tilt.detail}
        </p>
      )}

      <p className="mt-1.5 text-[9px] leading-snug text-[var(--sb-faint)]">
        {ENSO.state}, as at {ENSO.as_at}. Historical analogue, not a forecast —
        BOM&apos;s Dec–Feb outlook is not out yet.
      </p>
    </div>
  );
}

function EventList({ hits }: { hits: EventHit[] }) {
  const grouped = groupHits(hits);

  if (grouped.length === 0) {
    return (
      <p className="text-[10px] leading-snug text-[var(--sb-faint)]">
        Nothing in the research for this week, in these regions.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {grouped.slice(0, 5).map((entry) => (
        <li key={entry.event.id} className="flex gap-1.5">
          <span className="sb-num mt-px w-[38px] shrink-0 text-[9px] text-[var(--sb-faint)]">
            {formatDay(entry.dates[0])}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-[10.5px] leading-tight font-semibold">
              <span className="truncate">{entry.event.name}</span>
              {entry.urgency !== "none" && (
                <Zap
                  className={cn(
                    "size-2.5 shrink-0",
                    entry.urgency === "high"
                      ? "text-[var(--sb-over)]"
                      : "text-[var(--sb-warn)]",
                  )}
                  aria-label={`booking urgency ${entry.urgency}`}
                />
              )}
            </p>
            <p className="truncate text-[9.5px] text-[var(--sb-dim)]">
              {entry.event.place}
              {entry.recurring && " · weekly"}
              {entry.urgency !== "none" && ` · ${entry.event.booking_urgency}`}
            </p>
          </div>
        </li>
      ))}
      {grouped.length > 5 && (
        <li className="text-[9.5px] text-[var(--sb-faint)]">
          +{grouped.length - 5} more in the research
        </li>
      )}
    </ul>
  );
}

/**
 * One week, opened out into its Days.
 *
 * The week cells are 130px wide and hold a place and a price; this is where the
 * Day becomes the unit the domain actually prices — its own lodging night, its
 * own event spend, its own warning if it blows the daily cap — with the week's
 * weather and events alongside it rather than compressed into a ribbon.
 */
export function WeekZoom({ week }: { week: PlanWeek }) {
  const hits = eventsForDays(eventDaysOf(week));

  return (
    // Capped and scrollable: opened out, a week is taller than the strip it
    // hangs off, and it must not push the globe off the screen on a phone.
    <div className="sb-scroll mt-2 max-h-[42vh] overflow-y-auto rounded-xl border border-[color-mix(in_srgb,var(--sb-accent)_28%,var(--sb-line))] bg-[color-mix(in_srgb,var(--sb-panel-2)_45%,transparent)] p-2.5">
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="min-w-0 lg:flex-1">
          <p className="sb-label mb-1.5 text-[9px]">
            {week.label} · {week.days.length} days
          </p>
          <ul className="sb-scroll flex gap-1.5 overflow-x-auto pb-1 lg:overflow-visible lg:pb-0">
            {week.days.map((day) => (
              <DayCell
                key={day.date}
                day={day}
                events={hits.filter(
                  (hit) => hit.start <= day.date && hit.end >= day.date,
                )}
              />
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 flex-col gap-3 lg:w-[248px] lg:border-l lg:border-[var(--sb-line)] lg:pl-3">
          <WeatherPanel week={week} />
          <div>
            <p className="sb-label mb-1.5 text-[9px]">On this week</p>
            <EventList hits={hits} />
          </div>
        </div>
      </div>
    </div>
  );
}
