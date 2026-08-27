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
 * The price is on the surface for every row, always, even though the sort is
 * comfort-first. Comfort-first is a ranking, not a blindfold.
 */

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { formatEur } from "@/lib/engine";
import { comfortBand, rawScoreOf, type ComfortBand } from "@/lib/flights/comfort";
import {
  perPersonTotal,
  type Arbitrage,
  type HeldBack,
  type OptionPrice,
  type PriceSource,
} from "@/lib/flights/pricing";
import type { Band, Flag, PositioningOption, SearchOption } from "@/lib/flights/search-plan";
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

function ComfortBreakdown({ option }: { option: SearchOption }) {
  const { comfort } = option;
  const raw = rawScoreOf(comfort);

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
        <p className="sb-num text-[11px] text-[var(--sb-dim)]">
          0.55 × airline{" "}
          <span className="font-semibold text-[var(--sb-text)]">
            {comfort.airlineScore?.toFixed(1)}
          </span>{" "}
          + 0.45 × seat{" "}
          <span className="font-semibold text-[var(--sb-text)]">
            {comfort.seatScore.toFixed(1)}
          </span>
          {comfort.adjustments.length > 0 && raw !== null && (
            <> — adjustments = {comfort.score?.toFixed(1)} (raw {raw.toFixed(1)})</>
          )}
        </p>
      )}

      <ul className="mt-2 flex flex-col gap-1.5">
        {comfort.sectors.map((sector, index) => (
          <li
            key={`${sector.sector.to}-${index}`}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[10.5px] leading-snug"
          >
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
            <span className="text-[var(--sb-faint)]">
              {sector.seatSource === "config"
                ? `carrier config · ${sector.seatConfidence ?? "—"} confidence`
                : sector.seatSource === "type"
                  ? "aircraft type only"
                  : "type unmeasured"}
            </span>
          </li>
        ))}
      </ul>

      {comfort.adjustments.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {comfort.adjustments.map((adjustment) => (
            <li key={adjustment.name} className="text-[10.5px] leading-snug">
              <span className="sb-num font-semibold text-[var(--sb-warn)]">
                {adjustment.points.toFixed(2).replace(/0$/, "")}
              </span>{" "}
              <span className="font-semibold text-[var(--sb-text)]">{adjustment.label}</span>
              <span className="block max-w-[62ch] text-[var(--sb-dim)]">{adjustment.detail}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 max-w-[62ch] text-[10px] leading-snug text-[var(--sb-faint)]">
        Scored from {option.origin} outwards. A positioning hop is priced in the
        chain, not scored here, so a hub reached by train is judged on the same
        basis as one reached by Lufthansa. Differences below ~0.3 are noise.
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
}

export function FlightOptionRow({
  option,
  price,
  arbitrage,
  loading,
  heldBack = null,
  floorEurPP = null,
}: OptionRowProps) {
  const excluded = heldBack !== null;
  const overFloor =
    floorEurPP === null ? null : Math.round(perPersonTotal(price)[0] - floorEurPP);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const stops = option.stops === 0 ? "nonstop" : `${option.stops} stop${option.stops > 1 ? "s" : ""}`;

  return (
    <li
      className={cn(
        "sb-row overflow-hidden rounded-xl border",
        excluded
          ? "border-dashed border-[var(--sb-line)] bg-[color-mix(in_srgb,var(--sb-panel)_55%,transparent)]"
          : "border-[var(--sb-line)] bg-[var(--sb-panel)]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full cursor-pointer items-start gap-3 p-2.5 text-left transition-colors hover:bg-[var(--sb-panel-2)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--sb-accent)] motion-reduce:transition-none sm:p-3"
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

      {open && (
        <div
          id={panelId}
          className="grid gap-4 border-t border-[var(--sb-line)] p-2.5 sm:grid-cols-2 sm:p-3"
        >
          <ComfortBreakdown option={option} />
          <PriceBreakdown price={price} />

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
