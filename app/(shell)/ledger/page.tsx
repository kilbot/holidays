import type { Metadata } from "next";

import { LedgerView } from "@/components/ledger-view";

export const metadata: Metadata = {
  title: "Australia 2026–27",
  description:
    "The trip day by day: every Day priced on its own line, banded by place, with warnings inline and the cost bands one click down.",
};

/**
 * The Ledger page (#41).
 *
 * A thin route: the whole page reads the Plan through `usePlan`, which reads
 * module-level stores (Scenarios, the shortlist, live fares), so it is a client
 * tree. Nothing here is worth a Suspense boundary — unlike /capsules this page
 * reads no search params, so the shell prerenders and the ledger hydrates.
 */
export default function Ledger() {
  return <LedgerView />;
}
