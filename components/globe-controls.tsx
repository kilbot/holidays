"use client";

import type { ReactNode } from "react";
import { Frame, Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The globe's own chrome: zoom, and frame-the-route.
 *
 * Hand-rolled rather than Mapbox's `NavigationControl`, whose buttons are 29px
 * — well under the 44px a thumb needs and the site holds itself to elsewhere
 * (the trip rail's handles are 44px for the same reason). These are 48px since
 * #56, because zoom is now the main thing anyone does to this map and the pair
 * should be the easiest target on the stage.
 *
 * There is no compass any more. It existed to undo drag-rotation, and #56 took
 * drag-rotation away instead: north is up, always, so a button that puts it
 * back is chrome with nothing left to do. Frame-the-route stays — that is the
 * other half of getting lost, and the only one still reachable.
 *
 * The buttons themselves are the *deliberate* path. The effortless one is the
 * gesture: plain scroll wheel, pinch, or double-click, none of which need a
 * modifier key. See `components/globe-stage.tsx`.
 */

function ControlButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-11 cursor-pointer items-center justify-center text-[var(--sb-dim)] lg:size-12",
        "transition-colors hover:bg-[var(--sb-panel-2)] hover:text-[var(--sb-text)]",
        "focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px]",
        "focus-visible:outline-[var(--sb-accent)] motion-reduce:transition-none",
        "first:rounded-t-[var(--radius-xl)] last:rounded-b-[var(--radius-xl)]",
      )}
    >
      {children}
    </button>
  );
}

export interface GlobeControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFrameRoute: () => void;
}

export function GlobeControls({
  onZoomIn,
  onZoomOut,
  onFrameRoute,
}: GlobeControlsProps) {
  return (
    <div
      className={cn(
        "pointer-events-auto absolute z-20 flex flex-col gap-1.5 lg:gap-2",
        // On a phone the right-hand column belongs to the cost HUD, which
        // spans most of the width at the top, so the stack takes the free
        // top-left corner. From `lg` it rejoins the right-hand column and
        // rides the share pill: the strip publishes its live height, the pill
        // clears the strip and Mapbox's chrome, and this clears the pill. One
        // chain, so an opened week slides the whole column up together
        // instead of burying it (#56). Not centred on the stage — with a week
        // open the middle of the stage is the middle of the date strip.
        "top-4 left-3",
        "lg:right-3 lg:bottom-[calc(var(--sb-pill-bottom)+3rem)] lg:left-auto lg:top-auto",
      )}
    >
      {/* Two panels, not three buttons in one: zooming is continuous and
          framing is a jump, and the gap says so without a caption. */}
      <div className="sb-panel flex flex-col divide-y divide-[var(--sb-line)] overflow-hidden">
        <ControlButton onClick={onZoomIn} label="Zoom in">
          <Plus className="size-5" />
        </ControlButton>
        <ControlButton onClick={onZoomOut} label="Zoom out">
          <Minus className="size-5" />
        </ControlButton>
      </div>
      <div className="sb-panel overflow-hidden">
        <ControlButton onClick={onFrameRoute} label="Frame the whole route">
          <Frame className="size-4" />
        </ControlButton>
      </div>
    </div>
  );
}
