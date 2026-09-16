# Task Queue (Callback Queue / Macrotask Queue)

The task queue — also called the callback queue or macrotask queue — holds callbacks scheduled by APIs like `setTimeout`, `setInterval`, `setImmediate` (Node.js), DOM events (clicks, keypresses), and I/O completions (file reads, network responses in Node). When the host environment (browser or Node) finishes the underlying operation (a timer elapses, an event fires, a file finishes reading), it doesn't run the associated callback immediately — it places that callback into the task queue, where it waits until the event loop decides it's safe to run it.

The event loop processes the task queue with a specific, disciplined rhythm: it takes exactly **one** task off the queue per iteration, runs it to completion, then fully drains the entire microtask queue (Promise callbacks, `async`/`await` continuations — see [microtask-queue-or-job-queue.md](./microtask-queue-or-job-queue.md)) before looping back to consider the next macrotask. This "one macrotask, then all microtasks" rhythm is different from the microtask queue's "keep draining until truly empty, even microtasks added mid-drain" behavior, and is exactly why macrotasks are lower priority overall — a burst of Promise-based work will always be fully processed before the *next* timer/event callback gets its turn, even if that timer's delay has already elapsed.

A subtlety worth knowing: `setTimeout(fn, delay)` guarantees the callback won't run *before* `delay` milliseconds have passed, but it does **not** guarantee it runs *exactly* at that time — if the call stack is busy (a long synchronous task, or a long microtask chain), the macrotask has to wait until the stack clears and it's actually its turn in the queue, so the effective delay can be much longer than requested.

## Examples

```js
// Only one macrotask runs per event loop iteration, with a full microtask drain in between
setTimeout(() => console.log('macrotask 1'), 0);
setTimeout(() => console.log('macrotask 2'), 0);
Promise.resolve().then(() => console.log('microtask'));
// Output: microtask, macrotask 1, macrotask 2
// (microtask drains fully before EITHER macrotask; macrotasks then run one per iteration)
```

```js
// setTimeout's delay is a MINIMUM, not a guarantee — a busy stack delays it further
const start = Date.now();
setTimeout(() => {
  console.log(`Actually ran after ${Date.now() - start}ms (requested 0ms)`);
}, 0);
// Simulate a busy call stack:
const blockUntil = Date.now() + 200;
while (Date.now() < blockUntil) {} // blocks for 200ms
console.log('Blocking work done');
// The setTimeout callback can't run until AFTER this synchronous block finishes
```

```js
// Each macrotask gets its own full microtask drain afterward, before the next macrotask
setTimeout(() => {
  console.log('macrotask A');
  Promise.resolve().then(() => console.log('microtask queued inside macrotask A'));
}, 0);
setTimeout(() => console.log('macrotask B'), 0);
// Output: macrotask A, microtask queued inside macrotask A, macrotask B
// The microtask from A finishes before B even though B was already queued
```

## Common Pitfalls / Gotchas

- Treating `setTimeout(fn, ms)`'s delay as an exact guarantee — it's only a minimum; the actual run time depends on when the call stack is free and it's the task's turn in the queue, which can be significantly later under load.
- Assuming multiple pending `setTimeout` macrotasks all run back-to-back without interruption — each one gets its own full microtask-queue drain immediately afterward, before the next macrotask starts, so interleaved Promise work can appear "between" macrotasks.
- Forgetting that DOM events and I/O callbacks share the same macrotask queue priority level as `setTimeout` — a burst of pending Promise-based work can delay them all similarly, relative to microtasks.
- Confusing Node.js's `setImmediate`/`process.nextTick` with browser timing semantics — Node has additional queue phases (e.g., `process.nextTick` runs even before microtasks in Node's loop model) that don't map one-to-one onto browser behavior.

## Interview Questions & Answers

**Q: How many tasks does the event loop process from the macrotask queue per iteration, and what happens in between?**
A: Exactly one macrotask per iteration. After running it to completion, the event loop fully drains the microtask queue before looping back to pull (at most) one more macrotask — this "one macrotask, full microtask drain" rhythm repeats indefinitely.

**Q: Does `setTimeout(fn, 0)` guarantee `fn` runs immediately, or even exactly after 0ms?**
A: No to both. `0` (or any delay) is a *minimum* wait time, not a guarantee of exact timing — `fn` is queued as a macrotask and can only run once the call stack is clear and the event loop reaches its turn, which may be considerably delayed if the stack is busy with synchronous code or a long chain of microtasks.

**Q: What kinds of operations schedule callbacks into the macrotask/task queue?**
A: `setTimeout`/`setInterval`, DOM events (clicks, input, etc.), and I/O completion callbacks (file reads, network responses) in Node.js, plus `setImmediate` in Node — anything that represents a "come back to this later, as its own discrete task" operation, as opposed to a Promise continuation (which is a microtask instead).

## Related Topics
- [event-loop.md](./event-loop.md)
- [microtask-queue-or-job-queue.md](./microtask-queue-or-job-queue.md)
- [asynchronus-javascript.md](./asynchronus-javascript.md)
- [web-apis.md](./web-apis.md)
