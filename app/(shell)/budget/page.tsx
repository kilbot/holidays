import type { Metadata } from "next";

import { BudgetView } from "@/components/budget-view";

export const metadata: Metadata = {
  title: "Australia 2026–27",
  description:
    "Spend read against the €12k–€20k ceiling: the burn-down across the trip dates, where the money goes by category, the contingency row, an FX stress test, and every Scenario compared side by side.",
};

/**
 * The Budget page (#42).
 *
 * A thin route, like /ledger: the whole page reads the Plan through `usePlan`,
 * which reads module-level stores, so it is a client tree. No search params, so
 * the shell prerenders and the charts hydrate.
 */
export default function Budget() {
  return <BudgetView />;
}
