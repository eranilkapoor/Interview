# Promises

A Promise is an object representing the eventual result of an asynchronous operation — a value that may not be available yet, but will be at some point (or the operation will fail with a reason). A Promise is always in one of three states: **pending** (the initial state, neither fulfilled nor rejected), **fulfilled** (the operation completed successfully, with a resulting value), or **rejected** (the operation failed, with a reason/error). Once a Promise settles (fulfills or rejects), it is **immutable** — it can never transition to a different state or value again, which is what makes Promise-based code predictable to reason about compared to raw callbacks.

A Promise's executor function (the function passed to `new Promise((resolve, reject) => {...})`) runs **synchronously and immediately** when the Promise is constructed — Promises are "eager," not lazy; the async work itself typically starts right away, but the *result* of that work is only observable later via `.then()`/`.catch()`. `.then(onFulfilled, onRejected)` registers callbacks for the two possible outcomes and itself returns a **new** Promise, enabling chaining — each `.then()` in a chain waits for the previous one's returned value (or Promise) before running, which is how sequential async steps compose without nesting. `.catch(onRejected)` is shorthand for `.then(undefined, onRejected)`, and `.finally(fn)` runs regardless of outcome, useful for cleanup.

Errors in a Promise chain propagate automatically: if any `.then()` handler throws (or returns a rejected Promise), the chain skips ahead to the nearest `.catch()`, without needing explicit error handling at every single step — a major ergonomic improvement over manually checking for errors after every nested callback. Static helpers round out the API: `Promise.resolve(value)`/`Promise.reject(reason)` wrap values directly; `Promise.all(promises)` waits for every promise to fulfill (rejecting immediately if any one rejects); `Promise.allSettled(promises)` waits for all to settle regardless of outcome; `Promise.race(promises)` settles as soon as the first one does; `Promise.any(promises)` fulfills as soon as the first one fulfills (ignoring rejections unless all reject).

## Examples

```js
// Creating and consuming a Promise
const wait = (time, value) => new Promise(resolve => setTimeout(() => resolve(value), time));
wait(1000, 'Hello!').then(result => console.log(result)); // "Hello!" after ~1 second
```

```js
// Chaining, error propagation, and finally
function fetchUser(id) {
  return id > 0
    ? Promise.resolve({ id, name: 'Anil' })
    : Promise.reject(new Error('Invalid id'));
}
fetchUser(1)
  .then(user => { console.log('Got user:', user.name); return user.id; })
  .then(id => { throw new Error('Simulated failure downstream'); })
  .catch(err => console.log('Caught:', err.message)) // catches the throw from the previous .then
  .finally(() => console.log('Done, regardless of outcome'));
```

```js
// Promise.all vs Promise.allSettled vs Promise.race
const p1 = wait(100, 'fast');
const p2 = wait(200, 'medium');
const p3 = Promise.reject(new Error('failed one'));

Promise.all([p1, p2]).then(console.log); // ['fast', 'medium'] — waits for all
Promise.race([p1, p2]).then(console.log); // 'fast' — settles with the first to finish
Promise.allSettled([p1, p3]).then(console.log);
// [{status:'fulfilled', value:'fast'}, {status:'rejected', reason: Error}]
```

## Common Pitfalls / Gotchas

- Forgetting to return a value/Promise inside a `.then()` handler when chaining — the next `.then()` receives `undefined` instead of the intended result, since JS doesn't automatically forward a non-returned value.
- Using `Promise.all()` when one rejection should not cancel visibility into the others — `Promise.all` rejects as soon as any single promise rejects, discarding the results of the others; use `Promise.allSettled()` when you need every outcome regardless of failures.
- Not attaching any `.catch()` (or wrapping in `try...catch` with `await`) — leads to unhandled promise rejections, which can crash a Node.js process or silently vanish in some browser contexts.
- Assuming the Promise constructor's executor runs lazily, only when someone calls `.then()` — it actually runs immediately and synchronously when `new Promise(...)` is constructed, regardless of whether anything is listening yet.
- Nesting `.then()` calls instead of chaining them flat — this reintroduces a form of "callback hell" that Promises were meant to eliminate; each `.then()` should generally return a value for the next one to flatten the chain.

## Interview Questions & Answers

**Q: What are the three states of a Promise, and can a Promise change state after settling?**
A: Pending, fulfilled, and rejected. Once a Promise transitions to fulfilled or rejected (collectively, "settled"), it is permanently locked into that state and value/reason — it can never change again, which is a deliberate immutability guarantee.

**Q: What's the difference between `Promise.all()` and `Promise.allSettled()`?**
A: `Promise.all()` resolves with an array of all fulfilled values only if *every* promise fulfills — it rejects immediately as soon as any single promise rejects, discarding information about the others. `Promise.allSettled()` always resolves (never rejects) once every promise has settled, giving you an array of `{status, value}` or `{status, reason}` objects for each one, regardless of individual outcomes.

**Q: Is the function passed to `new Promise((resolve, reject) => {...})` executed synchronously or asynchronously?**
A: Synchronously and immediately, as soon as the Promise is constructed. What's asynchronous is typically the operation *inside* it (e.g., a `setTimeout` or network call) — the executor function itself runs eagerly at construction time, not lazily deferred until someone attaches a `.then()`.

**Q: How does error propagation work in a Promise chain?**
A: If any `.then()` handler throws an exception, or explicitly returns a rejected Promise, the chain automatically skips forward to the nearest `.catch()` handler (or the rejection handler of the nearest `.then(onFulfilled, onRejected)` with two arguments), without needing explicit error checks at every intermediate step.

**Q: What's the difference between `Promise.race()` and `Promise.any()`?**
A: `Promise.race()` settles as soon as the *first* promise settles, whether it fulfills or rejects — so a fast rejection can "win" the race. `Promise.any()` fulfills as soon as the first promise *fulfills*, ignoring rejections along the way, and only rejects itself (with an `AggregateError`) if *all* of the input promises reject.

## Related Topics
- [async-await.md](./async-await.md)
- [callbacks.md](./callbacks.md)
- [event-loop.md](./event-loop.md)
- [microtask-queue-or-job-queue.md](./microtask-queue-or-job-queue.md)
- [error-handling.md](./error-handling.md)
