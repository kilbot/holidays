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
 * strip to clear, so the variable is zeroed here rather than each reader
 * learning about routes.
 */

import { usePathname } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

import { ShareBar } from "@/components/share-bar";

const NO_STRIP = { "--sb-strip-h": "0px" } as CSSProperties;

export function ShellStage({ children }: { children: ReactNode }) {
  const onPlan = usePathname() === "/";

  return (
    <div
      className="relative min-h-0 min-w-0 flex-1 print:min-h-0 print:overflow-visible"
      style={onPlan ? undefined : NO_STRIP}
    >
      {children}
      <ShareBar />
    </div>
  );
}
