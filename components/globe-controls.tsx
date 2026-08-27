"use client";

import type { ReactNode } from "react";
import { Compass, Frame, Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The globe's own chrome: zoom, reset-north, frame-the-route.
 *
 * Hand-rolled rather than Mapbox's `NavigationControl` for two reasons that
 * both come out of #36. Its buttons are 29px, which is well under the 44px a
 * thumb needs and the site holds itself to elsewhere (the trip rail's handles
 * are 44px for the same reason). And its compass is a `<button>` with a
 * background image, so the arrow cannot be told to point north in a way a
 * screen reader can read — here the bearing is in the label, in degrees.
 *
 * Reset-north exists because a globe you can spin is a globe you can get lost
 * on: two drags and north is somewhere off to the left, and nothing on screen
 * says so. Frame-the-route is the other half of the same problem — it puts the
 * camera back on the Plan from wherever the traveller wandered to.
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
        "flex size-11 cursor-pointer items-center justify-center text-[var(--sb-dim)]",
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
  /** Degrees clockwise from north, as the map currently sits. */
  bearing: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetNorth: () => void;
  onFrameRoute: () => void;
}

export function GlobeControls({
  bearing,
  onZoomIn,
  onZoomOut,
  onResetNorth,
  onFrameRoute,
}: GlobeControlsProps) {
  // −0 is a real number in JS and reads as "-0°" once rounded.
  const off = Math.round(bearing) === 0 ? 0 : Math.round(bearing);

  return (
    <div className="pointer-events-auto absolute top-1/2 right-3 z-20 -translate-y-1/2">
      <div className="sb-panel flex flex-col divide-y divide-[var(--sb-line)] overflow-hidden">
        <ControlButton onClick={onZoomIn} label="Zoom in">
          <Plus className="size-4" />
        </ControlButton>
        <ControlButton onClick={onZoomOut} label="Zoom out">
          <Minus className="size-4" />
        </ControlButton>
        <ControlButton
          onClick={onResetNorth}
          label={
            off === 0
              ? "North is up"
              : `Reset north — the globe is turned ${Math.abs(off)}° ${off > 0 ? "clockwise" : "anticlockwise"}`
          }
        >
          <Compass
            className={cn(
              "size-4 transition-transform duration-200 motion-reduce:transition-none",
              off !== 0 && "text-[var(--sb-accent)]",
            )}
            style={{ transform: `rotate(${-bearing}deg)` }}
          />
        </ControlButton>
        <ControlButton onClick={onFrameRoute} label="Frame the whole route">
          <Frame className="size-4" />
        </ControlButton>
      </div>
    </div>
  );
}
