# Event Loop

The event loop is the mechanism that lets JavaScript — despite being single-threaded — handle asynchronous operations without blocking. It's a continuously running process that checks whether the **call stack** is empty, and if so, pulls the next queued task from a task queue and pushes it onto the call stack to run. This is the process that gives the illusion of concurrency: as long as callbacks are handed off to queues instead of running immediately/synchronously, the main thread stays free to keep executing other code, and the event loop takes care of running each queued callback exactly when it's safe to do so (i.e., when the stack is clear).

Modern JavaScript has (at least) two distinct queues with different priorities: the **microtask queue** (also called the job queue — holds Promise `.then`/`.catch`/`.finally` callbacks, `queueMicrotask()` callbacks, and `async` function continuations after `await`) and the **macrotask (or "callback"/"task") queue** (holds `setTimeout`/`setInterval` callbacks, DOM events, I/O callbacks). Critically, **the entire microtask queue is fully drained before the event loop picks even a single macrotask** — and this also happens after every individual macrotask completes, before the loop moves to render or grab the next macrotask. This ordering rule is the exact reason `Promise.resolve().then(...)` always logs before a `setTimeout(..., 0)` callback, no matter which one appears first in the code.

The full loop, roughly: (1) run the currently executing script/task until the call stack is empty; (2) drain the entire microtask queue (running any newly-queued microtasks too, until none remain); (3) (in browsers) potentially perform a rendering update; (4) pull one task from the macrotask queue and run it; (5) go back to step 2. Understanding this ordering precisely — and being able to trace through a snippet mixing `console.log`, `setTimeout`, and Promises to predict the exact output order — is one of the most common and highest-value JavaScript interview exercises.

## Examples

```js
// The classic ordering puzzle: sync > microtasks > macrotasks
console.log('1: sync');
setTimeout(() => console.log('2: macrotask (setTimeout)'), 0);
Promise.resolve().then(() => console.log('3: microtask (promise)'));
console.log('4: sync');
// Output order: 1, 4, 3, 2
// Sync code runs first (1, 4), then the ENTIRE microtask queue drains (3),
// and only then does the event loop pick up the queued macrotask (2).
```

```js
// Microtasks queued DURING microtask processing still run before any macrotask
setTimeout(() => console.log('macrotask'), 0);
Promise.resolve().then(() => {
  console.log('microtask 1');
  Promise.resolve().then(() => console.log('microtask 2 (queued during microtask 1)'));
});
// Output: microtask 1, microtask 2, macrotask
// The microtask queue is drained COMPLETELY — including newly added microtasks — before the macrotask runs
```

```js
// async/await and the event loop: execution pauses at `await`, resuming as a microtask
async function demo() {
  console.log('A: start of async function (sync)');
  await null; // pauses here; the rest of the function becomes a microtask continuation
  console.log('C: after await (microtask)');
}
console.log('start');
demo();
console.log('B: after calling demo() (sync)');
// Output: start, A, B, C
// Everything before the first `await` runs synchronously; the rest resumes as a microtask
```

## Common Pitfalls / Gotchas

- Assuming `setTimeout(fn, 0)` runs immediately or before Promise callbacks — it doesn't; it's a macrotask and always waits for the entire microtask queue to drain first, regardless of the (nominal) delay.
- Forgetting that microtasks queued *while processing* the microtask queue still run before the next macrotask — an endless chain of `.then()` calls queuing more `.then()` calls can, in extreme cases, starve macrotasks (including rendering) from ever running.
- Believing `async`/`await` makes code run on a separate thread — it doesn't; `await` merely pauses the async function's execution and schedules its continuation as a microtask, all still on the single main thread.
- Not accounting for browser rendering happening between macrotasks (roughly) — heavy microtask chains can, in principle, delay a paint update, since the browser typically renders between macrotasks, not necessarily between every microtask.

## Interview Questions & Answers

**Q: Explain the event loop and why `Promise.resolve().then(fn)` always runs before `setTimeout(fn, 0)`.**
A: The event loop runs the current synchronous code to completion, then fully drains the microtask queue (Promise callbacks), and only after that's empty does it pull the next task from the macrotask queue (`setTimeout` callbacks). Since `.then()` callbacks are microtasks and `setTimeout` callbacks are macrotasks, the microtask always gets processed first, regardless of the nominal `setTimeout` delay (even `0`).

**Q: What's the difference between the microtask queue and the macrotask (callback) queue?**
A: The microtask queue holds Promise continuations (`.then`/`.catch`/`.finally`), `queueMicrotask()` callbacks, and `async`/`await` continuations — it is fully drained (including microtasks added during its own processing) before the event loop touches the macrotask queue. The macrotask queue holds `setTimeout`/`setInterval` callbacks, I/O callbacks, and UI events — only one macrotask is processed per full loop iteration, followed by another full microtask drain.

**Q: How does `await` interact with the event loop?**
A: When an `async` function hits an `await`, it pauses execution at that point and returns control to the caller immediately (the rest of the calling code continues synchronously). Once the awaited Promise settles, the remainder of the async function is scheduled to resume as a microtask — so everything after an `await` effectively runs later, asynchronously, even though it reads like ordinary sequential code.

**Q: Can an endless stream of microtasks prevent macrotasks (like `setTimeout` or UI events) from ever running?**
A: Yes, in principle — since the microtask queue must be fully drained (including any new microtasks added during that draining) before the loop advances to the next macrotask, a chain of `.then()` handlers that keeps scheduling more `.then()` handlers indefinitely can "starve" macrotasks and rendering from ever getting a turn.

## Related Topics
- [microtask-queue-or-job-queue.md](./microtask-queue-or-job-queue.md)
- [task-queue-callback-queue.md](./task-queue-callback-queue.md)
- [promises.md](./promises.md)
- [async-await.md](./async-await.md)
- [single-threaded-model.md](./single-threaded-model.md)
- [call-stack-and-memory-heap.md](./call-stack-and-memory-heap.md)
