"use client";

import { useState } from "react";
import { ChevronDown, MapPin, Star } from "lucide-react";

import { CapsuleArt } from "@/components/capsule-art";
import { openDeepCapsule } from "@/lib/capsule-focus";
import {
  DEEP_CAPSULES,
  capsuleState,
  formatCapsuleDays,
  formatEur,
} from "@/lib/deep-capsules";
import { useShortlist } from "@/lib/shortlist";
import { cn } from "@/lib/utils";

/**
 * The researched Capsules, above the Catalog.
 *
 * These eight are a different kind of thing to the 413 below them and they
 * should not be sifted alongside them: they have itineraries, operator prices
 * and booking deadlines, and every one is already the answer to a question the
 * sift is still asking. So they sit above the search box as a strip of covers,
 * in trip order, and the search never touches them.
 *
 * It collapses because the strip costs about 90px of a column that also has to
 * hold ten filters and a list. Since #36 it is collapsed by *default*: the
 * eight researched Capsules are also always-on markers on the globe now, so
 * the discovery the open-by-default strip was paying for happens on the map
 * instead, and the column gets its 90px back for the list.
 */
export function DeepCapsuleStrip() {
  const [open, setOpen] = useState(false);
  const { marks } = useShortlist();

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-1 text-left"
      >
        <span className="sb-label">Researched</span>
        <span className="sb-num text-[10px] text-[var(--sb-faint)]">
          {DEEP_CAPSULES.length}
        </span>
        <ChevronDown
          className={cn(
            "size-3 text-[var(--sb-faint)] transition-transform",
            !open && "-rotate-90",
          )}
        />
      </button>

      {open && (
        <ul className="sb-scroll mt-1.5 flex gap-1.5 overflow-x-auto pb-1 [mask-image:linear-gradient(to_right,black_calc(100%-20px),transparent)]">
          {DEEP_CAPSULES.map((capsule) => {
            const mark = marks[capsule.id];
            return (
              <li key={capsule.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => openDeepCapsule(capsule.id)}
                  aria-haspopup="dialog"
                  title={capsule.tagline}
                  className={cn(
                    "flex w-[124px] cursor-pointer flex-col overflow-hidden rounded-lg border text-left transition-colors",
                    mark === "placed"
                      ? "border-[color-mix(in_srgb,var(--sb-good)_55%,transparent)]"
                      : mark === "interested"
                        ? "border-[color-mix(in_srgb,var(--sb-accent)_55%,transparent)]"
                        : "border-[var(--sb-line)] hover:border-[color-mix(in_srgb,var(--sb-dim)_50%,transparent)]",
                  )}
                >
                  <div className="relative h-[46px] w-full">
                    <CapsuleArt
                      seed={capsule.id}
                      state={capsuleState(capsule)}
                      tags={capsule.tags}
                      facets={capsule.facets}
                      variant="thumb"
                      className="size-full"
                    />
                    {mark === "interested" && (
                      <Star className="absolute top-1.5 right-1.5 size-3 fill-[var(--sb-accent)] text-[var(--sb-accent)]" />
                    )}
                    {mark === "placed" && (
                      <MapPin className="absolute top-1.5 right-1.5 size-3 fill-[var(--sb-good)] text-[var(--sb-good)]" />
                    )}
                  </div>
                  <div className="bg-[color-mix(in_srgb,var(--sb-panel-2)_70%,transparent)] px-1.5 py-1">
                    <p className="line-clamp-2 min-h-[24px] text-[10px] leading-tight font-semibold">
                      {capsule.name}
                    </p>
                    <p className="sb-num mt-0.5 flex items-baseline justify-between gap-1 text-[9px] text-[var(--sb-faint)]">
                      <span>{formatCapsuleDays(capsule)}</span>
                      <span className="font-medium text-[var(--sb-dim)]">
                        {formatEur(capsule.cost.ideal.eur)}
                      </span>
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
