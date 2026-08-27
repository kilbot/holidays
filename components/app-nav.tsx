"use client";

/**
 * The site's sections, as a rail and as a tab bar: five in the open, the rest
 * behind a ⋯.
 *
 * Two renderings of one list, because the two form factors want opposite
 * things. On a desktop the globe is the point, so navigation is a 56px column
 * of icons down the left edge with the names held back until a pointer or the
 * keyboard asks for them — the same progressive-disclosure bargain the cost HUD
 * and the share pill strike. On a phone there is no hover to ask with, and a
 * hidden label is just an unlabelled button, so the bottom bar shows the names
 * outright.
 *
 * The icons are inline SVG rather than an icon set: a handful of glyphs is not
 * worth a dependency, and drawing them here means the Capsule and Ledger marks
 * can say what those words mean in *this* site rather than borrowing whatever a
 * generic set calls closest.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";

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

/** More — the overflow itself, drawn as the ellipsis it is. */
function MoreIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="5.2" cy="12" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="18.8" cy="12" r="1.35" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

type NavItem = {
  href: "/" | "/adventures" | "/flights" | "/ledger" | "/budget" | "/resources";
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
];

/**
 * The sections that live behind the ⋯, and why there is a ⋯ at all.
 *
 * Five icons is a rail you read at a glance; six is a list you scan. Resources
 * is also the one section nobody navigates to *while planning* — it is a shelf
 * you visit deliberately, once, to set a waitlist or check a deadline, not a
 * view you flick between. That asymmetry is exactly what an overflow is for:
 * the five things worth a permanent slot keep theirs, and the shelf costs one
 * extra click instead of a sixth of the rail's attention.
 *
 * Both form factors share this list, so the phone never grows a section the
 * desktop doesn't have.
 */
export const OVERFLOW_ITEMS: readonly NavItem[] = [
  {
    href: "/resources",
    label: "Resources",
    hint: "Boards, deadlines, documents, forecasts",
    Icon: ResourcesIcon,
  },
];

/**
 * `/` is only current when it is exactly `/` — every other section owns its
 * subtree, so a future `/capsules/rottnest` still lights Capsules.
 */
function isCurrent(pathname: string, href: NavItem["href"]): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * Open/closed for the overflow, with the two things a menu owes its reader:
 * Escape closes it, and arriving somewhere closes it.
 *
 * The state is *which page the menu is open on* rather than a boolean, which is
 * what makes the second promise free. Navigation inside the shell is a soft
 * one — the rail is never remounted — so a boolean would leave the menu hanging
 * open over the page it just took you to, and closing it would need an effect
 * that fires a second render for every navigation. Comparing against the live
 * pathname closes it during the render that navigated.
 */
function useOverflowMenu(pathname: string) {
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenOn(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return {
    open,
    toggle: () => setOpenOn((current) => (current === pathname ? null : pathname)),
    close: () => setOpenOn(null),
  };
}

/**
 * The click-anywhere-else target.
 *
 * A transparent full-viewport button rather than a document listener: it can't
 * race the toggle's own click, and it puts the dismiss affordance in the tree
 * where the menu is. Hidden from assistive tech, which has Escape and the
 * toggle's `aria-expanded` instead.
 */
function Scrim({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-hidden
      tabIndex={-1}
      onClick={onClose}
      // Below the section links deliberately. It used to sit at the same layer
      // as the rest of the nav and, being later in the DOM, painted over every
      // icon in it: with the menu open, a click on Flights hit the scrim and
      // the page did not change. A dismiss target should catch the *page*, not
      // the navigation it is attached to.
      className="fixed inset-0 z-30 cursor-default"
    />
  );
}

/** One row inside an open overflow panel. */
function OverflowLink({
  item,
  current,
}: {
  item: NavItem;
  current: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors motion-reduce:transition-none",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--sb-accent)]",
        current
          ? "bg-[color-mix(in_srgb,var(--sb-accent)_16%,transparent)] text-[var(--sb-accent)]"
          : "text-[var(--sb-text)] hover:bg-[var(--sb-panel-2)]",
      )}
    >
      <item.Icon className="size-4 shrink-0" />
      <span className="min-w-0">
        <span className="block text-[12px] font-semibold">{item.label}</span>
        <span className="block text-[10.5px] leading-tight text-[var(--sb-dim)]">
          {item.hint}
        </span>
      </span>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop rail                                                        */
/* ------------------------------------------------------------------ */

export function AppRail() {
  const pathname = usePathname();
  const { open, toggle, close } = useOverflowMenu(pathname);
  const inOverflow = OVERFLOW_ITEMS.some((item) => isCurrent(pathname, item.href));

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
            aria-label={`${label} — ${hint}`}
            aria-current={current ? "page" : undefined}
            // Clicking a section closes the overflow as well as navigating —
            // including on the page you are already on, where there is no
            // pathname change for `useOverflowMenu` to notice.
            onClick={close}
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

      {/* ---- The overflow ---- */}
      {open && <Scrim onClose={close} />}

      <div className="relative z-50 mt-1">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="More sections"
          className={cn(
            "flex size-11 cursor-pointer items-center justify-center rounded-xl transition-colors motion-reduce:transition-none",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sb-accent)]",
            // The ⋯ carries the active mark on behalf of whatever is behind
            // it, so the rail never goes dark on a page you are looking at.
            inOverflow
              ? "bg-[color-mix(in_srgb,var(--sb-accent)_16%,transparent)] text-[var(--sb-accent)]"
              : "text-[var(--sb-dim)] hover:bg-[var(--sb-panel-2)] hover:text-[var(--sb-text)]",
          )}
        >
          <MoreIcon className="size-5" />
          {inOverflow && (
            <span
              aria-hidden
              className="absolute top-1/2 -left-1.5 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--sb-accent)]"
            />
          )}
        </button>

        {open && (
          <div className="sb-panel absolute bottom-0 left-full ml-2 w-[248px] p-1.5">
            {OVERFLOW_ITEMS.map((item) => (
              <OverflowLink
                key={item.href}
                item={item}
                current={isCurrent(pathname, item.href)}
              />
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile tab bar                                                      */
/* ------------------------------------------------------------------ */

export function AppTabBar() {
  const pathname = usePathname();
  const { open, toggle, close } = useOverflowMenu(pathname);
  const inOverflow = OVERFLOW_ITEMS.some((item) => isCurrent(pathname, item.href));

  return (
    <nav
      aria-label="Sections"
      className="relative z-40 flex shrink-0 border-t border-[var(--sb-line)] bg-[var(--sb-panel)] pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
    >
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const current = isCurrent(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            onClick={close}
            className={cn(
              "relative z-40 flex min-h-14 flex-1 flex-col items-center justify-center gap-[3px] transition-colors motion-reduce:transition-none",
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

      {/* ---- The same overflow, opening upwards ---- */}
      {open && <Scrim onClose={close} />}

      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "z-50 flex min-h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-[3px] transition-colors motion-reduce:transition-none",
          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--sb-accent)]",
          inOverflow || open
            ? "text-[var(--sb-accent)]"
            : "text-[var(--sb-dim)] active:text-[var(--sb-text)]",
        )}
      >
        <MoreIcon className="size-5" />
        <span className="text-[10px] font-semibold tracking-[0.02em]">More</span>
      </button>

      {open && (
        <div className="sb-panel absolute right-2 bottom-[calc(100%+8px)] z-50 w-[248px] p-1.5">
          {OVERFLOW_ITEMS.map((item) => (
            <OverflowLink
              key={item.href}
              item={item}
              current={isCurrent(pathname, item.href)}
            />
          ))}
        </div>
      )}
    </nav>
  );
}
