"use client";

/**
 * The box every page is drawn in, and the one piece of chrome that outlives
 * them all.
 *
 * It exists for two reasons. First, it is the positioned ancestor: the Plan
 * page's chrome — catalog rail, cost HUD, date strip — pins itself to the
 * viewport corners with `absolute`, and this is the element those corners now
 * mean, so the rail and the tab bar inset the whole stage rather than being
 * covered by it. Second, the share pill is plan-level and per ADR 0001 says
 * which link *this tab* holds, which is true on every page, so it lives here
 * rather than in any one of them.
 *
 * `--sb-strip-h` is the resting height of the date strip, and three pieces of
 * chrome (including the share pill) clear it. Off the Plan page there is no
 * strip to clear, so the offsets are flattened here rather than each reader
 * learning about routes.
 */

import { usePathname } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

import { PreviewNotice } from "@/components/preview-notice";
import { ShareBar } from "@/components/share-bar";

/**
 * Off the Plan page there is no strip, so there is nothing for the pill line to
 * clear — and zeroing the strip alone does not move it (#94).
 *
 * `--sb-pill-bottom` is declared on `:root`, and a custom property's `var()`
 * references are substituted where the property is *declared*, not where it is
 * read. So zeroing `--sb-strip-h` here — on a descendant — never reached the
 * arithmetic: the pill kept the Plan page's offset and parked ~320px above the
 * bottom of the reading column on every other page, across the middle of the
 * Ledger's day rows, the Budget's burn-down caption and the Flights watchlist.
 *
 * Both have to be set, then. The strip height because chrome still reads it,
 * and the offset because it is already resolved by the time it gets here.
 */
const NO_STRIP = {
  "--sb-strip-h": "0px",
  "--sb-pill-bottom": "1rem",
} as CSSProperties;

export function ShellStage({ children }: { children: ReactNode }) {
  const onPlan = usePathname() === "/";

  return (
    <div
      className="relative min-h-0 min-w-0 flex-1 print:min-h-0 print:overflow-visible"
      style={onPlan ? undefined : NO_STRIP}
    >
      {children}
      {/* Both are plan-level and true on every page: a visitor can rearrange
          the trip from the Capsules grid just as easily as from the globe, so
          the notice that says their changes are not being saved has to be able
          to reach them there. */}
      <PreviewNotice />
      <ShareBar />
    </div>
  );
}
