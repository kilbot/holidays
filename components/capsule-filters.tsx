"use client";

import { useId, type ReactNode } from "react";
import {
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";

import {
  CATALOG,
  CATALOG_STATES,
  SEASON_LABEL,
  SEASON_TOKEN,
  type SeasonFit,
} from "@/lib/catalog";
import {
  COST_STOPS,
  DAY_STOPS,
  isSifted,
  narrowingCount,
  type CatalogFilters,
  type ShelfId,
} from "@/lib/catalog-filter";
import { FACETS } from "@/lib/facets";
import type { ShortlistCounts } from "@/lib/shortlist";
import { cn } from "@/lib/utils";

/**
 * The sift's controls, given the room the Plan page's rail could never spare.
 *
 * In a 280px column these had to be rationed: the numeric filters lived behind
 * a disclosure and the region chips with them, because nine chips and two
 * sliders do not fit beside a list. Across a page they simply fit, so they are
 * simply shown — one row of chips per axis, laid out horizontally, labelled.
 * Nothing here is hidden from a traveller on a laptop.
 *
 * The bar is sticky, which is the only real constraint on its height: it has
 * to be a band you scroll a wall of cards *past*, not a second page. So the
 * search, the topical chips and the shelves — the three you touch constantly —
 * are the first row, and region, season, length and cost share the second. On
 * a phone that second row folds behind a Refine toggle, because there the
 * whole viewport is 812px and a 120px filter bar is a sixth of it.
 *
 * The rules the chips keep, unchanged from the rail:
 * - Facets OR. Chips that narrow to nothing are worse than chips that gather.
 * - Every control widens or narrows; none of them hide the count.
 */

const CHIP_BASE =
  "cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--sb-accent)]";
const CHIP_OFF =
  "bg-[color-mix(in_srgb,var(--sb-line)_45%,transparent)] text-[var(--sb-dim)] hover:bg-[color-mix(in_srgb,var(--sb-line)_75%,transparent)] hover:text-[var(--sb-text)]";

/** Chips light in their axis's own signal colour; the label flips to panel ink. */
function chipOn(token: string) {
  return { background: `var(${token})`, color: "var(--primary-foreground)" };
}

const TONE_TOKEN = {
  accent: "--sb-accent",
  sea: "--sb-sea",
  warn: "--sb-warn",
} as const;

const SEASON_FITS: readonly SeasonFit[] = ["good", "ok", "poor", "no"];

const SHELVES: {
  id: ShelfId;
  label: string;
  word?: string;
  icon?: typeof Star;
  tally?: keyof ShortlistCounts;
}[] = [
  { id: "open", label: "Open — everything not discarded", word: "Open" },
  { id: "unseen", label: "Unseen — not marked yet", word: "Unseen" },
  { id: "interested", label: "Interested", icon: Star, tally: "interested" },
  { id: "placed", label: "Placed on the Plan", icon: MapPin, tally: "placed" },
  { id: "discarded", label: "Discarded", icon: X, tally: "discarded" },
];

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

/** A labelled group on the second row. The label is what makes nine bare
 *  state codes read as "region" rather than as more topical chips. */
function Axis({
  label,
  value,
  children,
}: {
  label: string;
  /** The current setting, shown beside the label for the two sliders. */
  value?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="sb-label shrink-0 text-[9.5px] whitespace-nowrap">
        {label}
        {value && (
          <span className="sb-num ml-1.5 tracking-normal normal-case text-[var(--sb-faint)]">
            {value}
          </span>
        )}
      </span>
      {children}
    </div>
  );
}

interface CapsuleFiltersProps {
  filters: CatalogFilters;
  onChange: (patch: Partial<CatalogFilters>) => void;
  onReset: () => void;
  counts: ShortlistCounts;
  /** How many of the 413 survived. */
  shown: number;
  /** Whether the phone-width Refine row is open. */
  refineOpen: boolean;
  onToggleRefine: () => void;
}

export function CapsuleFilters({
  filters,
  onChange,
  onReset,
  counts,
  shown,
  refineOpen,
  onToggleRefine,
}: CapsuleFiltersProps) {
  const searchId = useId();
  const sifted = isSifted(filters);
  const narrowing = narrowingCount(filters);

  const dayStop = DAY_STOPS.indexOf(filters.maxDays);
  const costStop = COST_STOPS.indexOf(filters.maxCost);

  return (
    <div className="flex flex-col gap-2.5">
      {/* ---- Row one: search, topical chips, the count ---- */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="relative min-w-[148px] flex-1 sm:w-[248px] sm:flex-none">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[var(--sb-faint)]" />
          <input
            id={searchId}
            type="search"
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            placeholder={`Search ${CATALOG.length} ideas…`}
            aria-label="Search the Catalog"
            className="h-9 w-full rounded-lg border border-[var(--sb-line)] bg-[var(--sb-panel)] pr-7 pl-8 text-[12.5px] text-[var(--sb-text)] outline-none placeholder:text-[var(--sb-faint)] focus:border-[var(--sb-accent)] [&::-webkit-search-cancel-button]:hidden"
          />
          {filters.query && (
            <button
              type="button"
              onClick={() => onChange({ query: "" })}
              aria-label="Clear the search"
              className="absolute top-1/2 right-2 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-[var(--sb-faint)] hover:text-[var(--sb-text)]"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* One scrollable line on a phone, a wrapping block on a laptop.
            Twelve chips wrap to five rows at 375px, and five rows inside a
            *sticky* bar is half the viewport gone before the first card. */}
        <div className="sb-scroll order-last flex w-full min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5 lg:order-none lg:w-auto lg:flex-1 lg:flex-wrap lg:overflow-x-visible lg:pb-0">
          {FACETS.map((facet) => {
            const on = filters.facets.includes(facet.id);
            return (
              <button
                key={facet.id}
                type="button"
                onClick={() => onChange({ facets: toggle(filters.facets, facet.id) })}
                aria-pressed={on}
                title={facet.hint}
                className={cn(CHIP_BASE, "shrink-0", !on && CHIP_OFF)}
                style={on ? chipOn(TONE_TOKEN[facet.tone]) : undefined}
              >
                {facet.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <p className="text-[11px] whitespace-nowrap text-[var(--sb-dim)]">
            <span className="sb-num font-semibold text-[var(--sb-text)]">
              {shown}
            </span>{" "}
            of <span className="sb-num">{CATALOG.length}</span>
          </p>
          {sifted && (
            <button
              type="button"
              onClick={onReset}
              className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold tracking-[0.1em] text-[var(--sb-faint)] uppercase transition-colors hover:text-[var(--sb-text)] motion-reduce:transition-none"
            >
              <RotateCcw className="size-3" />
              Reset
            </button>
          )}
          {/* Phones only: the second row is worth a sixth of the viewport
              there, so it asks first. */}
          <button
            type="button"
            onClick={onToggleRefine}
            aria-expanded={refineOpen}
            className={cn(
              "flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold tracking-[0.1em] uppercase transition-colors lg:hidden motion-reduce:transition-none",
              narrowing > 0 ? "text-[var(--sb-accent)]" : "text-[var(--sb-dim)]",
            )}
          >
            <SlidersHorizontal className="size-3" />
            Refine
            {narrowing > 0 && <span className="sb-num">· {narrowing}</span>}
          </button>
        </div>
      </div>

      {/* ---- Row two: region, season, length, cost, shelves ---- */}
      <div
        className={cn(
          "flex-wrap items-center gap-x-6 gap-y-2.5 border-t border-[color-mix(in_srgb,var(--sb-line)_55%,transparent)] pt-2.5",
          refineOpen ? "flex" : "hidden lg:flex",
        )}
      >
        <Axis label="Region">
          <div className="flex flex-wrap items-center gap-1">
            {CATALOG_STATES.map((state) => {
              const on = filters.states.includes(state);
              return (
                <button
                  key={state}
                  type="button"
                  onClick={() => onChange({ states: toggle(filters.states, state) })}
                  aria-pressed={on}
                  className={cn(CHIP_BASE, "px-2 py-[3px] text-[10.5px]", !on && CHIP_OFF)}
                  style={on ? chipOn("--sb-sea") : undefined}
                >
                  {state}
                </button>
              );
            })}
          </div>
        </Axis>

        <Axis label="Dec–Feb">
          <div className="flex flex-wrap items-center gap-1">
            {SEASON_FITS.map((fit) => {
              const on = filters.seasons.includes(fit);
              return (
                <button
                  key={fit}
                  type="button"
                  onClick={() => onChange({ seasons: toggle(filters.seasons, fit) })}
                  aria-pressed={on}
                  className={cn(CHIP_BASE, "px-2 py-[3px] text-[10.5px]", !on && CHIP_OFF)}
                  style={
                    on
                      ? {
                          background: SEASON_TOKEN[fit],
                          color: "var(--primary-foreground)",
                        }
                      : undefined
                  }
                >
                  {SEASON_LABEL[fit]}
                </button>
              );
            })}
          </div>
        </Axis>

        {/* Stops, not a linear range: 284 of the 413 are one-day ideas and
            half the Catalog tops out under €215, so an even slider would
            spend most of its travel on the long tail. */}
        <Axis
          label="Length"
          value={Number.isFinite(filters.maxDays) ? `≤ ${filters.maxDays}d` : "any"}
        >
          <input
            type="range"
            min={0}
            max={DAY_STOPS.length - 1}
            step={1}
            value={dayStop === -1 ? DAY_STOPS.length - 1 : dayStop}
            onChange={(event) =>
              onChange({ maxDays: DAY_STOPS[Number(event.target.value)] })
            }
            aria-label="Longest stay to show"
            className="h-4 w-[104px] cursor-pointer accent-[var(--sb-accent)]"
          />
        </Axis>

        <Axis
          label="Cost"
          value={Number.isFinite(filters.maxCost) ? `≤ €${filters.maxCost}` : "any"}
        >
          <input
            type="range"
            min={0}
            max={COST_STOPS.length - 1}
            step={1}
            value={costStop === -1 ? COST_STOPS.length - 1 : costStop}
            onChange={(event) =>
              onChange({ maxCost: COST_STOPS[Number(event.target.value)] })
            }
            aria-label="Most an idea may cost, top of its band, per couple"
            className="h-4 w-[104px] cursor-pointer accent-[var(--sb-accent)]"
          />
        </Axis>

        {/* The shelves carry their counts rather than their names: the tally
            is the thing you want to see on a shortlist filter, and it keeps
            the whole state axis on one line. */}
        <Axis label="Shelf">
          <div className="flex flex-wrap items-center gap-1">
            {SHELVES.map((shelf) => {
              const on = filters.shelf === shelf.id;
              const Icon = shelf.icon;
              return (
                <button
                  key={shelf.id}
                  type="button"
                  onClick={() => onChange({ shelf: shelf.id })}
                  aria-pressed={on}
                  title={shelf.label}
                  aria-label={shelf.label}
                  className={cn(
                    CHIP_BASE,
                    "inline-flex items-center gap-1 px-2 py-[3px] text-[10.5px]",
                    on
                      ? "bg-[var(--sb-text)] text-[var(--sb-panel)]"
                      : "text-[var(--sb-faint)] hover:text-[var(--sb-text)]",
                  )}
                >
                  {Icon && shelf.tally ? (
                    <>
                      <Icon className="size-2.5" />
                      <span className="sb-num">{counts[shelf.tally]}</span>
                    </>
                  ) : (
                    shelf.word
                  )}
                </button>
              );
            })}
          </div>
        </Axis>
      </div>
    </div>
  );
}
