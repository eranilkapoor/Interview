# TypeScript with JavaScript Interop

TypeScript is designed for gradual, incremental adoption inside existing JavaScript codebases rather than requiring an all-or-nothing rewrite — a mixed project can contain `.ts` and plain `.js` files side by side, with TypeScript configured to check as much (or as little) of the `.js` portion as makes sense for that codebase's migration stage. Two `tsconfig.json` flags control this directly: **`allowJs`** lets the TypeScript compiler process `.js`/`.jsx` files at all (including them in the build/type-check graph, and letting `.ts` files `import` from them), and **`checkJs`** (only meaningful with `allowJs` also enabled) turns on actual type-checking *inside* those `.js` files, rather than just compiling/including them uninspected.

Since plain `.js` files have no `: type` annotation syntax available, `checkJs` derives type information from two sources: **inference** (the same contextual/return-type inference TypeScript always does) and **JSDoc comments** — a structured comment syntax (`/** @param {string} name */`) that TypeScript specifically recognizes and treats as equivalent to real type annotations for checking purposes. This lets a `.js` file get meaningfully strong type-checking (parameter types, return types, even generics via `@template`) without ever changing its file extension or syntax — a powerful, low-friction way to type-check a JavaScript codebase incrementally, file by file, before (or instead of) actually converting anything to `.ts`.

A typical, real-world incremental migration path: start with `allowJs: true` and `checkJs: false` (or `// @ts-check` opt-in per individual file, rather than project-wide) so `.ts` and `.js` can coexist and import from each other without forcing every existing `.js` file to suddenly pass strict type-checking all at once; add JSDoc types to the highest-value/most-bug-prone `.js` files first; gradually flip individual files' extensions to `.ts` as they're touched/rewritten anyway; and only enable `checkJs` project-wide (or `strict` mode broadly) once enough of the codebase is either converted or JSDoc-annotated that doing so doesn't produce an overwhelming, unmanageable wave of new errors all at once.

This gradual-adoption story — genuinely usable at any granularity from "just JSDoc-annotate the trickiest file" up to "fully migrate everything to strict `.ts`" — is one of TypeScript's most practically significant advantages over the many typed-language alternatives that require a wholesale rewrite before any benefit is realized at all.

## Examples

```json
// tsconfig.json enabling gradual JS interop
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "strict": false // often kept looser initially during migration, tightened later
  },
  "include": ["src/**/*"]
}
```

```js
// utils.js — type-checked via JSDoc, with zero actual TypeScript syntax
/**
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function add(a, b) {
  return a + b;
}
// add("1", 2); // Flagged by checkJs: Argument of type 'string' is not assignable to 'number'

module.exports = { add };
```

```ts
// A .ts file freely importing from the JSDoc-typed .js file above — fully type-checked interop
import { add } from "./utils";
const total: number = add(2, 3); // works, and is checked against utils.js's JSDoc-derived types
```

```js
// Per-file opt-in checking without project-wide checkJs — useful for a very gradual migration
// @ts-check
/**
 * @param {string} name
 */
function greet(name) {
  return name.toUpperCase(); // now checked, even though checkJs isn't enabled project-wide
}
```

## Common Pitfalls / Gotchas

- Enabling `checkJs` project-wide on a large existing JavaScript codebase all at once — this can surface an overwhelming number of latent type issues simultaneously; prefer the per-file `// @ts-check` opt-in, or converting/annotating files incrementally, especially early in a migration.
- Forgetting `checkJs` has no effect without `allowJs` also being enabled — the two flags work together; `checkJs` alone does nothing on its own.
- Writing incorrect or incomplete JSDoc type annotations and assuming they're being validated as rigorously as real TypeScript syntax — JSDoc-based typing is generally just as capable, but easier to get subtly wrong syntactically (a malformed `@param` tag can silently fail to apply any type checking at all, rather than raising a clear error).
- Assuming `.js` files under `checkJs` get the exact same defaults as `.ts` files (e.g., regarding implicit `any`) — behavior can differ subtly depending on configuration, and it's worth explicitly verifying a given `.js` file is actually being checked as strictly as intended, rather than assuming it matches `.ts` file behavior exactly.

## Interview Questions & Answers

**Q: What's the difference between `allowJs` and `checkJs` in `tsconfig.json`?**
A: `allowJs` lets the TypeScript compiler include and process `.js`/`.jsx` files in the build at all (so `.ts` files can import from them, and they're part of the compiled output). `checkJs`, which only matters when `allowJs` is also enabled, additionally turns on real type-checking *inside* those `.js` files, rather than just including them uninspected.

**Q: How can a plain `.js` file get meaningful type checking without switching to `.ts` syntax?**
A: Through JSDoc comments (`/** @param {string} name */`, `@returns`, etc.), which TypeScript recognizes and treats equivalently to real type annotations when `checkJs` is enabled. This allows genuinely strong type checking — parameter types, return types, even some generics — on files that remain plain JavaScript in every other respect.

**Q: What's a sensible incremental strategy for adopting TypeScript checking across a large existing JavaScript codebase?**
A: Start with `allowJs` on and `checkJs` off (or off project-wide, using per-file `// @ts-check` opt-ins instead); add JSDoc types to the highest-value files first; gradually convert individual files to `.ts` as they're naturally touched; and only flip `checkJs`/`strict` on project-wide once enough of the codebase is ready that doing so doesn't surface an unmanageable wave of new errors all at once.

**Q: Can a `.ts` file import from a plain `.js` file, and vice versa, in a mixed project?**
A: Yes, as long as `allowJs` is enabled — `.ts` files can freely `import` from `.js` files (getting inferred or JSDoc-derived types for whatever's imported), and `.js` files can `require`/`import` from `.ts` files as well, letting the two coexist and interoperate throughout an incremental migration.

## Related Topics
- [tsconfig.md](./tsconfig.md)
- [declaration-files.md](./declaration-files.md)
- [strict-mode.md](./strict-mode.md)
- [introduction-to-typescript.md](./introduction-to-typescript.md)
- [compiling-typescript.md](./compiling-typescript.md)
