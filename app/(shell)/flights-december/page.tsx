import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PlanWriteup } from "@/components/plan-writeup";
import { plainDescription } from "@/lib/markdown-description";

/**
 * The markdown in `content/pages/flights-december.md`, rendered as written.
 * Static: this page makes no fare calls.
 */

const CONTENT = path.join(process.cwd(), "content", "pages", "flights-december.md");

/**
 * The link preview is the page's own words — its first heading and the
 * first paragraph — so editing the markdown is the whole of a content change.
 */
export async function generateMetadata(): Promise<Metadata> {
  const lines = (await readFile(CONTENT, "utf8")).split("\n").map((line) => line.trim());
  const heading = lines.find((line) => line.startsWith("# "))?.slice(2);
  const paragraph = lines.find((line) => line !== "" && !/^[#>|*\-\d]/.test(line));
  return {
    title: `${heading ?? "Flights – December"} — Australia 2026–27`,
    description: paragraph ? plainDescription(paragraph) : undefined,
  };
}

export default async function FlightsDecember() {
  const markdown = await readFile(
    CONTENT,
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
