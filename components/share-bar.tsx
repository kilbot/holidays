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
 * The labels are deliberately plain. "Viewing — fork to play" is what is
 * actually true, and it is more useful than a disabled-looking UI that leaves
 * the visitor guessing why their clicks do not stick. What they *can* do — take
 * the whole thing away and rearrange it — is the accent-coloured button, because
 * per ADR 0001 that is the site's one real invitation to a friend.
 */

import { useEffect, useRef, useState } from "react";
import { Check, Copy, GitFork, Link2, Pencil, Undo2, X } from "lucide-react";

import { usePlan } from "@/lib/engine/use-plan";
import {
  closeSharePanel,
  toggleSharePanel,
  useSharePanelOpen,
} from "@/lib/share-panel";
import { MAX_FORK_NAME_LENGTH } from "@/lib/store/plans";
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
  if (sharing.mode === "view") return "Viewing — fork to play";
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

/* ------------------------------------------------------------------ */
/* Fork                                                                */
/* ------------------------------------------------------------------ */

/**
 * The visitor's one write.
 *
 * A name and nothing else is required — docs/CONTEXT.md's Fork is *"named,
 * saved, with its own URL"*, and asking a friend to fill in a form before they
 * are allowed to have an opinion is how you get no opinions. The note is there
 * because people want to say *why*, and a fork with no argument attached is
 * harder for the couple to weigh.
 *
 * The URL comes back once and is never recoverable. The copy says so.
 */
function ForkPanel({ sharing }: { sharing: SharingApi }) {
  const { input, scenarios } = usePlan();
  const [name, setName] = useState(`${scenarios.current.name} — my version`);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  if (url) {
    return (
      <div className="mt-2 border-t border-[var(--sb-line)] pt-2">
        <p className="text-[10.5px] leading-snug text-[var(--sb-dim)]">
          Saved. This link is the only way back to it — nothing lists forks, so
          keep it somewhere.
        </p>
        <CopyRow label="Your version" url={url} />
      </div>
    );
  }

  return (
    <div className="mt-2 border-t border-[var(--sb-line)] pt-2">
      <p className="sb-label text-[9px]">Make your own version</p>
      <p className="mt-1 text-[10.5px] leading-snug text-[var(--sb-dim)]">
        Saves the trip exactly as you have it now — every change you have made
        while previewing, on its own link. The couple&rsquo;s plan is untouched.
      </p>

      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={MAX_FORK_NAME_LENGTH}
        aria-label="Name your version"
        placeholder="Name it"
        className="mt-1.5 w-full rounded-md border border-[var(--sb-line)] bg-[var(--sb-panel-2)] px-2 py-1.5 text-[11px] text-[var(--sb-text)] outline-none focus-visible:border-[var(--sb-accent)]"
      />
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={280}
        rows={2}
        aria-label="Why this version (optional)"
        placeholder="Why? (optional)"
        className="sb-scroll mt-1 w-full resize-none rounded-md border border-[var(--sb-line)] bg-[var(--sb-panel-2)] px-2 py-1.5 text-[11px] text-[var(--sb-text)] outline-none focus-visible:border-[var(--sb-accent)]"
      />

      <button
        type="button"
        disabled={saving || name.trim().length === 0}
        onClick={() => {
          setSaving(true);
          setFailed(false);
          void sharing
            .saveFork(name, input, note.trim() || undefined)
            .then((saved) => {
              if (saved) setUrl(saved);
              else setFailed(true);
              setSaving(false);
            });
        }}
        className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md bg-[var(--sb-accent)] px-2 py-1.5 text-[11px] font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-50 motion-reduce:transition-none"
      >
        <GitFork className="size-3.5" />
        {saving ? "Saving…" : "Save my version"}
      </button>

      {failed && (
        <p className="mt-1.5 text-[10px] leading-snug text-[var(--sb-warn)]">
          That did not save — the store may be unreachable. Your changes are
          still here in this browser.
        </p>
      )}
    </div>
  );
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
          void sharing.discardPreview().finally(() => setWorking(false));
        }}
        className="mt-1.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[var(--sb-line)] px-2 py-1.5 text-[11px] font-semibold text-[var(--sb-text)] transition-colors hover:bg-[var(--sb-panel-2)] disabled:opacity-50 motion-reduce:transition-none"
      >
        <Undo2 className="size-3.5" />
        {working ? "Restoring…" : "Discard my changes"}
      </button>
    </div>
  );
}

/**
 * What to do about a Fork you are looking at.
 *
 * Two different verbs for the two modes, and the difference is exactly ADR
 * 0001's: a visitor can take a copy into their own browser, and only the couple
 * can put it on the Plan's shelf. Neither one lets a Fork change the itinerary.
 */
function VisitingPanel({ sharing }: { sharing: SharingApi }) {
  const { scenarios } = usePlan();
  const visiting = sharing.visiting;
  const [done, setDone] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  if (!visiting) return null;

  return (
    <div className="mt-2 border-t border-[var(--sb-line)] pt-2">
      <p className="sb-label text-[9px]">Someone else&rsquo;s version</p>
      {visiting.authorNote && (
        <p className="mt-1 text-[10.5px] leading-snug text-[var(--sb-text)] italic">
          &ldquo;{visiting.authorNote}&rdquo;
        </p>
      )}

      {done ? (
        <p className="mt-1.5 text-[10.5px] leading-snug text-[var(--sb-good)]">
          {done}
        </p>
      ) : (
        <button
          type="button"
          disabled={working}
          onClick={() => {
            setWorking(true);
            if (sharing.mode === "edit") {
              void sharing.adopt(visiting.forkId).then((ok) => {
                setWorking(false);
                setDone(ok ? "Adopted — it is in your Scenarios now." : null);
              });
            } else {
              // View mode has no server write, so this is the local fork the
              // engine has always had: a copy in this browser, nowhere else.
              scenarios.fork(visiting.name);
              setWorking(false);
              setDone("Copied into this browser.");
            }
          }}
          className="mt-1.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[var(--sb-line)] px-2 py-1.5 text-[11px] font-semibold text-[var(--sb-text)] transition-colors hover:bg-[var(--sb-panel-2)] disabled:opacity-50 motion-reduce:transition-none"
        >
          <GitFork className="size-3.5" />
          {sharing.mode === "edit"
            ? "Adopt into Scenarios"
            : "Copy into this browser"}
        </button>
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
    // Bottom-right, clear of the date strip *and* of Mapbox's attribution —
    // which sits at strip height + 24px and has to stay visible under Mapbox's
    // terms, so this clears it rather than covering it.
    <section
      ref={panel}
      className="pointer-events-auto absolute right-4 bottom-[calc(var(--sb-strip-h)+3.5rem)] z-30 w-[248px] max-w-[calc(100vw-2rem)] print:hidden"
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
            {sharing.mode === "view" && !sharing.visiting && (
              <ForkPanel sharing={sharing} />
            )}
          </>
        )}
      </div>
    </section>
  );
}
