import type { Metadata } from "next";

import { FlightsView } from "@/components/flights-view";
import { outboundOptions, returnOptions } from "@/lib/flights/search-plan";

export const metadata: Metadata = {
  title: "Australia 2026–27",
  description:
    "Two multi-origin searches ranked comfort-first: thirteen European hubs to Perth, four east-coast airports home to Valencia, with the positioning chains priced honestly against the direct option.",
};

/**
 * The Flights page (#50).
 *
 * Unlike /ledger and /budget this route does real work on the server: the whole
 * option set is derived from the two research files and scored there, so the
 * ratings dataset and the hub grid never ship to the browser. What crosses is
 * about ninety rows of already-scored itinerary — enough for the client to
 * re-sort, price against a live quote and open a breakdown without another
 * round trip.
 *
 * The rows are static for a given research corpus, so this prerenders; only the
 * fares are live, and those are fetched from `/api/fares` after hydration with
 * one request per origin.
 */
export default function Flights() {
  return <FlightsView outbound={outboundOptions()} returns={returnOptions()} />;
}
