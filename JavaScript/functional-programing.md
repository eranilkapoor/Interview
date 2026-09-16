# Functional Programming

Functional programming (FP) is a programming paradigm that treats computation as the evaluation and composition of functions, favoring immutable data and pure functions over mutable state and imperative step-by-step instructions. JavaScript is not a purely functional language (it fully supports mutation, classes, and imperative loops), but its first-class functions, closures, and array methods (`map`/`filter`/`reduce`) make it very capable of functional-style code, and FP ideas are heavily used throughout modern JS — especially in React (pure components, immutable state updates) and Redux (pure reducers).

Core FP principles include: **pure functions** (same input, same output, no side effects — see [pure-function.md](./pure-function.md)), **immutability** (never mutate data; always produce new data — see [immutability.md](./immutability.md)), **first-class and higher-order functions** (functions as values, functions that take/return functions — see [higher-order-function.md](./higher-order-function.md)), **function composition** (building complex behavior from small functions — see [compose.md](./compose.md)/[pipe.md](./pipe.md)), and **declarative style** (describing *what* result is wanted rather than *how* to compute it step by step, e.g., `array.map(fn)` over a manual `for` loop).

FP is often contrasted with object-oriented programming (OOP), which JavaScript also fully supports via prototypes and `class` syntax. The two aren't mutually exclusive — real-world JavaScript code commonly blends both, using classes/objects for stateful entities while writing the logic that operates on data in a functional, side-effect-minimizing style. Interviewers often probe this paradigm-blending awareness rather than expecting dogmatic adherence to either style.

## Examples

```js
// Imperative (step-by-step, mutation-heavy) vs functional (declarative, immutable) style
// Imperative:
function getActiveNamesImperative(users) {
  const result = [];
  for (let i = 0; i < users.length; i++) {
    if (users[i].active) {
      result.push(users[i].name);
    }
  }
  return result;
}

// Functional:
const getActiveNamesFunctional = users =>
  users.filter(u => u.active).map(u => u.name);

const users = [{ name: 'Anil', active: true }, { name: 'Bob', active: false }];
console.log(getActiveNamesFunctional(users)); // ["Anil"]
```

```js
// Composing small pure functions instead of one large impure one
const pipe = (...fns) => x => fns.reduce((acc, fn) => fn(acc), x);
const withTax = price => price * 1.08;
const withDiscount = price => price * 0.9;
const round = price => Math.round(price * 100) / 100;

const finalPrice = pipe(withDiscount, withTax, round);
console.log(finalPrice(100)); // 97.2
```

```js
// Immutable state update pattern, common in React/Redux-style functional code
function reducer(state, action) {
  switch (action.type) {
    case 'increment':
      return { ...state, count: state.count + 1 }; // new object, no mutation
    default:
      return state;
  }
}
const state1 = { count: 0 };
const state2 = reducer(state1, { type: 'increment' });
console.log(state1, state2); // { count: 0 } { count: 1 } — original untouched
```

## Common Pitfalls / Gotchas

- Believing JavaScript must be used in a "purely functional" way to benefit from FP ideas — even partial adoption (immutable updates, some pure utility functions, avoiding unnecessary mutation) provides real value without requiring dogmatic purity.
- Chaining many array methods (`map`/`filter`/`reduce`) for readability while ignoring the performance cost of creating multiple intermediate arrays on very large datasets — sometimes a single pass (a manual loop or one `reduce`) is more appropriate for performance-critical code.
- Assuming FP and OOP are mutually exclusive in JS — most production codebases mix both, e.g., classes for stateful domain entities plus pure functions/utilities for the logic that processes their data.
- Writing "clever" heavily composed/curried code that's hard for teammates to read — FP techniques should improve clarity and testability; if they consistently obscure intent for your team, that's a real cost to weigh against their benefits.

## Interview Questions & Answers

**Q: What are the core principles of functional programming, and how does JavaScript support them?**
A: Pure functions, immutability, first-class/higher-order functions, and function composition. JavaScript supports all of these natively: functions are first-class values, closures enable composition and function factories, and `const`/spread/array methods make writing immutable-update-style code straightforward, even though the language also fully permits mutation and imperative style.

**Q: Is JavaScript a purely functional language? Why or why not?**
A: No — it's multi-paradigm. It fully supports mutable state, classes, `this`, and imperative loops alongside functional features. Unlike a purely functional language (like Haskell), JS doesn't enforce immutability or purity anywhere in the language itself; FP in JS is a *style choice* enabled by the language's features, not a language-level guarantee.

**Q: Why is immutability emphasized in functional programming?**
A: Immutable data eliminates a whole class of bugs caused by unexpected mutation from shared references, makes change detection cheap (reference equality, used heavily by React), and makes reasoning about program state far simpler since a value, once created, can never silently change out from under you.

**Q: Give a practical example of converting imperative code to a more functional style.**
A: Replacing a manual `for` loop that builds up a filtered/transformed array via `push()` with a chain of `array.filter(...).map(...)` — the functional version describes *what* transformation is wanted declaratively, delegating the *how* (iteration mechanics) to the built-in methods.

## Related Topics
- [pure-function.md](./pure-function.md)
- [immutability.md](./immutability.md)
- [higher-order-function.md](./higher-order-function.md)
- [compose.md](./compose.md)
- [pipe.md](./pipe.md)
- [currying.md](./currying.md)
- [object-oriented-programing.md](./object-oriented-programing.md)
