# Currying

Currying is the technique of transforming a function that takes multiple arguments into a sequence of functions, each taking a single argument, where calling the first with one argument returns a new function expecting the next argument, and so on, until all arguments have been supplied and the final result is computed. A curried version of `add(a, b, c)` is called as `add(a)(b)(c)` instead of `add(a, b, c)`.

Currying enables powerful function-composition and reuse patterns: once a curried function has received some of its arguments, the resulting partially-applied function can be stored, passed around, and reused with different remaining arguments — effectively creating specialized variants of a general function on demand (e.g., `const double = multiply(2); double(5); // 10`). This is closely related to, but distinct from, [partial-application.md](./partial-application.md): currying specifically transforms a function's *arity* into a chain of unary (single-argument) functions, while partial application more generally means fixing *some* of a function's arguments (in any grouping) ahead of time, without necessarily reducing everything down to one argument at a time.

Currying relies entirely on closures: each returned function in the chain closes over the arguments already collected, remembering them until enough arguments have accumulated to compute the final result. Libraries like Lodash and Ramda provide generic `curry()` helpers that automatically curry any function, since manually writing curried versions of every function would be tedious.

## Examples

```js
// A manually curried function
function add(a) {
  return function (b) {
    return function (c) {
      return a + b + c;
    };
  };
}
console.log(add(1)(2)(3)); // 6
```

```js
// Practical use: creating specialized functions via partial invocation of a curried function
function multiply(a) {
  return (b) => a * b;
}
const double = multiply(2);
const triple = multiply(3);
console.log(double(5), triple(5)); // 10 15
```

```js
// A generic curry() helper that curries any function automatically
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }
    return (...moreArgs) => curried.apply(this, [...args, ...moreArgs]);
  };
}
function sum3(a, b, c) { return a + b + c; }
const curriedSum = curry(sum3);
console.log(curriedSum(1)(2)(3));   // 6
console.log(curriedSum(1, 2)(3));   // 6 — also supports grouped arguments
console.log(curriedSum(1)(2, 3));   // 6
```

## Common Pitfalls / Gotchas

- Confusing currying with partial application — currying always produces a chain of single-argument functions; partial application can fix any subset/grouping of arguments at once without necessarily reducing to unary calls.
- Writing a generic `curry()` helper that relies on `fn.length` without accounting for default parameters or rest parameters — `fn.length` only counts parameters before the first default value or rest parameter, which can silently break the arity check.
- Over-currying simple functions in real codebases where it adds indirection without a clear reuse benefit — currying shines specifically when you need to create many specialized variants of a general function.
- Forgetting curried functions rely on closures to accumulate arguments — each partial call creates a new closure holding the arguments collected so far, which has a (usually negligible, but real) memory/performance cost compared to a single direct call.

## Interview Questions & Answers

**Q: What is currying, and how would you manually curry a three-argument function?**
A: Currying transforms `f(a, b, c)` into `f(a)(b)(c)` — a chain of functions each taking one argument, where each step returns a new function until all arguments have been supplied. Manually: `function f(a) { return b => c => a + b + c; }`.

**Q: What's the practical benefit of currying?**
A: It lets you create specialized, reusable functions by partially supplying arguments ahead of time — e.g., `const addTax = applyRate(0.08); addTax(100);` — turning a general-purpose function into a family of pre-configured ones without duplicating logic.

**Q: How is currying different from partial application?**
A: Currying always decomposes a function into a strict sequence of single-argument functions. Partial application is a more general concept: fixing any number of a function's arguments up front (in one call), returning a new function that accepts the rest — the remaining arguments don't have to be supplied one at a time.

**Q: What mechanism makes currying possible in JavaScript?**
A: Closures — each returned function in the curry chain closes over the arguments already accumulated, remembering them across calls until enough have been collected to invoke the original function with the full argument list.

## Related Topics
- [partial-application.md](./partial-application.md)
- [closures.md](./closures.md)
- [higher-order-function.md](./higher-order-function.md)
- [functional-programing.md](./functional-programing.md)
- [compose.md](./compose.md)
