# Asynchronous JavaScript

Asynchronous JavaScript refers to code that doesn't run to completion immediately, top-to-bottom, but instead schedules work to happen later — while the rest of the program continues executing in the meantime — and eventually gets notified when that work finishes. This is essential because JavaScript is single-threaded (see [single-threaded-model.md](./single-threaded-model.md)): if a long-running operation like a network request or a file read were handled synchronously (blocking), the entire program (including UI rendering in a browser) would freeze until it completed.

JavaScript achieves asynchrony not through the language's core execution model (which remains synchronous and single-threaded) but through its **host environment** (the browser or Node.js) and the **event loop**. Operations like `setTimeout`, DOM events, `fetch`, and file I/O are handed off to the environment (Web APIs in the browser, libuv in Node.js), which performs the actual waiting *outside* the main JS thread, and then queues a callback to run back on the main thread once the work is done — coordinated by the event loop (see [event-loop.md](./event-loop.md)).

JavaScript's asynchronous programming model has evolved through three major eras: **callbacks** (the original mechanism — pass a function to be invoked later, prone to "callback hell" when nesting many dependent async steps), **Promises** (ES2015 — a first-class object representing an eventual value, enabling flatter chaining and unified error handling via `.then()`/`.catch()`), and **`async`/`await`** (ES2017 — syntax that lets you write Promise-based code in a linear, synchronous-looking style). All three ultimately rely on the same underlying event-loop mechanism; they differ only in *how the code is structured*, not in fundamentally *how* asynchrony itself works.

## Examples

```js
// The core asynchronous behavior: code AFTER an async call keeps running immediately
console.log('A');
setTimeout(() => console.log('B (async, runs later)'), 0);
console.log('C');
// Output order: A, C, B — even with a 0ms delay, B is deferred until the current call stack clears
```

```js
// The same async operation expressed 3 ways: callback, Promise, async/await
function getDataCallback(cb) {
  setTimeout(() => cb('data (callback)'), 100);
}
getDataCallback(data => console.log(data));

function getDataPromise() {
  return new Promise(resolve => setTimeout(() => resolve('data (promise)'), 100));
}
getDataPromise().then(data => console.log(data));

async function getDataAsync() {
  const data = await getDataPromise();
  console.log(data.replace('promise', 'async/await'));
}
getDataAsync();
```

```js
// Asynchronous work doesn't block other synchronous code from running
function heavySync() {
  const start = Date.now();
  while (Date.now() - start < 50) {} // blocks the thread for 50ms
}
console.log('Start');
setTimeout(() => console.log('Timeout fired'), 10);
heavySync(); // this blocks EVERYTHING, including the timeout callback, until it finishes
console.log('End (after heavySync)');
// The timeout callback only runs after heavySync() finishes AND the stack clears
```

## Common Pitfalls / Gotchas

- Assuming `setTimeout(fn, 0)` runs `fn` immediately — it still waits for the current synchronous code to finish and for the call stack to clear before it can run, and even then it's queued behind any pending microtasks (Promise callbacks).
- Writing a long-running synchronous loop (or expensive computation) and expecting async callbacks to interleave with it — they can't; JavaScript's single thread must finish the current synchronous task before touching the event loop's queues.
- Forgetting that "asynchronous" doesn't mean "parallel" — JavaScript still executes one thing at a time on its single thread; asynchronous work is *concurrent* in the sense of being interleaved via the event loop, not truly parallel (true parallelism requires Web Workers/worker threads, which run on separate threads).
- Mixing callback-based, Promise-based, and `async`/`await`-based code inconsistently in the same codebase, making error handling and control flow harder to reason about than committing to one consistent style (usually `async`/`await` for new code).

## Interview Questions & Answers

**Q: Why does JavaScript need asynchronous programming if it's single-threaded?**
A: Because many operations (network requests, file I/O, timers) take unpredictable amounts of time, and blocking the single thread while waiting would freeze the entire program (including UI rendering in browsers). Asynchronous programming lets the engine hand off waiting to the host environment and continue running other code, resuming the original operation's callback only once the result is ready.

**Q: What are the three major approaches to asynchronous code in JavaScript, in the order they were introduced?**
A: Callbacks (original, prone to "callback hell" for nested dependent operations), Promises (ES2015, flatter chaining and unified error handling), and `async`/`await` (ES2017, syntax sugar over Promises that reads like synchronous code).

**Q: Does asynchronous mean "runs in parallel" in JavaScript?**
A: No. JavaScript's main thread still executes only one thing at a time. Asynchronous operations are handled by the host environment (browser Web APIs, Node's libuv thread pool) outside the main JS thread, and their callbacks are queued to run on the main thread later, one at a time, coordinated by the event loop — this is concurrency via interleaving, not true multi-threaded parallelism.

## Related Topics
- [event-loop.md](./event-loop.md)
- [promises.md](./promises.md)
- [async-await.md](./async-await.md)
- [callbacks.md](./callbacks.md)
- [single-threaded-model.md](./single-threaded-model.md)
- [web-apis.md](./web-apis.md)
