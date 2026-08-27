"use client";

/**
 * The Budget (#42) — the money view, at full width.
 *
 * The cost HUD is this page's compact sibling: about 74px of pill on the globe
 * answering "what does this cost, and where does that sit in the band". It is
 * deliberately not duplicated here. What this page adds is the second half of
 * every one of those questions — *when* the money goes (the burn-down), *what
 * it goes on* (the splits), and *what the alternatives cost* (the Scenarios) —
 * with the two knobs that move all three.
 *
 * #10's progressive disclosure is the law on this page as much as on the HUD:
 * the plan-on figure is the surface, and the honest band, the worst case, the
 * stress rate and the contingency are one click down. The difference is only
 * that here, one click down is a row of controls rather than a chevron — and
 * the charts re-render against them, so the disclosure is *live* rather than a
 * paragraph explaining what would happen.
 *
 * Nothing here prices anything. Every figure is `plan.rollUp`, `plan.days` or
 * `burnDown()` over the same Days, which is what keeps this page and the HUD
 * and the Ledger from quietly disagreeing about the same trip.
 */

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { ChevronDown, TriangleAlert } from "lucide-react";

import {
  BUDGET_CEILING_EUR,
  BUDGET_FLOOR_EUR,
  burnDown,
  formatEur,
  type Warning,
} from "@/lib/engine";
import { usePlan } from "@/lib/engine/use-plan";
import { formatDayYear } from "@/lib/trip-dates";
import { Switch } from "@/components/ui/switch";
import { BurnDownChart } from "@/components/budget-burn-down";
import { ScenarioCompare } from "@/components/budget-scenarios";
import { SplitBars, type SplitRow } from "@/components/budget-splits";
import { scenarioInk } from "@/components/budget-chart";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

/**
 * The plan total against the band.
 *
 * The same meter the HUD carries, at the size a page can afford: the fill
 * runs good → warn → over across the €12k–€20k span, and the track is the band
 * itself, so "how much room is left" is legible without reading a number.
 */
function BudgetMeter({
  totalEur,
  fraction,
}: {
  totalEur: number;
  fraction: number;
}) {
  return (
    <div>
      <div
        className="h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--sb-line)_55%,transparent)]"
        role="meter"
        aria-valuemin={BUDGET_FLOOR_EUR}
        aria-valuemax={BUDGET_CEILING_EUR}
        aria-valuenow={Math.round(totalEur)}
        aria-label="Plan total against the Budget band"
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(1.5, fraction * 100)}%`,
            background:
              "linear-gradient(90deg, var(--sb-good), var(--sb-warn) 85%, var(--sb-over))",
          }}
        />
      </div>
      <div className="mt-1 flex justify-between">
        <span className="sb-num text-[9.5px] text-[var(--sb-faint)]">
          €12k floor
        </span>
        <span className="sb-num text-[9.5px] text-[var(--sb-faint)]">
          €20k ceiling
        </span>
      </div>
    </div>
  );
}

function WarningLine({ warning }: { warning: Warning }) {
  const over = warning.tone === "over";
  return (
    <li className="flex gap-1.5">
      <TriangleAlert
        className={cn(
          "mt-px size-3.5 shrink-0",
          over ? "text-[var(--sb-over)]" : "text-[var(--sb-warn)]",
        )}
      />
      <div className="min-w-0">
        <p
          className={cn(
            "text-[11.5px] leading-tight font-semibold",
            over ? "text-[var(--sb-over)]" : "text-[var(--sb-warn)]",
          )}
        >
          {warning.label}
        </p>
        <p className="text-[10.5px] leading-snug text-[var(--sb-dim)]">
          {warning.detail}
        </p>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

function Knob({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="mt-0.5 shrink-0"
      />
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-[11.5px] leading-tight font-semibold text-[var(--sb-text)]">
          {label}
        </span>
        <span className="mt-0.5 block max-w-[34ch] text-[10.5px] leading-snug text-[var(--sb-dim)]">
          {detail}
        </span>
      </label>
    </div>
  );
}

/**
 * The knobs, and what the two figures mean.
 *
 * Collapsed at rest, and one row when opened — the dataviz method's rule that
 * filters live in a single row above everything they scope, rather than one set
 * per chart. Both knobs change every figure on the page at once, which is the
 * point: an FX stress test that only moved one chart would be a decoration.
 */
function Assumptions({
  fxStress,
  contingency,
  fxRate,
  onFxStress,
  onContingency,
}: {
  fxStress: boolean;
  contingency: boolean;
  fxRate: number;
  onFxStress: (value: boolean) => void;
  onContingency: (value: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <section className="mt-4 rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-left"
      >
        <span className="min-w-0">
          <span className="sb-label text-[9px]">Assumptions</span>
          <span className="mt-0.5 block truncate text-[11.5px] text-[var(--sb-dim)]">
            A$1 = €{fxRate.toFixed(2)} · contingency {contingency ? "on" : "off"}{" "}
            · what plan-on and worst case mean
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[var(--sb-faint)] transition-transform motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          id={id}
          className="grid gap-4 border-t border-[var(--sb-line)] px-3.5 py-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Knob
            label={fxStress ? "FX stressed" : "FX at spot"}
            detail="A$1 = €0.61 at spot, 25 Aug 2026. The €0.65 stress rate covers a further ~6% of AUD appreciation before the trip."
            checked={fxStress}
            onChange={onFxStress}
          />
          <Knob
            label={contingency ? "Contingency on" : "Contingency zeroed"}
            detail="About 10% of the plan for the things nobody plans. One visible line, never folded into the others — and it can be switched off."
            checked={contingency}
            onChange={onContingency}
          />
          <div className="sm:col-span-2">
            <p className="sb-label text-[9px]">Plan-on vs worst case</p>
            <p className="mt-1 max-w-[62ch] text-[10.5px] leading-snug text-[var(--sb-dim)]">
              <span className="font-semibold text-[var(--sb-text)]">Plan-on</span>{" "}
              is the cheapest realistic version of this Plan: every Day priced at
              the figure the research says to expect.{" "}
              <span className="font-semibold text-[var(--sb-text)]">
                Worst case
              </span>{" "}
              is the top of every line&rsquo;s band, re-converted at the €0.65
              stress rate — the Australian-dollar share only, since a fare quoted
              in euros does not move when the dollar does. Neither is a
              prediction; the honest answer is somewhere between them.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */

export function BudgetView() {
  const { plan, scenarios, totals, input, patch } = usePlan();
  const { rollUp } = plan;

  const burn = useMemo(
    () =>
      burnDown({
        days: plan.days,
        fxRate: rollUp.fxRate,
        contingency: rollUp.contingencyOn,
      }),
    [plan.days, rollUp.fxRate, rollUp.contingencyOn],
  );

  // A Scenario's colour is its position in the saved list, so the burn-down is
  // drawn in the colour of the Scenario it belongs to and the comparison below
  // agrees with it without either having to know about the other.
  const currentIndex = Math.max(
    0,
    scenarios.scenarios.findIndex(
      (scenario) => scenario.id === scenarios.current.id,
    ),
  );
  const { ink, dim } = scenarioInk(currentIndex);

  const splitRows: SplitRow[] = useMemo(() => {
    const by = (id: string) =>
      rollUp.splits.find((split) => split.id === id)?.amountEur ?? 0;
    // The order is the one the palette was validated in — sea sits between
    // ochre and coral because that pair collapses under deuteranopia. Changing
    // it means re-running the validator.
    return [
      {
        id: "living",
        label: "Living",
        color: "var(--sb-chart-living)",
        amountEur: by("living"),
        note: "Lodging, food, local transport, day-to-day activities and any hire car. The Daily cap is measured against the first three.",
      },
      {
        id: "flights",
        label: "Flights & Legs",
        color: "var(--sb-chart-flights)",
        amountEur: by("flights"),
        note: "Every Leg's fare, landed on the day it is travelled.",
      },
      {
        id: "events",
        label: "Events",
        color: "var(--sb-chart-events)",
        amountEur: by("events"),
        note: "The deliberate splurge the day-to-day thrift pays for: reef days, NYE, festivals. Never averaged into a daily figure.",
      },
      {
        id: "contingency",
        label: "Contingency",
        color: "var(--sb-chart-contingency)",
        amountEur: rollUp.contingencyEur,
        muted: !rollUp.contingencyOn,
        note: rollUp.contingencyOn
          ? "About 10% of the plan, for the things nobody plans."
          : "Switched off in the assumptions above. The row stays so the zero is visible.",
      },
    ];
  }, [rollUp]);

  // Warnings about the Plan as a whole belong in the header; the ones about a
  // Day belong on that Day, which is the Ledger's job.
  const planWarnings = plan.warnings.filter(
    (warning) => warning.kind === "budget-ceiling" || warning.kind === "unplaced",
  );

  return (
    <main className="sb-scroll h-full w-full overflow-y-auto print:h-auto print:overflow-visible">
      <div className="mx-auto max-w-[1120px] px-3 pb-24 sm:px-6 print:max-w-none print:px-0 print:pb-0">
        <header className="pt-7 print:pt-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="sb-label">Southbound · the budget</p>
            <p className="text-[11px] text-[var(--sb-faint)]">
              Scenario{" "}
              <span className="font-semibold text-[var(--sb-dim)]">
                {scenarios.current.name}
              </span>
            </p>
          </div>

          <div className="mt-2 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="min-w-0">
              <h1 className="font-display text-[30px] leading-[1.05] font-extrabold tracking-[-0.02em] text-[var(--sb-text)] lg:text-[38px]">
                Budget
              </h1>
              <p className="mt-1.5 text-[12px] text-[var(--sb-dim)] sm:text-[13px]">
                {formatDayYear(plan.startDate)} – {formatDayYear(plan.endDate)} ·{" "}
                <span className="sb-num">{plan.dayCount}</span> days ·{" "}
                <span className="sb-num">{rollUp.homeBaseNights}</span>{" "}
                free-lodging nights
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-x-7 gap-y-3">
              <div className="min-w-[168px]">
                <p className="sb-label text-[9px]">Plan total</p>
                {/* The hero figure: proportional digits, because tabular ones
                    give every digit the width of a zero and a four-figure sum
                    reads loose at this size. */}
                <p className="sb-num text-[44px] leading-none font-semibold tracking-tight [font-variant-numeric:normal] lg:text-[52px]">
                  {formatEur(rollUp.totalEur)}
                </p>
                <div className="mt-2.5">
                  <BudgetMeter
                    totalEur={rollUp.totalEur}
                    fraction={rollUp.budgetFraction}
                  />
                </div>
              </div>

              <dl className="flex gap-x-6 gap-y-3">
                <div>
                  <dt className="sb-label text-[9px]">Honest band</dt>
                  <dd className="sb-num mt-0.5 text-[14px] leading-none text-[var(--sb-dim)]">
                    {formatEur(rollUp.bandEur[0])}–
                    {Math.round(rollUp.bandEur[1]).toLocaleString("en-GB")}
                  </dd>
                </div>
                <div>
                  <dt className="sb-label text-[9px]">Worst case</dt>
                  <dd className="sb-num mt-0.5 text-[14px] leading-none text-[var(--sb-dim)]">
                    {formatEur(rollUp.worstCaseEur)}
                  </dd>
                </div>
              </dl>

              <Link
                href="/ledger"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--sb-line)] bg-[var(--sb-panel)] px-3 text-[12px] font-semibold text-[var(--sb-text)] transition-colors hover:bg-[var(--sb-panel-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sb-accent)] motion-reduce:transition-none print:hidden"
              >
                Ledger <span aria-hidden>→</span>
              </Link>
            </div>
          </div>

          {planWarnings.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--sb-over)_35%,var(--sb-line))] bg-[color-mix(in_srgb,var(--sb-over)_7%,transparent)] p-2.5 print:bg-transparent">
              {planWarnings.map((warning) => (
                <WarningLine key={warning.id} warning={warning} />
              ))}
            </ul>
          )}
        </header>

        <Assumptions
          fxStress={input.fxStress}
          contingency={input.contingency}
          fxRate={rollUp.fxRate}
          onFxStress={(fxStress) => patch({ fxStress })}
          onContingency={(contingency) => patch({ contingency })}
        />

        <div className="mt-4">
          <BurnDownChart
            burn={burn}
            fxRate={rollUp.fxRate}
            ink={ink}
            dimInk={dim}
            scenarioName={scenarios.current.name}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <SplitBars rows={splitRows} totalEur={rollUp.totalEur} />
          <ScenarioCompare totals={totals} onSelect={scenarios.select} />
        </div>

        <p className="mt-4 text-[10.5px] text-[var(--sb-faint)]">
          Every figure on this page is the sum of the Plan&rsquo;s Days, EUR per
          couple, at A$1 = €{rollUp.fxRate.toFixed(2)}. The day-by-day working is
          on the{" "}
          <Link
            href="/ledger"
            className="underline decoration-dotted underline-offset-[3px] hover:text-[var(--sb-dim)]"
          >
            Ledger
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
