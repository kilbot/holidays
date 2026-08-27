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
 */

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

import {
  OUTBOUND_DEFAULT_DATE,
  OUTBOUND_SEARCH_DATES,
  RETURN_DEFAULT_DATE,
  RETURN_SEARCH_DATES,
} from "@/lib/flights/grid";
import {
  arbitrageVsBarcelona,
  barcelonaReference,
  DEFAULT_RULES,
  groupByDefaultRules,
  heldBackBy,
  LONGHAUL_CAP_RANGE_EUR_PP,
  priceOption,
  type DefaultRules,
  type LiveQuote,
  type OptionPrice,
} from "@/lib/flights/pricing";
import { excludedByDefault, RETURN_A380_TIP, type SearchOption } from "@/lib/flights/search-plan";
import { MIDDLE_EAST_TRANSIT_HUBS } from "@/lib/flights/comfort";
import type { FareQuota } from "@/lib/flights/quota";
import { formatEur } from "@/lib/engine";
import { formatDayYear } from "@/lib/trip-dates";
import { FlightOptionRow } from "@/components/flight-option";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Leg = "outbound" | "return";
type Sort = "comfort" | "price";

const keyOf = (from: string, to: string, date: string) => `${from}-${to}-${date}`;

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
  storedOnly: boolean,
): Promise<LiveQuote | null> {
  try {
    const stored = storedOnly ? "&stored=1" : "";
    const response = await fetch(`/api/fares?from=${from}&to=${to}&date=${date}${stored}`, { signal });
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

function QuotaMeter() {
  const [quota, setQuota] = useState<FareQuota | null>(null);

  useEffect(() => {
    void fetch("/api/fares/quota")
      .then((response) => response.ok ? response.json() as Promise<FareQuota> : null)
      .then((value) => value && setQuota(value))
      .catch(() => undefined);
  }, []);

  return (
    <details className="mt-2 w-fit text-[10px] text-[var(--sb-faint)]">
      <summary className="cursor-pointer">
        live quota: {quota ? `${quota.used}/${quota.budget} this month` : "checking…"}
      </summary>
      {quota && <p className="mt-1">{quota.month} · soft stop at 150 calls per day</p>}
    </details>
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
          aria-label="Most one person may pay for the whole journey"
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
        <Switch id={id} checked={avoiding} onCheckedChange={onChange} className="shrink-0" />
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
      {rules.avoidMiddleEast ? ", avoiding Middle East transits" : ", Middle East transits included"},
      ranked by {sort === "comfort" ? "comfort" : "price"}.
      {heldBack > 0 && (
        <>
          {" "}
          <span className="text-[var(--sb-faint)]">
            {heldBack} more {heldBack === 1 ? "is" : "are"} greyed out below, each
            saying which rule caught it.
          </span>
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

  const options = leg === "outbound" ? outbound : returns;
  const date = leg === "outbound" ? outboundDate : returnDate;
  const dates = leg === "outbound" ? OUTBOUND_SEARCH_DATES : RETURN_SEARCH_DATES;
  const storedOnly = leg === "outbound"
    ? date !== OUTBOUND_DEFAULT_DATE
    : date !== RETURN_DEFAULT_DATE;

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
  const pairs = useMemo(() => {
    const seen = new Map<string, { from: string; to: string; key: string }>();
    for (const option of options) {
      if (!option.searchable) continue;
      if (!showMiddleEast && excludedByDefault(option)) continue;
      const key = keyOf(option.origin, option.destination, date);
      if (!seen.has(key)) seen.set(key, { from: option.origin, to: option.destination, key });
    }
    return [...seen.values()];
  }, [options, date, showMiddleEast]);

  /* One fetch per origin, four at a time, abandoned if the search changes. */
  useEffect(() => {
    const controller = new AbortController();
    const pending = pairs
      .filter((pair) => !QUOTE_CACHE.has(pair.key))
      .slice(0, MAX_INTERACTIVE_FARE_CALLS);

    async function worker() {
      for (;;) {
        const pair = pending.shift();
        if (!pair || controller.signal.aborted) return;
        const quote = await fetchQuote(pair.from, pair.to, date, controller.signal, storedOnly);
        if (controller.signal.aborted) return;
        QUOTE_CACHE.set(pair.key, quote);
        setQuotes(new Map(QUOTE_CACHE));
      }
    }

    const workers = Array.from({ length: Math.min(SEARCH_CONCURRENCY, pending.length) }, worker);
    void Promise.all(workers);

    return () => controller.abort();
  }, [pairs, date, storedOnly]);

  const priceFor = useCallback(
    (option: SearchOption): OptionPrice => {
      const quote = option.searchable
        ? (quotes.get(keyOf(option.origin, option.destination, date)) ?? null)
        : null;
      return priceOption(option, quote);
    },
    [quotes, date],
  );

  const rows = useMemo(() => {
    const priced = options.map((option) => ({ option, price: priceFor(option) }));
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
  }, [options, priceFor, sort, date, quotes]);

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

  const cheapest = ranked.reduce(
    (best, row) => Math.min(best, row.price.totalEurCouple[0]),
    Number.POSITIVE_INFINITY,
  );

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
          <QuotaMeter />
        </header>

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
          <Segmented<string>
            label={leg === "outbound" ? "Leaving" : "Coming home"}
            value={date}
            onChange={leg === "outbound" ? setOutboundDate : setReturnDate}
            options={dates.map((option) => ({ value: option, label: formatDayYear(option) }))}
          />
          <Segmented<Sort>
            label="Rank by"
            value={sort}
            onChange={setSort}
            options={[
              { value: "comfort", label: "Comfort", hint: "0.55 × airline + 0.45 × seat, block-hour weighted" },
              { value: "price", label: "Cheapest", hint: "Total for two, everything included" },
            ]}
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
                heldBack={heldBackBy(row.option, row.price, rules)}
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
                heldBack={heldBackBy(row.option, row.price, rules)}
              />
            ))}
          </HeldBackBand>
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
              0.55 × airline + 0.45 × seat, weighted by block hours, minus 1.0 for a Gulf transit,
              0.75 for metal that is a schedule intention rather than a booking, and 0.25 for every
              sector past the second. Open a row to see all of it.
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
              <span className="font-semibold text-[var(--sb-text)]">One fetch per origin, cached a week.</span>{" "}
              The grid is warmed weekly; alternate dates read stored history only. Adelaide and Western
              Sydney stay out of the return search deliberately — one only matters if the trip
              already ends in South Australia, the other forces an 18-hour Singapore layover.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
