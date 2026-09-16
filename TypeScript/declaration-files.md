# Declaration Files (.d.ts) and Ambient Declarations

A declaration file, ending in `.d.ts`, contains **only type information** — interfaces, type aliases, function/class signatures, and variable declarations — with no actual implementation code (no function bodies, no runtime logic). Its entire purpose is to describe the shape of code that exists elsewhere (a compiled `.js` file, a library, a global variable a `<script>` tag introduces) so that TypeScript's type checker and editor tooling can understand and check against it, without needing to see or re-compile the original implementation. When you `tsc`-compile a `.ts` file with `declaration: true` set, the compiler automatically generates a matching `.d.ts` file alongside the emitted `.js`, which is how published npm packages typically ship type information for their consumers.

**Ambient declarations** — using the `declare` keyword — assert that something exists at runtime without TypeScript needing to see its actual implementation or emit any code for it. `declare function myGlobalFn(x: number): void;` tells the compiler "trust that this function exists somewhere at runtime (e.g., loaded via a `<script>` tag, or provided by the host environment) — just check code that calls it against this signature." `declare global { interface Window { myCustomProp: string; } }` is the standard pattern for augmenting a well-known global type (like `Window`) from within a module file, since declarations inside a module file are normally scoped to that module rather than the true global scope.

Most well-maintained modern libraries ship their own `.d.ts` files (often generated automatically from their own TypeScript source), but for libraries written in plain JavaScript with no bundled types, the community-maintained **DefinitelyTyped** project (installed via `@types/package-name` packages, e.g. `npm install --save-dev @types/lodash`) provides community-written declaration files, which TypeScript automatically picks up from `node_modules/@types` with no extra configuration needed in most setups.

Writing your own `.d.ts` file becomes necessary in a few recurring situations: describing a legacy global library with no published types anywhere, adding type support for non-JS assets your bundler lets you `import` (like CSS Modules or SVGs, via a wildcard module declaration `declare module "*.svg"`), or patching/extending an existing library's types locally (see [module-augmentation.md](./module-augmentation.md) for the closely related declaration-merging technique used for that last case).

## Examples

```ts
// A hand-written declaration file for a legacy global library with no published types
// legacy-lib.d.ts
declare function initLegacyWidget(selector: string, options?: { theme: string }): void;
declare const LegacyWidgetVersion: string;

// Usage elsewhere in the project — fully type-checked, even though this is just a runtime global
initLegacyWidget("#app", { theme: "dark" });
```

```ts
// Ambient module declarations for non-JS assets your bundler handles specially
// assets.d.ts
declare module "*.svg" {
  const content: string; // e.g., a URL, depending on the bundler's SVG-loading behavior
  export default content;
}
declare module "*.css" {
  const classes: { [className: string]: string };
  export default classes;
}
// Now `import logo from "./logo.svg";` and `import styles from "./app.css";` both type-check
```

```ts
// declare global — augmenting a true global type from within a module file
export {}; // presence of export/import makes this file a module, so `declare global` is needed
declare global {
  interface Window {
    myAnalytics: (event: string) => void;
  }
}
window.myAnalytics("page_view"); // now type-checks correctly against the augmented Window
```

## Common Pitfalls / Gotchas

- Writing actual implementation logic (function bodies, executable statements) inside a `.d.ts` file — declaration files are type-only; the compiler ignores/rejects real implementation code there, since their entire purpose is describing a shape, not providing behavior.
- Forgetting `export {}` (or any real import/export) at the top of a file that uses `declare global` — without something making the file a module, its declarations are already in the global scope by default, and `declare global` specifically requires the surrounding file to be a module for that augmentation syntax to apply correctly.
- Installing an `@types/package-name` package for a library that already ships its own bundled `.d.ts` files — this is usually harmless but redundant, and can occasionally cause type conflicts if the two disagree; check the library's own `package.json` `"types"`/`"typings"` field first.
- Assuming a `.d.ts` file is automatically kept in sync with its corresponding `.js` implementation when hand-written — unlike a compiler-generated `.d.ts` (from `declaration: true`), a manually maintained declaration file can silently drift out of sync with the actual runtime behavior it's meant to describe, since nothing enforces the two stay consistent.

## Interview Questions & Answers

**Q: What is a `.d.ts` declaration file, and what does it contain?**
A: A file containing only type information — interfaces, type aliases, and function/variable/class signatures — with no actual implementation code. It describes the shape of code that exists elsewhere (a compiled JS file, a library, a runtime global) so TypeScript can type-check against it without needing the original source.

**Q: What does the `declare` keyword do, and why would you use it?**
A: It creates an ambient declaration — asserting that something (a variable, function, module, or global) exists at runtime without TypeScript needing to see an actual implementation or emit any code for it. It's used to type things TypeScript can't infer on its own, like a global provided by a `<script>` tag or a non-JS asset your bundler handles specially.

**Q: What is DefinitelyTyped / `@types` packages, and when would you need one?**
A: DefinitelyTyped is a community-maintained repository of `.d.ts` declaration files for JavaScript libraries that don't ship their own bundled types. Installing the matching `@types/package-name` package (e.g., `@types/lodash`) gives TypeScript type information for that library, automatically picked up from `node_modules/@types` in most standard project setups.

**Q: Why is `export {}` sometimes needed at the top of a file that uses `declare global`?**
A: `declare global` is meant to augment the true global scope from within a module file — but a file with no `import`/`export` at all is already treated as a global script, not a module, making the `declare global` augmentation syntax unnecessary/invalid in that context. Adding `export {}` (an empty export) forces the file to be treated as a module, which is the context `declare global` is designed to be used from.

## Related Topics
- [namespaces.md](./namespaces.md)
- [module-augmentation.md](./module-augmentation.md)
- [modules-in-typescript.md](./modules-in-typescript.md)
- [typescript-with-javascript-interop.md](./typescript-with-javascript-interop.md)
- [compiling-typescript.md](./compiling-typescript.md)
