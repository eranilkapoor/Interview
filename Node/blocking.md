# Blocking

"Blocking" in Node.js refers to any operation that occupies the single JavaScript execution thread synchronously, preventing the event loop from moving on to process other timers, I/O callbacks, or microtasks until that operation finishes. Because Node runs application JS on one thread, a blocking call doesn't just delay the caller — it halts the entire process for every other request, timer, and pending callback currently queued, since none of them can be serviced until control returns to the event loop.

Blocking operations fall into two broad categories. The first is synchronous Node APIs — functions with a `Sync` suffix such as `fs.readFileSync`, `fs.writeFileSync`, `crypto.pbkdf2Sync`, `crypto.scryptSync`, or `zlib.gzipSync` — which perform their work (often via a blocking syscall or CPU-bound computation) and return the result directly instead of taking a callback. The second is pure CPU-bound JavaScript: tight loops, recursive algorithms without yielding, large synchronous `JSON.parse`/`JSON.stringify` calls on multi-megabyte payloads, regular expressions vulnerable to catastrophic backtracking (ReDoS), or synchronous cryptographic key derivation. Neither category involves waiting on the OS asynchronously — the thread is actively busy the whole time, so there's no opportunity for the event loop to interleave other work.

This matters enormously for server code. A single blocking call inside a request handler doesn't just slow down that one request — it stalls every other concurrent connection the process is handling, because Node typically runs one process (per worker) with one event loop. A 500ms synchronous JSON parse in one request handler adds 500ms of latency to every other in-flight request on that process, and can trip health checks, keep-alive timeouts, or load balancer thresholds. This is qualitatively different from a thread-per-request model (like a traditional Java servlet container), where one slow thread doesn't stall unrelated requests.

The fix is not always "use the async version" — for genuinely CPU-bound work (image processing, heavy computation, complex synchronous parsing), even the async-named API variant would still ultimately execute on a thread that can block something (either the main thread or, for fs/crypto/zlib, libuv's limited thread pool). The real solutions are architectural: use `worker_threads` to move CPU-bound work off the main thread, break work into chunks and yield with `setImmediate`, or offload to a separate service/queue entirely for very heavy workloads.

## Examples

```js
// Blocking: fs.readFileSync freezes the event loop for the read's duration
const fs = require('node:fs');
const http = require('node:http');

const server = http.createServer((req, res) => {
  // Every other in-flight request stalls until this synchronous read completes.
  const data = fs.readFileSync('./large-file.txt', 'utf8');
  res.end(data);
});
server.listen(3000);
```

```js
// Blocking: a CPU-heavy synchronous loop has the same effect as a blocking I/O call
function blockFor(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // busy-wait: the thread is 100% occupied, nothing else can run
  }
}

const http = require('node:http');
http.createServer((req, res) => {
  blockFor(2000); // every concurrent request on this process waits 2s minimum
  res.end('done');
}).listen(3001);
```

```js
// Measuring event loop blockage with perf_hooks
const { monitorEventLoopDelay } = require('node:perf_hooks');

const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();

// simulate a blocking operation
const end = Date.now() + 500;
while (Date.now() < end) {}

setTimeout(() => {
  h.disable();
  console.log('max event loop delay (ns):', h.max);
}, 1000);
```

## Common Pitfalls / Gotchas

- Using `fs.readFileSync`/`writeFileSync` in request handlers "because it's simpler" — it silently degrades throughput under concurrent load, often not noticed until production traffic increases.
- `JSON.parse`/`JSON.stringify` on very large objects or request bodies is fully synchronous and CPU-bound; there is no async variant in core Node.
- Catastrophic backtracking in regular expressions (ReDoS) — an innocuous-looking regex against attacker-controlled input can block the thread for seconds or minutes.
- `crypto.pbkdf2Sync`/`scryptSync` used for password hashing on every login request blocks the loop; prefer the async (callback/promise) variants, which run on libuv's thread pool instead of the main thread.
- Array methods on huge arrays (`sort`, `map`, `filter` chains) are synchronous and can add up to meaningful blocking time even though no single call looks alarming.
- Assuming `async`/`await` automatically makes code non-blocking — `await` only yields at actual asynchronous operations; a synchronous function called inside an `async` function still blocks just as much.
- Console logging large objects or using synchronous `console.log` to a non-TTY (piped) stream can itself become a blocking I/O operation under heavy volume.

## Interview Questions & Answers

**Q: What does "blocking" mean specifically in Node.js?**
A: It means the single JavaScript thread is occupied executing code synchronously — either a blocking syscall (like `fs.readFileSync`) or pure CPU-bound computation — such that the event loop cannot process any other timers, I/O completions, or callbacks until that operation returns.

**Q: Why is a blocking call in one request handler a problem for unrelated concurrent requests?**
A: Because Node typically handles many connections on a single event loop thread per process. While that thread is blocked, it cannot service any other socket's data, run any other timer, or process any other pending callback — so the blocking cost is paid by every concurrent client, not just the one whose request triggered it.

**Q: Give an example of code that looks asynchronous but still blocks the event loop.**
A: An `async` function that does `JSON.parse(hugePayload)` or runs a CPU-heavy loop internally. The `async` keyword only affects how the function's return value is wrapped (in a Promise) and lets you `await` other async operations — it does not make the synchronous statements inside the function non-blocking.

**Q: How would you fix a Node service that's blocking on CPU-heavy computation (e.g., image resizing) per request?**
A: Move the CPU-bound work off the main thread using `worker_threads` (in-process threads with message passing / SharedArrayBuffer), or offload to a separate process/service via a job queue, so the main event loop stays free to keep serving I/O-bound requests.

**Q: Is using the synchronous version of an fs/crypto/zlib API ever acceptable?**
A: Yes — at startup/initialization time (e.g., reading a config file once before the server starts listening) or in one-off CLI scripts where there's no concurrent event loop work competing for the thread. The danger is specifically using sync APIs inside hot request-handling paths of a long-running server.

## Related Topics

- [non-blocking.md](./non-blocking.md)
- [event-loop.md](./event-loop.md)
- [worker_threads.md](./worker_threads.md)
- [cluster.md](./cluster.md)
- [file-systems.md](./file-systems.md)
- [child-process.md](./child-process.md)
