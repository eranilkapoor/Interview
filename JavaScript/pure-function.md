# Pure Functions

A pure function is a function that satisfies two properties: (1) given the same input, it **always returns the same output** — no randomness, no dependency on external mutable state (global variables, current time, network responses); and (2) it produces **no observable side effects** — it doesn't mutate its arguments, doesn't modify any external state, doesn't perform I/O (logging, DOM manipulation, network calls), and doesn't rely on or alter anything outside its own local scope.

Pure functions are the building blocks of functional programming because they are maximally predictable and composable: you can call a pure function any number of times, in any order, from anywhere, and reason about its behavior in complete isolation — which makes them trivially unit-testable (no mocking, no setup/teardown of external state needed), safely memoizable/cacheable (same input always gives the same output, so caching is always correct), and safe to run in parallel or reorder relative to other pure calls, since there's no shared mutable state to create race conditions.

Most real applications need *some* impure operations (reading user input, fetching data, writing to a database, updating the DOM) — the functional-programming discipline isn't "eliminate all side effects" but rather "push side effects to the edges of the program and keep the core logic pure." This makes the impure, environment-touching parts small, isolated, and easy to reason about, while the bulk of business logic remains pure, tested, and composable.

## Examples

```js
// Pure function: same input always produces same output, no external state touched
function add(a, b) {
  return a + b;
}
console.log(add(2, 3)); // 5, always, forever, no matter what
```

```js
// Impure function: depends on external state (Math.random) — NOT pure
function rollDice() {
  return Math.floor(Math.random() * 6) + 1; // different output each call, same "input" (none)
}

// Impure function: mutates its argument (a side effect) — NOT pure
function addItemImpure(cart, item) {
  cart.push(item); // mutates the caller's array
  return cart;
}

// Pure equivalent: returns a new array instead of mutating the original
function addItemPure(cart, item) {
  return [...cart, item];
}
```

```js
// Pure functions are trivially testable and composable
function tax(price, rate) { return price * rate; }
function total(price, rate) { return price + tax(price, rate); }
console.log(total(100, 0.08)); // 108 — deterministic, easy to assert in a test
```

## Common Pitfalls / Gotchas

- Believing a function is pure just because it "looks small" — a function that reads a global variable, the current date/time, or a random number is impure even if it has no explicit `return`-value side effects, because its output isn't determined solely by its inputs.
- Mutating an object/array parameter inside a function and assuming it's still pure because "nothing was returned differently" — mutating an argument is itself a side effect (it's visible to the caller), which disqualifies the function from being pure.
- Overusing "purity" as a purity test for the whole application — real programs need I/O and mutation somewhere; the practical goal is isolating and minimizing impure code, not eliminating it entirely.
- Assuming pure functions can't call other functions — they can, as long as everything called is *also* pure (or its impurity doesn't leak observably into the outer function's behavior).

## Interview Questions & Answers

**Q: What are the two defining properties of a pure function?**
A: (1) Given the same inputs, it always produces the same output — no reliance on external mutable state. (2) It has no observable side effects — no mutation of arguments or external state, no I/O.

**Q: Why are pure functions easier to test than impure ones?**
A: Because their output depends solely on their inputs, a test can call the function with fixed inputs and assert on the output with complete confidence and no setup/teardown of external state, mocks, or timing concerns — the same call will always produce the same result, regardless of when or how many times it's run.

**Q: Is a function that logs to the console still pure?**
A: No — logging is an observable side effect (I/O), even though it doesn't change the function's return value. Strictly, purity requires *no* side effects at all, so a logging statement, however harmless it seems, technically disqualifies a function from being pure.

**Q: Give an example of turning an impure function into a pure one.**
A: `function addItem(cart, item) { cart.push(item); return cart; }` mutates its argument — impure. The pure version: `function addItem(cart, item) { return [...cart, item]; }`, which returns a brand-new array and leaves the original `cart` untouched.

## Related Topics
- [functional-programing.md](./functional-programing.md)
- [immutability.md](./immutability.md)
- [pass-by-reference.md](./pass-by-reference.md)
- [compose.md](./compose.md)
