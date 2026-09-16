# Global Variables

A global variable is one accessible from anywhere in a program — declared outside any function or block, or (in non-strict mode) created implicitly by assigning to an undeclared identifier. In the browser, top-level `var` declarations and function declarations become properties of the `window` object; in Node.js, top-level variables in a module are scoped to that module (not truly global) unless explicitly attached to `globalThis`.

Global variables are one of the most common sources of bugs in non-trivial applications: any part of the code can read or overwrite them, making state changes hard to trace, creating hidden coupling between unrelated modules, and increasing the risk of naming collisions (especially when combining multiple third-party scripts on one page). This is why modern JavaScript strongly favors module-scoped state, closures, and explicit parameter passing over relying on shared globals.

A particularly dangerous historical footgun is *implicit* globals: in non-strict mode, assigning to a variable that was never declared (`x = 5;` with no `var`/`let`/`const`) silently creates a global variable rather than throwing an error — often the unintended result of a typo (forgetting `let`) inside a nested function. `'use strict'` (automatic inside ES modules and classes) turns this into a thrown `ReferenceError`, which is one of the most valuable safety nets strict mode provides.

## Examples

```js
// Implicit global creation (non-strict mode) — a common bug source
function leak() {
  accidental = 'oops'; // no declaration keyword
  return accidental;
}
leak();
console.log(typeof accidental); // "string" — leaked onto the global object
```

```js
// 'use strict' turns the same mistake into a loud error
'use strict';
function safe() {
  notDeclared = 'oops'; // ReferenceError: notDeclared is not defined
}
safe();
```

```js
// globalThis: a standardized way to reference the global object
// across browsers (window), Node (global), and workers (self)
globalThis.myFlag = true;
console.log(globalThis.myFlag); // true
```

## Common Pitfalls / Gotchas

- Relying on implicit global creation (forgetting `let`/`const`/`var`) — always use strict mode (default in modules/classes) to catch this as an error instead of a silent bug.
- Polluting the global namespace with multiple `<script>` tags that each declare top-level `var`s — they collide because they share one global object in the browser.
- Assuming Node.js top-level variables behave like browser globals — Node wraps each file in its own module scope, so top-level `var`/`let`/`const` are *not* attached to the global object automatically.
- Using globals for cross-module communication instead of proper imports/exports or a shared state management pattern, which makes debugging and testing much harder.

## Interview Questions & Answers

**Q: What is an implicit global, and how does strict mode prevent it?**
A: An implicit global is created when you assign to an identifier that was never declared with `var`/`let`/`const` — JavaScript silently attaches it to the global object in non-strict mode. `'use strict'` disables this behavior, throwing a `ReferenceError` instead, which surfaces the bug (usually a missing declaration keyword) immediately.

**Q: Why are global variables considered bad practice in larger applications?**
A: They create implicit coupling between unrelated parts of the code, are prone to naming collisions (especially with third-party scripts), make it hard to reason about where a value is mutated, and complicate testing since state persists across test cases unless manually reset.

**Q: What is `globalThis` and why was it introduced?**
A: `globalThis` (ES2020) is a standard way to access the global object regardless of environment — `window` in browsers, `global` in Node.js, `self` in Web Workers. Before it existed, code had to detect the environment to reference the global object portably.

## Related Topics
- [variables-in-javascript.md](./variables-in-javascript.md)
- [scope-chain.md](./scope-chain.md)
- [function-scope.md](./function-scope.md)
- [es2020.md](./es2020.md)
