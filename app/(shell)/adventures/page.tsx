import { Suspense } from "react";
import type { Metadata } from "next";

import { CapsuleCardHost } from "@/components/capsule-card";
import { CapsulesBrowser } from "@/components/capsules-browser";

export const metadata: Metadata = {
  title: "Australia 2026–27",
  description:
    "413 Australian holiday ideas and eight researched Adventures, sifted into a shortlist.",
};

/**
 * The Capsules page (#40) — where the Catalog actually lives now.
 *
 * The whole page is a client tree, and the Suspense boundary is what buys
 * that cheaply: `CapsulesBrowser` reads the filter set out of `useSearchParams`
 * so a sifted view is a shareable link, and a route that reads search params
 * outside a boundary cannot be prerendered at all. Inside one, the shell
 * prerenders static and only the browser hydrates with the URL's filters.
 *
 * The detail card is mounted here rather than inside the browser for the same
 * reason it is mounted on the Plan page: it is a full-screen modal that reads
 * a module-level store, and the things that open it — a card in the grid, a
 * related idea *inside* an open card — are in different subtrees.
 */
export default function Capsules() {
  return (
    <>
      <Suspense fallback={<CatalogLoading />}>
        <CapsulesBrowser />
      </Suspense>
      <CapsuleCardHost />
    </>
  );
}

/**
 * What the prerendered shell shows. Deliberately the masthead's own geometry
 * rather than a spinner: the page it becomes starts with a title and a band of
 * filters, so the frame should not jump when the filters arrive.
 */
function CatalogLoading() {
  return (
    <main className="h-full w-full overflow-hidden">
      <div className="mx-auto max-w-[1440px] px-5 pt-8 sm:px-8 lg:pt-10">
        <p className="sb-label">The catalog</p>
        <h1 className="mt-2 font-display text-[32px] leading-[1.05] font-extrabold tracking-[-0.02em] text-[var(--sb-text)] lg:text-[40px]">
          Adventures
        </h1>
        <p className="mt-3 text-[13.5px] text-[var(--sb-dim)]">
          Sorting the catalog…
        </p>
      </div>
    </main>
  );
}
