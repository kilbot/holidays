"use client";

/**
 * Which Capsule the detail card is showing, if any.
 *
 * A module-level store rather than component state, for the same reason the
 * shortlist is one: the thing that opens the card and the thing that renders
 * it are nowhere near each other in the tree. A Catalog row opens it from
 * inside the drawer (which is mounted twice — desktop rail and mobile
 * overlay), the deep-capsule strip opens it from the same place, and a marker
 * on the globe opens it from the opposite corner of the page. Lifting state to
 * a common ancestor would mean threading a callback through all three.
 *
 * Unlike the shortlist this is deliberately *not* persisted. An open card is a
 * moment, not a decision; a refresh should land you back on the globe.
 */

import { useSyncExternalStore } from "react";

export type CapsuleKind = "deep" | "idea";

export interface CapsuleFocus {
  kind: CapsuleKind;
  id: string;
}

let focus: CapsuleFocus | null = null;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): CapsuleFocus | null {
  return focus;
}

/** Nothing is open during SSR — the card is a client interaction. */
function getServerSnapshot(): CapsuleFocus | null {
  return null;
}

function open(kind: CapsuleKind, id: string): void {
  // Reference equality is what useSyncExternalStore compares, so re-opening
  // the same card has to be a no-op rather than a fresh object.
  if (focus && focus.kind === kind && focus.id === id) return;
  focus = { kind, id };
  emit();
}

export function openCatalogIdea(id: string): void {
  open("idea", id);
}

export function openDeepCapsule(id: string): void {
  open("deep", id);
}

export function closeCapsule(): void {
  if (focus === null) return;
  focus = null;
  emit();
}

export function useCapsuleFocus(): CapsuleFocus | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
