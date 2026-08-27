import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = {
  title: "Budget — Southbound",
};

export default function Budget() {
  return (
    <ComingSoon
      title="Budget"
      blurb="Spend read against the ceiling — the burn-down across the trip dates, where the money goes by category, contingency, an FX stress test, and Scenarios compared side by side."
      issue={42}
    />
  );
}
