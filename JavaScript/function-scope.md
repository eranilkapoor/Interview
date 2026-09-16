# Function Scope

Function scope means a variable declared inside a function is only accessible within that function (and any nested functions/blocks inside it) — it's invisible to code outside the function. In JavaScript, `var` is function-scoped: a `var` declared anywhere inside a function (even nested inside `if`/`for` blocks) belongs to the *entire* function, not just the block it was textually written in. This is different from `let`/`const`, which are block-scoped (see [block-scope.md](./block-scope.md)), confined to the nearest enclosing `{ }`.

Before `let`/`const` existed (pre-ES2015), function scope was the *only* scoping mechanism narrower than global scope, which is why wrapping code in an IIFE was such a common pattern for creating an isolated scope — there was no block-level alternative. Function scope is also the reason `var` "leaks" out of `if`/`for`/`while` blocks but not out of the enclosing function — a frequent source of confusion for developers coming from block-scoped languages.

Each function call creates a *new* function scope (a new execution context with its own variable environment), meaning recursive calls or multiple invocations of the same function each get independent copies of that function's local variables — this is fundamental to how closures capture distinct state per invocation (see [closures.md](./closures.md)).

## Examples

```js
// var is function-scoped: it leaks out of blocks but not out of the function
function example() {
  if (true) {
    var x = 'I am function-scoped';
  }
  console.log(x); // "I am function-scoped" — accessible outside the if-block
}
example();
console.log(typeof x); // "undefined" — but NOT accessible outside the function
```

```js
// Each function call gets its own independent scope
function makeCounter() {
  var count = 0; // a fresh `count` for every call to makeCounter
  return function () {
    return ++count;
  };
}
const counterA = makeCounter();
const counterB = makeCounter();
console.log(counterA(), counterA(), counterB()); // 1 2 1 — independent scopes
```

```js
// Nested functions can access outer function-scoped variables (but not vice versa)
function outer() {
  var outerVar = 'from outer';
  function inner() {
    console.log(outerVar); // accessible — inner is nested inside outer's scope
  }
  inner();
}
outer();
```

## Common Pitfalls / Gotchas

- Expecting `var` inside an `if`/`for` block to be confined to that block — it isn't; it belongs to the whole enclosing function (or global scope if there's no enclosing function).
- Declaring the same `var` name in multiple nested blocks within one function, expecting separate variables — they're actually the same function-scoped variable being reassigned each time.
- Assuming a function's local variables persist between separate calls — they don't (unless captured by a returned closure); each invocation gets a fresh scope.
- Confusing function scope with the scope chain — function scope defines *where a variable lives*; the scope chain is how a nested function *looks up* variables through its own scope and outward through enclosing scopes.

## Interview Questions & Answers

**Q: What does it mean that `var` is function-scoped rather than block-scoped?**
A: A `var` declaration is visible throughout the entire function it's declared in, regardless of how many nested blocks (`if`, `for`, `while`, bare `{}`) it's textually written inside. It's only invisible outside the enclosing function (or, at the top level, the entire script/module).

**Q: Before `let`/`const` existed, how did developers achieve scoping narrower than an entire function?**
A: They wrapped code in an Immediately Invoked Function Expression (IIFE) to manually create a new function scope on demand, since function scope was the only mechanism available narrower than global scope.

**Q: Does each call to a function create a new scope, or is the function's scope shared across all its invocations?**
A: Each call creates a brand-new function scope (a new execution context with its own variable environment) — variables declared inside are independent per invocation, unless a closure specifically captures and shares access to a particular call's variables across multiple returned functions.

## Related Topics
- [block-scope.md](./block-scope.md)
- [scope-chain.md](./scope-chain.md)
- [closures.md](./closures.md)
- [variable-environment.md](./variable-environment.md)
- [hoisting.md](./hoisting.md)
