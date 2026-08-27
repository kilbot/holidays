/**
 * What the globe does when a card opens.
 *
 * Two things are worth pinning down and neither is a rendering detail. First,
 * that every researched Adventure resolves to a place and that the Catalog's
 * unmappable entries resolve to *nothing* rather than to a plausible-looking
 * wrong coordinate — a flight to a guessed dot is the one failure mode this
 * feature must not have. Second, that the camera padding reserves the
 * slide-over's width, because that reservation is the whole reason the flown-to
 * place lands in visible map rather than behind the card.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CATALOG } from "@/lib/catalog";
import {
  CARD_SLIDEOVER_MIN_WIDTH_PX,
  CARD_SLIDEOVER_WIDTH_PX,
  capsuleLocation,
  focusPadding,
  framePadding,
} from "@/lib/capsule-camera";
import { DEEP_CAPSULES } from "@/lib/deep-capsules";

describe("capsuleLocation", () => {
  it("puts every researched Adventure at its own base, not its gateway", () => {
    for (const capsule of DEEP_CAPSULES) {
      const location = capsuleLocation({ kind: "deep", id: capsule.id });
      assert.ok(location, `${capsule.id} has no location`);
      assert.deepEqual(location.at, capsule.base);
      assert.equal(location.name, capsule.name);
    }
  });

  it("puts a Catalog idea at the airport it is reached through", () => {
    const idea = CATALOG.find((entry) => entry.nearest_airport.startsWith("CNS"));
    assert.ok(idea, "expected at least one Cairns idea in the Catalog");
    const location = capsuleLocation({ kind: "idea", id: idea.id });
    assert.deepEqual(location?.at, [145.7551, -16.8858]);
  });

  it("resolves nothing for the entries that are a route rather than a place", () => {
    const unmappable = CATALOG.filter(
      (idea) => capsuleLocation({ kind: "idea", id: idea.id }) === null,
    );
    // "varies", "varies (Sydney/Melbourne + drive)" and "n/a" — the Big Lap
    // and its kind. Pinned so that a later airport-table edit that starts
    // guessing at them is loud rather than silent.
    assert.equal(unmappable.length, 12);
    for (const idea of unmappable) {
      assert.match(idea.nearest_airport, /^(varies|n\/a)/);
    }
  });

  it("resolves nothing for a stale id and for no focus at all", () => {
    assert.equal(capsuleLocation(null), null);
    assert.equal(capsuleLocation({ kind: "deep", id: "no-such-capsule" }), null);
    assert.equal(capsuleLocation({ kind: "idea", id: "no-such-idea" }), null);
  });
});

describe("focusPadding", () => {
  it("reserves the slide-over's width on the right", () => {
    const resting = framePadding(1440);
    const open = focusPadding(1440);
    assert.ok(open.right > CARD_SLIDEOVER_WIDTH_PX);
    assert.ok(open.right > resting.right);
    // Only the covered edge moves; the docked chrome on the other three is
    // still there and still has to be cleared.
    assert.equal(open.left, resting.left);
    assert.equal(open.top, resting.top);
    assert.equal(open.bottom, resting.bottom);
  });

  it("leaves the resting frame alone below the slide-over breakpoint", () => {
    const width = CARD_SLIDEOVER_MIN_WIDTH_PX - 1;
    assert.deepEqual(focusPadding(width), framePadding(width));
  });

  it("centres the flight inside the map the card leaves visible", () => {
    const width = 1440;
    const padding = focusPadding(width);
    // Where Mapbox will put the target: the middle of the padded box.
    const centre = padding.left + (width - padding.left - padding.right) / 2;
    assert.ok(
      centre < width - CARD_SLIDEOVER_WIDTH_PX,
      `flown-to place at ${centre}px would sit under the card`,
    );
  });
});
