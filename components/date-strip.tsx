"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { AlarmClock, ChevronDown, TriangleAlert } from "lucide-react";

import { eventsForDays } from "@/lib/events";
import { formatEurCompact } from "@/lib/demo-plan";
import { TripRail } from "@/components/trip-rail";
import { WeekZoom } from "@/components/week-zoom";
import {
  PRE_TRIP_DEADLINES,
  WINDOW_END,
  WINDOW_START,
  daysBetween,
  formatDay,
  formatDayYear,
  monthKey,
  moveRangeEnd,
  type RangeEnd,
  type TripRange,
} from "@/lib/trip-dates";
import {
  DEFAULT_TRIP_END,
  DEFAULT_TRIP_START,
  derivePlan,
  eventDaysOf,
  type PlanWeek,
} from "@/lib/trip-plan";
import { heatFraction, normalsFor } from "@/lib/weather";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

/**
 * A trip date, shown as text and edited in place.
 *
 * The rail is the primary control, but a strip you can only drag is a strip
 * some people cannot use at all: this is the typed path, on a native date
 * input, with the window as its min and max. Both paths land in the same
 * clamp.
 */
function DateChip({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (date: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <span className="flex items-baseline gap-1.5">
      <span className="sb-label text-[9px]">{label}</span>
      {editing ? (
        <input
          type="date"
          autoFocus
          defaultValue={value}
          min={WINDOW_START}
          max={WINDOW_END}
          onChange={(event) => {
            if (event.target.value) onChange(event.target.value);
          }}
          onBlur={() => setEditing(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Escape") {
              setEditing(false);
            }
          }}
          style={{ colorScheme: "light dark" }}
          className="sb-num rounded-md border border-[var(--sb-accent)] bg-[var(--sb-panel-2)] px-1 py-px text-[12px] font-semibold outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="sb-num cursor-pointer rounded-md border border-transparent px-1 py-px text-[12px] font-semibold decoration-[var(--sb-faint)] decoration-dotted underline-offset-[3px] transition-colors hover:border-[var(--sb-line)] hover:bg-[var(--sb-panel-2)] focus-visible:border-[var(--sb-accent)] focus-visible:outline-none motion-reduce:transition-none"
        >
          <span className="underline decoration-dotted">
            {formatDayYear(value)}
          </span>
        </button>
      )}
    </span>
  );
}

/**
 * Today, on the client only.
 *
 * A countdown rendered on the server would be baked into the HTML and would be
 * a day wrong for anyone who kept the tab open — and would mismatch hydration
 * across a midnight. The server snapshot is deliberately null, so the banner
 * renders its labels first and the countdown arrives with the client.
 */
const noSubscription = () => () => {};
const todayIso = () => new Date().toISOString().slice(0, 10);
const noToday = () => null;

function useToday(): string | null {
  return useSyncExternalStore(noSubscription, todayIso, noToday);
}

/**
 * The deadlines that fall before the window opens.
 *
 * They have no position on a rail that starts in December — booking the
 * PER→SYD Leg is an October job — so they get a banner instead, with the
 * countdown that is the whole point of them.
 */
function ClocksTicking() {
  const [open, setOpen] = useState<string | null>(null);
  const today = useToday();

  const shown = PRE_TRIP_DEADLINES.find((deadline) => deadline.id === open);

  return (
    <div className="mb-2 rounded-lg bg-[color-mix(in_srgb,var(--sb-warn)_12%,transparent)] px-2 py-1.5">
      {/* Wraps rather than truncates: a deadline you can only half-read is
          not doing its job, and on a phone these are two full lines. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="flex shrink-0 items-center gap-1.5">
          <AlarmClock className="size-3 text-[var(--sb-warn)]" />
          <span className="sb-label text-[9px] text-[var(--sb-warn)]">
            Clocks ticking
          </span>
        </span>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {PRE_TRIP_DEADLINES.map((deadline) => {
            const away = today ? daysBetween(today, deadline.date) - 1 : null;
            return (
              <li key={deadline.id}>
                <button
                  type="button"
                  onClick={() =>
                    setOpen((current) =>
                      current === deadline.id ? null : deadline.id,
                    )
                  }
                  aria-expanded={open === deadline.id}
                  className="cursor-pointer text-left text-[10.5px] leading-tight text-[var(--sb-dim)] transition-colors hover:text-[var(--sb-text)] motion-reduce:transition-none"
                >
                  <span className="font-semibold text-[var(--sb-text)]">
                    {deadline.label}
                  </span>
                  {away !== null && away > 0 && (
                    <span className="sb-num ml-1.5 text-[var(--sb-faint)]">
                      in {away} days
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {shown && (
        <p className="mt-1 pl-5 text-[10px] leading-snug text-[var(--sb-dim)]">
          {shown.detail}{" "}
          <span className="sb-num text-[var(--sb-faint)]">{shown.source}</span>
        </p>
      )}
    </div>
  );
}

function Legend() {
  return (
    <span className="hidden shrink-0 items-center gap-2.5 text-[10px] text-[var(--sb-faint)] xl:flex">
      <span className="flex items-center gap-1">
        <span className="text-[var(--sb-accent)]">✦</span> anchor
      </span>
      <span className="flex items-center gap-1">
        <span
          className="h-1.5 w-4 rounded-full"
          style={{
            background: "linear-gradient(90deg, var(--sb-sea), var(--sb-over))",
          }}
        />
        weather
      </span>
      <span className="flex items-center gap-1">
        <span
          className="h-2 w-[3px] rounded-[1px]"
          style={{ background: "var(--sb-warn)" }}
        />
        event
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Week cell                                                           */
/* ------------------------------------------------------------------ */

/** One zoom at a time, so every week cell can point `aria-controls` at it. */
const WEEK_ZOOM_ID = "week-zoom";

/**
 * Dec/Jan/Feb normals for the week's place, as a bar and two numbers.
 *
 * Monthly normals, so the bar is flat across the week — the honest resolution
 * of the data. Colour is the temperature ramp, cool to hot; the tilt this
 * El Niño summer puts on it is in the week zoom, where there is room to say
 * how much confidence it carries.
 */
function WeatherRibbon({ week, costEur }: { week: PlanWeek; costEur: number }) {
  const id = week.lead.weather;
  const month = monthKey(week.startDate);
  const normals = id ? normalsFor(id, month) : null;
  const heat = normals
    ? Math.round(heatFraction(normals.avg_high_c) * 100)
    : 0;

  return (
    <div className="mt-1.5">
      <span
        aria-hidden
        className={cn(
          "block h-[3px] rounded-full",
          !normals && "border-t border-dashed border-[var(--sb-line)]",
        )}
        style={
          normals
            ? {
                background: `color-mix(in srgb, var(--sb-over) ${heat}%, var(--sb-sea))`,
              }
            : undefined
        }
      />
      {/* Weather left, money right: the two numbers a week is judged on, on
          one line, so the cell stays four lines tall however long the trip. */}
      <p className="sb-num mt-1 flex items-baseline justify-between gap-1 text-[9.5px]">
        {normals ? (
          <span className="truncate text-[var(--sb-dim)]">
            {normals.avg_high_c}°/{normals.avg_low_c}°
            <span className="ml-1 hidden text-[var(--sb-faint)] xl:inline">
              {normals.rain_days_ge_1mm} wet
            </span>
          </span>
        ) : (
          <span className="truncate text-[var(--sb-faint)]">in transit</span>
        )}
        <span className="shrink-0 text-[11px] font-medium text-[var(--sb-text)]">
          {formatEurCompact(costEur)}
        </span>
      </p>
    </div>
  );
}

/**
 * One tick per day of the week that has something on, coloured by how hard the
 * research leans on booking early. Names and dates are in the tooltip and, on
 * a touch screen, one tap away in the week zoom.
 */
function EventTicks({ week }: { week: PlanWeek }) {
  const hits = eventsForDays(eventDaysOf(week));

  return (
    <div className="mt-1 grid h-2 grid-cols-7 gap-px" aria-hidden>
      {week.days.map((day) => {
        const onDay = hits.filter(
          (hit) => hit.start <= day.date && hit.end >= day.date,
        );
        if (onDay.length === 0) return <span key={day.date} />;
        const urgent = onDay.some((hit) => hit.urgency === "high");
        return (
          <span
            key={day.date}
            title={`${formatDay(day.date)} — ${onDay
              .map((hit) => hit.event.name)
              .join(", ")}`}
            className="h-full rounded-[1px]"
            style={{
              background: urgent ? "var(--sb-over)" : "var(--sb-warn)",
              opacity: urgent ? 1 : 0.55 + Math.min(onDay.length, 3) * 0.15,
            }}
          />
        );
      })}
    </div>
  );
}

function WeekCell({
  week,
  open,
  onToggle,
}: {
  week: PlanWeek;
  open: boolean;
  onToggle: () => void;
}) {
  const anchored = week.anchors.length > 0;

  return (
    <li className="flex min-w-[136px] flex-1 lg:min-w-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={WEEK_ZOOM_ID}
        aria-label={`${week.label}, ${week.lead.place}. Open the day view.`}
        className={cn(
          "flex w-full cursor-pointer flex-col rounded-lg border px-2.5 py-2 text-left transition-colors motion-reduce:transition-none",
          anchored
            ? "border-[color-mix(in_srgb,var(--sb-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--sb-accent)_9%,var(--sb-panel-2))]"
            : "border-[var(--sb-line)] bg-[color-mix(in_srgb,var(--sb-panel-2)_65%,transparent)]",
          week.lead.buffer && !anchored && "border-dashed",
          open
            ? "ring-1 ring-[var(--sb-accent)]"
            : "hover:border-[color-mix(in_srgb,var(--sb-dim)_45%,transparent)]",
        )}
      >
        <div className="flex items-baseline justify-between gap-1.5">
          <span className="sb-num truncate text-[10px] text-[var(--sb-faint)]">
            {week.label}
          </span>
          {/* The anchor mark sits out here rather than after the place name,
              where a long place ("Margaret River + Rotto") would truncate the
              one glyph that says this week is spoken for. */}
          {anchored && (
            <span
              className="shrink-0 text-[10px] text-[var(--sb-accent)]"
              title={week.anchors
                .map((anchor) => `${anchor.label} — ${formatDay(anchor.date)}`)
                .join(" · ")}
            >
              ✦
            </span>
          )}
        </div>

        <p
          className={cn(
            "mt-0.5 truncate text-[12px] leading-tight font-semibold",
            week.lead.buffer && "text-[var(--sb-dim)] italic",
          )}
        >
          {week.lead.place}
        </p>

        <p className="mt-0.5 hidden truncate text-[10px] text-[var(--sb-faint)] xl:block">
          {week.handover ?? week.lead.detail}
        </p>

        <WeatherRibbon week={week} costEur={week.costEur} />
        <EventTicks week={week} />
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Strip                                                               */
/* ------------------------------------------------------------------ */

/**
 * The week strip docked at the bottom of the Globe stage — and, since #27, the
 * only place the trip's dates are set.
 *
 * There is deliberately no date form anywhere else on the page: the range lives
 * on the rail, the weeks re-derive from it, and everything under them (cost,
 * weather, events, the deadlines that are already ticking) follows. Three ways
 * in, because the drag is the nicest one and must not be the only one: drag a
 * handle, arrow a handle, or type the date into the header.
 */
export function DateStrip() {
  const [range, setRange] = useState<TripRange>({
    start: DEFAULT_TRIP_START,
    end: DEFAULT_TRIP_END,
  });
  const [openWeek, setOpenWeek] = useState<string | null>(null);

  const plan = useMemo(() => derivePlan(range.start, range.end), [range]);
  // Week ids are positional, so a range change can leave the open one pointing
  // at a week that no longer exists. Falling back to closed is the honest
  // reading — the traveller opened *that* week, not "week seven of whatever".
  const zoomed = plan.weeks.find((week) => week.id === openWeek) ?? null;

  function change(end: RangeEnd, date: string) {
    setRange((current) => moveRangeEnd(current, end, date));
  }

  const warnings = [
    ...plan.missedAnchors.map(
      (anchor) => `${anchor.label} (${formatDay(anchor.date)}) falls outside the trip`,
    ),
    ...(plan.droppedSegments.length > 0
      ? [
          `${plan.droppedSegments.length} block${plan.droppedSegments.length > 1 ? "s" : ""} no longer fit: ${plan.droppedSegments
            .map((segment) => segment.place)
            .join(", ")}`,
        ]
      : []),
  ];

  return (
    <section className="pointer-events-auto absolute right-4 bottom-4 left-4 z-20">
      <div className="sb-panel p-3">
        <ClocksTicking />

        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <DateChip
              label="Leaving"
              value={range.start}
              onChange={(date) => change("start", date)}
            />
            <span className="text-[var(--sb-faint)]">→</span>
            <DateChip
              label="Return"
              value={range.end}
              onChange={(date) => change("end", date)}
            />
          </div>

          <p className="sb-num flex items-baseline gap-2 text-[10px] text-[var(--sb-faint)]">
            <span>
              <span className="text-[var(--sb-dim)]">{plan.dayCount}</span> days
            </span>
            <span>
              <span className="text-[var(--sb-dim)]">
                {plan.freeLodgingNights}
              </span>{" "}
              free-lodging
            </span>
            <span
              title="Demo math: each block keeps its one-off costs and scales its nights. The real re-pricing lands with the cost model (#25)."
              className="flex items-baseline gap-1"
            >
              <span className="text-[var(--sb-text)]">
                €{plan.totalEur.toLocaleString("en-GB")}
              </span>
              <span className="rounded-full bg-[color-mix(in_srgb,var(--sb-line)_60%,transparent)] px-1.5 py-px text-[8.5px] font-semibold tracking-[0.08em] text-[var(--sb-dim)] uppercase">
                {plan.atBaseline
                  ? "baseline"
                  : `demo ${plan.deltaEur >= 0 ? "+" : "−"}€${Math.abs(plan.deltaEur).toLocaleString("en-GB")}`}
              </span>
            </span>
          </p>

          <Legend />
        </div>

        <TripRail
          startDate={range.start}
          endDate={range.end}
          onChange={change}
        />

        {warnings.length > 0 && (
          <p className="mb-2 flex items-start gap-1.5 text-[10px] leading-snug text-[var(--sb-warn)]">
            <TriangleAlert className="mt-px size-3 shrink-0" />
            <span>{warnings.join(" · ")}</span>
          </p>
        )}

        {/* Horizontal scroll is the mobile degradation: ten weeks never fit a
            phone, and squeezing them would cost the place names. */}
        <ul className="sb-scroll flex gap-1.5 overflow-x-auto pb-1">
          {plan.weeks.map((week) => (
            <WeekCell
              key={week.id}
              week={week}
              open={week.id === openWeek}
              onToggle={() =>
                setOpenWeek((current) => (current === week.id ? null : week.id))
              }
            />
          ))}
        </ul>

        {zoomed && <WeekZoom week={zoomed} id={WEEK_ZOOM_ID} />}

        {zoomed && (
          <button
            type="button"
            onClick={() => setOpenWeek(null)}
            className="mt-1.5 flex w-full cursor-pointer items-center justify-center gap-1 rounded-md py-1 text-[10px] font-semibold tracking-[0.13em] text-[var(--sb-dim)] uppercase transition-colors hover:text-[var(--sb-text)] motion-reduce:transition-none"
          >
            Close week
            <ChevronDown className="size-3 rotate-180" />
          </button>
        )}
      </div>
    </section>
  );
}
