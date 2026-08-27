"use client";

/**
 * The site's four sections, as a rail and as a tab bar.
 *
 * Two renderings of one list, because the two form factors want opposite
 * things. On a desktop the globe is the point, so navigation is a 56px column
 * of icons down the left edge with the names held back until a pointer or the
 * keyboard asks for them — the same progressive-disclosure bargain the cost HUD
 * and the share pill strike. On a phone there is no hover to ask with, and a
 * hidden label is just an unlabelled button, so the bottom bar shows the names
 * outright.
 *
 * The icons are inline SVG rather than an icon set: four glyphs is not worth a
 * dependency, and drawing them here means the Capsule and Ledger marks can say
 * what those words mean in *this* site rather than borrowing whatever a generic
 * set calls closest.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";

import { cn } from "@/lib/utils";

type IconProps = SVGProps<SVGSVGElement>;

/** Shared geometry, so the four marks sit on one optical grid. */
function Glyph({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Plan — the globe, which is literally what the page is. */
function PlanIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5a13 13 0 0 1 0 17a13 13 0 0 1 0-17Z" />
    </Glyph>
  );
}

/** Capsules — two stacked pills: blocks of trip that toggle on and off. */
function CapsulesIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3.5" y="4.5" width="17" height="6" rx="3" />
      <rect x="3.5" y="13.5" width="11" height="6" rx="3" />
    </Glyph>
  );
}

/** Ledger — a page of priced day lines, long, long, short. */
function LedgerIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
      <path d="M8 8.5h8M8 12h8M8 15.5h4.5" />
    </Glyph>
  );
}

/** Budget — a gauge, because the Budget is a ceiling to read against. */
function BudgetIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3.5 17a8.5 8.5 0 1 1 17 0" />
      <path d="M12 17l4.2-4.6" />
      <circle cx="12" cy="17" r="1.2" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

type NavItem = {
  href: "/" | "/capsules" | "/ledger" | "/budget";
  label: string;
  /** Said to a screen reader, and to anyone who hovers long enough. */
  hint: string;
  Icon: ComponentType<IconProps>;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Plan", hint: "The globe and the current itinerary", Icon: PlanIcon },
  {
    href: "/capsules",
    label: "Capsules",
    hint: "Browse and sift the catalog",
    Icon: CapsulesIcon,
  },
  { href: "/ledger", label: "Ledger", hint: "Day-by-day costs", Icon: LedgerIcon },
  { href: "/budget", label: "Budget", hint: "Spend against the ceiling", Icon: BudgetIcon },
];

/**
 * `/` is only current when it is exactly `/` — every other section owns its
 * subtree, so a future `/capsules/rottnest` still lights Capsules.
 */
function isCurrent(pathname: string, href: NavItem["href"]): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/* ------------------------------------------------------------------ */
/* Desktop rail                                                        */
/* ------------------------------------------------------------------ */

export function AppRail() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections"
      className="relative z-40 hidden w-14 shrink-0 flex-col items-center gap-1 border-r border-[var(--sb-line)] bg-[var(--sb-panel)] py-3 lg:flex"
    >
      {NAV_ITEMS.map(({ href, label, hint, Icon }) => {
        const current = isCurrent(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={`${label} — ${hint}`}
            aria-current={current ? "page" : undefined}
            className={cn(
              "group relative flex size-11 items-center justify-center rounded-xl transition-colors motion-reduce:transition-none",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sb-accent)]",
              current
                ? "bg-[color-mix(in_srgb,var(--sb-accent)_16%,transparent)] text-[var(--sb-accent)]"
                : "text-[var(--sb-dim)] hover:bg-[var(--sb-panel-2)] hover:text-[var(--sb-text)]",
            )}
          >
            <Icon className="size-5" />

            {/* The active mark is a bar on the rail's own edge rather than a
                border on the button: it reads as "you are here on this rail",
                and it survives the hover tint. */}
            {current && (
              <span
                aria-hidden
                className="absolute top-1/2 -left-1.5 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--sb-accent)]"
              />
            )}

            {/* The label, held back until a pointer or the keyboard asks for
                it. `aria-hidden` because the link already carries both words as
                its accessible name; `pointer-events-none` so it can never eat a
                click meant for the globe behind it. */}
            <span
              aria-hidden
              className="sb-panel pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap px-2.5 py-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
            >
              <span className="block text-[11.5px] font-semibold text-[var(--sb-text)]">
                {label}
              </span>
              <span className="block text-[10px] text-[var(--sb-dim)]">{hint}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile tab bar                                                      */
/* ------------------------------------------------------------------ */

export function AppTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections"
      className="relative z-40 flex shrink-0 border-t border-[var(--sb-line)] bg-[var(--sb-panel)] pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const current = isCurrent(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-[3px] transition-colors motion-reduce:transition-none",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--sb-accent)]",
              current
                ? "text-[var(--sb-accent)]"
                : "text-[var(--sb-dim)] active:text-[var(--sb-text)]",
            )}
          >
            <Icon className="size-5" />
            <span className="text-[10px] font-semibold tracking-[0.02em]">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
