# Introduction to JavaScript

JavaScript is a lightweight, cross-platform, interpreted (and, in modern engines, JIT-compiled) programming language most famous as "the language of the web." It runs natively in every modern browser and, via Node.js/Deno/Bun, on servers, desktops (Electron), and even embedded devices. It is dynamically typed, meaning variable types are checked at runtime rather than compile time, and it supports multiple programming paradigms — imperative, object-oriented (prototype-based), and functional.

On the client side, JavaScript's core job historically has been to manipulate the Document Object Model (DOM) — reacting to clicks, form input, and navigation to make static HTML pages interactive. Frameworks like React, Angular, and Vue exist to manage this DOM interaction at scale. On the server side, JavaScript (via Node.js) provides APIs for file I/O, networking, and databases, letting the same language power an entire application stack.

JavaScript blends imperative and declarative styles. Imperative code describes *how* to do something step by step (e.g., a `for` loop incrementing a counter); declarative code describes *what* result is wanted and lets the underlying implementation figure out the how (e.g., `array.map(fn)`, or `async/await` expressing "wait for this, then continue" without manually wiring callbacks). Understanding both styles — and when to reach for each — is core to writing idiomatic modern JavaScript.

Its standard library ships built-in objects like `Array`, `Object`, `Date`, `Math`, `JSON`, and `Promise`, plus core language constructs (operators, loops, conditionals). The language itself has no built-in I/O — reading files, making HTTP requests, or touching the DOM are provided by the *host environment* (the browser's Web APIs or Node's built-in modules), not by the ECMAScript specification itself. This separation is why the exact same `Array.prototype.map` behaves identically in the browser and in Node, but `document.querySelector` only exists in the browser.

## Examples

```js
// Imperative style: describes the steps
const nums = [1, 2, 3, 4, 5];
const doubledImperative = [];
for (let i = 0; i < nums.length; i++) {
  doubledImperative.push(nums[i] * 2);
}
console.log(doubledImperative); // [2, 4, 6, 8, 10]
```

```js
// Declarative style: describes the desired outcome
const doubledDeclarative = nums.map(n => n * 2);
console.log(doubledDeclarative); // [2, 4, 6, 8, 10]
```
Both produce the same result, but the declarative version reads closer to "what," delegating iteration mechanics to `Array.prototype.map`.

```js
// Client-side vs server-side capability check
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  console.log('Running in a browser — DOM APIs available');
} else if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  console.log('Running in Node.js — fs/http modules available');
}
```

## Common Pitfalls / Gotchas

- Treating "JavaScript" and "the DOM" as the same thing — the DOM API is provided by the browser, not the language spec.
- Assuming dynamic typing means "no types" — every value still has a type; it's just checked at runtime, not declared or enforced at compile time (see [dynamic-typed.md](./dynamic-typed.md)).
- Writing purely imperative code out of habit when a declarative array/promise method would be clearer and less error-prone.
- Forgetting that code targeting Node.js may not run in a browser (and vice versa) because of host-specific globals (`process`, `window`, `document`).

## Interview Questions & Answers

**Q: Is JavaScript a compiled or interpreted language?**
A: Historically interpreted, but modern engines (V8, SpiderMonkey) use a mixed pipeline: an interpreter starts executing quickly, while a JIT (Just-In-Time) compiler profiles hot code paths and compiles them to optimized machine code on the fly. So in practice it is both, depending on the engine.

**Q: What paradigms does JavaScript support?**
A: It's multi-paradigm: imperative/procedural, object-oriented (via prototypes, and `class` syntax as sugar over them), and functional (first-class functions, closures, higher-order functions like `map`/`filter`/`reduce`).

**Q: What's the difference between the ECMAScript spec and what runs in a browser?**
A: ECMAScript defines the core language (syntax, types, operators, built-in objects like `Array`, `Promise`, `Math`). The browser additionally provides Web APIs (DOM, `fetch`, `localStorage`, timers) that are not part of the language spec itself — Node.js provides a different set of host APIs (`fs`, `http`, `process`) instead.

**Q: Give an example of declarative vs imperative code in JS.**
A: Imperative: a `for` loop manually pushing transformed items into a new array. Declarative: `array.map(fn)` expressing the transformation directly. `async/await` is another example — it lets you write "wait, then do X" declaratively instead of manually chaining `.then()` callbacks.

## Related Topics
- [history-of-javascript.md](./history-of-javascript.md)
- [javascript-engine.md](./javascript-engine.md)
- [javascript-runtime.md](./javascript-runtime.md)
- [functional-programing.md](./functional-programing.md)
