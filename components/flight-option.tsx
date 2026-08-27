"use client";

/**
 * One searched itinerary, and everything behind it.
 *
 * The row carries the four things a decision needs at a glance — how
 * comfortable, from where, on whom, for how much — and holds the rest back
 * until it is asked for, which is the same progressive-disclosure bargain the
 * cost HUD and the Budget page strike. What is one click down is not
 * decoration: it is the arithmetic. The comfort score is a claim, and a claim
 * with a hidden derivation is just a number with a colour, so opening a row
 * shows the weighted airline and seat halves, every sector with its aircraft
 * and where that seat score came from, and each adjustment with the reason it
 * exists.
 *
 * Since the evidence audit (kilbot/holidays#69) it shows two more things, and
 * keeps them apart on purpose. The **airline's credentials** — five Skytrax
 * stars, second in the world, best economy class of 2025 — are what the 55%
 * airline half is actually made of, and they are awarded *fleet-wide*. The
 * **sector list** is what this itinerary flies, per leg, with the seat's own
 * measured inches. Between them sits every component's epistemic label:
 * measured, rated or judgment, with the audit's sentence behind it.
 *
 * The price is on the surface for every row, always, even though the sort is
 * comfort-first. Comfort-first is a ranking, not a blindfold.
 */

import { ChevronDown, Pin } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { formatEur, formatEurCompact } from "@/lib/engine";
import {
  comfortBand,
  rawScoreOf,
  SKYTRAX_REFRESH_DATE,
  sourcesFor,
  type CarrierCredentials,
  type ComfortBand,
  type Evidence,
  type SectorScore,
} from "@/lib/flights/comfort";
import {
  perPersonTotal,
  type Arbitrage,
  type HeldBack,
  type OptionPrice,
  type PriceSource,
} from "@/lib/flights/pricing";
import type { Band, Flag, PositioningOption, SearchOption } from "@/lib/flights/search-plan";
import { WINDOW_DAYS, dayIndex, formatDayYear, isoAt, weekdayName } from "@/lib/trip-dates";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

const formatBand = (band: Band): string =>
  band[0] === band[1]
    ? formatEur(band[0])
    : `${formatEur(band[0])}–${Math.round(band[1]).toLocaleString("en-GB")}`;

/** The badge's ink, by band. Four steps, using the site's signal tokens. */
const BAND_INK: Record<ComfortBand, string> = {
  top: "var(--sb-good)",
  good: "var(--sb-sea)",
  fair: "var(--sb-warn)",
  poor: "var(--sb-over)",
  unrated: "var(--sb-faint)",
};

const BAND_WORD: Record<ComfortBand, string> = {
  top: "top tier",
  good: "good",
  fair: "fair",
  poor: "thin",
  unrated: "unrated",
};

function ComfortBadge({ score }: { score: number | null }) {
  const band = comfortBand(score);
  const ink = BAND_INK[band];

  return (
    <span
      className="flex size-[46px] shrink-0 flex-col items-center justify-center rounded-xl border sm:size-[52px]"
      style={{
        borderColor: `color-mix(in srgb, ${ink} 45%, transparent)`,
        background: `color-mix(in srgb, ${ink} 12%, transparent)`,
        color: ink,
      }}
      title={`Comfort ${score ?? "unrated"} — ${BAND_WORD[band]}`}
    >
      <span className="sb-num text-[16px] leading-none font-semibold sm:text-[18px]">
        {score === null ? "—" : score.toFixed(1)}
      </span>
      <span className="mt-0.5 text-[8px] leading-none font-semibold tracking-[0.1em] uppercase opacity-80">
        {score === null ? "n/r" : "comf"}
      </span>
    </span>
  );
}

const FLAG_INK: Record<Flag["kind"], string> = {
  protected: "var(--sb-good)",
  "self-transfer": "var(--sb-warn)",
  apd: "var(--sb-over)",
  gulf: "var(--sb-warn)",
  metal: "var(--sb-dim)",
  check: "var(--sb-warn)",
  tip: "var(--sb-sea)",
};

function FlagChip({ flag }: { flag: Flag }) {
  const ink = FLAG_INK[flag.kind];
  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-[1px] text-[9.5px] font-semibold tracking-[0.02em] whitespace-nowrap"
      style={{
        color: ink,
        background: `color-mix(in srgb, ${ink} 11%, transparent)`,
      }}
    >
      {flag.label}
    </span>
  );
}

/**
 * Why a row is out of the default ranking, said on the row itself.
 *
 * Dashed like the row's own edge and inked with the site's over-budget signal,
 * so it reads as the same statement the collapsed band above it makes — and so
 * a row that broke both rules cannot be mistaken for one that broke one.
 */
function ReasonChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-md border border-dashed px-1.5 py-[1px] text-[9.5px] font-semibold tracking-[0.02em] whitespace-nowrap"
      style={{
        color: "var(--sb-over)",
        borderColor: "color-mix(in srgb, var(--sb-over) 40%, transparent)",
      }}
    >
      {children}
    </span>
  );
}

const SOURCE_LABEL: Record<PriceSource, string> = {
  live: "live fare",
  history: "fare history",
  snapshot: "fare snapshot",
  estimate: "estimate",
};

const TREND = {
  up: { mark: "▲", ink: "var(--sb-over)", title: "Fare is up versus the median of prior observations" },
  down: { mark: "▼", ink: "var(--sb-good)", title: "Fare is down versus the median of prior observations" },
  flat: { mark: "—", ink: "var(--sb-faint)", title: "Fare is flat versus the median of prior observations" },
} as const;

/* ------------------------------------------------------------------ */
/* The chain                                                           */
/* ------------------------------------------------------------------ */

/**
 * The positioning move, as a sentence rather than a table.
 *
 * The chain is the page's whole argument in one line: a €50 Ryanair hop is not
 * €50, and it is not the same shape of journey as a train the night before.
 * So it says the mode, whether the night is forced, and what the couple pays
 * for the move — never the fare on its own.
 */
function ChainLine({ move, origin }: { move: PositioningOption; origin: string }) {
  const wrongAirport = !move.sameAirport;

  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10.5px] leading-snug text-[var(--sb-dim)]">
      <span className="text-[var(--sb-faint)]">VLC</span>
      <span aria-hidden>→</span>
      <span className="font-semibold text-[var(--sb-text)]">
        {move.mode === "train" ? "train" : move.carrier}
      </span>
      {wrongAirport && (
        <>
          <span aria-hidden>→</span>
          <span className="text-[var(--sb-warn)]">{move.arrivesAt} + ground</span>
        </>
      )}
      <span aria-hidden>→</span>
      <span className="text-[var(--sb-faint)]">{origin}</span>
      {move.overnight !== "optional" && (
        <span className="text-[var(--sb-warn)]">
          · night before{move.overnight === "forced" ? " (forced)" : ""}
        </span>
      )}
      <span>· move costs {formatBand(move.totalEurCouple)}</span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* The breakdown                                                       */
/* ------------------------------------------------------------------ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <h3 className="sb-label text-[9px]">{title}</h3>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Evidence                                                            */
/* ------------------------------------------------------------------ */

/**
 * How much of a number is evidence, said on the number itself.
 *
 * Deliberately typographic and not colour-coded. The four signal colours on
 * this site mean one thing each — sea, good, warn, over — and they are about
 * *the trip*: a fare, a lock, a budget. Epistemics are not a status, and a
 * `judgment` chip inked in warning-orange would read as "this row has a
 * problem" when what it says is "this number is our call". So the three labels
 * separate on weight and border alone: measured is full-strength ink, rated is
 * dimmed, judgment is dimmest and dashed, the same dashed edge the page
 * already uses for "held back, not deleted".
 *
 * The title is the audit's own sentence, verbatim — a chip nobody can
 * interrogate is decoration.
 */
const EVIDENCE_STYLE: Record<Evidence["label"], string> = {
  measured: "border-[var(--sb-line)] bg-[var(--sb-panel-2)] text-[var(--sb-text)]",
  rated: "border-[var(--sb-line)] text-[var(--sb-dim)]",
  judgment: "border-dashed border-[var(--sb-line)] text-[var(--sb-faint)]",
};

function EvidenceChip({ evidence, label }: { evidence: Evidence; label?: string }) {
  return (
    <span
      title={`${evidence.label} — ${evidence.note}`}
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border px-1.5 py-[1px] text-[9px] font-semibold tracking-[0.06em] whitespace-nowrap uppercase",
        EVIDENCE_STYLE[evidence.label],
      )}
    >
      {label ? `${label} ${evidence.label}` : evidence.label}
    </span>
  );
}

/**
 * What the airline has won, and what that does and does not cover.
 *
 * "I didn't know Cathay was number two in the world" (#69) — the airline half
 * carries 55% of the score and showed as a bare 9.0. These are the reasons.
 *
 * The caveat under them is not boilerplate: every one of these honours is
 * awarded to a carrier **fleet-wide**, across cabins the couple is not flying
 * in, and none of them says anything about the aeroplane this itinerary puts
 * them on for thirteen hours. That is what the sector list below is for, and
 * the two are separated on the page so a wall of accolades cannot be mistaken
 * for a promise about the seat.
 */
function CredentialsLine({ credentials }: { credentials: CarrierCredentials }) {
  const shown = credentials.honours.slice(0, 3);
  const rest = credentials.honours.length - shown.length;

  return (
    <li
      className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[10.5px] leading-snug"
      title={
        credentials.honours.length > 0
          ? `${credentials.name}: ${credentials.honours.join(" · ")}${
              credentials.starsAsOf ? ` · Skytrax certification checked ${credentials.starsAsOf}` : ""
            }`
          : undefined
      }
    >
      <span className="font-semibold text-[var(--sb-text)]">{credentials.name}</span>
      <span className="sb-num text-[var(--sb-dim)]">{credentials.airlineScore.toFixed(1)}</span>
      {credentials.stars !== null && (
        <span className="text-[var(--sb-text)]">
          <span aria-hidden>{"★".repeat(credentials.stars)}</span>
          <span className="sr-only">{credentials.stars} star</span> Skytrax
        </span>
      )}
      {shown.map((honour) => (
        <span key={honour} className="text-[var(--sb-dim)]">
          <span aria-hidden className="mr-2 text-[var(--sb-faint)]">
            ·
          </span>
          {honour}
        </span>
      ))}
      {rest > 0 && <span className="text-[var(--sb-faint)]">+{rest} more</span>}
      <EvidenceChip evidence={credentials.evidence} />
    </li>
  );
}

/** '18" wide · 32" pitch · 3-3-3' — the geometry, when the research measured it. */
function SeatGeometry({ sector }: { sector: SectorScore }) {
  const dimensions = sector.seatDimensions;
  const parts = [
    dimensions?.widthIn ? `${dimensions.widthIn}" wide` : null,
    dimensions?.pitchIn ? `${dimensions.pitchIn}" pitch` : null,
    dimensions?.layout ?? null,
    sector.cabinAltitudeFt ? `cabin ${sector.cabinAltitudeFt.toLocaleString("en-GB")} ft` : null,
  ].filter(Boolean);

  if (parts.length === 0) return null;

  return (
    <span className="flex flex-wrap items-baseline gap-x-1.5 text-[var(--sb-dim)]">
      <span className="sb-num">{parts.join(" · ")}</span>
      {sector.seatEvidence.dimensions && (
        <EvidenceChip evidence={sector.seatEvidence.dimensions} />
      )}
    </span>
  );
}

function ComfortBreakdown({ option }: { option: SearchOption }) {
  const { comfort } = option;
  const raw = rawScoreOf(comfort);

  /** One line per carrier flown, not per sector: the honours are the airline's. */
  const carriers = useMemo(() => {
    const seen = new Map<string, CarrierCredentials>();
    for (const sector of comfort.sectors) {
      if (sector.credentials && !seen.has(sector.credentials.carrier)) {
        seen.set(sector.credentials.carrier, sector.credentials);
      }
    }
    return [...seen.values()];
  }, [comfort.sectors]);

  const sources = useMemo(
    () => sourcesFor(["muhm2007", "anjani2021width", "ban2019", "vink2012"]),
    [],
  );

  return (
    <Section title="How the score is built">
      {comfort.unrated ? (
        <p className="max-w-[62ch] text-[10.5px] leading-snug text-[var(--sb-dim)]">
          The comfort research covers 21 airlines and deliberately excludes
          low-cost long-haul, so {option.carrier} has no airline score — and one
          invented for it would sit next to twenty researched ones pretending to
          be the same kind of number. The seat is still measurable:{" "}
          <span className="sb-num text-[var(--sb-text)]">{comfort.seatScore.toFixed(1)}</span>{" "}
          weighted across the sectors.
        </p>
      ) : (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-[var(--sb-dim)]">
          <span className="sb-num">
            {comfort.weights.airline.toFixed(2)} × airline{" "}
            <span className="font-semibold text-[var(--sb-text)]">
              {comfort.airlineScore?.toFixed(1)}
            </span>{" "}
            + {comfort.weights.aircraft.toFixed(2)} × seat{" "}
            <span className="font-semibold text-[var(--sb-text)]">
              {comfort.seatScore.toFixed(1)}
            </span>
            {comfort.adjustments.length > 0 && raw !== null && (
              <> — adjustments = {comfort.score?.toFixed(1)} (raw {raw.toFixed(1)})</>
            )}
          </span>
          <EvidenceChip evidence={comfort.weights.evidence} label="weight:" />
        </p>
      )}

      {carriers.length > 0 && (
        <>
          <h4 className="sb-label mt-3 text-[9px]">The airline, fleet-wide</h4>
          <ul className="mt-1 flex flex-col gap-1">
            {carriers.map((credentials) => (
              <CredentialsLine key={credentials.carrier} credentials={credentials} />
            ))}
          </ul>
          <p className="mt-1 max-w-[62ch] text-[10px] leading-snug text-[var(--sb-faint)]">
            Awarded to the airline across its whole fleet and every cabin it
            sells — not to this route, and not to this aeroplane. What the
            couple actually sits in is the next list down.
          </p>
        </>
      )}

      <h4 className="sb-label mt-3 text-[9px]">This itinerary, sector by sector</h4>
      <ul className="mt-1 flex flex-col gap-1.5">
        {comfort.sectors.map((sector, index) => (
          <li
            key={`${sector.sector.to}-${index}`}
            className="flex flex-col gap-0.5 text-[10.5px] leading-snug"
          >
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="sb-num w-[52px] shrink-0 text-[var(--sb-faint)]">
                {sector.sector.hours}h
              </span>
              <span className="font-semibold text-[var(--sb-text)]">
                {sector.carrierName ?? sector.sector.carrier}
              </span>
              <span className="text-[var(--sb-dim)]">{sector.sector.aircraft}</span>
              <span className="sb-num text-[var(--sb-dim)]">
                seat {sector.seatScore.toFixed(1)}
              </span>
              <EvidenceChip evidence={sector.seatEvidence.score} label="score:" />
              <span className="text-[var(--sb-faint)]">
                {sector.seatSource === "config"
                  ? `carrier config · ${sector.seatConfidence ?? "—"} confidence`
                  : sector.seatSource === "type"
                    ? "aircraft type only"
                    : "type unmeasured"}
              </span>
            </span>
            <span className="flex flex-wrap items-baseline gap-x-2 pl-[52px] text-[10px]">
              <SeatGeometry sector={sector} />
            </span>
          </li>
        ))}
      </ul>

      {comfort.adjustments.length > 0 && (
        <>
          <h4 className="sb-label mt-3 text-[9px]">Adjustments</h4>
          <ul className="mt-1 flex flex-col gap-1.5">
            {comfort.adjustments.map((adjustment) => (
              <li key={adjustment.name} className="text-[10.5px] leading-snug">
                <span className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="sb-num font-semibold text-[var(--sb-warn)]">
                    {adjustment.points.toFixed(2).replace(/0$/, "")}
                  </span>
                  <span className="font-semibold text-[var(--sb-text)]">{adjustment.label}</span>
                  <EvidenceChip evidence={adjustment.evidence} />
                </span>
                <span className="block max-w-[62ch] text-[var(--sb-dim)]">{adjustment.detail}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-3 max-w-[62ch] text-[10px] leading-snug text-[var(--sb-faint)]">
        Scored from {option.origin} outwards. A positioning hop is priced in the
        chain, not scored here, so a hub reached by train is judged on the same
        basis as one reached by Lufthansa. Differences below ~0.3 are noise.{" "}
        <span className="text-[var(--sb-dim)]">
          Skytrax star certifications are current; the Skytrax <em>ranks</em> are
          the 2025 vote — the 2026 World Airline Awards are announced on{" "}
          {SKYTRAX_REFRESH_DATE} and this dataset predates them.
        </span>{" "}
        Sources:{" "}
        {sources.map((source, index) => (
          <span key={source.id}>
            {index > 0 && "; "}
            {source.href ? (
              <a
                href={source.href}
                target="_blank"
                rel="noreferrer"
                title={source.limitation ? `${source.finding} Limitation: ${source.limitation}` : source.finding}
                className="underline decoration-dotted underline-offset-2 hover:text-[var(--sb-text)]"
              >
                {source.label}
              </a>
            ) : (
              source.label
            )}
          </span>
        ))}
        . Full audit in{" "}
        <span className="sb-num">docs/research/comfort-ratings.md</span>, section
        “Evidence basis”.
      </p>
    </Section>
  );
}

function PriceBreakdown({ price }: { price: OptionPrice }) {
  return (
    <Section title="What it costs, for two">
      <ul className="flex flex-col gap-1.5">
        {price.lines.map((line, index) => (
          <li key={`${line.label}-${index}`} className="text-[10.5px] leading-snug">
            <span className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-semibold text-[var(--sb-text)]">{line.label}</span>
              <span className="sb-num text-[var(--sb-dim)]">{formatBand(line.eur)}</span>
            </span>
            {line.detail && (
              <span className="block max-w-[62ch] text-[var(--sb-faint)]">{line.detail}</span>
            )}
          </li>
        ))}
        <li className="mt-0.5 flex items-baseline justify-between gap-x-3 border-t border-[var(--sb-line)] pt-1.5 text-[11px]">
          <span className="font-semibold text-[var(--sb-text)]">Total</span>
          <span className="sb-num font-semibold text-[var(--sb-text)]">
            {formatBand(price.totalEurCouple)}
          </span>
        </li>
      </ul>
    </Section>
  );
}

function ChainOptions({
  option,
  chosen,
}: {
  option: SearchOption;
  chosen: PositioningOption | null;
}) {
  return (
    <Section title={`Every way from Valencia to ${option.origin}`}>
      <ul className="flex flex-col gap-2">
        {option.positioning.map((move) => (
          <li
            key={move.id}
            className={cn(
              "rounded-lg border p-2",
              move.id === chosen?.id
                ? "border-[color-mix(in_srgb,var(--sb-accent)_45%,var(--sb-line))] bg-[color-mix(in_srgb,var(--sb-accent)_6%,transparent)]"
                : "border-[var(--sb-line)]",
            )}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="text-[11px] font-semibold text-[var(--sb-text)]">
                {move.mode === "train" ? "Train" : move.carrier}
                {!move.sameAirport && (
                  <span className="font-normal text-[var(--sb-warn)]"> → {move.arrivesAt}</span>
                )}
              </span>
              <span className="sb-num text-[11px] text-[var(--sb-text)]">
                {formatBand(move.totalEurCouple)}
              </span>
            </div>
            <p className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-[var(--sb-dim)]">
              <span>
                fare {formatEur(move.fareEurPP[0])}–{Math.round(move.fareEurPP[1])} pp
              </span>
              {move.holdBagsEurCouple && <span>+ hold bags {formatBand(move.holdBagsEurCouple)}</span>}
              {move.transferEurCouple && <span>+ ground {formatBand(move.transferEurCouple)}</span>}
              {move.hotelEurCouple && <span>+ hotel {formatBand(move.hotelEurCouple)}</span>}
              <span
                style={{
                  color:
                    move.protection === "protected"
                      ? "var(--sb-good)"
                      : move.protection === "partial"
                        ? "var(--sb-warn)"
                        : "var(--sb-dim)",
                }}
              >
                {move.protection === "protected"
                  ? "single ticket"
                  : move.protection === "partial"
                    ? "partly protected"
                    : "separate ticket"}
              </span>
              <span className="text-[var(--sb-faint)]">{move.frequency}</span>
            </p>
            {move.note && (
              <p className="mt-1 max-w-[62ch] text-[10px] leading-snug text-[var(--sb-faint)]">
                {move.note}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Is there a cheaper day                                              */
/* ------------------------------------------------------------------ */

/** Days either side of the selection the comparison covers. */
const ALTERNATE_RADIUS = 3;

/**
 * The same airport pair on the days around the one being searched.
 *
 * The first question anyone asks about a long-haul fare is whether the day is
 * what is making it expensive, and a page that answers it by re-running a
 * fourteen-origin search per day is a page that eats its own quota. So this is
 * **reads only** — the stored history for this one pair, which the coverage
 * index already handed the page for its calendar. A day with nothing stored
 * shows as nothing stored; it is not fetched to fill the chart in.
 *
 * Dataviz discipline, per the ticket: one axis, no gridlines, a direct label on
 * the cheapest day and on the selected one and nowhere else, tabular figures.
 * The bar is the only ink that varies, and it is scaled across the days that
 * actually have prices rather than from zero — the interesting quantity is the
 * spread between days, and a €1,180-to-€1,420 spread anchored at zero is seven
 * bars of the same height.
 */
function AlternateDays({
  date,
  prices,
  onPickDate,
}: {
  date: string;
  prices: ReadonlyMap<string, number>;
  onPickDate?: (date: string) => void;
}) {
  const days = useMemo(() => {
    const index = dayIndex(date);
    const first = Math.min(
      Math.max(index - ALTERNATE_RADIUS, 0),
      WINDOW_DAYS - 1 - ALTERNATE_RADIUS * 2,
    );
    return Array.from({ length: ALTERNATE_RADIUS * 2 + 1 }, (_, offset) => {
      const day = isoAt(first + offset);
      return { date: day, priceEur: prices.get(day) ?? null };
    });
  }, [date, prices]);

  const known = days.flatMap((day) =>
    day.priceEur === null ? [] : [{ date: day.date, priceEur: day.priceEur }],
  );
  const cheapest = known.reduce<{ date: string; priceEur: number } | null>(
    (best, day) => (best === null || day.priceEur < best.priceEur ? day : best),
    null,
  );
  const low = cheapest?.priceEur ?? 0;
  const high = known.length > 0 ? Math.max(...known.map((day) => day.priceEur)) : 0;
  const spread = high - low;
  const onDate = known.find((day) => day.date === date) ?? null;

  return (
    <Section title="Is there a cheaper day">
      <ul className="flex items-end gap-1">
        {days.map((day) => {
          const selected = day.date === date;
          const best = day.date === cheapest?.date && known.length > 1;
          // 14px of floor under every priced day, so the cheapest is a short
          // bar rather than no bar — an empty column already means "no data".
          const height = day.priceEur === null
            ? 0
            : 14 + (spread === 0 ? 20 : Math.round(((day.priceEur - low) / spread) * 20));
          const ink = best ? "var(--sb-good)" : selected ? "var(--sb-accent)" : "var(--sb-dim)";

          return (
            <li key={day.date} className="flex min-w-0 flex-1 flex-col items-center">
              <span
                className={cn(
                  "sb-num block h-3 text-[9px] leading-none font-semibold tabular-nums",
                  !(best || selected) && "opacity-0",
                )}
                style={{ color: ink }}
                aria-hidden={!(best || selected)}
              >
                {day.priceEur === null ? "" : formatEurCompact(day.priceEur)}
              </span>
              <button
                type="button"
                onClick={() => onPickDate?.(day.date)}
                disabled={!onPickDate || selected}
                aria-current={selected ? "date" : undefined}
                title={
                  day.priceEur === null
                    ? `${formatDayYear(day.date)} — nothing stored for this pair yet.`
                    : `${formatDayYear(day.date)} — €${Math.round(day.priceEur)} pp stored${
                        best ? ", the cheapest of these seven days" : ""
                      }.`
                }
                className={cn(
                  "mt-1 flex w-full cursor-pointer flex-col items-center gap-1 rounded-md px-0.5 py-1 transition-colors motion-reduce:transition-none",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--sb-accent)]",
                  selected
                    ? "bg-[color-mix(in_srgb,var(--sb-accent)_12%,transparent)]"
                    : "hover:bg-[var(--sb-panel-2)] disabled:cursor-default",
                )}
              >
                {day.priceEur === null ? (
                  <span
                    aria-hidden
                    className="block w-full border-t border-dashed border-[var(--sb-line)]"
                    style={{ marginTop: 34 }}
                  />
                ) : (
                  <span
                    aria-hidden
                    className="block w-full rounded-[2px]"
                    style={{ height, background: ink, opacity: selected || best ? 1 : 0.5 }}
                  />
                )}
                <span
                  className={cn(
                    "sb-num block text-[9.5px] leading-none tabular-nums",
                    selected ? "font-semibold text-[var(--sb-accent)]" : "text-[var(--sb-faint)]",
                  )}
                >
                  {weekdayName(day.date).slice(0, 1)}
                  {Number(day.date.slice(8, 10))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 max-w-[62ch] text-[10px] leading-snug text-[var(--sb-faint)]">
        {known.length === 0 ? (
          "Nothing stored for this pair on these days yet. This strip reads the fare history and never spends a call to fill itself in — pick a day and the search above will say what pricing it would cost."
        ) : known.length === 1 ? (
          "One stored day so far. Days fill in as the weekly warm and deliberate fetches cover them; this strip only ever reads what is already there."
        ) : (
          <>
            {known.length} stored days, history only — no call is spent drawing this.
            {cheapest && onDate && cheapest.date !== date && (
              <>
                {" "}
                <span className="text-[var(--sb-good)]">
                  {formatDayYear(cheapest.date)} is {formatEur(Math.round(onDate.priceEur - cheapest.priceEur))} pp
                  cheaper than the day you are searching
                </span>{" "}
                — click it to move the whole search there.
              </>
            )}
            {cheapest && onDate && cheapest.date === date && " The day you are searching is the cheapest of them."}
          </>
        )}
      </p>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Pinning                                                             */
/* ------------------------------------------------------------------ */

/**
 * Remember this quote, on this day (kilbot/holidays#68).
 *
 * A sibling of the disclosure button rather than a child of it — a button
 * inside a button is invalid HTML and, worse, ambiguous to a keyboard: the two
 * things this row can do are *open* and *watch*, and they are different actions
 * with different consequences.
 *
 * Visible at rest rather than on hover, faintly. A pin that only appeared under
 * the pointer would be invisible on a phone and invisible to anyone tabbing,
 * and the whole feature is a memory aid for someone who has already forgotten
 * something once.
 */
function PinButton({
  pinned,
  disabled,
  label,
  onToggle,
}: {
  pinned: boolean;
  /** The watchlist is full. The row says which, in the tooltip. */
  disabled: boolean;
  /** "BCN → PER on 12 Dec 2026" — what is being watched, for a screen reader. */
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled && !pinned}
      aria-pressed={pinned}
      aria-label={pinned ? `Stop watching ${label}` : `Watch ${label}`}
      title={
        pinned
          ? "Watching this quote. Click to stop."
          : disabled
            ? "The watchlist is full — unpin something first."
            : "Watch this quote: it goes to the top of this page with the price it had today."
      }
      className={cn(
        "mt-2.5 mr-2.5 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors motion-reduce:transition-none sm:mt-3 sm:mr-3",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sb-accent)]",
        pinned
          ? "border-[color-mix(in_srgb,var(--sb-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--sb-accent)_14%,transparent)] text-[var(--sb-accent)] hover:bg-[color-mix(in_srgb,var(--sb-accent)_22%,transparent)]"
          : "border-transparent text-[var(--sb-faint)] hover:border-[var(--sb-line)] hover:bg-[var(--sb-panel-2)] hover:text-[var(--sb-text)]",
        "disabled:cursor-default disabled:opacity-40 disabled:hover:border-transparent disabled:hover:bg-transparent disabled:hover:text-[var(--sb-faint)]",
      )}
    >
      <Pin className={cn("size-4", pinned && "fill-current")} aria-hidden />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* The row                                                             */
/* ------------------------------------------------------------------ */

export interface OptionRowProps {
  option: SearchOption;
  price: OptionPrice;
  arbitrage: Arbitrage | null;
  /** True while this origin's live quote is still in flight. */
  loading: boolean;
  /**
   * Why the default rules hold this row out of the ranking, or null when they
   * do not. It changes how the row *reads*, not what it says: dashed edge,
   * muted panel, and each reason named on the surface — a Gulf row that is also
   * over the cap says both, because one of them alone would be half an answer.
   * The score, the price and the whole breakdown stay exactly as they are; the
   * peek exists to show what the rules cost, and a row that hid its own numbers
   * could not do that.
   */
  heldBack?: HeldBack | null;
  /**
   * The cheapest per-person total anywhere in this search, so the row can show
   * what it costs over the floor. This is the price of comfort, stated: the
   * ranking is not by price, so the row that wins it owes the reader a number
   * saying what winning it costs.
   */
  floorEurPP?: number | null;
  /** The day the search is on, so the expansion can compare the days around it. */
  date?: string | null;
  /**
   * Stored per-person fares for *this* airport pair, by date — the coverage the
   * page already holds. Reads only: the alternate-days strip never fetches.
   */
  datePrices?: ReadonlyMap<string, number>;
  /** Re-anchor the whole search on another day. Absent means the strip is read-only. */
  onPickDate?: (date: string) => void;
  /**
   * The watchlist, as three things the row needs to know. Absent means no pin
   * action at all — which is how the held-back bands and any future read-only
   * rendering of a row opt out without a flag of their own.
   */
  pinned?: boolean;
  /** True when the watchlist is at its cap, so an unpinned row can say so. */
  watchlistFull?: boolean;
  onTogglePin?: () => void;
  /**
   * The couple came here from the watchlist and this is the row they meant.
   * Rendered as a ring rather than a scroll: the page owns the scrolling,
   * because only it knows whether the row is inside a band that has to open
   * first.
   */
  highlighted?: boolean;
}

const NO_PRICES: ReadonlyMap<string, number> = new Map();

/**
 * The DOM id a row answers to, so the watchlist can jump to it.
 *
 * Exported rather than composed at both ends by hand: two string templates that
 * have to agree, in two files, is exactly the pair that drifts — and the
 * failure mode is a silent one, a button that scrolls nowhere.
 */
export const rowElementId = (optionId: string): string => `flight-option-${optionId}`;

export function FlightOptionRow({
  option,
  price,
  arbitrage,
  loading,
  heldBack = null,
  floorEurPP = null,
  date = null,
  datePrices = NO_PRICES,
  onPickDate,
  pinned = false,
  watchlistFull = false,
  onTogglePin,
  highlighted = false,
}: OptionRowProps) {
  const excluded = heldBack !== null;
  const overFloor =
    floorEurPP === null ? null : Math.round(perPersonTotal(price)[0] - floorEurPP);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const stops = option.stops === 0 ? "nonstop" : `${option.stops} stop${option.stops > 1 ? "s" : ""}`;

  return (
    <li
      id={rowElementId(option.id)}
      className={cn(
        "sb-row overflow-hidden rounded-xl border",
        excluded
          ? "border-dashed border-[var(--sb-line)] bg-[color-mix(in_srgb,var(--sb-panel)_55%,transparent)]"
          : "border-[var(--sb-line)] bg-[var(--sb-panel)]",
        highlighted &&
          "outline-2 -outline-offset-1 outline-[var(--sb-accent)] transition-[outline-color] duration-500 motion-reduce:transition-none",
      )}
    >
      <div className="flex items-start">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 p-2.5 text-left transition-colors hover:bg-[var(--sb-panel-2)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--sb-accent)] motion-reduce:transition-none sm:p-3"
      >
        <ComfortBadge score={option.comfort.score} />

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="sb-num text-[13px] font-semibold text-[var(--sb-text)]">
              {option.origin} <span aria-hidden>→</span> {option.destination}
            </span>
            <span className="text-[12px] font-semibold text-[var(--sb-text)]">
              {option.carrier}
            </span>
            <span className="text-[10.5px] text-[var(--sb-dim)]">
              {option.originCity} · {option.via.length > 0 ? `via ${option.via.join(" + ")}` : "nonstop"} · {stops}
            </span>
          </span>

          {price.chain && <ChainLine move={price.chain} origin={option.origin} />}

          {option.homeLeg && option.homeLeg.mode !== "none" && (
            <p className="mt-1 text-[10.5px] leading-snug text-[var(--sb-dim)]">
              Lands {option.destination} · home by{" "}
              <span className="font-semibold text-[var(--sb-text)]">
                {option.homeLeg.mode === "train" ? "train" : option.homeLeg.carrier}
              </span>
              {option.homeLeg.protection === "protected" && (
                <span className="text-[var(--sb-good)]"> · same ticket</span>
              )}
            </p>
          )}
          {option.homeLeg?.mode === "none" && (
            <p className="mt-1 text-[10.5px] leading-snug text-[var(--sb-good)]">
              Ends at Valencia airport — no train, no second ticket.
            </p>
          )}

          {(excluded || option.flags.length > 0) && (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {heldBack?.middleEast.length ? (
                <ReasonChip>Via {heldBack.middleEast.join(" + ")}</ReasonChip>
              ) : null}
              {heldBack?.overCap && (
                <ReasonChip>
                  {formatEur(perPersonTotal(price)[0])} pp — over{" "}
                  {formatEur(heldBack.capEurPP)}
                </ReasonChip>
              )}
              {option.flags.map((flag) => (
                <FlagChip key={flag.kind} flag={flag} />
              ))}
            </span>
          )}
        </span>

        <span className="flex shrink-0 items-start gap-1.5">
          <span className="text-right">
            <span className="sb-num block text-[13px] leading-tight font-semibold text-[var(--sb-text)] sm:text-[15px]">
              {formatBand(price.totalEurCouple)}
              {price.trend && (
                <span
                  className="ml-1 text-[9px]"
                  style={{ color: TREND[price.trend].ink }}
                  title={TREND[price.trend].title}
                >
                  {TREND[price.trend].mark}
                </span>
              )}
            </span>
            <span className="block text-[9.5px] text-[var(--sb-faint)]">for two, all in</span>
            {overFloor !== null && (
              <span
                className="sb-num block text-[9.5px]"
                style={{ color: overFloor <= 0 ? "var(--sb-good)" : "var(--sb-dim)" }}
                title={
                  overFloor <= 0
                    ? "Nothing in this search is cheaper. This is the floor everything else is measured against."
                    : "Per person, against the cheapest thing in this search — whatever its routing or its elapsed time."
                }
              >
                {overFloor <= 0
                  ? "= cheapest possible"
                  : `+${formatEur(overFloor)} pp over floor`}
              </span>
            )}
            <span
              className={cn(
                "mt-0.5 inline-flex items-center gap-1 text-[9.5px] font-semibold",
                price.fareSource === "live" ? "text-[var(--sb-good)]" : "text-[var(--sb-faint)]",
              )}
            >
              {loading && (
                <span
                  aria-hidden
                  className="size-1.5 animate-pulse rounded-full bg-[var(--sb-sea)] motion-reduce:animate-none"
                />
              )}
              {loading ? "checking fares" : SOURCE_LABEL[price.fareSource]}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "mt-1 size-4 shrink-0 text-[var(--sb-faint)] transition-transform motion-reduce:transition-none",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </span>
      </button>

        {onTogglePin && (
          <PinButton
            pinned={pinned}
            disabled={watchlistFull}
            label={`${option.origin} to ${option.destination} on ${
              date ? formatDayYear(date) : "this day"
            }, ${option.carrier}`}
            onToggle={onTogglePin}
          />
        )}
      </div>

      {open && (
        <div
          id={panelId}
          className="grid gap-4 border-t border-[var(--sb-line)] p-2.5 sm:grid-cols-2 sm:p-3"
        >
          <ComfortBreakdown option={option} />
          <PriceBreakdown price={price} />

          {date && option.searchable && (
            <div className="sm:col-span-2">
              <AlternateDays date={date} prices={datePrices} onPickDate={onPickDate} />
            </div>
          )}

          {option.positioning.length > 0 && (
            <div className="sm:col-span-2">
              <ChainOptions option={option} chosen={price.chain} />
            </div>
          )}

          {(option.note || arbitrage || option.flags.length > 0 || option.homeLeg) && (
            <div className="sm:col-span-2">
              <Section title="Worth knowing">
                <ul className="flex flex-col gap-1.5">
                  {arbitrage && (
                    <li className="text-[10.5px] leading-snug">
                      <span
                        className="font-semibold"
                        style={{ color: arbitrage.clears ? "var(--sb-good)" : "var(--sb-dim)" }}
                      >
                        Against Barcelona:{" "}
                      </span>
                      <span className="text-[var(--sb-dim)]">{arbitrage.verdict}</span>
                    </li>
                  )}
                  {option.note && (
                    <li className="max-w-[80ch] text-[10.5px] leading-snug text-[var(--sb-dim)]">
                      {option.note}
                    </li>
                  )}
                  {option.homeLeg && option.homeLeg.mode !== "none" && (
                    <li className="max-w-[80ch] text-[10.5px] leading-snug text-[var(--sb-dim)]">
                      {option.homeLeg.detail}
                    </li>
                  )}
                  {option.flags.map((flag) => (
                    <li key={flag.kind} className="max-w-[80ch] text-[10.5px] leading-snug">
                      <span className="font-semibold text-[var(--sb-text)]">{flag.label}: </span>
                      <span className="text-[var(--sb-dim)]">{flag.detail}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
