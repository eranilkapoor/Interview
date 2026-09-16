# Threads

A thread is an independent sequence of execution that an operating system can schedule to run on a CPU core. Multi-threaded programs can run several threads simultaneously (true parallelism, given enough CPU cores) or interleaved (concurrency, on fewer cores than threads), sharing the same process memory space. JavaScript's core execution model, by contrast, is single-threaded — one call stack, one thing running at a time, per JS "realm" (see [single-threaded-model.md](./single-threaded-model.md)) — a deliberate design choice that avoids the notorious complexity of shared-memory multithreading (race conditions, deadlocks, the need for locks/mutexes) for the vast majority of application code.

That said, both major JavaScript environments provide ways to use *actual* separate threads when genuinely needed: in the browser, **Web Workers** run JavaScript on a separate thread with its own isolated global scope, communicating with the main thread only via message passing (structured cloning), never shared mutable memory (see [web-worker.md](./web-worker.md)). In Node.js, the **`worker_threads`** module provides an analogous capability for server-side code — spinning up additional threads within the same process for CPU-bound work, again communicating primarily via message passing (though Node's worker threads *can* optionally share memory through `SharedArrayBuffer` for specific advanced use cases).

It's worth noting that even "single-threaded" JavaScript engines rely on multiple threads *internally*, invisible to your code: browsers use separate threads for rendering, networking, and other Web API implementations; Node.js's libuv library uses an internal thread pool for certain filesystem and DNS operations. The "single-threaded" description specifically refers to the one thread that runs your actual JavaScript call stack — the surrounding infrastructure is often multi-threaded under the hood, precisely so it can hand results back to that one JS thread asynchronously without blocking it.

## Examples

```js
// JavaScript's own execution: strictly one thread, one thing at a time
function blockingWork() {
  const start = Date.now();
  while (Date.now() - start < 500) {} // nothing else can run on THIS thread during this
}
console.log('Before');
blockingWork();
console.log('After'); // only logs once blockingWork() fully finishes — no interleaving possible
```

```js
// Node.js worker_threads: genuine separate threads within one process
// main.js
// const { Worker } = require('worker_threads');
// const worker = new Worker('./heavy-task.js');
// worker.on('message', (result) => console.log('From worker thread:', result));
// worker.postMessage(1_000_000);
```

```js
// SharedArrayBuffer: the narrow exception allowing true shared memory between threads
// const sab = new SharedArrayBuffer(4);
// const view = new Int32Array(sab);
// Passing `sab` to a worker gives it access to the SAME underlying memory,
// unlike the default structured-clone (copy) behavior of postMessage for plain objects.
```

## Common Pitfalls / Gotchas

- Assuming JavaScript is single-threaded "all the way down," including the browser/Node internals — the JS *call stack* is single-threaded, but the surrounding engine/runtime often uses multiple internal threads (rendering, I/O thread pools) that you never directly interact with.
- Believing Web Workers or Node's `worker_threads` share memory by default — they communicate via message passing with structured cloning (a deep copy) unless you explicitly opt into `SharedArrayBuffer`-based shared memory, a narrow, advanced feature.
- Reaching for actual threads (Web Workers/worker_threads) for I/O-bound work that's already handled efficiently by the single-threaded, non-blocking event loop — threads are for CPU-bound work; I/O-bound work rarely benefits from (and adds unnecessary complexity via) a separate thread.
- Forgetting that spinning up a new thread has real overhead (memory, startup cost) — using threads for trivial, fast tasks is usually a net performance loss compared to just running them on the main thread.

## Interview Questions & Answers

**Q: Is JavaScript truly single-threaded in every sense, including the browser/Node.js runtime as a whole?**
A: The JavaScript call stack itself is single-threaded — your code runs one thing at a time. But the surrounding host environment (browser or Node) often uses multiple internal threads for things like rendering, networking, and certain file/DNS operations, specifically so those operations don't block the single JS thread; you just never interact with those internal threads directly from your JS code.

**Q: How would you achieve true parallel execution of CPU-intensive JavaScript code?**
A: By explicitly using Web Workers in the browser, or the `worker_threads` module in Node.js, both of which run JavaScript on genuinely separate OS threads, communicating with the main thread via message passing (structured cloning) by default.

**Q: Why does JavaScript avoid traditional shared-memory multithreading in its core design?**
A: Shared-memory multithreading introduces significant complexity and bug classes — race conditions, deadlocks, the need for explicit locking/synchronization — that are notoriously hard to get right. JavaScript's single-threaded-plus-event-loop model sidesteps all of that for ordinary code, and when true parallelism is genuinely needed, it's opted into explicitly (Web Workers/worker_threads) with a message-passing model that avoids most of that same complexity by default.

## Related Topics
- [single-threaded-model.md](./single-threaded-model.md)
- [web-worker.md](./web-worker.md)
- [event-loop.md](./event-loop.md)
- [nodejs-runtime.md](./nodejs-runtime.md)
