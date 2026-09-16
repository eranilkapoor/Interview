# Compose

Function composition is the act of combining two or more functions into a single new function, where the output of one becomes the input of the next. `compose` is a common functional-programming utility that combines functions in **right-to-left** order: `compose(f, g, h)(x)` is equivalent to `f(g(h(x)))` — the rightmost function runs first, and each subsequent function (moving left) is applied to the previous result. This ordering mirrors standard mathematical function composition notation, `(f ∘ g)(x) = f(g(x))`.

Composition is a cornerstone of functional programming style: instead of writing one large function that does several things, you write several small, focused, single-purpose functions and combine them declaratively to build more complex behavior. This improves testability (each small function can be tested in isolation), readability (the composed pipeline reads as a clear sequence of named transformations), and reuse (the same small functions can be recombined in different compositions for different purposes).

`compose` is closely related to, and often discussed alongside, [pipe.md](./pipe.md) — the only difference between them is the order of application (right-to-left for `compose`, left-to-right for `pipe`). Libraries like Redux popularized `compose` for combining middleware/enhancers, and it's a common small utility to implement from scratch in interviews to demonstrate understanding of `reduce` and higher-order functions.

## Examples

```js
// A basic compose implementation using reduceRight
function compose(...fns) {
  return function (x) {
    return fns.reduceRight((acc, fn) => fn(acc), x);
  };
}
const double = x => x * 2;
const increment = x => x + 1;
const square = x => x * x;

const transform = compose(square, increment, double);
// Runs right-to-left: double first, then increment, then square
console.log(transform(3)); // double(3)=6 -> increment(6)=7 -> square(7)=49
```

```js
// Real-world-ish example: composing string-processing functions
const trim = s => s.trim();
const toLowerCase = s => s.toLowerCase();
const removeSpaces = s => s.replace(/\s+/g, '-');

const slugify = compose(removeSpaces, toLowerCase, trim);
console.log(slugify('  Hello World  ')); // "hello-world"
// Order of execution: trim -> toLowerCase -> removeSpaces (right to left in the compose call)
```

```js
// compose() with a single function just returns an equivalent function
const identityish = compose(double);
console.log(identityish(5)); // 10 — same as calling double(5) directly
```

## Common Pitfalls / Gotchas

- Forgetting `compose` applies functions right-to-left — a common source of bugs when a reader (or the author) mentally expects left-to-right execution order; always double-check which utility (`compose` vs `pipe`) a codebase uses.
- Composing functions with mismatched arity/shape — `compose` (in its simplest form) assumes every function in the chain takes exactly one argument and returns one value; composing a function that needs multiple arguments requires adapting it first (e.g., via currying).
- Using `compose` on functions with side effects and assuming execution order doesn't matter — it very much does; side effects will happen in the actual right-to-left execution order, which needs to be correct for the composition to behave as intended.
- Not handling the empty-functions-list edge case in a custom `compose` implementation — `compose()()` with no functions should typically act as an identity function; test for this if writing your own utility.

## Interview Questions & Answers

**Q: What does `compose(f, g, h)(x)` evaluate to?**
A: `f(g(h(x)))` — functions are applied right-to-left; `h` runs first on `x`, then `g` is applied to that result, and finally `f` is applied to `g`'s result.

**Q: How would you implement a generic `compose` function from scratch?**
```js
const compose = (...fns) => x => fns.reduceRight((acc, fn) => fn(acc), x);
```
A: Using `reduceRight` (which processes the array from right to left) starting with the initial value `x`, applying each function in turn to the accumulated result.

**Q: What's the difference between `compose` and `pipe`?**
A: Purely the direction of application. `compose(f, g, h)(x)` is `f(g(h(x)))` (right to left). `pipe(f, g, h)(x)` is `h(g(f(x)))` (left to right) — same idea, opposite reading order, often chosen based on which reads more naturally for a given pipeline.

**Q: Why is function composition considered a core functional-programming technique?**
A: It lets you build complex behavior by combining small, pure, single-purpose functions declaratively, rather than writing one large imperative function — improving testability, readability, and reuse, and aligning with the broader functional-programming preference for describing transformations as data flowing through a pipeline of functions.

## Related Topics
- [pipe.md](./pipe.md)
- [higher-order-function.md](./higher-order-function.md)
- [pure-function.md](./pure-function.md)
- [functional-programing.md](./functional-programing.md)
- [currying.md](./currying.md)
