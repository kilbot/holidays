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
    <>
      <div
        className="mt-2.5 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--sb-line)_55%,transparent)]"
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
      <div className="mt-1.5 flex justify-between">
        <span className="sb-num text-[10px] text-[var(--sb-faint)]">
          €12k floor
        </span>
        <span className="sb-num text-[10px] text-[var(--sb-faint)]">
          €20k ceiling
        </span>
      </div>
    </>
  );
}

function Splits() {
  return (
    <dl className="mt-3 grid grid-cols-3 gap-2">
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

export function CostHud() {
  const [open, setOpen] = useState(false);

  // On narrow screens the HUD is pinned between the wordmark and the right
  // edge rather than given a fixed width, so it can never run off the
  // viewport; from `sm` up it takes its natural 272px column.
  return (
    <section className="pointer-events-auto absolute top-4 right-4 left-32 z-30 sm:left-auto sm:w-[272px]">
      <div className="sb-panel p-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="sb-label">Plan total</p>
          <p className="text-[11px] font-medium text-[var(--sb-accent)]">
            {DEMO_PLAN.scenarioName}
          </p>
        </div>

        <p className="sb-num mt-1 text-[28px] leading-none font-semibold tracking-tight">
          {formatEur(DEMO_PLAN.totalEur)}
        </p>

        <BudgetBar />

        {/* Below the bar the HUD is detail, not headline — on a phone it
            collapses behind a disclosure so the globe keeps the screen. */}
        <div className="hidden lg:block">
          <Splits />
          <WarningBadge />
        </div>

        <div className="lg:hidden">
          {open && (
            <>
              <Splits />
              <WarningBadge />
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1 rounded-md py-1 text-[10px] font-semibold tracking-[0.13em] text-[var(--sb-dim)] uppercase transition-colors hover:text-[var(--sb-text)]"
          >
            {open ? "Hide split" : "Split & warnings"}
            <ChevronDown
              className={cn("size-3 transition-transform", open && "rotate-180")}
            />
          </button>
        </div>
      </div>
    </section>
  );
}
