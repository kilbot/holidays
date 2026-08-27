"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Layers, X } from "lucide-react";

import { CatalogSift } from "@/components/catalog-sift";
import { CATALOG } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/**
 * Where the Catalog lives: a docked rail on a wide screen, a slide-out
 * everywhere else.
 *
 * The shell only — the sift itself is `CatalogSift`, mounted once per
 * breakpoint. Two mounts means two independent sifts, which is fine: only one
 * is ever on screen, and the shortlist marks they both write are shared
 * through localStorage.
 */

/**
 * Above this width the rail is docked open by default.
 *
 * 1280×800 is the benchmark viewport for #36 and it is the narrowest laptop
 * where a 280px rail, a 264px HUD and a globe worth looking at can all coexist.
 * Below it the rail still exists — it just opens on demand, over the globe,
 * rather than eating a fifth of a screen the traveller came to look at a map on.
 */
const DOCK_QUERY = "(min-width: 1280px)";

export function CatalogDrawer() {
  // Server-rendered collapsed, then opened by the effect on a wide viewport:
  // `matchMedia` has no answer during SSR, and collapsed is the safe first
  // paint — it never covers the globe before the real width is known.
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Once the traveller opens or closes the rail themselves it is theirs, and a
  // window resize stops overruling them.
  const chosen = useRef(false);

  useEffect(() => {
    const media = window.matchMedia(DOCK_QUERY);
    const apply = () => {
      if (!chosen.current) setCollapsed(!media.matches);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const choose = (next: boolean) => {
    chosen.current = true;
    setCollapsed(next);
  };

  return (
    <>
      {/* ---- Desktop: docked rail, or the icon tab that opens it ---- */}
      <aside
        className={cn(
          "pointer-events-auto absolute top-4 left-4 z-20 hidden lg:flex",
          collapsed
            ? "w-11"
            : "w-[280px] bottom-[calc(var(--sb-strip-h)+2rem)]",
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={() => choose(false)}
            className="sb-panel flex w-full cursor-pointer flex-col items-center gap-2.5 py-3 transition-colors hover:bg-[var(--sb-panel-2)] motion-reduce:transition-none"
            aria-label="Open the catalog"
          >
            <Layers className="size-4 text-[var(--sb-accent)]" />
            <span
              className="sb-label whitespace-nowrap"
              style={{ writingMode: "vertical-rl" }}
            >
              Catalog · {CATALOG.length}
            </span>
          </button>
        ) : (
          <div className="sb-panel relative flex w-full flex-col p-3">
            <button
              type="button"
              onClick={() => choose(true)}
              aria-label="Collapse the catalog"
              className="absolute top-2.5 right-2.5 z-10 cursor-pointer rounded-md p-1 text-[var(--sb-faint)] transition-colors hover:bg-[var(--sb-panel-2)] hover:text-[var(--sb-text)] motion-reduce:transition-none"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <CatalogSift />
          </div>
        )}
      </aside>

      {/* ---- Mobile: a launcher that opens the drawer over the globe.
             It sits just above the date strip rather than top-left, so the
             cost HUD gets the whole top row and stays readable. ---- */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="sb-panel pointer-events-auto absolute bottom-[calc(var(--sb-strip-h)+1.5rem)] left-4 z-20 flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 lg:hidden"
      >
        <Layers className="size-3.5 text-[var(--sb-accent)]" />
        <span className="sb-label">Catalog</span>
      </button>

      {mobileOpen && (
        <div className="absolute inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close the catalog"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 cursor-default bg-[rgb(7_12_20/0.6)] backdrop-blur-[2px]"
          />
          <div className="sb-panel absolute top-3 right-3 bottom-3 left-3 flex max-w-[340px] flex-col p-3.5">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close the catalog"
              className="absolute top-3 right-3 z-10 cursor-pointer rounded-md p-1 text-[var(--sb-faint)] hover:text-[var(--sb-text)]"
            >
              <X className="size-3.5" />
            </button>
            <CatalogSift />
          </div>
        </div>
      )}
    </>
  );
}
