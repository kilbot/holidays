"use client";

import Link from "next/link";

import { formatEur } from "@/lib/engine";
import { usePlan } from "@/lib/engine/use-plan";
import { formatDay, formatDayYear } from "@/lib/trip-dates";

/**
 * The engine's figures for a written Plan, above the writing.
 *
 * Labelled as the site's own, because the write-up carries its author's budget
 * in the author's words and the two must never be read as one number. If the Plan is
 * not on the shelf this browser holds (an old local copy, say), the strip says
 * so rather than inventing a total.
 */
export function PlanFigures({
  scenarioId,
  by,
}: {
  scenarioId: string;
  by: string;
}) {
  const { scenarios, totals } = usePlan();
  const scenario = scenarios.scenarios.find((entry) => entry.id === scenarioId);
  const total = totals.find((entry) => entry.id === scenarioId);

  return (
    <section className="mt-5 rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)] p-4">
      <p className="sb-label text-[9px]">What the site makes of it</p>
      {scenario && total ? (
        <>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="sb-num text-[26px] leading-none font-semibold tracking-tight text-[var(--sb-text)]">
              {formatEur(total.totalEur)}
            </span>
            <span className="text-[12px] text-[var(--sb-dim)]">
              <span className="sb-num">{total.dayCount}</span> days ·{" "}
              <span className="sb-num">
                {formatDay(scenario.input.startDate)} –{" "}
                {formatDayYear(scenario.input.endDate)}
              </span>
              {total.warnings > 0 && (
                <>
                  {" · "}
                  <span className="sb-num">{total.warnings}</span>{" "}
                  {total.warnings === 1 ? "warning" : "warnings"}
                </>
              )}
              {total.current && " · the current Plan"}
            </span>
          </p>
          <p className="mt-2 max-w-[64ch] text-[11.5px] leading-snug text-[var(--sb-faint)]">
            The engine&rsquo;s reading of these weeks, priced at the site&rsquo;s
            own rates with its contingency on, so it can sit beside the other
            Plans on the{" "}
            <Link
              href="/scenarios"
              className="underline decoration-dotted underline-offset-[3px] hover:text-[var(--sb-dim)]"
            >
              Scenarios
            </Link>{" "}
            page. {by}&rsquo;s own budget is in the write-up below.
          </p>
        </>
      ) : (
        <p className="mt-2 text-[12px] text-[var(--sb-dim)]">
          This Plan is not on the shelf this browser holds yet, so there is no
          total to show. {by}&rsquo;s plan below stands on its own.
        </p>
      )}
    </section>
  );
}
