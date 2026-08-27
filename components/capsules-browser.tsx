"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { CapsuleFilters } from "@/components/capsule-filters";
import { CapsuleTile, type CapsuleTileData } from "@/components/capsule-tile";
import {
  CATALOG,
  formatDays,
  formatEurBand,
  warningLabel,
  type CatalogIdea,
} from "@/lib/catalog";
import {
  NO_FILTERS,
  decodeFilters,
  encodeFilters,
  isSifted,
  siftCatalog,
  siftDeepCapsules,
  type CatalogFilters,
} from "@/lib/catalog-filter";
import { openCatalogIdea, openDeepCapsule } from "@/lib/capsule-focus";
import {
  DEEP_CAPSULES,
  capsuleState,
  capsuleWhere,
  formatCapsuleDays,
  formatEur,
  type DeepCapsule,
} from "@/lib/deep-capsules";
import { usePlanShortlist } from "@/lib/engine/use-plan";
import { photoFor, regionPhoto } from "@/lib/region-images";

/**
 * The Capsules page — the site's reading room.
 *
 * Everything the Catalog is was already in the Plan page's 280px rail, and
 * that was the problem: 413 researched-ish holiday ideas rendered as 96px rows
 * with their covers omitted and their arguments behind a click. Sifting worked;
 * *reading* did not. This page is the same data with the constraint removed —
 * a full-width grid of covers, the why on the card, and the filters spread
 * across a band instead of stacked behind a disclosure.
 *
 * Three decisions worth keeping:
 *
 * **The two tiers stay apart.** The eight researched Capsules get their own row
 * at larger size, above the 413. They are a different kind of thing — day-by-day
 * itineraries, operator prices, booking deadlines — and mixing them into one
 * grid would make the shallow tier look researched, which is the one lie the
 * whole sift exists to avoid. They *are* filtered by the same controls, though:
 * a page narrowed to Tasmania that still showed eight unrelated covers would be
 * incoherent.
 *
 * **The URL is the filter set.** `?q=reef&r=QLD&f=beach` is a view of the
 * Catalog someone can send to the other traveller. Writes go through
 * `history.replaceState` rather than the router, which Next syncs into
 * `useSearchParams` without a server round trip — a keystroke should re-filter
 * an array, not re-run a route.
 *
 * **The marks are the same marks.** No new store: `useShortlist` is the module
 * the Plan page's rail reads, so starring something here has already happened
 * by the time you navigate back.
 */

/* ------------------------------------------------------------------ */
/* Tier projections                                                    */
/* ------------------------------------------------------------------ */

function tileFromIdea(idea: CatalogIdea): CapsuleTileData {
  return {
    id: idea.id,
    kind: "idea",
    name: idea.name,
    state: idea.state,
    where: idea.where,
    why: idea.why_rated,
    seasonFit: idea.season_fit_dec_feb,
    days: formatDays(idea),
    cost: formatEurBand(idea),
    tags: idea.tags,
    facets: idea.facets,
    caveat: warningLabel(idea),
    photo: regionPhoto(idea.region),
  };
}

function tileFromCapsule(capsule: DeepCapsule): CapsuleTileData {
  return {
    id: capsule.id,
    kind: "deep",
    name: capsule.name,
    state: capsuleState(capsule),
    where: capsuleWhere(capsule),
    why: capsule.tagline,
    seasonFit: capsule.seasonFit,
    days: formatCapsuleDays(capsule),
    cost: formatEur(capsule.cost.ideal.eur),
    tags: capsule.tags,
    facets: capsule.facets,
    caveat: null,
    photo: photoFor({ id: capsule.id, region: capsule.region }),
  };
}

function openTile(tile: CapsuleTileData) {
  if (tile.kind === "deep") openDeepCapsule(tile.id);
  else openCatalogIdea(tile.id);
}

/**
 * The filter set, into the address bar.
 *
 * `replaceState` rather than `push`: sifting is not a sequence of places you
 * want the Back button to walk through one chip at a time. Next syncs the
 * native call into its own router, so this costs no server round trip and no
 * re-render of the route — the grid just re-filters an array.
 */
function writeUrl(filters: CatalogFilters): void {
  const query = encodeFilters(filters);
  window.history.replaceState(
    null,
    "",
    query ? `?${query}` : window.location.pathname,
  );
}

/* ------------------------------------------------------------------ */
/* Furniture                                                           */
/* ------------------------------------------------------------------ */

function SectionHead({
  label,
  count,
  note,
}: {
  label: string;
  count: number;
  note: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 className="font-display text-[19px] leading-none font-extrabold tracking-[-0.01em] text-[var(--sb-text)]">
        {label}
      </h2>
      <span className="sb-num text-[12px] text-[var(--sb-faint)]">{count}</span>
      <p className="min-w-0 flex-1 text-[11.5px] leading-snug text-[var(--sb-dim)]">
        {note}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The page body                                                       */
/* ------------------------------------------------------------------ */

export function CapsulesBrowser() {
  const params = useSearchParams();

  // The URL seeds the filters once; after that this state is the source of
  // truth and every change writes the URL back. Reading `useSearchParams` on
  // every render instead would make each keystroke a router update, and the
  // controlled search input would be one tick behind the caret.
  const [filters, setFilters] = useState<CatalogFilters>(() =>
    decodeFilters(params),
  );
  const [refineOpen, setRefineOpen] = useState(false);

  // Reconciled against the Plan, not the raw marks: the eight researched
  // Adventures start on the Plan with no verdict recorded, and a grid that drew
  // them as untouched is half of what made #58 feel like nothing happened.
  const { marks, counts, mark } = usePlanShortlist();

  // Both writers take the whole next filter set rather than a functional
  // updater on purpose: `writeUrl` touches the router, and a functional updater
  // runs during React's render pass, where updating another component is a
  // warning and, eventually, a bug.
  const apply = useCallback((next: CatalogFilters) => {
    setFilters(next);
    writeUrl(next);
  }, []);

  const patch = useCallback(
    (part: Partial<CatalogFilters>) => apply({ ...filters, ...part }),
    [apply, filters],
  );

  const reset = useCallback(() => apply(NO_FILTERS), [apply]);

  // Back and Forward still mean something: they walk between whole visited
  // URLs, and each of those carries a filter set to restore.
  useEffect(() => {
    const onPop = () => {
      setFilters(decodeFilters(new URLSearchParams(window.location.search)));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const deep = useMemo(
    () => siftDeepCapsules(DEEP_CAPSULES, filters, marks),
    [filters, marks],
  );
  const ideas = useMemo(
    () => siftCatalog(CATALOG, filters, marks),
    [filters, marks],
  );

  const deepTiles = useMemo(() => deep.map(tileFromCapsule), [deep]);
  const ideaTiles = useMemo(() => ideas.map(tileFromIdea), [ideas]);

  const sifted = isSifted(filters);
  const benched = counts.interested + counts.placed;

  return (
    <main className="sb-scroll h-full w-full overflow-y-auto">
      {/* ---- Masthead ---- */}
      <header className="mx-auto max-w-[1440px] px-5 pt-8 pb-6 sm:px-8 lg:pt-10">
        <p className="sb-label">The catalog</p>
        <h1 className="mt-2 font-display text-[32px] leading-[1.05] font-extrabold tracking-[-0.02em] text-[var(--sb-text)] lg:text-[40px]">
          Adventures
        </h1>
        <p className="mt-3 max-w-[64ch] text-[13.5px] leading-[1.7] text-[var(--sb-dim)] lg:text-[14.5px]">
          <span className="sb-num font-semibold text-[var(--sb-text)]">
            {CATALOG.length}
          </span>{" "}
          holiday ideas mined in bulk from forums, YouTube and travel lore, and{" "}
          <span className="sb-num font-semibold text-[var(--sb-text)]">
            {DEEP_CAPSULES.length}
          </span>{" "}
          blocks researched properly. Nothing here is on the Plan until you put
          it there — star what appeals, plan what you mean, discard the rest.
          Sifting is the job; comprehensiveness beats curation at this tier.
        </p>

        {benched > 0 && (
          <p className="mt-3.5 text-[12px] text-[var(--sb-dim)]">
            <span className="sb-num font-semibold text-[var(--sb-accent)]">
              {counts.interested}
            </span>{" "}
            on the bench,{" "}
            <span className="sb-num font-semibold text-[var(--sb-good)]">
              {counts.placed}
            </span>{" "}
            on the Plan ·{" "}
            <Link
              href="/"
              className="font-semibold text-[var(--sb-text)] underline decoration-[var(--sb-line)] underline-offset-2 hover:decoration-[var(--sb-accent)]"
            >
              see the shortlist on the Plan
            </Link>
          </p>
        )}
      </header>

      {/* ---- The sift, sticky ---- */}
      <div className="sticky top-0 z-30 border-y border-[var(--sb-line)] bg-[color-mix(in_srgb,var(--sb-ink)_88%,transparent)] backdrop-blur-xl">
        <div className="mx-auto max-w-[1440px] px-5 py-3 sm:px-8">
          <CapsuleFilters
            filters={filters}
            onChange={patch}
            onReset={reset}
            counts={counts}
            shown={ideas.length}
            refineOpen={refineOpen}
            onToggleRefine={() => setRefineOpen((open) => !open)}
          />
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-5 pb-20 sm:px-8">
        {/* ---- The researched eight ---- */}
        {deepTiles.length > 0 && (
          <section className="pt-7">
            <SectionHead
              label="Researched"
              count={deepTiles.length}
              note="Day-by-day itineraries, operator prices and dated booking deadlines. These are the ones the site can argue about."
            />
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {deepTiles.map((tile) => (
                <CapsuleTile
                  key={tile.id}
                  tile={tile}
                  size="hero"
                  state={marks[tile.id] ?? "unseen"}
                  onOpen={openTile}
                  onMark={mark}
                />
              ))}
            </div>
          </section>
        )}

        {/* ---- The 413 ---- */}
        <section className="pt-9">
          <SectionHead
            label="Ideas"
            count={ideaTiles.length}
            note="A few lines each, no itinerary and no operator prices. In-season ideas sort first; tap a card to read it and to see what the sweep flagged."
          />

          {ideaTiles.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {ideaTiles.map((tile) => (
                <CapsuleTile
                  key={tile.id}
                  tile={tile}
                  size="grid"
                  state={marks[tile.id] ?? "unseen"}
                  onOpen={openTile}
                  onMark={mark}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-[var(--sb-line)] px-6 py-12 text-center">
              <p className="text-[13px] text-[var(--sb-dim)]">
                Nothing survives that combination.
              </p>
              {sifted && (
                <button
                  type="button"
                  onClick={reset}
                  className="mt-2 cursor-pointer text-[12.5px] font-semibold text-[var(--sb-accent)] hover:underline"
                >
                  Reset the sift
                </button>
              )}
            </div>
          )}
        </section>

        <p className="mt-10 border-t border-[var(--sb-line)] pt-4 text-[11px] leading-relaxed text-[var(--sb-faint)]">
          Marks are kept in this browser — there are no accounts. Covers are
          generated from each entry&rsquo;s own region and facets: placeholders,
          not photographs of the place. Placing an idea on the calendar lands
          with the Scheduler.
        </p>
      </div>
    </main>
  );
}
