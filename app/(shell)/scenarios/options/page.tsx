import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { MarkdownCards } from "@/components/markdown-cards";

export const metadata: Metadata = {
  title: "Adeline's adventures — Australia 2026–27",
  description:
    "Each thing Adeline asked for, researched into an option: where, how long, what it costs for two, when to book.",
};

export default async function Options() {
  const markdown = await readFile(
    path.join(process.cwd(), "content", "pages", "options.md"),
    "utf8",
  );

  return (
    <main className="sb-scroll h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-[760px] px-5 pt-8 pb-24 sm:px-8 lg:pt-10">
        <Link
          href="/scenarios"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--sb-dim)] hover:text-[var(--sb-text)]"
        >
          <ArrowLeft aria-hidden className="size-3.5" /> All scenarios
        </Link>

        <MarkdownCards markdown={markdown} level={3} />
      </div>
    </main>
  );
}
