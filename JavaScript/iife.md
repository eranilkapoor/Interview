# IIFE (Immediately Invoked Function Expression)

An IIFE (pronounced "iffy") is a function that is defined and then executed immediately, in a single expression: `(function () { ... })();`. Wrapping the function declaration in parentheses forces the parser to treat it as an expression rather than a statement (since a bare `function` keyword at the start of a statement is parsed as a declaration, which cannot be immediately invoked with a trailing `()`); the second pair of parentheses then calls it right away.

Historically (pre-ES2015 modules and pre-`let`/`const` block scoping), IIFEs were the primary tool for creating an isolated, private scope — preventing variables from leaking into the global scope and avoiding naming collisions when combining multiple scripts on one page. This is the classic "module pattern": an IIFE that returns an object exposing only the intended public API, keeping everything else genuinely private via closure.

With the arrival of ES2015 modules (each module has its own top-level scope by default) and block-scoped `let`/`const`, IIFEs are far less necessary for scoping purposes in modern code. They still show up for a few specific reasons: running setup/initialization code exactly once without leaving named functions/variables behind, avoiding naming collisions in non-module scripts (e.g., a `<script>` tag with no bundler), and — historically — how bundled libraries (UMD-style) wrapped their entire code to avoid polluting global scope in non-module environments.

## Examples

```js
// Basic IIFE: runs immediately, keeps `secret` out of the global scope
(function () {
  const secret = 'only visible inside here';
  console.log(secret);
})();
console.log(typeof secret); // "undefined" — never leaked
```

```js
// The classic module pattern: IIFE returning a public API, hiding private state
const counter = (function () {
  let count = 0; // truly private — no outside access except through the returned methods
  return {
    increment() { return ++count; },
    reset() { count = 0; }
  };
})();
console.log(counter.increment()); // 1
console.log(counter.increment()); // 2
console.log(counter.count);       // undefined — private
```

```js
// Arrow function IIFE, and passing arguments into an IIFE
(() => console.log('arrow IIFE'))();

((name) => console.log(`Hello, ${name}`))('Anil'); // "Hello, Anil"
```

## Common Pitfalls / Gotchas

- Forgetting the wrapping parentheses and writing `function () {}();` as a statement — this is a `SyntaxError`, because a statement starting with `function` is parsed as a declaration, which has no way to be immediately invoked.
- Believing IIFEs are still necessary for scoping in modern module-based code — ES modules already give each file its own top-level scope, making most "IIFE for isolation" use cases unnecessary.
- Overusing IIFEs where a simple `{ }` block with `let`/`const` would achieve the same scoping isolation with less syntactic noise.
- Losing the return value of an IIFE by forgetting to assign it to a variable — an unassigned IIFE just runs once and its result (if any) is discarded.

## Interview Questions & Answers

**Q: Why do you need to wrap a function in parentheses to make it an IIFE?**
A: Because a statement that starts with the `function` keyword is parsed by JavaScript as a function *declaration*, which requires a name and cannot be immediately followed by `()` to call it in the same statement. Wrapping it in parentheses forces the parser to treat it as a function *expression* instead, which can be immediately invoked.

**Q: What problem did IIFEs originally solve, and is that problem still relevant today?**
A: They created an isolated scope to avoid leaking variables into the global scope and to prevent naming collisions between multiple scripts sharing one global object — critical before ES2015 modules and block-scoped `let`/`const` existed. Today, ES modules (each file gets its own scope) and `let`/`const`/blocks handle most of these cases natively, so IIFEs are used far less often, mainly for one-time setup code or in non-module script contexts.

**Q: How does the "module pattern" use an IIFE to create private state?**
A: The IIFE executes once, creating a closure over any variables declared inside it. It then returns an object exposing only specific methods (a public API). Those returned methods retain access to the private variables via closure, but nothing outside the IIFE can reach those variables directly — this is the same mechanism that makes closures work in general, applied specifically for encapsulation.

## Related Topics
- [closures.md](./closures.md)
- [functions-in-javascript.md](./functions-in-javascript.md)
- [modules.md](./modules.md)
- [umd.md](./umd.md)
