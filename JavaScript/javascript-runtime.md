# JavaScript Runtime

A JavaScript runtime is the complete environment in which JavaScript code actually executes — it's a broader concept than just the JavaScript engine (see [javascript-engine.md](./javascript-engine.md)). A runtime bundles together the engine itself (which implements the core ECMAScript language) with a set of **host-provided APIs** the language specification doesn't define on its own, plus the machinery (the **event loop**, task/microtask queues) that coordinates asynchronous execution between the engine's single-threaded call stack and those host APIs.

In a **browser**, the runtime consists of the JS engine (e.g., V8 in Chrome) plus Web APIs (the DOM, `fetch`, `setTimeout`, `localStorage`, Web Workers, and many more) plus the browser's own event loop, which coordinates handing control back to the JS engine's call stack once an asynchronous Web API operation completes. In **Node.js**, the runtime pairs the V8 engine with a different set of host capabilities suited to a server environment — built-in modules (`fs`, `http`, `path`, `process`), and **libuv**, a C library providing an event loop and a thread pool specifically for non-blocking I/O operations (file access, DNS, some cryptographic operations) that would otherwise need to block the single JS thread (see [nodejs-runtime.md](./nodejs-runtime.md)).

This runtime/engine distinction resolves a lot of confusing JavaScript trivia: the exact same engine (V8) can behave identically for pure-language features (arithmetic, `Array.prototype.map`, closures) in both Chrome and Node, while diverging sharply for anything runtime-specific (`document` exists only in the browser; `require`/`fs` exist only in Node) — because those differing capabilities come from the surrounding runtime's host APIs, not from the shared underlying engine.

## Examples

```js
// Core language behavior (from the ENGINE) is identical across runtimes
console.log([1, 2, 3].map(n => n * 2)); // [2, 4, 6] — same everywhere V8 (or any compliant engine) runs

// Runtime-specific APIs differ based on the HOST environment, not the engine
console.log(typeof window !== 'undefined');   // true in a browser runtime, false in Node
console.log(typeof process !== 'undefined');  // true in a Node.js runtime, false in a browser
```

```js
// The classic async-ordering demo, illustrating the runtime's event loop coordinating with the engine
console.log('A: synchronous, engine runs this immediately');
setTimeout(() => {
  console.log('C: runtime (browser/Node) handled the timer, then queued this back onto the engine');
}, 0);
console.log('B: synchronous, still runs before the queued callback');
// Output: A, B, C — the setTimeout callback is handled by the RUNTIME's timer facility,
// not the engine itself, and is only handed back to the engine's call stack via the event loop
```

```js
// The SAME engine (V8), but different runtimes providing very different host capabilities
// In a browser (V8 + Web APIs):
// document.querySelector('#app'); // DOM API — browser runtime only

// In Node.js (V8 + Node's built-in modules + libuv):
// const fs = require('fs');
// fs.readFileSync('./file.txt'); // Node runtime only — no DOM, no `document`, no `window`
```

## Common Pitfalls / Gotchas

- Conflating "JavaScript engine" with "JavaScript runtime" — the engine is just the piece implementing the core language; the runtime is the full environment, including host APIs and the event loop, that surrounds and uses that engine.
- Writing code that assumes browser-specific globals (`window`, `document`) exist in Node.js, or Node-specific globals (`require`, `process`, `__dirname`) exist in a browser — both are runtime-specific, not part of the shared underlying engine or the ECMAScript language itself.
- Assuming "JavaScript is single-threaded" describes the entire runtime, including all its internals — the *engine's* JS call stack is single-threaded, but the surrounding runtime (browser or Node/libuv) often uses additional internal threads for things like networking, rendering, or file I/O, specifically to avoid blocking that single JS thread.
- Forgetting that different runtimes can expose the *same* API name with subtly different behavior/availability timelines (e.g., `fetch` existing natively in browsers for years before being added to Node.js) — always verify runtime-specific documentation rather than assuming universal availability.

## Interview Questions & Answers

**Q: What's the difference between a JavaScript engine and a JavaScript runtime?**
A: The engine (V8, SpiderMonkey, etc.) implements the core ECMAScript language — parsing and executing JS syntax and built-ins like `Array`, `Object`, `Promise`. The runtime is the complete surrounding environment: the engine plus host-provided APIs the language spec doesn't define itself (DOM/Web APIs in a browser, `fs`/`http`/libuv in Node.js) plus the event loop that coordinates asynchronous work between them.

**Q: Why does the exact same code (e.g., `array.map(fn)`) behave identically in a browser and in Node.js, while other code (`document.querySelector`) only works in one of them?**
A: `array.map` is defined by the ECMAScript specification itself and implemented consistently by the shared underlying engine (V8, in both Chrome and Node's case) — it's pure language behavior. `document.querySelector` is a Web API, provided by the browser's runtime specifically, with no equivalent existing in Node.js's runtime (which provides an entirely different set of host APIs suited to a server environment instead).

**Q: What role does libuv play in the Node.js runtime?**
A: It's a C library providing Node.js with an event loop and a thread pool for non-blocking I/O operations (file system access, DNS lookups, some crypto operations) — letting Node's single JS thread hand off potentially slow I/O work to libuv's internal threads, then resume execution via a callback once that work completes, without ever blocking the main JS thread directly.

## Related Topics
- [javascript-engine.md](./javascript-engine.md)
- [nodejs-runtime.md](./nodejs-runtime.md)
- [event-loop.md](./event-loop.md)
- [web-apis.md](./web-apis.md)
- [single-threaded-model.md](./single-threaded-model.md)
