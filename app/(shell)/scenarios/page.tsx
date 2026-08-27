import type { Metadata } from "next";

import { ScenariosView } from "@/components/scenarios-view";

export const metadata: Metadata = {
  title: "Australia 2026–27",
  description:
    "Every saved alternate trip on one shelf: what each costs, how long it runs, when it was last worked on, and — derived from the trip itself — exactly what switching to it would change. Plus the visitor forks the couple have adopted.",
};

/**
 * The Scenarios page (#59).
 *
 * A thin route, like /ledger and /budget. The view reads the Plan through
 * `usePlan` and the share mode through `useSharing`, both of which read
 * module-level stores, so it is a client tree; it takes no search params, so
 * the shell prerenders and only the figures hydrate.
 */
export default function Scenarios() {
  return <ScenariosView />;
}
