"use client";

import { useState } from "react";

import {
  ANCHORS,
  WINDOW_DAYS,
  WINDOW_DEADLINES,
  dayIndex,
  formatDay,
  formatDayYear,
  isoAt,
  type RangeEnd,
  type WindowDeadline,
} from "@/lib/trip-dates";
import { cn } from "@/lib/utils";

interface TripRailProps {
  startDate: string;
  endDate: string;
  /** Raw candidate date — the strip owns the clamping, for every input path. */
  onChange: (end: RangeEnd, date: string) => void;
}

/** Where a day sits on the rail, 0–1. Every day owns a 1/90th slice. */
function offset(index: number): number {
  return index / WINDOW_DAYS;
}

/** Centre of a day's slice — what a single-day marker points at. */
function centre(index: number): number {
  return (index + 0.5) / WINDOW_DAYS;
}

/**
 * Which day of the window a pointer is over.
 *
 * The track is found from the event target rather than held in a ref: the
 * handles are its children, so `closest` gets there from either, and the
 * geometry stays a pure function of an element and an x.
 */
function dayAtClientX(track: Element, clientX: number): number {
  const rect = track.getBoundingClientRect();
  return Math.round(((clientX - rect.left) / rect.width) * WINDOW_DAYS - 0.5);
}

const TRACK_ATTRIBUTE = "data-rail-track";

const MONTH_BANDS = [
  { label: "December", start: "2026-12-01", end: "2026-12-31" },
  { label: "January", start: "2027-01-01", end: "2027-01-31" },
  { label: "February", start: "2027-02-01", end: "2027-02-28" },
];

function DeadlineMarker({
  deadline,
  open,
  onToggle,
}: {
  deadline: WindowDeadline;
  open: boolean;
  onToggle: () => void;
}) {
  const from = dayIndex(deadline.date);
  const to = deadline.endDate ? dayIndex(deadline.endDate) : from;
  const span = to - from + 1;
  const tone = deadline.tone === "urgent" ? "var(--sb-over)" : "var(--sb-warn)";
  const when = deadline.endDate
    ? `${formatDay(deadline.date)} – ${formatDay(deadline.endDate)}`
    : formatDayYear(deadline.date);

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={`${deadline.label}, ${when}`}
        title={`${deadline.label} · ${when}`}
        className="absolute top-0 bottom-0 cursor-pointer"
        style={{
          left: `${offset(from) * 100}%`,
          width: `max(3px, ${(span / WINDOW_DAYS) * 100}%)`,
        }}
      >
        <span
          aria-hidden
          className={cn(
            "block h-full rounded-[2px] transition-opacity motion-reduce:transition-none",
            open ? "opacity-100" : "opacity-70 hover:opacity-100",
          )}
          style={{
            background:
              span > 1
                ? `repeating-linear-gradient(115deg, ${tone} 0 2px, transparent 2px 5px)`
                : tone,
            boxShadow: span > 1 ? "none" : `0 0 0 2px ${tone}22`,
          }}
        />
      </button>

      {open && (
        <div
          className="sb-panel absolute bottom-[calc(100%+6px)] z-40 w-[248px] p-2.5"
          style={{
            left: `clamp(0px, ${centre(from) * 100}% - 124px, calc(100% - 248px))`,
          }}
        >
          <p
            className="sb-label text-[9px]"
            style={{ color: tone }}
          >
            {when}
          </p>
          <p className="mt-0.5 text-[11px] leading-tight font-semibold">
            {deadline.label}
          </p>
          <p className="mt-1 text-[10px] leading-snug text-[var(--sb-dim)]">
            {deadline.detail}
          </p>
          <p className="sb-num mt-1.5 text-[9px] text-[var(--sb-faint)]">
            {deadline.source}
          </p>
        </div>
      )}
    </>
  );
}

/**
 * The trip's two dates, as a range on a fixed 90-day axis.
 *
 * The axis is the whole bookable window (1 Dec – 28 Feb) rather than the trip,
 * which is what makes dragging stable: a deadline tick and a handle stay at the
 * same pixel scale no matter how the range moves under them, so nothing chases
 * the pointer. The week cells below re-derive from the result.
 *
 * Drag is hand-rolled on pointer events — one capture, no library, and the same
 * code path for mouse, pen and touch. Every handle is also a proper slider:
 * arrows nudge a day, PageUp/PageDown a week, Home/End run to the window's
 * edges, and the header chips take a typed date for anyone who would rather not
 * drag at all.
 */
export function TripRail({ startDate, endDate, onChange }: TripRailProps) {
  const [dragging, setDragging] = useState<RangeEnd | null>(null);
  const [openDeadline, setOpenDeadline] = useState<string | null>(null);

  const startIndex = dayIndex(startDate);
  const endIndex = dayIndex(endDate);

  function move(end: RangeEnd, index: number) {
    const clamped = Math.min(WINDOW_DAYS - 1, Math.max(0, index));
    const next = isoAt(clamped);
    if (next !== (end === "start" ? startDate : endDate)) onChange(end, next);
  }

  function onHandleKeyDown(end: RangeEnd, event: React.KeyboardEvent) {
    const current = end === "start" ? startIndex : endIndex;
    const step =
      event.key === "PageUp" || event.key === "PageDown" ? 7 : 1;
    let next: number | null = null;

    if (event.key === "ArrowLeft" || event.key === "ArrowDown" || event.key === "PageDown") {
      next = current - step;
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "PageUp") {
      next = current + step;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = WINDOW_DAYS - 1;
    }

    if (next === null) return;
    event.preventDefault();
    move(end, next);
  }

  const handleProps = (end: RangeEnd) => {
    const index = end === "start" ? startIndex : endIndex;
    const date = end === "start" ? startDate : endDate;
    return {
      role: "slider" as const,
      tabIndex: 0,
      "aria-label": end === "start" ? "Leaving date" : "Return date",
      "aria-valuemin": 0,
      "aria-valuemax": WINDOW_DAYS - 1,
      "aria-valuenow": index,
      "aria-valuetext": formatDayYear(date),
      onKeyDown: (event: React.KeyboardEvent) => onHandleKeyDown(end, event),
      onPointerDown: (event: React.PointerEvent) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(end);
      },
      onPointerMove: (event: React.PointerEvent) => {
        if (dragging !== end) return;
        const track = event.currentTarget.closest(`[${TRACK_ATTRIBUTE}]`);
        if (track) move(end, dayAtClientX(track, event.clientX));
      },
      onPointerUp: (event: React.PointerEvent) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        setDragging(null);
      },
      onPointerCancel: () => setDragging(null),
      // 44px of touch target, 7px of visible grip: the handles have to be
      // grabbable with a thumb without turning the rail into a toolbar.
      className: cn(
        "group absolute top-1/2 z-30 flex h-11 w-11 -translate-y-1/2",
        "cursor-ew-resize touch-none items-center justify-center outline-none",
      ),
      style: {
        left: `calc(${centre(index) * 100}% - 22px)`,
      },
    };
  };

  return (
    <div className="relative pt-4 pb-3.5 select-none">
      {/* Deadline and anchor ticks, above the track and on the same scale. */}
      <div className="absolute inset-x-0 top-0 h-3.5">
        {WINDOW_DEADLINES.map((deadline) => (
          <DeadlineMarker
            key={deadline.id}
            deadline={deadline}
            open={openDeadline === deadline.id}
            onToggle={() =>
              setOpenDeadline((current) =>
                current === deadline.id ? null : deadline.id,
              )
            }
          />
        ))}
      </div>

      {/* The track. A click anywhere on it moves whichever end is nearer —
          the fast way to shift a date without aiming at a 44px handle. */}
      <div
        {...{ [TRACK_ATTRIBUTE]: "" }}
        onPointerDown={(event) => {
          const day = dayAtClientX(event.currentTarget, event.clientX);
          const end: RangeEnd =
            Math.abs(day - startIndex) <= Math.abs(day - endIndex)
              ? "start"
              : "end";
          move(end, day);
        }}
        className="relative h-2.5 cursor-pointer rounded-full bg-[color-mix(in_srgb,var(--sb-line)_55%,transparent)]"
      >
        {/* Month bands, so the rail reads as a calendar and not a slider. */}
        {MONTH_BANDS.map((band) => (
          <span
            key={band.label}
            aria-hidden
            className="absolute top-0 bottom-0 border-l border-[color-mix(in_srgb,var(--sb-line)_80%,transparent)] first:border-l-0"
            style={{ left: `${offset(dayIndex(band.start)) * 100}%` }}
          />
        ))}

        {/* The trip. */}
        <div
          className="absolute top-0 bottom-0 rounded-full"
          style={{
            left: `${offset(startIndex) * 100}%`,
            width: `${((endIndex - startIndex + 1) / WINDOW_DAYS) * 100}%`,
            background:
              "linear-gradient(90deg, color-mix(in srgb, var(--sb-accent) 70%, transparent), color-mix(in srgb, var(--sb-accent) 92%, transparent))",
          }}
        />

        {/* Anchors ride the track at their true dates: they are calendar
            commitments, so the trip slides past them rather than dragging
            them along. One outside the range is the interesting case — the
            strip says so in its warning line. */}
        {ANCHORS.map((anchor) => {
          const index = dayIndex(anchor.date);
          const inside = index >= startIndex && index <= endIndex;
          return (
            <span
              key={anchor.date}
              title={`${anchor.label} — ${formatDayYear(anchor.date)}. ${anchor.note}`}
              className="absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 text-[9px] leading-none"
              style={{
                left: `${centre(index) * 100}%`,
                color: inside
                  ? "var(--sb-panel)"
                  : "color-mix(in srgb, var(--sb-accent) 75%, transparent)",
                textShadow: inside ? "none" : "0 0 6px var(--sb-ink)",
              }}
            >
              ✦<span className="sr-only">{anchor.label} anchor</span>
            </span>
          );
        })}

        <div {...handleProps("start")}>
          <Grip active={dragging === "start"} />
        </div>
        <div {...handleProps("end")}>
          <Grip active={dragging === "end"} />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3">
        {MONTH_BANDS.map((band) => (
          <span
            key={band.label}
            className="sb-num absolute text-[9px] tracking-[0.1em] text-[var(--sb-faint)] uppercase"
            style={{ left: `calc(${offset(dayIndex(band.start)) * 100}% + 3px)` }}
          >
            {band.label.slice(0, 3)}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The visible part of a handle. The hit area around it is six times wider, and
 * the keyboard focus ring lands here rather than on that invisible box.
 */
function Grip({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "h-5 w-[7px] rounded-full border border-[color-mix(in_srgb,var(--sb-ink)_45%,transparent)]",
        "bg-[var(--sb-accent)] transition-[transform,box-shadow] motion-reduce:transition-none",
        "group-focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--sb-accent)_45%,transparent)]",
        active
          ? "scale-y-125 shadow-[0_0_0_5px_color-mix(in_srgb,var(--sb-accent)_22%,transparent)]"
          : "shadow-[0_1px_6px_rgb(0_0_0/0.45)] group-hover:scale-y-110",
      )}
    />
  );
}
