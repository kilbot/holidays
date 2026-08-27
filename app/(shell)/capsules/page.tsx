import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = {
  title: "Capsules — Southbound",
};

export default function Capsules() {
  return (
    <ComingSoon
      title="Capsules"
      blurb="The whole catalog at full width — cards with their art, filters with room to breathe, day-by-days you can actually read, and the shortlist sift that today is squeezed into the Plan page's drawer."
      issue={40}
    />
  );
}
