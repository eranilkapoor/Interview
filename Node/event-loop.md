# Event Loop

Node.js runs JavaScript on a single thread, but it achieves concurrency for I/O through the event loop, a mechanism implemented by libuv (the C library Node is built on). The event loop is not a single queue — it's a loop that cycles through a fixed sequence of phases, each with its own FIFO queue of callbacks. On every iteration ("tick" of the loop), Node processes all callbacks ready in the current phase, then moves to the next phase, and so on, looping indefinitely until there's no more work and no active handles keeping the process alive.

The phases, in order, are: **timers** (runs callbacks scheduled by `setTimeout`/`setInterval` whose threshold has elapsed), **pending callbacks** (executes I/O callbacks deferred to the next loop iteration, e.g. certain TCP errors), **idle/prepare** (internal use only), **poll** (retrieves new I/O events, executes I/O-related callbacks such as `fs.readFile` completions; this phase can block here waiting for new events if nothing else is scheduled), **check** (runs `setImmediate` callbacks, which are specifically designed to run right after the poll phase), and **close callbacks** (e.g. `socket.on('close', ...)`). After close callbacks, the loop checks whether any timers, immediates, or pending I/O remain; if not, and there's nothing else keeping the event loop "alive" (no active handles/requests), the process exits.

Between every single callback — not just between phases — Node drains two additional queues: the `process.nextTick()` queue and the Promise microtask queue. These are not phases of the event loop itself; they are checked after each callback completes, anywhere in the loop. `process.nextTick()` callbacks run before Promise microtasks, and both fully drain (including any nextTick/microtasks queued by earlier ones in the same drain) before the loop proceeds to the next phase or callback. This is why `process.nextTick` can, if used recursively, starve the event loop entirely — I/O never gets a chance to run.

CPU-bound and blocking synchronous work (like `fs.readFileSync`, a tight computational loop, or `JSON.parse` on huge payloads) runs directly on this single thread and blocks the entire event loop — no other timers, I/O callbacks, or microtasks can run until it finishes. This is fundamentally different from the browser's event loop: browsers don't have the same explicit phase structure (timers, poll, check, etc.) or a libuv thread pool backing filesystem/DNS/crypto operations — Node's poll phase and its thread pool (default size 4, configurable via `UV_THREADPOOL_SIZE`) are what let ostensibly "async" filesystem and crypto APIs run off the main thread without needing OS-level async I/O support for every syscall type.

## Examples

```js
// Demonstrates ordering: sync code, then nextTick/microtasks, then macrotask phases
console.log('start');

setTimeout(() => console.log('timeout (timers phase)'), 0);
setImmediate(() => console.log('immediate (check phase)'));

process.nextTick(() => console.log('nextTick'));
Promise.resolve().then(() => console.log('promise microtask'));

console.log('end');

// Output order:
// start
// end
// nextTick
// promise microtask
// timeout (timers phase)   <- or immediate first, order of these two is nondeterministic at top level
// immediate (check phase)
```

```js
// setTimeout vs setImmediate inside an I/O callback: deterministic order
const fs = require('node:fs');

fs.readFile(__filename, () => {
  // We are now inside the poll phase's callback.
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
  // Inside an I/O callback, check always runs before timers on the next
  // iteration, so 'immediate' is guaranteed to log before 'timeout'.
});
```

```js
// A recursive process.nextTick call starves the event loop -- I/O never runs
const fs = require('node:fs');

fs.readFile(__filename, () => console.log('this file read callback is delayed'));

let count = 0;
function starve() {
  if (count++ < 5) {
    process.nextTick(starve); // keeps draining the nextTick queue before any phase advances
  } else {
    console.log('nextTick queue finally drained, I/O can now proceed');
  }
}
starve();
```

## Common Pitfalls / Gotchas

- Assuming `setTimeout(fn, 0)` and `setImmediate(fn)` have a fixed relative order — at the top level (outside any I/O callback) their order is not guaranteed and depends on process startup timing; only inside an I/O callback is `setImmediate` guaranteed to fire first.
- Recursive `process.nextTick()` calls can starve the event loop entirely, since the nextTick queue must fully drain before the loop can proceed to any phase, including I/O.
- Blocking the thread with synchronous APIs (`fs.readFileSync`, `crypto.pbkdf2Sync`, large `JSON.parse`/`JSON.stringify`, tight loops) freezes the entire loop — no timers, I/O, or microtasks run until it returns.
- Forgetting that `poll` phase can block waiting for I/O if there are no timers or immediates scheduled — this is normal and expected, not a bug.
- Confusing the "event loop" with a queue — it's a sequence of distinct phases each with its own callback queue, not one global FIFO.
- Assuming the browser and Node event loops behave identically — Node has explicit phases (timers, poll, check, etc.) and a libuv thread pool for filesystem/DNS/some crypto; browsers rely on the rendering pipeline and different underlying primitives.
- Not accounting for `process.nextTick` running before Promise microtasks — code that assumes strict Promise-then ordering can be surprised when nextTick callbacks jump the queue.

## Interview Questions & Answers

**Q: List the phases of the Node.js event loop in order.**
A: timers → pending callbacks → idle/prepare (internal) → poll → check → close callbacks. Microtasks (`process.nextTick` then Promise callbacks) are drained after every individual callback, not just between phases.

**Q: What's the difference between `process.nextTick()` and `Promise.prototype.then()` in terms of scheduling?**
A: Both are microtasks that run before the event loop proceeds to its next phase, but Node maintains them as separate queues, and the `nextTick` queue is always fully drained first, before the Promise microtask queue is processed — on every single drain point, not just once per loop iteration.

**Q: Why can `fs.readFileSync` be dangerous in a Node HTTP server handling many concurrent requests?**
A: Because Node is single-threaded for JS execution, a synchronous call blocks that thread completely until it finishes. Every other pending request, timer, and callback has to wait — throughput collapses under load, and it can effectively cause a denial-of-service if the file or workload is large.

**Q: How does Node achieve non-blocking I/O if JavaScript itself runs on one thread?**
A: Node delegates I/O work to the OS's async facilities where available (e.g., epoll/kqueue for sockets) or to libuv's internal thread pool (default 4 threads) for things like filesystem operations and some DNS/crypto calls. The JS thread just registers a callback and continues; libuv notifies the event loop's poll phase when the operation completes, and the callback is scheduled to run on the JS thread at that point.

**Q: What would you check first if a Node server seems to be experiencing event loop lag under load?**
A: Look for synchronous blocking calls in hot paths (sync fs/crypto, big JSON operations, heavy CPU loops, sorting large arrays), check for recursive `process.nextTick` usage, and consider tools like `--prof`, `clinic.js`, or the `perf_hooks` `monitorEventLoopDelay` API to measure actual lag; offload genuinely CPU-bound work to `worker_threads` or a `child_process`.

## Related Topics

- [blocking.md](./blocking.md)
- [non-blocking.md](./non-blocking.md)
- [timers.md](./timers.md)
- [streams.md](./streams.md)
- [worker_threads.md](./worker_threads.md)
- [process-and-os.md](./process-and-os.md)
