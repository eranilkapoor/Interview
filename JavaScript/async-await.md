# Async/Await

`async`/`await` (ES2017) is syntax that lets you write Promise-based asynchronous code in a linear, synchronous-looking style. Marking a function `async` does two things: it makes the function always return a Promise (wrapping a returned non-Promise value in `Promise.resolve(...)` automatically, and converting a thrown error into a rejected Promise), and it enables the use of the `await` keyword inside that function's body. `await expression` pauses the `async` function's execution at that point until the awaited Promise settles — if it fulfills, `await` evaluates to the fulfilled value; if it rejects, `await` throws that rejection as a regular exception, catchable with an ordinary `try...catch`.

Crucially, `await` only pauses the *async function itself* — it does **not** block the rest of the program. Control returns immediately to whatever called the async function, which continues running synchronously; the remainder of the async function (everything after the `await`) is scheduled to resume as a **microtask** once the awaited Promise settles. This is precisely why `async`/`await` is "just" syntax sugar over Promises and the event loop — it changes how the code *reads*, not the underlying asynchronous execution model.

`async`/`await` composes naturally with `try...catch` for error handling (unifying sync and async error handling into one familiar construct — see [error-handling.md](./error-handling.md)), and with `Promise.all()` for running multiple awaited operations concurrently rather than sequentially — a common performance mistake is `await`-ing several independent operations one after another in sequence when they could all be kicked off together and awaited in parallel.

## Examples

```js
// Basic async/await: reads like synchronous code, but is fully asynchronous
async function getGreeting() {
  return 'Hello'; // automatically wrapped: returns Promise.resolve('Hello')
}
getGreeting().then(value => console.log(value)); // "Hello"

async function getGreetingAwaited() {
  const greeting = await Promise.resolve('Hello, via await');
  console.log(greeting);
}
getGreetingAwaited(); // "Hello, via await"
```

```js
// await pauses the async function only — the caller keeps running synchronously
async function delayedLog() {
  console.log('A: inside async fn, before await');
  await new Promise(resolve => setTimeout(resolve, 100));
  console.log('C: after await, resumed as a microtask-scheduled continuation');
}
console.log('start');
delayedLog();
console.log('B: right after calling delayedLog(), still synchronous');
// Output order: start, A, B, C
```

```js
// Sequential (slow) vs concurrent (fast) await — a common performance mistake
async function sequential() {
  const a = await wait(100, 'a'); // waits 100ms
  const b = await wait(100, 'b'); // THEN waits another 100ms — total ~200ms
  return [a, b];
}
async function concurrent() {
  const [a, b] = await Promise.all([wait(100, 'a'), wait(100, 'b')]); // both start immediately — total ~100ms
  return [a, b];
}
function wait(ms, value) { return new Promise(res => setTimeout(() => res(value), ms)); }
```

## Common Pitfalls / Gotchas

- Awaiting independent async operations one after another instead of starting them concurrently with `Promise.all()` — this needlessly serializes work that could run in parallel, hurting performance.
- Forgetting to wrap `await` in `try...catch` (or otherwise handle rejection) — an awaited rejected Promise throws inside the `async` function, and if uncaught, the function's returned Promise itself rejects, potentially becoming an unhandled rejection further up the chain.
- Using `await` inside `Array.prototype.forEach` and expecting sequential behavior — `forEach` ignores returned Promises entirely and doesn't wait between iterations; use a `for...of` loop for genuinely sequential async iteration.
- Marking a function `async` "just in case" when it has no `await` inside it — this still wraps its return value in a Promise unnecessarily, subtly changing its calling contract (callers now need `.then()`/`await` to get the value) for no benefit.
- Assuming `await` blocks the entire program/thread while waiting — it only pauses the specific `async` function; other synchronous code and other async functions' continuations can still run during that wait.

## Interview Questions & Answers

**Q: What does marking a function `async` actually change about it?**
A: It guarantees the function always returns a Promise — a returned plain value is automatically wrapped via `Promise.resolve()`, and a thrown error automatically becomes a rejected Promise. It also unlocks the ability to use `await` inside that function's body.

**Q: Does `await` block the entire program while waiting for a Promise to settle?**
A: No — it only pauses execution of the specific `async` function containing it. Control returns immediately to the function's caller, which continues running synchronously; the rest of the `async` function resumes later, as a microtask, once the awaited Promise settles.

**Q: If you need to run several independent async operations, why is `await`-ing them one at a time in sequence often a mistake?**
A: Because each `await` fully pauses until that specific operation completes before even *starting* the next one, needlessly serializing work that has no actual dependency between the operations. Starting all the operations first (e.g., by calling the async functions without awaiting immediately, or via `Promise.all([...])`) lets them run concurrently, then awaiting the combined result, is typically much faster.

**Q: How do you handle an error from an `await`ed Promise that rejects?**
A: Wrap the `await` expression in a standard `try...catch` block — a rejected awaited Promise throws its rejection reason as a regular JavaScript exception at that point, catchable exactly like a synchronous `throw`, which is one of `async`/`await`'s biggest ergonomic advantages over manually chaining `.catch()` on every Promise.

## Related Topics
- [promises.md](./promises.md)
- [event-loop.md](./event-loop.md)
- [microtask-queue-or-job-queue.md](./microtask-queue-or-job-queue.md)
- [error-handling.md](./error-handling.md)
- [for-await.md](./for-await.md)
- [generators.md](./generators.md)
