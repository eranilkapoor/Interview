# Modules

A module is a self-contained file of code with its own scope, exposing only the specific values (functions, objects, classes, primitives) it explicitly chooses to `export`, while everything else stays private to that file by default. Modules solve the same core problem that IIFEs and the "module pattern" solved manually before real module systems existed (see [iife.md](./iife.md)): avoiding global-scope pollution and naming collisions, and making dependencies between files explicit rather than implicit (via ordering of `<script>` tags or shared globals).

JavaScript's module story has historically been fragmented because the language itself had no built-in module system for most of its life, leading to multiple competing standards emerging to fill the gap: **CommonJS** (Node.js's original, synchronous `require()`/`module.exports` system — see [commonjs-module.md](./commonjs-module.md)), **AMD** (Asynchronous Module Definition, designed for asynchronous loading in browsers before native modules existed — see [amd.md](./amd.md)), and **UMD** (Universal Module Definition, a pattern for writing a module that works across CommonJS, AMD, *and* plain global-script environments simultaneously — see [umd.md](./umd.md)). **ES Modules** (ESM, standardized in ES2015 and now natively supported by all modern browsers and Node.js) is the official, language-level module system, using `import`/`export` syntax — see [native-es-module.md](./native-es-module.md).

A key technical difference between module systems: ESM `import`/`export` bindings are statically analyzable (resolved at parse time, before any code runs), enabling tree-shaking (bundlers can determine and strip out unused exports) and are "live bindings" (an imported value updates automatically if the exporting module later reassigns it) — CommonJS's `require()`, by contrast, is dynamic and synchronous, evaluated at runtime like a regular function call, returning a snapshot copy of `module.exports` at that moment.

## Examples

```js
// ES Module syntax (native, ES2015+) — math.js
export function add(a, b) { return a + b; }
export const PI = 3.14159;
export default function multiply(a, b) { return a * b; } // one default export per module

// app.js
import multiply, { add, PI } from './math.js';
console.log(add(2, 3), PI, multiply(2, 3)); // 5 3.14159 6
```

```js
// CommonJS syntax (Node.js's original system) — math.js
function add(a, b) { return a + b; }
module.exports = { add, PI: 3.14159 };

// app.js
const { add, PI } = require('./math.js');
console.log(add(2, 3), PI); // 5 3.14159
```

```js
// ESM "live bindings" vs CommonJS's snapshot-at-require-time behavior
// counter.mjs (ESM)
export let count = 0;
export function increment() { count++; }

// app.mjs
import { count, increment } from './counter.mjs';
increment();
console.log(count); // 1 — the imported binding reflects the live, updated value
```

## Common Pitfalls / Gotchas

- Mixing CommonJS (`require`/`module.exports`) and ES Modules (`import`/`export`) in the same file — they have different resolution rules and generally can't be freely interchanged without a build tool/interop layer (Node.js does support some interop, e.g., `require()`-ing certain ESM/CJS combinations, but it has real limitations).
- Assuming `require()` re-executes a module's code every time it's called — Node caches modules by resolved file path, so subsequent `require()` calls for the same file return the same cached `module.exports` object, without re-running the file's top-level code.
- Forgetting a `.js` file must be explicitly marked as an ES module (via `"type": "module"` in `package.json`, or a `.mjs` extension) in Node.js — otherwise `import`/`export` syntax throws a `SyntaxError`, since Node defaults to treating `.js` files as CommonJS.
- Believing all module systems handle circular dependencies (module A imports B, which imports A) the same way — ESM and CommonJS have different (and both imperfect) behaviors for this edge case, which can cause partially-initialized modules to be observed.

## Interview Questions & Answers

**Q: What problem do JavaScript modules solve that plain multi-`<script>`-tag code didn't?**
A: They give each file its own private scope by default (nothing leaks to the global scope unless explicitly exported), make dependencies between files explicit via `import`/`require` rather than relying on script-tag ordering and shared globals, and (for ESM specifically) enable static analysis benefits like tree-shaking.

**Q: What's the core difference between CommonJS and ES Modules?**
A: CommonJS (`require`/`module.exports`) resolves and loads modules synchronously, at runtime, like an ordinary function call, returning a snapshot of `module.exports` at that time. ES Modules (`import`/`export`) are statically analyzable — resolved at parse time before execution — support asynchronous loading, and provide "live bindings," where an imported value automatically reflects later updates made by the exporting module.

**Q: Why did AMD and UMD exist, and are they still relevant today?**
A: AMD provided asynchronous module loading for browsers before native ES Modules existed (since browsers couldn't natively `import` files without blocking). UMD was a defensive pattern letting a single module file work correctly whether loaded via CommonJS, AMD, or as a plain global script. Both are largely legacy today — native ES Modules (supported by all modern browsers and Node.js) and modern bundlers have made them mostly unnecessary for new code, though they still appear in older libraries and build output.

## Related Topics
- [commonjs-module.md](./commonjs-module.md)
- [native-es-module.md](./native-es-module.md)
- [amd.md](./amd.md)
- [umd.md](./umd.md)
- [dynamic-import.md](./dynamic-import.md)
- [iife.md](./iife.md)
