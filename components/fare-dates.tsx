"use client";

/**
 * Every day in the window, choosable — and honest about which ones are free.
 *
 * The Flights page used to offer three departure dates, because three dates per
 * route is what the cron warms and the API refused everything else. That made
 * the page a fare *sample* pretending to be a fare calendar: "is there a
 * cheaper day" is the first question anybody asks about a long-haul, and the
 * answer was three days wide.
 *
 * So this is the whole window — 1 Dec 2026 to 28 Feb 2027 — in two controls
 * that share one coordinate system:
 *
 * - **A strip** of nine days centred on the selection, for the move people
 *   actually make: a day either side, then another, watching the price move.
 * - **A month popover** covering December, January and February, for the jump
 *   the strip cannot make in one click.
 *
 * Both are dotted with what is already known, and the dots outlived the gate
 * they were built beside. A day carrying a stored fare shows its cheapest price
 * in the cell: looking at it costs nothing and returns instantly. A day the cron
 * warms shows a hollow mark — on the list, not necessarily priced. Everything
 * else is plain, and choosing one prices it live there and then (#68: *"just
 * make the calls"*). What the dots are for now is knowing which days are
 * instant and which take a moment, rather than which ones need permission.
 */

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { formatEurCompact } from "@/lib/engine";
import {
  WINDOW_DAYS,
  WINDOW_END,
  WINDOW_START,
  dayIndex,
  formatDayYear,
  isoAt,
  weekdayOf,
} from "@/lib/trip-dates";
import { cn } from "@/lib/utils";

/** What the page knows about one day, folded across every origin it searches. */
export interface DayCoverage {
  /** `history` holds a stored price; `warm` is only on the cron's list. */
  source: "history" | "warm";
  /** Cheapest stored per-person fare on this day, when there is one. */
  cheapestEur: number | null;
  /** How many origins hold an observation for it. */
  routes: number;
}

export type CoverageByDate = ReadonlyMap<string, DayCoverage>;

/** Days either side of the selection the strip shows. */
const STRIP_RADIUS = 4;
const STRIP_SPAN = STRIP_RADIUS * 2 + 1;

const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

/** Monday-first column, 0–6. `weekdayOf` is Sunday-first. */
const columnOf = (iso: string): number => (weekdayOf(iso) + 6) % 7;

const MONTHS = [
  { prefix: "2026-12", label: "December 2026" },
  { prefix: "2027-01", label: "January 2027" },
  { prefix: "2027-02", label: "February 2027" },
] as const;

/** Every day of the window, once, so no month-length table has to be right. */
const WINDOW_DATES: readonly string[] = Array.from({ length: WINDOW_DAYS }, (_, index) =>
  isoAt(index),
);

/* ------------------------------------------------------------------ */
/* One day                                                             */
/* ------------------------------------------------------------------ */

/**
 * What a day's mark means, in one string, wherever the day is drawn.
 *
 * The strip and the calendar say the same thing about the same day, because
 * they are the same claim — and a calendar whose dots mean something different
 * from the strip's would be worse than no dots at all.
 */
function describeDay(date: string, coverage: DayCoverage | undefined, isDefault: boolean): string {
  const day = formatDayYear(date);
  if (coverage?.source === "history") {
    return `${day} — already priced${
      coverage.cheapestEur !== null ? `, from €${Math.round(coverage.cheapestEur)} pp` : ""
    } across ${coverage.routes} origin${coverage.routes === 1 ? "" : "s"}. Free and instant.`;
  }
  if (coverage?.source === "warm") {
    return `${day} — on the weekly warm list${
      isDefault ? " and this search's default" : ""
    }, so it is normally a cache hit. No stored price yet.`;
  }
  return `${day} — nothing stored yet. Choosing it prices the origins that have nothing on this day, live, and stores what lands.`;
}

/**
 * The mark under a day: its price if one is known, a hollow tick if the cron
 * pays for it, nothing at all if it is cold.
 *
 * A price is the strongest thing a cell can say and the only one worth ink, so
 * the known days carry the number and everything else stays quiet. Tabular
 * figures, so a column of them reads as a column.
 */
function DayMark({ coverage, muted }: { coverage: DayCoverage | undefined; muted: boolean }) {
  if (coverage?.source === "history" && coverage.cheapestEur !== null) {
    return (
      <span
        className={cn(
          "sb-num block text-[9px] leading-none font-semibold tabular-nums",
          muted ? "text-[var(--sb-dim)]" : "text-[var(--sb-good)]",
        )}
      >
        {formatEurCompact(coverage.cheapestEur)}
      </span>
    );
  }
  if (coverage) {
    return (
      <span
        aria-hidden
        className="mx-auto block size-1.5 rounded-full border border-[var(--sb-dim)]"
      />
    );
  }
  return <span aria-hidden className="block h-1.5" />;
}

/* ------------------------------------------------------------------ */
/* The month popover                                                   */
/* ------------------------------------------------------------------ */

function MonthGrid({
  prefix,
  label,
  value,
  coverage,
  defaultDate,
  onPick,
}: {
  prefix: string;
  label: string;
  value: string;
  coverage: CoverageByDate;
  defaultDate: string;
  onPick: (date: string) => void;
}) {
  const days = useMemo(
    () => WINDOW_DATES.filter((date) => date.startsWith(prefix)),
    [prefix],
  );
  const lead = days.length > 0 ? columnOf(days[0]) : 0;

  return (
    <section className="min-w-0">
      <h3 className="sb-label text-[9px]">{label}</h3>
      <div className="mt-1 grid grid-cols-7 gap-px" aria-hidden>
        {WEEKDAY_INITIALS.map((initial, index) => (
          <span
            key={`${initial}-${index}`}
            className="sb-num text-center text-[8px] text-[var(--sb-faint)]"
          >
            {initial}
          </span>
        ))}
      </div>
      <div className="mt-0.5 grid grid-cols-7 gap-px">
        {Array.from({ length: lead }, (_, index) => (
          <span key={`lead-${index}`} />
        ))}
        {days.map((date) => {
          const day = coverage.get(date);
          const selected = date === value;
          return (
            <button
              key={date}
              type="button"
              onClick={() => onPick(date)}
              aria-current={selected ? "date" : undefined}
              title={describeDay(date, day, date === defaultDate)}
              className={cn(
                "cursor-pointer rounded-md border px-0.5 py-[3px] text-center transition-colors motion-reduce:transition-none",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--sb-accent)]",
                selected
                  ? "border-[var(--sb-accent)] bg-[color-mix(in_srgb,var(--sb-accent)_16%,transparent)]"
                  : "border-transparent hover:border-[var(--sb-line)] hover:bg-[var(--sb-panel-2)]",
              )}
            >
              <span
                className={cn(
                  "sb-num block text-[10.5px] leading-none font-semibold tabular-nums",
                  selected
                    ? "text-[var(--sb-accent)]"
                    : day
                      ? "text-[var(--sb-text)]"
                      : "text-[var(--sb-dim)]",
                )}
              >
                {Number(date.slice(8, 10))}
              </span>
              <span className="mt-[3px] block">
                <DayMark coverage={day} muted={selected} />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The field                                                           */
/* ------------------------------------------------------------------ */

export interface FareDateFieldProps {
  label: string;
  value: string;
  onChange: (date: string) => void;
  coverage: CoverageByDate;
  /** The warmed day this search starts on, so the strip can mark it. */
  defaultDate: string;
}

export function FareDateField({
  label,
  value,
  onChange,
  coverage,
  defaultDate,
}: FareDateFieldProps) {
  const [open, setOpen] = useState(false);
  const popover = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Nine cells, always nine: at the window's edges the strip stops sliding and
  // the selection moves within it, rather than the row losing cells and the
  // controls under it jumping half an inch sideways.
  const index = dayIndex(value);
  const centre = Math.min(Math.max(index, STRIP_RADIUS), WINDOW_DAYS - 1 - STRIP_RADIUS);
  const days = useMemo(
    () => Array.from({ length: STRIP_SPAN }, (_, offset) => isoAt(centre - STRIP_RADIUS + offset)),
    [centre],
  );

  const step = (delta: number) => {
    const next = Math.min(WINDOW_DAYS - 1, Math.max(0, index + delta));
    if (next !== index) onChange(isoAt(next));
  };

  // Escape and an outside click close it, as they do everywhere else on the
  // site. A popover that only closes by re-clicking its own button is a trap on
  // a phone, where the button is under a thumb and the calendar is not.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!popover.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div className="min-w-0" ref={popover}>
      <p className="sb-label flex items-baseline gap-1.5 text-[9px]">
        {label}
        <span className="sb-num tracking-normal text-[var(--sb-text)] normal-case">
          {formatDayYear(value)}
        </span>
      </p>

      <div className="relative mt-1 flex items-stretch gap-1">
        <StepButton
          direction="back"
          disabled={index === 0}
          onClick={() => step(-1)}
          date={isoAt(Math.max(0, index - 1))}
        />

        {/* The strip scrolls on its own, and this is the container that lets it
            (#96).

            Nine 38px cells plus their gaps are 374px wide, and with the ‹ ›
            steppers and the "All 90 days" button on the same row the row wants
            about 450px. That is wider than a 375px phone, and with nothing here
            to catch it the overflow used to fall through to the page's own
            scroller: /flights measured 462px against a 375px column and the
            whole page — watchlist, ranked rows, headings — slid sideways.

            `min-w-0` is what makes it shrink rather than push, and the cells
            keep their width (`shrink-0`) so a scrolled strip still reads as
            days rather than as slivers. The vertical padding is bought back
            with a negative margin: `overflow-x` computes `overflow-y` to
            `auto` as well, which would otherwise clip the cells' focus ring. */}
        <div className="sb-scroll -my-1 min-w-0 flex-1 overflow-x-auto py-1">
          <ul className="flex w-max gap-1">
            {days.map((date) => {
              const day = coverage.get(date);
              const selected = date === value;
              return (
                <li key={date} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => onChange(date)}
                    aria-current={selected ? "date" : undefined}
                    title={describeDay(date, day, date === defaultDate)}
                    className={cn(
                      "flex min-h-8 w-[38px] cursor-pointer flex-col items-center justify-center rounded-md border px-1 py-1 transition-colors motion-reduce:transition-none",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sb-accent)]",
                      selected
                        ? "border-[var(--sb-accent)] bg-[color-mix(in_srgb,var(--sb-accent)_16%,transparent)]"
                        : "border-[var(--sb-line)] bg-[var(--sb-panel)] hover:bg-[var(--sb-panel-2)]",
                    )}
                  >
                    <span
                      className={cn(
                        "block text-[8px] leading-none tracking-[0.08em] uppercase",
                        selected ? "text-[var(--sb-accent)]" : "text-[var(--sb-faint)]",
                      )}
                    >
                      {WEEKDAY_INITIALS[columnOf(date)]}
                    </span>
                    <span
                      className={cn(
                        "sb-num mt-[3px] block text-[11.5px] leading-none font-semibold tabular-nums",
                        selected ? "text-[var(--sb-accent)]" : "text-[var(--sb-text)]",
                      )}
                    >
                      {Number(date.slice(8, 10))}
                    </span>
                    <span className="mt-[3px] block">
                      <DayMark coverage={day} muted={selected} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <StepButton
          direction="forward"
          disabled={index === WINDOW_DAYS - 1}
          onClick={() => step(1)}
          date={isoAt(Math.min(WINDOW_DAYS - 1, index + 1))}
        />

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls={panelId}
          title={`Jump anywhere between ${formatDayYear(WINDOW_START)} and ${formatDayYear(WINDOW_END)}`}
          className={cn(
            "flex min-h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md border px-2 text-[10px] font-semibold transition-colors motion-reduce:transition-none",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sb-accent)]",
            open
              ? "border-[var(--sb-accent)] bg-[color-mix(in_srgb,var(--sb-accent)_16%,transparent)] text-[var(--sb-accent)]"
              : "border-[var(--sb-line)] bg-[var(--sb-panel)] text-[var(--sb-dim)] hover:bg-[var(--sb-panel-2)] hover:text-[var(--sb-text)]",
          )}
        >
          <CalendarDays className="size-3.5 shrink-0" aria-hidden />
          <span className="hidden sm:inline">All 90 days</span>
        </button>

        {open && (
          <div
            id={panelId}
            className="sb-panel absolute top-[calc(100%+6px)] left-0 z-40 w-[min(30rem,calc(100vw-2rem))] p-3"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {MONTHS.map((month) => (
                <MonthGrid
                  key={month.prefix}
                  prefix={month.prefix}
                  label={month.label}
                  value={value}
                  coverage={coverage}
                  defaultDate={defaultDate}
                  onPick={(date) => {
                    onChange(date);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
            <p className="mt-2.5 border-t border-[var(--sb-line)] pt-2 text-[10px] leading-snug text-[var(--sb-dim)]">
              <span className="font-semibold text-[var(--sb-good)]">A price</span> means
              that day is already stored — free to look at, and instant. A{" "}
              <span
                aria-hidden
                className="mx-0.5 inline-block size-1.5 translate-y-[-1px] rounded-full border border-[var(--sb-dim)] align-middle"
              />
              means the weekly warm covers it. A plain day has nothing stored yet:
              choosing it prices the missing origins live and keeps what lands, so it
              is only ever cold once.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StepButton({
  direction,
  disabled,
  onClick,
  date,
}: {
  direction: "back" | "forward";
  disabled: boolean;
  onClick: () => void;
  date: string;
}) {
  const Icon = direction === "back" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={
        direction === "back" ? `A day earlier — ${formatDayYear(date)}` : `A day later — ${formatDayYear(date)}`
      }
      className="flex min-h-8 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border border-[var(--sb-line)] bg-[var(--sb-panel)] text-[var(--sb-dim)] transition-colors hover:bg-[var(--sb-panel-2)] hover:text-[var(--sb-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sb-accent)] disabled:cursor-default disabled:opacity-40 motion-reduce:transition-none"
    >
      <Icon className="size-3.5" aria-hidden />
    </button>
  );
}
