# Compiling TypeScript (tsc, ts-node, transpileOnly vs Type-Checking)

`tsc`, the TypeScript compiler, is the reference implementation for turning `.ts` (and `.tsx`) files into plain JavaScript. Running it does two conceptually separate things at once by default: **type-checking** (walking the entire program, verifying every type constraint, and reporting errors) and **emitting** (stripping type annotations and producing `.js` output, optionally alongside `.d.ts` declaration files and source maps). Because these are logically separate steps, TypeScript's tooling ecosystem has split around whether both need to happen together, or whether they can be decoupled for speed — this distinction is one of the more practically important, frequently-tested things to understand about the TypeScript build landscape.

**`ts-node`** lets you run a `.ts` file directly with Node.js, without a separate manual compile step — it compiles TypeScript to JavaScript on the fly, in memory, and executes it immediately, which is convenient for scripts, quick prototyping, and some testing setups, though it adds noticeable startup overhead compared to running already-compiled plain JavaScript, since compilation happens on every run. Many modern alternatives (`tsx`, Node's own experimental native TypeScript stripping support in recent versions) address this overhead using **transpile-only** compilation — actually a broader industry pattern, not unique to `ts-node`.

**Transpile-only** (as opposed to full type-checking) compilation strips types and converts modern syntax to your target JavaScript version *without* running the full type checker at all — tools like Babel's TypeScript preset, esbuild, and swc all work this way, because they operate on a single file at a time and were built for raw transformation speed, not whole-program type analysis (which fundamentally requires seeing every file together to resolve cross-file type relationships). This is dramatically faster for iteration (hot-reload / dev-server rebuild times), but it means type errors are **not caught during the actual build** at all — a type error can compile and run just fine, crashing only if it happens to trigger an actual runtime bug. Real-world setups using transpile-only tools for the fast dev/build loop almost always run `tsc --noEmit` (type-check only, emit nothing) as a **separate**, parallel step — in CI, a pre-commit hook, or the editor's own Language Service — to still catch type errors, just decoupled from the actual bundling/build speed path.

Beyond `tsc` itself, most real-world projects use a bundler (Vite, webpack, esbuild, Rollup) that wraps one of these transpile-only tools internally for the actual build, using `tsc --noEmit` (or an editor's live type-checking) purely as the type-safety gate — understanding that these are two genuinely separate concerns (fast transformation vs. thorough type-checking) running on two separate paths is exactly what interviewers are probing for when they ask how you'd set up or debug a modern TypeScript build pipeline.

## Examples

```bash
# Full compile: type-checks AND emits JavaScript (+ .d.ts if declaration: true)
tsc

# Type-check only, emit nothing — the standard "just verify types" CI/pre-commit step
tsc --noEmit

# Watch mode — recompiles/re-checks on every file save
tsc --watch
```

```bash
# ts-node: compiles and runs a .ts file directly, in one step (full type-checking by default)
npx ts-node src/script.ts

# ts-node with transpile-only mode — skips full type-checking for faster startup
npx ts-node --transpile-only src/script.ts
```

```ts
// A file with a genuine type error — behaves very differently depending on the tool used:
function double(x: number): number {
  return x * "2"; // real type error: string not assignable in this arithmetic context
}

// `tsc` (full type-check): reports a compile error, refuses to emit (by default)
// esbuild / swc / Babel (transpile-only): silently strips types and emits/runs the JS anyway —
// the type error is never caught by the build itself, only by a SEPARATE `tsc --noEmit` pass (if run)
```

## Common Pitfalls / Gotchas

- Assuming a fast dev-server rebuild (Vite/esbuild/swc-powered) is also type-checking the code — most of these tools intentionally skip type-checking entirely for speed; a genuine type error can pass straight through the dev server with zero warning unless a separate `tsc --noEmit` process (or the editor) is also running and catching it.
- Relying on `ts-node`'s default (fully type-checked) mode for a fast iteration loop and being surprised by the startup/rebuild overhead — switching to `--transpile-only` (or a tool like `tsx`) trades that overhead away, but also trades away the safety of catching type errors during that run.
- Forgetting to run `tsc --noEmit` (or equivalent) anywhere in CI when the actual build uses a transpile-only tool — without it, type errors can be merged and deployed without ever being caught by the build pipeline at all.
- Not realizing `tsc`'s default behavior still emits JavaScript output even when there ARE type errors (unless `noEmitOnError: true` is set) — a genuine type error reported by `tsc` doesn't automatically block the emitted `.js` file from being produced and potentially used, unless that flag is explicitly configured.

## Interview Questions & Answers

**Q: What are the two conceptually separate things `tsc` does when compiling a TypeScript file?**
A: Type-checking (walking the whole program and verifying every type constraint, reporting errors) and emitting (stripping type annotations and producing plain JavaScript, optionally with `.d.ts` files and source maps). They're logically independent steps, which is why tools exist that do only one or the other.

**Q: What does "transpile-only" mean, and why do tools like esbuild, swc, and Babel use it?**
A: It means stripping TypeScript syntax and downleveling to the target JavaScript version *without* running the full type checker. These tools operate on one file at a time for maximum transformation speed, and full type-checking fundamentally requires whole-program knowledge (to resolve cross-file type relationships) that a single-file transpiler doesn't have — so they intentionally skip it, trading type safety for build speed.

**Q: If your build pipeline uses a transpile-only tool, how do you still catch type errors?**
A: By running `tsc --noEmit` (type-check only, produce no output) as a separate step — typically in CI, a pre-commit hook, or continuously via the editor's Language Service — decoupled from the actual fast build/bundle path that a transpile-only tool handles.

**Q: What's the difference between `ts-node`'s default mode and `ts-node --transpile-only`?**
A: The default mode performs full type-checking before running the code (slower startup, catches type errors immediately). `--transpile-only` skips type-checking entirely and just strips/transforms the syntax for faster startup, at the cost of not catching type errors during that run at all — similar to the trade-off esbuild/swc/Babel make for TypeScript by default.

## Related Topics
- [tsconfig.md](./tsconfig.md)
- [strict-mode.md](./strict-mode.md)
- [modules-in-typescript.md](./modules-in-typescript.md)
- [typescript-with-javascript-interop.md](./typescript-with-javascript-interop.md)
- [declaration-files.md](./declaration-files.md)
