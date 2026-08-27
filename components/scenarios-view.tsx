"use client";

/**
 * The Scenarios page (#59) — where the alternate trips are kept.
 *
 * The reported bug is the whole brief: *"it's not clear that there are
 * different scenarios"*. Three complete trips were saved, they differed by
 * nearly six thousand euros, and the only way to see any of that was to expand
 * the cost HUD on the globe and read a four-row list at 10.5px. So this page
 * exists to make the shelf a place rather than a disclosure — and the nav and
 * the HUD both point at it, because a page nobody can find is the same bug
 * again with more pixels.
 *
 * ## What each row has to answer
 *
 * "Which is this?" is a name and a colour. "What does it cost?" is the plan-on
 * total. "How long is it?" is days and dates. "Have we worked on it?" is the
 * last-edited stamp. And the one the HUD's list could never answer — **"what
 * would we be giving up?"** — is the diff, derived from the saved `PlanInput`
 * by `scenario-diff.ts` rather than written down beside each Scenario by hand.
 *
 * The headline of that diff is three figures — ±€, ±days, ±Adventures — and the
 * rest is behind a disclosure per row. #10's progressive disclosure applies
 * here as much as on the HUD: the surface answers *is this cheaper and by how
 * much*, and the eleven separate decisions behind it are one click down, in the
 * Ledger's own vocabulary.
 *
 * ## Colour is identity, and identity is list position
 *
 * The same rule the Budget page's comparison follows (`budget-chart.ts`,
 * `scenarioInk`): a Scenario's hue is its index in the saved list, never its
 * rank in any ordering shown. This page never re-sorts, so the two agree by
 * construction — the violet row here is the violet dumbbell there.
 *
 * ## Edit mode, view mode
 *
 * Per ADR 0001 and #58: every figure is readable by anyone holding the view
 * link, and the mutating verbs — set current, rename, duplicate, delete,
 * create — appear only for the tab holding the edit link. A visitor is not
 * given a disabled toolbar to guess at; they get the site's one real
 * invitation, *make your own version*, which is the Fork panel the share pill
 * already owns.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  GitFork,
  Pencil,
  TriangleAlert,
  Trash2,
  X,
} from "lucide-react";

import { daysUntil, useToday } from "@/lib/countdown";
import { formatEur, locationById, TIER_LABEL } from "@/lib/engine";
import { lastEditedAt, type Scenario } from "@/lib/engine/scenario-doc";
import {
  diffChangeCount,
  diffScenarios,
  formatSigned,
  formatSignedEur,
  type ScenarioDiff,
} from "@/lib/engine/scenario-diff";
import type { ScenarioTotal } from "@/lib/engine/scenarios";
import { usePlan } from "@/lib/engine/use-plan";
import { openSharePanel } from "@/lib/share-panel";
import { FORK_QUERY_PARAM } from "@/lib/store/canonical-plan";
import { MAX_FORK_NAME_LENGTH } from "@/lib/store/plans";
import { useSharing, type SharingApi } from "@/lib/store/sharing";
import { formatDay, formatDayYear } from "@/lib/trip-dates";
import { scenarioInk } from "@/components/budget-chart";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

/**
 * When a Scenario was last worked on, in the reader's own terms.
 *
 * Rendered as a date first and a distance second, for the reason
 * `lib/countdown.ts` documents: "4d ago" baked into the HTML is wrong for
 * anyone who leaves the tab open overnight, so the client's clock arrives after
 * hydration and the date is what stands until it does.
 */
function Edited({ iso }: { iso: string }) {
  const today = useToday();
  const day = iso.slice(0, 10);
  const absolute = formatDayYear(day);
  if (!today) return <>{absolute}</>;

  const ago = -daysUntil(today, day);
  if (ago < 0) return <>{absolute}</>;
  if (ago === 0) return <>today</>;
  if (ago === 1) return <>yesterday</>;
  if (ago < 30) return <>{ago}d ago</>;
  return <>{absolute}</>;
}

/** One figure of the diff headline. Neutral by default; money earns a tone. */
function Chip({
  children,
  tone = "neutral",
  title,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "cheaper" | "dearer";
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "sb-num inline-flex items-baseline rounded-full px-2 py-[3px] text-[11px] leading-none whitespace-nowrap",
        tone === "cheaper" &&
          "bg-[color-mix(in_srgb,var(--sb-good)_15%,transparent)] font-semibold text-[var(--sb-good)]",
        tone === "dearer" &&
          "bg-[color-mix(in_srgb,var(--sb-over)_13%,transparent)] font-semibold text-[var(--sb-over)]",
        tone === "neutral" && "bg-[var(--sb-panel-2)] text-[var(--sb-dim)]",
      )}
    >
      {children}
    </span>
  );
}

/** A verb on a row. Quiet at rest — the row's own figures are the loud part. */
function Action({
  onClick,
  children,
  danger,
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--sb-line)] px-2.5 text-[11.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sb-accent)] motion-reduce:transition-none",
        danger
          ? "text-[var(--sb-over)] hover:bg-[color-mix(in_srgb,var(--sb-over)_10%,transparent)]"
          : "text-[var(--sb-dim)] hover:bg-[var(--sb-panel-2)] hover:text-[var(--sb-text)]",
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* The difference, in words                                            */
/* ------------------------------------------------------------------ */

/** Ids the catalogue does not know: "tas-tasman" reads better than nothing. */
const prettify = (id: string) => id.replace(/-/g, " ");

interface Vocabulary {
  adventure: (id: string) => string;
  event: (id: string) => string;
  /** A lodging key is an Adventure id or a Location id — both are places. */
  place: (id: string) => string;
}

/**
 * The diff spelled out, one line per kind of decision.
 *
 * Every line names *things*, not fields: "Camping instead of a room · Margaret
 * River, Tasmania, Byron", never `lodgingTiers: 3 changed`. The couple recognise
 * the places; nobody recognises the schema.
 */
function DiffDetail({
  diff,
  subject,
  reference,
  words,
}: {
  diff: ScenarioDiff;
  subject: Scenario;
  reference: Scenario;
  words: Vocabulary;
}) {
  const lines: { label: string; detail: string }[] = [];

  if (diff.datesMoved) {
    lines.push({
      label: "Different dates",
      detail: `${formatDay(subject.input.startDate)} – ${formatDayYear(subject.input.endDate)}, where the Plan runs ${formatDay(reference.input.startDate)} – ${formatDayYear(reference.input.endDate)}`,
    });
  }
  if (diff.adventuresAdded.length > 0) {
    lines.push({
      label: `Adds ${diff.adventuresAdded.length === 1 ? "an Adventure" : `${diff.adventuresAdded.length} Adventures`}`,
      detail: diff.adventuresAdded.map(words.adventure).join(", "),
    });
  }
  if (diff.adventuresRemoved.length > 0) {
    lines.push({
      label: `Drops ${diff.adventuresRemoved.length === 1 ? "an Adventure" : `${diff.adventuresRemoved.length} Adventures`}`,
      detail: diff.adventuresRemoved.map(words.adventure).join(", "),
    });
  }
  if (diff.eventsOff.length > 0) {
    lines.push({
      label: "Event spend off",
      detail: diff.eventsOff.map(words.event).join(", "),
    });
  }
  if (diff.eventsKept.length > 0) {
    lines.push({
      label: "Event spend kept",
      detail: `${diff.eventsKept.map(words.event).join(", ")} — the Plan has ${diff.eventsKept.length === 1 ? "it" : "them"} switched off`,
    });
  }
  if (diff.eventsRepriced.length > 0) {
    lines.push({
      label: "Event swapped for a cheaper one",
      detail: diff.eventsRepriced
        .map((id) => {
          const knob = subject.input.eventOverrides[id];
          return typeof knob === "number"
            ? `${words.event(id)} at A$${knob}`
            : words.event(id);
        })
        .join(", "),
    });
  }
  if (diff.lodgingChanged.length > 0) {
    lines.push({
      label: "Sleeping somewhere else",
      detail: diff.lodgingChanged
        .map((id) => {
          const tier = subject.input.lodgingTiers[id];
          return tier ? `${words.place(id)} — ${TIER_LABEL[tier]}` : words.place(id);
        })
        .join(", "),
    });
  }
  if (diff.placementsChanged.length > 0) {
    lines.push({
      label: "Moved on the calendar",
      detail: diff.placementsChanged
        .map((id) => {
          const at = subject.input.placementOverrides[id];
          return at ? `${words.adventure(id)} from ${formatDay(at)}` : words.adventure(id);
        })
        .join(", "),
    });
  }
  if (diff.legModesChanged.length > 0) {
    lines.push({
      label: "Travelled differently",
      detail: diff.legModesChanged
        .map((id) => `${prettify(id)} by ${subject.input.legModeOverrides[id] ?? "the default"}`)
        .join(", "),
    });
  }
  if (diff.carsChanged.length > 0) {
    lines.push({
      label: "Hire car",
      detail: diff.carsChanged
        .map(
          (id) =>
            `${words.place(id)} ${subject.input.carOverrides[id] ? "with" : "without"} one`,
        )
        .join(", "),
    });
  }
  if (diff.fxStressChanged) {
    lines.push({
      label: "Exchange rate",
      detail: subject.input.fxStress
        ? "priced at the stressed A$1 = €0.65"
        : "priced at spot, A$1 = €0.61",
    });
  }
  if (diff.contingencyChanged) {
    lines.push({
      label: "Contingency",
      detail: subject.input.contingency
        ? "the ~10% row is on"
        : "the ~10% row is zeroed",
    });
  }

  if (lines.length === 0) {
    return (
      <p className="text-[12px] text-[var(--sb-dim)]">
        Every decision in this Scenario matches the Plan. Any difference in the
        total would be live fares moving under both of them.
      </p>
    );
  }

  return (
    <dl className="flex flex-col gap-2">
      {lines.map((line) => (
        <div key={line.label} className="sm:flex sm:gap-3">
          <dt className="shrink-0 text-[11.5px] font-semibold text-[var(--sb-text)] sm:w-[190px]">
            {line.label}
          </dt>
          <dd className="text-[12px] leading-snug text-[var(--sb-dim)] first-letter:uppercase">
            {line.detail}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/* A row                                                               */
/* ------------------------------------------------------------------ */

interface RowProps {
  scenario: Scenario;
  total: ScenarioTotal;
  diff: ScenarioDiff;
  index: number;
  words: Vocabulary;
  reference: Scenario;
  canEdit: boolean;
  deletable: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  renaming: boolean;
  onRenamingChange: (on: boolean) => void;
}

function ScenarioRow({
  scenario,
  total,
  diff,
  index,
  words,
  reference,
  canEdit,
  deletable,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
  renaming,
  onRenamingChange,
}: RowProps) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(scenario.name);
  const { ink } = scenarioInk(index);
  const changes = diffChangeCount(diff);

  return (
    <li
      className={cn(
        "relative overflow-hidden rounded-xl border bg-[var(--sb-panel)] transition-colors motion-reduce:transition-none",
        total.current
          ? "border-[color-mix(in_srgb,var(--sb-accent)_45%,var(--sb-line))] shadow-[0_1px_0_0_color-mix(in_srgb,var(--sb-accent)_18%,transparent)]"
          : "border-[var(--sb-line)]",
      )}
    >
      {/* Identity, as a rule down the edge — the Scenario's colour on the
          Budget page's comparison, in the place a list can afford it. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: ink }}
      />

      <div className="py-4 pr-4 pl-5">
        {/* ---- Name, marker, total ---- */}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {renaming ? (
                <form
                  className="flex items-center gap-1.5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const name = draft.trim();
                    if (name) onRename(name);
                    onRenamingChange(false);
                  }}
                >
                  <input
                    autoFocus
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setDraft(scenario.name);
                        onRenamingChange(false);
                      }
                    }}
                    maxLength={MAX_FORK_NAME_LENGTH}
                    aria-label={`Rename ${scenario.name}`}
                    className="min-w-0 rounded-md border border-[var(--sb-line)] bg-[var(--sb-panel-2)] px-2 py-1 font-display text-[16px] font-bold text-[var(--sb-text)] outline-none focus-visible:border-[var(--sb-accent)]"
                  />
                  <button
                    type="submit"
                    aria-label="Save the name"
                    className="flex size-8 cursor-pointer items-center justify-center rounded-md text-[var(--sb-good)] hover:bg-[var(--sb-panel-2)]"
                  >
                    <Check className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Keep the old name"
                    onClick={() => {
                      setDraft(scenario.name);
                      onRenamingChange(false);
                    }}
                    className="flex size-8 cursor-pointer items-center justify-center rounded-md text-[var(--sb-faint)] hover:bg-[var(--sb-panel-2)]"
                  >
                    <X className="size-4" />
                  </button>
                </form>
              ) : (
                <h2 className="font-display text-[19px] leading-tight font-bold tracking-[-0.01em] text-[var(--sb-text)] lg:text-[21px]">
                  {scenario.name}
                </h2>
              )}

              {/* The prominent CURRENT marker. Filled, accent, and spelled out
                  — docs/CONTEXT.md's "exactly one is marked as the current
                  Plan" is the fact this page exists to make obvious. */}
              {total.current && (
                <span className="sb-label rounded-full bg-[var(--sb-accent)] px-2 py-[3px] text-[9px] leading-none text-[var(--primary-foreground)]">
                  Current Plan
                </span>
              )}
              {scenario.adoptedFrom && (
                <span
                  title="Copied in from a visitor's fork. Their fork is untouched."
                  className="sb-label inline-flex items-center gap-1 rounded-full bg-[var(--sb-panel-2)] px-2 py-[3px] text-[9px] leading-none text-[var(--sb-dim)]"
                >
                  <GitFork className="size-2.5" />
                  Adopted
                </span>
              )}
            </div>

            <p className="mt-1.5 text-[12px] text-[var(--sb-dim)]">
              <span className="sb-num">{total.dayCount}</span> days ·{" "}
              <span className="sb-num">
                {formatDay(scenario.input.startDate)} –{" "}
                {formatDayYear(scenario.input.endDate)}
              </span>{" "}
              · edited <Edited iso={lastEditedAt(scenario)} />
              {total.warnings > 0 && (
                <>
                  {" · "}
                  <span className="inline-flex items-baseline gap-1 text-[var(--sb-warn)]">
                    <TriangleAlert
                      aria-hidden
                      className="size-3 translate-y-[2px]"
                    />
                    <span className="sb-num">{total.warnings}</span>{" "}
                    {total.warnings === 1 ? "warning" : "warnings"}
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="text-right">
            <p
              className={cn(
                "sb-num text-[26px] leading-none font-semibold tracking-tight lg:text-[30px]",
                total.current ? "text-[var(--sb-text)]" : "text-[var(--sb-dim)]",
              )}
            >
              {formatEur(total.totalEur)}
            </p>
            <p className="sb-num mt-1 text-[10.5px] text-[var(--sb-faint)]">
              worst case {formatEur(total.worstCaseEur)}
            </p>
          </div>
        </div>

        {/* ---- The difference, at a glance ---- */}
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          {total.current ? (
            <p className="text-[12px] text-[var(--sb-dim)]">
              This is the Plan. Everything else on this page is measured against
              it.
            </p>
          ) : diff.identical ? (
            <Chip title="Same dates, same Adventures, same knobs.">
              Identical to the Plan
            </Chip>
          ) : (
            <>
              <Chip
                tone={diff.eur < 0 ? "cheaper" : diff.eur > 0 ? "dearer" : "neutral"}
                title="Plan-on total against the current Plan's."
              >
                {formatSignedEur(diff.eur)}
              </Chip>
              <Chip title="Days on the calendar against the current Plan's.">
                {diff.days === 0
                  ? "same length"
                  : `${formatSigned(diff.days)} days`}
              </Chip>
              {diff.adventuresAdded.length > 0 && (
                <Chip title={diff.adventuresAdded.map(words.adventure).join(", ")}>
                  +{diff.adventuresAdded.length}{" "}
                  {diff.adventuresAdded.length === 1
                    ? "adventure"
                    : "adventures"}
                </Chip>
              )}
              {diff.adventuresRemoved.length > 0 && (
                <Chip
                  title={diff.adventuresRemoved.map(words.adventure).join(", ")}
                >
                  −{diff.adventuresRemoved.length}{" "}
                  {diff.adventuresRemoved.length === 1
                    ? "adventure"
                    : "adventures"}
                </Chip>
              )}
            </>
          )}
        </div>

        {/* ---- One click down: what actually differs ---- */}
        {!total.current && changes > 0 && (
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              className="inline-flex cursor-pointer items-center gap-1 text-[11.5px] font-semibold text-[var(--sb-dim)] transition-colors hover:text-[var(--sb-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sb-accent)] motion-reduce:transition-none"
            >
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform motion-reduce:transition-none",
                  open && "rotate-180",
                )}
              />
              {open
                ? "Hide what is different"
                : `What is different — ${changes} ${changes === 1 ? "decision" : "decisions"}`}
            </button>

            {open && (
              <div className="mt-2.5 rounded-lg bg-[var(--sb-panel-2)] p-3">
                <DiffDetail
                  diff={diff}
                  subject={scenario}
                  reference={reference}
                  words={words}
                />
              </div>
            )}
          </div>
        )}

        {/* ---- The verbs, edit mode only ---- */}
        {canEdit && (
          <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-[var(--sb-line)] pt-3">
            {!total.current && (
              <button
                type="button"
                onClick={onSelect}
                className="inline-flex min-h-8 cursor-pointer items-center rounded-lg bg-[var(--sb-accent)] px-3 text-[11.5px] font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sb-accent)] motion-reduce:transition-none"
              >
                Make this the Plan
              </button>
            )}
            {!renaming && (
              <Action onClick={() => onRenamingChange(true)}>
                <Pencil className="size-3.5" /> Rename
              </Action>
            )}
            <Action
              onClick={onDuplicate}
              title="A copy, saved beside this one. The Plan does not change."
            >
              <Copy className="size-3.5" /> Duplicate
            </Action>

            {confirming ? (
              <span className="inline-flex items-center gap-2">
                <Action danger onClick={onDelete}>
                  Delete for good
                </Action>
                <Action onClick={() => setConfirming(false)}>Keep it</Action>
              </span>
            ) : (
              <Action
                danger
                onClick={() => setConfirming(true)}
                title={
                  deletable
                    ? "Deletes this Scenario. There is no undo."
                    : "The Plan always has at least one Scenario."
                }
              >
                <Trash2 className="size-3.5" /> Delete
              </Action>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Forks                                                               */
/* ------------------------------------------------------------------ */

/**
 * The Forks section, and the honest sentence it has to carry.
 *
 * A Fork is written under `fork:<id>` with a random id, handed back exactly
 * once, and **nothing enumerates the key space** — `lib/store/plans.ts` says so
 * in as many words, and it is a consequence of ADR 0001's no-accounts bargain
 * rather than a gap to be filled in later. So this section does not pretend to
 * be a list of forks. It shows the two kinds this browser can actually know
 * about — the ones already adopted into the Plan, and the one this tab was
 * opened on — and says plainly why there may be others it cannot see.
 *
 * An adopted Scenario keeps the Fork's id (`adoptedFrom`), so its original link
 * *is* reconstructable, which is the one useful thing to do with that stamp
 * beyond making adopt idempotent.
 */
function Forks({
  adopted,
  sharing,
  canEdit,
  onCopyLocally,
}: {
  adopted: { scenario: Scenario; total: ScenarioTotal }[];
  sharing: SharingApi;
  canEdit: boolean;
  onCopyLocally: (name: string) => void;
}) {
  const visiting = sharing.visiting;
  const alreadyAdopted =
    visiting !== null &&
    adopted.some((row) => row.scenario.adoptedFrom === visiting.forkId);
  const [working, setWorking] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  return (
    <section className="mt-12">
      <h2 className="font-display text-[23px] leading-tight font-extrabold tracking-[-0.015em] text-[var(--sb-text)] lg:text-[26px]">
        Visitor forks
      </h2>
      <p className="mt-2.5 max-w-[68ch] text-[13px] leading-[1.7] text-[var(--sb-dim)]">
        Anyone holding the view link can rearrange the trip and keep the result
        under a link of their own. Those forks never touch the Plan — the couple
        <em> adopt</em> one to put it on the shelf above.
      </p>
      <p className="mt-2 max-w-[68ch] text-[12px] leading-[1.7] text-[var(--sb-faint)]">
        There is no complete list of them, and there cannot be: a fork&rsquo;s id
        is handed to its author once and nothing on the server enumerates them.
        That is the cost of having no accounts. What is shown here is what this
        browser can honestly know — the forks already adopted, and the one this
        tab was opened on.
      </p>

      <ul className="mt-5 flex flex-col gap-2">
        {adopted.map(({ scenario, total }) => (
          <li
            key={scenario.id}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)] px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-[var(--sb-text)]">
                {scenario.name}
              </p>
              <p className="mt-0.5 text-[11.5px] text-[var(--sb-dim)]">
                Adopted <Edited iso={scenario.createdAt} /> · on the shelf as a
                Scenario
              </p>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="sb-num text-[14px] font-semibold text-[var(--sb-dim)]">
                {formatEur(total.totalEur)}
              </span>
              {/* A full navigation on purpose: the fork parameter is read once,
                  when the sharing hook mounts, and the hook lives in the shell
                  — a soft navigation would change the URL and nothing else. */}
              <a
                href={`/?${FORK_QUERY_PARAM}=${scenario.adoptedFrom}`}
                className="text-[11.5px] font-semibold text-[var(--sb-accent)] underline decoration-dotted underline-offset-[3px]"
              >
                Open the original
              </a>
            </div>
          </li>
        ))}

        {visiting && !alreadyAdopted && (
          <li className="rounded-xl border border-[color-mix(in_srgb,var(--sb-accent)_35%,var(--sb-line))] bg-[var(--sb-panel)] px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-[var(--sb-text)]">
                  {visiting.name}
                </p>
                <p className="mt-0.5 text-[11.5px] text-[var(--sb-dim)]">
                  You are looking at this fork now
                  {visiting.createdAt && (
                    <>
                      {" · made "}
                      <Edited iso={visiting.createdAt} />
                    </>
                  )}
                </p>
              </div>
            </div>
            {visiting.authorNote && (
              <p className="mt-2 max-w-[62ch] text-[12.5px] leading-snug text-[var(--sb-text)] italic">
                &ldquo;{visiting.authorNote}&rdquo;
              </p>
            )}
            {done ? (
              <p className="mt-2 text-[12px] font-semibold text-[var(--sb-good)]">
                {done}
              </p>
            ) : (
              <div className="mt-2.5">
                <Action
                  onClick={() => {
                    setWorking(true);
                    if (canEdit && sharing.mode === "edit") {
                      void sharing.adopt(visiting.forkId).then((ok) => {
                        setWorking(false);
                        setDone(
                          ok
                            ? "Adopted — it is a Scenario above now."
                            : "That did not save. The store may be unreachable.",
                        );
                      });
                    } else {
                      // No server write in view mode, so this is the local copy
                      // the engine has always had — this browser, nowhere else.
                      onCopyLocally(visiting.name);
                      setWorking(false);
                      setDone("Copied into this browser only.");
                    }
                  }}
                >
                  <GitFork className="size-3.5" />
                  {working
                    ? "Working…"
                    : sharing.mode === "edit"
                      ? "Adopt into Scenarios"
                      : "Copy into this browser"}
                </Action>
              </div>
            )}
          </li>
        )}

        {adopted.length === 0 && !visiting && (
          <li className="rounded-xl border border-dashed border-[var(--sb-line)] px-4 py-5 text-[12.5px] text-[var(--sb-faint)]">
            None yet. A fork appears here once it has been adopted, or while you
            are viewing one by its link.
          </li>
        )}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */

export function ScenariosView() {
  const { scenarios, totals, capsules } = usePlan();
  const sharing = useSharing();
  const [renaming, setRenaming] = useState<string | null>(null);

  // ADR 0001: a visitor reads everything and writes nothing to the Plan.
  // "local" — no shared plan configured at all — is the couple's own browser
  // and edits as normal, which is how the site works on a fresh clone.
  const canEdit = sharing.mode !== "view";

  const words: Vocabulary = useMemo(() => {
    const events = new Map<string, string>();
    for (const spec of capsules.values()) {
      for (const event of spec.events) events.set(event.id, event.label);
    }
    return {
      adventure: (id) => capsules.get(id)?.name ?? prettify(id),
      event: (id) => events.get(id) ?? prettify(id),
      place: (id) =>
        capsules.get(id)?.name ?? locationById(id).name ?? prettify(id),
    };
  }, [capsules]);

  const totalById = useMemo(
    () => new Map(totals.map((total) => [total.id, total])),
    [totals],
  );

  const current = scenarios.current;
  const currentTotal = totalById.get(current.id);

  const rows = scenarios.scenarios.map((scenario, index) => {
    const total = totalById.get(scenario.id);
    return { scenario, index, total };
  });

  const adopted = rows
    .filter((row) => row.scenario.adoptedFrom && row.total)
    .map((row) => ({ scenario: row.scenario, total: row.total as ScenarioTotal }));

  const cheapest = [...totals].sort((a, b) => a.totalEur - b.totalEur)[0];

  return (
    <main className="sb-scroll h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-[880px] px-5 pt-8 pb-24 sm:px-8 lg:pt-10">
        {/* ---- Masthead ---- */}
        <header>
          <p className="sb-label">The shelf</p>
          <h1 className="mt-2 font-display text-[32px] leading-[1.05] font-extrabold tracking-[-0.02em] text-[var(--sb-text)] lg:text-[40px]">
            Scenarios
          </h1>
          <p className="mt-3.5 max-w-[68ch] text-[14px] leading-[1.7] text-[var(--sb-dim)] lg:text-[15px]">
            A Scenario is a whole alternate calendar — its own dates, its own
            Adventures, its own Legs and its own total. Several are saved at
            once and exactly one is the Plan; everything else on the site — the
            globe, the Ledger, the Budget — shows whichever one that is. Each
            row below says what it costs and, derived from the trip itself
            rather than written down, what it would cost you to switch.
          </p>

          {currentTotal && cheapest && (
            <p className="mt-4 text-[12.5px] text-[var(--sb-dim)]">
              <span className="sb-num font-semibold text-[var(--sb-text)]">
                {scenarios.scenarios.length}
              </span>{" "}
              saved. The Plan is{" "}
              <span className="font-semibold text-[var(--sb-text)]">
                {current.name}
              </span>{" "}
              at{" "}
              <span className="sb-num font-semibold text-[var(--sb-text)]">
                {formatEur(currentTotal.totalEur)}
              </span>
              {cheapest.id !== current.id && (
                <>
                  {"; the cheapest is "}
                  <span className="font-semibold text-[var(--sb-text)]">
                    {cheapest.name}
                  </span>{" "}
                  at{" "}
                  <span className="sb-num font-semibold text-[var(--sb-text)]">
                    {formatEur(cheapest.totalEur)}
                  </span>
                  {", "}
                  <span className="sb-num font-semibold text-[var(--sb-good)]">
                    {formatSignedEur(cheapest.totalEur - currentTotal.totalEur)}
                  </span>
                  {" on the Plan"}
                </>
              )}
              .
            </p>
          )}
        </header>

        {/* ---- What a visitor can do instead ---- */}
        {!canEdit && (
          <div className="mt-6 rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)] p-4">
            <p className="sb-label text-[9px]">Viewing</p>
            <p className="mt-1.5 max-w-[62ch] text-[12.5px] leading-snug text-[var(--sb-dim)]">
              You are on the view link, so the couple&rsquo;s shelf is
              read-only here — switching, renaming and deleting belong to the
              edit link. What you can do is take the trip away and rearrange it:
              every change you make anywhere on the site is real and immediate
              in this browser, and <em>Make your own version</em> saves it under
              a link of your own.
            </p>
            <button
              type="button"
              onClick={openSharePanel}
              className="mt-2.5 inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--sb-accent)] px-3 text-[12px] font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sb-accent)] motion-reduce:transition-none"
            >
              <GitFork className="size-3.5" /> Make your own version
            </button>
          </div>
        )}

        {sharing.previewing && (
          <p className="mt-4 flex items-baseline gap-2 rounded-xl border border-[color-mix(in_srgb,var(--sb-warn)_40%,var(--sb-line))] bg-[color-mix(in_srgb,var(--sb-warn)_9%,transparent)] p-3 text-[12.5px] leading-snug text-[var(--sb-dim)]">
            <span
              aria-hidden
              className="mt-[5px] size-1.5 shrink-0 rounded-full"
              style={{ background: "var(--sb-warn)" }}
            />
            <span>
              You have changed the trip without the right to save it, so these
              figures are your preview and live in this browser alone. The share
              pill will put the couple&rsquo;s Plan back.
            </span>
          </p>
        )}

        {/* ---- The shelf ---- */}
        <ul className="mt-6 flex flex-col gap-3">
          {rows.map(({ scenario, index, total }) =>
            total ? (
              <ScenarioRow
                key={scenario.id}
                scenario={scenario}
                total={total}
                index={index}
                words={words}
                reference={current}
                diff={diffScenarios(
                  {
                    input: scenario.input,
                    totalEur: total.totalEur,
                    dayCount: total.dayCount,
                  },
                  {
                    input: current.input,
                    totalEur: currentTotal?.totalEur ?? total.totalEur,
                    dayCount: currentTotal?.dayCount ?? total.dayCount,
                  },
                )}
                canEdit={canEdit}
                deletable={scenarios.scenarios.length > 1}
                onSelect={() => scenarios.select(scenario.id)}
                onRename={(name) => scenarios.rename(scenario.id, name)}
                onDuplicate={() => {
                  const id = scenarios.duplicate(scenario.id);
                  if (id) setRenaming(id);
                }}
                onDelete={() => scenarios.remove(scenario.id)}
                renaming={renaming === scenario.id}
                onRenamingChange={(on) =>
                  setRenaming(on ? scenario.id : null)
                }
              />
            ) : null,
          )}
        </ul>

        {canEdit && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                // A new Scenario starts as a copy of the Plan, which is the
                // only starting position that is not a blank calendar — and
                // `fork` switches to it, because starting a variant means
                // working on it.
                const id = scenarios.fork("New scenario");
                setRenaming(id);
              }}
              className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--sb-line)] bg-[var(--sb-panel)] px-3 text-[12px] font-semibold text-[var(--sb-text)] transition-colors hover:bg-[var(--sb-panel-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sb-accent)] motion-reduce:transition-none"
            >
              <GitFork className="size-3.5" /> New scenario from the Plan
            </button>
            <p className="text-[11.5px] text-[var(--sb-faint)]">
              It starts identical to{" "}
              <span className="font-semibold text-[var(--sb-dim)]">
                {current.name}
              </span>{" "}
              and becomes the Plan, so the next thing you change is a change to
              the copy.
            </p>
          </div>
        )}

        <Forks
          adopted={adopted}
          sharing={sharing}
          canEdit={canEdit}
          onCopyLocally={(name) => scenarios.fork(name)}
        />

        <p className="mt-12 border-t border-[var(--sb-line)] pt-4 text-[11px] leading-relaxed text-[var(--sb-faint)]">
          Every total is the sum of that Scenario&rsquo;s Days, EUR per couple,
          computed by the same pass the{" "}
          <Link
            href="/ledger"
            className="underline decoration-dotted underline-offset-[3px] hover:text-[var(--sb-dim)]"
          >
            Ledger
          </Link>{" "}
          and the{" "}
          <Link
            href="/budget"
            className="underline decoration-dotted underline-offset-[3px] hover:text-[var(--sb-dim)]"
          >
            Budget
          </Link>{" "}
          use — a Scenario is a saved set of choices, and its cost is what the
          engine makes of them. The differences on each row are derived from
          those choices, never written down beside them, so they cannot go stale.
        </p>
      </div>
    </main>
  );
}
