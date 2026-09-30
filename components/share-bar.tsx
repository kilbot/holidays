"use client";

/**
 * Sharing, as one pill.
 *
 * The map Notes ask for progressive disclosure and honest labels, and sharing is
 * where those two pull hardest against each other: the honest thing to tell a
 * visitor is that they are looking at someone else's itinerary and cannot change
 * it, and the cluttering thing is a banner saying so.
 *
 * So the resting state is a single pill in the corner that says which of the
 * three modes this tab is in — *Viewing*, *Editing*, *This browser only* — and
 * everything else is one click behind it. Nothing is hidden and nothing shouts:
 * the same bargain the cost HUD strikes with its plan-on figure.
 *
 * The labels are deliberately plain: "Viewing" is what is actually true. A
 * visitor can still rearrange the trip as a preview in their own browser; what
 * they can no longer do is save it as a Fork, because the Plans are curated
 * (2026-09-30) — the next one comes from telling Claude, not from this pill.
 */

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Link2, Pencil, Undo2, X } from "lucide-react";

import {
  closeSharePanel,
  toggleSharePanel,
  useSharePanelOpen,
} from "@/lib/share-panel";
import { useSharing, type SharingApi } from "@/lib/store/sharing";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Bits                                                                */
/* ------------------------------------------------------------------ */

/** A link with the one control a link needs. */
function CopyRow({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className="mt-1.5">
      <p className="sb-label text-[9px]">{label}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <code className="sb-num min-w-0 flex-1 truncate rounded-md bg-[var(--sb-panel-2)] px-2 py-1 text-[10.5px] text-[var(--sb-dim)]">
          {url}
        </code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(url).then(
              () => setCopied(true),
              // Clipboard permission can be refused; the URL is on screen and
              // selectable either way, so this is not worth an error state.
              () => undefined,
            );
          }}
          aria-label={`Copy the ${label.toLowerCase()}`}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--sb-faint)] transition-colors hover:bg-[var(--sb-panel-2)] hover:text-[var(--sb-text)] motion-reduce:transition-none"
        >
          {copied ? (
            <Check className="size-3.5 text-[var(--sb-good)]" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * What the pill says at rest.
 *
 * Mode first, sync state second and only when it is not the boring answer:
 * "Editing" with everything saved needs no further words, and "Editing ·
 * offline" is the one the traveller has to know about.
 */
function restingLabel(sharing: SharingApi): string {
  // The preview reads before the Fork's name: a visitor previewing on top of
  // someone else's Fork has changed something, and that is the more urgent of
  // the two facts.
  if (sharing.previewing) return "Previewing — not saved";
  if (sharing.visiting) return sharing.visiting.name;
  if (sharing.mode === "local") return "This browser only";
  if (sharing.mode === "view") return "Viewing";
  if (sharing.status === "offline") return "Editing · offline";
  if (sharing.status === "rejected") return "Editing · not saving";
  if (sharing.status === "saving") return "Editing · saving";
  return "Editing";
}

function toneFor(sharing: SharingApi): string | null {
  // A dot on the view-mode pill, for once. It is the only state in which a
  // visitor has something at stake — unsaved work — and the pill is where they
  // will look after dismissing the notice.
  if (sharing.previewing) return "var(--sb-warn)";
  if (sharing.mode !== "edit") return null;
  if (sharing.status === "offline" || sharing.status === "rejected") {
    return "var(--sb-warn)";
  }
  if (sharing.status === "saving") return "var(--sb-faint)";
  return "var(--sb-good)";
}

/**
 * The way back out of a preview.
 *
 * A visitor's changes are real and immediate and live in this browser only, so
 * the undo is not an undo stack — it is re-reading the couple's Plan, which is
 * the same thing a reload does and the only thing that could be true after an
 * arbitrary number of edits. Saying "reload the page" would have worked; a
 * button that does it without losing the tab is better.
 */
function DiscardRow({ sharing }: { sharing: SharingApi }) {
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className="mt-2 border-t border-[var(--sb-line)] pt-2">
      <p className="flex items-baseline gap-1.5 text-[10.5px] leading-snug text-[var(--sb-dim)]">
        <span
          aria-hidden
          className="mt-[3px] size-1.5 shrink-0 rounded-full"
          style={{ background: "var(--sb-warn)" }}
        />
        <span>
          Your changes are in this browser only. A reload puts the
          couple&rsquo;s plan back.
        </span>
      </p>
      <button
        type="button"
        disabled={working}
        onClick={() => {
          setWorking(true);
          setFailed(false);
          void sharing.discardPreview().then((restored) => {
            setFailed(!restored);
            setWorking(false);
          });
        }}
        className="mt-1.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[var(--sb-line)] px-2 py-1.5 text-[11px] font-semibold text-[var(--sb-text)] transition-colors hover:bg-[var(--sb-panel-2)] disabled:opacity-50 motion-reduce:transition-none"
      >
        <Undo2 className="size-3.5" />
        {working ? "Restoring…" : "Discard my changes"}
      </button>
      {failed && (
        <p className="mt-1.5 text-[10px] leading-snug text-[var(--sb-warn)]">
          The shared plan is not reachable, so nothing was restored. Your
          version is still here.
        </p>
      )}
    </div>
  );
}

/**
 * A Fork you are looking at.
 *
 * Forks are no longer made or adopted on the site (2026-09-30: the Plans are
 * curated), but a link somebody saved before that still opens, and the note
 * its author left is still worth reading.
 */
function VisitingPanel({ sharing }: { sharing: SharingApi }) {
  const visiting = sharing.visiting;
  if (!visiting) return null;

  return (
    <div className="mt-2 border-t border-[var(--sb-line)] pt-2">
      <p className="sb-label text-[9px]">Someone else&rsquo;s version</p>
      {visiting.authorNote && (
        <p className="mt-1 text-[10.5px] leading-snug text-[var(--sb-text)] italic">
          &ldquo;{visiting.authorNote}&rdquo;
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The pill                                                            */
/* ------------------------------------------------------------------ */

export function ShareBar() {
  const sharing = useSharing();
  // Open-ness is a module store rather than component state because the preview
  // notice opens this panel too — `lib/share-panel.ts` says why.
  const open = useSharePanelOpen();
  const panel = useRef<HTMLDivElement>(null);

  // Escape closes, and so does a click anywhere else — this sits over a globe
  // people drag, and an overlay that has to be dismissed by its own X is one
  // more thing between them and the map.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSharePanel();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node)) closeSharePanel();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const tone = toneFor(sharing);

  return (
    // Bottom-right, on the shared pill line — clear of the date strip and of
    // Mapbox's logo and attribution, which have to stay visible under Mapbox's
    // terms (`--sb-pill-bottom` in globals.css does that arithmetic once).
    //
    // Since #56 the strip publishes its *live* height, so this rides up out of
    // the way when a week is opened instead of printing itself over the week's
    // weather column. The offset holds for every state of the pill: the panel
    // grows upwards from this edge, so *Viewing*, *Previewing* and the opened
    // panel all clear the strip by the same margin.
    <section
      ref={panel}
      className="pointer-events-auto absolute right-4 bottom-[var(--sb-pill-bottom)] z-30 w-[248px] max-w-[calc(100vw-2rem)] print:hidden"
    >
      <div className={cn("sb-panel", open ? "p-3" : "p-0")}>
        <button
          type="button"
          onClick={toggleSharePanel}
          aria-expanded={open}
          className={cn(
            "flex w-full cursor-pointer items-center gap-2 text-left",
            open ? "" : "px-3 py-2",
          )}
        >
          {sharing.mode === "edit" ? (
            <Pencil className="size-3 shrink-0 text-[var(--sb-faint)]" />
          ) : (
            <Link2 className="size-3 shrink-0 text-[var(--sb-faint)]" />
          )}
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[var(--sb-text)]">
            {restingLabel(sharing)}
          </span>
          {tone && !open && (
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: tone }}
            />
          )}
          {open && <X className="size-3 shrink-0 text-[var(--sb-faint)]" />}
        </button>

        {open && (
          <>
            {sharing.mode === "local" && (
              <p className="mt-2 border-t border-[var(--sb-line)] pt-2 text-[10.5px] leading-snug text-[var(--sb-dim)]">
                No shared plan is configured, so everything lives in this
                browser and nothing leaves it. The trip still works exactly the
                same.
              </p>
            )}

            {sharing.mode !== "local" && (
              <CopyRow label="Share this plan" url={sharing.viewLink} />
            )}

            {sharing.mode === "edit" && (
              <p className="mt-1.5 text-[10px] leading-snug text-[var(--sb-faint)]">
                That is the view link — safe to send to anyone. Your edit link is
                the one in your bookmarks; do not paste it anywhere.
              </p>
            )}

            {sharing.previewing && <DiscardRow sharing={sharing} />}

            {sharing.visiting && <VisitingPanel sharing={sharing} />}
          </>
        )}
      </div>
    </section>
  );
}
