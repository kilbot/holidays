import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PlanWriteup } from "@/components/plan-writeup";

/**
 * The markdown in `content/pages/flights-december.md`, rendered as written.
 * Static: this page makes no fare calls.
 */

export const metadata: Metadata = {
  title: "Flights – December — Australia 2026–27",
  description: "Flight options to Perth for December 2026, and what to weigh between them.",
};

export default async function FlightsDecember() {
  const markdown = await readFile(
    path.join(process.cwd(), "content", "pages", "flights-december.md"),
    "utf8",
  );

  return (
    <main className="sb-scroll h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-[760px] px-5 pt-8 pb-24 sm:px-8 lg:pt-10">
        <Link
          href="/flights"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--sb-dim)] hover:text-[var(--sb-text)]"
        >
          <ArrowLeft aria-hidden className="size-3.5" /> All flights
        </Link>

        <PlanWriteup markdown={markdown} />
      </div>
    </main>
  );
}
