"use client";

/**
 * Whether the share pill is open — as a store, because two things now open it.
 *
 * #58 gave the preview notice a *Save my version* button that opened the pill
 * from the other end of the stage, which is why this is a module-level store
 * rather than the pill's own state. That button went with Forks (2026-09-30);
 * the pill is the only opener now, and the store stays because it works.
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
