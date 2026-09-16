# Default Parameters

Default parameters (ES2015) let you specify a fallback value for a function parameter, used automatically when the caller passes `undefined` for that argument (either by omitting it entirely or explicitly passing `undefined`). This replaces the pre-ES6 idiom of checking `if (param === undefined) param = defaultValue;` (or the riskier `param = param || defaultValue`, which incorrectly overrides other falsy values like `0`) inside the function body.

Default values are evaluated **at call time**, not when the function is defined, and can reference earlier parameters in the same parameter list (since each parameter's default is evaluated left to right, with access to previously-bound parameters). They can also be arbitrary expressions, including function calls — meaning a default parameter can even trigger a side effect if you're not careful, since it's genuinely re-evaluated on every call where it's needed.

Default parameters combine naturally with destructuring in function signatures — a very common modern pattern is `function f({ a, b = 10 } = {})`, which provides both a fallback for a missing options object and fallbacks for individual missing properties within it.

## Examples

```js
// Basic default parameter usage
function greet(name, greeting = 'Hello') {
  console.log(`${greeting}, ${name}`);
}
greet('Anil');            // "Hello, Anil"
greet('Anil', 'Welcome'); // "Welcome, Anil"
greet('Anil', undefined); // "Hello, Anil" — explicit undefined still triggers the default
```

```js
// Later defaults can reference earlier parameters
function createRange(start, end = start + 10) {
  return [start, end];
}
console.log(createRange(5)); // [5, 15]
```

```js
// Defaults are evaluated at call time, and can call functions (careful with side effects!)
let callCount = 0;
function logAndReturnDefault() {
  callCount++;
  return 'default value';
}
function f(x = logAndReturnDefault()) {
  return x;
}
f();          // calls logAndReturnDefault() -> callCount becomes 1
f('provided'); // default not evaluated -> callCount stays 1
console.log(callCount); // 1
```

## Common Pitfalls / Gotchas

- Assuming default parameters trigger for `null` — they only trigger for `undefined`; passing `null` explicitly keeps `null` as the value.
- Writing a default that references a *later* parameter (`function f(a = b, b) {}`) — this throws a `ReferenceError` because parameters are evaluated left to right and `b` isn't initialized yet when `a`'s default runs.
- Forgetting defaults are re-evaluated on every call (not computed once at function definition) — an expensive or side-effecting default expression re-runs every time it's needed.
- Combining default parameters with the `arguments` object and being surprised — in modern (non-`"use strict"`-irrelevant, since default params always trigger strict-like binding) semantics, `arguments` reflects only what was actually passed, not the defaulted value.

## Interview Questions & Answers

**Q: When does a default parameter value get used — only when the argument is omitted, or also for other falsy values?**
A: Only when the argument is `undefined` — either omitted entirely or explicitly passed as `undefined`. Passing `null`, `0`, `''`, or `false` does *not* trigger the default; the parameter simply receives that value as-is.

**Q: Can a default parameter reference another parameter? Are there ordering constraints?**
A: Yes — parameters are evaluated left to right, and a later default can reference an earlier (already-bound) parameter, e.g., `function f(a, b = a * 2)`. However, an earlier default cannot reference a later parameter that hasn't been assigned yet — that throws a `ReferenceError`.

**Q: Why might using a function call as a default parameter be risky?**
A: Because the expression is evaluated fresh on every call where the default is actually needed, any side effects (mutating external state, logging, network calls) will re-run each time — which is easy to overlook if you assume defaults behave like a value computed once "at definition time."

## Related Topics
- [rest-parameter.md](./rest-parameter.md)
- [destructuring-assignment.md](./destructuring-assignment.md)
- [functions.md](./functions.md)
- [es2015.md](./es2015.md)
