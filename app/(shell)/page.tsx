import { CapsuleCardHost } from "@/components/capsule-card";
import { CostHud } from "@/components/cost-hud";
import { DateStrip } from "@/components/date-strip";
import { GlobeStage } from "@/components/globe-stage";
import { ShortlistRail } from "@/components/shortlist-rail";

/**
 * The Plan — the Globe stage (layout variant A, picked in #9).
 *
 * The globe owns the whole stage; everything else floats over it as glass
 * chrome. Since #39 the stage is the shell's content box rather than the whole
 * viewport, so the chrome's corners clear the icon rail and the mobile tab bar.
 */
export default function Plan() {
  return (
    <main className="relative h-full w-full overflow-hidden">
      <GlobeStage />

      <ShortlistRail />
      <CostHud />
      <DateStrip />

      {/* Mounted once, above everything. The two places that open a Capsule
          on this page — a shortlist row and a marker on the globe — are in
          different subtrees, so the card reads a module-level store rather
          than being handed down as props.

          `overMap` is the one thing the card cannot read from that store:
          what is behind it. Here it is the globe, which flies to whatever the
          card is describing (#75), so the card drops its backdrop on desktop
          and leaves the map live beside it. */}
      <CapsuleCardHost overMap />
    </main>
  );
}
