import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { firstParagraph, plainDescription } from "@/lib/markdown-description";

for (const [name, markdown, expected] of [
  ["bold", "**bold** and __bold__", "bold and bold"],
  ["asterisk italic", "*italic*", "italic"],
  ["underscore italic", "_italic_", "italic"],
  ["link", "Visit [Perth](https://example.com)", "Visit Perth"],
  ["inline code", "Use `x` here", "Use x here"],
  ["whitespace", "  one\t two\n\nthree  ", "one two three"],
  ["short plain text", "A short description.", "A short description."],
]) {
  test(`plainDescription handles ${name}`, () => {
    assert.equal(plainDescription(markdown), expected);
  });
}

test("truncates at the last space at or before the limit", () => {
  assert.equal(plainDescription("one two three four", 8), "one two…");
  assert.equal(plainDescription("one two three four", 10), "one two…");
});

test("strips trailing punctuation and spaces before the ellipsis", () => {
  assert.equal(plainDescription("one ,;:.–—- two three", 12), "one…");
});

test("returns text at the limit unchanged", () => {
  assert.equal(plainDescription("one two", 7), "one two");
});

test("hard-cuts a long string with no spaces", () => {
  assert.equal(plainDescription("x".repeat(200)), "x".repeat(159) + "…");
});

test("cleans Markdown and whitespace before applying the length limit", () => {
  assert.equal(plainDescription(" **[one](url)**  `two` ", 7), "one two");
});

test("firstParagraph skips headings, lists, quotes, tables and thematic breaks", () => {
  assert.equal(firstParagraph("# H\n\n- a\n* b\n+ c\n1. d\n2) e\n> q\n| t |\n---\n***"), undefined);
});

test("firstParagraph includes italic and bold prose", () => {
  assert.equal(firstParagraph("# H\n\n*Italic intro.*\n\nLater."), "*Italic intro.*");
  assert.equal(firstParagraph("- item\n**Bold** lead."), "**Bold** lead.");
});

test("firstParagraph trims prose", () => {
  assert.equal(firstParagraph("  \n  Plain.  "), "Plain.");
});

test("makes the flights-december first paragraph a plain description", () => {
  const markdown = readFileSync("content/pages/flights-december.md", "utf8");
  const paragraph = firstParagraph(markdown);
  assert.ok(typeof paragraph === "string" && paragraph.length > 0);

  const description = plainDescription(paragraph);
  assert.ok(description.length > 0);
  assert.doesNotMatch(description, /[*_\[`]/);
  assert.ok(description.length <= 160);
});
