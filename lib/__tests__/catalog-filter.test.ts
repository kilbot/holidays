/**
 * The sift's contract.
 *
 * Two things are worth pinning down here and neither is a rendering detail.
 * First, the URL round trip: a filtered Catalog is a shareable link, so
 * `decode(encode(f))` has to be `f` for every filter, including the two whose
 * URL form is a *number* rather than the slider index behind it. Second, the
 * predicate's asymmetries — chips OR, everything else ANDs; "open" means "not
 * discarded" rather than "unmarked" — because those are the rules a later
 * editor is most likely to sand off by accident.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CATALOG } from "@/lib/catalog";
import {
  COST_STOPS,
  DAY_STOPS,
  NO_FILTERS,
  candidateFromCapsule,
  candidateFromIdea,
  decodeFilters,
  encodeFilters,
  isSifted,
  matchesFilters,
  narrowingCount,
  searchNeedle,
  siftCatalog,
  siftDeepCapsules,
  type CatalogFilters,
} from "@/lib/catalog-filter";
import { DEEP_CAPSULES } from "@/lib/deep-capsules";
import type { ShortlistMap } from "@/lib/shortlist";

const NO_MARKS: ShortlistMap = {};

/** Round trip through the query string, the way a shared link does. */
function reread(filters: CatalogFilters): CatalogFilters {
  return decodeFilters(new URLSearchParams(encodeFilters(filters)));
}

function keep(filters: CatalogFilters, marks: ShortlistMap = NO_MARKS) {
  return siftCatalog(CATALOG, filters, marks);
}

describe("the URL round trip", () => {
  it("leaves an unsifted Catalog with an empty query string", () => {
    assert.equal(encodeFilters(NO_FILTERS), "");
    assert.deepEqual(decodeFilters(new URLSearchParams("")), NO_FILTERS);
  });

  it("survives every filter set at once", () => {
    const filters: CatalogFilters = {
      query: "reef walk",
      facets: ["beach", "wildlife"],
      states: ["QLD", "Cross-state"],
      seasons: ["good", "ok"],
      maxDays: 5,
      maxCost: 400,
      shelf: "interested",
    };
    assert.deepEqual(reread(filters), filters);
  });

  it("carries the ceilings as figures, not slider indices", () => {
    const encoded = encodeFilters({ ...NO_FILTERS, maxDays: 7, maxCost: 200 });
    const params = new URLSearchParams(encoded);
    assert.equal(params.get("d"), "7");
    assert.equal(params.get("c"), "200");
  });

  it("omits an infinite ceiling rather than writing Infinity", () => {
    const encoded = encodeFilters({ ...NO_FILTERS, maxDays: Infinity });
    assert.equal(encoded, "");
    assert.equal(reread({ ...NO_FILTERS, maxDays: Infinity }).maxDays, Infinity);
  });

  it("snaps a ceiling that is not a stop up to the next one", () => {
    const decoded = decodeFilters(new URLSearchParams("d=6&c=175"));
    assert.equal(decoded.maxDays, 7);
    assert.equal(decoded.maxCost, 200);
    assert.ok(DAY_STOPS.includes(decoded.maxDays));
    assert.ok(COST_STOPS.includes(decoded.maxCost));
  });

  it("drops values the site does not have", () => {
    const decoded = decodeFilters(
      new URLSearchParams("f=beach,teleportation&s=good,someday&shelf=nowhere"),
    );
    assert.deepEqual(decoded.facets, ["beach"]);
    assert.deepEqual(decoded.seasons, ["good"]);
    assert.equal(decoded.shelf, "open");
  });

  it("shrugs off junk in the ceilings", () => {
    const decoded = decodeFilters(new URLSearchParams("d=banana&c=-4"));
    assert.equal(decoded.maxDays, Infinity);
    assert.equal(decoded.maxCost, Infinity);
  });
});

describe("what counts as sifted", () => {
  it("is nothing, by default", () => {
    assert.equal(isSifted(NO_FILTERS), false);
    assert.equal(narrowingCount(NO_FILTERS), 0);
  });

  it("counts the four narrowing controls and not the chips", () => {
    const filters: CatalogFilters = {
      ...NO_FILTERS,
      facets: ["beach", "city"],
      states: ["QLD"],
      seasons: ["good", "ok"],
      maxDays: 5,
    };
    assert.equal(narrowingCount(filters), 4);
    assert.equal(isSifted(filters), true);
  });

  it("counts a shelf on its own", () => {
    assert.equal(isSifted({ ...NO_FILTERS, shelf: "interested" }), true);
    assert.equal(narrowingCount({ ...NO_FILTERS, shelf: "interested" }), 0);
  });
});

describe("the predicate", () => {
  it("keeps the whole Catalog when nothing is set", () => {
    assert.equal(keep(NO_FILTERS).length, CATALOG.length);
  });

  it("gathers with the facet chips rather than narrowing", () => {
    const beach = keep({ ...NO_FILTERS, facets: ["beach"] }).length;
    const city = keep({ ...NO_FILTERS, facets: ["city"] }).length;
    const both = keep({ ...NO_FILTERS, facets: ["beach", "city"] }).length;
    assert.ok(beach > 0 && city > 0);
    assert.ok(both >= Math.max(beach, city));
    assert.ok(both <= beach + city);
  });

  it("ANDs a chip against a region", () => {
    const filters: CatalogFilters = {
      ...NO_FILTERS,
      facets: ["beach"],
      states: ["TAS"],
    };
    const kept = keep(filters);
    assert.ok(kept.length > 0);
    for (const idea of kept) {
      assert.equal(idea.state, "TAS");
      assert.ok(idea.facets.includes("beach"));
    }
  });

  it("filters length on the shortest worthwhile stay", () => {
    for (const idea of keep({ ...NO_FILTERS, maxDays: 2 })) {
      assert.ok(idea.days_min <= 2);
    }
  });

  it("filters cost on the top of the band", () => {
    for (const idea of keep({ ...NO_FILTERS, maxCost: 100 })) {
      assert.ok(idea.costEurMax <= 100);
    }
  });

  it("searches name, region, tags and the why", () => {
    const kept = keep({ ...NO_FILTERS, query: "snorkel" });
    assert.ok(kept.length > 0);
    for (const idea of kept) {
      assert.ok(idea.haystack.includes("snorkel"));
    }
  });

  it("ignores case and surrounding space in the search", () => {
    const plain = keep({ ...NO_FILTERS, query: "reef" }).length;
    const shouted = keep({ ...NO_FILTERS, query: "  REEF " }).length;
    assert.equal(shouted, plain);
  });

  it("sorts in-season first and breaks ties by name", () => {
    const kept = keep(NO_FILTERS);
    const ranks = kept.map((idea) => idea.season_fit_dec_feb);
    const good = ranks.lastIndexOf("good");
    const wrong = ranks.indexOf("no");
    assert.ok(good !== -1 && wrong !== -1);
    assert.ok(good < wrong, "a wrong-window idea sorts below every good one");

    const firstGood = kept.filter((idea) => idea.season_fit_dec_feb === "good");
    const byName = firstGood.map((idea) => idea.name);
    assert.deepEqual(byName, byName.toSorted((a, b) => a.localeCompare(b)));
  });
});

describe("the shelves", () => {
  const marked = CATALOG[0];
  const other = CATALOG[1];
  const marks: ShortlistMap = {
    [marked.id]: "discarded",
    [other.id]: "interested",
  };

  it("hides discarded ideas from the open shelf and nothing else", () => {
    const open = keep(NO_FILTERS, marks);
    assert.equal(open.length, CATALOG.length - 1);
    assert.ok(!open.some((idea) => idea.id === marked.id));
    assert.ok(open.some((idea) => idea.id === other.id));
  });

  it("reads unseen as the absence of a mark", () => {
    const unseen = keep({ ...NO_FILTERS, shelf: "unseen" }, marks);
    assert.equal(unseen.length, CATALOG.length - 2);
  });

  it("shows exactly the marked shelf when one is picked", () => {
    const kept = keep({ ...NO_FILTERS, shelf: "interested" }, marks);
    assert.deepEqual(
      kept.map((idea) => idea.id),
      [other.id],
    );
  });

  it("still reaches a discarded idea through its own shelf", () => {
    const kept = keep({ ...NO_FILTERS, shelf: "discarded" }, marks);
    assert.deepEqual(
      kept.map((idea) => idea.id),
      [marked.id],
    );
  });
});

describe("the two tiers answer to the same controls", () => {
  it("sifts researched Capsules without re-ordering them", () => {
    const kept = siftDeepCapsules(DEEP_CAPSULES, NO_FILTERS, NO_MARKS);
    assert.deepEqual(
      kept.map((capsule) => capsule.id),
      DEEP_CAPSULES.map((capsule) => capsule.id),
    );
  });

  it("narrows the researched tier by region too", () => {
    const kept = siftDeepCapsules(
      DEEP_CAPSULES,
      { ...NO_FILTERS, states: ["TAS"] },
      NO_MARKS,
    );
    assert.ok(kept.length > 0 && kept.length < DEEP_CAPSULES.length);
  });

  it("prices a researched Capsule on its ideal, an idea on its band top", () => {
    const capsule = DEEP_CAPSULES[0];
    assert.equal(
      candidateFromCapsule(capsule).costCeiling,
      capsule.cost.ideal.eur,
    );
    const idea = CATALOG[0];
    assert.equal(candidateFromIdea(idea).costCeiling, idea.costEurMax);
  });

  it("runs one predicate over both projections", () => {
    const filters: CatalogFilters = { ...NO_FILTERS, query: "reef" };
    const needle = searchNeedle(filters);
    const capsule = DEEP_CAPSULES.find((entry) =>
      candidateFromCapsule(entry).haystack.includes("reef"),
    );
    assert.ok(capsule, "the research corpus mentions the reef somewhere");
    assert.equal(
      matchesFilters(candidateFromCapsule(capsule), filters, NO_MARKS, needle),
      true,
    );
  });
});
