"use client";

/**
 * The Flights page (#50) — two pre-programmed searches, ranked comfort-first.
 *
 * The premise is that the interesting question is never "what does Barcelona
 * cost". It is "given that Valencia has no long-haul, which of thirteen
 * European hubs is the right one to leave from once the train, the hold bags,
 * the night before and the lost connection protection are all counted" — and
 * that question cannot be answered one airport at a time. So both searches are
 * multi-origin: one fetch per origin, in parallel, each cached for a week by the
 * route grid and warmed weekly by the cron, with the row showing which of its
 * numbers is live and which is the research band.
 *
 * Three rules the page holds to:
 *
 * - **Comfort-first is the default sort**, because that is the trip's stated
 *   criterion (docs/CONTEXT.md). Cheapest is one click away and never hidden;
 *   the price is on every row either way.
 * - **A chain is priced as a journey, not as a fare.** The €50 Ryanair hop to
 *   Milan appears next to the direct Barcelona option with its bags, its coach
 *   and its hotel added, and the research's €150-per-person bar printed
 *   underneath as a verdict.
 * - **The knowledge is quiet.** The London APD penalty, the Gulf reliability
 *   caveat and the protected-versus-self-transfer distinction ride as chips on
 *   the rows they apply to rather than as a wall of preamble. The one thing
 *   loud enough for a card is the A380 on the return, because it is the answer
 *   to the question everyone actually asks.
 * - **The hard rules are visible and adjustable, never baked in.** Two of them
 *   filter this list: "no Middle East transits" (docs/CONTEXT.md) and the
 *   couple's €1,000-per-person ceiling. Each is a labelled control sitting
 *   above the results, a sentence in plain words underneath saying what is
 *   currently true, and a greyed band below holding what it caught — with the
 *   reason on every row. A constraint nobody can see is one the visitor reads
 *   as the world being that shape: someone who did not write these rules has
 *   to be able to tell why the list looks the way it does, and change it.
 *   Nothing is blocked or deleted here either, which is the site's own
 *   philosophy applied to the site's own rules.
 * - **The score says how much of itself is evidence, and hands over the part
 *   that is not.** After the audit (kilbot/holidays#69) every component in a
 *   row's derivation is labelled measured, rated or judgment — and the one
 *   number the literature genuinely does not settle, the weight between the
 *   airline and the aeroplane, is a third control up here beside the other two.
 *   It moves inside the published 0.30–0.70 bracket and re-ranks live, and the
 *   sentence under it says whether the top of the list actually depends on it.
 */

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

import type { CoverageReport } from "@/lib/flights/coverage";
import {
  OUTBOUND_DEFAULT_DATE,
  OUTBOUND_SEARCH_DATES,
  RETURN_DEFAULT_DATE,
  RETURN_SEARCH_DATES,
} from "@/lib/flights/grid";
import {
  arbitrageVsBarcelona,
  barcelonaReference,
  cheapestFloor,
  DEFAULT_RULES,
  groupByDefaultRules,
  heldBackBy,
  LONGHAUL_CAP_RANGE_EUR_PP,
  perPersonTotal,
  priceOption,
  TRAVELLERS,
  type DefaultRules,
  type HeldBack,
  type LiveQuote,
  type OptionPrice,
} from "@/lib/flights/pricing";
import { excludedByDefault, RETURN_A380_TIP, type SearchOption } from "@/lib/flights/search-plan";
import {
  DEFAULT_AIRLINE_WEIGHT,
  MIDDLE_EAST_TRANSIT_HUBS,
  reweigh,
  topPickAcrossBracket,
  WEIGHT_BRACKET,
  WEIGHT_EVIDENCE,
} from "@/lib/flights/comfort";
import { monthlyResetLabel, type FareQuota } from "@/lib/flights/quota";
import type { FareSeries } from "@/lib/flights/history";
import {
  isPinned,
  pinIdOf,
  pinOf,
  type FlightPin,
} from "@/lib/flights/watchlist";
import { formatEur } from "@/lib/engine";
import { useWatchlist } from "@/lib/engine/scenarios";
import { formatDayYear } from "@/lib/trip-dates";
import { FareDateField, type CoverageByDate, type DayCoverage } from "@/components/fare-dates";
import { FlightOptionRow, rowElementId } from "@/components/flight-option";
import { FlightWatchlist, seriesKeyOf } from "@/components/flight-watchlist";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Leg = "outbound" | "return";
type Sort = "comfort" | "price";

/**
 * Pipe-separated, because a date has hyphens in it and the page reads these
 * keys back apart to work out which route-days it has already paid for.
 */
const keyOf = (from: string, to: string, date: string) => `${from}|${to}|${date}`;

const routeKeyOf = (from: string, to: string) => `${from}-${to}`;

const NO_PRICES: ReadonlyMap<string, number> = new Map();

/**
 * Quotes already fetched in this tab.
 *
 * Module-level, like the rest of the site's client-side stores, so switching
 * between the two searches — or leaving for the Ledger and coming back — does
 * not re-ask the API for an answer that has not changed. The server-side cache
 * is up to a week; this one only has to outlive a navigation.
 *
 * It is the store; the component holds a snapshot of it in state and re-takes
 * that snapshot as each origin lands, which keeps the effect free of the
 * synchronous setState that causes cascading renders. A key that is absent is
 * exactly what "still searching" means, and a key mapped to `null` is a
 * resolved answer: asked, and no usable live fare came back.
 */
const QUOTE_CACHE = new Map<string, LiveQuote | null>();

/** How many origins are fetched at once. */
const SEARCH_CONCURRENCY = 4;

/** Hard ceiling on cache misses one interactive search may request. */
export const MAX_INTERACTIVE_FARE_CALLS = 25;

async function fetchQuote(
  from: string,
  to: string,
  date: string,
  signal: AbortSignal,
): Promise<LiveQuote | null> {
  try {
    const response = await fetch(`/api/fares?from=${from}&to=${to}&date=${date}`, { signal });
    if (!response.ok) return null;
    const body = (await response.json()) as Record<string, unknown>;
    const price = body.priceEur;
    if (typeof price !== "number") return null;
    return {
      priceEur: price,
      carrier: typeof body.carrier === "string" ? body.carrier : "Unknown carrier",
      durationMin: typeof body.durationMin === "number" ? body.durationMin : null,
      stops: typeof body.stops === "number" ? body.stops : null,
      source: body.source === "live" || body.source === "history" ? body.source : "snapshot",
      fetchedAt: typeof body.fetchedAt === "string" ? body.fetchedAt : null,
      trend: body.trend === "up" || body.trend === "down" || body.trend === "flat" ? body.trend : null,
    };
  } catch {
    // An exhausted quota, an offline tab and a malformed body all land here,
    // and all mean the same thing to the page: keep the research band.
    return null;
  }
}

/**
 * The meter, and — when one of the two ceilings is shut — the sentence that
 * used to be missing.
 *
 * The counter alone could not explain what the couple was seeing. Hitting the
 * daily guard at 151 calls of a 2,000-call month looks, in a meter, like
 * plenty of headroom; every row after it quietly showed a stored price, and the
 * honest reading of that was *the data doesn't work*. So the gate is stated
 * where the degrading happens, in the words for the ceiling that is actually
 * shut: one clears overnight and the other does not.
 *
 * Loud enough to find, quiet enough not to shout: the numbers stay folded away,
 * and the gate line is the only part that comes out of the disclosure.
 */
function QuotaMeter({ quota }: { quota: FareQuota | null }) {
  const gated = quota && quota.gate !== "open";

  return (
    <div className="mt-2">
      <details className="w-fit text-[10px] text-[var(--sb-faint)]">
        <summary className="cursor-pointer">
          live quota: {quota ? `${quota.used}/${quota.budget} this month` : "checking…"}
        </summary>
        {quota && (
          <p className="mt-1">
            {quota.month} · {quota.usedToday}/{quota.dailyCap} today, a runaway guard
            rather than a budget
          </p>
        )}
        {quota && (
          <p className="mt-1">
            {/* Stated because the budget is shared and the link is public: one
                visitor cannot quietly be the reason it emptied. */}
            Any one visitor may spend {quota.perIpDailyCap} of it a day. Past that,
            their rows show stored prices; every other visitor&rsquo;s still load.
          </p>
        )}
      </details>

      {gated && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-snug text-[var(--sb-dim)]">
          <span aria-hidden className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--sb-warn)]" />
          <span>
            <span className="font-semibold text-[var(--sb-warn)]">
              {quota.gate === "daily"
                ? "Daily live-quota guard reached — fresh prices resume tomorrow."
                : `Monthly budget spent — stored prices until ${monthlyResetLabel(quota.month)}.`}
            </span>{" "}
            Rows are showing the newest stored fare or the research band, labelled as
            such. Nothing is blocked: the ranking, the comfort scores and the
            watchlist all work on what is already here.
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * What this day is doing, while it does it.
 *
 * This used to be a gate. #61 gave every day in the window a click, most of
 * them had never been priced, and the answer then was to quote the cost in
 * calls and wait for a *Spend ~14 calls on this day* button — the transparency
 * principle the Constraints follow (docs/CONTEXT.md), applied to the site's own
 * metered API.
 *
 * The user has since settled the question the gate was hedging: *"just make the
 * calls; we're going to use the data until it is gone."* A quota that is never
 * spent is not a saving, it is a subscription paid for nothing, and asking
 * permission before every cold day taxed the one interaction the page exists
 * for — moving the date and seeing what happens.
 *
 * So the friction is gone and the honesty stays. A cold day fetches on
 * selection like any other, and this line says what is being spent while it is
 * being spent rather than before. The real ceilings are still ceilings: the
 * monthly budget, the daily runaway guard (both reported by the meter above,
 * in words, when either one is what is holding prices back) and the per-search
 * fan-out cap.
 */
function LiveDayNote({
  date,
  calls,
  origins,
}: {
  date: string;
  calls: number;
  /** How many origins this search asks about, so a partly-known day says so. */
  origins: number;
}) {
  if (calls === 0) {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-[11px] leading-snug text-[var(--sb-dim)]">
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[var(--sb-good)]" />
        Every origin on {formatDayYear(date)} is already stored — this day is free to
        look at, and instant.
      </p>
    );
  }

  return (
    <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-[var(--sb-dim)]">
      <span aria-hidden className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--sb-accent)]" />
      <span>
        <span className="font-semibold text-[var(--sb-text)]">
          {calls >= origins
            ? `${formatDayYear(date)} had not been priced.`
            : `${formatDayYear(date)} was priced for ${origins - calls} of ${origins} origins.`}
        </span>{" "}
        Pricing <span className="sb-num">{calls}</span>{" "}
        {calls === 1 ? "origin" : "origins"} live now. Whatever lands is stored, so this
        day is free from here on — and it will carry a price in the calendar above.
      </span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="min-w-0">
      <p className="sb-label text-[9px]">{label}</p>
      <div
        role="group"
        aria-label={label}
        className="mt-1 inline-flex flex-wrap gap-1 rounded-lg border border-[var(--sb-line)] bg-[var(--sb-panel)] p-1"
      >
        {options.map((option) => {
          const current = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={current}
              title={option.hint}
              className={cn(
                "min-h-8 cursor-pointer rounded-md px-2.5 text-[11.5px] font-semibold transition-colors motion-reduce:transition-none",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sb-accent)]",
                current
                  ? "bg-[color-mix(in_srgb,var(--sb-accent)_16%,transparent)] text-[var(--sb-accent)]"
                  : "text-[var(--sb-dim)] hover:bg-[var(--sb-panel-2)] hover:text-[var(--sb-text)]",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The price rule, as a thing you can move.
 *
 * A cap is the one filter that has to be a slider rather than a set of stops:
 * the interesting question is not "under €1,000 or not", it is "what does the
 * next two hundred euros buy" — and the answer is a row moving between the
 * ranking and the band below it while the thumb is still being dragged. The
 * label says what it does in words, because a number over a track says nothing
 * about which way is stricter.
 */
function PriceCap({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const id = useId();
  const { min, max, step } = LONGHAUL_CAP_RANGE_EUR_PP;

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="sb-label block cursor-pointer text-[9px]">
        Max € per person
        <span className="sb-num ml-1.5 tracking-normal text-[var(--sb-text)] normal-case">
          {formatEur(value)}
        </span>
      </label>
      <div className="mt-1 flex h-8 items-center gap-2 rounded-lg border border-[var(--sb-line)] bg-[var(--sb-panel)] px-2.5">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label="Max € per person — the most one person may pay for the whole journey"
          className="h-4 w-[112px] cursor-pointer accent-[var(--sb-accent)]"
        />
        <span className="text-[10px] whitespace-nowrap text-[var(--sb-faint)]">
          dearer ones grey out below
        </span>
      </div>
    </div>
  );
}

/**
 * The one number in the formula nobody can defend, put under the reader's hand.
 *
 * The evidence audit (kilbot/holidays#69) went looking for the study that sets
 * the airline-versus-aircraft weight and found two literatures pointing in
 * opposite directions: Vink et al. (2012) put legroom at the top of physical
 * comfort, which argues 0.30/0.70; Ban & Kim (2019, n=9,632) put seat comfort
 * near the bottom of *satisfaction*, which argues the reverse. Both are
 * measuring the same spectrum, so the honest answer is a bracket — 0.30 to
 * 0.70 — with 0.55 sitting inside it as a judgment call and nothing more.
 *
 * A judgment call inside a published bracket is exactly the shape of thing the
 * Constraint principle says to hand over (docs/CONTEXT.md): visible, adjustable,
 * stated in words. So this is a slider rather than a constant, it says which
 * way is which as a percentage rather than a decimal nobody reads, and the
 * ranking moves under it while the thumb is still down.
 */
function WeightSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const id = useId();
  const airline = Math.round(value * 100);

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="sb-label block cursor-pointer text-[9px]">
        Airline vs seat
        <span className="sb-num ml-1.5 tracking-normal text-[var(--sb-text)] normal-case">
          {airline} / {100 - airline}
        </span>
      </label>
      <div className="mt-1 flex h-8 items-center gap-2 rounded-lg border border-[var(--sb-line)] bg-[var(--sb-panel)] px-2.5">
        <input
          id={id}
          type="range"
          min={WEIGHT_BRACKET.min}
          max={WEIGHT_BRACKET.max}
          step={WEIGHT_BRACKET.step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label="How much of the comfort score is the airline's ratings and how much is the seat this itinerary flies"
          aria-valuetext={`${airline}% airline ratings, ${100 - airline}% seat`}
          title={WEIGHT_EVIDENCE.note}
          className="h-4 w-[112px] cursor-pointer accent-[var(--sb-accent)]"
        />
        <span className="text-[10px] whitespace-nowrap text-[var(--sb-faint)]">
          re-ranks live
        </span>
      </div>
    </div>
  );
}

/**
 * The routing rule, as a thing you can turn off.
 *
 * It reads as a sentence in the on state — "Avoiding Middle East transits" —
 * rather than as a checkbox called "Middle East", because the person looking at
 * this list did not write the rule and needs to know what it is doing before
 * they can decide whether they agree with it.
 */
function MiddleEastToggle({
  avoiding,
  onChange,
}: {
  avoiding: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();

  return (
    <div className="min-w-0">
      <p className="sb-label text-[9px]">Middle East</p>
      <div className="mt-1 flex h-8 items-center gap-2 rounded-lg border border-[var(--sb-line)] bg-[var(--sb-panel)] px-2.5">
        {/* `label htmlFor` does not reliably name a button, and Base UI's
            switch is one — so the name is stated here rather than inferred. */}
        <Switch
          id={id}
          checked={avoiding}
          onCheckedChange={onChange}
          aria-label={
            avoiding
              ? "Avoiding Gulf transits — switch off to rank them with everything else"
              : "Gulf transits included — switch on to hold them out of the ranking"
          }
          className="shrink-0"
        />
        <label
          htmlFor={id}
          className="cursor-pointer text-[11.5px] font-semibold whitespace-nowrap text-[var(--sb-text)]"
        >
          {avoiding ? "Avoiding Gulf transits" : "Gulf transits included"}
        </label>
      </div>
    </div>
  );
}

/**
 * What the list is, in one sentence, for someone who did not build it.
 *
 * Everything in it is also expressed by a control a few pixels above — and that
 * is exactly why it is here. Controls say what *can* be true; this says what is
 * true right now, in the order a person would say it aloud, so a list that
 * looks surprisingly short explains itself before anyone has to go looking for
 * the setting that made it that way.
 */
function ActiveRules({
  shown,
  rules,
  sort,
  heldBack,
}: {
  shown: number;
  rules: DefaultRules;
  sort: Sort;
  heldBack: number;
}) {
  return (
    <p
      aria-live="polite"
      className="mt-3 max-w-[80ch] text-[12px] leading-snug text-[var(--sb-dim)]"
    >
      Showing{" "}
      <span className="font-semibold text-[var(--sb-text)]">
        {shown} flight{shown === 1 ? "" : "s"}
      </span>{" "}
      under{" "}
      <span className="sb-num font-semibold text-[var(--sb-text)]">
        {formatEur(rules.maxEurPP)}
      </span>{" "}
      per person
      {/* The rows are priced for the couple, the rule is written per person.
          Saying both once is cheaper than making anyone halve a number. */}
      <span className="text-[var(--sb-faint)]">
        {" "}
        ({formatEur(rules.maxEurPP * TRAVELLERS)} for the two of them)
      </span>
      {rules.avoidMiddleEast ? ", avoiding Middle East transits" : ", Middle East transits included"},
      ranked by {sort === "comfort" ? "comfort" : "price"}.
      {heldBack > 0 && (
        <>
          {" "}
          <span className="text-[var(--sb-faint)]">
            {heldBack === 1
              ? "1 more is greyed out below, with the reason on it."
              : `${heldBack} more are greyed out below, each saying which rule caught it.`}
          </span>
        </>
      )}
    </p>
  );
}

/**
 * What the weight is set to, and whether it changes the answer.
 *
 * The sentence is the sibling of `ActiveRules`: the slider says what *can* be
 * true, this says what is true right now, in the words a person would use.
 *
 * The second half is the reassuring part, and it is computed rather than
 * quoted. Moving a weight that decides a ranking invites the obvious worry —
 * *so the answer depends on a number you made up?* — and for this search it
 * demonstrably does not: the audit found Singapore wins at every point in the
 * bracket because it leads on both axes, and the same check runs here against
 * the rows actually on screen. Saying so from a hardcoded string would be the
 * one claim on this page nobody could check, which is the opposite of the
 * point; if a fare, a date or a corrected dataset ever makes it untrue, this
 * paragraph says the true thing instead.
 */
function WeightNote({
  airlineWeight,
  rows,
}: {
  airlineWeight: number;
  /** Every priced row in the search, rules off — the same set the floor reads. */
  rows: readonly { option: SearchOption }[];
}) {
  const airline = Math.round(airlineWeight * 100);
  const verdict = useMemo(
    () => topPickAcrossBracket(rows.map((row) => ({ id: row.option.id, comfort: row.option.comfort }))),
    [rows],
  );
  const winner = verdict.winner
    ? (rows.find((row) => row.option.id === verdict.winner?.id)?.option ?? null)
    : null;

  return (
    <p aria-live="polite" className="mt-1.5 max-w-[80ch] text-[12px] leading-snug text-[var(--sb-dim)]">
      The score is{" "}
      <span className="font-semibold text-[var(--sb-text)]">
        {airline}% the airline&rsquo;s ratings
      </span>{" "}
      and {100 - airline}% the seat this itinerary actually flies
      {airline === Math.round(DEFAULT_AIRLINE_WEIGHT * 100) && (
        <span className="text-[var(--sb-faint)]"> (the research&rsquo;s own setting)</span>
      )}
      . That split is a judgment, not a finding: the published work brackets it
      anywhere between {Math.round(WEIGHT_BRACKET.min * 100)} and{" "}
      {Math.round(WEIGHT_BRACKET.max * 100)} and points both ways inside that —
      physical-comfort studies put the aeroplane first, satisfaction studies put
      the airline first, and they are measuring the same thing.
      {winner && verdict.stable && verdict.atMin !== null && verdict.atMax !== null && (
        <>
          {" "}
          {/* The carrier, not the hub: several of its rows tie at the top and
              naming one of them would invent a distinction the score does not
              make. Which hub to leave from is the question the list answers. */}
          <span className="text-[var(--sb-text)]">
            It does not change the recommendation: across this whole search, every
            rule switched off, {winner.carrier} holds the best comfort score at every
            setting in the bracket
          </span>{" "}
          <span className="sb-num text-[var(--sb-faint)]">
            ({verdict.atMin.toFixed(1)} seat-heavy → {verdict.atMax.toFixed(1)} airline-heavy)
          </span>
          , because it leads on both halves at once. What the slider rearranges is
          the middle of the table — which is where the disagreement actually is.
        </>
      )}
      {winner && !verdict.stable && (
        <>
          {" "}
          <span className="text-[var(--sb-text)]">
            The best comfort score in this search does change inside the bracket
          </span>{" "}
          — {winner.carrier} leads at this setting, but not at all of them. Worth
          looking at both ends before deciding.
        </>
      )}
    </p>
  );
}

/**
 * One dot per origin, saying what the search got back from it.
 *
 * A multi-origin search that only showed a spinner would hide its own shape:
 * thirteen airports were asked, and the honest report is which ones answered
 * with a live fare, which fell back to the research, and which are still out.
 */
function OriginStrip({
  pairs,
  quotes,
}: {
  pairs: readonly { from: string; to: string; key: string }[];
  quotes: ReadonlyMap<string, LiveQuote | null>;
}) {
  // A stored snapshot is not a live fare and does not get to be counted as
  // one: it is what `/api/fares` falls back to when the quote fails its sanity
  // bounds or the key is absent, and it names no carrier.
  const live = pairs.filter((pair) => quotes.get(pair.key)?.source === "live").length;
  const stored = pairs.filter((pair) => {
    const source = quotes.get(pair.key)?.source;
    return source === "history" || source === "snapshot";
  }).length;
  const pending = pairs.filter((pair) => !quotes.has(pair.key)).length;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <p className="sb-label text-[9px]">
        {pairs.length} origins ·{" "}
        <span className="text-[var(--sb-good)]">{live} live</span>
        {stored > 0 && ` · ${stored} stored`} ·{" "}
        {pending > 0
          ? `${pending} searching`
          : `${pairs.length - live - stored} on research bands`}
      </p>
      <ul className="flex flex-wrap gap-1">
        {pairs.map((pair) => {
          const searching = !quotes.has(pair.key);
          const quote = quotes.get(pair.key) ?? null;
          const ink = searching
            ? "var(--sb-sea)"
            : quote?.source === "live"
              ? "var(--sb-good)"
              : quote
                ? "var(--sb-dim)"
                : "var(--sb-faint)";
          return (
            <li
              key={pair.key}
              title={
                searching
                  ? `${pair.from} → ${pair.to}: searching`
                  : quote?.source === "live"
                    ? `${pair.from} → ${pair.to}: live fare, ${quote.carrier}`
                    : quote
                      ? `${pair.from} → ${pair.to}: stored fare, no live quote`
                      : `${pair.from} → ${pair.to}: no fare returned, research band`
              }
              className="sb-num inline-flex items-center gap-1 rounded-md border border-[var(--sb-line)] px-1.5 py-[1px] text-[9.5px] text-[var(--sb-dim)]"
            >
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full",
                  searching && "animate-pulse motion-reduce:animate-none",
                )}
                style={{ background: ink }}
              />
              {pair.from}
              {pair.to !== "PER" && `→${pair.to}`}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The rule, and what it costs                                         */
/* ------------------------------------------------------------------ */

/** English list: "Qatar Airways, Emirates and Etihad". */
function listOf(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The rows one of the two rules keeps out of the ranking, behind a count.
 *
 * This band is the site's own philosophy turned on the site's own rules. The
 * Warning is the only enforcement mechanism anywhere here — nothing is blocked,
 * nothing is refused (docs/CONTEXT.md) — and a filter that silently deleted
 * half the search would be the first exception to that. So each rule states its
 * count with the rows one click behind it, scored and priced exactly as they
 * would have been. The couple can see what the rules cost them; they simply do
 * not have to scroll past it to read the ranking.
 *
 * One band per reason, and never a row in two of them: a Gulf routing that is
 * also over the cap is filed under the Gulf and carries both reasons on its
 * face, so the counts add up and no row loses half its explanation.
 *
 * Closed whenever a control moves, because the point of a control is to see
 * what it did to the ranking.
 */
function HeldBackBand({
  open,
  onToggle,
  count,
  title,
  summary,
  openHint,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  count: number;
  title: string;
  summary: React.ReactNode;
  openHint: string;
  children: React.ReactNode;
}) {
  const panelId = useId();

  return (
    <section className="mt-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="sb-row flex w-full cursor-pointer items-start gap-3 rounded-xl border border-dashed border-[var(--sb-line)] bg-[color-mix(in_srgb,var(--sb-panel)_55%,transparent)] p-2.5 text-left transition-colors hover:bg-[var(--sb-panel-2)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--sb-accent)] motion-reduce:transition-none sm:p-3"
      >
        <span
          aria-hidden
          className="flex size-[46px] shrink-0 flex-col items-center justify-center rounded-xl border border-dashed sm:size-[52px]"
          style={{
            borderColor: "color-mix(in srgb, var(--sb-over) 40%, transparent)",
            color: "var(--sb-over)",
          }}
        >
          <span className="sb-num text-[16px] leading-none font-semibold sm:text-[18px]">
            {count}
          </span>
          <span className="mt-0.5 text-[8px] leading-none font-semibold tracking-[0.1em] uppercase opacity-80">
            out
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold text-[var(--sb-text)]">
            {count} not shown above <span aria-hidden>·</span> {title}
          </span>
          <span className="mt-1 block max-w-[78ch] text-[10.5px] leading-snug text-[var(--sb-dim)]">
            {summary}
          </span>
          <span className="mt-1 block text-[10px] text-[var(--sb-faint)]">
            {open ? "Hide them again." : openHint}
          </span>
        </span>

        <ChevronDown
          className={cn(
            "mt-1 size-4 shrink-0 text-[var(--sb-faint)] transition-transform motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <ul id={panelId} className="mt-2 flex flex-col gap-2">
          {children}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The floor                                                           */
/* ------------------------------------------------------------------ */

/** "41h", "16h 40m" — an elapsed time, when a live quote gave one. */
function formatElapsed(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * The cheapest thing in the search, quoted as a ruler rather than an offer.
 *
 * Every row above carries its distance from this number, and a page full of
 * "+€178" with no statement of what they are +€178 *from* is a page that has
 * hidden its own baseline — so the reference is always here, even when the row
 * it names is sitting in the ranking with a "= cheapest possible" chip on it.
 * That is the whole point of having it: the ranking is comfort-first, and a
 * comfort-first ranking owes the reader the price of the comfort.
 *
 * Deliberately not a row and deliberately not a button. It is styled as a
 * reference line — no chevron, no hover, nothing to open — and it states its
 * own catches in the same sentence as its price, because a floor that quoted
 * its number without mentioning the elapsed hours and the Gulf transit that
 * bought it would be an advert.
 */
function FloorReference({
  option,
  price,
  heldBack,
  inRanking,
}: {
  option: SearchOption;
  price: OptionPrice;
  heldBack: HeldBack | null;
  inRanking: boolean;
}) {
  const eurPP = perPersonTotal(price)[0];
  const airHours = option.comfort.sectors.reduce((total, s) => total + s.sector.hours, 0);
  const reasons = [
    ...(heldBack?.middleEast.length ? [`transits ${heldBack.middleEast.join(" + ")}`] : []),
    ...(heldBack?.overCap ? ["over the price you set"] : []),
  ];

  return (
    <section className="mt-2 rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel-2)] p-2.5 sm:p-3">
      <p className="sb-label text-[9px]">Cheapest possible</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="sb-num text-[15px] font-semibold text-[var(--sb-text)]">
          {formatEur(eurPP)} pp
        </span>
        <span className="text-[12px] font-semibold text-[var(--sb-text)]">{option.carrier}</span>
        <span className="sb-num text-[10.5px] text-[var(--sb-dim)]">
          {option.origin} <span aria-hidden>→</span> {option.destination}
        </span>
        <span className="text-[10.5px] text-[var(--sb-dim)]">
          {option.via.length > 0 ? `via ${option.via.join(" + ")}` : "nonstop"} ·{" "}
          {price.durationMin !== null
            ? formatElapsed(price.durationMin)
            : `≈${Math.round(airHours)}h in the air`}{" "}
          · comfort {option.comfort.score?.toFixed(1) ?? "unrated"}
        </span>
      </p>
      <p className="mt-1 max-w-[80ch] text-[10.5px] leading-snug text-[var(--sb-dim)]">
        The floor everything above is measured against — not a recommendation.
        It is the cheapest result in this search with every rule switched off,
        including the ones you set:{" "}
        {reasons.length > 0
          ? `this one ${reasons.join(" and ")}, so it is greyed out above.`
          : inRanking
            ? "this one happens to clear them both, so it is up in the ranking too, marked as the floor."
            : "this one is not in the ranking."}{" "}
        Each row&rsquo;s <span className="sb-num">+€</span> is what it costs to do
        better than this.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The page                                                           */
/* ------------------------------------------------------------------ */

export interface FlightsViewProps {
  outbound: readonly SearchOption[];
  returns: readonly SearchOption[];
}

export function FlightsView({ outbound, returns }: FlightsViewProps) {
  const [leg, setLeg] = useState<Leg>("outbound");
  const [outboundDate, setOutboundDate] = useState<string>(OUTBOUND_DEFAULT_DATE);
  const [returnDate, setReturnDate] = useState<string>(RETURN_DEFAULT_DATE);
  const [sort, setSort] = useState<Sort>("comfort");
  /**
   * The two rules, as the visitor's settings rather than as the page's facts.
   * They start where `DEFAULT_RULES` says and the controls above the results
   * say so in words; nothing here is applied without being visible.
   */
  const [rules, setRules] = useState<DefaultRules>(DEFAULT_RULES);
  /**
   * How much of the score is the airline. Starts at the research's 0.55 and
   * moves inside the evidence bracket; every row re-scores from the sector
   * scores it already carries, so this costs no fetch and no server round trip.
   */
  const [airlineWeight, setAirlineWeight] = useState<number>(DEFAULT_AIRLINE_WEIGHT);
  /** Which held-back band is open. Both closed on every search. */
  const [peek, setPeek] = useState<{ middleEast: boolean; overCap: boolean }>({
    middleEast: false,
    overCap: false,
  });
  /**
   * A snapshot of the quote cache, re-taken as each origin lands. The cache is
   * the store; this is how a render finds out it changed, without the effect
   * having to seed a loading state synchronously.
   */
  const [quotes, setQuotes] = useState<ReadonlyMap<string, LiveQuote | null>>(
    () => new Map(QUOTE_CACHE),
  );
  /** The monthly meter, so a cold day can price itself before it is fetched. */
  const [quota, setQuota] = useState<FareQuota | null>(null);
  /** Which route-days already hold a fare. One read per origin, no fare calls. */
  const [coverage, setCoverage] = useState<CoverageReport | null>(null);
  /**
   * The stored price line behind each pin, keyed `"BCN-PER:2026-12-12"`.
   *
   * Read once per watchlist shape from `/api/fares/history`, which cannot reach
   * the fare API — pinning twenty flights must not turn a page load into twenty
   * metered calls (kilbot/holidays#68).
   */
  /**
   * The answer, stamped with the question it answers.
   *
   * One piece of state rather than a map plus a loading flag: "still reading"
   * is exactly "the watchlist has changed since this answer came back", and
   * deriving it from the stamp keeps every write to this state inside the
   * fetch's own callback, where a `setState` belongs.
   */
  const [watch, setWatch] = useState<{
    query: string;
    series: ReadonlyMap<string, FareSeries>;
  }>(() => ({ query: "", series: new Map() }));
  /**
   * The row the couple jumped to from the watchlist.
   *
   * A ring on the row, not just a scroll: arriving in the middle of ninety rows
   * with no idea which one was meant is the failure this exists to prevent. The
   * counter is what makes jumping to the same pin twice do something the second
   * time.
   */
  const [jump, setJump] = useState<{ optionId: string; seq: number } | null>(null);

  const { pins, pin, unpin, full: watchlistFull } = useWatchlist();

  const options = leg === "outbound" ? outbound : returns;
  const date = leg === "outbound" ? outboundDate : returnDate;
  const defaultDate = leg === "outbound" ? OUTBOUND_DEFAULT_DATE : RETURN_DEFAULT_DATE;
  const warmedDates = leg === "outbound" ? OUTBOUND_SEARCH_DATES : RETURN_SEARCH_DATES;

  const refreshQuota = useCallback(() => {
    void fetch("/api/fares/quota")
      .then((response) => (response.ok ? (response.json() as Promise<FareQuota>) : null))
      .then((value) => value && setQuota(value))
      .catch(() => undefined);
  }, []);

  useEffect(refreshQuota, [refreshQuota]);

  /**
   * The distinct airport pairs this search has to ask about.
   *
   * A Gulf row's pair only joins the list once the rule is off or its band is
   * open. Every hub but one shares its pair with a rankable row anyway, so this
   * costs the quota almost nothing — but Canberra's single return is Qatar's,
   * and spending a metered call on a routing the trip has ruled out, before
   * anyone has asked to look at it, is the wrong instinct.
   *
   * Only the routing rule gates this, never the price one. The cap is decided
   * by a quote, so gating on it would make this list depend on the answers it
   * is asking for — and every fare landing would abort the fetches still in
   * flight. An over-cap row shares its origin with rankable rows regardless.
   */
  const showMiddleEast = !rules.avoidMiddleEast || peek.middleEast;
  /**
   * The airport pairs, with no date in them.
   *
   * Split out from `pairs` because coverage is a property of the *route*, not
   * of the day: asking which days a route already holds is one KV read whatever
   * day the strip is on, and re-asking it every time someone steps a day would
   * turn a free lookup into ninety of them.
   */
  const routePairs = useMemo(() => {
    const seen = new Map<string, { from: string; to: string }>();
    for (const option of options) {
      if (!option.searchable) continue;
      if (!showMiddleEast && excludedByDefault(option)) continue;
      const key = routeKeyOf(option.origin, option.destination);
      if (!seen.has(key)) seen.set(key, { from: option.origin, to: option.destination });
    }
    return [...seen.values()];
  }, [options, showMiddleEast]);

  const pairs = useMemo(
    () => routePairs.map((pair) => ({ ...pair, key: keyOf(pair.from, pair.to, date) })),
    [routePairs, date],
  );

  /* Which days are already paid for. KV reads only — this never costs a call. */
  const routeQuery = useMemo(
    () => routePairs.map((pair) => routeKeyOf(pair.from, pair.to)).join(","),
    [routePairs],
  );

  useEffect(() => {
    if (!routeQuery) return;
    const controller = new AbortController();
    void fetch(`/api/fares/coverage?route=${routeQuery}`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<CoverageReport>) : null))
      .then((value) => value && setCoverage(value))
      .catch(() => undefined);
    return () => controller.abort();
  }, [routeQuery]);

  /**
   * Stored per-person fares by route and day: the coverage index, plus whatever
   * this tab has already been handed.
   *
   * The second half matters. A day the couple just paid to price is a day that
   * is now free, and the page knows its prices already — going back to
   * `/api/fares/coverage` to be told what it just fetched would be a round trip
   * to learn nothing, and the endpoint is edge-cached for five minutes anyway.
   */
  const knownRoutes = useMemo(
    () => new Set(routePairs.map((pair) => routeKeyOf(pair.from, pair.to))),
    [routePairs],
  );

  const pricesByRoute = useMemo(() => {
    const byRoute = new Map<string, Map<string, number>>();
    const record = (route: string, day: string, priceEur: number) => {
      const days = byRoute.get(route) ?? new Map<string, number>();
      days.set(day, priceEur);
      byRoute.set(route, days);
    };

    for (const route of coverage?.routes ?? []) {
      for (const [day, entry] of Object.entries(route.dates)) record(route.route, day, entry.priceEur);
    }
    for (const [key, quote] of quotes) {
      // A snapshot is the research estimate, not an observation of a day: it is
      // the same number on all ninety of them, so dotting the calendar with it
      // would say every day was priced when none of them were.
      if (!quote || quote.source === "snapshot") continue;
      const [from, to, day] = key.split("|");
      record(routeKeyOf(from, to), day, quote.priceEur);
    }
    return byRoute;
  }, [coverage, quotes]);

  /** The same thing folded across origins: what the calendar's dots read from. */
  const coverageByDate = useMemo<CoverageByDate>(() => {
    const days = new Map<string, DayCoverage>();
    // The cron's own list is static truth and needs no endpoint, so the strip
    // is never blank — not on first paint, and not with an empty KV.
    for (const day of warmedDates) {
      days.set(day, { source: "warm", cheapestEur: null, routes: 0 });
    }
    for (const [route, byDay] of pricesByRoute) {
      if (!knownRoutes.has(route)) continue;
      for (const [day, priceEur] of byDay) {
        const known = days.get(day);
        const priced = known?.source === "history" ? known : null;
        days.set(day, {
          source: "history",
          cheapestEur: priced?.cheapestEur == null ? priceEur : Math.min(priced.cheapestEur, priceEur),
          routes: (priced?.routes ?? 0) + 1,
        });
      }
    }
    return days;
  }, [warmedDates, pricesByRoute, knownRoutes]);

  /**
   * The origins this day has nothing stored for — the ones the fetch will spend
   * on, under the same fan-out ceiling the fetch itself obeys.
   *
   * It used to be the quote on a permission panel. It is now a report: the
   * calls happen on selection, and this is what the line under the controls
   * counts while they are in flight.
   */
  const coldPairs = useMemo(
    () =>
      pairs
        .filter((pair) => !pricesByRoute.get(routeKeyOf(pair.from, pair.to))?.has(date))
        .slice(0, MAX_INTERACTIVE_FARE_CALLS),
    [pairs, pricesByRoute, date],
  );

  /* One fetch per origin, four at a time, abandoned if the search changes. */
  useEffect(() => {
    const controller = new AbortController();
    const pending = pairs
      .filter((pair) => !QUOTE_CACHE.has(pair.key))
      .slice(0, MAX_INTERACTIVE_FARE_CALLS);
    // Read before the workers drain it: `pending` is the queue they shift from,
    // so by the time the batch settles it is empty either way.
    const attempted = pending.length;

    async function worker() {
      for (;;) {
        const pair = pending.shift();
        if (!pair || controller.signal.aborted) return;
        // Every day is asked the same way now — no stored-only mode, no
        // approval set. The route answers from its cache first and falls back
        // to history when a gate refuses the call, so this spends a call only
        // if there is one to spend and something left to spend it on.
        const quote = await fetchQuote(pair.from, pair.to, date, controller.signal);
        if (controller.signal.aborted) return;
        QUOTE_CACHE.set(pair.key, quote);
        setQuotes(new Map(QUOTE_CACHE));
      }
    }

    const workers = Array.from({ length: Math.min(SEARCH_CONCURRENCY, pending.length) }, worker);
    void Promise.all(workers).then(() => {
      // The batch may have spent quota, and the meter is what says whether a
      // gate has since closed. Re-read it once the batch settles rather than
      // counting locally: a call the server refused is not a call, and only the
      // meter knows which of the two ceilings stopped it.
      if (attempted > 0 && !controller.signal.aborted) refreshQuota();
    });

    return () => controller.abort();
  }, [pairs, date, refreshQuota]);

  /* ---------------------------------------------------------------- */
  /* The watchlist                                                     */
  /* ---------------------------------------------------------------- */

  /**
   * One request for the whole watchlist, re-read only when the watchlist
   * changes.
   *
   * Deliberately not keyed on the searched date: a pin is about *its own* day,
   * and re-reading twenty price lines every time somebody steps the date strip
   * would be a page that got slower the more the couple used it. The endpoint
   * cannot spend a fare call, so this is KV reads and an edge cache.
   */
  const watchQuery = useMemo(() => pins.map(seriesKeyOf).join(","), [pins]);
  const watchLoading = watchQuery !== "" && watch.query !== watchQuery;

  useEffect(() => {
    if (!watchQuery) return;

    const controller = new AbortController();
    const settle = (series: ReadonlyMap<string, FareSeries>) => {
      if (!controller.signal.aborted) setWatch({ query: watchQuery, series });
    };

    void fetch(`/api/fares/history?pin=${watchQuery}`, { signal: controller.signal })
      .then((response) =>
        response.ok ? (response.json() as Promise<{ series?: FareSeries[] }>) : null,
      )
      .then((body) =>
        settle(new Map((body?.series ?? []).map((line) => [`${line.route}:${line.date}`, line]))),
      )
      // Unreachable store, offline tab, deployment protection. The rows fall
      // back to "nothing stored", which is what the page can honestly say —
      // and the query is still stamped, so they stop saying "reading history".
      .catch(() => settle(new Map()));

    return () => controller.abort();
  }, [watchQuery]);

  /**
   * Pin this row as it stands, or unpin it.
   *
   * The whole quote is copied — fare, source, total, comfort — because the pin
   * is a record of what the couple was looking at when they decided it was
   * worth remembering. Re-deriving any of it later, at a different weight or a
   * different fare, would answer a different question.
   */
  const togglePin = useCallback(
    (option: SearchOption, price: OptionPrice) => {
      const id = pinIdOf(leg, option.id, date);
      if (isPinned(pins, id)) {
        unpin(id);
        return;
      }
      pin(
        pinOf({
          leg,
          optionId: option.id,
          from: option.origin,
          to: option.destination,
          date,
          carrier: option.carrier,
          // The low end of the band: identical to the quote when there is one,
          // and the research's "from" price when there is not — with
          // `fareSource` saying which, so the drift knows not to compare them.
          fareEurPP: price.fareEurPP[0],
          fareSource: price.fareSource,
          totalEurCouple: price.totalEurCouple[0],
          comfort: option.comfort.score,
          pinnedAt: new Date().toISOString(),
        }),
      );
    },
    [leg, date, pins, pin, unpin],
  );

  /** Re-anchor the whole search on a pin's leg and day, and point at its row. */
  const jumpToPin = useCallback((entry: FlightPin) => {
    setLeg(entry.leg);
    if (entry.leg === "outbound") setOutboundDate(entry.date);
    else setReturnDate(entry.date);
    setJump((current) => ({ optionId: entry.optionId, seq: (current?.seq ?? 0) + 1 }));
  }, []);

  const priceFor = useCallback(
    (option: SearchOption): OptionPrice => {
      const quote = option.searchable
        ? (quotes.get(keyOf(option.origin, option.destination, date)) ?? null)
        : null;
      return priceOption(option, quote);
    },
    [quotes, date],
  );

  /**
   * The stored fares for one row's airport pair, by day — what the row's
   * alternate-days strip reads. Already in hand from the coverage index, so
   * opening a row costs nothing.
   */
  const pricesFor = useCallback(
    (option: SearchOption): ReadonlyMap<string, number> =>
      pricesByRoute.get(routeKeyOf(option.origin, option.destination)) ?? NO_PRICES,
    [pricesByRoute],
  );

  /** Clicking a day inside a row re-anchors the whole search on it. */
  const pickDate = leg === "outbound" ? setOutboundDate : setReturnDate;

  const rows = useMemo(() => {
    // Every row is re-scored at the current weight before anything is sorted,
    // priced against or compared — the slider has to move the ranking, the
    // badges, the floor and each row's own derivation together or it is
    // showing one number and ranking by another.
    const weighted = options.map((option) => ({
      ...option,
      comfort: reweigh(option.comfort, airlineWeight),
    }));
    const priced = weighted.map((option) => ({ option, price: priceFor(option) }));
    const reference = barcelonaReference(priced);

    const sorted = [...priced].sort((a, b) => {
      if (sort === "price") return a.price.totalEurCouple[0] - b.price.totalEurCouple[0];
      // Comfort-first, with an unrated carrier last however cheap it is — and
      // price as the tie-break, because three-way photo finishes are common.
      const scoreA = a.option.comfort.score ?? -1;
      const scoreB = b.option.comfort.score ?? -1;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return a.price.totalEurCouple[0] - b.price.totalEurCouple[0];
    });

    return sorted.map((entry) => ({
      ...entry,
      arbitrage: arbitrageVsBarcelona(entry.option, entry.price, reference),
      loading:
        entry.option.searchable &&
        !quotes.has(keyOf(entry.option.origin, entry.option.destination, date)),
    }));
  }, [options, priceFor, sort, date, quotes, airlineWeight]);

  /**
   * The ranking, and what each rule holds back from it.
   *
   * All three groups keep the same sort, so a band is the ranking the couple
   * would have had — not an unordered pile of rejects.
   */
  const { ranked, viaMiddleEast, overCap } = useMemo(
    () => groupByDefaultRules(rows, rules),
    [rows, rules],
  );

  /**
   * The floor, and every row's distance from it. Derived from the same priced
   * set as the ranking — no second search, no extra fare call.
   */
  const floor = useMemo(() => cheapestFloor(rows), [rows]);
  const floorEurPP = floor ? perPersonTotal(floor.price)[0] : null;
  const floorIsRanked = floor !== null && ranked.includes(floor);

  const cheapest = ranked.reduce(
    (best, row) => Math.min(best, row.price.totalEurCouple[0]),
    Number.POSITIVE_INFINITY,
  );

  /**
   * A pin whose row is in a held-back band opens the band on the way there.
   *
   * Watching a Gulf routing or something over the price cap is an entirely
   * reasonable thing to do — that is what the bands are *for* — and a jump
   * button that scrolled to a row hidden behind a collapsed disclosure would be
   * a dead button.
   *
   * Adjusted during render rather than in an effect: React's own guidance for
   * state that follows a changing input, and the pattern `PreviewNotice` uses.
   * It fires once per jump, so the couple can still close the band afterwards
   * without the page arguing with them.
   */
  const [jumpHandled, setJumpHandled] = useState(0);
  if (jump && jump.seq !== jumpHandled) {
    setJumpHandled(jump.seq);
    const band = viaMiddleEast.some((row) => row.option.id === jump.optionId)
      ? "middleEast"
      : overCap.some((row) => row.option.id === jump.optionId)
        ? "overCap"
        : null;
    if (band && !peek[band]) setPeek({ ...peek, [band]: true });
  }

  /* And the scroll, once that row is actually in the document. */
  useEffect(() => {
    if (!jump) return;
    document
      .getElementById(rowElementId(jump.optionId))
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [jump, peek]);

  /** Every control change is a new search as far as the bands are concerned. */
  const resetPeek = () => setPeek({ middleEast: false, overCap: false });

  return (
    <main className="sb-scroll h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-[1120px] px-3 pb-24 sm:px-6">
        <header className="pt-7">
          <p className="sb-label">Comfort-first search</p>
          <h1 className="mt-2 font-display text-[30px] leading-[1.05] font-extrabold tracking-[-0.02em] text-[var(--sb-text)] lg:text-[38px]">
            Flights
          </h1>
          <p className="mt-1.5 max-w-[70ch] text-[12px] leading-snug text-[var(--sb-dim)] sm:text-[13px]">
            Valencia has no long-haul, so the real question is which hub to leave
            from — and that is a question about the whole journey, not a fare.
            Both searches ask every credible origin at once, rank what comes back
            by the comfort score rather than the price, and add the train, the
            hold bags, the night before and the taxes back on before anything is
            compared.
          </p>
          <QuotaMeter quota={quota} />
        </header>

        <FlightWatchlist
          pins={pins}
          series={watch.series}
          loading={watchLoading}
          onJump={jumpToPin}
          onUnpin={unpin}
        />

        <div className="mt-5 flex flex-wrap items-start gap-x-6 gap-y-3">
          <Segmented<Leg>
            label="Search"
            value={leg}
            onChange={(value) => {
              setLeg(value);
              resetPeek();
            }}
            options={[
              { value: "outbound", label: "Outbound → Perth", hint: "Europe to Perth, December 2026" },
              { value: "return", label: "Return → Valencia", hint: "East coast to Spain, February 2027" },
            ]}
          />
          <FareDateField
            label={leg === "outbound" ? "Leaving" : "Coming home"}
            value={date}
            onChange={leg === "outbound" ? setOutboundDate : setReturnDate}
            coverage={coverageByDate}
            defaultDate={defaultDate}
          />
          <Segmented<Sort>
            label="Rank by"
            value={sort}
            onChange={setSort}
            options={[
              {
                value: "comfort",
                label: "Comfort",
                hint: `${airlineWeight.toFixed(2)} × airline + ${(1 - airlineWeight).toFixed(2)} × seat, block-hour weighted`,
              },
              { value: "price", label: "Cheapest", hint: "Total for two, everything included" },
            ]}
          />
          <WeightSlider
            value={airlineWeight}
            onChange={(weight) => {
              setAirlineWeight(weight);
              resetPeek();
            }}
          />
          <PriceCap
            value={rules.maxEurPP}
            onChange={(maxEurPP) => {
              setRules((current) => ({ ...current, maxEurPP }));
              resetPeek();
            }}
          />
          <MiddleEastToggle
            avoiding={rules.avoidMiddleEast}
            onChange={(avoidMiddleEast) => {
              setRules((current) => ({ ...current, avoidMiddleEast }));
              resetPeek();
            }}
          />
        </div>

        <ActiveRules
          shown={ranked.length}
          rules={rules}
          sort={sort}
          heldBack={viaMiddleEast.length + overCap.length}
        />

        <WeightNote airlineWeight={airlineWeight} rows={rows} />

        <LiveDayNote date={date} calls={coldPairs.length} origins={pairs.length} />

        <OriginStrip pairs={pairs} quotes={quotes} />

        {leg === "return" && (
          <section className="mt-4 rounded-xl border border-[color-mix(in_srgb,var(--sb-sea)_40%,var(--sb-line))] bg-[color-mix(in_srgb,var(--sb-sea)_8%,transparent)] p-3">
            <h2 className="text-[12.5px] font-semibold text-[var(--sb-text)]">
              {RETURN_A380_TIP.title}
            </h2>
            <p className="mt-1 max-w-[80ch] text-[11px] leading-snug text-[var(--sb-dim)]">
              {RETURN_A380_TIP.body}
            </p>
          </section>
        )}

        <ul className="mt-4 flex flex-col gap-2">
          {ranked.map((row) => (
            <FlightOptionRow
              key={row.option.id}
              option={row.option}
              price={row.price}
              arbitrage={row.arbitrage}
              loading={row.loading}
              floorEurPP={floorEurPP}
              date={date}
              datePrices={pricesFor(row.option)}
              onPickDate={pickDate}
              pinned={isPinned(pins, pinIdOf(leg, row.option.id, date))}
              watchlistFull={watchlistFull}
              onTogglePin={() => togglePin(row.option, row.price)}
              highlighted={jump?.optionId === row.option.id}
            />
          ))}
          {ranked.length === 0 && (
            <li className="rounded-xl border border-dashed border-[var(--sb-line)] p-4 text-[11px] leading-snug text-[var(--sb-dim)]">
              Nothing in this search meets both settings. Everything the research
              found is below, with the reason on each row — raise the price or
              turn the Middle East rule off to bring some of it back up.
            </li>
          )}
        </ul>

        {viaMiddleEast.length > 0 && (
          <HeldBackBand
            open={peek.middleEast}
            onToggle={() => setPeek((value) => ({ ...value, middleEast: !value.middleEast }))}
            count={viaMiddleEast.length}
            title="Middle East transits"
            summary={
              <>
                A hard rule for this trip, not a preference to be scored: anything
                connecting at {listOf(MIDDLE_EAST_TRANSIT_HUBS)} is out of the
                ranking, which is {listOf([...new Set(viaMiddleEast.map((row) => row.option.carrier))])}.
                Asia — Singapore, Hong Kong, Kuala Lumpur — is the lane instead.
                Istanbul is not a Gulf hub and ranks like any other via.
              </>
            }
            openHint="Open to see what the rule costs — scored and priced as they were, never mixed into the ranking."
          >
            {viaMiddleEast.map((row) => (
              <FlightOptionRow
                key={row.option.id}
                option={row.option}
                price={row.price}
                arbitrage={row.arbitrage}
                loading={row.loading}
                floorEurPP={floorEurPP}
                heldBack={heldBackBy(row.option, row.price, rules)}
                date={date}
                datePrices={pricesFor(row.option)}
                onPickDate={pickDate}
                pinned={isPinned(pins, pinIdOf(leg, row.option.id, date))}
                watchlistFull={watchlistFull}
                onTogglePin={() => togglePin(row.option, row.price)}
                highlighted={jump?.optionId === row.option.id}
              />
            ))}
          </HeldBackBand>
        )}

        {overCap.length > 0 && (
          <HeldBackBand
            open={peek.overCap}
            onToggle={() => setPeek((value) => ({ ...value, overCap: !value.overCap }))}
            count={overCap.length}
            title={`Over ${formatEur(rules.maxEurPP)} per person`}
            summary={
              <>
                Interesting anyway. These clear the routing rule and lose on
                price: the cheapest honest total for one person — long-haul,
                positioning move, bags, the night before and the ride home
                included — is over the {formatEur(rules.maxEurPP)} the slider is
                set to. Move it and they come back up.
              </>
            }
            openHint="Open to see them, cheapest first within the ranking they would have had."
          >
            {overCap.map((row) => (
              <FlightOptionRow
                key={row.option.id}
                option={row.option}
                price={row.price}
                arbitrage={row.arbitrage}
                loading={row.loading}
                floorEurPP={floorEurPP}
                heldBack={heldBackBy(row.option, row.price, rules)}
                date={date}
                datePrices={pricesFor(row.option)}
                onPickDate={pickDate}
                pinned={isPinned(pins, pinIdOf(leg, row.option.id, date))}
                watchlistFull={watchlistFull}
                onTogglePin={() => togglePin(row.option, row.price)}
                highlighted={jump?.optionId === row.option.id}
              />
            ))}
          </HeldBackBand>
        )}

        {floor && (
          <FloorReference
            option={floor.option}
            price={floor.price}
            heldBack={heldBackBy(floor.option, floor.price, rules)}
            inRanking={floorIsRanked}
          />
        )}

        <section className="mt-6 rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)] p-3">
          <h2 className="sb-label text-[9px]">How to read this</h2>
          <ul className="mt-1.5 flex max-w-[86ch] flex-col gap-1.5 text-[10.5px] leading-snug text-[var(--sb-dim)]">
            <li>
              <span className="font-semibold text-[var(--sb-text)]">Prices are for two, all in.</span>{" "}
              A row marked <span className="text-[var(--sb-good)]">live fare</span> has the cheapest
              quote for that airport pair on the chosen date; everything else is the research&rsquo;s
              own band — a ranking signal, never a quote. The cheapest row on this
              search totals {Number.isFinite(cheapest) ? `€${Math.round(cheapest).toLocaleString("en-GB")}` : "—"}.
            </li>
            <li>
              <span className="font-semibold text-[var(--sb-text)]">The score is the sort.</span>{" "}
              {airlineWeight.toFixed(2)} × airline + {(1 - airlineWeight).toFixed(2)} × seat, weighted by
              block hours, minus 1.0 for a Gulf transit, 0.75 for metal that is a schedule intention
              rather than a booking, 0.25 for every sector past the second, and 0.25 for each sector of
              six hours or more in a cabin pressurised to 8,000 ft rather than 6,000. Open a row to see
              all of it.
            </li>
            <li>
              <span className="font-semibold text-[var(--sb-text)]">
                Every part of that score says how much of it is evidence.
              </span>{" "}
              Open a row and each component carries a label —{" "}
              <span className="font-semibold text-[var(--sb-text)]">measured</span> (a controlled study
              found it),{" "}
              <span className="text-[var(--sb-dim)]">rated</span> (somebody else&rsquo;s rating, not a
              measurement of comfort) or{" "}
              <span className="text-[var(--sb-faint)]">judgment</span> (no literature; our call, said
              out loud). Hover one for the reason. The seat&rsquo;s inches are measured and the cabin
              altitude is the best-evidenced thing here; the airline ratings are ratings, and the weight
              between them is the least evidenced number on the page — which is why it is a slider.
            </li>
            <li>
              <span className="font-semibold text-[var(--sb-text)]">
                Airline honours are fleet-wide; the seat is this itinerary&rsquo;s.
              </span>{" "}
              A row&rsquo;s expansion prints what its carrier has actually won — five Skytrax stars,
              second in the world, best economy class of 2025 — and then, separately, the aeroplane
              each sector flies with its width, pitch and layout. The first is awarded across a whole
              fleet and every cabin; only the second is what the couple sits in.
            </li>
            <li>
              <span className="font-semibold text-[var(--sb-text)]">
                Every row says what it costs over the floor.
              </span>{" "}
              The cheapest result in the whole search — every rule switched off, however it routes
              and however long it takes — is quoted at the foot of the page, and each row&rsquo;s
              <span className="sb-num"> +€</span> is the per-person distance from it. That number is
              the price of the comfort, the protected connection and the hours saved, said out loud
              rather than left for anyone to work out.
            </li>
            <li>
              <span className="font-semibold text-[var(--sb-text)]">
                Two rules decide what is on the list, and both are showing.
              </span>{" "}
              The price slider and the Middle East switch above the results are the only things
              filtering it — nothing else is hidden, and nothing is ever deleted. What either rule
              catches drops into a greyed band with the reason printed on the row: the Gulf hub it
              connects at, the per-person total that broke the cap, or both. Move a control and the
              rows move with it.
            </li>
            <li>
              <span className="font-semibold text-[var(--sb-text)]">
                A protected feed is worth more than a cheap one.
              </span>{" "}
              Madrid on Iberia and Frankfurt on Lufthansa can be ticketed onto the long-haul as a
              single PNR; Ryanair, Wizz, easyJet, Transavia and Vueling never can. A missed
              connection on a sold-out mid-December Perth flight is close to uncoverable.
            </li>
            <li>
              <span className="font-semibold text-[var(--sb-text)]">
                Every day in the window is choosable, and prices itself when you choose it.
              </span>{" "}
              Any date from 1 December to 28 February, on either search. A day carrying a
              price in the strip or the calendar is already stored — instant. A day with
              nothing on it has never been priced, and choosing it prices the origins that
              are missing, live, then keeps what lands, so it is only ever cold once. The
              fan-out is capped per search, and the two ceilings that can refuse a call —
              the monthly budget and the daily runaway guard — say so in words up by the
              meter rather than quietly handing back a stored price. Opening a row compares
              the days either side of the one you are on, from stored history alone.
            </li>
            <li>
              <span className="font-semibold text-[var(--sb-text)]">
                A pin remembers a quote; the watchlist watches it.
              </span>{" "}
              The pin on any row keeps that itinerary as it stands — day, carrier, price,
              comfort — and puts it at the top of this page with what its price has done
              since. The comparison is read from stored fares only: pinning twenty flights
              never costs a call, and a pinned day nobody has priced since says exactly
              that instead of inventing a change. Twenty pins, shared with whoever holds
              the plan.
            </li>
            <li>
              <span className="font-semibold text-[var(--sb-text)]">One fetch per origin, cached a week.</span>{" "}
              Three dates per route are warmed weekly by the cron, which is why they are the
              ones the searches start on. Adelaide and Western Sydney stay out of the return
              search deliberately — one only matters if the trip already ends in South
              Australia, the other forces an 18-hour Singapore layover.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
