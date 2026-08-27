"use client";

import { useState } from "react";
import { ChevronDown, TriangleAlert } from "lucide-react";

import {
  BUDGET_CEILING_EUR,
  BUDGET_FLOOR_EUR,
  DEMO_PLAN,
  budgetFraction,
  formatEur,
} from "@/lib/demo-plan";
import { cn } from "@/lib/utils";

function BudgetBar() {
  const fraction = budgetFraction(DEMO_PLAN.totalEur);
  return (
    <div
      className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--sb-line)_55%,transparent)]"
      role="meter"
      aria-valuemin={BUDGET_FLOOR_EUR}
      aria-valuemax={BUDGET_CEILING_EUR}
      aria-valuenow={DEMO_PLAN.totalEur}
      aria-label="Plan total against the budget band"
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${fraction * 100}%`,
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

function Splits() {
  return (
    <dl className="mt-2.5 grid grid-cols-3 gap-2">
      {DEMO_PLAN.splits.map((split) => (
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

function WarningBadge() {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg bg-[color-mix(in_srgb,var(--sb-warn)_14%,transparent)] px-2.5 py-2">
      <TriangleAlert className="mt-px size-3.5 shrink-0 text-[var(--sb-warn)]" />
      <div className="min-w-0">
        <p className="text-[11px] leading-tight font-semibold text-[var(--sb-warn)]">
          {DEMO_PLAN.warning.label}
        </p>
        <p className="mt-0.5 text-[10px] leading-snug text-[var(--sb-dim)]">
          {DEMO_PLAN.warning.detail}
        </p>
      </div>
    </div>
  );
}

/**
 * The Plan's money, as a pill.
 *
 * At rest it answers one question — what does this cost, and where does that
 * sit in the Budget band — in about 74px. Everything below the bar (the band's
 * end labels, the three splits, the Daily-cap warning) is detail that was
 * permanently resident on desktop before #36 and cost the globe a 272×233
 * block for it. It is now one click away on every breakpoint, and the pill
 * carries a warn dot so a Warning is never silently collapsed: CONTEXT.md's
 * "the site informs" survives the declutter.
 */
export function CostHud() {
  const [open, setOpen] = useState(false);

  // On narrow screens the HUD is pinned between the wordmark and the right
  // edge rather than given a fixed width, so it can never run off the
  // viewport; from `sm` up it takes its natural column.
  return (
    <section className="pointer-events-auto absolute top-4 right-4 left-32 z-30 sm:left-auto sm:w-[264px]">
      <div className="sb-panel p-3">
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
              {!open && (
                <span
                  aria-hidden
                  title={DEMO_PLAN.warning.label}
                  className="size-1.5 rounded-full bg-[var(--sb-warn)]"
                />
              )}
              <span className="text-[11px] font-medium text-[var(--sb-accent)]">
                {DEMO_PLAN.scenarioName}
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
            {formatEur(DEMO_PLAN.totalEur)}
          </span>

          <BudgetBar />
        </button>

        {open && (
          <>
            <BudgetScale />
            <Splits />
            <WarningBadge />
          </>
        )}
      </div>
    </section>
  );
}
