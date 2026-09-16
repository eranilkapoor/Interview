# JavaScript Engine

A JavaScript engine is the program that actually parses, interprets/compiles, and executes JavaScript code — it's the concrete implementation of the abstract ECMAScript specification. Every environment that runs JavaScript (a browser, Node.js, Deno) embeds one of a handful of engines: **V8** (Google — powers Chrome and, notably, Node.js and Deno), **SpiderMonkey** (Mozilla — powers Firefox, and was the very first JavaScript engine ever created, written by Brendan Eich), **JavaScriptCore/Nitro** (Apple — powers Safari), and historically **Chakra** (Microsoft — powered the old, pre-Chromium Edge).

A typical modern engine pipeline follows this general flow: the **parser** reads raw source text and produces an **Abstract Syntax Tree (AST)** — a structured, tree-shaped representation of the code's syntax; the **interpreter** (see [interpreter.md](./interpreter.md)) then converts that AST into bytecode and begins executing it, which gets code running quickly with minimal delay; meanwhile, a **profiler** monitors execution, watching for "hot" (frequently run) code paths, which get handed off to the **JIT compiler** (see [jit-compiler.md](./jit-compiler.md)) to be compiled into optimized native machine code. A separate, continuously-running **garbage collector** (see [garbage-collection.md](./garbage-collection.md)) reclaims memory from objects no longer reachable, running alongside this whole execution pipeline.

Each engine implements the same ECMAScript specification (mostly — feature adoption timing can differ slightly across engines), but internal implementation details (exact optimization heuristics, memory management specifics, JIT tier structures) vary meaningfully between them, which is why the *exact same* JavaScript code can perform somewhat differently across browsers, even when it produces identical observable output.

## Examples

```js
// Every environment running this code embeds SOME JavaScript engine underneath —
// V8 in Chrome/Node/Deno, SpiderMonkey in Firefox, JavaScriptCore in Safari
console.log('This line is parsed into an AST, then interpreted/compiled by whichever engine runs it');
```

```js
// A drastically simplified illustration of the "parse into tokens" first step any engine performs
function simpleParse(code) {
  return code.split(/\s+/); // NOT a real parser — just illustrating "break source into pieces first"
}
console.log(simpleParse('var a = 5')); // ['var', 'a', '=', '5']
// A real engine's parser builds a full AST from tokens like these, which the
// interpreter then converts to bytecode, and the JIT may later compile to machine code
```

```js
// Checking which engine/runtime you're in (a common practical need, not engine internals themselves)
console.log(typeof process !== 'undefined' && process.versions && process.versions.v8);
// In Node.js (V8-based), this logs V8's version string; undefined in non-V8 environments
```

## Common Pitfalls / Gotchas

- Assuming "JavaScript engine" and "JavaScript runtime" mean the same thing — the engine is specifically the component that parses/executes JS code per the ECMAScript spec; the runtime (see [javascript-runtime.md](./javascript-runtime.md)) is the broader environment, including the engine plus host-provided APIs (Web APIs, Node's built-in modules) and the event loop.
- Believing all engines optimize/behave identically for the exact same code — while all engines aim to correctly implement the same ECMAScript specification (observable output should match), internal performance characteristics and edge-case timing can differ between V8, SpiderMonkey, and JavaScriptCore.
- Forgetting that Node.js uses the same V8 engine that powers Chrome — this is exactly why Node.js and browser-based JavaScript share so much low-level behavior/performance characteristics, despite being very different overall environments (different host APIs, no DOM in Node, etc.).
- Assuming a JavaScript engine can run without a surrounding runtime providing host APIs — a bare engine only implements the ECMAScript language itself; it needs a host environment (browser or Node.js) to provide capabilities like I/O, timers, and DOM access.

## Interview Questions & Answers

**Q: What are the four major JavaScript engines, and which browsers/runtimes use each?**
A: V8 (Google — Chrome, Node.js, Deno), SpiderMonkey (Mozilla — Firefox; also the first JS engine ever created), JavaScriptCore/Nitro (Apple — Safari), and historically Chakra (Microsoft — the old, pre-Chromium Edge, now discontinued in favor of V8 after Edge switched to Chromium).

**Q: Walk through the general pipeline a modern JavaScript engine uses to execute code.**
A: The parser converts source text into an Abstract Syntax Tree (AST). The interpreter converts that AST into bytecode and starts executing it immediately, while a profiler tracks which code paths run frequently. Hot code paths get compiled by the JIT compiler into optimized native machine code, which the engine switches to using for subsequent calls — with deoptimization as a fallback if runtime assumptions later prove wrong. A garbage collector runs alongside this whole pipeline, reclaiming memory from unreachable objects.

**Q: What's the difference between a JavaScript engine and a JavaScript runtime?**
A: The engine is specifically the component implementing the ECMAScript language itself — parsing and executing JS code. The runtime is the broader surrounding environment that embeds an engine and adds host-provided capabilities the language spec doesn't include on its own: Web APIs and the event loop in a browser, or built-in modules like `fs`/`http` and libuv in Node.js.

## Related Topics
- [javascript-runtime.md](./javascript-runtime.md)
- [interpreter.md](./interpreter.md)
- [jit-compiler.md](./jit-compiler.md)
- [garbage-collection.md](./garbage-collection.md)
- [nodejs-runtime.md](./nodejs-runtime.md)
