# Partial Application

Partial application is the technique of fixing some of a function's arguments up front, producing a new function that accepts only the *remaining* arguments. Unlike currying, which strictly decomposes a function into a chain of single-argument calls, partial application is more flexible: you can fix any number of arguments (one, several, or all-but-one) in a single step, and the resulting function accepts however many arguments are left, in whatever grouping makes sense.

`Function.prototype.bind()` is JavaScript's built-in mechanism for partial application: calling `fn.bind(thisArg, arg1, arg2)` returns a new function with `arg1`/`arg2` permanently pre-filled (and `this` fixed), needing only the remaining arguments when eventually called. This is a very common real-world use of `.bind()` beyond just fixing `this` — pre-filling some leading arguments for a generic utility function to create a specialized variant.

Partial application is especially useful for adapting a general-purpose function to fit an API that expects a specific, smaller signature — a frequent case being event handlers or callback parameters that only receive one argument (like a DOM event), where you need to also supply extra context that isn't part of that fixed signature.

## Examples

```js
// Partial application via bind() — fixing a leading argument
function multiply(a, b) {
  return a * b;
}
const double = multiply.bind(null, 2); // fixes `a` as 2; `this` unused here, so null
console.log(double(5)); // 10
console.log(double(10)); // 20
```

```js
// A generic partial() helper, fixing any number of leading arguments
function partial(fn, ...fixedArgs) {
  return function (...remainingArgs) {
    return fn(...fixedArgs, ...remainingArgs);
  };
}
function greet(greeting, name, punctuation) {
  return `${greeting}, ${name}${punctuation}`;
}
const sayHelloTo = partial(greet, 'Hello');
console.log(sayHelloTo('Anil', '!')); // "Hello, Anil!"
```

```js
// Practical use: pre-filling context for an event handler
function logClick(context, event) {
  console.log(`[${context}] clicked at`, event.clientX, event.clientY);
}
// button.addEventListener('click', logClick.bind(null, 'HomePage'));
// The handler receives the DOM event as its only argument, but 'HomePage' is pre-filled
```

## Common Pitfalls / Gotchas

- Using `.bind()` for partial application without considering that it *also* permanently fixes `this` — pass `null` (non-strict-safe) or the correct `this` explicitly as the first argument even when you only care about pre-filling later arguments.
- Confusing partial application with currying — partial application doesn't require reducing everything to single-argument calls; it just fixes some subset of arguments and leaves the rest for later, in any grouping.
- Repeatedly calling `.bind()` on an already-bound function expecting to "add more" fixed arguments in a complex way — each `.bind()` call fixes `this` once (subsequent binds can't override it) but does append additional fixed arguments ahead of previous ones, which can be a source of confusion if not tested carefully.
- Assuming a partially applied function retains the original function's `.length` correctly — `.bind()` adjusts `.length` to reflect the remaining expected arguments, but custom partial-application helpers may not do this automatically.

## Interview Questions & Answers

**Q: What is partial application, and how does `Function.prototype.bind()` support it?**
A: Partial application fixes some of a function's arguments ahead of time, producing a new function that only needs the remaining ones. `fn.bind(thisArg, ...presetArgs)` does exactly this — it returns a new function with `thisArg` and any provided arguments permanently baked in, requiring only the arguments not yet supplied when eventually invoked.

**Q: How does partial application differ from currying?**
A: Currying strictly transforms a function into a chain of single-argument functions (`f(a)(b)(c)`). Partial application is more general — you can fix any number of arguments together in one step and the resulting function can still accept multiple remaining arguments at once, not necessarily one at a time.

**Q: Give a practical, real-world use case for partial application.**
A: Pre-filling contextual information for an event handler or callback whose signature is fixed by an API (e.g., a DOM event listener always passes just the `event` object) — partial application lets you attach extra context (like an identifier or configuration) to a general handler function without changing the handler's expected final signature.

## Related Topics
- [currying.md](./currying.md)
- [bind-function.md](./bind-function.md)
- [higher-order-function.md](./higher-order-function.md)
- [functional-programing.md](./functional-programing.md)
