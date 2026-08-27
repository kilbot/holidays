"use client";

/**
 * The site's sections, as a rail and as a tab bar: every one of them, in the
 * open, on both form factors.
 *
 * There used to be a ⋯ overflow holding Resources back, on the theory that
 * five icons is a rail you read at a glance and six is a list you scan. It
 * bought nothing. The rail had room — six 44px icons is a third of a laptop's
 * height — and the phone's bar divides into six as evenly as it divided into
 * five. What the overflow did buy was a menu: open state, a dismiss scrim, a
 * second list to keep in step with the first, and a click-through bug that
 * outlived two attempts to fix it. A destination you cannot see is a
 * destination nobody visits, and none of that machinery was earning its place
 * on a six-item nav. One flat list, one source of truth.
 *
 * Two renderings of that list, because the two form factors want opposite
 * things. On a desktop the globe is the point, so navigation is a 56px column
 * of icons down the left edge with the names held back until a pointer or the
 * keyboard asks for them — the same progressive-disclosure bargain the cost HUD
 * and the share pill strike. On a phone there is no hover to ask with, and a
 * hidden label is just an unlabelled button, so the bottom bar shows the names
 * outright.
 *
 * The icons are inline SVG rather than an icon set: a handful of glyphs is not
 * worth a dependency, and drawing them here means the Adventure and Ledger
 * marks can say what those words mean in *this* site rather than borrowing
 * whatever a generic set calls closest.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ComponentType, type SVGProps } from "react";

import { cn } from "@/lib/utils";

type IconProps = SVGProps<SVGSVGElement>;

/** Shared geometry, so the six marks sit on one optical grid. */
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

/**
 * Flights — a plane in plan view, banking east.
 *
 * Drawn rather than borrowed for the same reason as the others: an icon set's
 * plane is a departure board's plane, and this section is not a departure
 * board. It is the one page where the site argues about *which* aeroplane, so
 * the mark is a wing with a body, at the same 1.75 stroke as the rest.
 */
function FlightsIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M10.5 3.2a1.5 1.5 0 0 1 3 0V9l7 4.1v2.3l-7-2.1v3.9l2.2 1.7v1.6L12 19.8l-3.7 1.7v-1.6l2.2-1.7v-3.9l-7 2.1v-2.3l7-4.1Z" />
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

/** Resources — a bookmark ribbon: the things kept so they are not lost. */
function ResourcesIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M6.5 3.5h11a1 1 0 0 1 1 1v15.9l-6.5-4.1-6.5 4.1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M9.5 8.5h5" />
    </Glyph>
  );
}

/**
 * Scenarios — one track splitting into two, with a dot on each end.
 *
 * The section is alternate calendars of the same trip, so the mark is a
 * divergence rather than a stack of documents: the same journey, two ways it
 * could go. Drawn at the shared 1.75 stroke, with the ends filled so the two
 * outcomes read as destinations rather than as loose lines.
 */
function ScenariosIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5.6 12h4.1c1.1 0 1.8-.5 2.4-1.3l1.5-2.1c.6-.8 1.3-1.3 2.4-1.3h1.6" />
      <path d="M5.6 12h4.1c1.1 0 1.8.5 2.4 1.3l1.5 2.1c.6.8 1.3 1.3 2.4 1.3h1.6" />
      <circle cx="4.2" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19.2" cy="7.3" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19.2" cy="16.7" r="1.5" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

type NavItem = {
  href:
    | "/"
    | "/adventures"
    | "/flights"
    | "/ledger"
    | "/budget"
    | "/scenarios"
    | "/resources";
  label: string;
  /** Said to a screen reader, and to anyone who hovers long enough. */
  hint: string;
  Icon: ComponentType<IconProps>;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Plan", hint: "The globe and the current itinerary", Icon: PlanIcon },
  {
    href: "/adventures",
    label: "Adventures",
    hint: "Browse and sift the catalog",
    Icon: CapsulesIcon,
  },
  {
    href: "/flights",
    label: "Flights",
    hint: "Multi-origin search, comfort-first",
    Icon: FlightsIcon,
  },
  { href: "/ledger", label: "Ledger", hint: "Day-by-day costs", Icon: LedgerIcon },
  { href: "/budget", label: "Budget", hint: "Spend against the ceiling", Icon: BudgetIcon },
  {
    href: "/scenarios",
    label: "Scenarios",
    hint: "Saved alternate trips — compare and switch",
    Icon: ScenariosIcon,
  },
  {
    href: "/resources",
    label: "Resources",
    hint: "Boards, deadlines, documents, forecasts",
    Icon: ResourcesIcon,
  },
];

/**
 * `/` is only current when it is exactly `/` — every other section owns its
 * subtree, so a future `/adventures/rottnest` still lights Adventures.
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
      className="relative z-40 hidden w-14 shrink-0 flex-col items-center gap-1 border-r border-[var(--sb-line)] bg-[var(--sb-panel)] py-3 lg:flex print:hidden"
    >
      {NAV_ITEMS.map(({ href, label, hint, Icon }) => {
        const current = isCurrent(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            // The visible glyph says nothing to a screen reader, so the link
            // carries both words itself — name and hint, the same pair the
            // hover label shows.
            aria-label={`${label} — ${hint}`}
            aria-current={current ? "page" : undefined}
            className={cn(
              "group relative z-40 flex size-11 items-center justify-center rounded-xl transition-colors motion-reduce:transition-none",
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
                its accessible name.

                Pointer events follow the opacity. At rest it is invisible glass
                lying across the globe, so it must not eat a click meant for the
                map; while it is showing it is part of the link it belongs to,
                and a click on the words should go where the words say. It is a
                child of the `<a>`, so letting it take the pointer *is* the
                navigation — nothing here handles the click itself. */}
            <span
              aria-hidden
              className="sb-panel pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap px-2.5 py-1.5 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-visible:pointer-events-auto group-focus-visible:opacity-100 motion-reduce:transition-none"
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
      className="relative z-40 flex shrink-0 border-t border-[var(--sb-line)] bg-[var(--sb-panel)] pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
    >
      {NAV_ITEMS.map(({ href, label, hint, Icon }) => {
        const current = isCurrent(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            // The word under the icon is already the name; the hint is the
            // part a phone has no room to print, and naming the link with
            // both hands it to a screen reader anyway. The visible label
            // opens the string, so speaking it still matches what is read.
            aria-label={`${label} — ${hint}`}
            aria-current={current ? "page" : undefined}
            className={cn(
              "relative z-40 flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-[3px] px-0.5 transition-colors motion-reduce:transition-none",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--sb-accent)]",
              current
                ? "text-[var(--sb-accent)]"
                : "text-[var(--sb-dim)] active:text-[var(--sb-text)]",
            )}
          >
            <Icon className="size-5 shrink-0" />
            {/* Six names across a 375px phone leaves ~62px a column, and
                "Adventures" is the one that has to be measured rather than
                assumed. It fits at 10px; the tracking comes off below 400px
                so the narrowest phones still set it on one line rather than
                truncating a destination's name. */}
            <span className="text-[10px] leading-none font-semibold tracking-[0.02em] max-[400px]:tracking-normal">
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
