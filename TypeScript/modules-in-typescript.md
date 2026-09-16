# Modules in TypeScript

TypeScript modules use exactly the same `import`/`export` syntax as native ES Modules — TypeScript doesn't invent a new module system; it type-checks your existing ES Module (or, in older/mixed codebases, CommonJS) code and adds a few TypeScript-specific conveniences on top, like `export type`/`import type` for type-only exports, and the ability to import `.d.ts` declaration files seamlessly alongside regular modules. Any file containing a top-level `import` or `export` is automatically treated as a module (with its own scope), rather than a script (whose declarations leak into the shared global scope) — this file-based module detection is itself a meaningful TypeScript/JS distinction worth knowing.

**Module resolution** is the process by which the compiler figures out what actual file an `import` statement's path string refers to — and this is genuinely one of the more configuration-heavy corners of TypeScript, controlled by the `moduleResolution` `tsconfig.json` option (`node`/`node10`, `node16`/`nodenext`, `bundler`, among others). Different resolution strategies handle file extensions, `package.json` `"exports"` maps, and relative-vs-bare-specifier imports differently — a common source of confusing "cannot find module" errors comes from a mismatch between the `moduleResolution` strategy configured and the actual runtime/bundler the code will run under.

`export type`/`import type` (and the inline `import { type Foo }` form) mark an import/export as existing *only* for type-checking purposes, guaranteeing the compiler can safely elide it entirely from the emitted JavaScript — this matters for tools using single-file transpilation (Babel, esbuild, swc via `isolatedModules`), which can't always tell on their own whether an import is a type or a value without type-checker-level whole-program knowledge, and so rely on this explicit `type` marker to safely strip it during a fast, per-file transpile.

Dynamic `import()` (returning a `Promise` that resolves to the module's exports) works identically to native JavaScript dynamic imports, fully typed — TypeScript infers the resolved module's exported shape from the target file automatically, making code-splitting and lazy-loading patterns fully type-safe without any special annotation needed beyond the `import()` call itself.

## Examples

```ts
// math.ts
export function add(a: number, b: number): number {
  return a + b;
}
export interface Point { x: number; y: number; }
export default class Calculator { /* ... */ }
```

```ts
// main.ts — standard named, default, and type-only imports
import Calculator, { add, type Point } from "./math";
// `type` here guarantees Point is fully erased in the emitted JS — never a real runtime import

const p: Point = { x: 1, y: 2 };
console.log(add(2, 3));
```

```ts
// Dynamic import — fully typed, resolves the module's shape automatically
async function loadMathModule() {
  const math = await import("./math"); // math: typeof import("./math")
  console.log(math.add(1, 2));
}
```

## Common Pitfalls / Gotchas

- Mismatching `moduleResolution` in `tsconfig.json` with the actual bundler/runtime the code targets — this is the most common source of confusing "Cannot find module" errors that only show up in TypeScript, not at actual runtime (or vice versa).
- Forgetting `export type`/`import type` when using a single-file transpiler (`isolatedModules: true`, common with Vite/esbuild/Babel/swc) — without it, some transpilers can't reliably tell a type-only import apart from a value import without whole-program knowledge, occasionally leaving in an import for something that doesn't actually exist at runtime.
- Confusing a "script" file (no top-level `import`/`export`, whose declarations leak into the shared global scope) with a "module" file — accidentally omitting any import/export from a file can cause its top-level declarations to unexpectedly collide with another script file's identically-named declarations.
- Not realizing `import()` (dynamic import) is fully async and returns a `Promise`, unlike a top-level `import` statement, which is resolved synchronously (from the module graph's perspective) at load time — using it interchangeably with a static import is a common mistake for code-splitting beginners.

## Interview Questions & Answers

**Q: What determines whether a `.ts` file is treated as a module versus a global script?**
A: The presence of at least one top-level `import` or `export` statement. A file with neither is treated as a script, and its top-level declarations become part of the shared global scope rather than being isolated to that file.

**Q: What does `import type` do, and why does it matter for build tools like esbuild or Babel?**
A: It marks an import as existing purely for type-checking, guaranteeing it can be fully erased from the emitted JavaScript. Single-file transpilers that don't do full program type-checking (esbuild, Babel, swc) can't always tell on their own whether an import is a type or a runtime value; `import type` gives them an explicit, unambiguous signal so they can safely strip it during a fast, per-file transpile without accidentally leaving in a nonexistent runtime import.

**Q: What is module resolution, and why does it matter which strategy (`node`, `bundler`, `node16`, etc.) is configured?**
A: Module resolution is how the compiler maps an import path string (like `"./utils"` or `"lodash"`) to an actual file on disk, including how it handles file extensions and `package.json` export maps. Different resolution strategies model different real-world runtime/bundler behaviors, so a mismatch between the configured strategy and the environment the code actually runs in commonly produces confusing "module not found" errors that only appear in one context but not the other.

**Q: How does a dynamic `import()` differ from a static `import` statement, both functionally and in terms of typing?**
A: A static `import` is resolved as part of the module graph at load/compile time and its bindings are available synchronously once the module loads. A dynamic `import()` is a function call that returns a `Promise` resolving to the target module's exports, evaluated lazily at runtime — commonly used for code-splitting/lazy-loading. TypeScript fully types the resolved value based on the target module's actual exported shape, with no extra annotation needed.

## Related Topics
- [namespaces.md](./namespaces.md)
- [namespaces-vs-modules.md](./namespaces-vs-modules.md)
- [declaration-files.md](./declaration-files.md)
- [tsconfig.md](./tsconfig.md)
- [compiling-typescript.md](./compiling-typescript.md)
