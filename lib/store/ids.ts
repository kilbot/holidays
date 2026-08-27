/**
 * Unguessable ids, and the constant-time compare that guards one of them.
 *
 * `docs/adr/0001-link-as-permission-sharing.md`: *"holding a URL is the
 * permission"*. There are no accounts, so the id in a link **is** the
 * credential — which makes the quality of these sixteen characters the whole
 * of the security model, such as it is.
 *
 * Sixteen base58 characters is ~93 bits of entropy from `crypto.getRandomValues`.
 * For an audience of two plus their friends, against a site with no rate-limited
 * secret worth guessing, that is far past sufficient — and it is hand-rolled
 * because the ticket allows exactly one new dependency and it is not nanoid.
 *
 * No imports, no `window`, no `process`: this module runs in the route handler,
 * in the browser and in `node --test` unchanged.
 */

/**
 * Bitcoin's base58 — the digits and letters minus `0`, `O`, `I` and `l`.
 *
 * The omissions matter here. These ids are read aloud, pasted out of chat
 * messages and occasionally re-typed from a phone screen, and an alphabet where
 * no two characters look alike is worth more than the two bits it costs.
 */
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Long enough that guessing is hopeless, short enough to sit in a URL. */
export const ID_LENGTH = 16;

/**
 * A fresh id.
 *
 * The rejection loop is what keeps it uniform: 256 is not a multiple of 58, so
 * taking `byte % 58` would make the first four characters of the alphabet ~10%
 * likelier than the rest. Bytes at or above the largest usable multiple are
 * thrown away and redrawn instead. The expected number of wasted bytes across a
 * 16-character id is under two.
 */
export function newId(length: number = ID_LENGTH): string {
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let out = "";
  const buffer = new Uint8Array(length);
  while (out.length < length) {
    crypto.getRandomValues(buffer);
    for (const byte of buffer) {
      if (byte >= limit) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

/** Whether a string could be one of ours. Cheap reject before a store round-trip. */
export function isPlausibleId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length === ID_LENGTH &&
    [...value].every((character) => ALPHABET.includes(character))
  );
}

/**
 * Constant-time string equality, for the edit key.
 *
 * `a === b` on strings short-circuits at the first differing character, and the
 * time that takes is a measurable function of how many leading characters the
 * attacker got right — enough, in principle, to walk a secret out one character
 * at a time. This compares every character of both strings and accumulates the
 * differences in a bitwise OR, so the work done is the same whether the strings
 * match on the first character or the last.
 *
 * Lengths are folded into the result rather than returned early, for the same
 * reason. `crypto.timingSafeEqual` would do this in Node, but the Edge runtime
 * has no `node:crypto` and the honest version is eight lines.
 */
export function secretsMatch(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  // An empty secret matching an empty secret would mean a Plan whose meta
  // document lost its key is editable by a request that sends no key at all.
  if (a.length === 0 || b.length === 0) return false;
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    // `charCodeAt` past the end is NaN; `|| 0` keeps the XOR arithmetic honest
    // without branching on which string ran out first.
    difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return difference === 0;
}
