"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Plane, TrainFront, X } from "lucide-react";

import { formatEur } from "@/lib/engine";
import { LEG_FACTS, routePointOf } from "@/lib/demo-route";
import {
  FARE_SOURCE_LABEL,
  fetchLegFare,
  formatDuration,
  legEstimate,
  legIsPriced,
  type LegFare,
} from "@/lib/leg-fare";
import { cn } from "@/lib/utils";

/**
 * What a Leg says when you click it.
 *
 * A Leg is derived, not placed (docs/CONTEXT.md), so everything here is
 * read-only: where it goes, when, how long it takes, what it costs and who
 * flies it. The one live thing is the money — the four Legs whose route and
 * date are both in the fare grid go and ask `/api/fares` when the popup opens,
 * and the rest quote the demo Plan.
 *
 * The provenance label is not decoration. "Live fare" and "estimate" are
 * different claims about the same number and the traveller is about to make
 * booking decisions on it, so the popup always says which one it is holding.
 */

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatLegDate(iso: string): string {
  return DATE_FORMAT.format(new Date(`${iso}T12:00:00Z`));
}

/** "fetched 14:20 today", "fetched 27 Aug" — how stale the number is. */
function formatFetchedAt(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return iso;
  const sameDay = when.toDateString() === new Date().toDateString();
  return sameDay
    ? `fetched ${when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
    : `fetched ${when.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

const SOURCE_TOKEN: Record<LegFare["source"], string> = {
  live: "--sb-good",
  snapshot: "--sb-sea",
  estimate: "--sb-faint",
};

export function LegPopup({
  legId,
  onClose,
}: {
  legId: string;
  onClose: () => void;
}) {
  const facts = LEG_FACTS[legId];
  const [from, to] = legId.split(">");
  const origin = routePointOf(from);
  const destination = routePointOf(to);

  // Mounted with `key={legId}` by the stage, so the initial state is always
  // this Leg's own estimate and the effect never has to reset it.
  const priced = legIsPriced(legId);
  const [fare, setFare] = useState<LegFare>(() => legEstimate(legId));
  const [loading, setLoading] = useState(priced);

  useEffect(() => {
    if (!priced) return;
    const controller = new AbortController();
    let live = true;
    fetchLegFare(legId, controller.signal).then((result) => {
      if (!live) return;
      setFare(result);
      setLoading(false);
    });
    return () => {
      live = false;
      controller.abort();
    };
  }, [legId, priced]);

  if (!facts || !origin || !destination) return null;

  const Mode = facts.mode === "train" ? TrainFront : Plane;
  const duration = fare.durationMin ?? facts.durationMin;

  return (
    <div className="sb-panel relative w-[268px] p-3">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close the leg detail"
        className="absolute top-2 right-2 flex size-6 cursor-pointer items-center justify-center rounded-md text-[var(--sb-faint)] transition-colors hover:bg-[var(--sb-panel-2)] hover:text-[var(--sb-text)] motion-reduce:transition-none"
      >
        <X className="size-3.5" />
      </button>

      <p className="sb-label flex items-center gap-1.5 pr-6">
        <Mode className="size-3 text-[var(--sb-sea)]" />
        {facts.mode === "train" ? "Train leg" : "Flight leg"}
      </p>

      <p className="sb-num mt-1.5 flex items-center gap-1.5 text-[15px] font-semibold">
        {origin.code}
        <ArrowRight className="size-3.5 text-[var(--sb-faint)]" />
        {destination.code}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-[var(--sb-dim)]">
        {origin.name} → {destination.name}
      </p>

      <dl className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-1.5 border-t border-[var(--sb-line)] pt-2.5">
        <div>
          <dt className="sb-label text-[9px]">Date</dt>
          <dd className="sb-num mt-0.5 text-[11px] text-[var(--sb-text)]">
            {formatLegDate(facts.date)}
          </dd>
        </div>
        <div>
          <dt className="sb-label text-[9px]">Duration</dt>
          <dd className="sb-num mt-0.5 text-[11px] text-[var(--sb-text)]">
            {formatDuration(duration)}
            {fare.stops !== null && (
              <span className="ml-1 text-[var(--sb-faint)]">
                {fare.stops === 0 ? "direct" : `${fare.stops} stop`}
              </span>
            )}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="sb-label text-[9px]">Carrier</dt>
          <dd className="mt-0.5 truncate text-[11px] text-[var(--sb-text)]">
            {loading ? (
              <span className="text-[var(--sb-faint)]">…</span>
            ) : (
              fare.carrier
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-2.5 flex items-end justify-between gap-2 border-t border-[var(--sb-line)] pt-2.5">
        <div className="min-w-0">
          <p className="sb-label text-[9px]">Per couple</p>
          <p
            className={cn(
              "sb-num mt-0.5 text-[19px] leading-none font-semibold tracking-tight",
              loading && "animate-pulse text-[var(--sb-faint)] motion-reduce:animate-none",
            )}
          >
            {formatEur(fare.totalEur)}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold tracking-[0.08em] uppercase"
          style={{
            background: `color-mix(in srgb, var(${SOURCE_TOKEN[fare.source]}) 18%, transparent)`,
            color: `var(${SOURCE_TOKEN[fare.source]})`,
          }}
        >
          {loading ? "checking…" : FARE_SOURCE_LABEL[fare.source]}
        </span>
      </div>

      <p className="mt-1.5 text-[9.5px] leading-snug text-[var(--sb-faint)]">
        {fare.source === "estimate"
          ? "Demo Plan figure — this pair is not in the fare grid."
          : fare.fetchedAt
            ? `Cheapest one-way for two, ${formatFetchedAt(fare.fetchedAt)}.`
            : "Cheapest one-way for two."}
      </p>
    </div>
  );
}
