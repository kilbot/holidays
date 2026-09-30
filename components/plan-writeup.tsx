import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * A Plan's write-up, rendered from the markdown its author wrote.
 *
 * Nothing is rewritten on the way through: headings, lists, the at-a-glance
 * table and the call-outs are the author's structure, and this only dresses them in the
 * site's type. Server-rendered, so the words are in the HTML.
 */

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-8 font-display text-[30px] leading-[1.08] font-extrabold tracking-[-0.02em] text-[var(--sb-text)] lg:text-[38px]">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-9 font-display text-[21px] leading-tight font-bold tracking-[-0.01em] text-[var(--sb-text)] lg:text-[24px]">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 font-display text-[16px] leading-tight font-bold text-[var(--sb-text)]">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mt-3 max-w-[68ch] text-[14px] leading-[1.7] text-[var(--sb-dim)] lg:text-[15px]">
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[var(--sb-text)]">{children}</strong>
  ),
  ul: ({ children }) => (
    <ul className="mt-3 flex max-w-[68ch] list-disc flex-col gap-1.5 pl-5 text-[14px] leading-[1.6] text-[var(--sb-dim)] marker:text-[var(--sb-faint)] lg:text-[15px]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-3 flex max-w-[68ch] list-decimal flex-col gap-1.5 pl-5 text-[14px] leading-[1.6] text-[var(--sb-dim)] marker:text-[var(--sb-faint)] lg:text-[15px]">
      {children}
    </ol>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mt-4 max-w-[68ch] rounded-r-lg border-l-[3px] border-[var(--sb-accent)] bg-[var(--sb-panel)] py-0.5 pr-4 pl-4 [&>p]:mt-2 [&>p]:mb-2 [&>p]:text-[var(--sb-text)]">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="mt-9 border-[var(--sb-line)]" />,
  table: ({ children }) => (
    <div className="sb-scroll mt-4 overflow-x-auto rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]">
      <table className="w-full border-collapse text-left text-[13px]">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="sb-label border-b border-[var(--sb-line)] px-3 py-2 text-[9.5px] font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-[var(--sb-line)] px-3 py-2 align-top text-[var(--sb-dim)]">
      {children}
    </td>
  ),
};

export function PlanWriteup({ markdown }: { markdown: string }) {
  return (
    <article className="mt-8 border-t border-[var(--sb-line)] pb-4">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </Markdown>
    </article>
  );
}
