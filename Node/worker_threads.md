# Worker Threads

The `node:worker_threads` module lets you run JavaScript in parallel on real OS threads within the same process. Unlike `cluster` (which forks separate processes), a `Worker` runs on its own thread but stays inside the parent process, with its own V8 isolate and its own event loop, while still being able to share raw memory with the parent through `SharedArrayBuffer`. This makes `worker_threads` the correct tool for CPU-bound work — things like image/video processing, complex data parsing, cryptographic operations, or heavy computation — that would otherwise block Node's single main thread and stall the entire event loop for every other request the process is handling.

Each worker gets its own independent copy of the JS engine and its own `global` object, so you cannot simply share regular JS objects or closures between the main thread and a worker the way you would between functions in the same thread. Communication instead happens via structured cloning: `worker.postMessage(data)` serializes `data` (using the same algorithm as `postMessage` in browsers — it supports most built-in types, but not functions or non-serializable values) and delivers a *copy* to the other side's `'message'` event. For high-throughput scenarios where copying large data on every message would be wasteful, `worker_threads` exposes `MessagePort`/`MessageChannel` for creating additional dedicated communication channels, and `SharedArrayBuffer` combined with `Atomics` for true shared, mutable memory that both threads can read/write without copying (with the same race-condition risks concurrent memory access implies in any language).

A key structural detail: `Worker` accepts either a path to a JS file, or (with `eval: true`) a string of code to execute, and by default inherits `stdin`/`stdout`/`stderr` unless configured with the `stdout`/`stderr` options. You can pass initial data via `workerData` at construction time, which is also structurally cloned. Workers emit `'online'`, `'message'`, `'error'`, and `'exit'` events, and must be explicitly terminated with `worker.terminate()` if you want to reclaim their thread proactively — an unreferenced worker can otherwise keep the process alive.

The rule of thumb for choosing between concurrency primitives: use plain `async`/await and Node's built-in async I/O (fs, network, timers) for I/O-bound work — that's already non-blocking via libuv's thread pool under the hood, and you don't need worker_threads for it. Use `worker_threads` specifically when you have synchronous, CPU-intensive JavaScript computation that would otherwise block the event loop. Use `cluster` (or multiple processes/containers) when you want to scale handling of many concurrent connections across CPU cores. Reaching for worker_threads to parallelize something that's actually I/O-bound (like making several HTTP requests) is a common misuse — `Promise.all` with async I/O is simpler and cheaper.

## Examples

```js
// worker.js — offloading a CPU-bound Fibonacci calculation so it doesn't block the main thread
import { parentPort, workerData } from 'node:worker_threads';

function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

const result = fib(workerData.n);
parentPort.postMessage(result);
```

```js
// main.js — spawning the worker above and getting the result via postMessage
import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function runFibInWorker(n) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'worker.js'), {
      workerData: { n },
    });

    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
}

const result = await runFibInWorker(40);
console.log('fib(40) =', result); // main thread stayed responsive the whole time
```

```js
// Sharing real memory across threads with SharedArrayBuffer + Atomics (no copying, no postMessage)
import { Worker, isMainThread, workerData } from 'node:worker_threads';

if (isMainThread) {
  const sharedBuffer = new SharedArrayBuffer(4); // 4 bytes = one Int32
  const sharedArray = new Int32Array(sharedBuffer);
  Atomics.store(sharedArray, 0, 0);

  const worker = new Worker(new URL(import.meta.url), {
    workerData: { sharedBuffer },
  });

  worker.on('exit', () => {
    console.log('Final counter value:', Atomics.load(sharedArray, 0)); // 1000
  });
} else {
  const sharedArray = new Int32Array(workerData.sharedBuffer);
  for (let i = 0; i < 1000; i++) {
    Atomics.add(sharedArray, 0, 1); // atomic increment, safe across threads
  }
}
```

## Common Pitfalls / Gotchas

- Assuming you can pass functions, closures, or class instances with methods through `postMessage` — structured cloning only supports data (objects, arrays, typed arrays, Maps/Sets, etc.), not functions or most class prototypes.
- Forgetting that each worker has real startup overhead (spinning up a new V8 isolate) — spawning a fresh worker per tiny task is often slower than using a worker pool that reuses long-lived threads (e.g., via `piscina` or a hand-rolled pool).
- Using `worker_threads` for I/O-bound work (HTTP calls, file reads) — those are already handled asynchronously by libuv without blocking the event loop, so adding a worker thread just adds overhead for no benefit.
- Mutating a `SharedArrayBuffer` from multiple threads without `Atomics` — plain reads/writes on shared memory are subject to race conditions; `Atomics` operations (`Atomics.add`, `Atomics.store`, `Atomics.wait`/`Atomics.notify`) are required for safe coordination.
- Leaking workers that are never terminated — a `Worker` that's still referenced (and hasn't had `.unref()` called or been `.terminate()`d) will keep the Node process alive even if its work is done.
- Not listening for the `'error'` event — an uncaught exception inside a worker doesn't crash the main thread, but if you don't handle `'error'`, you'll silently lose visibility into worker failures.
- Confusing `worker_threads` with Web Workers in the browser — the API is intentionally similar but not identical (e.g., `workerData`, `parentPort`, and Node-specific options like `resourceLimits` have no browser equivalent).

## Interview Questions & Answers

**Q: What is `worker_threads` for, and how is it different from `cluster`?**
A: `worker_threads` runs JavaScript on additional real OS threads within the same process, each with its own V8 isolate but able to share memory via `SharedArrayBuffer`. It's designed for offloading CPU-bound computation so it doesn't block the main thread's event loop. `cluster`, by contrast, forks entirely separate OS processes that share a listening port to scale I/O-bound connection handling across CPU cores — cluster workers have no shared memory and communicate only via IPC message passing.

**Q: How do you get data into and out of a worker thread?**
A: On creation, you can pass initial data via the `workerData` option, and communicate afterward with `worker.postMessage()` / the `'message'` event on both sides, accessed via `parentPort` inside the worker. This data is structured-cloned (copied), not shared by reference. For zero-copy shared mutable state, you instead allocate a `SharedArrayBuffer`, pass it through `workerData` or `postMessage`, and read/write it from both threads using `Atomics` for safe synchronized access.

**Q: Why shouldn't you use worker_threads to parallelize a bunch of HTTP requests?**
A: Because Node's I/O is already non-blocking — HTTP requests go through libuv and the event loop without occupying the main thread while waiting for a response, so `Promise.all([...fetches])` already achieves concurrency without needing separate threads. `worker_threads` adds real value only when the work is CPU-bound synchronous JavaScript that would otherwise block the event loop, like hashing, image manipulation, or parsing very large payloads synchronously.

**Q: What is `SharedArrayBuffer` and why does it need `Atomics`?**
A: `SharedArrayBuffer` is a buffer of raw memory that can be shared, by reference, between the main thread and worker threads (or between multiple workers) — unlike a regular `ArrayBuffer`, which gets copied when transferred. Because multiple threads can read and write to the same memory concurrently, ordinary reads/writes are subject to race conditions. `Atomics` provides atomic, thread-safe operations (`add`, `store`, `load`, `wait`, `notify`) to coordinate access and avoid data races or torn reads/writes.

**Q: If a worker throws an uncaught exception, does it crash the main process?**
A: No — an uncaught error inside a worker thread does not automatically crash the main thread. Instead it's surfaced as an `'error'` event on that `Worker` instance in the parent. If you don't attach a listener for `'error'`, you can silently lose track of failures, so production code should always handle it (and typically also decide whether to `terminate()` and restart the worker).

## Related Topics

- [cluster.md](./cluster.md)
- [child-process.md](./child-process.md)
- [event-loop.md](./event-loop.md)
- [buffers.md](./buffers.md)
- [blocking.md](./blocking.md)
- [v8.md](./v8.md)
