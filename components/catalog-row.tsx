"use client";

import { memo } from "react";
import { MapPin, Star, TriangleAlert, X } from "lucide-react";

import {
  SEASON_LABEL,
  SEASON_TOKEN,
  formatDays,
  formatEurBand,
  warningLabel,
  type CatalogIdea,
} from "@/lib/catalog";
import type { MarkedState, ShortlistState } from "@/lib/shortlist";
import { cn } from "@/lib/utils";

/**
 * One Catalog idea.
 *
 * Collapsed it is three lines — name and cost, where, then the season chip and
 * the mark buttons. Clicking anywhere on it opens the research underneath:
 * why people rate it, what the summer does to it, and its tags. Only one row
 * is ever open, so the drawer never turns into a wall of prose.
 *
 * Memoised on purpose: a keystroke in the search box re-renders the list, and
 * the rows that survived the filter should not re-render with it.
 */

const MARK_BUTTONS: {
  state: MarkedState;
  label: string;
  icon: typeof Star;
  token: string;
}[] = [
  {
    state: "interested",
    label: "Interested",
    icon: Star,
    token: "--sb-accent",
  },
  { state: "placed", label: "On the Plan", icon: MapPin, token: "--sb-good" },
  { state: "discarded", label: "Discard", icon: X, token: "--sb-over" },
];

const ROW_TONE: Record<ShortlistState, string> = {
  unseen:
    "border-[var(--sb-line)] bg-[color-mix(in_srgb,var(--sb-panel-2)_70%,transparent)] hover:border-[color-mix(in_srgb,var(--sb-dim)_45%,transparent)]",
  interested:
    "border-[color-mix(in_srgb,var(--sb-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--sb-accent)_12%,var(--sb-panel-2))]",
  placed:
    "border-[color-mix(in_srgb,var(--sb-good)_50%,transparent)] bg-[color-mix(in_srgb,var(--sb-good)_13%,var(--sb-panel-2))]",
  discarded:
    "border-dashed border-[var(--sb-line)] bg-transparent opacity-55 hover:opacity-90",
};

interface CatalogRowProps {
  idea: CatalogIdea;
  state: ShortlistState;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
  onMark: (id: string, state: MarkedState) => void;
}

function CatalogRowImpl({
  idea,
  state,
  expanded,
  onToggleExpand,
  onMark,
}: CatalogRowProps) {
  const caveat = warningLabel(idea);

  return (
    <li
      className={cn(
        "sb-row relative rounded-lg border transition-colors",
        ROW_TONE[state],
      )}
    >
      <button
        type="button"
        onClick={() => onToggleExpand(idea.id)}
        aria-expanded={expanded}
        className="w-full cursor-pointer px-2.5 pt-2 pb-1.5 text-left"
      >
        <div className="flex items-start gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 text-[12.5px] leading-tight font-semibold",
              expanded ? "" : "line-clamp-2",
            )}
          >
            {idea.name}
          </span>
          <span className="sb-num shrink-0 text-[11.5px] leading-tight font-medium tracking-tight">
            {formatEurBand(idea)}
          </span>
        </div>

        <p className="mt-1 truncate text-[10.5px] text-[var(--sb-faint)]">
          <span className="font-semibold text-[var(--sb-dim)]">
            {idea.state}
          </span>
          {idea.where && ` · ${idea.where}`}
        </p>

        {/* Right padding keeps this line clear of the floating mark buttons. */}
        <div className="mt-1.5 flex h-5 items-center gap-2 pr-[68px]">
          <span
            className="inline-flex items-center gap-1 text-[10px] font-medium whitespace-nowrap"
            style={{ color: SEASON_TOKEN[idea.season_fit_dec_feb] }}
          >
            <span
              aria-hidden
              className="size-1.5 rounded-full"
              style={{ background: SEASON_TOKEN[idea.season_fit_dec_feb] }}
            />
            {SEASON_LABEL[idea.season_fit_dec_feb]}
          </span>
          <span className="sb-num text-[10px] whitespace-nowrap text-[var(--sb-faint)]">
            {formatDays(idea)}
          </span>
          {caveat && (
            <span
              className="inline-flex min-w-0 items-center gap-0.5 text-[10px] font-medium text-[var(--sb-warn)]"
              title={`Flagged: ${idea.warnings.join(", ")}`}
            >
              <TriangleAlert className="size-2.5 shrink-0" />
              <span className="truncate">{caveat}</span>
            </span>
          )}
        </div>
      </button>

      {/* Floated rather than in flow: the row stays three lines tall whether or
          not it carries a caveat, and the marks always land in the same spot. */}
      <div className="absolute right-2 bottom-1.5 flex gap-0.5">
        {MARK_BUTTONS.map((button) => {
          const active = state === button.state;
          const Icon = button.icon;
          return (
            <button
              key={button.state}
              type="button"
              onClick={() => onMark(idea.id, button.state)}
              aria-pressed={active}
              title={`${button.label} — ${idea.name}`}
              aria-label={`${button.label} — ${idea.name}`}
              className={cn(
                "flex size-5 cursor-pointer items-center justify-center rounded-[5px] transition-colors",
                !active &&
                  "text-[var(--sb-faint)] hover:bg-[color-mix(in_srgb,var(--sb-line)_55%,transparent)] hover:text-[var(--sb-text)]",
              )}
              style={
                active
                  ? {
                      background: `var(${button.token})`,
                      color: "var(--primary-foreground)",
                    }
                  : undefined
              }
            >
              <Icon className="size-3" />
            </button>
          );
        })}
      </div>

      {expanded && (
        <div className="border-t border-[var(--sb-line)] px-2.5 py-2">
          <p className="text-[11px] leading-snug text-[var(--sb-dim)]">
            {idea.why_rated}
          </p>
          <p className="mt-1.5 text-[10.5px] leading-snug text-[var(--sb-faint)]">
            <span className="font-semibold">Summer:</span> {idea.season_note}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {idea.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-[4px] bg-[color-mix(in_srgb,var(--sb-line)_45%,transparent)] px-1.5 py-0.5 text-[9.5px] text-[var(--sb-dim)]"
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="sb-num mt-2 text-[9.5px] text-[var(--sb-faint)]">
            {idea.nearest_airport} · A${idea.rough_cost_couple_aud} ·{" "}
            {idea.cost_confidence} confidence
          </p>
        </div>
      )}
    </li>
  );
}

export const CatalogRow = memo(CatalogRowImpl);
