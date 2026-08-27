"use client";

/**
 * The one loud thing on this site.
 *
 * #58: *"the user played for minutes without realizing"* — they were on the view
 * link, they rearranged Adventures, and the only thing on screen that knew was a
 * 11px pill in the far corner reading *Viewing — fork to play*. Which is true,
 * and which nobody reads, because it says the same thing before you touch
 * anything as after.
 *
 * So this is deliberately not another resting label. It exists for exactly one
 * moment — the first write this tab makes without the right to save it — and it
 * spans the stage, because a visitor who has just changed the trip's total needs
 * to be told once, clearly, while the number is still moving. After they dismiss
 * it the quiet signals take over: the share pill's label turns to *Previewing —
 * not saved* with a warn dot, and the cost HUD's total wears a *preview* tag.
 *
 * Three things to do about it, which is the whole point of preferring a preview
 * to a disabled UI (issue #58, option a): keep playing, keep the result under a
 * link of your own, or put the couple's Plan back.
 *
 * Nothing here is persisted. A reload discards the preview anyway — the server
 * copy wins on hydrate — so a dismissal that outlived the preview it described
 * would be a lie stored on purpose.
 */

import { useState } from "react";
import { GitFork, TriangleAlert, Undo2, X } from "lucide-react";

import { openSharePanel } from "@/lib/share-panel";
import { useSharing } from "@/lib/store/sharing";

export function PreviewNotice() {
  const { previewing, discardPreview } = useSharing();
  const [dismissed, setDismissed] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  // Armed again once the preview is gone, so a visitor who discards and then
  // starts a second preview is told a second time. The alternative — one notice
  // per tab, ever — is the failure this component was written to fix.
  //
  // Adjusted during render rather than in an effect: React's own guidance for
  // state that follows a prop, and the effect version is a cascading render the
  // lint rule (rightly) refuses.
  if (!previewing && dismissed) setDismissed(false);

  if (!previewing || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-3 top-3 z-40 flex justify-center print:hidden"
    >
      <div className="sb-panel pointer-events-auto w-full max-w-[520px] border-l-[3px] border-l-[var(--sb-warn)] p-3.5">
        <div className="flex items-start gap-2.5">
          <TriangleAlert className="mt-px size-4 shrink-0 text-[var(--sb-warn)]" />

          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] leading-tight font-semibold text-[var(--sb-text)]">
              Previewing — not saved
            </p>
            <p className="mt-1 text-[11px] leading-snug text-[var(--sb-dim)]">
              You are on the view link, so the trip is recomputing here and
              nowhere else. The couple&rsquo;s plan is untouched, and reloading
              this page puts it back. Save your own version to keep what you have
              done.
            </p>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={openSharePanel}
                className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md bg-[var(--sb-accent)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 motion-reduce:transition-none"
              >
                <GitFork className="size-3.5" />
                Save my version
              </button>

              <button
                type="button"
                disabled={discarding}
                onClick={() => {
                  setDiscarding(true);
                  void discardPreview().finally(() => setDiscarding(false));
                }}
                className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border border-[var(--sb-line)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--sb-text)] transition-colors hover:bg-[var(--sb-panel-2)] disabled:opacity-50 motion-reduce:transition-none"
              >
                <Undo2 className="size-3.5" />
                {discarding ? "Restoring…" : "Discard my changes"}
              </button>

              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="min-h-8 cursor-pointer rounded-md px-2 py-1.5 text-[11px] font-medium text-[var(--sb-dim)] transition-colors hover:text-[var(--sb-text)] motion-reduce:transition-none"
              >
                Keep previewing
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss the preview notice"
            className="-mt-0.5 shrink-0 cursor-pointer rounded-md p-1 text-[var(--sb-faint)] transition-colors hover:bg-[var(--sb-panel-2)] hover:text-[var(--sb-text)] motion-reduce:transition-none"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
