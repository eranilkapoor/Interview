# Interpreter

An interpreter is a program that reads source code and executes it directly, translating and running each instruction more or less on the fly, without first producing a separate, standalone machine-code executable file the way a traditional ahead-of-time compiler does. JavaScript was originally, and is still colloquially, described as an "interpreted language" — early JavaScript engines parsed the source and executed it line-by-line (or via a simple bytecode interpretation step) with no separate compilation phase visible to the developer, which is part of why JS famously requires no explicit "build" step to simply run in a browser.

In modern engines (V8, SpiderMonkey, JavaScretCore), the reality is more nuanced: an interpreter is still the *first* stage of execution — it parses the source into an Abstract Syntax Tree (AST), then typically into a simpler bytecode form, and begins executing that bytecode immediately, which is fast to *start* but slower to *run* per-instruction compared to genuinely compiled machine code. This is precisely why modern engines pair the interpreter with a JIT (Just-In-Time) compiler (see [jit-compiler.md](./jit-compiler.md)): the interpreter gets code running quickly with minimal startup delay, while the JIT compiler profiles which code paths run frequently ("hot" code) and compiles just those into optimized machine code in the background, upgrading performance for the parts of the program that actually matter most.

Understanding "interpreted vs compiled" as a spectrum rather than a strict binary is a valuable interview-level nuance: JavaScript is not purely interpreted (that describes only its earliest implementations), nor is it purely ahead-of-time compiled (like C); it's best described as using a hybrid interpreter-plus-JIT pipeline, a strategy shared by many modern high-performance dynamic languages (Python's PyPy, Java's JVM with its own JIT, etc.).

## Examples

```js
// JavaScript requires no separate compile step from the developer's perspective —
// characteristic of interpreted-language ergonomics
console.log('This runs immediately when loaded/executed — no separate build/compile step needed');
```

```js
// A conceptual (simplified) illustration of what an interpreter does internally:
// parse source into tokens/AST, then execute step by step
function simpleTokenizer(code) {
  return code.split(/\s+/); // a drastically simplified stand-in for real parsing
}
console.log(simpleTokenizer('var a = 5')); // ['var', 'a', '=', '5']
// A real interpreter would build a full AST from these tokens, then execute
// (or further compile to bytecode) that AST — this is just illustrating the "parse first" step
```

```js
// The interpreter is the FIRST stage engines use; hot code later gets JIT-compiled
function add(a, b) { return a + b; } // initially run via the interpreter/bytecode
for (let i = 0; i < 100000; i++) {
  add(i, i + 1); // called many times — the engine's profiler notices this and
}                  // may hand it off to the JIT compiler for optimized machine code
```

## Common Pitfalls / Gotchas

- Describing JavaScript as "purely interpreted" without qualification — modern engines use a hybrid interpreter-plus-JIT pipeline, not pure line-by-line interpretation, for meaningfully better performance on repeatedly-executed code.
- Assuming "interpreted" means "slow" and "compiled" means "fast" as an absolute rule — the interpreter's job (fast startup, no upfront compile delay) and the JIT's job (fast steady-state execution for hot code) are complementary trade-offs, not one being strictly worse than the other.
- Conflating "interpreter" with "the whole JavaScript engine" — the interpreter is just one component (alongside the parser, the JIT compiler(s), and the garbage collector) within a modern engine's overall pipeline.

## Interview Questions & Answers

**Q: Is JavaScript an interpreted or a compiled language?**
A: Historically described as interpreted, but modern engines actually use a hybrid pipeline: an interpreter parses and begins running the code quickly (via bytecode), while a JIT (Just-In-Time) compiler simultaneously profiles the running program and compiles frequently-executed ("hot") code paths into optimized machine code in the background — so in practice, it's both, working together.

**Q: Why do modern JS engines use an interpreter at all, if a JIT compiler can produce faster machine code?**
A: Compiling ahead of time (even just-in-time) has upfront cost — analyzing and optimizing code takes time. The interpreter lets execution start immediately with minimal delay, which matters a lot for web pages where most code runs only briefly or infrequently; reserving the more expensive compilation step specifically for code proven (via runtime profiling) to be worth optimizing is a better overall trade-off than compiling everything upfront.

**Q: What's the relationship between the interpreter and the JIT compiler in engines like V8?**
A: The interpreter (V8 calls its version "Ignition") runs first, executing bytecode quickly with low startup overhead, while also collecting profiling information about which functions/code paths run frequently. The JIT compiler (V8's is called "TurboFan") uses that profiling data to compile hot functions into optimized machine code, which the engine then switches to using for subsequent calls to that function — with a mechanism ("deoptimization") to fall back to the interpreter if a prior optimization's assumptions turn out to be wrong.

## Related Topics
- [jit-compiler.md](./jit-compiler.md)
- [compiler.md](./compiler.md)
- [javascript-engine.md](./javascript-engine.md)
- [aot-compiler.md](./aot-compiler.md)
