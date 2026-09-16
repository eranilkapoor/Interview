# Web Workers

A Web Worker is a browser API that lets you run JavaScript code on a genuinely separate background thread, distinct from the page's main (UI) thread. This is JavaScript's primary mechanism for true parallelism in the browser: rather than the event loop merely interleaving asynchronous callbacks on one single thread, a Web Worker executes its script on its own dedicated OS-level thread, capable of running literally simultaneously with the main thread — ideal for CPU-intensive work (image/video processing, complex calculations, parsing large datasets) that would otherwise freeze the page's UI if run on the main thread.

A worker runs in a completely separate global scope with no direct access to the DOM, `window`, or the main thread's variables — it has its own global object (`self`), and can only communicate with the main thread (and vice versa) via **message passing**: `worker.postMessage(data)` sends a message (the data is structurally cloned, not shared by reference, except for specific transferable objects), and the receiving side listens via an `onmessage` event handler (or `addEventListener('message', ...)`). This message-passing model avoids the complexity and danger of shared-memory concurrency (race conditions, locks) that true multi-threading usually introduces in other languages.

There are a few worker variants: a standard (dedicated) Worker is tied to the single page that created it; a `SharedWorker` can be accessed by multiple browsing contexts (tabs/windows) from the same origin; a `ServiceWorker` is a special worker that acts as a programmable network proxy, enabling offline support and push notifications, used heavily for Progressive Web Apps. All share the same fundamental separate-thread, message-passing architecture.

## Examples

```js
// main.js — creating a worker and sending/receiving messages
const worker = new Worker('fib-worker.js');
worker.postMessage(35); // send data to the worker thread
worker.onmessage = (event) => {
  console.log('Result from worker:', event.data); // received back from the worker
};
console.log('Main thread stays responsive while worker computes'); // runs immediately, not blocked
```

```js
// fib-worker.js — runs on its own thread; has NO access to `document`/`window`
self.onmessage = function (event) {
  const n = event.data;
  const result = fib(n); // expensive computation, doesn't block the main thread
  self.postMessage(result);
};
function fib(n) {
  return n <= 1 ? n : fib(n - 1) + fib(n - 2);
}
```

```js
// Data sent via postMessage is structurally cloned, NOT shared by reference
const original = { count: 0 };
// worker.postMessage(original);
// Mutating `original` on the main thread afterward has NO effect on what the
// worker received — it got an independent, deep-cloned copy of the object.
```

## Common Pitfalls / Gotchas

- Assuming a Web Worker can access the DOM (`document`, `window`) — it cannot; workers run in a separate global scope with no DOM access at all, so any UI updates based on worker results must happen back on the main thread after receiving a message.
- Believing `postMessage` shares the object by reference — it performs a structured clone (a deep copy) by default, so mutations on either side after sending are independent, unless you explicitly use `Transferable` objects (like `ArrayBuffer`) to transfer (not copy) ownership.
- Spinning up workers for trivial, fast operations — creating a worker has real overhead (spinning up a new thread, loading a script), so it's only worthwhile for genuinely expensive computations, not lightweight tasks.
- Forgetting to terminate workers (`worker.terminate()`) that are no longer needed — an unused but still-running worker continues consuming resources.

## Interview Questions & Answers

**Q: Why would you use a Web Worker instead of just writing asynchronous JavaScript with Promises/callbacks?**
A: Promises and callbacks provide *concurrency* (interleaving) on a single thread, not true *parallelism* — a CPU-intensive synchronous computation still blocks the main thread regardless of how it's scheduled. A Web Worker actually runs on a separate OS thread, letting genuinely expensive computation proceed without freezing the page's UI, which async/await/callbacks alone cannot achieve.

**Q: How does the main thread communicate with a Web Worker, and why is this designed as message passing instead of shared memory?**
A: Via `postMessage()`/`onmessage`, with data structurally cloned (deep-copied) between the two sides rather than shared directly. This avoids the complexity and bugs (race conditions) that come with true shared-memory multithreading, at the cost of needing to serialize/copy data between threads instead of directly sharing objects.

**Q: Can a Web Worker access the DOM?**
A: No — workers run in a separate global scope (`self`, not `window`) with no access to `document` or the DOM at all. Any changes that need to affect the UI must be sent back to the main thread as a message, which then performs the actual DOM update.

## Related Topics
- [threads.md](./threads.md)
- [single-threaded-model.md](./single-threaded-model.md)
- [web-apis.md](./web-apis.md)
- [event-loop.md](./event-loop.md)
