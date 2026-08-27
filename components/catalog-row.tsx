"use client";

import { memo } from "react";
import { MapPin, Star, TriangleAlert, X } from "lucide-react";

import { openCatalogIdea } from "@/lib/capsule-focus";
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
 * Name and cost, where, the season chip, then a row of three labelled verdict
 * buttons — and clicking anywhere above them opens the detail card. The row
 * used to expand in place instead; the card replaced that because it is a
 * superset (the same why-rated and season note, plus the sources, the flags
 * and the research links) and because two ways to open the same content in a
 * 280px column is one too many.
 *
 * The verdict buttons carry words as of #36. They were three 20px icons
 * floating in the corner with the label only in a `title`, which meant the
 * single action the whole Catalog exists for — sift 413 ideas down to a
 * shortlist — was discoverable only by hovering and waiting. Sifting is the
 * job; the buttons that do it should say what they do. `CatalogSift` also
 * carries one helper line above the list explaining the three states, because
 * "interested" versus "on the Plan" is a distinction about the Plan, not about
 * the button.
 *
 * Memoised on purpose: a keystroke in the search box re-renders the list, and
 * the rows that survived the filter should not re-render with it.
 */

const MARK_BUTTONS: {
  state: MarkedState;
  /** On the button. Short enough that three fit a 280px rail. */
  label: string;
  /** In the tooltip and the accessible name, where there is room to be exact. */
  title: string;
  icon: typeof Star;
  token: string;
}[] = [
  {
    state: "interested",
    label: "Interested",
    title: "Interested — keep it on the bench",
    icon: Star,
    token: "--sb-accent",
  },
  {
    state: "placed",
    label: "Plan",
    title: "On the Plan — give it calendar days",
    icon: MapPin,
    token: "--sb-good",
  },
  {
    state: "discarded",
    label: "Discard",
    title: "Discard — hide it from the open shelf",
    icon: X,
    token: "--sb-over",
  },
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
  onMark: (id: string, state: MarkedState) => void;
}

function CatalogRowImpl({ idea, state, onMark }: CatalogRowProps) {
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
        onClick={() => openCatalogIdea(idea.id)}
        aria-haspopup="dialog"
        title={`Open ${idea.name}`}
        className="w-full cursor-pointer px-2.5 pt-2 pb-1 text-left"
      >
        <div className="flex items-start gap-2">
          <span className="line-clamp-2 min-w-0 flex-1 text-[12.5px] leading-tight font-semibold">
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

        <div className="mt-1 flex h-4 items-center gap-2">
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

      {/* In flow rather than floated in the corner: these are the row's
          actions, and a toolbar that shares the row's full width can afford
          to say what each button does. Pressing the state an idea already
          has clears it back to unseen — `aria-pressed` is what says so. */}
      <div className="flex gap-1 px-2 pt-0.5 pb-1.5">
        {MARK_BUTTONS.map((button) => {
          const active = state === button.state;
          const Icon = button.icon;
          return (
            <button
              key={button.state}
              type="button"
              onClick={() => onMark(idea.id, button.state)}
              aria-pressed={active}
              title={`${button.title} — ${idea.name}`}
              aria-label={`${button.title} — ${idea.name}`}
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-md py-[3px]",
                "text-[10px] font-semibold whitespace-nowrap transition-colors motion-reduce:transition-none",
                !active &&
                  "bg-[color-mix(in_srgb,var(--sb-line)_38%,transparent)] text-[var(--sb-dim)] hover:bg-[color-mix(in_srgb,var(--sb-line)_70%,transparent)] hover:text-[var(--sb-text)]",
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
              <Icon className="size-2.5 shrink-0" />
              {button.label}
            </button>
          );
        })}
      </div>
    </li>
  );
}

export const CatalogRow = memo(CatalogRowImpl);
