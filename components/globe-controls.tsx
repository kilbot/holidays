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
        "flex size-12 cursor-pointer items-center justify-center text-[var(--sb-dim)]",
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
    // Centred on the globe the traveller can actually see, not on the stage:
    // the bottom of the stage is the date strip, and half of it again is an
    // opened week. Riding the strip's live height keeps the stack off the share
    // pill and off the week panel at every breakpoint (#56).
    <div className="pointer-events-auto absolute top-[calc(50%-var(--sb-strip-h)/2)] right-3 z-20 flex -translate-y-1/2 flex-col gap-2">
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
