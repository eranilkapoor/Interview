# Timers

Node.js exposes four scheduling primitives that all feel similar but resolve to distinct points in the event loop: `setTimeout`, `setInterval`, `setImmediate`, and `process.nextTick`. Understanding exactly where each one fires relative to the event loop's phases is one of the most commonly tested Node topics, because their names suggest a simple ordering ("nextTick sounds first, immediate sounds instant") that doesn't actually match their real scheduling semantics.

`setTimeout(fn, delay)` and `setInterval(fn, delay)` schedule `fn` to run during the **timers** phase, once at least `delay` milliseconds have elapsed since the timer was scheduled (delay is a minimum, not a guarantee — if the loop is busy in another phase, the timer fires as soon as the loop returns to the timers phase afterward). `setInterval` re-schedules itself repeatedly at that interval until cleared with `clearInterval`. `setImmediate(fn)` schedules `fn` to run during the **check** phase, which occurs after the poll phase in every loop iteration — it's designed specifically to run "immediately after I/O" in the current iteration, which is why, inside an I/O callback, `setImmediate` is always guaranteed to fire before any `setTimeout(fn, 0)`.

`process.nextTick(fn)` is fundamentally different — it isn't tied to any event loop phase at all. Its callbacks are placed on a special queue that is fully drained immediately after the currently executing operation finishes, before the event loop is allowed to proceed to the next phase or even the next callback within poll. This makes `process.nextTick` callbacks run before Promise microtask callbacks, which are also drained between operations but as a separate, second queue. Both queues are fully drained (including anything they schedule recursively) before the loop moves on — this ordering (`nextTick` queue, then Promise microtask queue, then next phase) is a frequent interview trip-up point.

Timers returned by `setTimeout`/`setInterval` are `Timeout` objects with `.ref()` and `.unref()` methods. By default, an active timer keeps the Node process alive (referenced) — the process won't exit while a pending timer exists. Calling `.unref()` removes that timer from the count of things keeping the event loop alive, so if it's the only remaining work, the process can exit even though the timer hasn't fired yet; `.ref()` restores the default behavior. This is commonly used for background "heartbeat" timers that shouldn't prevent a script or CLI tool from exiting naturally.

## Examples

```js
// Ordering: nextTick and Promise microtasks always run before timer/immediate phases
console.log('1: sync');

setTimeout(() => console.log('5: setTimeout'), 0);
setImmediate(() => console.log('6: setImmediate'));
process.nextTick(() => console.log('3: nextTick'));
Promise.resolve().then(() => console.log('4: promise'));

console.log('2: sync');
// Order: 1, 2, 3 (nextTick), 4 (promise), then 5/6 in a nondeterministic
// relative order at the top level (both are scheduled for later phases).
```

```js
// unref() lets a background timer NOT keep the process alive
const handle = setInterval(() => {
  console.log('heartbeat');
}, 1000);

handle.unref(); // process can exit even though this interval is still pending

// Without unref(), this script would run forever; with it, Node exits
// as soon as there's no other referenced work left.
setTimeout(() => {
  console.log('doing the real work, then exiting naturally');
}, 3500).unref();
```

```js
// clearTimeout / clearInterval to cancel pending timers, and a debounce pattern
function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId); // cancel any pending invocation
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

const logResize = debounce((size) => console.log('resized to', size), 200);
logResize(100);
logResize(200); // cancels the previous pending call
logResize(300); // only this one actually fires, after 200ms of silence
```

## Common Pitfalls / Gotchas

- `setTimeout(fn, 0)` does not run "immediately" — it still waits for the current synchronous code, the full nextTick/microtask drain, and for the event loop to reach the timers phase; minimum delay is also clamped to 1ms in modern Node.
- The relative order of `setTimeout(fn, 0)` vs `setImmediate(fn)` at the top level of a script is not guaranteed — it depends on process startup overhead — but inside an I/O callback, `setImmediate` is always guaranteed to run first.
- Recursive `process.nextTick()` calls can starve the event loop indefinitely, since the queue must fully drain before any phase (including I/O) can proceed — this is a real (if rare) production bug class.
- `setInterval` drift: if the callback itself takes longer than the interval, or the loop is busy, intervals don't "queue up" — the next one fires as soon as possible after the previous completes, not necessarily every exact `delay` ms.
- Forgetting to `clearTimeout`/`clearInterval` on cleanup (e.g., in a class's shutdown method) leaks timers and can keep a process alive indefinitely if not unreffed.
- Confusing `.unref()` (allows process exit while the timer is pending) with cancellation — an unreffed timer still fires normally if the process stays alive for other reasons.
- Using `process.nextTick` for "run this after I/O completes" — it actually runs before I/O and before the next phase, not after; `setImmediate` is usually the correct choice for "run right after this I/O callback."

## Interview Questions & Answers

**Q: What's the difference between `setImmediate` and `setTimeout(fn, 0)`?**
A: `setImmediate` schedules the callback for the check phase, which runs right after the poll (I/O) phase in the same loop iteration. `setTimeout(fn, 0)` schedules it for the timers phase of a future iteration. Inside an I/O callback, `setImmediate` is guaranteed to fire before a `setTimeout(fn, 0)` scheduled at the same point, because check comes right after poll; at the top level of a script, their relative order is not guaranteed.

**Q: Where does `process.nextTick()` fit into the event loop phases?**
A: It doesn't belong to any phase. Its queue is drained immediately after the current operation completes — before the loop advances to the next phase, and even before the next callback in the same phase. It runs before Promise microtask callbacks as well, since Node checks the nextTick queue first on every drain point.

**Q: Why can excessive `process.nextTick()` usage be dangerous?**
A: Because the nextTick queue must be fully emptied before the event loop can proceed to any other phase, including I/O. If code recursively schedules more nextTick callbacks from within a nextTick callback, the loop can be starved indefinitely — timers never fire, I/O callbacks never run, and the process appears frozen despite being "busy."

**Q: What does `timer.unref()` do, and when would you use it?**
A: It removes the timer from the set of handles that keep the Node process alive, so if it's the last thing pending, the process can exit on its own even though the timer hasn't fired. It's useful for background/housekeeping timers (like periodic cache cleanup or a heartbeat) that shouldn't prevent a CLI tool or short-lived script from terminating naturally.

**Q: If you call `setInterval(fn, 1000)` and `fn` takes 1500ms to run, what happens?**
A: The interval doesn't "queue up" extra invocations for the time it was blocked. Once `fn` finishes, Node schedules the next invocation for the next available timers-phase pass at or after the interval has elapsed since scheduling — effectively, intervals can drift later under load but won't fire back-to-back to "catch up" missed ticks.

## Related Topics

- [event-loop.md](./event-loop.md)
- [blocking.md](./blocking.md)
- [non-blocking.md](./non-blocking.md)
- [process-and-os.md](./process-and-os.md)
- [worker_threads.md](./worker_threads.md)
