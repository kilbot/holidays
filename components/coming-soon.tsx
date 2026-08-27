import Link from "next/link";

/**
 * An honest empty room.
 *
 * Three of the four sections exist as routes before they exist as pages, so
 * that the shell (#39) can be navigated and reviewed on its own. The temptation
 * is to fill them with a copy of something from the Plan page; the cost of that
 * is two versions of the same view drifting apart while the real page is built.
 * So they say what is coming, name the ticket that brings it, and point back to
 * the one page that works.
 *
 * This component is expected to be deleted as #40, #41 and #42 land.
 */
export function ComingSoon({
  title,
  blurb,
  issue,
}: {
  title: string;
  /** One line: what this page will hold. Present tense, no promises about when. */
  blurb: string;
  /** The ticket that builds it, so the placeholder is traceable. */
  issue: number;
}) {
  return (
    <main className="sb-scroll h-full w-full overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-[520px] flex-col justify-center px-6 py-16">
        <h1 className="mt-2 font-display text-[30px] leading-[1.1] font-extrabold tracking-[-0.01em] text-[var(--sb-text)]">
          {title}
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--sb-dim)]">{blurb}</p>
        <p className="mt-6 text-[12px] text-[var(--sb-faint)]">
          Not built yet — this route exists so the navigation is real. Issue #{issue}{" "}
          fills it in.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)] px-4 text-[13px] font-semibold text-[var(--sb-text)] transition-colors hover:bg-[var(--sb-panel-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sb-accent)] motion-reduce:transition-none"
        >
          <span aria-hidden>←</span> Back to the Plan
        </Link>
      </div>
    </main>
  );
}
