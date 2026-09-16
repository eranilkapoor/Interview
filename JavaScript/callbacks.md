# Callbacks

A callback is a function passed as an argument into another function, intended to be invoked (called back) by that outer function at an appropriate time — either immediately, synchronously, within the same call (e.g., `array.map(callback)`), or later, asynchronously, once some operation completes (e.g., `fetch(url).then(callback)`, `setTimeout(callback, 1000)`, an event listener). Callbacks are the original, most fundamental pattern JavaScript used (and still uses) to handle both generic customization (like `map`/`filter`) and asynchronous work.

For asynchronous work specifically, callbacks let code continue executing without blocking while waiting for an operation (a network request, a timer, a file read) to finish — the callback is simply the mechanism for "run this code once that eventually resolves." Before Promises and `async`/`await` existed, nested asynchronous callbacks were the *only* tool available, which led to the infamous **callback hell** (or "pyramid of doom"): deeply nested callbacks-within-callbacks, each depending on the previous one's result, producing code that's hard to read, hard to handle errors in consistently, and hard to maintain.

Promises (see [promises.md](./promises.md)) and `async`/`await` (see [async-await.md](./async-await.md)) were introduced specifically to give async code a flatter, more linear structure while still ultimately relying on callback-like mechanisms under the hood (a `.then()` handler is, at its core, still a callback — just orchestrated by a Promise's state machine instead of nested manually).

## Examples

```js
// Synchronous callback: invoked immediately, within the same call
function processUserInput(callback) {
  const name = 'Anil'; // (in real code, this might come from user input)
  callback(name);
}
processUserInput(function greet(name) {
  console.log(`Hello, ${name}`);
}); // "Hello, Anil"
```

```js
// Asynchronous callback: invoked later, once the operation completes
console.log('Start');
setTimeout(() => {
  console.log('This runs later, after Start and End');
}, 1000);
console.log('End');
// Output order: "Start" "End" "This runs later..."
```

```js
// Callback hell: nested, dependent async callbacks (the problem Promises solve)
getUser(1, (user) => {
  getPosts(user.id, (posts) => {
    getComments(posts[0].id, (comments) => {
      console.log(comments); // deeply nested, hard to read/maintain, awkward error handling
    }, handleError);
  }, handleError);
}, handleError);
function handleError(err) { console.error(err); }
```

## Common Pitfalls / Gotchas

- Forgetting that passing a callback loses its original `this` binding if it was extracted from an object method — `array.forEach(obj.method)` calls `method` with `this` no longer bound to `obj` (fix with `.bind(obj)` or an arrow-function wrapper).
- Writing deeply nested callbacks for sequential async steps ("callback hell") instead of using Promises/`async`-`await`, making error handling and readability much worse than necessary.
- Calling a callback more than once (or not at all) by mistake in custom async utility functions — a subtle bug class specific to hand-rolled callback-based APIs, since nothing enforces "exactly once" semantics the way Promises do.
- Mixing synchronous and asynchronous callback invocation inconsistently in the same function (sometimes calling the callback immediately, sometimes deferring it) — this is a classic source of confusing bugs (Zalgo problem), since callers can't reliably reason about execution order.

## Interview Questions & Answers

**Q: What is a callback function, and what's the difference between a synchronous and an asynchronous callback?**
A: A callback is a function passed into another function to be invoked by it. A synchronous callback is invoked immediately, during the same call (e.g., inside `array.map`). An asynchronous callback is invoked later, after some operation completes (a timer, a network request, an event) — control returns to the caller immediately, and the callback runs at an unspecified future point.

**Q: What is "callback hell," and what replaced it?**
A: Deeply nested callbacks, each depending on the previous one's result, forming a "pyramid" shape that's hard to read, refactor, and handle errors in consistently (since each nesting level needs its own error handling). Promises (with `.then()` chaining) and, later, `async`/`await` (which lets asynchronous code read like synchronous code) largely replaced this pattern in modern JavaScript.

**Q: Why might a callback passed as `array.forEach(obj.someMethod)` behave unexpectedly with `this`?**
A: `forEach` invokes the callback as a plain function call (not as `obj.someMethod()`), so `this` inside `someMethod` is no longer bound to `obj` — it's `undefined` (strict mode) or the global object otherwise. Fixing it requires `array.forEach(obj.someMethod.bind(obj))` or `array.forEach((...args) => obj.someMethod(...args))`.

**Q: How do Promises solve callback hell without eliminating callbacks entirely?**
A: Promises still ultimately invoke your handler functions (which are, structurally, still callbacks) via `.then()`/`.catch()`, but they provide a flat, chainable structure and unified error propagation, instead of requiring manual nesting and repeated error-handling code at every level. `async`/`await` goes further by letting you write that same chained logic in a linear, synchronous-looking style.

## Related Topics
- [higher-order-function.md](./higher-order-function.md)
- [promises.md](./promises.md)
- [async-await.md](./async-await.md)
- [event-loop.md](./event-loop.md)
- [this-keyword.md](./this-keyword.md)
