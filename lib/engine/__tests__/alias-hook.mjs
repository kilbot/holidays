/**
 * A twenty-line module resolver, so `node --test` can run the engine's own
 * TypeScript with no build step and no dependencies.
 *
 * Node 24 strips types from `.ts` files natively, so the only thing standing
 * between `node --test` and the engine is two resolution details TypeScript
 * has and Node does not:
 *
 * 1. **The `@/` path alias.** `tsconfig.json` maps it to the repo root; Node
 *    reads no tsconfig, so it is mapped here.
 * 2. **Extensionless specifiers.** `import "./ledger"` is legal TypeScript and
 *    not legal ESM, so `.ts` is appended when the bare path does not resolve.
 *
 * Why this rather than a test runner: the ticket's constraint is **no new npm
 * dependencies**, and the repo has no test script at all. `node --test` is in
 * the runtime already. The alternative — compiling the engine to `.mjs` and
 * testing the output — would test a build artefact rather than the source, and
 * would need a build step to keep in step.
 *
 * The engine core is deliberately import-clean for this to work: nothing under
 * test imports `catalog.json` (Node ESM would want an import attribute), React,
 * or anything from `next`. `capsules.ts` does import the research corpus, which
 * is exactly why the adapter is a separate module from the engine.
 *
 * Registered with `node --import ./lib/engine/__tests__/alias-hook.mjs`.
 */

import { register } from "node:module";
import { pathToFileURL } from "node:url";

const ROOT = new URL("../../../", import.meta.url);

/** Runs in the loader thread. */
export async function resolve(specifier, context, nextResolve) {
  let target = specifier;

  if (target.startsWith("@/")) {
    target = new URL(target.slice(2), ROOT).href;
  }

  // TypeScript imports JSON without an import attribute; ESM requires one.
  if (target.endsWith(".json")) {
    const resolved = await nextResolve(target, {
      ...context,
      importAttributes: { type: "json" },
    });
    return { ...resolved, format: "json", importAttributes: { type: "json" } };
  }

  try {
    return await nextResolve(target, context);
  } catch (error) {
    // Extensionless — the TypeScript convention. Try the file it means.
    if (!/\.[a-z]+$/i.test(target)) {
      for (const extension of [".ts", ".tsx", "/index.ts"]) {
        try {
          return await nextResolve(`${target}${extension}`, context);
        } catch {
          // Try the next one.
        }
      }
    }
    throw error;
  }
}

// `--import` runs this file in the main thread; the hooks have to be handed to
// the loader thread explicitly.
if (!process.env.SOUTHBOUND_HOOK_REGISTERED) {
  process.env.SOUTHBOUND_HOOK_REGISTERED = "1";
  register(pathToFileURL(new URL(import.meta.url).pathname));
}
