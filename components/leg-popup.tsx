"use client";

import type { ComponentType } from "react";
import { ArrowRight, Car, Plane, Ship, TrainFront, X } from "lucide-react";

import { formatEur } from "@/lib/engine";
import type { Leg, LegMode } from "@/lib/engine/types";
import { cn } from "@/lib/utils";

/**
 * What a Leg says when you click its arc.
 *
 * Everything here is the **Leg's own line** — the same object the Ledger's
 * transit rows read, priced by `lib/engine/legs.ts` and charged to the Day it
 * is travelled. Nothing on this popup is fetched, computed or estimated
 * separately: a popup with its own pricing path is a second opinion about the
 * money, and two surfaces quoting different fares for the same flight is worse
 * than either of them being wrong on its own.
 *
 * The live fare still lands here, by the only route it has ever taken —
 * `usePlan` hydrates the Legs the fares grid covers and the Plan re-derives, so
 * this reads a Leg whose `hydrated` flag is already true.
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

const MODE_ICON: Record<LegMode, ComponentType<{ className?: string }>> = {
  flight: Plane,
  drive: Car,
  train: TrainFront,
  ferry: Ship,
};

const MODE_LABEL: Record<LegMode, string> = {
  flight: "Flight leg",
  drive: "Drive leg",
  train: "Train leg",
  ferry: "Ferry leg",
};

/**
 * Where the fare is quoted from, in the two words a badge has space for.
 *
 * The same vocabulary the Ledger's transit rows use, deliberately: one Leg,
 * one claim about its money, wherever it is read.
 */
const PRICING_LABEL: Record<Leg["pricing"], string> = {
  grid: "fare snapshot",
  snapshot: "fare snapshot",
  band: "estimate",
  computed: "fuel only",
};

const PRICING_TOKEN: Record<Leg["pricing"], string> = {
  grid: "--sb-sea",
  snapshot: "--sb-sea",
  band: "--sb-faint",
  computed: "--sb-faint",
};

export function LegPopup({
  leg,
  fromName,
  toName,
  /** Why this arc is drawn straight, when it is. Null on a placed pair. */
  approximateNote,
  onClose,
}: {
  leg: Leg;
  fromName: string;
  toName: string;
  approximateNote?: string | null;
  onClose: () => void;
}) {
  const Mode = MODE_ICON[leg.mode];
  const banded = leg.bandEur[0] !== leg.bandEur[1];
  const free = leg.eur === 0;

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
        {MODE_LABEL[leg.mode]}
        {leg.modeOverridden && (
          <span className="text-[var(--sb-faint)] normal-case">· your call</span>
        )}
      </p>

      <p className="sb-num mt-1.5 flex items-center gap-1.5 text-[15px] font-semibold">
        {leg.from}
        <ArrowRight className="size-3.5 text-[var(--sb-faint)]" />
        {leg.to}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-[var(--sb-dim)]">
        {fromName} → {toName}
      </p>

      <dl className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-1.5 border-t border-[var(--sb-line)] pt-2.5">
        <div>
          <dt className="sb-label text-[9px]">Date</dt>
          <dd className="sb-num mt-0.5 text-[11px] text-[var(--sb-text)]">
            {formatLegDate(leg.date)}
          </dd>
        </div>
        <div>
          <dt className="sb-label text-[9px]">Band</dt>
          <dd className="sb-num mt-0.5 text-[11px] text-[var(--sb-text)]">
            {banded
              ? `${formatEur(leg.bandEur[0])}–${formatEur(leg.bandEur[1])}`
              : "—"}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="sb-label text-[9px]">Carrier</dt>
          <dd className="mt-0.5 truncate text-[11px] text-[var(--sb-text)]">
            {leg.carrier ?? (
              <span className="text-[var(--sb-faint)]">Not booked</span>
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
              free && "text-[var(--sb-faint)]",
            )}
          >
            {formatEur(leg.eur)}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold tracking-[0.08em] uppercase"
          style={{
            background: `color-mix(in srgb, var(${leg.hydrated ? "--sb-good" : PRICING_TOKEN[leg.pricing]}) 18%, transparent)`,
            color: `var(${leg.hydrated ? "--sb-good" : PRICING_TOKEN[leg.pricing]})`,
          }}
        >
          {leg.hydrated ? "live fare" : PRICING_LABEL[leg.pricing]}
        </span>
      </div>

      <p className="mt-1.5 line-clamp-4 text-[9.5px] leading-snug text-[var(--sb-faint)]">
        {approximateNote ?? leg.note}
      </p>
    </div>
  );
}
