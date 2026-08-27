"use client";

/**
 * The pieces every chart on /budget is made of (#42).
 *
 * Hand-rolled SVG, no charting library. That is not asceticism: three charts
 * with this much domain in them — a reference band that is not a series, a
 * crossing marker with a direct label, a category split whose fourth bar is a
 * toggle away from being zero — spend more effort fighting a library's idea of
 * a chart than they do drawing one. What a library really sells is axes,
 * scales and a hover layer, and those are the sixty lines below.
 *
 * What is *not* negotiable is the dataviz method the shapes follow, so the
 * rules live here rather than being retyped in three files:
 *
 * - **Text wears text tokens.** Series colour is for marks. A value, a label
 *   and a legend entry are `--sb-text` / `--sb-dim` / `--sb-faint`, always, and
 *   identity comes from the swatch beside them.
 * - **Every chart has a table.** Not a fallback nobody can reach — a real
 *   `<table>` with the same numbers, screen-reader-visible at all times and one
 *   button away from being on screen. A tooltip may enhance a value; it may
 *   never be the only way to read one.
 * - **Grid and axes recede.** Solid hairlines one step off the surface, never
 *   dashed: a dashed rule reads as a threshold, and this page has real
 *   thresholds to draw.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Measuring                                                           */
/* ------------------------------------------------------------------ */

/**
 * The rendered width of the box a chart is drawn in.
 *
 * An SVG with a `viewBox` and no measurement scales its text along with its
 * geometry, so a chart that is legible at 1280px has 6px axis labels at 375px.
 * Measuring instead means the type stays 10px at every width and the *geometry*
 * reflows, which is the only version of "responsive" a chart can honestly
 * claim. Zero until the first observation, which is the server render and the
 * first paint — every caller has to hold that case.
 */
export function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      setWidth((current) => (Math.abs(current - next) < 0.5 ? current : next));
    });
    observer.observe(node);
    setWidth(node.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

/* ------------------------------------------------------------------ */
/* Scales and ticks                                                    */
/* ------------------------------------------------------------------ */

/** Round tick steps, so an axis reads 0 / 5,000 / 10,000 and not 0 / 4,317. */
const STEPS = [100, 250, 500, 1_000, 2_000, 2_500, 5_000, 10_000, 20_000];

export function niceTicks(max: number, target = 5): number[] {
  if (max <= 0) return [0];
  const step =
    STEPS.find((candidate) => max / candidate <= target) ?? STEPS.at(-1)!;
  const ticks: number[] = [];
  for (let value = 0; value <= max + step * 0.001; value += step) {
    ticks.push(value);
  }
  return ticks;
}

/** "€12k" — an axis tick has no room for four digits and a separator. */
export function tickLabel(value: number): string {
  if (value === 0) return "€0";
  if (value >= 1_000) {
    const thousands = value / 1_000;
    return `€${thousands % 1 === 0 ? thousands : thousands.toFixed(1)}k`;
  }
  return `€${value}`;
}

/* ------------------------------------------------------------------ */
/* Chart chrome                                                        */
/* ------------------------------------------------------------------ */

export interface LegendItem {
  label: string;
  /** A CSS colour — a token reference, never a literal. */
  color: string;
  /** Lines get a line key; fills get a swatch. The legend mirrors the mark. */
  kind: "line" | "rect";
  /** A thinner key for a de-emphasised series. */
  thin?: boolean;
}

/**
 * The legend.
 *
 * Present whenever a chart carries two or more series, absent when it carries
 * one — a single-swatch box restates the title and costs a line of space. The
 * swatch is the only place the series colour appears in the chrome; the text
 * beside it is ordinary label ink.
 */
export function Legend({ items }: { items: LegendItem[] }) {
  if (items.length < 2) return null;
  return (
    <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-1.5 text-[10.5px] text-[var(--sb-dim)]"
        >
          {item.kind === "line" ? (
            <span
              aria-hidden
              className="inline-block w-3.5 rounded-full"
              style={{
                height: item.thin ? 1.5 : 2.5,
                background: item.color,
              }}
            />
          ) : (
            <span
              aria-hidden
              className="inline-block size-2.5 rounded-[2px]"
              style={{ background: item.color }}
            />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * A chart's accessible twin.
 *
 * The dataviz method asks for a table with the same numbers, and asks for it to
 * be *reachable* — so this is never `display: none`. At rest it is `sr-only`,
 * which keeps it in the accessibility tree and in the tab order for anyone
 * reading with a screen reader, and the toggle above it puts it on screen for
 * anyone who would simply rather read the figures. Same DOM either way, so the
 * two can never drift.
 */
export function ChartTable({
  caption,
  columns,
  rows,
  open,
  id,
}: {
  caption: string;
  columns: string[];
  rows: (readonly string[])[];
  open: boolean;
  id: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        open
          ? "sb-scroll mt-3 max-h-64 overflow-y-auto rounded-lg border border-[var(--sb-line)]"
          : "sr-only",
      )}
    >
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-[var(--sb-panel)]">
          <tr>
            {columns.map((column, index) => (
              <th
                key={column}
                scope="col"
                className={cn(
                  "sb-label border-b border-[var(--sb-line)] px-2.5 py-1.5 text-[9px] whitespace-nowrap",
                  index > 0 && "text-right",
                )}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-b border-[var(--sb-line)] last:border-0">
              {row.map((cell, index) => (
                <td
                  key={columns[index]}
                  className={cn(
                    "px-2.5 py-1 text-[11px] text-[var(--sb-dim)]",
                    index > 0 && "sb-num text-right",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * One chart, framed.
 *
 * Title and subtitle carry what a legend would otherwise have to say for a
 * single-series chart; the legend slot is for the charts that really do have
 * two. The table toggle sits in the header rather than under the plot so it is
 * reachable before the reader has scrolled past the thing it describes.
 */
export function ChartCard({
  title,
  subtitle,
  legend,
  tableId,
  tableOpen,
  onTableToggle,
  children,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  legend?: LegendItem[];
  tableId: string;
  tableOpen: boolean;
  onTableToggle: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)] p-3.5 sm:p-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
        <div className="min-w-0">
          <h2 className="font-display text-[15px] leading-tight font-bold tracking-[-0.01em] text-[var(--sb-text)]">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--sb-dim)]">
              {subtitle}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onTableToggle}
          aria-expanded={tableOpen}
          aria-controls={tableId}
          className="shrink-0 cursor-pointer rounded-md border border-[var(--sb-line)] px-2 py-1 text-[10px] font-semibold text-[var(--sb-dim)] transition-colors hover:bg-[var(--sb-panel-2)] hover:text-[var(--sb-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sb-accent)] motion-reduce:transition-none"
        >
          {tableOpen ? "Hide numbers" : "Numbers"}
        </button>
      </div>

      {legend && legend.length > 1 && (
        <div className="mt-2">
          <Legend items={legend} />
        </div>
      )}

      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Tooltip                                                             */
/* ------------------------------------------------------------------ */

export interface TooltipRow {
  label: string;
  value: string;
  /** Draws the series' line key beside the row. Omit for a plain row. */
  color?: string;
}

/**
 * The hover readout.
 *
 * Values lead and labels follow — the reader already knows which series they
 * are looking at and wants the number, which is the legend's hierarchy
 * inverted. Positioned by the caller in the plot's own coordinates and flipped
 * before it can leave the box, because a tooltip that overflows the card is
 * how a chart grows a horizontal scrollbar on a phone.
 */
export function ChartTooltip({
  x,
  y,
  width,
  title,
  rows,
}: {
  x: number;
  y: number;
  width: number;
  title: string;
  rows: TooltipRow[];
}) {
  const BOX = 168;
  const flip = x + BOX + 14 > width;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute z-10 rounded-lg border border-[var(--sb-line)] bg-[var(--sb-panel)] px-2.5 py-2 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.5)]"
      style={{
        width: BOX,
        left: flip ? x - BOX - 12 : x + 12,
        top: Math.max(0, y - 8),
      }}
    >
      <p className="sb-label text-[9px]">{title}</p>
      <dl className="mt-1 flex flex-col gap-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-2">
            <dt className="flex items-center gap-1.5 text-[10px] text-[var(--sb-dim)]">
              {row.color && (
                <span
                  aria-hidden
                  className="inline-block h-[2px] w-3 rounded-full"
                  style={{ background: row.color }}
                />
              )}
              {row.label}
            </dt>
            <dd className="sb-num text-[11.5px] font-semibold text-[var(--sb-text)]">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scenario identity                                                   */
/* ------------------------------------------------------------------ */

/**
 * A Scenario's colour, by its position in the saved list.
 *
 * Position, never rank: sorting the comparison by cost must not repaint the
 * rows, or a reader who learned "Doof NYE is the violet one" is misled the
 * moment the order changes. Three validated identity slots, then the neutral —
 * the documented fold, rather than a generated fourth hue that would collapse
 * against one of the three under deuteranopia.
 */
const SCENARIO_INK = [
  { ink: "var(--sb-series-1)", dim: "var(--sb-series-1-dim)" },
  { ink: "var(--sb-series-2)", dim: "var(--sb-series-2-dim)" },
  { ink: "var(--sb-series-3)", dim: "var(--sb-series-3-dim)" },
] as const;

const SCENARIO_NEUTRAL = {
  ink: "var(--sb-series-n)",
  dim: "var(--sb-series-n-dim)",
} as const;

export function scenarioInk(index: number) {
  return SCENARIO_INK[index] ?? SCENARIO_NEUTRAL;
}

/* ------------------------------------------------------------------ */
/* Pointer helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * Nearest index under the pointer, in plot coordinates.
 *
 * The crosshair finds the X so the reader can aim at a date rather than at a
 * 2px line — on a 36-day trip drawn 900px wide each day owns 25px, and on a
 * phone it owns 9px, which is exactly why nobody should have to hit the line
 * itself.
 */
export function useNearestIndex(count: number) {
  const [index, setIndex] = useState<number | null>(null);

  const find = useCallback(
    (offsetX: number, left: number, plotWidth: number) => {
      if (count < 1 || plotWidth <= 0) return;
      const ratio = (offsetX - left) / plotWidth;
      const at = Math.round(ratio * (count - 1));
      setIndex(Math.min(count - 1, Math.max(0, at)));
    },
    [count],
  );

  const clear = useCallback(() => setIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setIndex((current) => {
        const from = current ?? 0;
        return Math.min(count - 1, Math.max(0, from + delta));
      }),
    [count],
  );

  return { index, find, clear, step, setIndex };
}
