# Pipe

`pipe` is a function-composition utility, structurally identical to [compose.md](./compose.md) except that it applies functions in **left-to-right** order: `pipe(f, g, h)(x)` is equivalent to `h(g(f(x)))` — the first function listed runs first, and each subsequent function is applied to the result of the previous one, reading in the same order they're written. Many developers find `pipe` more intuitive than `compose` specifically because its execution order matches its *reading* order, mirroring how you'd describe a real-world processing pipeline ("first do this, then that, then that").

`pipe` is heavily used in functional-programming-flavored codebases (and libraries like RxJS, which has a first-class `pipe()` operator for chaining observable operators) to express a value flowing through a sequence of transformations, each one small and focused. It's a common alternative to deeply nested function calls or long method chains, especially when combining several independent utility functions that weren't designed as methods on a single object/class.

Like `compose`, a basic `pipe` implementation assumes each function in the chain accepts a single argument and returns a single value that gets fed into the next function — adapting functions that need more than one argument (e.g., via currying or explicit wrapping) is required before they can participate in a pipe.

## Examples

```js
// A basic pipe implementation using reduce (left to right)
function pipe(...fns) {
  return function (x) {
    return fns.reduce((acc, fn) => fn(acc), x);
  };
}
const double = x => x * 2;
const increment = x => x + 1;
const square = x => x * x;

const transform = pipe(double, increment, square);
// Runs left-to-right: double first, then increment, then square
console.log(transform(3)); // double(3)=6 -> increment(6)=7 -> square(7)=49
```

```js
// Same slugify example as compose.md, but reads naturally in execution order with pipe
const trim = s => s.trim();
const toLowerCase = s => s.toLowerCase();
const removeSpaces = s => s.replace(/\s+/g, '-');

const slugify = pipe(trim, toLowerCase, removeSpaces);
console.log(slugify('  Hello World  ')); // "hello-world"
// Reading left to right IS the actual execution order: trim -> toLowerCase -> removeSpaces
```

```js
// pipe() used to build a data-processing pipeline for an array of records
const getActiveUsers = pipe(
  users => users.filter(u => u.active),
  users => users.map(u => u.name),
  names => names.sort()
);
const result = getActiveUsers([
  { name: 'Zoe', active: true },
  { name: 'Anil', active: true },
  { name: 'Bob', active: false },
]);
console.log(result); // ["Anil", "Zoe"]
```

## Common Pitfalls / Gotchas

- Confusing `pipe`'s left-to-right order with `compose`'s right-to-left order when switching between codebases/libraries that use one or the other — always check which is in use before reasoning about execution order.
- Assuming `pipe` (in its basic form) supports async functions transparently — a naive `reduce`-based `pipe` doesn't await intermediate Promises; an async-aware pipe needs to explicitly handle/await each step's result.
- Passing functions with the wrong arity into a pipe — every function after the first must accept exactly the single value produced by the previous step; multi-argument functions need adapting first.
- Building overly long pipes that become hard to debug — when a pipe of 8+ steps fails, it can be hard to tell which stage produced a bad value without adding logging/breakpoints between steps.

## Interview Questions & Answers

**Q: What does `pipe(f, g, h)(x)` evaluate to, and how is it different from `compose`?**
A: `h(g(f(x)))` — functions run left-to-right, in the order they're listed, which is the opposite direction from `compose` (`f(g(h(x)))`, right-to-left). Both achieve the same kind of function composition; they just differ in reading/execution direction.

**Q: How would you implement `pipe` from scratch?**
```js
const pipe = (...fns) => x => fns.reduce((acc, fn) => fn(acc), x);
```
A: Using `Array.prototype.reduce` (left-to-right by nature) starting from the initial input `x`, applying each function to the running result in order.

**Q: Why might a team prefer `pipe` over `compose` in their codebase?**
A: `pipe`'s execution order matches its reading order (top-to-bottom, left-to-right), which many developers find more intuitive to trace mentally — "first this happens, then this, then this" — versus `compose`, where you have to read right-to-left to understand execution order, which can be less natural, especially for longer chains.

## Related Topics
- [compose.md](./compose.md)
- [higher-order-function.md](./higher-order-function.md)
- [functional-programing.md](./functional-programing.md)
- [array-methods.md](./array-methods.md)
