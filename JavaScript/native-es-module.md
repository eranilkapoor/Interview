# Native ES Modules

ES Modules (ESM) are JavaScript's official, language-level module system, standardized in ES2015 and now natively supported by every modern browser and by Node.js (since v12+, stabilized further in later versions). They use the `import`/`export` keywords directly, requiring no separate library, loader, or build tool to function at a basic level — a browser can load an ES module directly via `<script type="module" src="app.js"></script>`, and Node.js recognizes ESM either through a `.mjs` file extension or `"type": "module"` in `package.json`.

ESM's defining technical properties: **static structure** — `import`/`export` statements must appear at the top level of a module (not inside conditionals or functions) and are resolved at parse time, before any code executes, which is what enables tooling like tree-shaking (bundlers can statically determine which exports are actually used and discard the rest); **live bindings** — an imported name is a live reference to the exporting module's binding, so if the exporting module later reassigns that exported variable, every importer sees the updated value automatically, not a frozen snapshot (a real difference from CommonJS's copy of `module.exports` at require-time); and **strict mode by default** — every ES module runs in strict mode automatically, with no `'use strict'` directive needed.

ESM also introduces `import.meta` (metadata about the current module, like `import.meta.url`), top-level `await` (allowing an `await` expression directly at a module's top level, without wrapping it in an `async` function — useful for module initialization that depends on an async resource), and dynamic `import()` as an expression (not a static statement) for loading modules conditionally or lazily at runtime (see [dynamic-import.md](./dynamic-import.md)).

## Examples

```js
// Named exports and a default export — utils.js
export function double(x) { return x * 2; }
export const VERSION = '1.0.0';
export default class Calculator {
  add(a, b) { return a + b; }
}
```

```js
// Importing named + default exports, and renaming on import — app.js
import Calculator, { double, VERSION as version } from './utils.js';
console.log(double(5), version);           // 10 "1.0.0"
console.log(new Calculator().add(2, 3));    // 5

// Namespace import — grabs everything as one object
import * as Utils from './utils.js';
console.log(Utils.double(4)); // 8
```

```js
// Live bindings: an updated exported value is reflected automatically
// counter.js
export let count = 0;
export function tick() { count++; }

// main.js
import { count, tick } from './counter.js';
console.log(count); // 0
tick();
console.log(count); // 1 — reflects the exporting module's live, updated binding
```

## Common Pitfalls / Gotchas

- Trying to `import`/`export` conditionally, inside an `if` block or function — static `import`/`export` statements must be at the top level of the module; use dynamic `import()` (an expression, usable anywhere, including conditionally) for that use case instead.
- Forgetting Node.js needs an explicit signal (`.mjs` extension, or `"type": "module"` in `package.json`) to treat `.js` files as ES Modules — otherwise it defaults to CommonJS and throws a `SyntaxError` on `import`/`export` syntax.
- Assuming a default export and a named export named `default` are handled identically — `export default X` is genuinely special syntax, imported without curly braces (`import X from ...`), distinct from any named export.
- Believing imported bindings are copies (like a value assigned once at import time) — they're live references to the exporting module's actual binding, which is a real behavioral difference from CommonJS's `require()` snapshot semantics.

## Interview Questions & Answers

**Q: What does it mean that ES Module imports/exports are "statically analyzable," and why does that matter?**
A: `import`/`export` statements must appear at a module's top level (not inside conditionals/functions) and are resolved at parse time, before any code runs — this fixed, unconditional structure lets tools determine exactly which exports are used across a whole dependency graph without executing any code, enabling optimizations like tree-shaking (removing unused exports from a final bundle) that aren't reliably possible with CommonJS's fully dynamic `require()`.

**Q: What's a "live binding" in ES Modules, and how does it differ from CommonJS?**
A: An imported name is a direct, live reference to the exporting module's own variable — if that module later reassigns the exported variable, every module that imported it sees the updated value automatically. CommonJS's `require()`, by contrast, returns a reference to the `module.exports` object as it existed at the moment of the `require()` call — reassigning individual exported variables inside the source module afterward doesn't automatically propagate the same way (though mutating a shared exported *object's* properties still would, since that's just normal object reference sharing).

**Q: How do you load a module dynamically/conditionally in ES Modules, given static `import` can't be used inside an `if` block?**
A: Using dynamic `import()` — a function-like expression (not a statement) that returns a Promise resolving to the module's namespace object, usable anywhere ordinary expressions are allowed, including inside conditionals, loops, or event handlers: `if (condition) { const mod = await import('./feature.js'); }`.

## Related Topics
- [modules.md](./modules.md)
- [dynamic-import.md](./dynamic-import.md)
- [commonjs-module.md](./commonjs-module.md)
- [es2015.md](./es2015.md)
