"use client";

import { useMemo, useState } from "react";
import {
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";

import { CatalogRow } from "@/components/catalog-row";
import { DeepCapsuleStrip } from "@/components/deep-capsule-strip";
import {
  AUD_TO_EUR,
  CATALOG,
  CATALOG_STATES,
  SEASON_LABEL,
  SEASON_RANK,
  SEASON_TOKEN,
  type SeasonFit,
} from "@/lib/catalog";
import { FACETS, type FacetId } from "@/lib/facets";
import { useShortlist, type ShortlistCounts } from "@/lib/shortlist";
import { cn } from "@/lib/utils";

/**
 * The sift.
 *
 * 413 ideas, ten filters and four shortlist states in a 320px column. The
 * rules that keep it usable at that width:
 *
 * - Search and the facet chips are always visible; the numeric filters live
 *   behind a disclosure, because they are the ones you set once.
 * - Every filter widens or narrows, none of them hide the count: the header
 *   always says how many of the 413 survived.
 * - Selecting several facets is an OR. Chips that narrow to nothing are a
 *   worse experience than chips that gather.
 *
 * There used to be a third control here, a "her view / his view" taste lens
 * that re-ordered the list by whose pick an idea was. It came out in #36: two
 * people sifting one Catalog together do not want the list rearranging itself
 * around a guess at which of them is holding the laptop, and the facet chips
 * already say the same thing more honestly — pressing `hippie` or `sport` is
 * the traveller stating what they want, not the site inferring it.
 */

const SEASON_FITS: readonly SeasonFit[] = ["good", "ok", "poor", "no"];

/** Slider stops rather than a linear range: 284 of the 413 are one-day ideas,
 *  so a linear 1–90 slider would spend 95% of its travel on eight entries. */
const DAY_STOPS: readonly number[] = [1, 2, 3, 4, 5, 7, 10, 14, Infinity];

/** EUR, top of the entry's band. Stops bunch where the Catalog bunches:
 *  half of it tops out under €215, and 23 entries carry the long tail. */
const COST_STOPS: readonly number[] = [
  25,
  50,
  100,
  150,
  200,
  300,
  400,
  600,
  800,
  1200,
  1800,
  2500,
  Infinity,
];

type ShelfId = "open" | "unseen" | "interested" | "placed" | "discarded";

/**
 * The shelves. The three marked ones show their icon and their count instead
 * of a word — the icons are the same ones the row buttons use, it keeps the
 * whole state filter on one line, and the counts are the thing you actually
 * want to see there.
 */
const SHELVES: {
  id: ShelfId;
  label: string;
  icon?: typeof Star;
  tally?: keyof ShortlistCounts;
}[] = [
  { id: "open", label: "Open — everything not discarded" },
  { id: "unseen", label: "Unseen — not marked yet" },
  { id: "interested", label: "Interested", icon: Star, tally: "interested" },
  { id: "placed", label: "Placed on the Plan", icon: MapPin, tally: "placed" },
  { id: "discarded", label: "Discarded", icon: X, tally: "discarded" },
];

const SHELF_WORD: Record<string, string> = { open: "Open", unseen: "Unseen" };

const CHIP_BASE =
  "cursor-pointer rounded-full px-2 py-[3px] text-[10.5px] font-medium whitespace-nowrap transition-colors";
const CHIP_OFF =
  "bg-[color-mix(in_srgb,var(--sb-line)_45%,transparent)] text-[var(--sb-dim)] hover:text-[var(--sb-text)]";

/** Chips light in their facet's own signal colour; text flips to the panel
 *  ink so the label stays readable on every one of them. */
function chipOnStyle(token: string) {
  return { background: `var(${token})`, color: "var(--primary-foreground)" };
}

const TONE_TOKEN = {
  accent: "--sb-accent",
  sea: "--sb-sea",
  warn: "--sb-warn",
} as const;

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

export function CatalogSift() {
  const [query, setQuery] = useState("");
  const [facets, setFacets] = useState<FacetId[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [seasons, setSeasons] = useState<SeasonFit[]>([]);
  const [dayStop, setDayStop] = useState(DAY_STOPS.length - 1);
  const [costStop, setCostStop] = useState(COST_STOPS.length - 1);
  const [shelf, setShelf] = useState<ShelfId>("open");
  const [showFilters, setShowFilters] = useState(false);

  const { marks, counts, toggle: mark } = useShortlist();

  const maxDays = DAY_STOPS[dayStop];
  const maxCost = COST_STOPS[costStop];

  const filterCount =
    states.length +
    seasons.length +
    (maxDays === Infinity ? 0 : 1) +
    (maxCost === Infinity ? 0 : 1);
  const dirty =
    filterCount > 0 || facets.length > 0 || query !== "" || shelf !== "open";

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const kept = CATALOG.filter((idea) => {
      const state = marks[idea.id];
      if (shelf === "open") {
        if (state === "discarded") return false;
      } else if (shelf === "unseen") {
        if (state) return false;
      } else if (state !== shelf) return false;

      if (needle && !idea.haystack.includes(needle)) return false;
      if (states.length > 0 && !states.includes(idea.state)) return false;
      if (seasons.length > 0 && !seasons.includes(idea.season_fit_dec_feb)) {
        return false;
      }
      if (idea.days_min > maxDays) return false;
      if (idea.costEurMax > maxCost) return false;
      if (
        facets.length > 0 &&
        !facets.some((facet) => idea.facets.includes(facet))
      ) {
        return false;
      }
      return true;
    });

    // One order, always: the ideas that suit a December-to-February trip
    // float, and ties break alphabetically. Nothing re-ranks behind the
    // traveller's back.
    return kept.toSorted(
      (a, b) =>
        SEASON_RANK[a.season_fit_dec_feb] - SEASON_RANK[b.season_fit_dec_feb] ||
        a.name.localeCompare(b.name),
    );
  }, [query, facets, states, seasons, maxDays, maxCost, shelf, marks]);

  const reset = () => {
    setQuery("");
    setFacets([]);
    setStates([]);
    setSeasons([]);
    setDayStop(DAY_STOPS.length - 1);
    setCostStop(COST_STOPS.length - 1);
    setShelf("open");
  };

  const soleFacet =
    facets.length === 1 ? FACETS.find((f) => f.id === facets[0]) : undefined;

  return (
    <>
      {/* ---- Header: what the Catalog is, and what has been done to it ---- */}
      {/* The right padding clears the panel's collapse / close button. */}
      <div className="flex items-baseline justify-between gap-2 pr-6">
        <p className="sb-label">Catalog</p>
        {visible.length !== CATALOG.length && (
          <p className="sb-num text-[10px] text-[var(--sb-faint)]">
            {visible.length} shown
          </p>
        )}
      </div>
      <p className="mt-1 text-[10.5px] leading-tight text-[var(--sb-dim)]">
        <span className="sb-num">{CATALOG.length}</span> ideas
        {counts.interested > 0 && (
          <>
            {" · "}
            <span className="sb-num text-[var(--sb-accent)]">
              {counts.interested}
            </span>{" "}
            interested
          </>
        )}
        {counts.placed > 0 && (
          <>
            {" · "}
            <span className="sb-num text-[var(--sb-good)]">
              {counts.placed}
            </span>{" "}
            placed
          </>
        )}
        {counts.discarded > 0 && (
          <>
            {" · "}
            <span className="sb-num">{counts.discarded}</span> discarded
          </>
        )}
      </p>

      {/* ---- The eight researched Capsules, above the sift and outside it ---- */}
      <DeepCapsuleStrip />

      {/* ---- Search ---- */}
      <div className="relative mt-2.5">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 text-[var(--sb-faint)]" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${CATALOG.length} ideas…`}
          aria-label="Search the Catalog"
          className="h-7 w-full rounded-md border border-[var(--sb-line)] bg-[color-mix(in_srgb,var(--sb-panel-2)_70%,transparent)] pr-6 pl-7 text-[11.5px] text-[var(--sb-text)] outline-none placeholder:text-[var(--sb-faint)] focus:border-[var(--sb-accent)] [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear the search"
            className="absolute top-1/2 right-1.5 flex size-4 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-[var(--sb-faint)] hover:text-[var(--sb-text)]"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {/* ---- Facet chips ---- */}
      <div className="mt-2 flex flex-wrap gap-1">
        {FACETS.map((facet) => {
          const on = facets.includes(facet.id);
          return (
            <button
              key={facet.id}
              type="button"
              onClick={() => setFacets((current) => toggle(current, facet.id))}
              aria-pressed={on}
              title={facet.hint}
              className={cn(CHIP_BASE, !on && CHIP_OFF)}
              style={on ? chipOnStyle(TONE_TOKEN[facet.tone]) : undefined}
            >
              {facet.label}
            </button>
          );
        })}
      </div>

      <p className="mt-1.5 text-[10px] leading-snug text-[var(--sb-faint)]">
        {soleFacet
          ? soleFacet.hint
          : "Chips gather rather than narrow — pick several. In-season ideas sort first."}
      </p>

      {/* ---- Numeric filters, behind a disclosure ---- */}
      <div className="mt-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setShowFilters((open) => !open)}
          aria-expanded={showFilters}
          className={cn(
            "flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold tracking-[0.1em] uppercase transition-colors hover:bg-[color-mix(in_srgb,var(--sb-line)_45%,transparent)]",
            filterCount > 0
              ? "text-[var(--sb-accent)]"
              : "text-[var(--sb-dim)]",
          )}
        >
          <SlidersHorizontal className="size-3" />
          Filters
          {filterCount > 0 && <span className="sb-num">· {filterCount}</span>}
        </button>
        {dirty && (
          <button
            type="button"
            onClick={reset}
            className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold tracking-[0.1em] text-[var(--sb-faint)] uppercase transition-colors hover:text-[var(--sb-text)]"
          >
            <RotateCcw className="size-3" />
            Reset
          </button>
        )}
      </div>

      {showFilters && (
        <div className="mt-1.5 rounded-lg border border-[var(--sb-line)] bg-[color-mix(in_srgb,var(--sb-panel-2)_55%,transparent)] p-2">
          <p className="sb-label text-[9px]">Region</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {CATALOG_STATES.map((state) => {
              const on = states.includes(state);
              return (
                <button
                  key={state}
                  type="button"
                  onClick={() => setStates((current) => toggle(current, state))}
                  aria-pressed={on}
                  className={cn(CHIP_BASE, !on && CHIP_OFF)}
                  style={on ? chipOnStyle("--sb-sea") : undefined}
                >
                  {state}
                </button>
              );
            })}
          </div>

          <p className="sb-label mt-2.5 text-[9px]">Season fit · Dec–Feb</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {SEASON_FITS.map((fit) => {
              const on = seasons.includes(fit);
              return (
                <button
                  key={fit}
                  type="button"
                  onClick={() => setSeasons((current) => toggle(current, fit))}
                  aria-pressed={on}
                  className={cn(CHIP_BASE, !on && CHIP_OFF)}
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

          <div className="mt-2.5 flex items-baseline justify-between">
            <p className="sb-label text-[9px]">Length</p>
            <p className="sb-num text-[10px] text-[var(--sb-dim)]">
              {maxDays === Infinity ? "any" : `≤ ${maxDays} days`}
            </p>
          </div>
          <input
            type="range"
            min={0}
            max={DAY_STOPS.length - 1}
            step={1}
            value={dayStop}
            onChange={(event) => setDayStop(Number(event.target.value))}
            aria-label="Longest stay to show"
            className="mt-1 h-4 w-full cursor-pointer accent-[var(--sb-accent)]"
          />

          <div className="mt-1.5 flex items-baseline justify-between">
            <p className="sb-label text-[9px]">Cost ceiling · couple</p>
            <p className="sb-num text-[10px] text-[var(--sb-dim)]">
              {maxCost === Infinity ? "any" : `≤ €${maxCost}`}
            </p>
          </div>
          <input
            type="range"
            min={0}
            max={COST_STOPS.length - 1}
            step={1}
            value={costStop}
            onChange={(event) => setCostStop(Number(event.target.value))}
            aria-label="Most the idea may cost, top of its band"
            className="mt-1 h-4 w-full cursor-pointer accent-[var(--sb-accent)]"
          />
          <p className="mt-1 text-[9.5px] leading-snug text-[var(--sb-faint)]">
            Costs are the top of each AUD band at A$1 = €{AUD_TO_EUR}. Length
            filters on the shortest worthwhile stay.
          </p>
        </div>
      )}

      {/* ---- Shortlist shelves ---- */}
      <div className="mt-2 flex flex-wrap gap-1">
        {SHELVES.map((entry) => {
          const on = shelf === entry.id;
          const Icon = entry.icon;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setShelf(entry.id)}
              aria-pressed={on}
              title={entry.label}
              aria-label={entry.label}
              className={cn(
                CHIP_BASE,
                "inline-flex items-center gap-1",
                on
                  ? "bg-[var(--sb-text)] text-[var(--sb-panel)]"
                  : "text-[var(--sb-faint)] hover:text-[var(--sb-text)]",
              )}
            >
              {Icon && entry.tally ? (
                <>
                  <Icon className="size-2.5" />
                  <span className="sb-num">{counts[entry.tally]}</span>
                </>
              ) : (
                SHELF_WORD[entry.id]
              )}
            </button>
          );
        })}
      </div>

      {/* One helper line for the whole list. The three buttons on every row
          say what they do; what they *mean* is a fact about the Plan — a
          bench, a calendar, a shelf you stop looking at — and repeating that
          413 times would be worse than saying it once, here. */}
      <p className="mt-2 text-[10px] leading-snug text-[var(--sb-faint)]">
        Tap a row to read it.{" "}
        <span className="font-semibold text-[var(--sb-accent)]">Interested</span>{" "}
        benches an idea,{" "}
        <span className="font-semibold text-[var(--sb-good)]">Plan</span> gives
        it days, <span className="font-semibold">Discard</span> hides it. Tap
        again to undo.
      </p>

      {/* The mask makes the cut-off row at the bottom read as "there is more"
          rather than as a clipping bug. */}
      <ul className="sb-scroll mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1 [mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]">
        {visible.map((idea) => (
          <CatalogRow
            key={idea.id}
            idea={idea}
            state={marks[idea.id] ?? "unseen"}
            onMark={mark}
          />
        ))}
        {visible.length === 0 && (
          <li className="rounded-lg border border-dashed border-[var(--sb-line)] px-3 py-4 text-center">
            <p className="text-[11px] text-[var(--sb-dim)]">
              Nothing survives that combination.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-1.5 cursor-pointer text-[10.5px] font-semibold text-[var(--sb-accent)] hover:underline"
            >
              Reset the sift
            </button>
          </li>
        )}
      </ul>

      <p className="mt-2 border-t border-[var(--sb-line)] pt-1.5 text-[10px] leading-snug text-[var(--sb-faint)]">
        Marks are kept in this browser. Placing an idea on the calendar lands
        with the Scheduler.
      </p>
    </>
  );
}
