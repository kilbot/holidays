import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = {
  title: "Ledger — Southbound",
};

export default function Ledger() {
  return (
    <ComingSoon
      title="Ledger"
      blurb="Every Day of the trip as a priced row — lodging, event spend, transport, total — banded by week, with warnings inline and the cost bands one click down."
      issue={41}
    />
  );
}
