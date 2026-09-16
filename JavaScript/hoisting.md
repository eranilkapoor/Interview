# Hoisting

Hoisting is the observable effect of JavaScript's two-phase execution model: during the "creation phase" of an execution context (before any code actually runs line by line), the engine scans ahead and registers all `var` declarations and function declarations in advance. This makes it *appear* as though declarations were "moved to the top" of their scope — hence "hoisting" — though nothing physically moves; the engine simply pre-processes them before execution begins.

The behavior differs sharply by declaration type. **`var`** declarations are hoisted and initialized to `undefined` immediately, so referencing them before their assignment line yields `undefined` rather than an error. **Function declarations** are hoisted completely, including their full body — they're callable anywhere in their scope, even before their line in the source. **`let`/`const`/`class`** are also technically hoisted (the engine is aware of them from the top of the block), but they remain uninitialized in the **Temporal Dead Zone (TDZ)** until their declaration line actually executes — referencing them before that point throws a `ReferenceError`, which is a deliberately stricter, safer behavior than `var`'s silent `undefined`. **Function expressions** and **arrow functions** are not hoisted as callable functions at all — only the variable holding them is hoisted, per whatever rule (`var`/`let`/`const`) applies to that variable.

A classic gotcha combining hoisting with function-scoping: if the same function name is declared multiple times via function declarations in the same scope, the *last* one silently wins for every call, even calls that appear before the last declaration in the source — because hoisting processes all of them in order, and each later declaration simply overwrites the earlier hoisted binding.

## Examples

```js
// var: hoisted and initialized to undefined
console.log(a); // undefined (not a ReferenceError)
var a = 10;
console.log(a); // 10
```

```js
// let/const: hoisted into the Temporal Dead Zone — accessing early throws
console.log(typeof b); // "undefined" if truly undeclared, but here b IS declared below with let:
try {
  console.log(b); // ReferenceError: Cannot access 'b' before initialization
} catch (e) { console.log(e.message); }
let b = 20;
```

```js
// Function declarations are fully hoisted; function expressions are not
console.log(declared()); // "works!" — full hoisting
function declared() { return 'works!'; }

try {
  expressed(); // TypeError: expressed is not a function (var-hoisted as undefined)
} catch (e) { console.log(e.message); }
var expressed = function () { return 'also works, but only after this line'; };
```

```js
// Duplicate function declarations: the last one silently wins everywhere
console.log(pick()); // 'second' — even though this call appears BEFORE the second declaration
function pick() { return 'first'; }
function pick() { return 'second'; }
console.log(pick()); // 'second'
```

## Common Pitfalls / Gotchas

- Assuming `let`/`const` are "not hoisted" at all — they are hoisted (the engine knows about them from block-entry), but they sit in the TDZ, unusable until their declaration line runs; this is different from "not hoisted," which would just be a plain `ReferenceError: x is not defined`.
- Forgetting function *expressions* aren't hoisted the same way as function *declarations* — only the variable is hoisted (per `var`/`let`/`const` rules), not the function value itself.
- Declaring the same function name multiple times via `function` declarations in the same scope and being surprised the last one wins for every call site, regardless of source order relative to the calls.
- Relying on hoisting for code readability — even though `var`/function hoisting technically permits using a variable/function before its declaration line, writing code in declaration-then-use order is far clearer and avoids TDZ-related confusion entirely.

## Interview Questions & Answers

**Q: What is hoisting, and why does `console.log(x); var x = 5;` not throw an error?**
A: Hoisting is the engine's pre-processing of `var`/function declarations during the creation phase of an execution context, before line-by-line execution starts. `var x` is hoisted and initialized to `undefined` immediately, so referencing `x` before its assignment line returns `undefined` rather than throwing — only the *assignment* (`= 5`) happens later, at its original line.

**Q: Why does accessing a `let` variable before its declaration throw an error, while `var` just gives `undefined`?**
A: `let`/`const` bindings are hoisted to the top of their block but left uninitialized — a state called the Temporal Dead Zone — until their declaration statement actually executes. Accessing them during the TDZ throws a `ReferenceError`, a deliberate design choice to catch what's usually a genuine ordering bug, unlike `var`'s more permissive (and bug-prone) `undefined` fallback.

**Q: Are function expressions and arrow functions hoisted the same way as function declarations?**
A: No. Function declarations are hoisted with their entire body, callable anywhere in scope. Function expressions and arrow functions are just values assigned to a variable — only the variable's declaration is hoisted (per whichever keyword declares it), and the function itself isn't usable until the assignment line actually runs.

**Q: If you declare two functions with the same name using `function` declarations in the same scope, which one is actually called?**
A: The last one declared in the source, for every call to that name — regardless of whether a given call appears before or after that final declaration in the code, because the last hoisted declaration overwrites earlier ones in the Variable Environment before any code executes.

## Related Topics
- [variables-in-javascript.md](./variables-in-javascript.md)
- [let-and-const.md](./let-and-const.md)
- [execuation-context.md](./execuation-context.md)
- [variable-environment.md](./variable-environment.md)
- [functions-in-javascript.md](./functions-in-javascript.md)
