import type { Metadata } from "next";

import { ResourcesView } from "@/components/resources-view";

export const metadata: Metadata = {
  title: "Australia 2026–27",
  description:
    "The practical layer of the research, curated: relocation boards, house-sitting memberships, the booking deadlines that bite, the documents that have to exist before departure, and the forecasts still to be published.",
};

/**
 * The Resources page (#67).
 *
 * A thin route, like /ledger and /budget. The view is a client tree for exactly
 * one reason — the deadline countdowns have to be computed against the reader's
 * own clock rather than baked into the HTML — and it reads no search params, so
 * the shell prerenders and only the numbers hydrate.
 */
export default function Resources() {
  return <ResourcesView />;
}
