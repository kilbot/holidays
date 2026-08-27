"use client";

/**
 * Whether the share pill is open — as a store, because two things now open it.
 *
 * The pill opens itself when it is clicked, and that was the whole story until
 * #58 gave the preview notice a *Save my version* button. The notice sits at the
 * top of the stage and the pill is pinned to the bottom-right corner of it; they
 * are siblings under `ShellStage` with a page between them, so the notice asks
 * through a module-level store for exactly the reason `capsule-focus.ts` does.
 *
 * Not persisted, and deliberately so: an open panel is a moment, not a decision.
 */

import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function set(next: boolean) {
  if (open === next) return;
  open = next;
  emit();
}

/** Open the pill, with the Fork form in it. The preview notice's one verb. */
export function openSharePanel(): void {
  set(true);
}

export function closeSharePanel(): void {
  set(false);
}

export function toggleSharePanel(): void {
  set(!open);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => open;
/** Closed during SSR: an open panel is a client interaction. */
const getServerSnapshot = () => false;

export function useSharePanelOpen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
