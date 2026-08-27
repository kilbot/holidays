"use client";

/**
 * The Ledger (#41) — the trip as a day-by-day account, at full width.
 *
 * The #33 prototype's variant B is the ancestor: place bands as sticky section
 * headers, one row per Day underneath, the money right-aligned in mono. What it
 * was missing is the thing the engine now supplies — a Day is *priced*, and the
 * price is made of lines with bands and sources. So a resting row is one line
 * (date, place, what is happening, the plan-on figure) and opening one shows the
 * lodging night, the food, the local transport, the Event spend and the Leg
 * that add up to it, each with the band and the sentence saying where the rate
 * came from. #10's progressive disclosure is the law here, not a preference:
 * plan-on on the surface, everything honest one click down.
 *
 * ## Places, and the journeys between them (#53)
 *
 * The page alternates two kinds of row. A **block** is a run of days in one
 * place, and its subtotal is what the couple spends *there* — living, the car,
 * the Event spend. A **transit row** is a Leg: the flight or the drive that gets
 * them to the next block, on its own band between the two, with the fare on it.
 *
 * That split is the whole of #53. The engine charges a Leg's fare to the Day it
 * is travelled — it has to, the Plan's total is the sum of its Days — and that
 * Day is the first day of the place being arrived in, so a block that simply
 * summed its Days billed Margaret River for the crossing from Valencia. Getting
 * somewhere is not being there, and now the page says so.
 *
 * Three things this page deliberately does **not** do:
 *
 * - **It does not price anything.** Every figure is a `Day` line or a sum of
 *   them (`lib/engine/blocks.ts`), so the sections reconcile with the roll-up by
 *   construction rather than by agreement: block subtotals plus transit rows are
 *   the plan-on figure, to the cent.
 * - **It does not draw the Budget.** The plan-on total, the contingency, the
 *   plan total and the worst case are in the header as an orientation, and the
 *   link to /budget is the whole of the money view. Two pages drawing the same
 *   burn-down is two pages drifting.
 *
 *   The contingency is in that row because leaving it out made the two pages
 *   disagree in public (#99): the Budget's headline is plan-on *plus* the ~10%
 *   contingency and the Ledger's was plan-on alone, so the same trip carried
 *   two different totals — €15,093 here against €16,603 there — while the two
 *   worst cases matched to the cent, and the word "contingency" appeared
 *   nowhere on this page to explain the gap. It is not folded into the sum of
 *   the Days, which would break the invariant this page exists to show; it is
 *   the visible line #10 asks for, standing next to the figure it is added to.
 * - **It does not edit.** Dragging Capsules is the Plan page's job. This is the
 *   document you read — and, per the print styles, the one you take to the
 *   airport on paper.
 */

import Link from "next/link";
import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  ArrowRight,
  Car,
  ChevronRight,
  Pin,
  Plane,
  Ship,
  TrainFront,
  TriangleAlert,
} from "lucide-react";

import {
  DAILY_CAP_AUD,
  describeLock,
  formatEur,
  intoLedger,
  TIER_LABEL,
  type CapsuleSpec,
  type Day,
  type DayLine,
  type LedgerBlock,
  type LedgerDay,
  type LedgerTransit,
  type LegMode,
  type Warning,
  type WarningKind,
} from "@/lib/engine";
import { usePlan } from "@/lib/engine/use-plan";
import {
  anchorOn,
  describeAnchor,
  formatDay,
  formatDayYear,
  weekdayOf,
} from "@/lib/trip-dates";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Where a Warning belongs                                             */
/* ------------------------------------------------------------------ */

/**
 * A Warning lands on the Days it names — but *some* Warnings name a whole week.
 *
 * A jam-packed week carries seven dates and a lock violation carries the whole
 * block; badging every row with them would say the same sentence seven times
 * and drown the one Warning that really is about one Day. So the kind decides
 * the altitude: cap blowouts, missed buffers and missed Anchors are facts about
 * a Day; violated Locks, overlaps and jam-packed runs are facts about a block;
 * blown Budgets and Capsules that do not fit are facts about the Plan.
 */
const ROW_KINDS = new Set<WarningKind>([
  "daily-cap",
  "zero-buffer",
  "anchor-missed",
]);

const BLOCK_KINDS = new Set<WarningKind>([
  "lock-violated",
  "overlap",
  "jam-packed",
]);

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ------------------------------------------------------------------ */
/* Small parts                                                         */
/* ------------------------------------------------------------------ */

type Tone = "neutral" | "good" | "warn" | "over" | "accent";

const TONE_CLASS: Record<Tone, string> = {
  neutral:
    "bg-[color-mix(in_srgb,var(--sb-panel-2)_80%,transparent)] text-[var(--sb-dim)]",
  good: "bg-[color-mix(in_srgb,var(--sb-good)_15%,transparent)] text-[var(--sb-good)]",
  warn: "bg-[color-mix(in_srgb,var(--sb-warn)_16%,transparent)] text-[var(--sb-warn)]",
  over: "bg-[color-mix(in_srgb,var(--sb-over)_15%,transparent)] text-[var(--sb-over)]",
  accent:
    "bg-[color-mix(in_srgb,var(--sb-accent)_14%,transparent)] text-[var(--sb-accent)]",
};

function Chip({
  tone = "neutral",
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-px text-[9.5px] font-semibold whitespace-nowrap",
        "print:border print:border-[var(--sb-line)] print:bg-transparent",
        TONE_CLASS[tone],
      )}
    >
      {children}
    </span>
  );
}

function WarningLine({ warning }: { warning: Warning }) {
  const over = warning.tone === "over";
  return (
    <li className="flex gap-1.5">
      <TriangleAlert
        className={cn(
          "mt-px size-3 shrink-0",
          over ? "text-[var(--sb-over)]" : "text-[var(--sb-warn)]",
        )}
      />
      <div className="min-w-0">
        <p
          className={cn(
            "text-[11px] leading-tight font-semibold",
            over ? "text-[var(--sb-over)]" : "text-[var(--sb-warn)]",
          )}
        >
          {warning.label}
        </p>
        <p className="text-[10.5px] leading-snug text-[var(--sb-dim)]">
          {warning.detail}
        </p>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* One Day                                                             */
/* ------------------------------------------------------------------ */

/**
 * What the Day is for, in the words the row has space for.
 *
 * Ordered by what a traveller reading the page needs first: an Anchor is the
 * reason the trip is shaped this way, a Leg is the day you have to be at an
 * airport, an Event is the thing you booked, and everything else is where you
 * are. `dayHeadline` in the engine makes the same call for the 90px week cell;
 * this one has room to name the journey rather than just the place.
 */
function whatOf(day: Day, capsule: CapsuleSpec | undefined) {
  const anchor = anchorOn(day.date);
  // Every journey travelled today, not the first of them. Boxing Day is 370 km
  // down the Midlands road *and* the 23:55 red-eye east, and a row that named
  // only the drive was hiding the more consequential half of the day.
  const journeys = day.lines.filter((line) => line.kind === "transport");
  const event = day.lines.find((line) => line.kind === "event");

  const text = anchor
    ? anchor.label
    : journeys.length > 0
      ? journeys.map((line) => line.label).join(", then ")
      : (event?.label ??
        (day.buffer
          ? "Buffer — nothing booked"
          : (day.capsuleName ?? day.locationName)));

  const of =
    day.capsuleDay && capsule && capsule.days > 1
      ? `day ${day.capsuleDay} of ${capsule.days}`
      : null;

  return { text, of, anchor, journeys, event };
}

function DayRow({
  entry,
  capsule,
  capEur,
  warnings,
  open,
  onToggle,
  legModes,
}: {
  entry: LedgerDay;
  capsule: CapsuleSpec | undefined;
  capEur: number;
  warnings: Warning[];
  open: boolean;
  onToggle: () => void;
  /** Transport line id → the mode of the Leg that charged it. */
  legModes: ReadonlyMap<string, LegMode>;
}) {
  const { day } = entry;
  const { text, of, anchor, journeys } = whatOf(day, capsule);
  const overCap = day.livingEur > capEur;
  // The fare left for the transit row above, so the row shows what the day cost
  // in this place. Saying so on hover is the difference between a figure that
  // reconciles and one that looks wrong (#53).
  const lifted = entry.transitLines.reduce((total, line) => total + line.eur, 0);

  return (
    <li
      className={cn(
        "border-b border-l-2 border-b-[color-mix(in_srgb,var(--sb-line)_50%,transparent)] print:break-inside-avoid",
        // An Anchor is a fixed date+place commitment, not a plan item — it is
        // pinned on the strip and on the week zoom, and it is pinned here.
        anchor
          ? "border-[var(--sb-accent)] bg-[color-mix(in_srgb,var(--sb-accent)_7%,transparent)]"
          : "border-transparent",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        title={`${day.locationName}${day.capsuleName ? ` · ${day.capsuleName}` : ""} — open the day's lines.`}
        className={cn(
          "grid w-full cursor-pointer items-baseline gap-x-2 py-[5px] pr-1 pl-2 text-left",
          // On a phone the four columns are all still here — a row has to say
          // where and what even at 375px — but the space goes to what is
          // happening, because the place is repeated down the whole block and
          // the band above already said it.
          "grid-cols-[46px_minmax(0,0.8fr)_minmax(0,1.6fr)_auto]",
          "sm:grid-cols-[118px_minmax(0,160px)_minmax(0,1fr)_auto] sm:gap-x-4 sm:py-1.5 sm:pl-3",
          "transition-colors hover:bg-[color-mix(in_srgb,var(--sb-panel-2)_55%,transparent)] motion-reduce:transition-none",
          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--sb-accent)]",
          "print:hover:bg-transparent",
        )}
      >
        <time
          dateTime={day.date}
          className="sb-num flex items-center gap-1 text-[10.5px] whitespace-nowrap text-[var(--sb-faint)] sm:text-[11px]"
        >
          <ChevronRight
            aria-hidden
            className={cn(
              "hidden size-3 shrink-0 transition-transform sm:block motion-reduce:transition-none print:hidden",
              open && "rotate-90",
            )}
          />
          <span className="hidden sm:inline">{WEEKDAYS[weekdayOf(day.date)]} </span>
          {formatDay(day.date)}
        </time>

        {/* The place, deliberately quiet. The sticky band overhead already
            names it, so repeating it in bold on every row of a fourteen-day
            block shouts the one thing that is not changing. It stays on the row
            because a row torn out of context — printed, scrolled past its
            band — still has to say where the couple is. */}
        <span
          className={cn(
            "truncate text-[11px] leading-snug text-[var(--sb-dim)] sm:text-[12px]",
            day.locationId === "transit" && "text-[var(--sb-faint)] italic",
          )}
        >
          {day.locationName}
        </span>

        {/* An Anchor's own sentence sits on the words it pins, so "Christmas"
            can say what it means to a stranger: fixed, where, and why the rest
            of the trip bends round it (#56). */}
        <span
          className="flex min-w-0 items-center gap-1.5"
          title={anchor ? describeAnchor(anchor) : undefined}
        >
          {anchor && (
            <Pin
              aria-label="pinned anchor"
              className="size-3 shrink-0 text-[var(--sb-accent)]"
            />
          )}
          {/* One icon per journey, each drawn as what it is. A plane beside
              "Rottnest Island → Perth by ferry" was the second half of
              kilbot/holidays#101; a Day with two journeys gets two icons. */}
          {journeys.map((line) => {
            const Mode = MODE_ICON[line.mode ?? "flight"];
            return (
              <Mode
                key={line.id}
                aria-hidden
                className="size-3 shrink-0 text-[var(--sb-sea)]"
              />
            );
          })}
          <span
            className={cn(
              "truncate text-[11.5px] leading-snug sm:text-[12.5px]",
              anchor
                ? "font-semibold text-[var(--sb-accent)]"
                : day.buffer
                  ? "text-[var(--sb-faint)] italic"
                  : "font-medium text-[var(--sb-text)]",
            )}
          >
            {text}
          </span>
          {of && (
            <span className="sb-num hidden shrink-0 text-[9.5px] text-[var(--sb-faint)] lg:inline">
              {of}
            </span>
          )}
          {warnings.length > 0 && (
            <TriangleAlert
              aria-label={warnings.map((warning) => warning.label).join("; ")}
              className={cn(
                "size-3 shrink-0",
                warnings.some((warning) => warning.tone === "over")
                  ? "text-[var(--sb-over)]"
                  : "text-[var(--sb-warn)]",
              )}
            />
          )}
        </span>

        <span
          className={cn(
            "sb-num w-[56px] text-right text-[11px] font-medium sm:w-[78px] sm:text-[12.5px]",
            // The cap is measured on living lines only, so the red is on the
            // number and the reason is one click down.
            overCap
              ? "font-semibold text-[var(--sb-over)]"
              : "text-[var(--sb-text)]",
          )}
          title={
            [
              overCap
                ? `Living costs are €${Math.round(day.livingEur)}, over the A$${DAILY_CAP_AUD} / €${Math.round(capEur)} daily cap for a couple. Event spend and Legs sit outside it.`
                : null,
              lifted > 0
                ? `Spent here on the day. The €${Math.round(lifted).toLocaleString("en-GB")} fare travelled today is on the transit row, not in this block.`
                : null,
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
        >
          {formatEur(entry.costEur)}
        </span>
      </button>

      {open && (
        <DayLines entry={entry} capsule={capsule} capEur={capEur} warnings={warnings} />
      )}
    </li>
  );
}

/** The drill-in: every line, its band, its source, and what is wrong with the Day. */
function DayLines({
  entry,
  capsule,
  capEur,
  warnings,
}: {
  entry: LedgerDay;
  capsule: CapsuleSpec | undefined;
  capEur: number;
  warnings: Warning[];
}) {
  const { day } = entry;
  // The research's own all-in figure for the block, shown once — on the
  // Capsule's first Day — rather than on all five. It is a cross-check and not
  // an input (#10): it was quoted at mid-tier lodging and this model prices the
  // floor, and saying so is the honest way to surface the gap.
  const published =
    day.capsuleDay === 1 && capsule?.publishedEur ? capsule : null;

  return (
    <div className="mb-2 ml-2 border-l border-[var(--sb-line)] pl-3 sm:ml-[118px] sm:pl-4">
      {day.peakLabel && (
        <p className="pt-1 text-[10.5px] leading-snug text-[var(--sb-warn)]">
          <span className="font-semibold">{day.peakLabel}</span>{" "}
          <span className="text-[var(--sb-dim)]">{day.peakNote}</span>
        </p>
      )}

      {/* Only the lines that stayed on the Day. The Leg fares travelled today
          are drawn once, on the transit row that carries them, and listing them
          here as well would put the same €3,800 in the ledger twice. */}
      <dl className="mt-1.5 flex flex-col gap-1.5">
        {entry.lines
          .filter((line) => line.eur !== 0 || line.kind === "lodging")
          .map((line) => (
            <LedgerLine key={line.id} line={line} />
          ))}
      </dl>

      <p className="mt-2 text-[10px] leading-snug text-[var(--sb-faint)]">
        Living {formatEur(day.livingEur)} of the €{Math.round(capEur)} cap
        {day.livingEur > capEur ? " — over" : ""}. Event spend and Legs sit
        outside it.
        {day.lodgingTier !== "airbnb" && ` Lodging at ${TIER_LABEL[day.lodgingTier]}.`}
        {entry.transitLines.map((line) => (
          <span key={line.id}>
            {" "}
            The {line.label} fare, {formatEur(line.eur)}, is on its own transit
            row — reaching a place is not part of what the place costs.
          </span>
        ))}
        {published && (
          <>
            {" "}
            The research&rsquo;s published all-in figure for {published.name} is{" "}
            {formatEur(published.publishedEur ?? 0)} for the whole block — a
            cross-check, not an input: it was quoted at mid-tier lodging and this
            model prices the floor.
          </>
        )}
      </p>

      {warnings.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {warnings.map((warning) => (
            <WarningLine key={warning.id} warning={warning} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LedgerLine({ line }: { line: DayLine }) {
  const banded = line.bandEur[0] !== line.bandEur[1];
  // The accent marks Event spend — the deliberate splurge the day-to-day thrift
  // pays for — and `docs/CONTEXT.md` lists inter-city Legs in it. Not `!living`:
  // the A$40 day-to-day activities line is outside the Daily cap but it is not
  // a splurge, and `rollup.ts` files it under living for exactly that reason.
  const splurge = line.kind === "event" || line.kind === "transport";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <dt
          className={cn(
            "min-w-0 text-[11px] leading-snug",
            splurge
              ? "font-semibold text-[var(--sb-accent)]"
              : "text-[var(--sb-dim)]",
          )}
        >
          {line.label}
        </dt>
        <dd className="sb-num shrink-0 text-right text-[11px] text-[var(--sb-text)]">
          {formatEur(line.eur)}
          {banded && (
            <span className="ml-2 text-[10px] font-normal text-[var(--sb-faint)]">
              {formatEur(line.bandEur[0])}–
              {Math.round(line.bandEur[1]).toLocaleString("en-GB")}
              {line.aud !== null && ` · A$${Math.round(line.aud)}`}
            </span>
          )}
        </dd>
      </div>
      <p className="mt-px max-w-[76ch] text-[10px] leading-snug text-[var(--sb-faint)]">
        {line.note}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One place block                                                     */
/* ------------------------------------------------------------------ */

function BlockBand({
  block,
  capsules,
}: {
  block: LedgerBlock;
  capsules: ReadonlyMap<string, CapsuleSpec>;
}) {
  const warnings = block.warnings.filter((warning) =>
    BLOCK_KINDS.has(warning.kind),
  );
  const violated = new Set(
    warnings
      .filter((warning) => warning.kind === "lock-violated")
      .map((warning) => warning.capsuleId),
  );

  // Two window-locked Capsules in one place print two identical chips and say
  // nothing twice, so the chips are one per *kind* of Lock and the reasons —
  // which are per Capsule and are the interesting part — collect in the title.
  const locks: { label: string; title: string; breached: boolean }[] = [];
  for (const id of block.capsuleIds) {
    const capsule = capsules.get(id);
    const chip = capsule && describeLock(capsule.lock);
    if (!capsule || !chip) continue;
    const breached = violated.has(id);
    const reason = `${capsule.name}: ${chip.sentence}${breached ? ". This placement sits outside it." : ""}`;
    const existing = locks.find((lock) => lock.label === chip.chip);
    if (existing) {
      existing.title += `\n\n${reason}`;
      existing.breached ||= breached;
      continue;
    }
    locks.push({ label: chip.chip, title: reason, breached });
  }

  return (
    <div
      className={cn(
        "sticky top-0 z-10 border-b border-[var(--sb-line)] bg-[var(--sb-ink)]",
        "px-2 pt-4 pb-1.5 sm:px-3",
        // On paper a band must not be split across sheets, nor printed as the
        // last thing on one with its Days overleaf.
        "print:static print:break-inside-avoid print:break-after-avoid print:bg-transparent",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h2 className="font-display text-[15px] leading-tight font-semibold sm:text-[17px]">
          {block.locationName}
        </h2>
        <p className="text-[10.5px] text-[var(--sb-dim)] sm:text-[11.5px]">
          {block.label} · {block.days.length} day
          {block.days.length === 1 ? "" : "s"}
          {block.bufferDays > 0 && ` · ${block.bufferDays} buffer`}
          {block.capsuleNames.length > 0 && ` · ${block.capsuleNames.join(" · ")}`}
        </p>

        {block.homeBase && (
          <Chip
            tone="good"
            title="Free lodging and a borrowed car. cost-baselines §4 puts every day moved from the east coast to a Home base at about A$500 saved — the single biggest lever in the Plan."
          >
            home base
          </Chip>
        )}

        {block.peaks.map((peak) => (
          <Chip key={peak.id} tone="warn" title={peak.note}>
            {peak.label}
          </Chip>
        ))}

        {locks.map((lock) => (
          <Chip
            key={lock.label + (lock.breached ? "!" : "")}
            tone={lock.breached ? "over" : "neutral"}
            title={lock.title}
          >
            {lock.label}
            {lock.breached && " breached"}
          </Chip>
        ))}

        <p
          className="sb-num ml-auto text-[12px] font-semibold whitespace-nowrap sm:text-[13.5px]"
          title={`What ${block.days.length} day${block.days.length === 1 ? "" : "s"} in ${block.locationName} costs — living, the car and the Event spend. Getting here is the transit row above, not part of this. Band €${Math.round(block.bandEur[0]).toLocaleString("en-GB")}–${Math.round(block.bandEur[1]).toLocaleString("en-GB")}.`}
        >
          {formatEur(block.costEur)}
        </p>
      </div>

      {warnings.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-1">
          {warnings.map((warning) => (
            <WarningLine key={warning.id} warning={warning} />
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One journey between blocks                                          */
/* ------------------------------------------------------------------ */

const MODE_ICON: Record<LegMode, ComponentType<{ className?: string }>> = {
  flight: Plane,
  drive: Car,
  train: TrainFront,
  ferry: Ship,
};

const MODE_LABEL: Record<LegMode, string> = {
  flight: "Flight",
  drive: "Drive",
  train: "Train",
  ferry: "Ferry",
};

/**
 * Where the fare is quoted from, in the two words a row has space for.
 *
 * The same claim the Legs popup makes, and for the same reason: a live fare and
 * a research band are different claims about the same number, and the couple is
 * about to book on it.
 */
const PRICING_LABEL: Record<LedgerTransit["pricing"], string> = {
  pinned: "pinned fare",
  snapshot: "snapshot",
  band: "estimate",
  computed: "fuel",
};

/**
 * A Leg, between the block it leaves and the block it reaches.
 *
 * The #33 prototype had these and the first Ledger lost them, which is how the
 * crossing from Valencia ended up inside Margaret River. The band is
 * deliberately unlike a place band — sea-tinted, hairline-ruled top and bottom,
 * the route in mono — because it is not a section heading: it is a line item
 * that happens to sit between sections, and it should read as the trip moving
 * rather than as a new place starting.
 */
function TransitRow({ transit }: { transit: LedgerTransit }) {
  const Mode = MODE_ICON[transit.mode];
  const free = transit.costEur === 0;
  const banded = transit.bandEur[0] !== transit.bandEur[1];

  return (
    <div
      className={cn(
        "my-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 border-y px-2 py-1.5 sm:px-3",
        "border-[color-mix(in_srgb,var(--sb-sea)_28%,var(--sb-line))]",
        "bg-[color-mix(in_srgb,var(--sb-sea)_11%,transparent)]",
        "print:break-inside-avoid print:bg-transparent",
      )}
    >
      <Mode
        aria-hidden
        className="size-3.5 shrink-0 self-center text-[var(--sb-sea)]"
      />

      <p className="flex min-w-0 items-baseline gap-1.5 text-[11.5px] leading-snug font-semibold text-[var(--sb-text)] sm:text-[12.5px]">
        <span className="truncate">{transit.fromName}</span>
        <ArrowRight
          aria-hidden
          className="size-3 shrink-0 self-center text-[var(--sb-faint)]"
        />
        <span className="truncate">{transit.toName}</span>
      </p>

      <p className="sb-num text-[10px] whitespace-nowrap text-[var(--sb-faint)]">
        {transit.from === transit.to ? "" : `${transit.from}–${transit.to} · `}
        {formatDay(transit.date)}
      </p>

      <p className="text-[10.5px] whitespace-nowrap text-[var(--sb-dim)]">
        {MODE_LABEL[transit.mode]}
        {transit.carrier && ` · ${transit.carrier}`}
      </p>

      <Chip
        tone={transit.hydrated ? "good" : "neutral"}
        title={transit.note}
      >
        {transit.hydrated ? "live fare" : PRICING_LABEL[transit.pricing]}
      </Chip>

      <p
        className="sb-num ml-auto text-[12px] font-semibold whitespace-nowrap text-[var(--sb-sea)] sm:text-[13.5px]"
        title={
          free
            ? transit.note
            : `${transit.note}${banded ? ` Band €${Math.round(transit.bandEur[0]).toLocaleString("en-GB")}–${Math.round(transit.bandEur[1]).toLocaleString("en-GB")}.` : ""}`
        }
      >
        {free ? (
          <span className="text-[11px] font-medium text-[var(--sb-faint)]">
            {/* Both crossings carry a fare since #90, so the only zero left is
                a drive with no coordinates for one of its ends. */}
            no fare
          </span>
        ) : (
          formatEur(transit.costEur)
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */

export function LedgerView() {
  const { plan, capsules, scenarios } = usePlan();
  const [openDates, setOpenDates] = useState<ReadonlySet<string>>(new Set());
  const [allOpen, setAllOpen] = useState(false);

  const rows = useMemo(
    () => intoLedger(plan.days, plan.warnings, plan.legs),
    [plan.days, plan.warnings, plan.legs],
  );

  /**
   * The mode of the Leg behind every transport line, keyed the way `legs.ts`
   * keys the line it charges, so a day row can draw the same icon as the
   * transit row above it (#101).
   */
  const legModes = useMemo(
    () => new Map(plan.legs.map((leg) => [`${leg.date}:${leg.id}`, leg.mode])),
    [plan.legs],
  );

  const byDate = useMemo(() => {
    const map = new Map<string, Warning[]>();
    for (const warning of plan.warnings) {
      if (!ROW_KINDS.has(warning.kind)) continue;
      for (const date of warning.dates) {
        const list = map.get(date);
        if (list) list.push(warning);
        else map.set(date, [warning]);
      }
    }
    return map;
  }, [plan.warnings]);

  // Whatever is not about a Day or a block is about the Plan, and the header is
  // where the Plan is described. Nothing is ever dropped.
  const planWarnings = plan.warnings.filter(
    (warning) =>
      warning.dates.length === 0 ||
      (!ROW_KINDS.has(warning.kind) && !BLOCK_KINDS.has(warning.kind)),
  );

  const capEur = DAILY_CAP_AUD * plan.rollUp.fxRate;
  const { rollUp } = plan;

  const toggle = (date: string) =>
    setOpenDates((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });

  return (
    <main className="sb-scroll h-full w-full overflow-y-auto print:h-auto print:overflow-visible">
      <div className="mx-auto max-w-[1120px] px-3 pb-24 sm:px-6 print:max-w-none print:px-0 print:pb-0">
        <header className="pt-7 print:pt-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="sb-label">Australia 2026–27</p>
            <p className="text-[11px] text-[var(--sb-faint)]">
              Scenario{" "}
              <span className="font-semibold text-[var(--sb-dim)]">
                {scenarios.current.name}
              </span>
            </p>
          </div>

          <div className="mt-2 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="min-w-0">
              <h1 className="font-display text-[30px] leading-[1.05] font-extrabold tracking-[-0.02em] text-[var(--sb-text)] lg:text-[38px]">
                Ledger
              </h1>
              <p className="mt-1.5 text-[12px] text-[var(--sb-dim)] sm:text-[13px]">
                {formatDayYear(plan.startDate)} – {formatDayYear(plan.endDate)} ·{" "}
                <span className="sb-num">{plan.dayCount}</span> days ·{" "}
                <span className="sb-num">{rollUp.homeBaseNights}</span>{" "}
                free-lodging nights ·{" "}
                <span className="sb-num">{rollUp.bufferDays}</span> buffer days
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <div>
                <p className="sb-label text-[9px]">Plan-on</p>
                <p
                  className="sb-num text-[22px] leading-none font-semibold lg:text-[26px]"
                  title="The sum of every Day below, to the cent. Before the contingency, which is its own line."
                >
                  {formatEur(rollUp.planOnEur)}
                </p>
              </div>
              {/* The gap between this page and the Budget, said out loud (#99).
                  The Budget's headline is plan-on plus this; the Ledger's is
                  plan-on alone, and it is the sum of the Days by construction.
                  Both are right, and a visitor can only see that if the figure
                  standing between them is on the page. */}
              <div>
                <p className="sb-label text-[9px]">
                  {rollUp.contingencyOn ? "Contingency" : "Contingency zeroed"}
                </p>
                <p
                  className={cn(
                    "sb-num text-[15px] leading-none lg:text-[17px]",
                    rollUp.contingencyOn
                      ? "text-[var(--sb-dim)]"
                      : "text-[var(--sb-faint)]",
                  )}
                  title={
                    rollUp.contingencyOn
                      ? "The ~10% 'stuff happens' row, kept as its own line and never folded into the Days. Switched on and off on the Budget."
                      : "Zeroed on the Budget, so plan-on and the plan total are the same figure."
                  }
                >
                  {rollUp.contingencyOn
                    ? `+${formatEur(rollUp.contingencyEur)}`
                    : formatEur(0)}
                </p>
              </div>
              <div>
                <p className="sb-label text-[9px]">Plan total</p>
                <p
                  className="sb-num text-[15px] leading-none text-[var(--sb-dim)] lg:text-[17px]"
                  title="Plan-on plus the contingency — the figure the Budget leads with, so the two pages read as one trip."
                >
                  {formatEur(rollUp.totalEur)}
                </p>
              </div>
              <div>
                <p className="sb-label text-[9px]">Worst case</p>
                <p
                  className="sb-num text-[15px] leading-none text-[var(--sb-dim)] lg:text-[17px]"
                  title={`Band high, re-converted at the €0.65 stress rate${rollUp.contingencyOn ? ", contingency included" : ""}. The honest ceiling.`}
                >
                  {formatEur(rollUp.worstCaseEur)}
                </p>
              </div>
              <Link
                href="/budget"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--sb-line)] bg-[var(--sb-panel)] px-3 text-[12px] font-semibold text-[var(--sb-text)] transition-colors hover:bg-[var(--sb-panel-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sb-accent)] motion-reduce:transition-none print:hidden"
              >
                Budget <span aria-hidden>→</span>
              </Link>
            </div>
          </div>

          {planWarnings.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--sb-over)_35%,var(--sb-line))] bg-[color-mix(in_srgb,var(--sb-over)_7%,transparent)] p-2.5 print:bg-transparent">
              {planWarnings.map((warning) => (
                <WarningLine key={warning.id} warning={warning} />
              ))}
            </ul>
          )}

          {/* The note stays on paper — the FX rate every figure below is quoted
              at is exactly the thing a printed sheet has to carry with it. */}
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--sb-line)] pt-2">
            <p className="text-[10.5px] text-[var(--sb-faint)]">
              Plan-on figures, EUR per couple, at A$1 = €{rollUp.fxRate}. A
              place band is what its days cost on the ground; getting there is
              the transit row above it.
              <span className="print:hidden">
                {" "}
                Open a day for its lines, bands and sources.
              </span>
            </p>
            <button
              type="button"
              onClick={() => {
                setAllOpen((value) => !value);
                setOpenDates(new Set());
              }}
              aria-pressed={allOpen}
              title="Opens every Day's lines — also what prints, if you want the sources on paper."
              className={cn(
                "shrink-0 cursor-pointer rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors motion-reduce:transition-none",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sb-accent)]",
                allOpen
                  ? "border-[var(--sb-accent)] bg-[color-mix(in_srgb,var(--sb-accent)_14%,transparent)] text-[var(--sb-accent)]"
                  : "border-[var(--sb-line)] bg-[var(--sb-panel)] text-[var(--sb-dim)] hover:text-[var(--sb-text)]",
              )}
            >
              {allOpen ? "Hide every line" : "Show every line"}
            </button>
          </div>
        </header>

        {rows.map((row) =>
          row.kind === "transit" ? (
            <TransitRow key={row.id} transit={row.transit} />
          ) : (
            <section
              key={row.id}
              aria-label={`${row.block.locationName}, ${row.block.label}`}
            >
              <BlockBand block={row.block} capsules={capsules} />
              <ul>
                {row.block.days.map((entry) => (
                  <DayRow
                    key={entry.day.date}
                    entry={entry}
                    capsule={
                      entry.day.capsuleId
                        ? capsules.get(entry.day.capsuleId)
                        : undefined
                    }
                    capEur={capEur}
                    warnings={byDate.get(entry.day.date) ?? []}
                    open={allOpen || openDates.has(entry.day.date)}
                    onToggle={() => toggle(entry.day.date)}
                    legModes={legModes}
                  />
                ))}
              </ul>
            </section>
          ),
        )}

        <p className="mt-6 border-t border-[var(--sb-line)] pt-3 text-[10.5px] leading-snug text-[var(--sb-faint)]">
          Every figure is the sum of its Days — {plan.dayCount} of them, priced
          one at a time. A place band is what those days cost on the ground; the
          journeys between them are the transit rows, and the two add up to{" "}
          {formatEur(rollUp.planOnEur)}.{" "}
          {rollUp.contingencyOn ? (
            <>
              Nothing on this page is the contingency: that is{" "}
              {formatEur(rollUp.contingencyEur)} on top, its own line rather
              than a margin hidden in the days, which is why the Budget leads
              with {formatEur(rollUp.totalEur)}.
            </>
          ) : (
            <>
              The contingency is zeroed, so that is also the plan total the
              Budget leads with.
            </>
          )}{" "}
          Bands and sources are on the lines. Australia 2026–27 ·{" "}
          {scenarios.current.name} · {formatDayYear(plan.startDate)} –{" "}
          {formatDayYear(plan.endDate)}.
        </p>
      </div>
    </main>
  );
}
