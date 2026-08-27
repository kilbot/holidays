"use client";

/**
 * Where the money goes (#42).
 *
 * Four horizontal bars, and deliberately not a donut: the interesting question
 * here is "is Living twice Flights or three times", and a reader answers that
 * from bar length in about a second and from two arc segments approximately
 * never. Part-to-whole at a glance is the only thing a pie is good at, and this
 * is not that question.
 *
 * The four are one series — EUR, by category — not four series, so there is no
 * legend: every bar is named on its own row and carries its own value at the
 * tip. The hues are identity for the row, in the fixed order the palette was
 * validated in (living → flights → events → contingency, with sea sitting
 * between ochre and coral because that pair collapses under deuteranopia). They
 * are **not** a value ramp: swapping two rows would not change what the chart
 * means, so the categories are nominal and each keeps its own hue whatever its
 * length.
 *
 * Events keeps the coral accent it wears everywhere else on the site.
 * docs/CONTEXT.md: Event spend is the deliberate splurge the day-to-day thrift
 * pays for, and it is the one split the HUD emphasises, so it would be strange
 * for it to arrive here in a colour the reader has never seen it in.
 *
 * Contingency is a row like the others rather than padding folded into them,
 * which is #10 decision 4 restated: one visible line, and it can be zeroed. Off,
 * it reads €0 and keeps its row — a category that vanishes when it is zero
 * makes the toggle look like it deleted something.
 */

import { useId, useState } from "react";

import { formatEur } from "@/lib/engine";
import { ChartCard, ChartTable } from "@/components/budget-chart";
import { cn } from "@/lib/utils";

/** Room at the right of the track for the tip label, in px. */
const LABEL_GUTTER = 74;

export interface SplitRow {
  id: string;
  label: string;
  /** A token reference. Never a literal. */
  color: string;
  amountEur: number;
  note: string;
  /** Contingency, switched off. Drawn as a stub so the row does not vanish. */
  muted?: boolean;
}

export function SplitBars({
  rows,
  totalEur,
}: {
  rows: SplitRow[];
  totalEur: number;
}) {
  const [tableOpen, setTableOpen] = useState(false);
  const tableId = useId();

  const max = Math.max(...rows.map((row) => row.amountEur), 1);
  const share = (amount: number) =>
    totalEur > 0 ? `${((amount / totalEur) * 100).toFixed(1)}%` : "—";

  return (
    <ChartCard
      title="Where it goes"
      subtitle="Every Day's lines, grouped. The four add up to the plan total above."
      tableId={tableId}
      tableOpen={tableOpen}
      onTableToggle={() => setTableOpen((value) => !value)}
    >
      {/* No legend: one series, four named rows. A box of four swatches would
          repeat the four labels already sitting beside the bars. */}
      <ul className="mt-3.5 flex flex-col gap-3">
        {rows.map((row) => {
          const fraction = row.amountEur / max;
          const bar = `calc(${(fraction * 100).toFixed(3)}% - ${(fraction * LABEL_GUTTER).toFixed(2)}px)`;
          return (
            <li key={row.id} title={row.note} className="group">
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block size-2 shrink-0 rounded-[2px]"
                    style={{ background: row.color }}
                  />
                  <span className="text-[11.5px] font-semibold text-[var(--sb-text)]">
                    {row.label}
                  </span>
                </span>
                <span className="sb-num text-[10px] text-[var(--sb-faint)]">
                  {share(row.amountEur)}
                </span>
              </div>

              {/* The baseline every bar grows from, and the bar itself: square
                  where it meets the baseline, 4px rounded at the data end. */}
              <div className="relative mt-1.5 h-3.5 border-l border-[var(--sb-line)]">
                <div
                  className={cn(
                    // The mark responds to the pointer, so the reader can see
                    // which row the note under their cursor belongs to.
                    "h-3.5 rounded-r-[4px] transition-[filter] group-hover:brightness-115 motion-reduce:transition-none",
                    row.muted && "opacity-45",
                  )}
                  style={{
                    width: row.amountEur > 0 ? bar : 2,
                    background: row.color,
                    minWidth: 2,
                  }}
                />
                <span
                  className="sb-num absolute top-1/2 -translate-y-1/2 pl-2 text-[11px] font-semibold whitespace-nowrap text-[var(--sb-text)]"
                  style={{ left: row.amountEur > 0 ? bar : 2 }}
                >
                  {formatEur(row.amountEur)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <ChartTable
        id={tableId}
        open={tableOpen}
        caption="Plan cost by category, in EUR per couple, with each category's share of the plan total."
        columns={["Category", "Amount", "Share"]}
        rows={rows.map((row) => [
          row.label,
          formatEur(row.amountEur),
          share(row.amountEur),
        ])}
      />
    </ChartCard>
  );
}
