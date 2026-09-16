# Node.js Runtime

Node.js is a JavaScript runtime built on Google's V8 engine (the same engine that powers Chrome), designed to run JavaScript **outside** the browser — most commonly on servers, but also for CLI tools, build tooling, and desktop apps (via Electron). Created by Ryan Dahl in 2009, Node's defining architectural choice was pairing V8 with an **event-driven, non-blocking I/O model**: rather than spawning a new thread per incoming request/operation (the traditional multi-threaded server model used by many other server-side platforms), Node handles many concurrent operations on a single main thread, delegating actual I/O work (file access, network requests, DNS lookups) to **libuv**, a C library providing an event loop and an internal thread pool specifically for that offloaded work.

This architecture makes Node particularly well-suited for I/O-heavy workloads (APIs, real-time applications, streaming) where the bottleneck is typically waiting on external resources (databases, network calls) rather than raw CPU computation — the single JS thread stays free to handle many concurrent connections without being blocked by any single slow I/O operation, since that waiting happens off-thread in libuv, with results delivered back via the event loop once ready. It's less naturally suited to CPU-intensive workloads (heavy computation, image processing) run directly on the main thread, since — same as in the browser — that would block the single JS thread; Node addresses this via the `worker_threads` module or by offloading such work to separate processes/services (see [threads.md](./threads.md)).

Node provides its own set of built-in, host-specific modules that replace what a browser's Web APIs would offer: `fs` (filesystem access), `http`/`https` (networking/servers), `path`, `process` (environment/process info), `os`, `crypto`, and others — plus `module.exports`/`require()` (CommonJS, Node's original module system, still widely used alongside native ES Modules — see [commonjs-module.md](./commonjs-module.md)). npm (Node Package Manager), bundled with Node, gave rise to the largest software package registry in the world, a major factor in JavaScript's overall ecosystem dominance.

## Examples

```js
// Node's non-blocking I/O model: a file read doesn't block other code from running
const fs = require('fs');
console.log('Start reading file...');
fs.readFile('./example.txt', 'utf8', (err, data) => {
  console.log('File contents:', data); // runs later, once libuv finishes the read
});
console.log('This logs BEFORE the file contents — readFile did not block execution');
```

```js
// Node-specific globals that don't exist in a browser
console.log(typeof process !== 'undefined'); // true — process info, env vars, etc.
console.log(process.version);                 // e.g., "v20.11.0" — the Node.js version
console.log(typeof __dirname !== 'undefined'); // true (in CommonJS modules) — current directory path
// None of `process` (in this Node sense), `__dirname`, or `require` exist in a browser's runtime
```

```js
// CommonJS module system, native to Node (alongside modern ES Module support)
// math.js
module.exports.add = (a, b) => a + b;

// app.js
const math = require('./math');
console.log(math.add(2, 3)); // 5
```

## Common Pitfalls / Gotchas

- Running CPU-intensive synchronous code directly on Node's main thread (e.g., a heavy computation in a request handler) — this blocks the single JS thread for *every* concurrent connection/operation the server is handling, not just the one that triggered it; offload genuinely CPU-heavy work to `worker_threads` or a separate service.
- Assuming Node's non-blocking I/O model means "everything is automatically fast" — it specifically helps I/O-bound workloads by not blocking on waiting; it doesn't parallelize CPU-bound computation on its own.
- Forgetting Node.js and browser JavaScript share the same underlying engine (V8) but very different sets of host APIs — code relying on `document`/`window` will fail in Node, and code relying on `fs`/`process` will fail in a browser.
- Mixing CommonJS (`require`) and ES Module (`import`) syntax carelessly in the same project without understanding Node's rules for which system applies to which files (`.mjs`/`.cjs` extensions, or `"type"` field in `package.json`).

## Interview Questions & Answers

**Q: What makes Node.js well-suited for I/O-heavy applications specifically?**
A: Its event-driven, non-blocking I/O model, backed by libuv, lets the single main JS thread hand off potentially slow I/O operations (file access, network calls, DNS) to libuv's event loop and internal thread pool, then continue handling other work immediately rather than blocking and waiting — the I/O operation's callback fires later, once the result is ready, coordinated via the event loop. This lets one Node process handle many concurrent connections efficiently without needing a dedicated OS thread per connection.

**Q: Why is Node.js less naturally suited to CPU-intensive workloads on its main thread?**
A: Node's non-blocking model specifically addresses I/O *waiting*, not raw computation — a CPU-heavy synchronous task (e.g., a large in-memory computation) still fully occupies the single JS thread exactly as it would in a browser, blocking all other concurrent work (other requests, timers, I/O callbacks) until it finishes. Genuinely CPU-bound work needs to be offloaded to `worker_threads`, a child process, or an entirely separate service to avoid this.

**Q: What is libuv, and why does Node.js need it?**
A: A C library providing Node's event loop and an internal thread pool for operations that would otherwise block the main JS thread — most filesystem operations, DNS lookups, and some cryptographic functions. It's the layer that actually performs blocking-style work off the main thread, then notifies the JS event loop once the operation completes, letting Node's JavaScript remain single-threaded from the developer's perspective while still achieving efficient concurrent I/O handling underneath.

## Related Topics
- [javascript-runtime.md](./javascript-runtime.md)
- [javascript-engine.md](./javascript-engine.md)
- [event-loop.md](./event-loop.md)
- [commonjs-module.md](./commonjs-module.md)
- [threads.md](./threads.md)
- [web-worker.md](./web-worker.md)
