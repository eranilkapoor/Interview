# Ahead-of-Time (AOT) Compiler

Ahead-of-time (AOT) compilation translates source code into machine code (or another lower-level target) entirely **before** the program runs — producing a finished, standalone executable (or equivalent artifact) upfront, as a distinct build step, with no compilation work happening during the program's actual execution. This is the traditional model used by languages like C and C++: you compile once, then run the resulting binary as many times as you like, with all compilation cost paid upfront rather than during execution.

JavaScript's core execution model does **not** use AOT compilation by default — engines use an interpreter-plus-JIT pipeline instead (see [jit-compiler.md](./jit-compiler.md)), compiling hot code paths *during* execution based on runtime-observed behavior, rather than fully compiling everything upfront before the program starts. However, AOT compilation does show up in the broader JavaScript ecosystem in specific, deliberate contexts: **Angular's AOT compiler** compiles Angular component templates into efficient JavaScript rendering code at *build time*, rather than shipping the raw templates to be compiled in the browser at runtime (which is what Angular's alternative, JIT mode, does) — trading a longer build step for faster application startup and a smaller runtime footprint (no need to ship the template compiler itself to the browser). Similarly, some tools compile TypeScript/JavaScript into genuinely different, truly-AOT-compiled targets (like WebAssembly, or native binaries via tools like Node's experimental single-executable-application features), sidestepping the JS engine's usual interpret-then-JIT pipeline entirely for those specific outputs.

The AOT-vs-JIT trade-off generalizes beyond JavaScript specifically: AOT gives predictable, consistent performance from the very first execution (no "warm-up" period waiting for the JIT to identify and optimize hot paths) at the cost of not being able to use runtime-observed information (actual argument types, actual branch frequencies) to guide optimization decisions the way a JIT can — this is a foundational trade-off understanding that applies across most modern language runtimes, not just JavaScript's.

## Examples

```js
// Illustrating the conceptual distinction: AOT compiles this ENTIRELY before running;
// JavaScript's engine instead starts running it via the interpreter immediately,
// optimizing hot parts later, DURING execution
function heavyComputation(n) {
  let total = 0;
  for (let i = 0; i < n; i++) total += i * i;
  return total;
}
console.log(heavyComputation(1000000));
// In a purely AOT-compiled language, this function would already be fully compiled
// to machine code before the program even started running.
```

```typescript
// Angular AOT (conceptual): templates compiled to JS rendering code at BUILD time
// component.html (source template)
// <div>{{ user.name }}</div>

// Angular's AOT compiler produces (conceptually, simplified) build-time JS like:
// function renderTemplate(view, ctx) {
//   textNode.textContent = ctx.user.name; // pre-compiled rendering logic, ready to run immediately
// }
// vs Angular's JIT mode, which would ship the raw template and compile it IN the browser at startup
```

```js
// A build-time step (like a bundler/AOT template compiler) runs BEFORE deployment,
// producing final artifacts — conceptually contrasted with JIT, which runs continuously
// as the actual program executes in the user's browser/runtime
// (No single runnable JS snippet fully demonstrates AOT itself — it's a build-pipeline concept)
```

## Common Pitfalls / Gotchas

- Assuming JavaScript itself is AOT-compiled by default — it isn't; the language's core execution model relies on an interpreter-plus-JIT pipeline, with AOT compilation appearing only in specific tools/frameworks (like Angular's build-time template compiler) rather than as the JS engine's fundamental strategy.
- Confusing AOT compilation with a build-time transpiler like Babel — Babel performs source-to-source translation (JS to JS), not compilation to machine code; Angular's AOT compiler is a different kind of tool, specifically compiling templates into executable JS render logic ahead of time.
- Believing AOT is unconditionally "better" than JIT — AOT provides predictable startup performance with no warm-up period, but can't take advantage of runtime-observed information (actual types/branch behavior) the way a JIT's speculative optimization can; each approach has genuine trade-offs depending on the use case.
- Assuming Angular's AOT and JIT compilation modes produce identical runtime behavior in every respect — AOT mode notably doesn't need to ship the template compiler itself to the browser, resulting in a smaller bundle and faster startup, one of its most practically significant benefits.

## Interview Questions & Answers

**Q: What's the difference between AOT and JIT compilation?**
A: AOT compiles source code entirely into its final form (machine code or another target) *before* the program ever runs, as a separate build step. JIT compiles code *during* the program's actual execution, based on runtime-observed behavior, optimizing specifically the parts that turn out to run frequently. JavaScript's engines primarily use JIT (paired with an initial interpreter stage); AOT appears in the JS ecosystem mainly in specific build tools like Angular's template compiler.

**Q: Does JavaScript use AOT compilation by default?**
A: No — JavaScript engines use an interpreter-plus-JIT pipeline as their core execution strategy, compiling hot code paths into optimized machine code while the program runs, rather than fully compiling the entire program to machine code ahead of time before execution starts.

**Q: What's the benefit of Angular's AOT compilation mode over its JIT mode?**
A: AOT compiles component templates into efficient JavaScript rendering code at build time, so the browser receives already-compiled render logic and doesn't need to download and run Angular's template compiler itself at startup — resulting in a smaller bundle size and faster application startup, at the cost of a longer build step, compared to JIT mode, which ships raw templates to be compiled in the browser at runtime.

## Related Topics
- [jit-compiler.md](./jit-compiler.md)
- [compiler.md](./compiler.md)
- [interpreter.md](./interpreter.md)
- [javascript-engine.md](./javascript-engine.md)
