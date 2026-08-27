"use client";

/**
 * "Where the money goes, and what cutting costs" (#65).
 *
 * The rest of the Budget page answers *what does this cost*. This answers the
 * question that follows it, which is the one the couple actually has: **what
 * would it take to spend less, and what would that feel like?**
 *
 * ## Two rules the design obeys
 *
 * **Every saving carries its price.** A row is a euro figure, a pain grade and
 * a sentence about what is given up, and the sentence is not optional. A menu
 * that lists savings without their cost is a menu that recommends the cheapest
 * possible trip, which is not the trip anybody wants — docs/CONTEXT.md is
 * explicit that the Budget is a ceiling and never a spending goal. So the
 * given-up line gets the same weight as the number, and the number is right-
 * aligned in a column of its own so it can be scanned without being shouted.
 *
 * **Progressive disclosure, twice.** #10's rule on this page is that the
 * plan-on figure is the surface and the honest detail is one click down. The
 * whole section is collapsed at rest behind a summary line, and inside it each
 * tier is its own disclosure — because seventeen levers opened at once is a
 * document, not a control. The first tier ("already banked") starts open,
 * since it explains why the totals on this page moved without anybody choosing
 * anything.
 *
 * ## Typography
 *
 * A reading room, not a dashboard. The given-up sentences run at a real reading
 * size on a ~62ch measure with normal line height, because they are prose and
 * the reader is deciding something. The tabular furniture around them — euros,
 * pain grades, lever numbers — stays at the page's small sizes. The two are not
 * the same kind of thing and should not be the same size.
 */

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

import { formatEur } from "@/lib/engine";
import {
  APPLY_LABEL,
  PAIN_LABEL,
  SAVINGS_MIRAGES,
  SAVINGS_TIERS,
  bankedEur,
  ranked,
  type SavingsApply,
  type SavingsLever,
  type SavingsPain,
} from "@/lib/savings-menu";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Chips                                                               */
/* ------------------------------------------------------------------ */

/**
 * Pain, as a colour and a word.
 *
 * Both, never colour alone: this is the one judgement on the row a reader might
 * act on, and a red dot that means nothing to a colourblind reader means
 * nothing. `none` deliberately gets the good green rather than grey — a lever
 * that costs nothing is the good news on this page.
 */
const PAIN_INK: Record<SavingsPain, string> = {
  none: "var(--sb-good)",
  low: "var(--sb-sea)",
  medium: "var(--sb-warn)",
  high: "var(--sb-over)",
};

function PainChip({ pain }: { pain: SavingsPain }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[9.5px] font-semibold"
      style={{
        color: PAIN_INK[pain],
        background: `color-mix(in srgb, ${PAIN_INK[pain]} 11%, transparent)`,
      }}
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ background: PAIN_INK[pain] }}
      />
      {PAIN_LABEL[pain]}
    </span>
  );
}

function ApplyChip({ apply }: { apply: SavingsApply }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-1.5 py-px text-[9.5px] font-semibold",
        apply === "banked"
          ? "border-[color-mix(in_srgb,var(--sb-good)_35%,var(--sb-line))] text-[var(--sb-good)]"
          : "border-[var(--sb-line)] text-[var(--sb-faint)]",
      )}
    >
      {APPLY_LABEL[apply]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* One lever                                                           */
/* ------------------------------------------------------------------ */

function Lever({ lever }: { lever: SavingsLever }) {
  return (
    <li className="border-t border-[var(--sb-line)] py-3 first:border-t-0 first:pt-0">
      <div className="flex items-baseline gap-2">
        <span className="sb-num w-[18px] shrink-0 text-[10px] text-[var(--sb-faint)]">
          {lever.n}
        </span>
        <h4 className="min-w-0 flex-1 text-[13px] leading-snug font-semibold text-[var(--sb-text)]">
          {lever.label}
        </h4>
        <span
          className={cn(
            "sb-num shrink-0 text-right text-[14px] leading-none font-semibold",
            lever.savesEur === null
              ? "text-[var(--sb-faint)]"
              : "text-[var(--sb-text)]",
          )}
        >
          {lever.savesEur === null ? "—" : `−${formatEur(lever.savesEur)}`}
        </span>
      </div>

      <p className="mt-1.5 ml-[26px] max-w-[62ch] text-[12.5px] leading-relaxed text-[var(--sb-dim)]">
        {lever.givenUp}
      </p>

      <div className="mt-2 ml-[26px] flex flex-wrap items-center gap-1.5">
        <PainChip pain={lever.pain} />
        <ApplyChip apply={lever.apply} />
        {lever.inScenario.map((id) => (
          <span
            key={id}
            className="shrink-0 rounded-full bg-[var(--sb-panel-2)] px-1.5 py-px text-[9.5px] font-semibold text-[var(--sb-dim)]"
          >
            {id === "comfortable" ? "Comfortable takes it" : "Aggressive takes it"}
          </span>
        ))}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* One tier                                                            */
/* ------------------------------------------------------------------ */

function Tier({
  title,
  blurb,
  levers,
  defaultOpen,
}: {
  title: string;
  blurb: string;
  levers: readonly SavingsLever[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const total = levers.reduce((sum, lever) => sum + (lever.savesEur ?? 0), 0);

  return (
    <section className="border-t border-[var(--sb-line)] first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full cursor-pointer items-baseline gap-2.5 py-2.5 text-left"
      >
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 translate-y-0.5 text-[var(--sb-faint)] transition-transform motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] leading-snug font-semibold text-[var(--sb-text)]">
            {title}
          </span>
          {!open && (
            <span className="mt-0.5 block max-w-[62ch] text-[11.5px] leading-snug text-[var(--sb-faint)]">
              {blurb}
            </span>
          )}
        </span>
        <span className="sb-num shrink-0 text-[11.5px] text-[var(--sb-faint)]">
          {levers.length} · {total > 0 ? `up to −${formatEur(total)}` : "—"}
        </span>
      </button>

      {open && (
        <div id={id} className="pb-4">
          <p className="mb-3 max-w-[62ch] text-[12.5px] leading-relaxed text-[var(--sb-dim)]">
            {blurb}
          </p>
          <ul className="flex flex-col">
            {levers.map((lever) => (
              <Lever key={lever.id} lever={lever} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The section                                                         */
/* ------------------------------------------------------------------ */

export function SavingsMenu() {
  const [open, setOpen] = useState(false);
  const id = useId();

  const banked = bankedEur();
  const onTheTable = ranked().reduce(
    (sum, lever) => sum + (lever.savesEur ?? 0),
    0,
  );

  return (
    <section className="mt-4 rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-left"
      >
        <span className="min-w-0">
          <span className="sb-label text-[9px]">
            Where the money goes, and what cutting costs
          </span>
          <span className="mt-0.5 block truncate text-[11.5px] text-[var(--sb-dim)]">
            {banked > 0 && (
              <>
                <span className="sb-num">{formatEur(banked)}</span> already
                banked ·{" "}
              </>
            )}
            <span className="sb-num">{formatEur(onTheTable)}</span> more on the
            table, and what each of it costs
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[var(--sb-faint)] transition-transform motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div id={id} className="border-t border-[var(--sb-line)] px-3.5 py-3">
          <p className="max-w-[62ch] text-[12.5px] leading-relaxed text-[var(--sb-dim)]">
            Seventeen levers, priced against this engine and ranked by euro
            saved per unit of pain. Each is measured{" "}
            <span className="font-semibold text-[var(--sb-text)]">
              on its own
            </span>
            , against the plan as it stands — they interact, so the column does
            not add up to a total. The two savings Scenarios beside{" "}
            <span className="italic">The All-Stops Tour</span> — the
            everything version, and the ceiling the other Scenarios cut from —
            are the honest cumulative answer.
          </p>

          <div className="mt-3">
            {SAVINGS_TIERS.map((tier, index) => (
              <Tier
                key={tier.id}
                title={tier.title}
                blurb={tier.blurb}
                levers={tier.levers}
                // The banked tier opens first: it is why the figures at the top
                // of this page moved without anybody deciding anything.
                defaultOpen={index === 0}
              />
            ))}
          </div>

          <div className="mt-4 rounded-lg bg-[color-mix(in_srgb,var(--sb-panel-2)_60%,transparent)] px-3 py-2.5">
            <h4 className="sb-label text-[9px]">
              Levers that look bigger than they are
            </h4>
            <p className="mt-1 max-w-[62ch] text-[11.5px] leading-relaxed text-[var(--sb-dim)]">
              Trimming an Adventure inside a fixed trip range barely saves
              anything: the freed Day becomes a Buffer day in the same place, at
              the same rates. Only the hire car goes.
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {SAVINGS_MIRAGES.map((mirage) => (
                <li key={mirage.label} className="flex items-baseline gap-2">
                  <span className="sb-num w-[52px] shrink-0 text-right text-[11.5px] font-semibold text-[var(--sb-faint)]">
                    −{formatEur(mirage.savesEur)}
                  </span>
                  <span className="min-w-0 max-w-[54ch] text-[11.5px] leading-snug text-[var(--sb-dim)]">
                    <span className="font-semibold text-[var(--sb-text)]">
                      {mirage.label}.
                    </span>{" "}
                    {mirage.why}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-3 max-w-[62ch] text-[10.5px] leading-snug text-[var(--sb-faint)]">
            Working and sources:{" "}
            <span className="font-medium">
              docs/research/savings-menu-draft.md
            </span>{" "}
            and{" "}
            <span className="font-medium">
              docs/research/cost-floors-recalibrated.md
            </span>
            . The wiggle room lives in the contingency row and the worst-case
            band, never in an inflated per-line estimate.
          </p>
        </div>
      )}
    </section>
  );
}
