import { PlanWriteup } from "@/components/plan-writeup";
import { splitCards } from "@/lib/markdown-cards";

export function MarkdownCards({
  markdown,
  level,
}: {
  markdown: string;
  level: 2 | 3;
}) {
  return splitCards(markdown, level).map((chunk, index) =>
    chunk.card ? (
      <section
        key={index}
        className="mt-4 rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)] px-5 pb-5 sm:px-6"
      >
        <PlanWriteup markdown={chunk.markdown} className="[&>*:first-child]:mt-5" />
      </section>
    ) : (
      <PlanWriteup key={index} markdown={chunk.markdown} className="pb-2" />
    ),
  );
}
