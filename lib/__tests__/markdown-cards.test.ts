import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { headingSlug, sectionIndex, splitCards } from "@/lib/markdown-cards";

test("headingSlug normalizes region and card titles", () => {
  assert.equal(headingSlug("Western Australia"), "western-australia");
  assert.equal(headingSlug("Huon Valley base: Cygnet or Franklin"), "huon-valley-base-cygnet-or-franklin");
  assert.equal(headingSlug("  New Year's Eve!  "), "new-year-s-eve");
});

test("sectionIndex counts level-3 cards under each region", () => {
  assert.deepEqual(sectionIndex("# T\nintro\n## One\n### a\n#### deep\n### b\n## Two Words\n### c"), [
    { id: "one", title: "One", cards: 2 },
    { id: "two-words", title: "Two Words", cards: 1 },
  ]);
});

test("sectionIndex lists the options page regions and card counts", () => {
  const markdown = readFileSync(path.join(process.cwd(), "content", "pages", "options.md"), "utf8");
  const sections = sectionIndex(markdown);
  assert.deepEqual(sections.map(({ title }) => title), ["Western Australia", "Sydney", "Tasmania", "Northern Rivers"]);
  assert.deepEqual(sections.map(({ cards }) => cards), [7, 6, 8, 6]);
});

test("level 2 groups each section as a card", () => {
  assert.deepEqual(splitCards("# T\n- a\n## One\nx\n## Two\ny", 2), [
    { card: false, markdown: "# T\n- a" },
    { card: true, markdown: "## One\nx" },
    { card: true, markdown: "## Two\ny" },
  ]);
});

test("level 3 leaves region headings outside the cards", () => {
  assert.deepEqual(
    splitCards("# T\n## Region\n### A\nx\n### B\ny\n## Other\n### C\nz", 3),
    [
      { card: false, markdown: "# T" },
      { card: false, markdown: "## Region" },
      { card: true, markdown: "### A\nx" },
      { card: true, markdown: "### B\ny" },
      { card: false, markdown: "## Other" },
      { card: true, markdown: "### C\nz" },
    ],
  );
});

test("a deeper heading stays inside a level-2 card", () => {
  assert.deepEqual(splitCards("## One\nx\n### Detail\ny", 2), [
    { card: true, markdown: "## One\nx\n### Detail\ny" },
  ]);
});

test("the scenarios page has four numbered cards", () => {
  const markdown = readFileSync(path.join(process.cwd(), "content", "pages", "scenarios.md"), "utf8");
  const cards = splitCards(markdown, 2).filter((chunk) => chunk.card);
  assert.equal(cards.length, 4);
  cards.forEach((card, index) => {
    assert.ok(card.markdown.startsWith(`## ${index + 1} ·`));
  });
});

test("every adventures option has a cost and sources", () => {
  const markdown = readFileSync(path.join(process.cwd(), "content", "pages", "options.md"), "utf8");
  const cards = splitCards(markdown, 3).filter((chunk) => chunk.card);
  assert.ok(cards.length >= 20);
  for (const card of cards) {
    assert.ok(card.markdown.includes("**Cost for two:**"));
    assert.ok(card.markdown.includes("**Sources:**"));
  }
});
