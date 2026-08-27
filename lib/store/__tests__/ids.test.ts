/**
 * The id generator and the edit-key compare.
 *
 * These sixteen characters are the entire security model — ADR 0001 makes
 * holding a URL the permission — so the properties worth asserting are the ones
 * that would quietly stop being true: the alphabet, the uniformity, and the
 * fact that the compare looks at every character.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ID_LENGTH, isPlausibleId, newId, secretsMatch } from "@/lib/store/ids";

test("ids are the advertised length and alphabet", () => {
  for (let i = 0; i < 200; i += 1) {
    const id = newId();
    assert.equal(id.length, ID_LENGTH);
    assert.match(id, /^[1-9A-HJ-NP-Za-km-z]+$/);
    // The look-alikes base58 drops, so an id can be read off a screen.
    assert.ok(!/[0OIl]/.test(id), `${id} contains an ambiguous character`);
  }
});

test("ids do not repeat", () => {
  const ids = new Set(Array.from({ length: 2000 }, () => newId()));
  assert.equal(ids.size, 2000);
});

test("a custom length is honoured", () => {
  assert.equal(newId(4).length, 4);
  assert.equal(newId(40).length, 40);
});

/**
 * The rejection loop's reason for existing. `byte % 58` without it would make
 * the first 24 characters of the alphabet about 10% likelier than the rest; a
 * large sample shows that as a visible gap between the most and least common.
 */
test("the alphabet is used roughly uniformly", () => {
  const counts = new Map<string, number>();
  for (const character of newId(60_000)) {
    counts.set(character, (counts.get(character) ?? 0) + 1);
  }
  assert.equal(counts.size, 58, "every character should appear");
  const frequencies = [...counts.values()];
  const low = Math.min(...frequencies);
  const high = Math.max(...frequencies);
  // Expected ~1034 per character. A modulo bias would put the top group ~10%
  // above the bottom systematically; sampling noise alone stays well inside 25%.
  assert.ok(
    high / low < 1.25,
    `spread ${low}..${high} looks biased, not random`,
  );
});

test("isPlausibleId rejects everything that is not one of ours", () => {
  assert.ok(isPlausibleId(newId()));
  assert.ok(!isPlausibleId(""));
  assert.ok(!isPlausibleId(null));
  assert.ok(!isPlausibleId(123));
  assert.ok(!isPlausibleId(newId(15)), "wrong length");
  assert.ok(!isPlausibleId(newId(17)), "wrong length");
  assert.ok(!isPlausibleId("0".repeat(ID_LENGTH)), "0 is not in base58");
  assert.ok(!isPlausibleId("plan:aaaaaaaaaa"), "no key injection");
});

test("secretsMatch accepts only an exact match", () => {
  const key = newId();
  // A fixed substitute (say "Z") is itself base58, so ~1 run in 58 it would
  // equal the character it replaces and the mismatch below would not exist.
  const flip = (c: string) => (c === "1" ? "2" : "1");
  assert.ok(secretsMatch(key, key));
  assert.ok(secretsMatch(`${key}`, key), "value equality, not identity");
  assert.ok(!secretsMatch(key, `${key}x`));
  assert.ok(!secretsMatch(key.slice(0, -1), key));
  assert.ok(
    !secretsMatch(`${key.slice(0, -1)}${flip(key[key.length - 1]!)}`, key),
    "last character differs",
  );
  assert.ok(
    !secretsMatch(`${flip(key[0]!)}${key.slice(1)}`, key),
    "first character differs",
  );
  assert.ok(!secretsMatch("", ""), "an absent key is never a match");
});

test("secretsMatch treats a missing header as a mismatch, not a crash", () => {
  const key = newId();
  assert.ok(!secretsMatch(null, key));
  assert.ok(!secretsMatch(undefined, key));
  assert.ok(!secretsMatch(key, null));
  assert.ok(!secretsMatch({ toString: () => key }, key));
});

/**
 * The compare must not short-circuit.
 *
 * A wall-clock timing assertion would be flaky, so this asserts the shape
 * instead: a candidate sharing a long prefix with the key and one sharing
 * nothing both come back false, and the function is written to read every
 * character of both. The property that would break — an early `return false` on
 * the first differing character — cannot be caught by output alone, so the test
 * pins the behaviour that makes it *possible* to write correctly: equal-length
 * inputs of every prefix overlap are handled identically.
 */
test("prefix overlap does not change the answer", () => {
  const key = newId(32);
  for (let shared = 0; shared < key.length; shared += 1) {
    const candidate = key.slice(0, shared) + "~".repeat(key.length - shared);
    assert.equal(secretsMatch(candidate, key), false);
  }
  assert.equal(secretsMatch(key, key), true);
});
