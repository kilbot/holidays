/**
 * Taste lenses.
 *
 * The two Travellers want different trips out of the same Catalog
 * (docs/CONTEXT.md): she is the hippie of the pair — psytrance, doofs, hippie
 * markets, alternative culture, all first-class Event spend; he likes minor
 * sport outings and carries road-trip nostalgia from hitchhiking Perth→Sydney
 * for NYE 2000.
 *
 * A lens re-orders, it never filters. Nothing is hidden from either of them —
 * a demoted idea sinks to the bottom of the list and stays clickable, which is
 * the same "inform, never block" rule the Warnings follow.
 */

import type { CatalogIdea } from "@/lib/catalog";
import type { FacetId } from "@/lib/facets";

export type LensId = "both" | "hers" | "his";

export interface Lens {
  id: LensId;
  label: string;
  /** Caption under the toggle, so the re-ordering is never a mystery. */
  note: string;
  /** Which signal token tints the toggle when it is the active lens. */
  tone: string;
}

export const LENSES: readonly Lens[] = [
  {
    id: "both",
    label: "Both",
    note: "Catalog order — in-season ideas first.",
    tone: "var(--sb-dim)",
  },
  {
    id: "hers",
    label: "Her view",
    note: "Hippie, festivals and markets first. Sport sinks to the bottom.",
    tone: "var(--sb-accent)",
  },
  {
    id: "his",
    label: "His view",
    note: "Sport and the long drives first. Nothing demoted.",
    tone: "var(--sb-sea)",
  },
];

/**
 * Sort weight, high first. The numbers only matter relative to each other:
 * a hippie market outranks a plain festival, and one sport entry under her
 * lens goes below every non-sport idea in the list.
 */
export function lensWeight(idea: CatalogIdea, lens: LensId): number {
  if (lens === "both") return 0;

  const has = (facet: FacetId) => idea.facets.includes(facet);

  if (lens === "hers") {
    let weight = 0;
    if (has("hippie")) weight += 4;
    if (has("festival")) weight += 3;
    if (has("market")) weight += 3;
    if (has("music")) weight += 2;
    // Sport is his one-sided pick; under her lens it goes last, not away.
    if (has("sport")) weight -= 20;
    return weight;
  }

  let weight = 0;
  if (has("sport")) weight += 4;
  // The drive itself is the experience — road-trip nostalgia, per CONTEXT.
  if (has("road-trip")) weight += 3;
  if (idea.tags.includes("epic")) weight += 1;
  if (has("beach")) weight += 1;
  return weight;
}
