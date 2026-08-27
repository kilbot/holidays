"use client";

/**
 * The Flights page (#50) — two pre-programmed searches, ranked comfort-first.
 *
 * The premise is that the interesting question is never "what does Barcelona
 * cost". It is "given that Valencia has no long-haul, which of thirteen
 * European hubs is the right one to leave from once the train, the hold bags,
 * the night before and the lost connection protection are all counted" — and
 * that question cannot be answered one airport at a time. So both searches are
 * multi-origin: one fetch per origin, in parallel, each cached 24 hours by the
 * route grid and warmed nightly by the cron, with the row showing which of its
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
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  OUTBOUND_DEFAULT_DATE,
  OUTBOUND_SEARCH_DATES,
  RETURN_DEFAULT_DATE,
  RETURN_SEARCH_DATES,
} from "@/lib/flights/grid";
import {
  arbitrageVsBarcelona,
  barcelonaReference,
  priceOption,
  type LiveQuote,
  type OptionPrice,
} from "@/lib/flights/pricing";
import { RETURN_A380_TIP, type SearchOption } from "@/lib/flights/search-plan";
import { formatDayYear } from "@/lib/trip-dates";
import { FlightOptionRow } from "@/components/flight-option";
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
 * is 24 hours; this one only has to outlive a navigation.
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
      source: body.source === "live" ? "live" : "snapshot",
      fetchedAt: typeof body.fetchedAt === "string" ? body.fetchedAt : null,
    };
  } catch {
    // An exhausted quota, an offline tab and a malformed body all land here,
    // and all mean the same thing to the page: keep the research band.
    return null;
  }
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
  const live = pairs.filter((pair) => quotes.get(pair.key)).length;
  const pending = pairs.filter((pair) => !quotes.has(pair.key)).length;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <p className="sb-label text-[9px]">
        {pairs.length} origins ·{" "}
        <span className="text-[var(--sb-good)]">{live} live</span> ·{" "}
        {pending > 0 ? `${pending} searching` : `${pairs.length - live} on research bands`}
      </p>
      <ul className="flex flex-wrap gap-1">
        {pairs.map((pair) => {
          const searching = !quotes.has(pair.key);
          const quote = quotes.get(pair.key) ?? null;
          const ink = searching ? "var(--sb-sea)" : quote ? "var(--sb-good)" : "var(--sb-faint)";
          return (
            <li
              key={pair.key}
              title={
                searching
                  ? `${pair.from} → ${pair.to}: searching`
                  : quote
                    ? `${pair.from} → ${pair.to}: live fare, ${quote.carrier}`
                    : `${pair.from} → ${pair.to}: no live fare, research band`
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

  /** The distinct airport pairs this search has to ask about. */
  const pairs = useMemo(() => {
    const seen = new Map<string, { from: string; to: string; key: string }>();
    for (const option of options) {
      if (!option.searchable) continue;
      const key = keyOf(option.origin, option.destination, date);
      if (!seen.has(key)) seen.set(key, { from: option.origin, to: option.destination, key });
    }
    return [...seen.values()];
  }, [options, date]);

  /* One fetch per origin, four at a time, abandoned if the search changes. */
  useEffect(() => {
    const controller = new AbortController();
    const pending = pairs.filter((pair) => !QUOTE_CACHE.has(pair.key));

    async function worker() {
      for (;;) {
        const pair = pending.shift();
        if (!pair || controller.signal.aborted) return;
        const quote = await fetchQuote(pair.from, pair.to, date, controller.signal);
        if (controller.signal.aborted) return;
        QUOTE_CACHE.set(pair.key, quote);
        setQuotes(new Map(QUOTE_CACHE));
      }
    }

    const workers = Array.from({ length: Math.min(SEARCH_CONCURRENCY, pending.length) }, worker);
    void Promise.all(workers);

    return () => controller.abort();
  }, [pairs, date]);

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

  const cheapest = rows.reduce(
    (best, row) => Math.min(best, row.price.totalEurCouple[0]),
    Number.POSITIVE_INFINITY,
  );

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
        </header>

        <div className="mt-5 flex flex-wrap items-start gap-x-6 gap-y-3">
          <Segmented<Leg>
            label="Search"
            value={leg}
            onChange={setLeg}
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
        </div>

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
          {rows.map((row) => (
            <FlightOptionRow
              key={row.option.id}
              option={row.option}
              price={row.price}
              arbitrage={row.arbitrage}
              loading={row.loading}
            />
          ))}
        </ul>

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
                A protected feed is worth more than a cheap one.
              </span>{" "}
              Madrid on Iberia and Frankfurt on Lufthansa can be ticketed onto the long-haul as a
              single PNR; Ryanair, Wizz, easyJet, Transavia and Vueling never can. A missed
              connection on a sold-out mid-December Perth flight is close to uncoverable.
            </li>
            <li>
              <span className="font-semibold text-[var(--sb-text)]">One fetch per origin, cached a day.</span>{" "}
              The grid is warmed nightly, so most of these are cache hits. Adelaide and Western
              Sydney stay out of the return search deliberately — one only matters if the trip
              already ends in South Australia, the other forces an 18-hour Singapore layover.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
