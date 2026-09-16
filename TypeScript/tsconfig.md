# tsconfig.json (Key Compiler Options)

`tsconfig.json`, placed at a project's root, is how you configure the TypeScript compiler — which files to include, how strictly to type-check them, what JavaScript version and module format to emit, and dozens of other behaviors. Running `tsc` with no arguments in a directory containing this file automatically picks it up; editors (VS Code and others) also read it to drive the in-editor Language Service, meaning your `tsconfig.json` settings shape the red squiggly lines you see while typing, not just what happens when you actually run the compiler.

Some of the most consequential options: **`target`** sets which ECMAScript version the emitted JavaScript should conform to (`"ES2020"`, `"ESNext"`, etc.) — this affects both syntax downleveling (e.g., converting async/await to generator-based polyfills for old targets) and which built-in APIs TypeScript assumes are available for type-checking (paired with `lib`). **`module`** controls the emitted module format (`"CommonJS"`, `"ESNext"`, `"NodeNext"`) — this needs to match how the code will actually be consumed (Node.js `require`, a bundler, native browser ESM). **`strict`** is a single flag that turns on a whole bundle of stricter type-checking sub-flags at once (covered in depth in [strict-mode.md](./strict-mode.md)) and is almost universally recommended for any new project. **`esModuleInterop`** (and its close relative `allowSyntheticDefaultImports`) smooths over the historical mismatch between CommonJS's `module.exports` and ES Modules' `export default`, letting you write `import React from "react"` against a CommonJS-authored package instead of the more awkward `import * as React from "react"`.

Other frequently-tuned options: **`outDir`**/**`rootDir`** control where compiled output goes and which directory is treated as the source root; **`declaration`** (paired with `declarationMap`) generates `.d.ts` files alongside compiled output, essential for any published library; **`sourceMap`** generates debugging source maps; **`skipLibCheck`** skips type-checking inside `.d.ts` files (commonly enabled purely for faster builds, at the cost of not catching type errors originating from a dependency's own type definitions); **`isolatedModules`** enforces that every file can be safely transpiled independently, one file at a time, which is required when using a non-type-aware transpiler (Babel, esbuild, swc) instead of the full `tsc` type checker for the actual build step; **`paths`** (with `baseUrl`) configures custom module-path aliases (e.g., mapping `"@/components/*"` to a real directory), which needs matching configuration in whatever bundler/runtime actually resolves those paths at build/run time, since TypeScript's `paths` setting only affects type-checking, not actual module resolution.

`tsconfig.json` also supports `extends`, letting one config inherit from and override a shared base config — common in monorepos with a root `tsconfig.base.json` that individual packages extend, layering project-specific overrides (like a different `outDir`) on top of consistent, shared strictness and language-target settings.

## Examples

```json
// A representative, modern strict tsconfig.json for an application
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

```json
// isolatedModules — required when a non-type-checking transpiler (esbuild/Babel/swc) does the build
{
  "compilerOptions": {
    "isolatedModules": true,
    "verbatimModuleSyntax": true // TS 5+: enforces explicit `import type`/`export type` everywhere needed
  }
}
```

```json
// A monorepo base config, extended by individual packages
// tsconfig.base.json
{
  "compilerOptions": { "strict": true, "target": "ES2022", "module": "ESNext" }
}
// packages/api/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src" },
  "include": ["src/**/*"]
}
```

## Common Pitfalls / Gotchas

- Setting `target` and `lib` inconsistently — e.g., targeting an old JS version while still using modern runtime APIs (like `Array.prototype.flat`) that aren't polyfilled, producing code that type-checks fine but crashes at runtime in an environment that doesn't actually support those APIs.
- Enabling `skipLibCheck` and treating it as risk-free — it speeds up builds by skipping type-checking inside all `.d.ts` files, but this also means a genuinely broken or conflicting type definition shipped by a dependency won't be caught, potentially surfacing as a confusing downstream error in your own code instead.
- Setting `module`/`moduleResolution` without considering the actual runtime/bundler consuming the output — a mismatch (e.g., configuring `CommonJS` output for a project actually bundled and shipped as native ESM) causes real interop bugs, not just type errors.
- Configuring `paths` for custom import aliases without separately configuring the same aliases in the bundler/runtime that actually resolves modules at build/run time — `tsconfig.json`'s `paths` only affects TypeScript's own type-checking and editor experience; it has zero effect on actual module resolution unless something else (webpack, Vite, Node's own path mapping, etc.) is configured to match.

## Interview Questions & Answers

**Q: What's the difference between `target` and `module` in `tsconfig.json`?**
A: `target` controls which ECMAScript language version the emitted JavaScript syntax conforms to (affecting syntax downleveling and available built-in APIs via `lib`). `module` controls the emitted module *format* (CommonJS, ESNext, etc.) — the two are independent settings that both need to match the actual runtime/bundler environment the compiled code will run in.

**Q: What does `esModuleInterop` do, and why is it commonly enabled?**
A: It smooths over the historical mismatch between CommonJS's `module.exports` pattern and ES Modules' `export default` semantics, letting you write the more natural `import React from "react"` against CommonJS-authored packages instead of `import * as React from "react"`. It's commonly enabled because most real-world Node.js/npm packages still have some CommonJS heritage in how they're built or published.

**Q: Why would a project need `isolatedModules: true`?**
A: When the actual build step uses a transpiler that processes files independently, one at a time, without full-program type information (Babel, esbuild, swc) rather than the type-aware `tsc` compiler itself. `isolatedModules` makes TypeScript flag any code pattern that can't be safely compiled by such a single-file transpiler (like ambiguous type-only re-exports without an explicit `type` marker, or certain `const enum` usages), catching incompatibilities at type-check time instead of a confusing runtime failure.

**Q: If you configure `paths` in `tsconfig.json` for import aliases, is that enough to make those aliases work at runtime?**
A: No — `paths` only affects how TypeScript resolves types and provides editor tooling; it has no effect on actual JavaScript module resolution at build or run time. Whatever bundler or runtime actually executes the code (webpack, Vite, Node.js) needs its own separate, matching alias configuration for the same import paths to genuinely resolve at runtime.

## Related Topics
- [strict-mode.md](./strict-mode.md)
- [compiling-typescript.md](./compiling-typescript.md)
- [modules-in-typescript.md](./modules-in-typescript.md)
- [typescript-with-javascript-interop.md](./typescript-with-javascript-interop.md)
- [declaration-files.md](./declaration-files.md)
