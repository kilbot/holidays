"use client";

import { memo } from "react";
import { FlaskConical, MapPin, Star, TriangleAlert, X } from "lucide-react";

import { CapsuleArt } from "@/components/capsule-art";
import { SEASON_LABEL, SEASON_TOKEN } from "@/lib/catalog";
import type { SeasonFit } from "@/lib/catalog";
import type { FacetId } from "@/lib/facets";
import type { MarkedState, ShortlistState } from "@/lib/shortlist";
import { cn } from "@/lib/utils";

/**
 * One Capsule, as a card you can read.
 *
 * The Catalog's other rendering — `CatalogRow`, in the Plan page's 280px rail
 * — had to fit a name, a price and three verdict buttons into a column
 * narrower than a phone. This one has the whole page: the generated cover is
 * 132px tall instead of absent, the region gets its own line instead of a
 * truncation, and the *why* — the one field that says whether an idea is worth
 * anything, 300 characters of it on the median entry — is on the card rather
 * than a click away. That is the difference the Capsules page exists to make.
 *
 * Two sizes, and they mean two different things rather than two widths. A
 * `hero` tile is one of the eight researched Capsules: taller cover, the
 * research badge, room for three lines of argument. A `grid` tile is one of
 * the 413 shallow ideas. The page never mixes them in one grid, because the
 * whole point of the two tiers is that they are not the same kind of thing.
 *
 * Memoised: a keystroke in the search box re-filters 421 entries, and the
 * cards that survived should not re-render with it.
 */

/** What a tile needs, from either tier. Built by the page, not read here. */
export interface CapsuleTileData {
  id: string;
  /** Which store the click opens the detail card from. */
  kind: "deep" | "idea";
  name: string;
  /** "QLD", "Cross-state" — set large over the cover. */
  state: string;
  /** "Far North / Port Douglas" — the subregion, under the name. */
  where: string;
  /** Two or three sentences on why it is worth the days and the money. */
  why: string;
  seasonFit: SeasonFit;
  /** "3–5 nights", "1 day". */
  days: string;
  /** "€550–980", "free". */
  cost: string;
  tags: readonly string[];
  facets: readonly FacetId[];
  /** The sweep's caveat, if it flagged one. Ideas only. */
  caveat: string | null;
}

const MARK_BUTTONS: {
  state: MarkedState;
  label: string;
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

/** The card's own border and ground, by verdict. */
const TILE_TONE: Record<ShortlistState, string> = {
  unseen:
    "border-[var(--sb-line)] bg-[var(--sb-panel)] hover:border-[color-mix(in_srgb,var(--sb-dim)_50%,transparent)]",
  interested:
    "border-[color-mix(in_srgb,var(--sb-accent)_55%,transparent)] bg-[color-mix(in_srgb,var(--sb-accent)_7%,var(--sb-panel))]",
  placed:
    "border-[color-mix(in_srgb,var(--sb-good)_60%,transparent)] bg-[color-mix(in_srgb,var(--sb-good)_8%,var(--sb-panel))]",
  discarded:
    "border-dashed border-[var(--sb-line)] bg-transparent opacity-60 hover:opacity-95",
};

/** The pin in the cover's corner, so a verdict is legible while scanning. */
function VerdictPin({ state }: { state: ShortlistState }) {
  if (state === "interested") {
    return (
      <span
        title="Interested"
        className="absolute top-2.5 right-2.5 flex size-6 items-center justify-center rounded-full bg-[var(--sb-accent)] shadow-[0_2px_10px_rgb(6_10_16/0.5)]"
      >
        <Star className="size-3 fill-[var(--primary-foreground)] text-[var(--primary-foreground)]" />
      </span>
    );
  }
  if (state === "placed") {
    return (
      <span
        title="On the Plan"
        className="absolute top-2.5 right-2.5 flex size-6 items-center justify-center rounded-full bg-[var(--sb-good)] shadow-[0_2px_10px_rgb(6_10_16/0.5)]"
      >
        <MapPin className="size-3 fill-[var(--primary-foreground)] text-[var(--primary-foreground)]" />
      </span>
    );
  }
  return null;
}

interface CapsuleTileProps {
  tile: CapsuleTileData;
  state: ShortlistState;
  size: "hero" | "grid";
  onOpen: (tile: CapsuleTileData) => void;
  onMark: (id: string, state: MarkedState) => void;
}

function CapsuleTileImpl({
  tile,
  state,
  size,
  onOpen,
  onMark,
}: CapsuleTileProps) {
  const hero = size === "hero";

  return (
    <article
      className={cn(
        "sb-tile group/tile flex flex-col overflow-hidden rounded-xl border transition-colors motion-reduce:transition-none",
        "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--sb-accent)]",
        TILE_TONE[state],
      )}
    >
      {/* The cover and the reading matter are one button: anywhere above the
          verdict bar opens the detail card, which is the same bargain the
          Catalog rows strike and the reason the bar is a sibling rather than a
          nested control. */}
      <button
        type="button"
        onClick={() => onOpen(tile)}
        aria-haspopup="dialog"
        title={`Open ${tile.name}`}
        className="flex flex-1 cursor-pointer flex-col text-left outline-none"
      >
        <div
          className={cn(
            "relative w-full shrink-0 overflow-hidden",
            hero ? "h-[152px] xl:h-[168px]" : "h-[124px]",
          )}
        >
          <CapsuleArt
            seed={tile.id}
            state={tile.state}
            where={hero ? tile.where : undefined}
            tags={tile.tags}
            facets={tile.facets}
            // `hero` on both sizes: the oversized state name is what makes a
            // wall of generated covers scannable by region, and the 21px
            // `thumb` lettering was cut for a 124px-wide strip, not a card.
            variant="hero"
            className="size-full transition-transform duration-500 group-hover/tile:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover/tile:scale-100"
          />

          {tile.kind === "deep" && (
            <span className="absolute top-2.5 left-3 inline-flex items-center gap-1 rounded-full bg-[rgb(6_10_16/0.55)] px-2 py-[3px] text-[9px] font-semibold tracking-[0.12em] text-[rgb(255_253_248/0.92)] uppercase backdrop-blur-sm">
              <FlaskConical className="size-2.5" />
              Researched
            </span>
          )}

          <VerdictPin state={state} />
        </div>

        <div
          className={cn(
            "flex flex-1 flex-col",
            hero ? "px-4 pt-3.5 pb-3" : "px-3.5 pt-3 pb-2.5",
          )}
        >
          <h3
            className={cn(
              "font-display font-extrabold tracking-[-0.015em] text-balance text-[var(--sb-text)]",
              hero
                ? "text-[17px] leading-[1.15]"
                : "line-clamp-2 text-[14.5px] leading-[1.2]",
            )}
          >
            {tile.name}
          </h3>

          <p className="mt-1 truncate text-[11px] leading-snug text-[var(--sb-faint)]">
            <span className="font-semibold text-[var(--sb-dim)]">
              {tile.state}
            </span>
            {tile.where && ` · ${tile.where}`}
          </p>

          {/* Season, length and money on one line — the three numbers a scan
              is actually comparing, in the same order on every card. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className="inline-flex items-center gap-1 text-[10.5px] font-medium whitespace-nowrap"
              style={{ color: SEASON_TOKEN[tile.seasonFit] }}
            >
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{ background: SEASON_TOKEN[tile.seasonFit] }}
              />
              {SEASON_LABEL[tile.seasonFit]}
            </span>
            <span className="sb-num text-[10.5px] whitespace-nowrap text-[var(--sb-dim)]">
              {tile.days}
            </span>
            <span className="sb-num text-[11.5px] font-semibold whitespace-nowrap text-[var(--sb-text)]">
              {tile.cost}
            </span>
          </div>

          <p
            className={cn(
              "mt-2 text-[12px] leading-[1.55] text-[var(--sb-dim)]",
              hero ? "line-clamp-4" : "line-clamp-3",
            )}
          >
            {tile.why}
          </p>

          {tile.caveat && (
            <p
              className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-[var(--sb-warn)]"
              title={`Flagged: ${tile.caveat}`}
            >
              <TriangleAlert className="size-2.5 shrink-0" />
              <span className="truncate">{tile.caveat}</span>
            </p>
          )}
        </div>
      </button>

      {/* Pressing the verdict a card already carries clears it back to unseen
          — `aria-pressed` is what says so. */}
      <div
        className={cn(
          "flex gap-1 border-t border-[color-mix(in_srgb,var(--sb-line)_60%,transparent)] px-2 py-2",
          hero && "px-2.5",
        )}
      >
        {MARK_BUTTONS.map((button) => {
          const active = state === button.state;
          const Icon = button.icon;
          return (
            <button
              key={button.state}
              type="button"
              onClick={() => onMark(tile.id, button.state)}
              aria-pressed={active}
              title={`${button.title} — ${tile.name}`}
              aria-label={`${button.title} — ${tile.name}`}
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-md py-[5px]",
                "text-[10.5px] font-semibold whitespace-nowrap transition-colors motion-reduce:transition-none",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--sb-accent)]",
                !active &&
                  "bg-[color-mix(in_srgb,var(--sb-line)_38%,transparent)] text-[var(--sb-dim)] hover:bg-[color-mix(in_srgb,var(--sb-line)_75%,transparent)] hover:text-[var(--sb-text)]",
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
    </article>
  );
}

export const CapsuleTile = memo(CapsuleTileImpl);
