# Memory Leaks

A memory leak in Node.js happens when memory that's no longer needed by the application is still reachable from a GC root, so V8's garbage collector can never reclaim it. Unlike languages with manual memory management, Node.js doesn't leak by forgetting to `free()` something — it leaks by *holding onto a reference* longer than intended, which keeps an object (and everything it references) alive indefinitely. Over time, this shows up as steadily climbing memory usage (RSS/heap) in production, eventually leading to degraded performance from excessive garbage collection pauses, or an out-of-memory crash.

The most common real-world causes are, in rough order of frequency: event listeners that are added but never removed (especially on long-lived objects like a shared `EventEmitter` or `process`), closures that capture large objects and are themselves kept alive longer than expected (e.g. a callback registered once but never cleared), unbounded in-memory caches or Maps that grow without any eviction policy, timers (`setInterval`) that are never cleared, and accumulating references in module-level/global arrays or objects that grow across requests instead of being scoped per-request.

Diagnosing a leak in production requires more than "increase `--max-old-space-size` and hope" — that just delays the crash. The standard approach is taking heap snapshots at two points in time under load (e.g. via Chrome DevTools connected to `node --inspect`, or programmatically with the `v8` module's `writeHeapSnapshot()`), then comparing them to see which object types grew disproportionately and what's still holding a reference to them ("retainers" in the snapshot's retainer tree). Continuous production monitoring (tracking `process.memoryUsage()` over time, or an APM tool) is what tells you a leak exists at all before you dive into a heap snapshot to find the cause.

## Examples

```javascript
// LEAK: listener added on every request, never removed
const emitter = require('./shared-emitter'); // module-level, long-lived

function handleRequest(req, res) {
  emitter.on('data', (payload) => {   // a NEW listener added every single request
    res.write(payload);
  });
}
// After 10,000 requests, this EventEmitter has 10,000 listeners attached,
// each one closing over its own `res` object that can now never be
// garbage collected, even after the response has long since finished.

// FIX: use a listener that's added once, or explicitly remove it
function handleRequestFixed(req, res) {
  const onData = (payload) => res.write(payload);
  emitter.on('data', onData);
  res.on('close', () => emitter.off('data', onData)); // clean up when the response ends
}
```

```javascript
// LEAK: unbounded cache that grows forever
const cache = new Map();

function getUser(id) {
  if (!cache.has(id)) {
    cache.set(id, fetchUserFromDb(id)); // never evicted, grows without bound
  }
  return cache.get(id);
}

// FIX: bound the cache with an LRU eviction policy
const LRU = require('lru-cache');
const boundedCache = new LRU({ max: 5000, ttl: 1000 * 60 * 5 }); // max 5000 entries, 5 min TTL
```

```javascript
// LEAK: a timer that's never cleared when the component/session ends
function startPolling(sessionId) {
  const interval = setInterval(() => {
    checkSessionStatus(sessionId); // this closure keeps sessionId (and its scope) alive forever
  }, 5000);
  // if this function's caller never calls clearInterval(interval), the
  // interval — and everything it closes over — lives for the life of the process
  return interval;
}

// FIX: always store the handle and clear it on cleanup
const interval = startPolling(sessionId);
session.on('end', () => clearInterval(interval));
```

## Common Pitfalls / Gotchas

- Treating rising memory usage as normal "caching behavior" without verifying there's an actual bound/eviction policy in place — a cache with no `max` size and no TTL is just a leak with a friendlier name.
- Registering event listeners inside a per-request or per-connection handler on a long-lived, shared `EventEmitter` instead of a scoped/short-lived one — each request adds a listener that outlives the request unless explicitly removed.
- Forgetting that closures keep their *entire* enclosing scope alive, not just the specific variable being used — a small callback can inadvertently keep a huge object graph reachable simply because it shares a scope with a reference to it.
- Reaching for `--max-old-space-size` to "fix" an OOM crash instead of finding the actual leak — this only raises the ceiling, buying time before the same unbounded growth crashes the process anyway (and it delays discovering the real bug).
- Not distinguishing a genuine leak from a large-but-legitimate working set — heavy load can legitimately increase memory usage; a leak is specifically memory that keeps growing and never comes back down even after load subsides and a GC cycle runs.

## Interview Questions & Answers

**Q: What causes memory leaks in a JavaScript/Node.js application, given that it has garbage collection?**
A: Garbage collection only reclaims memory that's genuinely unreachable from a GC root. A "leak" in a GC'd language means something is still holding a reference to an object that logically should be gone — an event listener that was never removed, a closure captured in a long-lived callback, an ever-growing cache or array, or an uncleared timer. The GC is doing its job correctly; the application is just accidentally keeping things reachable longer than intended.

**Q: How would you confirm and diagnose a suspected memory leak in a running production Node.js service?**
A: First confirm it's a real leak, not just a large working set, by watching `process.memoryUsage()` (or an APM dashboard) over time under steady load — a leak shows memory that keeps climbing and never comes back down even after GC runs and load stabilizes. Then take two heap snapshots (via `node --inspect` + Chrome DevTools, or `v8.writeHeapSnapshot()`) separated by some sustained load, compare them to see which object types grew, and inspect the retainer tree for those objects to find what's still holding a reference to them.

**Q: Why do event listeners commonly cause memory leaks in Node.js specifically?**
A: Because `EventEmitter`-based objects (like a shared service, `process`, or a socket) are often long-lived relative to the individual pieces of work that register listeners on them. If a listener is added per-request or per-connection but never explicitly removed with `.off()`/`.removeListener()`, that listener — and everything its closure captures — remains reachable for as long as the emitter itself lives, which in a long-running server process can be indefinitely.

**Q: What's the difference between raising `--max-old-space-size` and actually fixing a leak?**
A: Raising the heap size limit just gives a leaking process more room to grow into before it crashes with an out-of-memory error — it doesn't address the root cause, so memory usage still climbs unbounded and the process will eventually still hit the (now higher) ceiling and crash, just later. Fixing the leak means finding and removing the unintended reference (clearing a listener, bounding a cache, clearing a timer) so memory usage stabilizes instead of growing indefinitely.

## Related Topics
- [performance-optimization.md](./performance-optimization.md)
- [events.md](./events.md)
- [v8.md](./v8.md)
- [streams.md](./streams.md)
- [process-and-os.md](./process-and-os.md)
