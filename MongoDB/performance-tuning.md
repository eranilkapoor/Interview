# Performance Tuning

Most MongoDB performance problems trace back to one of a small number of root causes: a query running without a useful index, a working set that no longer fits in available RAM, too many short-lived connections opened per request instead of a reused pool, or a schema shape that requires excessive round trips (unindexed `$lookup`s, deeply unbounded arrays) for a common access pattern. Tuning is mostly the discipline of actually measuring which of these is happening — via `explain()`, server metrics, and profiling — rather than guessing and adding indexes or hardware speculatively.

`explain()` is the starting point for any single slow query: `db.collection.find(filter).explain("executionStats")` shows whether the query used an index (`IXSCAN`) or scanned the whole collection (`COLLSCAN`), and compares `totalDocsExamined` against `nReturned` — a large gap between the two means the index (or lack of one) isn't selective enough for that query. For finding slow queries across an entire application rather than one at a time, the database profiler (`db.setProfilingLevel(1, { slowms: 100 })`) logs operations that exceed a latency threshold into `system.profile`, which is the standard way to discover which queries are actually slow in production instead of guessing from application-level symptoms.

MongoDB (with the WiredTiger storage engine) keeps frequently-accessed data and indexes cached in RAM — the "working set." As long as the working set fits in available memory, reads are served from cache; once it doesn't, the server has to fault data in from disk on a growing fraction of operations, and latency degrades sharply rather than gracefully. This is why indexes matter doubly for performance: a well-chosen index is both smaller than the full collection (so more of it fits in RAM) and lets a query touch far fewer documents, both of which reduce disk I/O pressure. It's also why unbounded document growth (see schema-design and documents-and-collections) hurts performance beyond just the 16MB ceiling — bigger documents mean a smaller fraction of the collection fits in the same amount of RAM.

Connection handling is a common, easy-to-fix performance mistake distinct from query tuning: opening a new MongoDB connection per request is expensive (TCP handshake, authentication) and doesn't scale, so drivers provide connection pooling — a fixed set of long-lived connections reused across requests — and the fix for "the app is slow under load" is often confirming the driver's connection pool is actually being reused (one client instance for the app's lifetime) rather than reconnecting per request. Beyond these fundamentals, at true scale the tools converge with replication and sharding: read preference to offload reads to secondaries, and sharding to spread both data and write load across more machines once a single replica set's primary and disk genuinely can't keep up.

## Examples

```js
// Diagnosing a specific slow query with explain()
db.orders.find({ status: "paid", createdAt: { $gte: ISODate("2026-01-01") } })
         .explain("executionStats");
// Check: winningPlan.stage ("IXSCAN" vs "COLLSCAN"),
//        executionStats.totalDocsExamined vs nReturned,
//        executionStats.executionTimeMillis
```

```js
// Turning on the profiler to catch slow operations across the whole app,
// then reviewing what actually ran slowly in production
db.setProfilingLevel(1, { slowms: 100 }); // log ops slower than 100ms

db.system.profile.find({ millis: { $gt: 100 } })
                  .sort({ ts: -1 })
                  .limit(10)
                  .pretty();
```

```js
// Reusing a connection pool instead of reconnecting per request (Node.js driver) —
// one MongoClient instance, created once, reused across every request/handler
const { MongoClient } = require("mongodb");
const client = new MongoClient(uri, { maxPoolSize: 50 });
await client.connect(); // connect once at app startup

async function getOrder(id) {
  return client.db("shop").collection("orders").findOne({ _id: id });
  // reuses a pooled connection instead of opening a new one per call
}
```

## Common Pitfalls / Gotchas

- Running queries in production that have never been checked with `explain()` — it's easy for a query to silently fall back to `COLLSCAN` (missing index, type mismatch, unanchored `$regex`) without any error being raised.
- Opening a new database connection per request instead of reusing a pooled client — this adds handshake/auth latency to every request and can exhaust available connections under load.
- Letting the working set outgrow available RAM without noticing — performance degrades sharply, not gradually, once the server starts faulting to disk on a meaningful fraction of reads; this is visible in WiredTiger cache and page fault metrics before it shows up as obvious query slowness.
- Adding indexes reactively to "fix slowness" without first confirming via `explain()`/the profiler which query is actually slow and why — this can add write overhead for indexes that don't address the real bottleneck.
- Ignoring document growth over time (unbounded arrays, ever-larger embedded data) — larger average document size directly shrinks how much of the collection fits in RAM, which degrades performance across all queries, not just the ones touching the bloated field.

## Interview Questions & Answers

**Q: A query is slow in production. What's your first step to diagnose why?**
A: Run it through `explain("executionStats")` to see the actual plan: whether it used an index (`IXSCAN`) or scanned the collection (`COLLSCAN`), and how `totalDocsExamined` compares to `nReturned`. If it's not obvious which query is the problem, enable the profiler (`db.setProfilingLevel(1, { slowms: 100 })`) to capture all operations exceeding a latency threshold and find the actual slow queries first.

**Q: What is the "working set" and why does it matter for performance?**
A: The working set is the portion of data and indexes actively accessed, which WiredTiger keeps cached in RAM. As long as it fits in available memory, reads are served from cache with low latency; once it exceeds RAM, the server increasingly has to read from disk, and latency degrades sharply rather than gradually. Keeping indexes small and selective, and avoiding unbounded document growth, both help more of the working set fit in RAM.

**Q: Why does connection pooling matter for MongoDB performance, and what's the usual mistake?**
A: Opening a new connection per request incurs handshake and authentication overhead on every single operation and doesn't scale under load. Drivers provide connection pools — a set of long-lived, reused connections — and the common mistake is instantiating a new client per request instead of creating one client at application startup and reusing it, which defeats the pool entirely.

**Q: How would you find the slowest queries in a production MongoDB deployment without guessing?**
A: Enable the database profiler with a latency threshold (`db.setProfilingLevel(1, { slowms: 100 })`), which logs qualifying operations to the `system.profile` collection with timing and plan details, then query and sort that collection to identify the actual worst offenders rather than relying on anecdotal reports of "the app feels slow."

**Q: Besides adding indexes, what other levers do you have for improving MongoDB performance at scale?**
A: Ensuring the working set fits in RAM (right-sizing hardware, keeping documents and indexes lean), reusing connection pools instead of reconnecting per request, offloading read traffic to secondaries via read preference, and — once a single replica set's primary or disk genuinely can't keep up — sharding to distribute data and write load across multiple shards.

## Related Topics
- [indexes.md](./indexes.md)
- [aggregation-pipeline.md](./aggregation-pipeline.md)
- [replication.md](./replication.md)
- [sharding.md](./sharding.md)
