"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import {
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  FlaskConical,
  Info,
  MapPin,
  Star,
  TriangleAlert,
  X,
} from "lucide-react";

import { CapsuleArt, CapsuleImageStrip } from "@/components/capsule-art";
import { CARD_SLIDEOVER_WIDTH_PX } from "@/lib/capsule-camera";
import {
  SEASON_LABEL,
  SEASON_TOKEN,
  catalogIdeaById,
  formatDays,
  formatEurBand,
  type CatalogIdea,
} from "@/lib/catalog";
import {
  capsuleState,
  capsuleWhere,
  costLadder,
  deepCapsuleById,
  deepCapsulesMentioning,
  formatCapsuleDays,
  formatDayCount,
  formatEur,
  type Caveat,
  type DeepCapsule,
} from "@/lib/deep-capsules";
import {
  closeCapsule,
  openCatalogIdea,
  openDeepCapsule,
  useCapsuleFocus,
} from "@/lib/capsule-focus";
import { photoFor, regionPhoto, type Photo } from "@/lib/region-images";
import { usePlanShortlist } from "@/lib/engine/use-plan";
import type { MarkedState, ShortlistState } from "@/lib/shortlist";
import { cn } from "@/lib/utils";

/**
 * The Capsule detail card.
 *
 * Two tiers of content arrive here and the card refuses to pretend they are
 * the same thing. A **deep Capsule** carries a day-by-day sketch, a cost
 * ladder, an operator shortlist with prices and dated booking deadlines — the
 * distillation of a 400-line research document. A **Catalog idea** carries
 * four sentences and three links, and says so, out loud, at the bottom: "not
 * yet deep-researched". Padding the shallow tier out to look like the deep one
 * would be the single worst thing this card could do — the whole point of the
 * sift is to decide which shallow ideas are worth promoting.
 *
 * Shape: a slide-over on anything wider than a phone, a full-height sheet
 * below that. Escape closes it, and focus lands on the close button.
 *
 * Whether it is a *modal* depends on what is behind it, which is the
 * `overMap` prop. On the Adventures grid it covers the list it was opened
 * from, there is nothing useful to do behind it, and a dimmed backdrop that
 * closes on click is exactly right. On the Plan the thing behind it is the
 * globe, which since #75 flies to the place the card is describing — dimming
 * that would be covering up the answer. So there the backdrop is dropped at
 * `sm` and up, the card becomes a non-modal panel beside a live map, and
 * clicking another marker swaps the card rather than dismissing it. The phone
 * keeps the sheet and the backdrop either way: 36px of globe above a
 * full-height sheet is not map worth protecting.
 */

const MARK_BUTTONS: {
  state: MarkedState;
  label: string;
  icon: typeof Star;
  token: string;
}[] = [
  { state: "interested", label: "Interested", icon: Star, token: "--sb-accent" },
  { state: "placed", label: "On the Plan", icon: MapPin, token: "--sb-good" },
  { state: "discarded", label: "Discard", icon: X, token: "--sb-over" },
];

const CAVEAT_TOKEN: Record<Caveat["tone"], string> = {
  warn: "--sb-warn",
  info: "--sb-sea",
  good: "--sb-good",
};

const CAVEAT_ICON: Record<Caveat["tone"], typeof Info> = {
  warn: TriangleAlert,
  info: Info,
  good: Info,
};

/* ---------------------------------------------------------------- *
 * Shared furniture
 * ---------------------------------------------------------------- */

function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-[var(--sb-line)] px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="sb-label">{label}</h3>
        {hint && (
          <p className="sb-num text-[9.5px] text-[var(--sb-faint)]">{hint}</p>
        )}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Tags({ tags }: { tags: readonly string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-[4px] bg-[color-mix(in_srgb,var(--sb-line)_45%,transparent)] px-1.5 py-0.5 text-[9.5px] text-[var(--sb-dim)]"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function SourceList({ sources }: { sources: readonly { label: string; url: string }[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {sources.map((source) => (
        <li key={source.url}>
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="group flex items-start gap-1 text-[11px] leading-snug text-[var(--sb-sea)] hover:underline"
          >
            <span className="min-w-0 break-words">{source.label}</span>
            <ArrowUpRight className="mt-[2px] size-3 shrink-0 opacity-60" />
          </a>
        </li>
      ))}
    </ul>
  );
}

function MarkRow({
  id,
  name,
  state,
  onMark,
}: {
  id: string;
  name: string;
  state: ShortlistState;
  onMark: (id: string, state: MarkedState) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {MARK_BUTTONS.map((button) => {
        const active = state === button.state;
        const Icon = button.icon;
        return (
          <button
            key={button.state}
            type="button"
            onClick={() => onMark(id, button.state)}
            aria-pressed={active}
            title={`${button.label} — ${name}`}
            className={cn(
              "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[11px] font-semibold transition-colors",
              !active &&
                "border-[var(--sb-line)] text-[var(--sb-dim)] hover:border-[color-mix(in_srgb,var(--sb-dim)_45%,transparent)] hover:text-[var(--sb-text)]",
            )}
            style={
              active
                ? {
                    background: `var(${button.token})`,
                    borderColor: `var(${button.token})`,
                    color: "var(--primary-foreground)",
                  }
                : undefined
            }
          >
            <Icon className="size-3" />
            {button.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * Deep-capsule sections
 * ---------------------------------------------------------------- */

/**
 * Floor → plan-on → ceiling.
 *
 * The rungs come from the Adventure rather than being assumed here, because
 * they are not the same shape for every one: Rottnest has no cheaper version of
 * itself, Sydney's cheap rung is a hostel twin and Tasmania's is a tent. The
 * highlighted row is plan-on, which is the figure the Plan actually charges —
 * the recalibration on #64 exists so this card and the Ledger stop quoting two
 * different numbers for the same Adventure.
 */
function CostLadder({ capsule }: { capsule: DeepCapsule }) {
  const rows = costLadder(capsule.cost);

  return (
    <div className="flex flex-col gap-1">
      {rows.map((row) => {
        const planOn = row.label === "Plan on";
        return (
          <div
            key={row.label}
            className={cn(
              "flex items-baseline gap-2 rounded-lg px-2 py-1.5",
              planOn
                ? "bg-[color-mix(in_srgb,var(--sb-accent)_12%,var(--sb-panel-2))]"
                : "bg-[color-mix(in_srgb,var(--sb-panel-2)_60%,transparent)]",
            )}
          >
            <span
              className={cn(
                "w-[74px] shrink-0 text-[10.5px] font-semibold",
                planOn ? "text-[var(--sb-accent)]" : "text-[var(--sb-dim)]",
              )}
            >
              {row.label}
            </span>
            <span className="sb-num w-[70px] shrink-0 text-[11px] text-[var(--sb-dim)]">
              {formatDayCount(row.days, capsule.days.unit)}
            </span>
            <span className="sb-num flex-1 text-right text-[12.5px] font-medium">
              {formatEur(row.eur)}
            </span>
            <span className="sb-num w-[92px] shrink-0 text-right text-[10px] text-[var(--sb-faint)]">
              {row.band
                ? `€${row.band[0].toLocaleString("en-GB")}–${row.band[1].toLocaleString("en-GB")}`
                : `A$${row.aud.toLocaleString("en-GB")}`}
            </span>
          </div>
        );
      })}
      <p className="mt-1 text-[10px] leading-snug text-[var(--sb-faint)]">
        Per couple, at the research&rsquo;s own A$1 = €0.61, and without the
        flights that reach it. <span className="font-semibold">Plan on</span> is
        what the Plan charges for these days;{" "}
        <span className="font-semibold">as published</span> is the mid-tier
        version the research first wrote up — a ceiling, not a target.{" "}
        {capsule.budgetShare}
      </p>
    </div>
  );
}

function Itinerary({ capsule }: { capsule: DeepCapsule }) {
  return (
    <ol className="flex flex-col">
      {capsule.itinerary.map((day, index) => (
        <li
          key={`${day.day}-${index}`}
          className="relative flex gap-2.5 pb-3 last:pb-0"
        >
          {/* The rail: a dot per day and a hairline between them, so the
              sketch reads as a sequence rather than as a list of tips. */}
          <div className="relative flex w-[54px] shrink-0 justify-end">
            <span className="sb-num pt-[1px] text-right text-[10px] font-semibold text-[var(--sb-dim)]">
              {day.day}
            </span>
          </div>
          <div className="relative flex shrink-0 flex-col items-center">
            <span className="mt-[5px] size-1.5 rounded-full bg-[var(--sb-accent)]" />
            {index < capsule.itinerary.length - 1 && (
              <span className="w-px flex-1 bg-[var(--sb-line)]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-semibold text-[var(--sb-text)]">
              {day.title}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--sb-dim)]">
              {day.body}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Caveats({ caveats }: { caveats: readonly Caveat[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {caveats.map((caveat) => {
        const Icon = CAVEAT_ICON[caveat.tone];
        return (
          <li key={caveat.label} className="flex gap-1.5">
            <Icon
              className="mt-[2px] size-3 shrink-0"
              style={{ color: `var(${CAVEAT_TOKEN[caveat.tone]})` }}
            />
            <div className="min-w-0">
              <p
                className="text-[11px] font-semibold"
                style={{ color: `var(${CAVEAT_TOKEN[caveat.tone]})` }}
              >
                {caveat.label}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-[var(--sb-dim)]">
                {caveat.body}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Operators({ capsule }: { capsule: DeepCapsule }) {
  return (
    <ul className="flex flex-col gap-2">
      {capsule.operators.map((operator) => (
        <li
          key={operator.name}
          className={cn(
            "rounded-lg border px-2.5 py-2",
            operator.pick
              ? "border-[color-mix(in_srgb,var(--sb-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--sb-accent)_9%,var(--sb-panel-2))]"
              : "border-[var(--sb-line)] bg-[color-mix(in_srgb,var(--sb-panel-2)_55%,transparent)]",
          )}
        >
          {/* Name, then where and price on their own line. Several fares are a
              sentence rather than a number ("A$338 incl. fuel · intro dive
              A$92"), and hanging those off the right of the name squeezed it
              to nothing. */}
          <p className="text-[11.5px] leading-snug font-semibold">
            {operator.name}
            {operator.pick && (
              <span
                className="ml-1 text-[var(--sb-accent)]"
                title="The research's own pick"
              >
                ★
              </span>
            )}
          </p>
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-[10px] text-[var(--sb-faint)]">
            <span>{operator.where}</span>
            <span className="sb-num font-medium text-[var(--sb-text)]">
              {operator.price}
            </span>
          </p>
          <p className="mt-1 text-[11px] leading-snug text-[var(--sb-dim)]">
            {operator.note}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Deadlines({ capsule }: { capsule: DeepCapsule }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {capsule.deadlines.map((deadline) => (
        <li key={`${deadline.when}-${deadline.what}`} className="flex gap-2">
          <span className="sb-num w-[104px] shrink-0 text-[10px] font-semibold text-[var(--sb-warn)]">
            {deadline.when}
          </span>
          <span className="min-w-0 flex-1 text-[11px] leading-snug text-[var(--sb-dim)]">
            {deadline.what}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Related({ ids }: { ids: readonly string[] }) {
  const ideas = ids
    .map((id) => catalogIdeaById(id))
    .filter((idea): idea is CatalogIdea => idea !== undefined);
  if (ideas.length === 0) return null;

  return (
    <Section label="In the Catalog" hint={`${ideas.length}`}>
      <ul className="flex flex-col gap-1">
        {ideas.map((idea) => (
          <li key={idea.id}>
            <button
              type="button"
              onClick={() => openCatalogIdea(idea.id)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-[var(--sb-line)] bg-[color-mix(in_srgb,var(--sb-panel-2)_55%,transparent)] px-2.5 py-1.5 text-left transition-colors hover:border-[color-mix(in_srgb,var(--sb-dim)_45%,transparent)]"
            >
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium">
                {idea.name}
              </span>
              <span className="sb-num shrink-0 text-[10.5px] text-[var(--sb-dim)]">
                {formatEurBand(idea)}
              </span>
              <ChevronRight className="size-3 shrink-0 text-[var(--sb-faint)]" />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[10px] leading-snug text-[var(--sb-faint)]">
        Neighbours and alternatives this research argues with — not part of the
        Adventure.
      </p>
    </Section>
  );
}

/* ---------------------------------------------------------------- *
 * The two bodies
 * ---------------------------------------------------------------- */

function DeepBody({ capsule }: { capsule: DeepCapsule }) {
  return (
    <>
      <Section label="The case">
        <p className="text-[12px] leading-relaxed text-[var(--sb-dim)]">
          {capsule.why}
        </p>
        <p className="mt-2.5 rounded-lg border-l-2 border-[var(--sb-accent)] bg-[color-mix(in_srgb,var(--sb-accent)_8%,transparent)] py-1.5 pr-2 pl-2.5 text-[11.5px] leading-snug font-medium text-[var(--sb-text)]">
          {capsule.verdict}
        </p>
      </Section>

      <Section label="Cost, per couple" hint="EUR">
        <CostLadder capsule={capsule} />
      </Section>

      <Section label="How long" hint={formatCapsuleDays(capsule)}>
        <p className="text-[11.5px] leading-snug text-[var(--sb-dim)]">
          {capsule.durationNote}
        </p>
      </Section>

      <Section label="The ideal version, day by day">
        <Itinerary capsule={capsule} />
      </Section>

      <Section label="Caveats" hint={`${capsule.caveats.length}`}>
        <Caveats caveats={capsule.caveats} />
      </Section>

      <Section label="Operators and venues" hint={`${capsule.operators.length}`}>
        <Operators capsule={capsule} />
      </Section>

      <Section label="Book by">
        <Deadlines capsule={capsule} />
      </Section>

      <Related ids={capsule.related} />

      <Section label="Tags">
        <Tags tags={capsule.tags} />
      </Section>

      <Section label="Sources">
        <SourceList sources={capsule.sources} />
      </Section>
    </>
  );
}

function IdeaBody({ idea }: { idea: CatalogIdea }) {
  // An exact id match would mean this idea *is* a researched Capsule; none are
  // today, because the sweep left the marquee blocks out. The reverse link is
  // the one that fires: the researched Capsules that argue with this idea.
  const deep = deepCapsuleById(idea.id);
  const mentions = deepCapsulesMentioning(idea.id);
  return (
    <>
      <Section label="Why it's rated">
        <p className="text-[12px] leading-relaxed text-[var(--sb-dim)]">
          {idea.why_rated}
        </p>
      </Section>

      <Section label="Dec–Feb" hint={SEASON_LABEL[idea.season_fit_dec_feb]}>
        <p className="text-[11.5px] leading-snug text-[var(--sb-dim)]">
          {idea.season_note}
        </p>
      </Section>

      <Section label="Cost and length" hint={idea.nearest_airport}>
        <div className="flex items-baseline gap-2 rounded-lg bg-[color-mix(in_srgb,var(--sb-panel-2)_60%,transparent)] px-2 py-1.5">
          <span className="w-[62px] shrink-0 text-[10.5px] font-semibold text-[var(--sb-dim)]">
            Rough
          </span>
          <span className="sb-num w-[74px] shrink-0 text-[11px] text-[var(--sb-dim)]">
            {formatDays(idea)}
          </span>
          <span className="sb-num flex-1 text-right text-[12.5px] font-medium">
            {formatEurBand(idea)}
          </span>
          <span className="sb-num w-[92px] shrink-0 text-right text-[10px] text-[var(--sb-faint)]">
            A${idea.rough_cost_couple_aud}
          </span>
        </div>
        <p className="mt-1 text-[10px] leading-snug text-[var(--sb-faint)]">
          Per couple, {idea.cost_confidence} confidence, at A$1 = €0.61. A band
          this wide is a research gap, not a price.
        </p>
      </Section>

      {idea.warnings.length > 0 && (
        <Section label="Flagged">
          <div className="flex items-start gap-1.5">
            <TriangleAlert className="mt-[2px] size-3 shrink-0 text-[var(--sb-warn)]" />
            <p className="text-[11px] leading-snug text-[var(--sb-dim)]">
              The sweep flagged this as{" "}
              <span className="font-semibold text-[var(--sb-warn)]">
                {idea.warnings.join(", ").replace(/-/g, " ")}
              </span>
              . Warnings inform; nothing here is blocked.
            </p>
          </div>
        </Section>
      )}

      <Section label="Tags">
        <Tags tags={idea.tags} />
      </Section>

      <Section label="Sources">
        <SourceList
          sources={idea.sources.map((url) => ({
            label: url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""),
            url,
          }))}
        />
      </Section>

      {deep ? (
        <Section label="Researched">
          <button
            type="button"
            onClick={() => openDeepCapsule(deep.id)}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-[var(--sb-accent)] bg-[color-mix(in_srgb,var(--sb-accent)_10%,transparent)] px-2.5 py-2 text-left"
          >
            <FlaskConical className="size-3.5 shrink-0 text-[var(--sb-accent)]" />
            <span className="min-w-0 flex-1 text-[11.5px] font-semibold">
              Open the deep Adventure
            </span>
            <ChevronRight className="size-3.5 shrink-0 text-[var(--sb-accent)]" />
          </button>
        </Section>
      ) : (
        <Section label="Research status">
          <div className="flex items-start gap-1.5 rounded-lg border border-dashed border-[var(--sb-line)] px-2.5 py-2">
            <FlaskConical className="mt-[2px] size-3 shrink-0 text-[var(--sb-faint)]" />
            <p className="text-[11px] leading-snug text-[var(--sb-dim)]">
              <span className="font-semibold text-[var(--sb-text)]">
                Not yet deep-researched.
              </span>{" "}
              This is a Catalog idea: a few lines from the bulk sweep, no
              itinerary, no operator prices, no booking dates. Mark it{" "}
              <span className="font-semibold text-[var(--sb-accent)]">
                interested
              </span>{" "}
              and it can be promoted to a full Adventure.
            </p>
          </div>

          {mentions.length > 0 && (
            <>
              <p className="mt-2.5 text-[10px] leading-snug text-[var(--sb-faint)]">
                It does come up in researched Adventures, though:
              </p>
              <ul className="mt-1 flex flex-col gap-1">
                {mentions.map((capsule) => (
                  <li key={capsule.id}>
                    <button
                      type="button"
                      onClick={() => openDeepCapsule(capsule.id)}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-[var(--sb-line)] bg-[color-mix(in_srgb,var(--sb-panel-2)_55%,transparent)] px-2.5 py-1.5 text-left transition-colors hover:border-[var(--sb-accent)]"
                    >
                      <span className="min-w-0 flex-1 truncate text-[11px] font-medium">
                        {capsule.name}
                      </span>
                      <ChevronRight className="size-3 shrink-0 text-[var(--sb-faint)]" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- *
 * The card itself
 * ---------------------------------------------------------------- */

interface CardChrome {
  id: string;
  name: string;
  state: string;
  where: string;
  tagline: string;
  seasonFit: CatalogIdea["season_fit_dec_feb"];
  window: string | null;
  days: string;
  cost: string;
  tags: readonly string[];
  facets: CatalogIdea["facets"];
  /** Photography the entry carries itself. Wins over the region map. */
  images?: readonly string[];
  /** The curated photograph for this place, credited. */
  photo?: Photo;
  deep: boolean;
}

function chromeForDeep(capsule: DeepCapsule): CardChrome {
  return {
    id: capsule.id,
    name: capsule.name,
    state: capsuleState(capsule),
    where: capsuleWhere(capsule),
    tagline: capsule.tagline,
    seasonFit: capsule.seasonFit,
    window: capsule.window,
    days: formatCapsuleDays(capsule),
    cost: formatEur(capsule.cost.ideal.eur),
    tags: capsule.tags,
    facets: capsule.facets,
    images: capsule.images,
    photo: photoFor({ id: capsule.id, region: capsule.region }),
    deep: true,
  };
}

function chromeForIdea(idea: CatalogIdea): CardChrome {
  return {
    id: idea.id,
    name: idea.name,
    state: idea.state,
    where: idea.where,
    tagline: idea.region,
    seasonFit: idea.season_fit_dec_feb,
    window: null,
    days: formatDays(idea),
    cost: formatEurBand(idea),
    tags: idea.tags,
    facets: idea.facets,
    photo: regionPhoto(idea.region),
    deep: false,
  };
}

export function CapsuleCardHost({ overMap = false }: { overMap?: boolean }) {
  const focus = useCapsuleFocus();
  const { marks, mark } = usePlanShortlist();
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const capsule = focus?.kind === "deep" ? deepCapsuleById(focus.id) : undefined;
  const idea = focus?.kind === "idea" ? catalogIdeaById(focus.id) : undefined;

  useEffect(() => {
    if (!focus) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCapsule();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus]);

  // Opening a second card from inside the first (a related idea, or the deep
  // Capsule behind an idea) reuses the same panel, so the scroll position has
  // to be reset by hand — the element never unmounts.
  useEffect(() => {
    if (!focus) return;
    scrollRef.current?.scrollTo({ top: 0 });
    closeRef.current?.focus();
  }, [focus]);

  if (!focus) return null;
  const chrome = capsule
    ? chromeForDeep(capsule)
    : idea
      ? chromeForIdea(idea)
      : null;
  // A focus id that resolves to nothing means stale state, not a render bug.
  if (!chrome) return null;

  const state: ShortlistState = marks[chrome.id] ?? "unseen";

  return (
    <div
      className={cn("fixed inset-0 z-50", overMap && "pointer-events-none")}
      // The width the camera reserves on the right when it flies to this
      // card's place (see `lib/capsule-camera.ts`). Published as a custom
      // property rather than written twice, so the panel and the map padding
      // cannot drift apart.
      style={
        { "--sb-card-w": `${CARD_SLIDEOVER_WIDTH_PX}px` } as CSSProperties
      }
    >
      <button
        type="button"
        aria-label="Close the adventure"
        onClick={closeCapsule}
        className={cn(
          "pointer-events-auto absolute inset-0 cursor-default bg-[rgb(7_12_20/0.55)] backdrop-blur-[3px]",
          // Over the globe the backdrop survives only on the phone, where the
          // sheet leaves no usable map behind it anyway.
          overMap && "sm:hidden",
        )}
      />

      <div
        role="dialog"
        // Non-modal over the globe: the map beside it is live, and claiming
        // otherwise would be a lie to a screen reader as much as to a mouse.
        aria-modal={overMap ? undefined : true}
        aria-labelledby="capsule-card-title"
        className={cn(
          "pointer-events-auto absolute flex flex-col overflow-hidden bg-[var(--sb-panel)] shadow-[0_24px_60px_-16px_rgb(0_0_0/0.7)]",
          // Phone: a sheet off the bottom, with the globe still showing above.
          "inset-x-0 top-9 bottom-0 rounded-t-2xl border-t border-[var(--sb-line)]",
          // Anything wider: a slide-over on the right, clear of the drawer.
          "sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[var(--sb-card-w)] sm:rounded-none sm:border-t-0 sm:border-l",
        )}
      >
        {/* ---- Hero ---- */}
        <div className="relative h-[176px] shrink-0 sm:h-[196px]">
          {chrome.images && chrome.images.length > 0 ? (
            <CapsuleImageStrip
              images={chrome.images}
              alt={chrome.name}
              className="size-full"
            />
          ) : chrome.photo ? (
            <CapsuleImageStrip
              images={[chrome.photo.file]}
              alt={chrome.photo.caption}
              credit={chrome.photo}
              className="size-full"
            />
          ) : (
            <CapsuleArt
              seed={chrome.id}
              state={chrome.state}
              where={chrome.where}
              tags={chrome.tags}
              facets={chrome.facets}
              className="size-full"
            />
          )}

          <button
            ref={closeRef}
            type="button"
            onClick={closeCapsule}
            aria-label="Close"
            className="absolute top-3 right-3 flex size-7 cursor-pointer items-center justify-center rounded-full bg-[rgb(6_10_16/0.55)] text-[rgb(255_253_248/0.9)] backdrop-blur-sm transition-colors hover:bg-[rgb(6_10_16/0.8)]"
          >
            <X className="size-3.5" />
          </button>

          {chrome.deep && (
            <span className="absolute top-3 left-4 inline-flex items-center gap-1 rounded-full bg-[rgb(6_10_16/0.55)] px-2 py-[3px] text-[9.5px] font-semibold tracking-[0.12em] text-[rgb(255_253_248/0.92)] uppercase backdrop-blur-sm">
              <FlaskConical className="size-2.5" />
              Researched
            </span>
          )}
        </div>

        {/* ---- Scrolling body ---- */}
        {/* tabIndex so the card can be read with a keyboard alone: this is a
            long scrolling region and several of its sections hold no focusable
            control at all, so without it there is no way to page through the
            itinerary or the caveats. */}
        <div
          ref={scrollRef}
          tabIndex={0}
          className="sb-scroll min-h-0 flex-1 overflow-y-auto outline-none"
        >
          <div className="px-4 pt-3.5 pb-3">
            <h2
              id="capsule-card-title"
              className="font-display text-[19px] leading-[1.1] font-extrabold tracking-[-0.01em] text-balance"
            >
              {chrome.name}
            </h2>
            <p className="mt-1 text-[11px] leading-snug text-[var(--sb-dim)]">
              {chrome.tagline}
            </p>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span
                className="inline-flex items-center gap-1 text-[10.5px] font-medium whitespace-nowrap"
                style={{ color: SEASON_TOKEN[chrome.seasonFit] }}
              >
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ background: SEASON_TOKEN[chrome.seasonFit] }}
                />
                {SEASON_LABEL[chrome.seasonFit]}
              </span>
              <span className="sb-num text-[10.5px] whitespace-nowrap text-[var(--sb-dim)]">
                {chrome.days}
              </span>
              <span className="sb-num text-[10.5px] font-medium whitespace-nowrap">
                {chrome.cost}
              </span>
            </div>

            {chrome.window && (
              <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-snug text-[var(--sb-dim)]">
                <CalendarClock className="mt-[1px] size-3 shrink-0 text-[var(--sb-sea)]" />
                <span>
                  <span className="font-semibold text-[var(--sb-text)]">
                    Window ·
                  </span>{" "}
                  {chrome.window}
                </span>
              </p>
            )}

            <div className="mt-3">
              <MarkRow
                id={chrome.id}
                name={chrome.name}
                state={state}
                onMark={mark}
              />
            </div>
          </div>

          {capsule ? <DeepBody capsule={capsule} /> : idea ? <IdeaBody idea={idea} /> : null}

          <p className="border-t border-[var(--sb-line)] px-4 py-3 text-[10px] leading-snug text-[var(--sb-faint)]">
            The picture is generated from this entry&rsquo;s own region and
            facets — a placeholder, not a photograph of the place.
          </p>
        </div>
      </div>
    </div>
  );
}
