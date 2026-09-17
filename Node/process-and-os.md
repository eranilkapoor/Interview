# Process and OS

`process` is a global object available in every Node.js module without requiring anything — it's Node's representation of, and interface to, the currently running OS process itself. It exposes things like command-line arguments (`process.argv`), environment variables (`process.env`), the current working directory (`process.cwd()`), memory/resource usage (`process.memoryUsage()`, `process.cpuUsage()`), the ability to exit the process (`process.exit(code)`), and hooks into process-level lifecycle events like `'exit'`, `'uncaughtException'`, `'unhandledRejection'`, and OS signals (`'SIGINT'`, `'SIGTERM'`). It's also the object you interact with for standard streams (`process.stdin`, `process.stdout`, `process.stderr`) and, notably, `process.nextTick()`, which schedules a callback to run before the event loop continues to the next phase — even before Promise microtasks in ordering terms, which is a common interview gotcha.

`node:os`, by contrast, is a regular importable module (not a global) that reports information about the underlying operating system and hardware rather than the current process — things like `os.cpus()` (per-core info, useful for deciding how many `cluster` workers to fork), `os.totalmem()`/`os.freemem()` (system memory, in bytes), `os.platform()` (`'darwin'`, `'linux'`, `'win32'`, etc.), `os.homedir()`, `os.tmpdir()`, `os.hostname()`, and `os.networkInterfaces()`. The conceptual line between the two modules is: `process` is about *this specific running Node instance* (its env vars, its argv, its own exit code, its own memory footprint), while `os` is about *the machine/OS it happens to be running on* (total system resources, platform identity, hardware topology) — a distinction interviewers sometimes probe directly since the names are easy to conflate.

Error handling at the process level deserves particular care. `process.on('uncaughtException', handler)` catches synchronous errors that escaped every try/catch and would otherwise crash the process; `process.on('unhandledRejection', handler)` catches Promise rejections that were never `.catch()`-ed. Both exist as a last-resort safety net, but Node's own guidance (and most production practice) treats an uncaught exception as a signal that the process is in an unknown, potentially corrupted state — the recommended pattern is to log the error, perform minimal cleanup, and then exit the process deliberately (letting a process manager restart it), not to swallow the error and keep running indefinitely, since continuing after a truly unexpected error risks further undefined behavior or resource leaks. `process.exitCode = 1` (setting the property) is generally safer than calling `process.exit(1)` directly, because the former lets pending I/O (like a final `console.log` flush) complete naturally before the event loop empties and the process exits on its own, whereas `process.exit()` terminates immediately and can truncate unflushed output.

Signal handling matters for graceful shutdown: `process.on('SIGTERM', ...)` and `process.on('SIGINT', ...)` (SIGINT is what Ctrl+C sends) let a Node process intercept a shutdown request and clean up — closing database connections, finishing in-flight HTTP requests, draining a `cluster` worker — before actually exiting, which is essential in containerized/orchestrated environments (Docker, Kubernetes) that send `SIGTERM` and expect the process to shut down within a grace period before force-killing it with `SIGKILL`.

## Examples

```js
// process: inspecting argv, env, memory, and exit codes
import process from 'node:process';

console.log('Node executable:', process.argv[0]);
console.log('Script path:', process.argv[1]);
console.log('Extra CLI args:', process.argv.slice(2));

console.log('NODE_ENV:', process.env.NODE_ENV ?? 'development');
console.log('Current working directory:', process.cwd());

const mem = process.memoryUsage();
console.log(`RSS: ${(mem.rss / 1024 / 1024).toFixed(1)} MB, Heap used: ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`);

// Prefer setting exitCode over calling process.exit() so buffered stdout writes aren't truncated
if (!process.env.REQUIRED_CONFIG) {
  console.error('Missing REQUIRED_CONFIG');
  process.exitCode = 1;
}
```

```js
// Graceful shutdown on SIGTERM/SIGINT, plus a last-resort uncaughtException/unhandledRejection net
import http from 'node:http';
import process from 'node:process';

const server = http.createServer((req, res) => res.end('ok'));
server.listen(3000);

function shutdown(signal) {
  console.log(`Received ${signal}, closing server gracefully...`);
  server.close(() => {
    console.log('Server closed, exiting.');
    process.exit(0);
  });
  // Force-exit if graceful close takes too long (e.g., stuck connections)
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM')); // sent by Docker/Kubernetes on stop
process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception, shutting down:', err);
  process.exit(1); // don't keep running in an unknown state
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  process.exit(1);
});
```

```js
// os: querying machine-level info, e.g. to decide how many cluster workers to fork
import os from 'node:os';

console.log('Platform:', os.platform());       // 'win32', 'linux', 'darwin'
console.log('CPU cores:', os.cpus().length);
console.log('Total memory (GB):', (os.totalmem() / 1024 ** 3).toFixed(1));
console.log('Free memory (GB):', (os.freemem() / 1024 ** 3).toFixed(1));
console.log('Home directory:', os.homedir());
console.log('Temp directory:', os.tmpdir());
console.log('Hostname:', os.hostname());

// A common real use: sizing a worker pool relative to available cores, leaving headroom
const workerCount = Math.max(1, os.cpus().length - 1);
console.log('Recommended worker count:', workerCount);
```

## Common Pitfalls / Gotchas

- Confusing `process` (info about the current running Node instance) with `os` (info about the underlying machine) — `process.memoryUsage()` reports this process's memory, while `os.totalmem()`/`os.freemem()` report the whole system's.
- Calling `process.exit()` immediately after an async write (like `console.log` to a piped, non-TTY stdout) — output can be truncated because `process.exit()` terminates synchronously without waiting for pending I/O to flush; prefer setting `process.exitCode` and letting the process exit naturally.
- Treating `uncaughtException`/`unhandledRejection` handlers as a way to keep the process alive indefinitely after an unexpected error — Node's own docs recommend logging and exiting, since the process may be in a corrupted state (partially released locks, inconsistent in-memory state) that makes continuing unsafe.
- Not handling `SIGTERM` in containerized deployments — without a handler, the process gets a default termination behavior and doesn't get a chance to drain in-flight requests or close connections gracefully before Kubernetes/Docker force-kills it with `SIGKILL` after the grace period.
- Assuming `os.cpus().length` reflects the actual CPU quota available in a container — cgroup-limited containers can report the host machine's full core count even though the container itself is restricted to a fraction of a core, leading to over-provisioning (e.g., in `cluster.fork()` loops).
- Reading secrets from `process.env` and accidentally logging the entire `process.env` object (e.g., for debugging) — this can leak API keys, database credentials, and tokens into logs.
- Forgetting that `process.argv[0]` is the path to the `node` executable and `process.argv[1]` is the script path — actual user-supplied CLI arguments start at index 2, a common off-by-one mistake.
- Not calling `.unref()` on a setTimeout/interval used purely as a shutdown safety net — it can keep the process alive longer than intended if the primary shutdown path already completed.

## Interview Questions & Answers

**Q: What's the conceptual difference between `process` and `os` in Node.js?**
A: `process` is a global object representing the currently running Node.js instance itself — its command-line arguments, environment variables, memory usage, exit behavior, and lifecycle events. `os` is an importable module that reports information about the underlying operating system and hardware the process happens to be running on — total/free system memory, CPU core count and info, platform name, home/temp directories. `process` answers "what is this specific running program doing," `os` answers "what machine is it running on."

**Q: Why is `process.exitCode = 1` often preferred over calling `process.exit(1)` directly?**
A: `process.exit()` terminates the process synchronously and immediately, which can cut off any I/O that hasn't finished flushing yet — most notably `console.log`/`stdout` writes when output is piped to a file or another process (non-TTY), where writes can be asynchronous. Setting `process.exitCode` instead just records the exit code to use, and lets the event loop finish naturally (draining pending I/O) before the process exits on its own once there's no more work to do, avoiding truncated output.

**Q: How should a Node.js server handle `SIGTERM` in a containerized/orchestrated environment?**
A: It should register a handler for `SIGTERM` that initiates a graceful shutdown: stop accepting new connections/requests, allow in-flight requests to finish (e.g., `server.close()`), close database connections and other resources, and then exit. Kubernetes/Docker send `SIGTERM` and wait a grace period (commonly 30 seconds) before force-killing the process with `SIGKILL`, so the handler should complete well within that window, often with a fallback timer that force-exits if graceful shutdown takes too long.

**Q: What's the recommended way to handle `uncaughtException`, and why not just log it and keep running?**
A: Register a handler that logs the error with enough context to diagnose it, performs any minimal necessary cleanup, and then deliberately exits the process (typically `process.exit(1)`), relying on a process manager or orchestrator to restart it. Continuing execution after a truly uncaught exception is discouraged because the error means something escaped all your normal error handling — the process may be left in an inconsistent state (a lock not released, a partially-written resource, corrupted in-memory data), and continuing to serve requests from that state risks further, harder-to-diagnose failures.

**Q: How would you determine how many CPU cores a machine has to decide how many `cluster` workers to spawn?**
A: `os.cpus()` returns an array with one entry per logical CPU core, so `os.cpus().length` gives the core count — this is the typical way `cluster` examples decide how many workers to fork. The caveat worth mentioning in an interview is that in a containerized environment with a CPU quota (e.g., a Kubernetes pod limited to 0.5 CPU), `os.cpus().length` still reports the host machine's full core count, not the container's actual allotted share, so blindly forking `os.cpus().length` workers can over-provision; container-aware limits (like reading cgroup CPU quota files, or an explicit configured worker count) are more accurate in that scenario.

## Related Topics

- [cluster.md](./cluster.md)
- [child-process.md](./child-process.md)
- [event-loop.md](./event-loop.md)
- [globals.md](./globals.md)
- [error-handlings.md](./error-handlings.md)
