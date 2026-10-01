import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";

import { MarkdownCards } from "@/components/markdown-cards";

export const metadata: Metadata = {
  title: "Scenarios — Australia 2026–27",
  description:
    "Every scenario for the trip, numbered: when it applies, its dates, and what it costs for two.",
};

/**
 * `content/pages/scenarios.md` rendered as one card per `## ` section.
 * Switching the current scenario stays in the cost HUD.
 */
export default async function Scenarios() {
  const markdown = await readFile(
    path.join(process.cwd(), "content", "pages", "scenarios.md"),
    "utf8",
  );

  return (
    <main className="sb-scroll h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-[880px] px-5 pt-8 pb-24 sm:px-8 lg:pt-10">
        <MarkdownCards markdown={markdown} level={2} />
      </div>
    </main>
  );
}
