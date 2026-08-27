"use client";

/**
 * The Scenarios, on one axis (#42).
 *
 * docs/CONTEXT.md's Scenario is "a full alternate calendar for a big fork …
 * compared side by side; exactly one is marked as the current Plan". The HUD
 * compares them as a list of names and figures, which answers *which is
 * cheaper*. This answers *by how much, and how much room is left* — the same
 * totals put on the shared EUR axis the ceiling is drawn on.
 *
 * A dumbbell rather than a bar: each Scenario is a filled dot at its plan-on
 * total, a thin line out to its worst case, and a small dot at the far end. The
 * bar version would draw four bars all starting at zero, and the first €10,000
 * of every Plan is identical and uninteresting; what the couple is comparing is
 * the last couple of thousand and the length of the tail.
 *
 * Colour is **identity**, and identity is the Scenario's position in the saved
 * list — never its rank here. Re-sorting the comparison must not repaint a row,
 * or "Doof NYE is the violet one" stops being true the moment a fork gets
 * cheaper. Past the three validated slots the rest share the neutral, which is
 * the documented fold; every row is named on its own line, so nothing rests on
 * hue alone in any case.
 */

import { useId, useState } from "react";

import { formatEur, BUDGET_CEILING_EUR } from "@/lib/engine";
import type { ScenarioTotal } from "@/lib/engine/scenarios";
import {
  ChartCard,
  ChartTooltip,
  ChartTable,
  niceTicks,
  scenarioInk,
  tickLabel,
  useMeasure,
  type LegendItem,
} from "@/components/budget-chart";
import { cn } from "@/lib/utils";

const ROW = 30;
const PAD = { top: 10, right: 14, bottom: 24 };

export function ScenarioCompare({
  totals,
  onSelect,
}: {
  totals: ScenarioTotal[];
  onSelect: (id: string) => void;
}) {
  const [box, width] = useMeasure<HTMLDivElement>();
  const [tableOpen, setTableOpen] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const tableId = useId();

  // Narrow screens give the names less room; the axis needs what is left.
  const labelWidth = width > 0 && width < 420 ? 84 : 116;
  const plotWidth = Math.max(0, width - labelWidth - PAD.right);
  const height = PAD.top + totals.length * ROW + PAD.bottom;

  const max = Math.max(
    BUDGET_CEILING_EUR,
    ...totals.map((total) => total.worstCaseEur),
  );
  const ticks = niceTicks(max * 1.04, 4);
  const top = Math.max(max * 1.04, ticks.at(-1) ?? max);
  const x = (value: number) => labelWidth + (value / top) * plotWidth;
  const rowY = (index: number) => PAD.top + index * ROW + ROW / 2;

  const legend: LegendItem[] = [
    { label: "Plan-on total", color: "var(--sb-dim)", kind: "rect" },
    { label: "Worst case", color: "var(--sb-faint)", kind: "line", thin: true },
  ];

  const active = hovered === null ? null : totals[hovered];

  return (
    <ChartCard
      title="Scenarios, side by side"
      subtitle="Each Scenario's plan-on total, with its tail out to the worst case. Pick one to make it the Plan."
      legend={legend}
      tableId={tableId}
      tableOpen={tableOpen}
      onTableToggle={() => setTableOpen((value) => !value)}
    >
      <div ref={box} className="relative mt-3">
        {width > 0 && totals.length > 0 && (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`Scenario comparison: ${totals.map((total) => `${total.name} ${formatEur(total.totalEur)}`).join(", ")}.`}
            aria-describedby={tableId}
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={x(tick)}
                  x2={x(tick)}
                  y1={PAD.top - 2}
                  y2={height - PAD.bottom}
                  stroke="var(--sb-line)"
                  strokeWidth={1}
                  opacity={0.5}
                />
                <text
                  x={x(tick)}
                  y={height - 8}
                  textAnchor="middle"
                  className="sb-num fill-[var(--sb-faint)] text-[9.5px]"
                >
                  {tickLabel(tick)}
                </text>
              </g>
            ))}

            {/* The ceiling, the one reference every row is read against. */}
            <line
              x1={x(BUDGET_CEILING_EUR)}
              x2={x(BUDGET_CEILING_EUR)}
              y1={PAD.top - 2}
              y2={height - PAD.bottom}
              stroke="color-mix(in srgb, var(--sb-over) 55%, transparent)"
              strokeWidth={1}
            />

            {totals.map((total, index) => {
              const { ink, dim } = scenarioInk(index);
              const y = rowY(index);
              const over = total.totalEur > BUDGET_CEILING_EUR;
              return (
                <g key={total.id}>
                  <text
                    x={0}
                    y={y + 3.5}
                    className={cn(
                      "text-[10.5px]",
                      total.current
                        ? "fill-[var(--sb-text)] font-semibold"
                        : "fill-[var(--sb-dim)]",
                    )}
                  >
                    {total.name.length > (labelWidth < 100 ? 11 : 16)
                      ? `${total.name.slice(0, labelWidth < 100 ? 10 : 15)}…`
                      : total.name}
                  </text>

                  {/* The tail: plan-on out to the worst case. */}
                  <line
                    x1={x(total.totalEur)}
                    x2={x(total.worstCaseEur)}
                    y1={y}
                    y2={y}
                    stroke={dim}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                  <circle cx={x(total.worstCaseEur)} cy={y} r={3} fill={dim} />
                  <circle
                    cx={x(total.totalEur)}
                    cy={y}
                    r={total.current ? 6 : 5}
                    fill={ink}
                    stroke="var(--sb-panel)"
                    strokeWidth={2}
                  />

                  {/* Direct label, in text ink, on the surface — never inside a
                      mark. It sits left of the plan-on dot when the tail would
                      otherwise run it off the right edge. */}
                  <text
                    x={
                      x(total.worstCaseEur) + 88 > width
                        ? x(total.totalEur) - 11
                        : x(total.worstCaseEur) + 9
                    }
                    y={y + 3.5}
                    textAnchor={
                      x(total.worstCaseEur) + 88 > width ? "end" : "start"
                    }
                    className={cn(
                      "sb-num text-[10.5px]",
                      over
                        ? "fill-[var(--sb-over)] font-semibold"
                        : total.current
                          ? "fill-[var(--sb-text)] font-semibold"
                          : "fill-[var(--sb-dim)]",
                    )}
                  >
                    {formatEur(total.totalEur)}
                  </text>

                  {/* The hit target is the whole row, not the 10px dot. */}
                  <rect
                    x={0}
                    y={y - ROW / 2}
                    width={Math.max(0, width)}
                    height={ROW}
                    fill="transparent"
                    className="cursor-pointer"
                    onPointerEnter={() => setHovered(index)}
                    onPointerLeave={() => setHovered(null)}
                    onClick={() => onSelect(total.id)}
                  />
                </g>
              );
            })}
          </svg>
        )}

        {active && hovered !== null && (
          <ChartTooltip
            x={Math.min(x(active.totalEur), width - 20)}
            y={rowY(hovered)}
            width={width}
            title={`${active.name}${active.current ? " · current Plan" : ""}`}
            rows={[
              {
                label: "Plan-on total",
                value: formatEur(active.totalEur),
                color: scenarioInk(hovered).ink,
              },
              {
                label: "Worst case",
                value: formatEur(active.worstCaseEur),
                color: scenarioInk(hovered).dim,
              },
              { label: "Days", value: `${active.dayCount}` },
              { label: "Warnings", value: `${active.warnings}` },
            ]}
          />
        )}
      </div>

      {/* Every Scenario is also a button, so the comparison is operable without
          a pointer — the SVG rows are a pointer affordance, not the only one. */}
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {totals.map((total, index) => (
          <li key={total.id}>
            <button
              type="button"
              onClick={() => onSelect(total.id)}
              aria-current={total.current}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sb-accent)] motion-reduce:transition-none",
                total.current
                  ? "border-transparent bg-[var(--sb-panel-2)] font-semibold text-[var(--sb-text)]"
                  : "border-[var(--sb-line)] text-[var(--sb-dim)] hover:bg-[var(--sb-panel-2)]",
              )}
            >
              <span
                aria-hidden
                className="inline-block size-2 rounded-full"
                style={{ background: scenarioInk(index).ink }}
              />
              {total.name}
            </button>
          </li>
        ))}
      </ul>

      <ChartTable
        id={tableId}
        open={tableOpen}
        caption="Every Scenario's plan-on total, honest band and worst case, in EUR per couple."
        columns={["Scenario", "Days", "Plan-on", "Worst case", "Warnings"]}
        rows={totals.map((total) => [
          total.current ? `${total.name} (current Plan)` : total.name,
          `${total.dayCount}`,
          formatEur(total.totalEur),
          formatEur(total.worstCaseEur),
          `${total.warnings}`,
        ])}
      />
    </ChartCard>
  );
}
