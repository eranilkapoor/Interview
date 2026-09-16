# JIT (Just-In-Time) Compiler

A Just-In-Time (JIT) compiler compiles code into optimized machine code **while the program is running**, rather than entirely ahead of time (AOT — see [aot-compiler.md](./aot-compiler.md)) or purely via line-by-line interpretation (see [interpreter.md](./interpreter.md)). Modern JavaScript engines (V8, SpiderMonkey, JavaScriptCore) use a JIT as a core part of their execution pipeline specifically to get the best of both worlds: an interpreter starts running code immediately with minimal startup delay, while the JIT compiler simultaneously monitors the running program, identifies "hot" code paths (functions/loops executed frequently), and compiles *just those* into highly optimized native machine code — upgrading performance where it actually matters without paying a large upfront compilation cost for code that only runs once or rarely.

JIT compilation relies heavily on **speculative optimization** based on the types and shapes of values actually observed at runtime: if a function `add(a, b)` is repeatedly called with numbers, the JIT can generate machine code specialized for numeric addition, skipping the more general (and slower) type-checking logic the interpreter would otherwise need for every call. This speculative code is fast, but it's only valid as long as its underlying assumptions hold — if that same function is later called with a string (invalidating the "always numbers" assumption), the engine must **deoptimize**, discarding the specialized machine code and falling back to the slower, general-purpose interpreted/bytecode path (potentially re-optimizing again later if the new pattern also stabilizes).

Different engines structure their JIT pipelines with multiple tiers of increasing optimization aggressiveness (V8, for example, uses "Ignition" as its interpreter/bytecode generator and "Sparkplug"/"Maglev"/"TurboFan" as progressively more aggressive JIT compilation tiers) — the general principle across all of them is the same: start fast with low overhead, then progressively invest more compilation effort into whatever code proves, through actual runtime observation, to be worth optimizing.

## Examples

```js
// A "monomorphic" function (always called with the same argument types) is easy for a JIT to optimize well
function add(a, b) { return a + b; }
for (let i = 0; i < 100000; i++) {
  add(i, i + 1); // always called with numbers — the JIT can safely specialize for numeric addition
}
```

```js
// A "polymorphic" function (called with varying argument types) is harder to optimize as aggressively
function addPolymorphic(a, b) { return a + b; }
addPolymorphic(1, 2);       // numbers
addPolymorphic('a', 'b');   // strings
addPolymorphic([1], [2]);   // arrays (concatenated via string coercion in +)
// The engine can't specialize as confidently here — it must account for multiple possible type combinations
```

```js
// Deoptimization: a function optimized for one type pattern, then "surprised" by a different one
function process(value) {
  return value * 2; // JIT may optimize this assuming `value` is always a number
}
for (let i = 0; i < 100000; i++) process(i); // JIT specializes for numbers after many consistent calls
process('oops'); // NaN — a non-numeric call can trigger deoptimization of the previously
                   // specialized machine code, falling back to more general-purpose handling
```

## Common Pitfalls / Gotchas

- Assuming all code benefits equally from JIT optimization — only code that actually runs repeatedly ("hot" paths, per runtime profiling) gets aggressively optimized; code executed once or rarely mostly just runs via the interpreter/lower JIT tiers.
- Writing functions that are called with wildly varying argument types ("polymorphic"/"megamorphic" call sites) in performance-critical hot loops — this can prevent the JIT from generating the fastest possible specialized code, since it must account for multiple type shapes.
- Believing you can reliably predict or control exactly when/how the JIT will optimize a given function — these are internal engine heuristics that vary by engine and version; the practical guidance is to write consistent, predictable code (stable types, stable object shapes) rather than trying to micromanage the JIT directly.
- Confusing JIT compilation with a one-time build-time compilation step (like Babel/tsc) — JIT compilation happens continuously, live, during the program's actual execution, not before deployment.

## Interview Questions & Answers

**Q: What is JIT compilation, and why do JavaScript engines use it instead of purely interpreting or purely AOT-compiling?**
A: JIT compilation happens at runtime, translating frequently-executed ("hot") code into optimized machine code while the program is already running, based on actual observed behavior. This combines the fast startup of pure interpretation (no expensive upfront compile step needed for rarely-run code) with the execution speed of compiled machine code (applied specifically where profiling shows it's worth the investment) — a better overall trade-off than either pure interpretation (slower steady-state execution) or pure AOT compilation (expensive upfront cost even for code that barely runs, plus AOT can't rely on runtime type information the way JIT speculative optimization can).

**Q: What is "deoptimization," and why does it happen?**
A: When the JIT has compiled a function into optimized machine code based on assumptions about the types/shapes of values it's been called with, and a later call violates those assumptions (e.g., a function assumed to always receive numbers is called with a string), the engine must discard that specialized code and fall back to a more general, slower execution path — since the optimized version's logic is no longer guaranteed correct for the new input pattern.

**Q: How does calling a function with consistently-typed arguments help JIT performance, compared to calling it with varying types?**
A: Consistent ("monomorphic") argument types let the JIT generate highly specialized machine code confidently, since it only needs to handle one predictable case. Varying ("polymorphic"/"megamorphic") types force the JIT to either generate more general (and thus slower) code upfront, or risk frequent deoptimization/reoptimization cycles as call patterns shift — both of which reduce the effectiveness of JIT optimization for that code path.

## Related Topics
- [interpreter.md](./interpreter.md)
- [compiler.md](./compiler.md)
- [aot-compiler.md](./aot-compiler.md)
- [javascript-engine.md](./javascript-engine.md)
- [optimized-code.md](./optimized-code.md)
