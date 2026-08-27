"use client";

/**
 * The Resources page (#67) — a reading room, not a dashboard.
 *
 * Every other section argues with you: the Ledger prices your choices, the
 * Budget marks them against a ceiling, the globe redraws when you toggle. This
 * page has no opinion about the Plan and no state of its own. It is a shelf,
 * and the layout says so — one column at a reading measure, hairlines instead
 * of cards, and the eye landing on the entry's *figure* rather than on chrome.
 *
 * The one live thing is the countdown. A deadline written as "1 Oct" is a fact
 * you have to do arithmetic on; written as "34d" it is a fact you can feel, and
 * that difference is the entire reason a static directory earns a client
 * component. Everything else renders identically on the server.
 */

import { ArrowUpRight } from "lucide-react";

import { daysUntil, useToday } from "@/lib/countdown";
import {
  RESOURCE_GROUPS,
  datedResources,
  resourcesIn,
  type Resource,
  type ResourceGroup,
} from "@/lib/resources";
import { formatDay } from "@/lib/trip-dates";
import { cn } from "@/lib/utils";

/**
 * What each shelf is for, in the page's own voice.
 *
 * Kept here rather than in `lib/resources.ts` because it is copy, not data: the
 * data file holds claims that can go stale and carry sources, and these
 * sentences are neither.
 */
const GROUP_BLURBS: Record<ResourceGroup, string> = {
  "Getting around cheap":
    "Rental fleets drift out of balance every season, and moving a van back by transporter costs an operator hundreds — so they let a traveller drive it for a dollar a day. These are the boards that list them, the terms that govern them, and the two romantic alternatives priced honestly enough to reject.",
  "Staying free":
    "House-sitting is the largest single lodging lever anywhere in the research and the one you are least likely to win. Join early, build reviews before December, widen the net past the inner city — and model the Plan with paid lodging anyway.",
  Booking:
    "Australian fares and beds are bucketed inventory: cheap buckets sell, the price steps up, and it essentially never comes back down. Nothing on this shelf gets cheaper by waiting, and two of these dates are ten-minute windows.",
  "Documents & money":
    "The paperwork that decides whether the second driver is legal and whether a A$1,000 excess is yours or the card's. Almost all of it has to be settled in Valencia, before anyone gets on a plane.",
  "Weather & season":
    "No official forecast covering the trip window exists yet — the first one lands in mid-November. These are the pages that will publish it, on the dates they publish it, plus the two that decide whether the reef is worth the January bet.",
};

/* ------------------------------------------------------------------ */
/* The countdown chip                                                  */
/* ------------------------------------------------------------------ */

/**
 * How loud a deadline gets to be.
 *
 * Three bands rather than a gradient, because the reader is making a binary
 * decision — do I deal with this today or not — and a smooth ramp answers that
 * question worse than three steps do. Inside a fortnight is the site's accent
 * red; inside two months is the warn amber; beyond that it is just a number.
 */
function toneFor(days: number): string {
  if (days <= 14) return "text-[var(--sb-accent)]";
  if (days <= 60) return "text-[var(--sb-warn)]";
  return "text-[var(--sb-dim)]";
}

function Countdown({ resource }: { resource: Resource }) {
  const today = useToday();
  const deadline = resource.deadline;
  if (!deadline) return null;

  const days = today ? daysUntil(today, deadline.date) : null;
  const passed = days !== null && days < 0;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-baseline gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] leading-none whitespace-nowrap",
        passed
          ? "bg-[var(--sb-panel-2)] text-[var(--sb-faint)]"
          : "bg-[color-mix(in_srgb,var(--sb-warn)_13%,transparent)]",
      )}
    >
      {/* Before the client's clock arrives this is the date alone — honest,
          and the same width band, so nothing jumps when the number lands. */}
      {days === null ? (
        <span className="sb-num text-[var(--sb-dim)]">
          {deadline.kind} {formatDay(deadline.date)}
        </span>
      ) : passed ? (
        <span className="sb-num">passed · {formatDay(deadline.date)}</span>
      ) : (
        <>
          <span className={cn("sb-num font-semibold", toneFor(days))}>
            {days === 0 ? "today" : `${days}d`}
          </span>
          <span className="text-[var(--sb-dim)]">
            {deadline.kind} {formatDay(deadline.date)}
          </span>
        </>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* An entry                                                            */
/* ------------------------------------------------------------------ */

/**
 * One row: name, why, figure, source.
 *
 * The whole row is the link target rather than just the name — a directory you
 * have to hit a four-word anchor in is a directory you stop using on a phone —
 * and the arrow sits with the name so the destination is obvious before the
 * click. `noopener` on every one of them: these all leave the site.
 */
function Entry({ resource }: { resource: Resource }) {
  return (
    <li className="border-b border-[var(--sb-line)] last:border-b-0">
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block py-5 transition-colors hover:bg-[color-mix(in_srgb,var(--sb-panel-2)_55%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sb-accent)] motion-reduce:transition-none"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h3 className="font-display text-[17px] leading-tight font-bold tracking-[-0.01em] text-[var(--sb-text)] group-hover:text-[var(--sb-accent)] lg:text-[18.5px]">
            {resource.name}
            <ArrowUpRight
              aria-hidden
              className="ml-1 inline size-[0.8em] shrink-0 -translate-y-[0.08em] text-[var(--sb-faint)] transition-colors group-hover:text-[var(--sb-accent)] motion-reduce:transition-none"
            />
          </h3>
          <Countdown resource={resource} />
        </div>

        <p className="mt-2 max-w-[68ch] text-[13.5px] leading-[1.65] text-[var(--sb-dim)] lg:text-[14.5px]">
          {resource.whyOneLine}
        </p>

        <p className="mt-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="sb-num text-[12px] font-semibold text-[var(--sb-text)]">
            {resource.keyFigure}
          </span>
          <span className="sb-num text-[10.5px] text-[var(--sb-faint)]">
            {resource.source}
          </span>
        </p>
      </a>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */

/** Days to the soonest deadline, as a sentence, once the client knows today. */
function NextUp() {
  const today = useToday();
  const dated = datedResources();
  const next = dated[0];
  if (!next) return null;

  const days = today ? daysUntil(today, next.deadline.date) : null;

  return (
    <p className="mt-4 text-[12.5px] text-[var(--sb-dim)]">
      <span className="sb-num font-semibold text-[var(--sb-text)]">
        {dated.length}
      </span>{" "}
      of them have a clock running
      {days !== null && days >= 0 && (
        <>
          {" — the next is "}
          <span className="font-semibold text-[var(--sb-text)]">
            {next.name}
          </span>
          {days === 0 ? ", today" : ", in "}
          {days > 0 && (
            <span className={cn("sb-num font-semibold", toneFor(days))}>
              {days} days
            </span>
          )}
        </>
      )}
      .
    </p>
  );
}

export function ResourcesView() {
  return (
    <main className="sb-scroll h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-[820px] px-5 pt-8 pb-24 sm:px-8 lg:pt-10">
        {/* ---- Masthead ---- */}
        <header>
          <p className="sb-label">The practical layer</p>
          <h1 className="mt-2 font-display text-[32px] leading-[1.05] font-extrabold tracking-[-0.02em] text-[var(--sb-text)] lg:text-[40px]">
            Resources
          </h1>
          <p className="mt-3.5 max-w-[68ch] text-[14px] leading-[1.7] text-[var(--sb-dim)] lg:text-[15px]">
            Everything the research turned up that isn&rsquo;t a number on the
            Plan: the boards that list a near-free car, the memberships worth
            buying, the documents that have to exist before Valencia, and the
            forecasts that aren&rsquo;t published yet. Each entry is one line of
            why and the figure that matters, with the section it came from
            beside it so a stale number can be traced rather than believed.
          </p>
          <NextUp />
        </header>

        {/* ---- Jump list ---- */}
        <nav
          aria-label="Groups"
          className="mt-7 flex flex-wrap gap-x-2 gap-y-1.5 border-y border-[var(--sb-line)] py-3"
        >
          {RESOURCE_GROUPS.map((group) => (
            <a
              key={group}
              href={`#${slugOf(group)}`}
              className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold text-[var(--sb-dim)] transition-colors hover:bg-[var(--sb-panel-2)] hover:text-[var(--sb-text)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--sb-accent)] motion-reduce:transition-none"
            >
              {group}
              <span className="sb-num ml-1.5 text-[10px] text-[var(--sb-faint)]">
                {resourcesIn(group).length}
              </span>
            </a>
          ))}
        </nav>

        {/* ---- The shelves ---- */}
        {RESOURCE_GROUPS.map((group) => (
          <section
            key={group}
            id={slugOf(group)}
            className="mt-14 scroll-mt-6 first-of-type:mt-12"
          >
            <h2 className="font-display text-[23px] leading-tight font-extrabold tracking-[-0.015em] text-[var(--sb-text)] lg:text-[26px]">
              {group}
            </h2>
            <p className="mt-2.5 max-w-[68ch] text-[13px] leading-[1.7] text-[var(--sb-dim)]">
              {GROUP_BLURBS[group]}
            </p>
            <ul className="mt-5 border-t border-[var(--sb-line)]">
              {resourcesIn(group).map((resource) => (
                <Entry key={resource.id} resource={resource} />
              ))}
            </ul>
          </section>
        ))}

        <p className="mt-14 border-t border-[var(--sb-line)] pt-4 text-[11px] leading-relaxed text-[var(--sb-faint)]">
          Every link here leaves the site and opens in a new tab. Prices are AUD
          unless marked and convert at A$1 = €0.61; figures were verified on 27
          August 2026 and none of them are quotes. The relocation snapshots in
          particular are a base rate from one day&rsquo;s listings, not a
          forecast — re-snapshot the boards in early December.
        </p>
      </div>
    </main>
  );
}

/** "Getting around cheap" → "getting-around-cheap". */
function slugOf(group: ResourceGroup): string {
  return group
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
