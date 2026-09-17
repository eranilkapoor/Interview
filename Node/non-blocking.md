# Non-Blocking

Non-blocking I/O is the core design principle that lets Node.js handle many concurrent connections efficiently despite running JavaScript on a single thread. Instead of a function performing an I/O operation (disk read, network request, DNS lookup) and making the calling thread wait for it to complete, a non-blocking call registers the operation with the underlying system, returns control to the caller immediately, and invokes a callback (or resolves a Promise) later, once the result is ready. The thread is never idle waiting on I/O — it moves on to other work and comes back to handle the result when notified.

Node achieves this through libuv, its cross-platform C library. For network I/O (TCP/UDP sockets), libuv uses the operating system's native async event notification mechanisms — epoll on Linux, kqueue on macOS, IOCP on Windows — so the kernel itself tells Node's event loop when a socket is readable/writable, with no dedicated thread needed to "wait." For filesystem operations, DNS lookups (`dns.lookup`), and some CPU-bound crypto/zlib functions, which don't have good cross-platform async kernel APIs, libuv instead uses an internal thread pool (default size 4, configurable via the `UV_THREADPOOL_SIZE` environment variable) — the actual blocking work happens on one of those pool threads, and the main JS thread is notified via the event loop's poll phase when it's done.

From the application code's perspective, non-blocking APIs are the ones that take a callback (`fs.readFile(path, cb)`), return a Promise (`fsPromises.readFile(path)`, usable with `await`), or emit events (a `net.Socket` emitting `'data'`). The calling code issues the request and continues executing synchronous code immediately after — the actual completion is handled later, off the main call stack, by the event loop dispatching the registered callback once the operation's result is available.

The practical payoff is concurrency without OS threads-per-connection: a single Node process can have thousands of open sockets and pending file operations in flight simultaneously, each cheaply represented as a callback/Promise waiting to be resumed, rather than as a full OS thread with its own stack and scheduling overhead. This is why Node excels at I/O-bound workloads (APIs, proxies, real-time servers) but needs help (worker_threads, clustering, offloading) for CPU-bound workloads, since non-blocking I/O does nothing to parallelize actual computation — it only avoids wasting the thread on waiting.

## Examples

```js
// Non-blocking: fs.readFile lets the event loop keep serving other requests
const fs = require('node:fs');
const http = require('node:http');

const server = http.createServer((req, res) => {
  fs.readFile('./large-file.txt', 'utf8', (err, data) => {
    if (err) {
      res.statusCode = 500;
      return res.end('error reading file');
    }
    res.end(data);
  });
  // execution reaches here immediately; the event loop is free to handle
  // other incoming connections while this file read happens in the background
});
server.listen(3000);
```

```js
// Non-blocking with promises/async-await: still yields control at each await
const fsPromises = require('node:fs/promises');

async function handleRequest(path) {
  console.log('starting read');
  const data = await fsPromises.readFile(path, 'utf8'); // yields here; loop is free
  console.log('read complete, length:', data.length);
  return data;
}

handleRequest('./large-file.txt');
console.log('this logs before "read complete" because readFile is non-blocking');
```

```js
// Demonstrating concurrency: many non-blocking operations in flight at once
const dns = require('node:dns/promises');

async function resolveAll(hosts) {
  // All lookups are issued concurrently; the event loop interleaves them
  // via libuv rather than resolving them one at a time.
  const results = await Promise.all(hosts.map((h) => dns.resolve4(h).catch(() => null)));
  return results;
}

resolveAll(['nodejs.org', 'github.com', 'example.com']).then(console.log);
```

## Common Pitfalls / Gotchas

- Assuming "non-blocking" means "runs in parallel/on another CPU core" — it doesn't; it means the main thread isn't stalled waiting, but the actual JS callback still executes on the same single thread when its turn comes.
- Mixing sync and async file APIs inconsistently in the same codebase, which reintroduces blocking in what looks like an otherwise async pipeline.
- Forgetting that libuv's threadpool (used for fs, dns.lookup, and some crypto/zlib calls) has a small default size (4) — saturating it with many concurrent `fs`/`crypto` calls causes queuing delay even though each individual call is "non-blocking" from the main thread's perspective.
- Unhandled promise rejections in non-blocking async code can crash the process (Node terminates by default on unhandled rejections in recent versions) if not caught.
- Issuing many non-blocking operations without any concurrency limit (e.g., firing off 100,000 `fetch()`/`fs.readFile()` calls at once) can exhaust file descriptors, memory, or the thread pool queue.
- Thinking `dns.lookup()` is non-blocking with respect to the OS the same way `dns.resolve()` is — `dns.lookup()` uses the libuv thread pool and the system resolver (e.g., `getaddrinfo`), while `dns.resolve*()` functions talk to a DNS server directly via non-blocking sockets, bypassing the thread pool.

## Interview Questions & Answers

**Q: What is non-blocking I/O in Node.js and why does it matter for a single-threaded runtime?**
A: Non-blocking I/O means an operation is initiated and the thread continues executing other code immediately, rather than waiting synchronously for the operation to finish; the result is delivered later via a callback, Promise, or event. Because Node runs JS on one thread, this is essential — without it, any I/O operation would stall the entire process from handling other concurrent work.

**Q: How does Node achieve non-blocking behavior under the hood?**
A: Through libuv. For network sockets, it relies on OS-level async event notification (epoll/kqueue/IOCP) so the kernel signals readiness without a dedicated waiting thread. For filesystem operations, DNS lookups via `dns.lookup`, and some crypto/zlib functions that lack good async OS primitives, libuv dispatches the work to an internal thread pool and notifies the main thread's event loop when it completes.

**Q: Does non-blocking I/O make CPU-bound code run faster or in parallel?**
A: No. Non-blocking I/O only avoids wasting the main thread waiting on I/O; it does nothing for computation that keeps the CPU busy. A CPU-bound task still fully occupies whichever thread runs it. To actually parallelize computation you need `worker_threads` or separate processes (`cluster`, `child_process`).

**Q: What's the practical difference between `dns.lookup()` and `dns.resolve4()` in terms of "non-blocking"?**
A: Both are asynchronous from the caller's perspective (both take callbacks/return promises), but `dns.lookup()` uses the OS's resolver via the libuv thread pool (competing with fs and crypto for those 4 threads), whereas `dns.resolve4()` and friends send DNS queries directly over non-blocking sockets, without touching the thread pool.

**Q: Can too many non-blocking operations still cause performance problems?**
A: Yes — if they compete for a shared bounded resource. Filesystem, DNS lookup, and certain crypto operations all funnel through libuv's small thread pool (default 4 threads), so issuing thousands of concurrent `fs.readFile` calls creates a queuing bottleneck even though each call is individually non-blocking to the main thread.

## Related Topics

- [blocking.md](./blocking.md)
- [event-loop.md](./event-loop.md)
- [streams.md](./streams.md)
- [worker_threads.md](./worker_threads.md)
- [file-systems.md](./file-systems.md)
- [process-and-os.md](./process-and-os.md)
