# Single-Threaded Model

JavaScript executes on a **single thread** — meaning it can only do one thing (run one line of code) at a time, on one call stack, with no built-in shared-memory parallelism (like Java's `Thread` or Python's `threading`) at the language level. This design choice, made early in JavaScript's history, greatly simplifies the programming model: there's no need to worry about race conditions, locks, or thread synchronization for the vast majority of everyday JavaScript code, because only one piece of your code can ever be running at any given instant.

The classic illustration of the single-threaded model's consequences is a blocking call like `alert()` in a browser: it halts *everything* — rendering, event handling, all other JavaScript — until the user dismisses the dialog, because there's no second thread available to keep the page responsive while the main thread waits. Any long-running synchronous computation (a heavy loop, a large JSON parse) has the same blocking effect, which is why performance-sensitive work is often broken into smaller chunks, deferred, or moved off the main thread entirely.

Single-threaded does not mean JavaScript can't achieve concurrency or true parallelism — it just doesn't do so on the language's one main thread by default. Concurrency (interleaving many logically simultaneous operations) is achieved via the event loop and asynchronous callbacks (see [event-loop.md](./event-loop.md)); true parallelism (running code on multiple actual CPU cores simultaneously) requires explicitly spinning up separate threads via Web Workers in the browser or worker threads/child processes in Node.js (see [web-worker.md](./web-worker.md), [threads.md](./threads.md)) — each of which runs its own independent single-threaded JavaScript engine instance, communicating with the main thread via message passing rather than shared memory.

## Examples

```js
// A blocking call freezes everything on the single thread until dismissed
console.log('Before alert');
// alert('This blocks the entire page until you click OK'); // (browser only)
console.log('After alert'); // doesn't run until the alert is dismissed
```

```js
// A heavy synchronous loop blocks the thread — nothing else can run meanwhile
function blockFor(ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {} // busy-wait; blocks the single thread
}
console.log('Start');
setTimeout(() => console.log('This is delayed by the blocking call below, not just its own timer'), 0);
blockFor(1000); // blocks for 1 second — the setTimeout callback can't run during this
console.log('End');
```

```js
// True parallelism requires an actual separate thread (Web Worker), not just async code
// main.js
// const worker = new Worker('worker.js');
// worker.postMessage(40);
// worker.onmessage = (e) => console.log('Result from worker thread:', e.data);

// worker.js (runs on its own separate thread, doesn't block main.js)
// onmessage = (e) => {
//   const result = fib(e.data); // expensive computation, done off the main thread
//   postMessage(result);
// };
```

## Common Pitfalls / Gotchas

- Writing an expensive synchronous computation directly in the main thread's code path (e.g., inside a UI event handler) and being surprised the page freezes — the single thread has no way to "pause" that computation to handle other events until it finishes.
- Confusing "asynchronous" with "multi-threaded" — asynchronous callbacks in JS still all run on the same single thread, one at a time; they just get interleaved via the event loop rather than executing on separate threads simultaneously.
- Assuming Web Workers share memory/variables directly with the main thread — they run in a completely separate global scope and communicate only via message passing (`postMessage`/`onmessage`), not shared mutable state (with the narrow exception of `SharedArrayBuffer` for specific use cases).
- Forgetting that Node.js's single JS thread can still be blocked by CPU-heavy synchronous code, even though Node's I/O itself is non-blocking — CPU-bound work still needs to be offloaded (worker threads, child processes, or chunking) to avoid freezing the whole server process.

## Interview Questions & Answers

**Q: What does it mean for JavaScript to be single-threaded, and what problem does this create for long-running operations?**
A: JavaScript executes only one line of code at a time on one thread/call stack. Long-running synchronous operations (heavy computation, blocking I/O) monopolize that single thread, freezing everything else — UI updates, event handling, other code — until they finish, since there's no second thread available to keep things responsive concurrently.

**Q: How does JavaScript achieve concurrency despite being single-threaded?**
A: Via the event loop and asynchronous APIs: time-consuming operations (network requests, timers, file I/O) are handed off to the host environment (browser Web APIs, Node's libuv), which performs the actual waiting outside the main JS thread, then queues a callback to run on the main thread once the operation completes — letting the main thread stay free to handle other work in the meantime.

**Q: How would you achieve true parallelism in JavaScript, given it's single-threaded by default?**
A: By explicitly spinning up separate threads — Web Workers in the browser, or worker threads/child processes in Node.js — each running its own independent JavaScript engine instance on a separate OS thread, communicating with the main thread via message passing rather than shared memory, since JavaScript's single-threaded execution model doesn't extend across these separate contexts.

## Related Topics
- [event-loop.md](./event-loop.md)
- [asynchronus-javascript.md](./asynchronus-javascript.md)
- [web-worker.md](./web-worker.md)
- [threads.md](./threads.md)
- [call-stack-and-memory-heap.md](./call-stack-and-memory-heap.md)
