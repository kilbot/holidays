"use client";

/**
 * The burn-down — /budget's centrepiece (#42).
 *
 * Cumulative spend across the trip's own days, read against the €12k–€20k
 * Budget band. It answers the question the HUD's single figure cannot: *when*
 * the money goes, and whether the ceiling arrives before the flight home does.
 *
 * Four decisions worth stating, because each has an obvious wrong version:
 *
 * - **The band is not a series.** €12k floor to €20k ceiling is a reference
 *   region, so it is drawn as a shaded region behind everything with hairline
 *   edges — not as two more lines competing with the two that carry data.
 *   docs/CONTEXT.md is explicit that the Budget is a ceiling, never a target;
 *   a band drawn like a series invites reading it as one.
 * - **Two lines, one measure.** Plan-on and worst case are the same money at
 *   two confidence levels, so they take one hue at two steps rather than two
 *   identities — and the dim step is thinner, because the worst case is the
 *   thing you check, not the thing you read.
 * - **The crossing is a state, so it wears a state colour.** `--sb-over` is
 *   reserved for a breached ceiling everywhere else on the site, and this is
 *   the same event drawn larger. It carries a direct label, because a marker
 *   whose meaning lives only in a tooltip is a marker most readers never read.
 * - **No booking deadlines.** The x-axis is trip time. 1 October fares and
 *   festival on-sales are calendar-time facts about when to *buy*, they belong
 *   to the date rail, and a marker for one would have nowhere to stand on an
 *   axis that starts in December.
 */

import { useId, useState } from "react";

import { formatEur, type BurnDown } from "@/lib/engine";
import { formatDay, formatDayYear } from "@/lib/trip-dates";
import {
  ChartCard,
  ChartTooltip,
  ChartTable,
  niceTicks,
  tickLabel,
  useMeasure,
  useNearestIndex,
  type LegendItem,
} from "@/components/budget-chart";

const PAD = { top: 18, right: 16, bottom: 26, left: 46 };

/** Room for the two end labels and the crossing label without a squeeze. */
const NARROW = 560;

/**
 * Which dates get an axis tick.
 *
 * Month starts, plus the first and last day of the trip so the axis says what
 * range it covers. Ticks too close to a neighbour are dropped rather than
 * overprinted — a "1 Jan" sitting on top of "31 Dec" is worse than no tick.
 */
function axisTicks(dates: string[], plotWidth: number): number[] {
  if (dates.length === 0) return [];
  const wanted = new Set<number>([0, dates.length - 1]);
  dates.forEach((date, index) => {
    if (date.slice(8, 10) === "01") wanted.add(index);
  });

  const minGap = plotWidth < NARROW ? 64 : 52;
  const perDay = plotWidth / Math.max(1, dates.length - 1);
  const kept: number[] = [];
  for (const index of [...wanted].sort((a, b) => a - b)) {
    const last = kept.at(-1);
    // The final tick wins a collision: it is the one that says where the trip
    // ends, and dropping it leaves the axis looking truncated.
    if (last !== undefined && (index - last) * perDay < minGap) {
      if (index === dates.length - 1) kept.pop();
      else continue;
    }
    kept.push(index);
  }
  return kept;
}

export function BurnDownChart({
  burn,
  fxRate,
  ink,
  dimInk,
  scenarioName,
}: {
  burn: BurnDown;
  fxRate: number;
  /** The current Scenario's identity colour. The curve belongs to a Scenario. */
  ink: string;
  dimInk: string;
  scenarioName: string;
}) {
  const [box, width] = useMeasure<HTMLDivElement>();
  const [tableOpen, setTableOpen] = useState(false);
  const tableId = useId();
  const { points } = burn;
  const hover = useNearestIndex(points.length);

  const height = width > 0 && width < NARROW ? 236 : 306;
  const plotWidth = Math.max(0, width - PAD.left - PAD.right);
  const plotHeight = height - PAD.top - PAD.bottom;

  // The ceiling is always in view even when the Plan is nowhere near it: a
  // burn-down scaled to its own maximum hides the only reference that matters.
  const yMax = Math.max(burn.ceilingEur, burn.worstTotal) * 1.08;
  const ticks = niceTicks(yMax);
  const top = Math.max(yMax, ticks.at(-1) ?? yMax);

  const x = (index: number) =>
    PAD.left + (points.length < 2 ? 0 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) => PAD.top + (1 - value / top) * plotHeight;

  const line = (pick: (index: number) => number) =>
    points.map((_, index) => `${x(index)},${y(pick(index))}`).join(" ");

  const planOnPath = line((index) => points[index].planOnEur);
  const worstPath = line((index) => points[index].worstEur);
  const areaPath =
    points.length > 1
      ? `M ${x(0)},${y(0)} L ${planOnPath.replaceAll(" ", " L ")} L ${x(points.length - 1)},${y(0)} Z`
      : "";

  const last = points.at(-1);
  const dates = points.map((point) => point.date);
  const tickIndexes = axisTicks(dates, plotWidth);
  const active = hover.index === null ? null : points[hover.index];

  const legend: LegendItem[] = [
    { label: "Plan-on", color: ink, kind: "line" },
    { label: "Worst case", color: dimInk, kind: "line", thin: true },
  ];

  const crossing = burn.crossing;
  const crossingX = crossing ? x(points.findIndex((p) => p.index === crossing.index)) : 0;
  const crossingY = crossing ? y(crossing.eur) : 0;
  const crossingLeft = crossingX > PAD.left + plotWidth * 0.55;

  return (
    <ChartCard
      title="Burn-down"
      subtitle={
        <>
          Cumulative spend across the trip, against the €12k–€20k Budget band.
          Plan-on figures for{" "}
          <span className="font-semibold text-[var(--sb-text)]">{scenarioName}</span>,
          EUR per couple, at A$1 = €{fxRate.toFixed(2)}.
        </>
      }
      legend={legend}
      tableId={tableId}
      tableOpen={tableOpen}
      onTableToggle={() => setTableOpen((value) => !value)}
    >
      <div ref={box} className="relative mt-3">
        {width > 0 && points.length > 0 && (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            tabIndex={0}
            aria-label={`Burn-down: cumulative spend over ${points.length} days, ending at ${formatEur(burn.planOnTotal)} plan-on and ${formatEur(burn.worstTotal)} worst case, against a €12,000 to €20,000 Budget band.`}
            aria-describedby={tableId}
            className="touch-pan-y focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sb-accent)]"
            onPointerMove={(event) =>
              hover.find(
                event.clientX - event.currentTarget.getBoundingClientRect().left,
                PAD.left,
                plotWidth,
              )
            }
            onPointerLeave={hover.clear}
            onBlur={hover.clear}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") hover.step(1);
              else if (event.key === "ArrowLeft") hover.step(-1);
              else if (event.key === "Home") hover.setIndex(0);
              else if (event.key === "End") hover.setIndex(points.length - 1);
              else if (event.key === "Escape") hover.clear();
              else return;
              event.preventDefault();
            }}
          >
            {/* The Budget band: a reference region, behind everything. */}
            <rect
              x={PAD.left}
              y={y(burn.ceilingEur)}
              width={plotWidth}
              height={Math.max(0, y(burn.floorEur) - y(burn.ceilingEur))}
              fill="color-mix(in srgb, var(--sb-line) 34%, transparent)"
            />

            {/* Grid. Solid hairlines, one step off the surface. */}
            {ticks.map((tick) => (
              <line
                key={tick}
                x1={PAD.left}
                x2={PAD.left + plotWidth}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--sb-line)"
                strokeWidth={1}
                opacity={0.5}
              />
            ))}

            {/* The band's own edges, drawn once the grid is down so they read
                as the band rather than as two more gridlines. */}
            <line
              x1={PAD.left}
              x2={PAD.left + plotWidth}
              y1={y(burn.floorEur)}
              y2={y(burn.floorEur)}
              stroke="var(--sb-faint)"
              strokeWidth={1}
            />
            <line
              x1={PAD.left}
              x2={PAD.left + plotWidth}
              y1={y(burn.ceilingEur)}
              y2={y(burn.ceilingEur)}
              stroke="color-mix(in srgb, var(--sb-over) 55%, transparent)"
              strokeWidth={1}
            />
            <text
              x={PAD.left + 6}
              y={y(burn.ceilingEur) - 5}
              className="fill-[var(--sb-faint)] text-[9.5px]"
            >
              €20k ceiling
            </text>
            <text
              x={PAD.left + 6}
              y={y(burn.floorEur) - 5}
              className="fill-[var(--sb-faint)] text-[9.5px]"
            >
              €12k floor
            </text>

            {/* Y axis. One axis, in EUR — never a second scale. */}
            {ticks.map((tick) => (
              <text
                key={tick}
                x={PAD.left - 8}
                y={y(tick) + 3.5}
                textAnchor="end"
                className="sb-num fill-[var(--sb-faint)] text-[9.5px]"
              >
                {tickLabel(tick)}
              </text>
            ))}

            {/* X axis, in trip dates. */}
            {tickIndexes.map((index) => (
              <text
                key={index}
                x={x(index)}
                y={height - 8}
                textAnchor={
                  index === 0
                    ? "start"
                    : index === points.length - 1
                      ? "end"
                      : "middle"
                }
                className="fill-[var(--sb-faint)] text-[9.5px]"
              >
                {formatDay(dates[index])}
              </text>
            ))}

            {areaPath && <path d={areaPath} fill={ink} opacity={0.1} />}

            <polyline
              points={worstPath}
              fill="none"
              stroke={dimInk}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={planOnPath}
              fill="none"
              stroke={ink}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* The crossing. A state, so it wears the state colour, and it says
                what it is on the chart rather than only on hover. */}
            {crossing && (
              <>
                <circle
                  cx={crossingX}
                  cy={crossingY}
                  r={5}
                  fill="var(--sb-over)"
                  stroke="var(--sb-panel)"
                  strokeWidth={2}
                />
                <text
                  x={crossingLeft ? crossingX - 10 : crossingX + 10}
                  y={crossingY - 11}
                  textAnchor={crossingLeft ? "end" : "start"}
                  className="fill-[var(--sb-over)] text-[10px] font-semibold"
                >
                  {crossing.series === "plan-on" ? "crosses" : "worst case crosses"}{" "}
                  ceiling ~{formatDay(crossing.date)}
                </text>
              </>
            )}

            {/* Endpoints, direct-labelled. The end of a burn-down is the whole
                point of drawing one, so it is the one place a number rides the
                mark. */}
            {last && (
              <>
                <circle
                  cx={x(points.length - 1)}
                  cy={y(last.worstEur)}
                  r={4}
                  fill={dimInk}
                  stroke="var(--sb-panel)"
                  strokeWidth={2}
                />
                <text
                  x={x(points.length - 1) - 7}
                  y={y(last.worstEur) - 7}
                  textAnchor="end"
                  className="sb-num fill-[var(--sb-dim)] text-[10px]"
                >
                  {formatEur(burn.worstTotal)} worst
                </text>
                <circle
                  cx={x(points.length - 1)}
                  cy={y(last.planOnEur)}
                  r={5}
                  fill={ink}
                  stroke="var(--sb-panel)"
                  strokeWidth={2}
                />
                <text
                  x={x(points.length - 1) - 7}
                  y={y(last.planOnEur) + 15}
                  textAnchor="end"
                  className="sb-num fill-[var(--sb-text)] text-[11px] font-semibold"
                >
                  {formatEur(burn.planOnTotal)}
                </text>
              </>
            )}

            {/* Crosshair. The reader aims at a date, never at a 2px line. */}
            {active && (
              <>
                <line
                  x1={x(hover.index!)}
                  x2={x(hover.index!)}
                  y1={PAD.top}
                  y2={PAD.top + plotHeight}
                  stroke="var(--sb-faint)"
                  strokeWidth={1}
                />
                <circle
                  cx={x(hover.index!)}
                  cy={y(active.worstEur)}
                  r={4}
                  fill={dimInk}
                  stroke="var(--sb-panel)"
                  strokeWidth={2}
                />
                <circle
                  cx={x(hover.index!)}
                  cy={y(active.planOnEur)}
                  r={4.5}
                  fill={ink}
                  stroke="var(--sb-panel)"
                  strokeWidth={2}
                />
              </>
            )}
          </svg>
        )}

        {active && (
          <ChartTooltip
            x={x(hover.index!)}
            y={y(active.planOnEur)}
            width={width}
            title={formatDayYear(active.date)}
            rows={[
              { label: "Spent so far", value: formatEur(active.planOnEur), color: ink },
              { label: "Worst case", value: formatEur(active.worstEur), color: dimInk },
              {
                label: active.remainingEur >= 0 ? "Left to ceiling" : "Over ceiling",
                value: formatEur(Math.abs(active.remainingEur)),
              },
              { label: "That day", value: formatEur(active.dayEur) },
            ]}
          />
        )}
      </div>

      <ChartTable
        id={tableId}
        open={tableOpen}
        caption="Cumulative spend by trip day, plan-on and worst case, with what is left of the €20,000 ceiling."
        columns={["Date", "That day", "Spent so far", "Worst case", "Left to ceiling"]}
        rows={points.map((point) => [
          formatDayYear(point.date),
          formatEur(point.dayEur),
          formatEur(point.planOnEur),
          formatEur(point.worstEur),
          formatEur(point.remainingEur),
        ])}
      />
    </ChartCard>
  );
}
