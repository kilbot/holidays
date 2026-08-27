"use client";

import { useState } from "react";
import { ChevronLeft, Layers, X } from "lucide-react";

import { CatalogSift } from "@/components/catalog-sift";
import { CATALOG } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/**
 * Where the Catalog lives: a docked rail on desktop, an overlay on a phone.
 *
 * The shell only — the sift itself is `CatalogSift`, mounted once per
 * breakpoint. Two mounts means two independent sifts, which is fine: only one
 * is ever on screen, and the shortlist marks they both write are shared
 * through localStorage.
 */
export function CatalogDrawer() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* ---- Desktop: docked, collapsible rail ---- */}
      <aside
        className={cn(
          "pointer-events-auto absolute top-4 bottom-[168px] left-4 z-20 hidden lg:flex",
          collapsed ? "w-11" : "w-[318px]",
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="sb-panel flex w-full cursor-pointer flex-col items-center gap-3 py-3 transition-colors hover:bg-[var(--sb-panel-2)]"
            aria-label="Expand the catalog"
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
          <div className="sb-panel relative flex w-full flex-col p-3.5">
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse the catalog"
              className="absolute top-3 right-3 z-10 cursor-pointer rounded-md p-1 text-[var(--sb-faint)] transition-colors hover:bg-[var(--sb-panel-2)] hover:text-[var(--sb-text)]"
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
        className="sb-panel pointer-events-auto absolute bottom-[150px] left-4 z-20 flex cursor-pointer items-center gap-2 px-3 py-2 lg:hidden"
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
