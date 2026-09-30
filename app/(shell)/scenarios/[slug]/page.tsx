import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PlanFigures } from "@/components/plan-figures";
import { PlanWriteup } from "@/components/plan-writeup";
import {
  CURATED_PLANS,
  curatedPlanBySlug,
  planTitle,
} from "@/lib/engine/curated-plans";
import { INITIAL_STATE } from "@/lib/engine/scenario-doc";

/**
 * A lettered Plan's write-up, as the Traveller who asked for it wrote it.
 *
 * Scenarios are curated, not created on the site (2026-09-30), and a Plan that
 * came from a written brief keeps the brief: the markdown in `content/plans/`
 * is rendered as it stands, so the page cannot drift from the author's words. The
 * engine's figures for the same Plan sit above it, labelled as the site's, so
 * the two budgets are never mistaken for each other.
 *
 * Static: every write-up is known at build time, and an unknown slug is a 404
 * rather than a render.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return CURATED_PLANS.flatMap((plan) =>
    plan.writeup ? [{ slug: plan.writeup.slug }] : [],
  );
}

/** The Scenario's name as seeded — the subtitle the Plan letter heads. */
function seededName(id: string): string {
  return (
    INITIAL_STATE.scenarios.find((scenario) => scenario.id === id)?.name ?? id
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const plan = curatedPlanBySlug(slug);
  if (!plan) return {};
  return {
    title: `${planTitle(plan.letter, seededName(plan.id))} — Australia 2026–27`,
    description: `${plan.writeup?.by}'s plan, week by week, as written.`,
  };
}

export default async function PlanPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const plan = curatedPlanBySlug(slug);
  if (!plan?.writeup) notFound();

  const markdown = await readFile(
    path.join(process.cwd(), "content", "plans", plan.writeup.file),
    "utf8",
  );

  return (
    <main className="sb-scroll h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-[760px] px-5 pt-8 pb-24 sm:px-8 lg:pt-10">
        <Link
          href="/scenarios"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--sb-dim)] hover:text-[var(--sb-text)]"
        >
          <ArrowLeft aria-hidden className="size-3.5" /> All the Plans
        </Link>

        <p className="sb-label mt-5">
          Plan {plan.letter} · {seededName(plan.id)}
        </p>
        <p className="mt-1.5 text-[12.5px] text-[var(--sb-faint)]">
          Written by {plan.writeup.by}. Everything below the line is{" "}
          {plan.writeup.by}&rsquo;s plan, word for word.
        </p>

        <PlanFigures scenarioId={plan.id} by={plan.writeup.by} />

        <PlanWriteup markdown={markdown} />
      </div>
    </main>
  );
}
