"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, FlaskConical, Star, X } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { openCatalogIdea, openDeepCapsule } from "@/lib/capsule-focus";
import {
  CATALOG,
  SEASON_LABEL,
  SEASON_TOKEN,
  catalogIdeaById,
  formatDays,
  formatEurBand,
  type SeasonFit,
} from "@/lib/catalog";
import {
  capsuleState,
  capsuleWhere,
  deepCapsuleById,
  formatCapsuleDays,
  formatEur,
} from "@/lib/deep-capsules";
import { usePlanShortlist } from "@/lib/engine/use-plan";
import type { MarkedState, ShortlistMap } from "@/lib/shortlist";
import { cn } from "@/lib/utils";

/**
 * The Plan page's shortlist rail — what is left of the Catalog drawer.
 *
 * It used to hold the whole sift: a search box, twelve facet chips, nine
 * region chips, two sliders, five shelves and all 413 ideas, in a 280px column
 * beside a globe. #40 moved that to `/capsules`, where it has a page to itself,
 * and the rule that made the move worth making is that the Catalog now exists
 * in exactly one place. Nothing here browses. What is left is the half the Plan
 * page actually needs while you are looking at a map: the things you have
 * already said yes to, and one door back to the room where you say it.
 *
 * So: interested and placed entries only. Discarded ideas are not here —
 * discarding is a decision to stop seeing something, and a rail that kept
 * showing them would be a filter, not a shortlist. The counts still say how
 * many there are, because "413 ideas, 6 interested, 41 discarded" is a
 * progress report on the sift and worth reading at a glance.
 *
 * Both tiers land here. A researched Capsule marked from `/capsules` and a
 * Catalog idea marked from the same grid are the same kind of commitment once
 * they are on the bench, so they share a row shape and the researched one wears
 * a flask.
 */

/** Above this width the rail is docked open by default. Unchanged from the
 *  drawer it replaces: 1280px is the narrowest laptop where a rail, the cost
 *  HUD and a globe worth looking at can all coexist. */
const DOCK_QUERY = "(min-width: 1280px)";

interface RailEntry {
  id: string;
  kind: "deep" | "idea";
  name: string;
  /** "WA · South West / Margaret River". */
  place: string;
  days: string;
  cost: string;
  seasonFit: SeasonFit;
  /** Whether it is on the Plan rather than only on the bench. */
  placed: boolean;
}

/**
 * The marks, resolved back into things with names.
 *
 * A mark is an id and a verdict; the rail needs a row. Ids are looked up in the
 * Catalog first and the researched corpus second — the two id spaces are
 * disjoint by construction (the sweep deliberately left the marquee blocks out
 * of `catalog.json`), so order is a formality rather than a precedence rule. An
 * id that resolves to neither is a mark left behind by an entry that has since
 * been re-cut, and it is dropped rather than rendered as an empty row.
 */
function railEntries(marks: ShortlistMap): RailEntry[] {
  const entries: RailEntry[] = [];

  // These are `usePlanShortlist`'s reconciled verdicts, so *placed* is exactly
  // "on the Plan" — including the eight researched Adventures the reference
  // Scenario starts with and never recorded a verdict for. Listing only marked
  // ideas left the traveller with no control over the eight that were actually
  // costing money (#58).
  for (const [id, state] of Object.entries(marks)) {
    if (state !== "interested" && state !== "placed") continue;
    const placed = state === "placed";

    const idea = catalogIdeaById(id);
    if (idea) {
      entries.push({
        id,
        kind: "idea",
        name: idea.name,
        place: idea.where ? `${idea.state} · ${idea.where}` : idea.state,
        days: formatDays(idea),
        cost: formatEurBand(idea),
        seasonFit: idea.season_fit_dec_feb,
        placed,
      });
      continue;
    }

    const capsule = deepCapsuleById(id);
    if (capsule) {
      const where = capsuleWhere(capsule);
      entries.push({
        id,
        kind: "deep",
        name: capsule.name,
        place: where ? `${capsuleState(capsule)} · ${where}` : capsuleState(capsule),
        days: formatCapsuleDays(capsule),
        cost: formatEur(capsule.cost.ideal.eur),
        seasonFit: capsule.seasonFit,
        placed,
      });
    }
  }

  // On the Plan first — those are the ones with calendar consequences — then
  // the bench, alphabetically inside each.
  return entries.toSorted(
    (a, b) =>
      Number(b.placed) - Number(a.placed) || a.name.localeCompare(b.name),
  );
}

/* ------------------------------------------------------------------ */
/* One row                                                             */
/* ------------------------------------------------------------------ */

function ShortlistRow({
  entry,
  onMark,
}: {
  entry: RailEntry;
  onMark: (id: string, state: MarkedState) => void;
}) {
  return (
    <li
      className={cn(
        "rounded-lg border transition-colors motion-reduce:transition-none",
        entry.placed
          ? "border-[color-mix(in_srgb,var(--sb-good)_50%,transparent)] bg-[color-mix(in_srgb,var(--sb-good)_13%,var(--sb-panel-2))]"
          : "border-[color-mix(in_srgb,var(--sb-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--sb-accent)_12%,var(--sb-panel-2))]",
      )}
    >
      <div className="flex items-start gap-1 px-2 pt-1.5">
        <button
          type="button"
          onClick={() =>
            entry.kind === "deep"
              ? openDeepCapsule(entry.id)
              : openCatalogIdea(entry.id)
          }
          aria-haspopup="dialog"
          title={`Open ${entry.name}`}
          className="min-w-0 flex-1 cursor-pointer text-left"
        >
          <span className="flex items-start gap-1">
            {entry.kind === "deep" && (
              <FlaskConical
                className="mt-[2px] size-2.5 shrink-0 text-[var(--sb-accent)]"
                aria-label="Researched"
              />
            )}
            <span className="line-clamp-2 text-[12px] leading-tight font-semibold">
              {entry.name}
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] text-[var(--sb-faint)]">
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: SEASON_TOKEN[entry.seasonFit] }}
              title={SEASON_LABEL[entry.seasonFit]}
            />
            <span className="truncate">{entry.place}</span>
          </span>
        </button>

        {/* Clearing the mark, not discarding it: an idea taken off the bench
            goes back to unseen and turns up in the Catalog again. Discarding
            is a verdict, and it belongs on the page where you are reading. */}
        <button
          type="button"
          onClick={() => onMark(entry.id, entry.placed ? "placed" : "interested")}
          aria-label={`Take ${entry.name} off the shortlist`}
          title={`Take ${entry.name} off the shortlist`}
          className="-mt-0.5 shrink-0 cursor-pointer rounded p-1 text-[var(--sb-faint)] transition-colors hover:bg-[var(--sb-panel)] hover:text-[var(--sb-text)] motion-reduce:transition-none"
        >
          <X className="size-3" />
        </button>
      </div>

      <div className="flex items-center gap-2 px-2 pt-1 pb-1.5">
        <span className="sb-num shrink-0 text-[10px] text-[var(--sb-faint)]">
          {entry.days}
        </span>
        <span className="sb-num shrink-0 text-[10.5px] font-medium">
          {entry.cost}
        </span>

        <label className="ml-auto flex cursor-pointer items-center gap-1.5">
          <span
            className={cn(
              "text-[10px] font-semibold whitespace-nowrap",
              entry.placed ? "text-[var(--sb-good)]" : "text-[var(--sb-dim)]",
            )}
          >
            In the plan
          </span>
          <Switch
            size="sm"
            checked={entry.placed}
            onCheckedChange={(next) =>
              onMark(entry.id, next ? "placed" : "interested")
            }
            aria-label={`Include ${entry.name} in the plan`}
            className="data-checked:bg-[var(--sb-good)]"
          />
        </label>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* The rail's contents, shared by the docked and the phone rendering    */
/* ------------------------------------------------------------------ */

function ShortlistBody() {
  const { marks, counts, mark } = usePlanShortlist();
  const entries = useMemo(() => railEntries(marks), [marks]);

  return (
    <>
      <div className="flex items-baseline justify-between gap-2 pr-6">
        <p className="sb-label">Shortlist</p>
        {entries.length > 0 && (
          <p className="sb-num text-[10px] text-[var(--sb-faint)]">
            {entries.length}
          </p>
        )}
      </div>

      <p className="mt-1 text-[10.5px] leading-tight text-[var(--sb-dim)]">
        <span className="sb-num text-[var(--sb-accent)]">
          {counts.interested}
        </span>{" "}
        interested ·{" "}
        <span className="sb-num text-[var(--sb-good)]">{counts.placed}</span> on
        the plan
        {counts.discarded > 0 && (
          <>
            {" · "}
            <span className="sb-num">{counts.discarded}</span> discarded
          </>
        )}
      </p>

      {/* The door back to the Catalog. Prominent on purpose: it is the only
          way into the 413 from this page now, and a link that quiet would be
          a dead end wearing a signpost. */}
      <Link
        href="/adventures"
        className="group mt-2.5 flex min-h-9 items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--sb-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--sb-accent)_10%,transparent)] px-2.5 py-1.5 transition-colors hover:bg-[color-mix(in_srgb,var(--sb-accent)_18%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sb-accent)] motion-reduce:transition-none"
      >
        <span className="min-w-0 flex-1 text-[11.5px] leading-tight font-semibold text-[var(--sb-text)]">
          Browse all <span className="sb-num">{CATALOG.length}</span> ideas
        </span>
        <ArrowRight className="size-3.5 shrink-0 text-[var(--sb-accent)] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
      </Link>

      {entries.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-[var(--sb-line)] px-3 py-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--sb-text)]">
            <Star className="size-3 text-[var(--sb-accent)]" />
            Nothing on the bench yet
          </p>
          <p className="mt-1 text-[10.5px] leading-snug text-[var(--sb-dim)]">
            Mark an idea <span className="font-semibold">interested</span> in
            the Catalog and it turns up here, ready to be given calendar days.
          </p>
        </div>
      ) : (
        <>
          <ul className="sb-scroll mt-2.5 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1 [mask-image:linear-gradient(to_bottom,black_calc(100%-24px),transparent)]">
            {entries.map((entry) => (
              <ShortlistRow key={entry.id} entry={entry} onMark={mark} />
            ))}
          </ul>
          <p className="mt-2 border-t border-[var(--sb-line)] pt-1.5 text-[10px] leading-snug text-[var(--sb-faint)]">
            Marks are kept in this browser. Putting an idea in the plan lands it
            on the calendar with the Scheduler.
          </p>
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The shell                                                           */
/* ------------------------------------------------------------------ */

export function ShortlistRail() {
  const { counts } = usePlanShortlist();
  const benched = counts.interested + counts.placed;

  // Server-rendered collapsed, then opened by the effect on a wide viewport:
  // `matchMedia` has no answer during SSR, and collapsed is the safe first
  // paint — it never covers the globe before the real width is known.
  const [collapsed, setCollapsed] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Once the traveller opens or closes the rail themselves it is theirs, and a
  // window resize stops overruling them.
  const chosen = useRef(false);

  useEffect(() => {
    const media = window.matchMedia(DOCK_QUERY);
    const apply = () => {
      if (!chosen.current) setCollapsed(!media.matches);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const choose = (next: boolean) => {
    chosen.current = true;
    setCollapsed(next);
  };

  return (
    <>
      {/* ---- Desktop: docked rail, or the tab that opens it ---- */}
      <aside
        className={cn(
          "pointer-events-auto absolute top-4 left-4 z-20 hidden lg:flex",
          // A shortlist shrink-wraps; the Catalog drawer it replaces ran the
          // full height because it always had 413 rows to run it with. Six
          // benched ideas in a column reaching the date strip would be a lot
          // of glass over a map with nothing on it.
          collapsed
            ? "w-11"
            : "max-h-[calc(100%-var(--sb-strip-h)-2rem)] w-[264px]",
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={() => choose(false)}
            className="sb-panel flex w-full cursor-pointer flex-col items-center gap-2.5 py-3 transition-colors hover:bg-[var(--sb-panel-2)] motion-reduce:transition-none"
            aria-label={`Expand the shortlist rail — ${benched} marked`}
          >
            <Star className="size-4 text-[var(--sb-accent)]" />
            <span
              className="sb-label whitespace-nowrap"
              style={{ writingMode: "vertical-rl" }}
            >
              Shortlist · {benched}
            </span>
          </button>
        ) : (
          <div className="sb-panel relative flex w-full flex-col p-3">
            <button
              type="button"
              onClick={() => choose(true)}
              aria-label="Collapse the shortlist rail"
              className="absolute top-2.5 right-2.5 z-10 cursor-pointer rounded-md p-1 text-[var(--sb-faint)] transition-colors hover:bg-[var(--sb-panel-2)] hover:text-[var(--sb-text)] motion-reduce:transition-none"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <ShortlistBody />
          </div>
        )}
      </aside>

      {/* ---- Phone: a compact launcher, level with the share pill ----

          It used to be a wide CATALOG button on the row below, which
          overlapped the share pill by about 35px at 375px wide (#44). Both
          pills now sit on one line — star and tally on the left, the share
          link on the right — which is 68px plus 248px inside a 343px band,
          and reads as a pair rather than as a collision. */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-label={`Open the shortlist — ${benched} marked`}
        className="sb-panel pointer-events-auto absolute bottom-[var(--sb-pill-bottom)] left-4 z-30 flex min-h-11 cursor-pointer items-center gap-1.5 px-3 py-2 lg:hidden"
      >
        <Star className="size-3.5 text-[var(--sb-accent)]" />
        <span className="sb-num text-[12px] font-semibold text-[var(--sb-text)]">
          {benched}
        </span>
      </button>

      {sheetOpen && (
        <div className="absolute inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close the shortlist"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 cursor-default bg-[rgb(7_12_20/0.6)] backdrop-blur-[2px]"
          />
          {/* Shrink-wrapped, like the docked rail: a sheet that always reached
              the tab bar spent most of its glass on nothing. */}
          <div className="sb-panel absolute top-3 right-3 left-3 flex max-h-[calc(100%-1.5rem)] max-w-[340px] flex-col p-3.5">
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              aria-label="Close the shortlist"
              className="absolute top-3 right-3 z-10 cursor-pointer rounded-md p-1 text-[var(--sb-faint)] hover:text-[var(--sb-text)]"
            >
              <X className="size-3.5" />
            </button>
            <ShortlistBody />
          </div>
        </div>
      )}
    </>
  );
}
