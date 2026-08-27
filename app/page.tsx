import { CapsuleCardHost } from "@/components/capsule-card";
import { CatalogDrawer } from "@/components/catalog-drawer";
import { CostHud } from "@/components/cost-hud";
import { DateStrip } from "@/components/date-strip";
import { GlobeStage } from "@/components/globe-stage";

/**
 * The Globe stage (layout variant A, picked in #9).
 *
 * The globe owns the whole viewport; everything else floats over it as glass
 * chrome. Nothing is interactive beyond collapsing the panels — this is the
 * shell, with the catalog sift (#26) and the interactive date strip (#27)
 * landing on top of it.
 */
export default function Home() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <GlobeStage />

      {/* Centred over the globe on desktop; on a phone the cost HUD takes the
          top-right, so the wordmark tucks into the free top-left corner.

          It sits on the same glass as the rest of the chrome rather than on a
          text-shadow: since #36 the map is bright and colourful, and bone type
          with a dark glow — which read cleanly over dark-v11 — lands on green
          landcover as often as on ocean. */}
      <header className="pointer-events-none absolute top-5 left-4 z-10 lg:top-4 lg:left-1/2 lg:-translate-x-1/2">
        <h1 className="sb-panel px-3 py-1 font-display text-[15px] font-extrabold tracking-[0.02em] text-[var(--sb-text)]">
          Southbound
        </h1>
      </header>

      <CatalogDrawer />
      <CostHud />
      <DateStrip />

      {/* Mounted once, above everything. The three places that open a Capsule
          — a Catalog row, the researched strip, a marker on the globe — are in
          three different subtrees, so the card reads a module-level store
          rather than being handed down as props. */}
      <CapsuleCardHost />
    </main>
  );
}
