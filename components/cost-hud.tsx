"use client";

import { useState } from "react";
import { ChevronDown, TriangleAlert } from "lucide-react";

import {
  BUDGET_CEILING_EUR,
  BUDGET_FLOOR_EUR,
  formatEur,
  type RollUp,
  type Warning,
} from "@/lib/engine";
import type { ScenarioTotal } from "@/lib/engine/scenarios";
import { usePlan } from "@/lib/engine/use-plan";
import { cn } from "@/lib/utils";

function BudgetBar({ rollUp }: { rollUp: RollUp }) {
  return (
    <div
      className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--sb-line)_55%,transparent)]"
      role="meter"
      aria-valuemin={BUDGET_FLOOR_EUR}
      aria-valuemax={BUDGET_CEILING_EUR}
      aria-valuenow={Math.round(rollUp.totalEur)}
      aria-label="Plan total against the budget band"
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${rollUp.budgetFraction * 100}%`,
          background:
            "linear-gradient(90deg, var(--sb-good), var(--sb-warn) 85%, var(--sb-over))",
        }}
      />
    </div>
  );
}

/** The band the bar is drawn against. Reference, not headline — expanded only. */
function BudgetScale() {
  return (
    <div className="mt-1 flex justify-between">
      <span className="sb-num text-[9.5px] text-[var(--sb-faint)]">
        €12k floor
      </span>
      <span className="sb-num text-[9.5px] text-[var(--sb-faint)]">
        €20k ceiling
      </span>
    </div>
  );
}

function Splits({ rollUp }: { rollUp: RollUp }) {
  return (
    <dl className="mt-2.5 grid grid-cols-3 gap-2">
      {rollUp.splits.map((split) => (
        <div key={split.id}>
          <dt className="sb-label text-[9px]">{split.label}</dt>
          <dd
            className={cn(
              "sb-num mt-0.5 text-[13px] font-medium tracking-tight",
              split.emphasis && "text-[var(--sb-accent)]",
            )}
          >
            {formatEur(split.amountEur)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The honest part, one click in.
 *
 * #10 decision 1: the plan-on figure is the surface; the band, the worst case
 * and the sources live on drill-in. This is that drill-in — the three numbers
 * the headline is not, plus the two knobs that move them.
 */
function Honesty({
  rollUp,
  contingency,
  fxStress,
  onContingency,
  onFxStress,
}: {
  rollUp: RollUp;
  contingency: boolean;
  fxStress: boolean;
  onContingency: (value: boolean) => void;
  onFxStress: (value: boolean) => void;
}) {
  return (
    <dl className="mt-2.5 flex flex-col gap-1 border-t border-[var(--sb-line)] pt-2">
      <Row
        label="Honest band"
        value={`${formatEur(rollUp.bandEur[0])}–${Math.round(rollUp.bandEur[1]).toLocaleString("en-GB")}`}
        title="Every line's own low and high, summed. The plan-on figure is the cheapest realistic version of the same Plan."
      />
      <Row
        label="Worst case"
        value={formatEur(rollUp.worstCaseEur)}
        title="The band's ceiling, re-converted at the €0.65 stress rate. cost-baselines §6."
      />

      <div className="flex items-baseline justify-between gap-2">
        <button
          type="button"
          onClick={() => onContingency(!contingency)}
          aria-pressed={contingency}
          title="Standard travel-budgeting practice: about 10% of the plan for the things nobody plans. One line, and it can be zeroed."
          className="sb-label cursor-pointer text-[9px] underline decoration-dotted underline-offset-[3px] hover:text-[var(--sb-text)]"
        >
          Contingency {contingency ? "on" : "off"}
        </button>
        <span
          className={cn(
            "sb-num text-[11px]",
            contingency ? "text-[var(--sb-dim)]" : "text-[var(--sb-faint)]",
          )}
        >
          {formatEur(rollUp.contingencyEur)}
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <button
          type="button"
          onClick={() => onFxStress(!fxStress)}
          aria-pressed={fxStress}
          title="A$1 = €0.61 at spot, 25 Aug 2026. The €0.65 stress rate covers a further ~6% of AUD appreciation before the trip."
          className="sb-label cursor-pointer text-[9px] underline decoration-dotted underline-offset-[3px] hover:text-[var(--sb-text)]"
        >
          FX {fxStress ? "stressed" : "spot"}
        </button>
        <span className="sb-num text-[11px] text-[var(--sb-dim)]">
          A$1 = €{rollUp.fxRate.toFixed(2)}
        </span>
      </div>

      <Row
        label={`${rollUp.homeBaseNights} free-lodging nights`}
        value={`${rollUp.bufferDays} buffer days · ${formatEur(rollUp.bufferEur)}`}
        title="Home-base nights cost nothing to sleep in. Buffer days are deliberately unscheduled and still cost money — a plan with honest buffers costs more nights than a packed one."
      />
    </dl>
  );
}

function Row({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2" title={title}>
      <dt className="sb-label text-[9px]">{label}</dt>
      <dd className="sb-num text-[11px] text-[var(--sb-dim)]">{value}</dd>
    </div>
  );
}

/**
 * The Scenarios, side by side.
 *
 * docs/CONTEXT.md: a Scenario is a full alternate calendar for a big fork —
 * "Fireworks NYE" against "Doof NYE", a 12-Feb departure against a 22-Feb one —
 * "compared side by side; exactly one is marked as the current Plan". This is
 * that comparison, and it lives inside the cost panel rather than in a panel of
 * its own because the only thing worth comparing at a glance is the money.
 *
 * A fork copies the current Scenario's whole input, so it starts identical and
 * diverges as it is edited. Visitor Forks with their own URLs are #30; this is
 * the couple's own list.
 */
function Scenarios({
  totals,
  onSelect,
  onFork,
}: {
  totals: ScenarioTotal[];
  onSelect: (id: string) => void;
  onFork: () => void;
}) {
  return (
    <div className="mt-2.5 border-t border-[var(--sb-line)] pt-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="sb-label text-[9px]">Scenarios</p>
        <button
          type="button"
          onClick={onFork}
          title="Copy this Scenario under a new name. The copy starts identical and diverges as you edit it."
          className="sb-label cursor-pointer text-[9px] text-[var(--sb-accent)] hover:underline"
        >
          Fork
        </button>
      </div>

      <ul className="mt-1 flex flex-col gap-0.5">
        {totals.map((total) => (
          <li key={total.id}>
            <button
              type="button"
              onClick={() => onSelect(total.id)}
              aria-current={total.current}
              className={cn(
                "flex w-full cursor-pointer items-baseline justify-between gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-[var(--sb-panel-2)] motion-reduce:transition-none",
                total.current && "bg-[var(--sb-panel-2)]",
              )}
            >
              <span
                className={cn(
                  "truncate text-[10.5px] leading-tight",
                  total.current
                    ? "font-semibold text-[var(--sb-text)]"
                    : "text-[var(--sb-dim)]",
                )}
              >
                {total.name}
                <span className="ml-1 text-[var(--sb-faint)]">
                  {total.dayCount}d
                </span>
              </span>
              <span className="sb-num shrink-0 text-[10.5px] text-[var(--sb-dim)]">
                {formatEur(total.totalEur)}
                {total.warnings > 0 && (
                  <span className="ml-1 text-[var(--sb-warn)]">
                    ⚠{total.warnings}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WarningBadge({ warning }: { warning: Warning }) {
  const over = warning.tone === "over";
  return (
    <div
      className={cn(
        "mt-1.5 flex items-start gap-2 rounded-lg px-2.5 py-2",
        over
          ? "bg-[color-mix(in_srgb,var(--sb-over)_14%,transparent)]"
          : "bg-[color-mix(in_srgb,var(--sb-warn)_14%,transparent)]",
      )}
    >
      <TriangleAlert
        className={cn(
          "mt-px size-3.5 shrink-0",
          over ? "text-[var(--sb-over)]" : "text-[var(--sb-warn)]",
        )}
      />
      <div className="min-w-0">
        <p
          className={cn(
            "text-[11px] leading-tight font-semibold",
            over ? "text-[var(--sb-over)]" : "text-[var(--sb-warn)]",
          )}
        >
          {warning.label}
        </p>
        <p className="mt-0.5 text-[10px] leading-snug text-[var(--sb-dim)]">
          {warning.detail}
        </p>
      </div>
    </div>
  );
}

/**
 * The Plan's money, as a pill.
 *
 * At rest it answers one question — what does this cost, and where does that
 * sit in the Budget band — in about 74px. Everything below the bar is one click
 * away on every breakpoint, and the pill carries a warn dot so a Warning is
 * never silently collapsed: docs/CONTEXT.md's "the site informs" survives the
 * declutter.
 *
 * Since #25 every figure is the engine's. The €14,280 that used to be typed
 * into this file was the prototype's static total; the number here is the sum
 * of the Plan's Days and reconciles with the strip below it by construction.
 */
export function CostHud() {
  const [open, setOpen] = useState(false);
  const { plan, scenarios, totals, input, patch } = usePlan();
  const { rollUp, warnings } = plan;

  // The badge shows the loudest three. The rest are on the Days they belong to,
  // which is where they can actually be acted on.
  const ranked = [...warnings].sort(
    (a, b) => Number(b.tone === "over") - Number(a.tone === "over"),
  );

  return (
    <section className="pointer-events-auto absolute top-4 right-4 left-32 z-30 sm:left-auto sm:w-[264px]">
      {/* Expanded, the panel carries splits, four honesty rows and up to three
          Warnings — more than a short viewport holds. It scrolls inside itself
          rather than running off the bottom of the globe.

          The floor is the share pill's top edge, not the viewport's: both live
          in the right-hand column, and a HUD that ran the full height would
          print its warnings over the one control that says whether the Plan is
          even being saved. */}
      <div className="sb-panel sb-scroll max-h-[calc(100dvh-var(--sb-strip-h)-7.5rem)] overflow-y-auto p-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={
            open
              ? "Hide the cost split and warnings"
              : "Show the cost split and warnings"
          }
          className="block w-full cursor-pointer text-left"
        >
          <span className="flex items-baseline justify-between gap-2">
            <span className="sb-label">Plan total</span>
            <span className="flex items-center gap-1.5">
              {/* The Warning, reduced to its smallest honest form. */}
              {!open && ranked.length > 0 && (
                <span
                  aria-hidden
                  title={ranked
                    .slice(0, 3)
                    .map((warning) => warning.label)
                    .join(" · ")}
                  className="size-1.5 rounded-full"
                  style={{
                    background:
                      ranked[0].tone === "over"
                        ? "var(--sb-over)"
                        : "var(--sb-warn)",
                  }}
                />
              )}
              <span className="text-[11px] font-medium text-[var(--sb-accent)]">
                {scenarios.current.name}
              </span>
              <ChevronDown
                className={cn(
                  "size-3 text-[var(--sb-faint)] transition-transform motion-reduce:transition-none",
                  open && "rotate-180",
                )}
              />
            </span>
          </span>

          <span className="sb-num mt-0.5 block text-[26px] leading-none font-semibold tracking-tight">
            {formatEur(rollUp.totalEur)}
          </span>

          <BudgetBar rollUp={rollUp} />
        </button>

        {open && (
          <>
            <BudgetScale />
            <Splits rollUp={rollUp} />
            <Honesty
              rollUp={rollUp}
              contingency={input.contingency}
              fxStress={input.fxStress}
              onContingency={(contingency) => patch({ contingency })}
              onFxStress={(fxStress) => patch({ fxStress })}
            />
            <Scenarios
              totals={totals}
              onSelect={scenarios.select}
              onFork={() =>
                scenarios.fork(`Fork ${scenarios.scenarios.length + 1}`)
              }
            />
            {ranked.slice(0, 3).map((warning) => (
              <WarningBadge key={warning.id} warning={warning} />
            ))}
            {ranked.length > 3 && (
              <p className="mt-1.5 text-[9.5px] text-[var(--sb-faint)]">
                +{ranked.length - 3} more on the Days they belong to
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
