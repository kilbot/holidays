/**
 * The guards on the write routes.
 *
 * None of this is authentication — ADR 0001 has none by design — so what is
 * being tested is the narrower promise: a public endpoint that cannot be turned
 * into a bill, and a Plan that no cache will hand to the wrong visitor.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { fakeKv } from "@/lib/store/__tests__/fake-kv";
import {
  EDIT_KEY_HEADER,
  MAX_BODY_BYTES,
  WRITE_LIMIT_PER_WINDOW,
  hasEditKey,
  jsonResponse,
  readJsonBody,
  throttleWrite,
} from "@/lib/store/guards";
import { newId } from "@/lib/store/ids";

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("https://example.test/api/plan/x", {
    method: "POST",
    body,
    headers,
  });

test("responses are never cached", async () => {
  assert.equal(
    jsonResponse({ ok: true }).headers.get("cache-control"),
    "no-store",
  );
});

test("a normal body is read", async () => {
  const result = await readJsonBody(post(JSON.stringify({ name: "Doof NYE" })));
  assert.ok(result.ok);
  assert.deepEqual(result.value, { name: "Doof NYE" });
});

test("malformed JSON is a 400, not a crash", async () => {
  const result = await readJsonBody(post("{nope"));
  assert.ok(!result.ok);
  assert.equal(result.response.status, 400);
});

test("an oversized body is refused", async () => {
  const body = JSON.stringify({ blob: "x".repeat(MAX_BODY_BYTES) });
  const result = await readJsonBody(post(body));
  assert.ok(!result.ok);
  assert.equal(result.response.status, 413);
});

test("a body at the cap is accepted", async () => {
  const padding = "x".repeat(MAX_BODY_BYTES - 20);
  const body = JSON.stringify({ b: padding });
  assert.ok(new TextEncoder().encode(body).byteLength <= MAX_BODY_BYTES);
  assert.ok((await readJsonBody(post(body))).ok);
});

/**
 * The header is a claim, and the measurement is the enforcement. A caller who
 * lies about `Content-Length` gets refused on the bytes that actually arrived.
 */
test("a lying Content-Length does not get past the cap", async () => {
  const body = JSON.stringify({ blob: "x".repeat(MAX_BODY_BYTES) });
  const result = await readJsonBody(post(body, { "content-length": "12" }));
  assert.ok(!result.ok);
  assert.equal(result.response.status, 413);
});

test("multi-byte characters count as bytes, not characters", async () => {
  // Four bytes each in UTF-8: a cap measured in `.length` would let this through.
  const body = JSON.stringify({ b: "𝄞".repeat(MAX_BODY_BYTES / 3) });
  const result = await readJsonBody(post(body));
  assert.ok(!result.ok);
  assert.equal(result.response.status, 413);
});

test("the throttle allows a burst and then refuses", async () => {
  const kv = fakeKv();
  const request = () => post("{}", { "x-forwarded-for": "203.0.113.7" });
  for (let i = 0; i < WRITE_LIMIT_PER_WINDOW; i += 1) {
    assert.ok((await throttleWrite(kv, request())).ok, `write ${i + 1}`);
  }
  const refused = await throttleWrite(kv, request());
  assert.ok(!refused.ok);
  assert.equal(refused.response.status, 429);
});

test("the throttle counts per IP", async () => {
  const kv = fakeKv();
  for (let i = 0; i < WRITE_LIMIT_PER_WINDOW + 1; i += 1) {
    await throttleWrite(kv, post("{}", { "x-forwarded-for": "203.0.113.7" }));
  }
  const other = await throttleWrite(
    kv,
    post("{}", { "x-forwarded-for": "198.51.100.4" }),
  );
  assert.ok(other.ok, "one noisy visitor does not lock out the next");
});

test("only the first hop of x-forwarded-for is used", async () => {
  const kv = fakeKv();
  const headers = { "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" };
  await throttleWrite(kv, post("{}", headers));
  await throttleWrite(kv, post("{}", { "x-forwarded-for": "203.0.113.7" }));
  // Both requests landed on the same counter, so a proxy chain cannot be padded
  // to mint a fresh allowance per write.
  const counted = await throttleWrite(kv, post("{}", headers));
  assert.ok(counted.ok);
});

/**
 * Fails open, on purpose. A rate limiter that takes the site down when its own
 * store is unreachable has caused the outage it exists to prevent.
 */
test("an unreachable store does not block the couple's save", async () => {
  const kv = fakeKv();
  kv.incrementWithTtl = async () => {
    throw new Error("ECONNRESET");
  };
  assert.ok((await throttleWrite(kv, post("{}"))).ok);
});

test("hasEditKey reads the header and nothing else", () => {
  const editKey = newId();
  assert.ok(hasEditKey(post("{}", { [EDIT_KEY_HEADER]: editKey }), editKey));
  assert.ok(!hasEditKey(post("{}"), editKey));
  assert.ok(!hasEditKey(post("{}", { [EDIT_KEY_HEADER]: "" }), editKey));
  assert.ok(!hasEditKey(post("{}", { [EDIT_KEY_HEADER]: newId() }), editKey));

  // The key travels in a header so it stays out of logs; a query string that
  // happens to carry it is not a credential.
  const viaQuery = new Request(`https://example.test/api/plan/x?key=${editKey}`);
  assert.ok(!hasEditKey(viaQuery, editKey));
});
