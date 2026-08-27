/**
 * The four things every write route does before it does anything else.
 *
 * There is no auth system here — `docs/adr/0001-link-as-permission-sharing.md`
 * is explicit that holding a URL is the permission — so these guards are not
 * security in any serious sense. They are the difference between a public
 * endpoint and a public endpoint that can be turned into a bill: a body cap so
 * nobody stores a novel in the couple's Redis, a per-IP throttle so nobody
 * stores ten thousand of them, an edit-key check that does not leak its answer
 * through timing, and `no-store` on every response so a CDN never hands one
 * visitor's Plan to another.
 */

import { secretsMatch } from "@/lib/store/ids";
import type { KvClient } from "@/lib/store/kv";

/**
 * The largest write this site accepts.
 *
 * A `PlanInput` is a handful of arrays and records of short ids; the canonical
 * Plan is a list of those. Measured, the reference trip's whole document is
 * about 2 KB, so 100 KB is roughly fifty times the real thing — generous enough
 * that no honest Plan is ever refused, small enough that the store cannot be
 * used as free file hosting.
 */
export const MAX_BODY_BYTES = 100 * 1024;

/** Writes allowed from one IP per window. Well above human, far below a script. */
export const WRITE_LIMIT_PER_WINDOW = 20;
/** The throttle window, in seconds. */
export const THROTTLE_WINDOW_SECONDS = 60;

/** The header the edit key travels in. Never a query parameter — those get logged. */
export const EDIT_KEY_HEADER = "x-southbound-edit-key";

/**
 * Every response from these routes, with caching off.
 *
 * `no-store` rather than `no-cache`: the Plan is a single mutable document
 * behind one URL, and a Vercel edge cache that held it for even a few seconds
 * would show the couple a stale itinerary immediately after they saved it.
 */
export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

/**
 * Read a JSON body, or explain why not.
 *
 * The cap is checked twice on purpose. `Content-Length` is a claim the client
 * makes and a hostile one can simply lie or omit it, so the header check is
 * only there to reject the honest-but-oversized case before any bytes are read;
 * the real enforcement is measuring the text that actually arrived.
 */
export async function readJsonBody(
  request: Request,
): Promise<
  { ok: true; value: unknown } | { ok: false; response: Response }
> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { ok: false, response: errorResponse("Body too large", 413) };
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, response: errorResponse("Unreadable body", 400) };
  }

  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return { ok: false, response: errorResponse("Body too large", 413) };
  }

  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, response: errorResponse("Malformed JSON", 400) };
  }
}

/**
 * Whether this IP has written too much lately.
 *
 * A counter per IP per fixed window, in the same Redis the Plan lives in — no
 * new dependency and no new service for what is, at this traffic, a formality.
 * The window is fixed rather than sliding, which means a caller can land two
 * full windows' worth of writes across a boundary; at 40 writes that is not a
 * problem worth a sorted set.
 *
 * It fails **open**. If the store is unreachable the throttle cannot answer, and
 * refusing the couple's save because the rate limiter is down would be the
 * limiter causing the outage it exists to prevent.
 */
export async function throttleWrite(
  kv: KvClient,
  request: Request,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const window = Math.floor(Date.now() / (THROTTLE_WINDOW_SECONDS * 1000));
  const key = `throttle:${clientIp(request)}:${window}`;
  try {
    const count = await kv.incrementWithTtl(key, THROTTLE_WINDOW_SECONDS);
    if (count > WRITE_LIMIT_PER_WINDOW) {
      return {
        ok: false,
        response: errorResponse("Too many writes — try again in a minute", 429),
      };
    }
  } catch {
    return { ok: true };
  }
  return { ok: true };
}

/**
 * Who is asking, as far as the platform will say.
 *
 * Vercel sets `x-forwarded-for` and it is the only source available in a route
 * handler. It is spoofable by anyone who cares, which is fine: this throttles
 * accidents and casual scripts, not adversaries — and the ADR already accepts
 * that anyone holding a link can do what the link allows.
 */
function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "unknown";
}

/** Whether the request carries the Plan's edit key. Constant-time. */
export function hasEditKey(request: Request, editKey: string): boolean {
  return secretsMatch(request.headers.get(EDIT_KEY_HEADER), editKey);
}
