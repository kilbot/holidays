import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { plainDescription } from "@/lib/markdown-description";

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

test("makes the flights-december first paragraph a plain, capped description", () => {
  const markdown = readFileSync("content/pages/flights-december.md", "utf8");
  const lines = markdown.split("\n").map((line) => line.trim());
  const paragraph = lines.find((line) => line !== "" && !/^[#>|*\-\d]/.test(line));
  assert.ok(paragraph);

  const description = plainDescription(paragraph);
  assert.doesNotMatch(description, /[*_\[`]/);
  assert.ok(description.length <= 160);
  assert.ok(description.endsWith("…"));
});
