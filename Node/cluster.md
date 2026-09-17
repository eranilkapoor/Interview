# Cluster

Node.js runs JavaScript on a single thread, which means a single process can only use one CPU core no matter how many cores the machine has. The `node:cluster` module solves this at the process level: it lets you fork multiple copies of your application as separate OS processes (a "primary" process and one or more "worker" processes), all of which can share the same listening port. This is the standard way to scale an I/O-bound Node.js server (like an HTTP API) across all available CPU cores without changing the application logic.

`cluster.fork()` spawns a new worker process from the primary using `child_process.fork()` under the hood, so each worker is a full, independent Node.js process with its own V8 instance, its own event loop, and its own memory heap. Critically, workers do **not** share memory — there is no shared object space between the primary and its workers, or between workers themselves. Any coordination has to happen through message passing over the IPC (inter-process communication) channel that `cluster` automatically sets up, using `worker.send()` and `process.on('message', ...)`. This is a common interview trap: people assume `cluster` gives you shared in-memory state (like a shared cache) across workers, but it does not — you'd need Redis or another external store for that.

The mechanism that makes port-sharing possible is that when a worker calls `server.listen()`, the actual `listen()` call is intercepted by the cluster module and handled by the primary process, which owns the real listening socket. On most POSIX platforms the primary process uses a round-robin algorithm to hand off incoming connections to workers (this is the default `SCHED_RR` scheduling policy, configurable via `cluster.schedulingPolicy`). On Windows, and when explicitly configured, `SCHED_NONE` is used instead, where the OS itself decides which worker accepts a given connection — this is less evenly balanced than round-robin.

Cluster is specifically a tool for scaling I/O-bound workloads (handling more concurrent HTTP connections, more concurrent requests) across cores; it doesn't help a single request finish faster, and it isn't the right tool for CPU-bound parallel computation — for that, `worker_threads` is generally preferable because threads are lighter-weight than processes and can share memory via `SharedArrayBuffer`. In production, most people reach for a process manager like PM2, or container/orchestrator-level replication (multiple pods in Kubernetes), instead of hand-rolling `cluster` code, but understanding the primitive is still core Node.js knowledge.

## Examples

```js
// cluster.js — a classic primary/worker HTTP server using all CPU cores
import cluster from 'node:cluster';
import http from 'node:http';
import os from 'node:os';
import process from 'node:process';

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running, forking ${numCPUs} workers`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died (${signal || code}). Forking a replacement.`);
    cluster.fork(); // simple self-healing: replace crashed workers
  });
} else {
  // Each worker runs its own independent HTTP server, but they all share port 3000
  http.createServer((req, res) => {
    res.writeHead(200);
    res.end(`Handled by worker ${process.pid}\n`);
  }).listen(3000);

  console.log(`Worker ${process.pid} started`);
}
```

```js
// IPC between primary and workers — no shared memory, only message passing
import cluster from 'node:cluster';
import process from 'node:process';

if (cluster.isPrimary) {
  const worker = cluster.fork();

  worker.on('message', (msg) => {
    console.log('Primary received from worker:', msg);
  });

  worker.send({ cmd: 'greet', text: 'hello from primary' });
} else {
  process.on('message', (msg) => {
    if (msg.cmd === 'greet') {
      process.send({ cmd: 'reply', text: `worker ${process.pid} got: ${msg.text}` });
    }
  });
}
```

```js
// Graceful shutdown: draining a worker instead of killing it abruptly
import cluster from 'node:cluster';

if (cluster.isPrimary) {
  const worker = cluster.fork();

  setTimeout(() => {
    // Ask the worker to stop accepting new connections and exit once idle
    worker.disconnect();

    // Force-kill if it doesn't exit within a grace period
    const timeout = setTimeout(() => worker.kill('SIGKILL'), 5000);
    worker.on('exit', () => clearTimeout(timeout));
  }, 10000);
}
```

## Common Pitfalls / Gotchas

- Assuming workers share memory — they don't. In-memory caches, counters, or session stores set in one worker are invisible to the others; use Redis, a database, or sticky-session-aware design instead.
- Sticky sessions: because connections round-robin across workers, WebSocket connections or in-memory session data tied to "the process that handled the first request" can break unless you use sticky load balancing (e.g., `ip-hash` at a reverse proxy) or an external session store.
- Not handling the `'exit'` event to restart crashed workers — without this, a worker crash silently reduces your capacity until the whole cluster is redeployed.
- Forking as many workers as CPU cores by default without considering that other processes (or containers with CPU limits) are also competing for those cores — in containerized environments, `os.cpus().length` can be misleading since it reports the host's cores, not the container's CPU quota.
- Using `cluster` for CPU-bound work expecting a speedup on a single request — cluster increases concurrent *throughput* for many short I/O-bound requests, it does not make one computation finish faster.
- Forgetting that each worker has its own module-level state, timers, and open file handles/DB connection pools — a naive DB pool configured per-worker can multiply your total connection count by the number of workers.
- On Windows, the default scheduling is OS-driven (`SCHED_NONE`), not the round-robin (`SCHED_RR`) used by default on other platforms, which can produce less even load distribution.

## Interview Questions & Answers

**Q: What problem does the `cluster` module solve, and how does it solve it?**
A: Node.js runs on a single thread by default, so one process can only use one CPU core. `cluster` forks multiple full OS processes (workers) from a primary process, and all of them can share one listening port because the primary process owns the actual socket and distributes incoming connections to workers (round-robin on POSIX by default). This lets an I/O-bound server use every core on the machine to handle more concurrent connections.

**Q: Do cluster workers share memory? How would you share state between them?**
A: No. Each worker is a separate OS process with its own V8 heap; there's no shared memory between the primary and workers or between workers. State has to be shared via an external store like Redis or a database, or coordinated with explicit message passing over each worker's IPC channel (`worker.send()` / `process.on('message')`).

**Q: How does `cluster` differ from `worker_threads`, and when would you choose one over the other?**
A: `cluster` forks separate processes and is designed for scaling I/O-bound work (like handling many concurrent HTTP requests) across CPU cores — no shared memory, higher per-worker overhead, workers communicate via IPC. `worker_threads` runs real threads inside a single process, can share memory directly via `SharedArrayBuffer`, has lower overhead per unit, and is the right tool for CPU-bound parallel computation (image processing, cryptography, parsing large data) since libuv's thread pool and the event loop already handle I/O concurrency without needing extra processes.

**Q: What happens to in-flight requests when a cluster worker crashes?**
A: Requests being handled by that specific worker are lost (the connection drops) since the worker's process — and its entire heap and event loop state — is gone. The primary process typically listens for the worker's `'exit'` event and forks a replacement, but you need your own retry/idempotency logic on the client side or load balancer to handle the dropped in-flight requests gracefully.

**Q: Why might you use PM2 or Kubernetes replicas instead of hand-writing `cluster` code?**
A: `cluster` gives you the low-level primitive, but production concerns like zero-downtime restarts, log aggregation, health checks, auto-restart policies, and horizontal scaling across machines (not just cores) are usually better handled by a dedicated process manager (PM2's cluster mode) or an orchestrator (Kubernetes deployments with multiple pod replicas behind a service), which also scale beyond a single machine's core count.

## Related Topics

- [worker_threads.md](./worker_threads.md)
- [child-process.md](./child-process.md)
- [event-loop.md](./event-loop.md)
- [http.md](./http.md)
- [process-and-os.md](./process-and-os.md)
- [non-blocking.md](./non-blocking.md)
