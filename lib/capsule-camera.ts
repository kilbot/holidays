/**
 * Where the globe should point when a detail card opens.
 *
 * The card and the camera are two different components in two different
 * subtrees — the card is mounted once at the top of the page, the globe owns
 * the stage underneath it — and the only thing they share is the focus store.
 * So the geometry that connects them lives here rather than in either: what
 * *place* a focus stands for, how close to fly, and how much of the viewport
 * the card is about to cover.
 *
 * The reason any of this exists (#75): a plan reads as a list of names to
 * anyone who does not already know Australia. Opening "Port Douglas" and
 * watching the globe travel to the top of Queensland answers "where is that?"
 * in the one register a map is better at than prose.
 */

import type { Coordinates } from "@/lib/airports";
import { airportCoordinates } from "@/lib/airports";
import type { CapsuleFocus } from "@/lib/capsule-focus";
import { catalogIdeaById } from "@/lib/catalog";
import { deepCapsuleById } from "@/lib/deep-capsules";
import {
  DESKTOP_BREAKPOINT_PX,
  FRAME_PADDING,
} from "@/lib/demo-route";

export interface CapsuleLocation {
  /** [longitude, latitude] — where the marker drops. */
  at: Coordinates;
  /** The name the marker labels itself with. */
  name: string;
}

/**
 * The place behind an open card, or null when there isn't one.
 *
 * The two tiers resolve differently and at different resolutions, which is
 * the same split every other geography in this app carries:
 *
 * - A **researched Adventure** knows its own base — the town the itinerary
 *   runs out of, not the airport it flies into.
 * - A **Catalog idea** knows only a `nearest_airport` code, because the sweep
 *   never geocoded. That is genuinely where you would land for it, so it is an
 *   honest dot, just a coarser one.
 *
 * Twelve of the Catalog's 413 entries name no airport at all — "varies",
 * "n/a", the Big Lap and the other ideas that are a route rather than a place.
 * They return null and the card simply opens with the globe left where it was:
 * a flight to a guessed coordinate would be worse than no flight.
 */
export function capsuleLocation(
  focus: CapsuleFocus | null,
): CapsuleLocation | null {
  if (!focus) return null;

  if (focus.kind === "deep") {
    const capsule = deepCapsuleById(focus.id);
    return capsule ? { at: capsule.base, name: capsule.name } : null;
  }

  const idea = catalogIdeaById(focus.id);
  if (!idea) return null;
  const at = airportCoordinates(idea.nearest_airport);
  return at ? { at, name: idea.name } : null;
}

/**
 * How close the flight ends up.
 *
 * State-level rather than street-level. The question the flight answers is
 * "whereabouts in Australia is this?", and at zoom 6 the answer is a town with
 * no country around it — the coastline, the neighbouring capital and the
 * distance between them are the context that makes the place mean something.
 * Zoom 4.5 holds a few hundred kilometres in frame on a desktop stage, which
 * is about one state's worth.
 */
export const FOCUS_ZOOM = 4.5;

/** Long enough to read as travel across a globe, short enough not to wait. */
export const FOCUS_FLIGHT_MS = 2200;

/**
 * Width of the desktop slide-over, in px.
 *
 * Single source of truth: `capsule-card.tsx` publishes this number as the
 * `--sb-card-w` custom property and sizes itself from it, so the camera and
 * the panel cannot drift apart.
 */
export const CARD_SLIDEOVER_WIDTH_PX = 440;

/**
 * The `sm` breakpoint, where the card stops being a full-width sheet and
 * becomes a slide-over with map beside it. Below it there is no map left to
 * aim at, so the camera does not try.
 */
export const CARD_SLIDEOVER_MIN_WIDTH_PX = 640;

/** Breathing room between the slide-over's edge and the flown-to place. */
const CARD_GUTTER_PX = 24;

export type CameraPadding = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

/** The resting padding — what keeps the route clear of the docked chrome. */
export function framePadding(width: number): CameraPadding {
  return width >= DESKTOP_BREAKPOINT_PX
    ? { ...FRAME_PADDING.desktop }
    : { ...FRAME_PADDING.compact };
}

/** No reservation at all — what an unpadded camera was framed against. */
export const NO_PADDING: CameraPadding = {
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
};

/**
 * Padding for the flight, while the card is open.
 *
 * Mapbox centres on the middle of the box *inside* the camera padding, so
 * reserving the slide-over's width on the right is what puts the flown-to
 * place in the middle of the map the traveller can still see, rather than
 * behind the panel that just slid over it. Nothing about the card's own
 * layout changes — the camera moves instead.
 *
 * Camera padding is *sticky*: it lives on the transform until something sets
 * it again, which is why every camera call on this stage states its own —
 * `fitBounds` sets the resting frame's, this sets the card's, and the compact
 * camera resets to `NO_PADDING` because it was hand-framed unpadded. Verified
 * against mapbox-gl 3.29 rather than assumed: `map.getPadding()` after the
 * opening `fitBounds` reads back the resting frame's four numbers.
 *
 * Below `sm` the card is a full-height sheet and there is no visible map to
 * centre anything in; the flight uses the resting padding so that the camera
 * is already right the moment the sheet is dismissed.
 */
export function focusPadding(width: number): CameraPadding {
  const base = framePadding(width);
  if (width < CARD_SLIDEOVER_MIN_WIDTH_PX) return base;
  return { ...base, right: CARD_SLIDEOVER_WIDTH_PX + CARD_GUTTER_PX };
}
