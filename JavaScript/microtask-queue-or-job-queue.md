# Microtask Queue (Job Queue)

The microtask queue (also called the "job queue" in the ECMAScript spec) holds callbacks that need to run **very soon** after the currently executing synchronous code finishes — specifically, Promise reaction handlers (`.then()`, `.catch()`, `.finally()`), `async`/`await` continuations (the code after an `await`), and callbacks explicitly scheduled with `queueMicrotask()`. Microtasks have **higher priority** than macrotasks (the "callback"/"task" queue that holds `setTimeout`, I/O, and UI events) — the event loop always fully drains the entire microtask queue before it's allowed to process even a single macrotask.

Crucially, "fully drains" means *including* any new microtasks that get queued while the queue is already being processed — if a microtask callback itself schedules another microtask, that new one is also processed before the event loop moves on to macrotasks. This is different from the macrotask queue, where only one task is taken per loop iteration before returning to check microtasks/rendering again. This distinction is exactly why chained `.then()` calls all resolve "immediately" relative to a competing `setTimeout`, even a `setTimeout(fn, 0)`.

This priority ordering exists because Promises are meant to represent values that are conceptually "already available or imminently available," and their reactions should be processed as soon as possible once the current synchronous work finishes — before yielding control back to lower-priority scheduled work like timers or rendering.

## Examples

```js
// Multiple .then() calls all run before a setTimeout(0), regardless of code order
setTimeout(() => console.log('macrotask'), 0);
Promise.resolve().then(() => console.log('microtask 1'));
Promise.resolve().then(() => console.log('microtask 2'));
Promise.resolve().then(() => console.log('microtask 3'));
// Output: microtask 1, microtask 2, microtask 3, macrotask
```

```js
// Microtasks queued from within another microtask still preempt the next macrotask
setTimeout(() => console.log('macrotask'), 0);
Promise.resolve().then(() => {
  console.log('microtask A');
  Promise.resolve().then(() => console.log('microtask B (queued inside A)'));
});
// Output: microtask A, microtask B, macrotask — the queue keeps draining until truly empty
```

```js
// queueMicrotask() lets you schedule a microtask directly, without a Promise
console.log('sync 1');
queueMicrotask(() => console.log('microtask via queueMicrotask'));
console.log('sync 2');
// Output: sync 1, sync 2, microtask via queueMicrotask
```

## Common Pitfalls / Gotchas

- Assuming all asynchronous callbacks share one single queue with FIFO ordering across types — Promise-based (microtask) callbacks always jump ahead of `setTimeout`-based (macrotask) callbacks, regardless of code order or timer delay.
- Creating an infinite or very long chain of self-scheduling microtasks — since the queue must fully drain (including newly added microtasks) before any macrotask runs, this can starve `setTimeout` callbacks, UI events, and rendering from ever getting a turn.
- Forgetting `async` function continuations after `await` are themselves microtasks — this is why interleaving `console.log` statements across multiple concurrently-running `async` functions can produce non-obvious orderings that require tracing the microtask queue carefully.
- Confusing "microtask" with "immediate execution" — a microtask is still deferred until the current synchronous code finishes; it just has priority over macrotasks once that happens, not before.

## Interview Questions & Answers

**Q: What goes into the microtask queue, and how does its priority compare to the macrotask queue?**
A: Promise reaction callbacks (`.then`/`.catch`/`.finally`), `async`/`await` continuations, and `queueMicrotask()` callbacks. The microtask queue is fully drained — including any microtasks added during that draining — before the event loop is allowed to process even one task from the macrotask queue.

**Q: If a microtask schedules another microtask while it's running, does that new microtask run before or after the next macrotask?**
A: Before. The event loop keeps processing the microtask queue until it's completely empty, including microtasks added while already draining it — only once truly empty does the loop proceed to the macrotask queue.

**Q: Why does Promise-based/microtask code get priority over `setTimeout`-based/macrotask code?**
A: Promises represent values intended to become available "as soon as possible," so their reactions are designed to run at the earliest safe opportunity — immediately after the current synchronous execution finishes — rather than being deferred behind lower-priority scheduled work like timers, I/O callbacks, or rendering, which are handled as macrotasks.

## Related Topics
- [event-loop.md](./event-loop.md)
- [task-queue-callback-queue.md](./task-queue-callback-queue.md)
- [promises.md](./promises.md)
- [async-await.md](./async-await.md)
