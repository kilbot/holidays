"use client";

/**
 * The watchlist — the fares the couple pinned, and what has happened since.
 *
 * kilbot/holidays#68: *"sometimes you find a flight you think is good, but then
 * you forget which day it was."* This is the answer to the second half of that
 * sentence. Each row is a quote as it stood on the day it was pinned, next to
 * the newest price the store holds for the same route, day *and carrier*, with
 * the difference stated in the direction a buyer feels it. When the store's
 * newest observation is another airline's — it records each day's cheapest
 * fare, whoever flies it — that figure appears labelled as the day's cheapest,
 * never as this pin's "now".
 *
 * Two things it will not do, and both are the point:
 *
 * - **It never fetches a fare.** Everything here comes from
 *   `/api/fares/history`, which reads the history store and has no path to
 *   SearchAPI at all. A pinned day nobody has priced since says exactly that.
 * - **It never re-dates a pin.** The quote-at-pin-time is the only thing the
 *   watchlist knows that the search below it does not, so nothing in this
 *   component writes a price back onto a pin.
 *
 * It sits above the search rather than beside it because a watchlist that
 * scrolled off with the ranking would be answering the question the couple
 * asked *last* time. It costs nothing when empty: with no pins it renders
 * nothing at all, and the pin on every row below is how it starts existing.
 */

import { Pin, Search } from "lucide-react";

import { formatEur } from "@/lib/engine";
import type { FareSeries, FareTrend } from "@/lib/flights/history";
import {
  driftOf,
  MAX_PINS,
  pinRouteOf,
  type FlightPin,
  type PinDrift,
} from "@/lib/flights/watchlist";
import { formatDayYear } from "@/lib/trip-dates";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* The sparkline                                                       */
/* ------------------------------------------------------------------ */

const SPARK_WIDTH = 96;
const SPARK_HEIGHT = 26;
/** Room for the endpoint dot and the stroke, so neither is clipped by the box. */
const SPARK_PAD = 3;

/**
 * One route-day's stored prices, as a line the width of a word.
 *
 * The #61 leftover, and the ticket's dataviz discipline read literally:
 *
 * - **One axis.** Time runs left to right and price runs up; there are no
 *   ticks, no labels and no second series. The numbers a reader actually needs
 *   — pinned at, now, the difference — are text beside the chart, in the text
 *   tokens, because 9px numerals inside an SVG are a chart pretending to be a
 *   table.
 * - **A recessive grid, of exactly one line.** The dashed hairline is the
 *   *pinned* price: the only reference that makes this chart mean anything, and
 *   the thing the drift chip is measured from. Everything else would be
 *   decoration.
 * - **The endpoint is emphasised.** The newest observation carries a filled dot
 *   in the drift's own ink; the rest of the line is one recessive stroke.
 *
 * Scaled across the observed spread rather than from zero, like the row
 * expansions' alternate-days strip: a €1,180–€1,420 range anchored at zero is a
 * flat line, and the interesting quantity here is the movement.
 *
 * Points are placed by **timestamp**, not by index. The cron warms weekly and
 * the couple prices days by hand in between, so evenly spaced dots would draw a
 * fortnight's gap the same width as an afternoon's.
 */
function PriceSparkline({
  series,
  pinnedEurPP,
  ink,
}: {
  series: FareSeries;
  /** The pinned price, drawn as the reference line. Null hides it. */
  pinnedEurPP: number | null;
  ink: string;
}) {
  const points = series.points;
  if (points.length === 0) return null;

  const prices = points.map((point) => point.priceEur);
  const reference = pinnedEurPP === null ? [] : [pinnedEurPP];
  // The reference line is inside the scale, not floating off the top of it: a
  // pinned price the chart could not draw would be a comparison with an
  // invisible half.
  const low = Math.min(...prices, ...reference);
  const high = Math.max(...prices, ...reference);
  const spread = high - low;

  const times = points.map((point) => Date.parse(point.ts));
  const first = times[0];
  const last = times[times.length - 1];
  const elapsed = last - first;

  const x = (index: number) => {
    const span = SPARK_WIDTH - SPARK_PAD * 2;
    if (points.length === 1) return SPARK_WIDTH / 2;
    // Every observation on one timestamp — a seeded fixture, or two writes in
    // the same second — falls back to even spacing rather than dividing by zero.
    const fraction =
      elapsed > 0 ? (times[index] - first) / elapsed : index / (points.length - 1);
    return SPARK_PAD + fraction * span;
  };

  const y = (priceEur: number) => {
    const span = SPARK_HEIGHT - SPARK_PAD * 2;
    if (spread === 0) return SPARK_HEIGHT / 2;
    return SPARK_PAD + (1 - (priceEur - low) / spread) * span;
  };

  const path = points.map((point, index) => `${x(index)},${y(point.priceEur)}`).join(" ");
  const lastIndex = points.length - 1;

  return (
    <svg
      // The chart is a restatement of the numbers printed beside it, so it is
      // decoration to a screen reader — which is what `aria-hidden` on a
      // sparkline honestly means.
      aria-hidden
      width={SPARK_WIDTH}
      height={SPARK_HEIGHT}
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      className="shrink-0 overflow-visible"
    >
      {pinnedEurPP !== null && (
        <line
          x1={0}
          x2={SPARK_WIDTH}
          y1={y(pinnedEurPP)}
          y2={y(pinnedEurPP)}
          stroke="var(--sb-line)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
      )}
      {points.length > 1 && (
        <polyline
          points={path}
          fill="none"
          stroke={ink}
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.55}
        />
      )}
      <circle cx={x(lastIndex)} cy={y(points[lastIndex].priceEur)} r={2.25} fill={ink} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* One pin                                                             */
/* ------------------------------------------------------------------ */

const TREND_MARK: Record<FareTrend, { mark: string; ink: string; title: string }> = {
  up: { mark: "▲", ink: "var(--sb-over)", title: "Above the median of earlier observations" },
  down: { mark: "▼", ink: "var(--sb-good)", title: "Below the median of earlier observations" },
  flat: { mark: "—", ink: "var(--sb-faint)", title: "Level with the median of earlier observations" },
};

/** A rise is bad news to somebody buying, which is who is reading this. */
const driftInk = (drift: PinDrift): string =>
  drift.direction === "up"
    ? "var(--sb-over)"
    : drift.direction === "down"
      ? "var(--sb-good)"
      : "var(--sb-dim)";

/**
 * The one line the whole feature exists for: *▲€40 since pinned*.
 *
 * It says nothing at all when there is nothing honest to say — a pin taken
 * against a research band, or a day nobody has priced since — and the sentence
 * under the row says which of those it is instead. A chip reading "€0" for
 * "we never looked" would be the page inventing news.
 */
function DriftChip({ drift }: { drift: PinDrift }) {
  if (drift.deltaEur === null) return null;

  const ink = driftInk(drift);
  const mark = drift.direction === "up" ? "▲" : drift.direction === "down" ? "▼" : "=";

  return (
    <span
      className="sb-num inline-flex items-center gap-1 rounded-md border px-1.5 py-[1px] text-[10px] font-semibold whitespace-nowrap"
      style={{ color: ink, borderColor: `color-mix(in srgb, ${ink} 40%, transparent)` }}
    >
      <span aria-hidden>{mark}</span>
      {drift.deltaEur === 0
        ? "unchanged since pinned"
        : `${formatEur(Math.abs(drift.deltaEur))} since pinned`}
    </span>
  );
}

/** Why there is no drift, in the words for this particular nothing. */
const NO_DRIFT_REASON: Record<NonNullable<PinDrift["reason"]>, string> = {
  "nothing-since":
    "Nobody has priced this route on this day since you pinned it — and the watchlist will not spend a call to find out.",
  estimate:
    "You pinned this against the research band rather than a quote, so there is no price change to report — only a first real fare, when one lands.",
  unpriced: "No price was recorded when this was pinned.",
  "different-carrier":
    "The store keeps each day's cheapest fare, whoever flies it, and the newest one is another carrier's — so there is no like-for-like quote to put next to this pin.",
};

function WatchRow({
  pin,
  series,
  onJump,
  onUnpin,
}: {
  pin: FlightPin;
  /** This pin's stored line, or null while the read is still in flight. */
  series: FareSeries | null;
  onJump: () => void;
  onUnpin: () => void;
}) {
  const drift = driftOf(pin, series?.current ?? null);
  const trend = series?.trend ?? null;
  const ink = driftInk(drift);

  return (
    <li className="sb-row rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)] p-2.5 sm:p-3">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        {/* A floor rather than `min-w-0`: with nothing to stop it, the identity
            column collapses to one word per line on a phone and the actions
            never wrap. Below this width they take a line of their own. */}
        <div className="min-w-[15rem] flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="sb-num text-[13px] font-semibold text-[var(--sb-text)]">
              {pin.from} <span aria-hidden>→</span> {pin.to}
            </span>
            <span className="sb-num text-[12px] font-semibold text-[var(--sb-text)]">
              {formatDayYear(pin.date)}
            </span>
            <span className="text-[11px] text-[var(--sb-dim)]">{pin.carrier}</span>
            {pin.comfort !== null && (
              <span
                className="sb-num text-[10.5px] text-[var(--sb-dim)]"
                title="The comfort score this itinerary had when you pinned it, at the weight that was set."
              >
                comfort {pin.comfort.toFixed(1)}
              </span>
            )}
          </p>

          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="sb-num text-[11px] text-[var(--sb-dim)]">
              pinned at{" "}
              <span className="font-semibold text-[var(--sb-text)]">
                {pin.fareEurPP === null ? "no price" : `${formatEur(pin.fareEurPP)} pp`}
              </span>
            </span>
            <span aria-hidden className="text-[10px] text-[var(--sb-faint)]">
              →
            </span>
            <span className="sb-num text-[11px] text-[var(--sb-dim)]">
              now{" "}
              <span className="font-semibold" style={{ color: ink }}>
                {drift.currentEurPP !== null
                  ? `${formatEur(drift.currentEurPP)} pp`
                  : drift.cheapest
                    ? "no quote for this carrier"
                    : "nothing stored"}
              </span>
            </span>
            {drift.cheapest && (
              <span
                className="sb-num text-[11px] text-[var(--sb-dim)]"
                title="The newest stored observation — the cheapest fare seen on this day, which was another carrier's."
              >
                cheapest this day{" "}
                <span className="font-semibold text-[var(--sb-text)]">
                  {formatEur(drift.cheapest.eurPP)} pp
                </span>{" "}
                ({drift.cheapest.carrier})
              </span>
            )}
            <DriftChip drift={drift} />
            {trend && (
              <span
                className="sb-num text-[10px]"
                style={{ color: TREND_MARK[trend].ink }}
                title={`Trend across everything stored for this route-day. ${TREND_MARK[trend].title}.`}
              >
                {TREND_MARK[trend].mark}
              </span>
            )}
          </p>

          {drift.reason && (
            <p className="mt-1 max-w-[72ch] text-[10px] leading-snug text-[var(--sb-faint)]">
              {NO_DRIFT_REASON[drift.reason]}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {series && series.points.length > 0 ? (
            <span className="flex flex-col items-end">
              <PriceSparkline series={series} pinnedEurPP={pin.fareEurPP} ink={ink} />
              <span className="sb-num mt-0.5 text-[9px] text-[var(--sb-faint)]">
                {series.points.length} stored {series.points.length === 1 ? "price" : "prices"}
              </span>
            </span>
          ) : (
            <span className="sb-num text-[9px] text-[var(--sb-faint)]">
              {series ? "no price line yet" : "reading history…"}
            </span>
          )}

          <button
            type="button"
            onClick={onJump}
            title={`Move the search to ${pin.from} → ${pin.to} on ${formatDayYear(pin.date)} and show this itinerary.`}
            className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--sb-line)] px-2.5 text-[11px] font-semibold text-[var(--sb-text)] transition-colors hover:bg-[var(--sb-panel-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sb-accent)] motion-reduce:transition-none"
          >
            <Search className="size-3.5 shrink-0" aria-hidden />
            Search this day
          </button>

          <button
            type="button"
            onClick={onUnpin}
            aria-label={`Stop watching ${pin.from} to ${pin.to} on ${formatDayYear(pin.date)}`}
            title="Stop watching this quote."
            className={cn(
              "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors motion-reduce:transition-none",
              "border-[color-mix(in_srgb,var(--sb-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--sb-accent)_14%,transparent)] text-[var(--sb-accent)]",
              "hover:bg-[color-mix(in_srgb,var(--sb-accent)_22%,transparent)]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sb-accent)]",
            )}
          >
            <Pin className="size-4 fill-current" aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* The section                                                         */
/* ------------------------------------------------------------------ */

export interface FlightWatchlistProps {
  pins: readonly FlightPin[];
  /** The stored line per pin, keyed `"BCN-PER:2026-12-12"`. */
  series: ReadonlyMap<string, FareSeries>;
  /** True until the first history read has come back. */
  loading: boolean;
  onJump: (pin: FlightPin) => void;
  onUnpin: (id: string) => void;
}

/** `"BCN-PER:2026-12-12"` — the key both ends of the history read speak in. */
export const seriesKeyOf = (pin: FlightPin): string => `${pinRouteOf(pin)}:${pin.date}`;

/**
 * What a pin the store has never heard of looks like once the read has been
 * made — as opposed to `null`, which means the read is still out.
 *
 * The distinction is the difference between "nobody has looked since" and "we
 * are still looking", and a watchlist that showed the first while doing the
 * second would be wrong for exactly as long as the request takes.
 */
const emptySeries = (pin: FlightPin): FareSeries => ({
  route: pinRouteOf(pin),
  from: pin.from,
  to: pin.to,
  date: pin.date,
  points: [],
  current: null,
  trend: null,
});

export function FlightWatchlist({
  pins,
  series,
  loading,
  onJump,
  onUnpin,
}: FlightWatchlistProps) {
  if (pins.length === 0) return null;

  return (
    <section className="mt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="sb-label text-[9px]">
          Watchlist <span className="sb-num text-[var(--sb-faint)]">{pins.length}/{MAX_PINS}</span>
        </h2>
        <p className="text-[10px] text-[var(--sb-faint)]">
          The quote as it stood, against the newest price already stored. Nothing here
          spends a call.
        </p>
      </div>

      <ul className="mt-2 flex flex-col gap-2">
        {pins.map((pin) => {
          const stored = series.get(seriesKeyOf(pin)) ?? null;
          return (
            <WatchRow
              key={pin.id}
              pin={pin}
              series={stored ?? (loading ? null : emptySeries(pin))}
              onJump={() => onJump(pin)}
              onUnpin={() => onUnpin(pin.id)}
            />
          );
        })}
      </ul>
    </section>
  );
}
