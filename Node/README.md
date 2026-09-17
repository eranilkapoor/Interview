# Node.js Interview Preparation

This folder is a focused knowledge base for studying and teaching Node.js for interviews — runtime internals, core modules, concurrency models, networking, security, tooling, and the two most common backend frameworks (Express and NestJS). Each file covers one topic in depth: a real conceptual explanation, runnable code examples using actual Node core APIs, common pitfalls, and interview-style Q&A, so you can both refresh your own understanding quickly and walk someone else through the same concept from scratch.

## Table of Contents

### Core Runtime & Event Loop
- [Event Loop](./event-loop.md)
- [Blocking](./blocking.md)
- [Non Blocking](./non-blocking.md)
- [Timers](./timers.md)
- [Globals](./globals.md)
- [V8](./v8.md)
- [VM](./vm.md)

### Modules & Process
- [Process And OS](./process-and-os.md)
- [Package.json](./package-json.md)
- [Releases](./releases.md)
- [Events (EventEmitter)](./events.md)
- [Error Handling](./error-handlings.md)

### Networking
- [HTTP](./http.md)
- [HTTPS](./https.md)
- [TLS/SSL](./tls-ssl.md)
- [URL](./url.md)
- [Dgram (UDP)](./dgram.md)

### Streams, Buffers & Binary Data
- [Streams](./streams.md)
- [Buffers](./buffers.md)
- [Zlib (Compression)](./zlib.md)

### Concurrency: Cluster & Worker Threads
- [Cluster](./cluster.md)
- [Worker Threads](./worker_threads.md)
- [Child Process](./child-process.md)

### Security & Crypto
- [Crypto](./crypto.md)
- [Security](./security.md)
- [Authentication and Authorization](./authentication-and-authorization.md)

### Debugging, Testing & Tooling
- [Debugger](./debugger.md)
- [Console](./console.md)
- [Unit Tests](./unit-tests.md)
- [Util](./util.md)
- [TTY](./tty.md)

### Performance & Memory
- [Performance Optimization](./performance-optimization.md)
- [Memory Leaks](./memory-leaks.md)

### Frameworks: Express & NestJS
- [Express.js Framework](./express-js-framework.md)
- [Express Routing, Middleware, and Error Handling](./express-routing-middleware-error-handling.md)
- [NestJS Framework](./nest-js-framework.md)
- [NestJS Modules, Guards, Pipes, and Interceptors](./nest-js-modules-guards-pipes-interceptors.md)

## Interview Questions & Answers — Curated

**1. Explain the Node.js event loop phases and where microtasks fit in. (Advanced)**
Each loop iteration ("tick") runs through six phases in order: timers (due `setTimeout`/`setInterval` callbacks), pending callbacks (deferred I/O callbacks like certain TCP errors), idle/prepare (internal use), poll (retrieve new I/O events, execute their callbacks, and block here if nothing else is scheduled), check (`setImmediate` callbacks), and close callbacks (e.g. `socket.on('close')`). After every callback, Node drains the `process.nextTick` queue first, then the Promise microtask queue, before moving on — this happens between individual callbacks, not just between phases. See [event-loop.md](./event-loop.md) and [timers.md](./timers.md).

**2. cluster vs worker_threads — when would you use each? (Advanced)**
`cluster` forks separate OS processes that each get their own V8 instance and memory space, sharing a listening port so incoming connections are distributed across them — it scales I/O-bound HTTP servers across CPU cores, but workers can't share memory and communicate only via IPC/serialization. `worker_threads` run true threads inside a single process, optionally sharing memory via `SharedArrayBuffer`, making them the right tool for CPU-bound work (image processing, parsing, cryptography) that would otherwise block the main event loop. See [cluster.md](./cluster.md) and [worker_threads.md](./worker_threads.md).

**3. How do Node.js streams handle backpressure? (Advanced)**
When a writable stream's internal buffer exceeds `highWaterMark`, `.write()` returns `false`, signaling the producer to pause. The producer should stop writing until the stream emits `'drain'`. `readable.pipe(writable)` handles this automatically by pausing/resuming the source stream, and `stream/promises`' `pipeline()` is the modern preferred API since it also propagates errors and cleans up streams correctly. See [streams.md](./streams.md).

**4. Buffer vs TypedArray — what's the relationship? (Intermediate)**
`Buffer` is a Node-specific subclass of JavaScript's `Uint8Array`, so every `Buffer` is a `Uint8Array`, but with extra Node methods (`.toString(encoding)`, `.write()`, `.copy()`, etc.) for working with raw binary/encoded data. `Buffer.alloc(n)` zero-fills memory (safe but slower); `Buffer.allocUnsafe(n)` skips zero-filling for speed but may expose old memory contents until fully overwritten. See [buffers.md](./buffers.md).

**5. Express vs NestJS — what are the architecture tradeoffs? (Intermediate/Advanced)**
Express is a minimal, unopinionated framework — you get routing and middleware and choose everything else (structure, DI, validation) yourself, which suits small services and teams that want flexibility. NestJS is an opinionated, TypeScript-first framework built on top of Express (or Fastify) that layers on modules, dependency injection, decorators, guards, pipes, and interceptors, enforcing Angular-like structure that scales better across large teams and enterprise codebases at the cost of more boilerplate and a steeper learning curve. See [express-js-framework.md](./express-js-framework.md) and [nest-js-framework.md](./nest-js-framework.md).

**6. What's the difference between blocking and non-blocking I/O in Node? (Beginner/Intermediate)**
Blocking calls (e.g. `fs.readFileSync`) halt the single JS thread until the operation completes, freezing all other requests being served by that process. Non-blocking calls (e.g. `fs.readFile` with a callback, or its Promise/`await` equivalent) hand the operation off to libuv's thread pool or the OS kernel and return immediately, letting the event loop keep processing other work until a completion callback fires. See [blocking.md](./blocking.md) and [non-blocking.md](./non-blocking.md).

**7. `setTimeout(fn, 0)` vs `setImmediate(fn)` vs `process.nextTick(fn)` — what's the ordering? (Advanced)**
`process.nextTick()` callbacks always run before any I/O or timer callback, immediately after the current operation completes (before even Promise microtasks in older Node internals notes, but functionally: nextTick queue drains before the microtask queue on each pass). `setTimeout(fn, 0)` schedules for the next timers phase. `setImmediate()` schedules for the check phase, which runs after the poll phase — inside an I/O callback, `setImmediate` is guaranteed to fire before `setTimeout(fn, 0)`, but at the top level their order is not guaranteed. See [timers.md](./timers.md) and [event-loop.md](./event-loop.md).

**8. How does the child_process module differ across spawn, exec, execFile, and fork? (Advanced)**
`spawn` streams stdio and doesn't use a shell by default, ideal for long-running processes or large output. `exec` runs the command through a shell and buffers all output into memory (capped by `maxBuffer`), which makes it vulnerable to shell injection if user input is interpolated into the command string. `execFile` runs a specific executable directly without a shell, avoiding that injection risk. `fork` is a Node-specific specialization of `spawn` for launching another Node.js script, automatically setting up an IPC channel for `.send()`/`on('message')` communication. See [child-process.md](./child-process.md).

**9. Why is `crypto.createCipher` deprecated, and what should you use instead? (Advanced)**
`createCipher` derived both the key and IV from a password using a weak, non-standard algorithm and reused a static IV pattern, which is cryptographically unsafe. Modern code should use `crypto.createCipheriv`/`createDecipheriv` with an explicitly generated random IV (via `crypto.randomBytes`) and a properly derived key (via `crypto.scrypt` or `crypto.pbkdf2`), never a raw password. See [crypto.md](./crypto.md).

**10. What is the Node.js LTS release cycle? (Beginner/Intermediate)**
Even-numbered major versions (18, 20, 22, …) become Long Term Support (LTS) releases roughly six months after their initial "Current" release, then receive around 30 months of support across Active and Maintenance phases. Odd-numbered versions are short-lived "Current" releases meant for early adopters and are never promoted to LTS. Production services should generally track the current Active LTS line. See [releases.md](./releases.md).

**11. What's the difference between operational and programmer errors in Node? (Intermediate/Advanced)**
Operational errors are expected runtime failures in a correctly written program — a failed network request, an invalid user input, a timeout — and should be handled gracefully (retry, respond with an error status, log). Programmer errors are bugs (calling a method on `undefined`, a typo) that indicate the program's state is no longer trustworthy — the recommended practice is to let the process crash (with `uncaughtException` used only for logging before exit) and rely on a process manager to restart it, rather than trying to keep running in a corrupted state. See [error-handlings.md](./error-handlings.md).

**12. How does EventEmitter's error handling differ from other events? (Intermediate)**
If an `EventEmitter` emits an `'error'` event and no listener is registered for it, Node throws the error and crashes the process (or emits `uncaughtException`), unlike any other event name, which is silently a no-op with no listeners. This special-casing exists because unhandled errors are dangerous to ignore silently. See [events.md](./events.md).

**13. What is the difference between `http` and `https` modules, and how does TLS fit in? (Intermediate)**
`node:http` implements plain-text HTTP. `node:https` is effectively `http` wrapped with TLS encryption from `node:tls`, requiring a certificate/key pair (or being terminated upstream by a reverse proxy like nginx or a load balancer, which is common in production so Node itself doesn't manage certificates). See [http.md](./http.md), [https.md](./https.md), and [tls-ssl.md](./tls-ssl.md).

**14. Why shouldn't `vm.runInNewContext` be treated as a security sandbox? (Advanced)**
The `node:vm` module creates a separate V8 context (separate global object) but does not isolate it from the host process's memory, native bindings, or timers/microtasks the way a true sandbox (like a separate OS process or a `worker_threads` instance with restricted capabilities) would. Known escape techniques exist (e.g. via constructor chains reaching back to the host realm), so running genuinely untrusted code requires OS-level isolation, not `vm`. See [vm.md](./vm.md).

**15. What does `npm audit` catch, and what does it miss? (Intermediate)**
`npm audit` scans installed dependencies against a database of known published vulnerabilities (CVEs) and reports affected packages with suggested fixes/upgrades. It does not catch vulnerabilities in your own application code (e.g. injection flaws, prototype pollution you introduce, broken auth logic) or zero-days not yet published — dependency scanning is one layer of a broader security practice, not a substitute for code review and input validation. See [security.md](./security.md).

**16. What's the difference between `Buffer.alloc()` and `Buffer.allocUnsafe()`? (Intermediate)**
`Buffer.alloc(size)` allocates and zero-fills the buffer, which is safe but has a performance cost. `Buffer.allocUnsafe(size)` allocates faster by reusing an internal memory pool without zeroing it first, meaning the buffer may initially contain leftover data from previous allocations — safe only if you are about to fully overwrite every byte before reading from it. See [buffers.md](./buffers.md).

**17. How would you compress an HTTP response body in Node, and why prefer streaming? (Intermediate)**
Use `node:zlib`'s `createGzip()` (or `createBrotliCompress()` for better ratios) piped between the source stream and the response: `fs.createReadStream(file).pipe(zlib.createGzip()).pipe(res)`. Streaming avoids buffering the entire file/response in memory before compressing, which matters for large payloads and keeps memory usage bounded regardless of file size. See [zlib.md](./zlib.md) and [streams.md](./streams.md).

**18. What is the built-in `node:test` module, and how does it compare to Jest/Mocha? (Intermediate)**
Since Node 18+, `node:test` provides a zero-dependency test runner (`test()`, `describe()`/`it()`, subtests, mocking via `node:test`'s `mock` helper) paired with the built-in `node:assert` module, runnable via `node --test`. It covers the essentials without installing anything, while Jest/Mocha/Vitest still offer richer ecosystems (snapshot testing, more matchers, watch-mode UX, broader plugin support) that many teams still prefer for larger projects. See [unit-tests.md](./unit-tests.md).

**19. What's the difference between `require()` (CommonJS) and `import` (ESM) in Node, including `__dirname`? (Intermediate/Advanced)**
CommonJS (`require`/`module.exports`) is Node's original synchronous module system; `__dirname`/`__filename` are available automatically. ES Modules (`import`/`export`, enabled via `"type": "module"` in package.json or `.mjs` files) are the standardized, statically-analyzable system — but they don't have `__dirname`/`__filename` (you derive them from `import.meta.url` instead), and top-level `await` is only valid in ESM. See [globals.md](./globals.md).

**20. What does `package.json`'s `exports` field control, and why was it added? (Advanced)**
The `exports` field explicitly defines which files/subpaths a package exposes to consumers (and can provide different entry points for `import` vs `require`, or `browser` vs `node`), replacing the old behavior where every file in a package was implicitly importable. It improves encapsulation (truly private internal files) and enables correct dual CJS/ESM package support. See [package-json.md](./package-json.md).

## How to Use This Folder

1. **Core Runtime & Event Loop** first — the event loop, blocking vs non-blocking I/O, and timers are the mental model everything else builds on.
2. **Modules & Process** and **Streams, Buffers & Binary Data** next — these are the building blocks used throughout the networking, concurrency, and framework material.
3. **Networking** after that — HTTP/HTTPS/TLS/URL are where most backend interview questions live, and they depend on streams and the event loop being solid first.
4. **Concurrency: Cluster & Worker Threads** and **Security & Crypto** are more advanced/systems-level — comfortable footing in the event loop and streams makes these much easier to reason about.
5. **Debugging, Testing & Tooling** rounds out production-readiness — useful throughout, but especially once you're already writing real code against the topics above.
6. **Performance & Memory** next — diagnosing slow endpoints and memory leaks builds directly on the event loop, streams, and profiling tools covered earlier.
7. **Frameworks: Express & NestJS** last — both assume you already understand HTTP, middleware-style request handling, and async error handling from the core topics.

For interview prep specifically: skim each file's own "Interview Questions & Answers" section for quick per-topic review, then use the "Curated" list above as a cross-cutting mock-interview pass once the individual topics feel solid.
