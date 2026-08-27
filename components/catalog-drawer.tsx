"use client";

import { useState } from "react";
import { ChevronLeft, Layers, X } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import {
  CATALOG_ENTRIES,
  CATALOG_FACETS,
  CATALOG_TOTAL_IDEAS,
  type CatalogEntry,
} from "@/lib/demo-catalog";
import { formatEur } from "@/lib/demo-plan";
import { cn } from "@/lib/utils";

const FLAG_TONE_CLASS = {
  warn: "bg-[color-mix(in_srgb,var(--sb-warn)_20%,transparent)] text-[var(--sb-warn)]",
  over: "bg-[color-mix(in_srgb,var(--sb-over)_20%,transparent)] text-[var(--sb-over)]",
  lock: "bg-[color-mix(in_srgb,var(--sb-line)_60%,transparent)] text-[var(--sb-dim)]",
} as const;

function CapsuleRow({ entry }: { entry: CatalogEntry }) {
  return (
    <li
      className={cn(
        "group rounded-lg border px-3 py-2.5 transition-colors",
        entry.onPlan
          ? "border-[color-mix(in_srgb,var(--sb-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--sb-accent)_7%,var(--sb-panel-2))]"
          : "border-[var(--sb-line)] bg-[color-mix(in_srgb,var(--sb-panel-2)_70%,transparent)]",
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] leading-tight font-semibold">
            {entry.name}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-[var(--sb-dim)]">
            {entry.where}
          </p>
        </div>
        <Switch
          size="sm"
          defaultChecked={entry.onPlan}
          aria-label={`${entry.name} — on the Plan`}
          className="mt-0.5 data-checked:bg-[var(--sb-good)]"
        />
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="sb-num text-[11px] text-[var(--sb-faint)]">
          {entry.duration}
        </span>
        <span className="sb-num text-[12px] font-medium tracking-tight">
          {formatEur(entry.costEur)}
        </span>
      </div>

      {entry.flag && (
        <span
          className={cn(
            "mt-2 inline-block rounded-[4px] px-1.5 py-0.5 text-[10px] font-semibold",
            FLAG_TONE_CLASS[entry.flag.tone],
          )}
        >
          {entry.flag.label}
        </span>
      )}
    </li>
  );
}

function DrawerBody() {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <p className="sb-label">Catalog</p>
        <p className="sb-num text-[10px] text-[var(--sb-faint)]">
          {CATALOG_ENTRIES.length} of {CATALOG_TOTAL_IDEAS}
        </p>
      </div>

      {/* Filter facets. Static this iteration — the row exists so the sift
          interaction in #26 lands in a surface that is already designed. */}
      <div className="-mx-0.5 mt-2.5 flex flex-wrap gap-1.5">
        {CATALOG_FACETS.map((facet) => (
          <button
            key={facet.id}
            type="button"
            aria-pressed={facet.active}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              facet.active
                ? "bg-[var(--sb-accent)] text-[var(--primary-foreground)]"
                : "bg-[color-mix(in_srgb,var(--sb-line)_45%,transparent)] text-[var(--sb-dim)] hover:text-[var(--sb-text)]",
            )}
          >
            {facet.label}
          </button>
        ))}
      </div>

      {/* The mask makes the cut-off row at the bottom read as "there is more"
          rather than as a clipping bug. */}
      <ul className="sb-scroll mt-3 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1 [mask-image:linear-gradient(to_bottom,black_calc(100%-32px),transparent)]">
        {CATALOG_ENTRIES.map((entry) => (
          <CapsuleRow key={entry.id} entry={entry} />
        ))}
      </ul>

      <p className="mt-2.5 border-t border-[var(--sb-line)] pt-2 text-[10px] leading-snug text-[var(--sb-faint)]">
        Toggles are visual only in this build — the Scheduler lands in #26.
      </p>
    </>
  );
}

export function CatalogDrawer() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* ---- Desktop: docked, collapsible rail ---- */}
      <aside
        className={cn(
          "pointer-events-auto absolute top-4 bottom-[168px] left-4 z-20 hidden lg:flex",
          collapsed ? "w-11" : "w-[272px]",
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="sb-panel flex w-full cursor-pointer flex-col items-center gap-3 py-3 transition-colors hover:bg-[var(--sb-panel-2)]"
            aria-label="Expand the catalog"
          >
            <Layers className="size-4 text-[var(--sb-accent)]" />
            <span
              className="sb-label whitespace-nowrap"
              style={{ writingMode: "vertical-rl" }}
            >
              Catalog · {CATALOG_TOTAL_IDEAS}
            </span>
          </button>
        ) : (
          <div className="sb-panel relative flex w-full flex-col p-3.5">
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse the catalog"
              className="absolute top-3 right-3 cursor-pointer rounded-md p-1 text-[var(--sb-faint)] transition-colors hover:bg-[var(--sb-panel-2)] hover:text-[var(--sb-text)]"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <DrawerBody />
          </div>
        )}
      </aside>

      {/* ---- Mobile: a launcher that opens the drawer over the globe.
             It sits just above the date strip rather than top-left, so the
             cost HUD gets the whole top row and stays readable. ---- */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="sb-panel pointer-events-auto absolute bottom-[150px] left-4 z-20 flex cursor-pointer items-center gap-2 px-3 py-2 lg:hidden"
      >
        <Layers className="size-3.5 text-[var(--sb-accent)]" />
        <span className="sb-label">Catalog</span>
      </button>

      {mobileOpen && (
        <div className="absolute inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close the catalog"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 cursor-default bg-[rgb(7_12_20/0.6)] backdrop-blur-[2px]"
          />
          <div className="sb-panel absolute top-3 right-3 bottom-3 left-3 flex max-w-[320px] flex-col p-3.5">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close the catalog"
              className="absolute top-3 right-3 cursor-pointer rounded-md p-1 text-[var(--sb-faint)] hover:text-[var(--sb-text)]"
            >
              <X className="size-3.5" />
            </button>
            <DrawerBody />
          </div>
        </div>
      )}
    </>
  );
}
