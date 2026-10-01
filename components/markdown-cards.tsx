import { Fragment } from "react";

import { PlanWriteup } from "@/components/plan-writeup";
import { headingSlug, sectionIndex, splitCards } from "@/lib/markdown-cards";

export function MarkdownCards({
  markdown,
  level,
  jumpList = false,
}: {
  markdown: string;
  level: 2 | 3;
  jumpList?: boolean;
}) {
  return splitCards(markdown, level).map((chunk, index) => (
    <Fragment key={index}>
      {chunk.card ? (
        <section
          className="mt-4 rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)] px-5 pb-5 sm:px-6"
        >
          <PlanWriteup markdown={chunk.markdown} className="[&>*:first-child]:mt-5" />
        </section>
      ) : jumpList && chunk.markdown.startsWith("## ") ? (
        <div id={headingSlug(chunk.markdown.split("\n")[0].slice(3).trim())} className="scroll-mt-6">
          <PlanWriteup markdown={chunk.markdown} className="pb-2" />
        </div>
      ) : (
        <PlanWriteup markdown={chunk.markdown} className="pb-2" />
      )}
      {jumpList && index === 0 && (
        <nav aria-label="Jump to region" className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-2 text-[14px] leading-[1.6] text-[var(--sb-dim)]">
          <span>Jump to</span>
          {sectionIndex(markdown).map(({ id, title, cards }) => (
            <a key={id} href={"#" + id} className="font-semibold text-[var(--sb-text)] underline decoration-[var(--sb-accent)] decoration-1 underline-offset-[3px] hover:text-[var(--sb-accent)]">
              {title} ({cards})
            </a>
          ))}
        </nav>
      )}
    </Fragment>
  ));
}
