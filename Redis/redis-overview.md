# Redis Overview

Redis (REmote DIctionary Server) is an in-memory data structure store used as a cache, database, message broker, and queue. Unlike a traditional cache that only stores opaque blobs, Redis exposes rich data types — strings, lists, sets, hashes, sorted sets, streams, bitmaps, and HyperLogLogs — as first-class, server-side operations. This means logic like "increment this counter atomically" or "get the top 10 scores" runs inside Redis itself rather than requiring the client to fetch data, mutate it, and write it back, which both reduces round trips and avoids race conditions.

Redis is famous for being extremely fast — commonly cited at well over 100,000 simple operations per second on modest hardware — despite processing commands on a single thread. This is not a contradiction: the core command-processing loop is single-threaded by design, which eliminates the need for locks around data structure access and avoids context-switching overhead. Speed comes from three things working together: data lives entirely in RAM (no disk seeks on the read/write path), data structures are chosen and implemented specifically for O(1) or O(log N) operations, and the single-threaded event loop (built on epoll/kqueue-style multiplexing) processes commands from many concurrent client connections without lock contention. Since Redis 6, I/O threading was added to parallelize reading/writing bytes from the network, but command *execution* against the keyspace remains single-threaded, preserving atomicity guarantees for individual commands.

The single-threaded model has a critical practical consequence: any command that takes a long time to execute blocks every other client. Commands like `KEYS *`, `FLUSHALL`, or a `SORT` over a huge collection can stall the entire server for the duration of the call. This is why production guidance is to avoid O(N) commands on large collections in the hot path, use `SCAN` instead of `KEYS` for iteration, and offload expensive work to Lua scripts or client-side batching where appropriate.

Common production use cases include: an application-level cache in front of a slower database (cache-aside), a session store for web applications (fast reads/writes keyed by session ID with TTL-based expiry), a rate limiter (atomic `INCR` + `EXPIRE` per client/IP window), a lightweight message broker via pub/sub or the more durable Streams type, a distributed lock primitive (`SET key value NX PX ttl`), and a simple job queue backed by lists (`LPUSH`/`BRPOP`). Redis is not a replacement for a primary relational or document database in most cases — it trades durability guarantees and query flexibility (no ad hoc joins or secondary indexes beyond what sorted sets and search modules provide) for raw speed and simple, predictable access patterns.

## Examples

```bash
# Connect to a local Redis server
redis-cli -h 127.0.0.1 -p 6379

# Basic key-value roundtrip and server introspection
127.0.0.1:6379> PING
PONG
127.0.0.1:6379> SET greeting "hello redis"
OK
127.0.0.1:6379> GET greeting
"hello redis"
```

```bash
# Check server stats relevant to the single-threaded model
127.0.0.1:6379> INFO server
# redis_version, io_threads_active, etc.
127.0.0.1:6379> COMMAND DOCS SET
127.0.0.1:6379> SLOWLOG GET 10   # inspect recently slow commands
```

```bash
# Atomic counter used for a simple rate limiter (no read-then-write race)
127.0.0.1:6379> INCR api:calls:user123
(integer) 1
127.0.0.1:6379> EXPIRE api:calls:user123 60
(integer) 1
```

## Common Pitfalls / Gotchas

- Running `KEYS *` (or any O(N) full-keyspace scan) against a production instance — it blocks the single thread for the entire duration; use `SCAN` with a cursor instead, which iterates incrementally without blocking.
- Treating Redis as durable-by-default storage without understanding the persistence tradeoffs (see `persistence.md`) — data loss on crash is possible depending on configuration.
- Storing very large values (multi-MB strings, huge lists/hashes) — large payloads increase memory pressure and make single commands slow, which stalls other clients on the single thread.
- Assuming Redis automatically scales horizontally — it doesn't unless you deliberately deploy Redis Cluster; a single Redis instance is bound by one machine's RAM and one thread's throughput for command execution.
- Confusing "in-memory" with "not persisted" — Redis can persist to disk (RDB/AOF) while still serving reads/writes from RAM, so it's persistent *and* fast, not one or the other.

## Interview Questions & Answers

**Q: How can Redis be so fast if it's single-threaded?**
A: Because all data lives in RAM, data structures are purpose-built for O(1)/O(log N) access, and the single thread avoids the overhead of locking and context switching that a multi-threaded design would need to safely mutate shared data structures. The event loop multiplexes many client connections using OS-level mechanisms like epoll, so "single-threaded" doesn't mean "one client at a time" — it means one thread processes the queue of ready commands very quickly. Since Redis 6, network I/O can be parallelized across threads, but command execution against the keyspace stays single-threaded to preserve atomicity.

**Q: What are the practical downsides of the single-threaded command execution model?**
A: Any single slow command — an O(N) operation on a huge collection, a poorly written Lua script, `KEYS *` on a huge keyspace — blocks every other client for its full duration, since there's no preemption within a single command. This makes it essential to avoid unbounded-complexity commands in hot paths, use `SCAN`/`HSCAN`/`SSCAN` instead of full-collection commands, and keep individual data structures (hashes, lists, sorted sets) from growing unboundedly on one key.

**Q: When would you choose Redis over Memcached?**
A: Redis offers richer data types (lists, sets, hashes, sorted sets, streams) with atomic server-side operations, optional persistence (RDB/AOF), built-in replication and clustering, and pub/sub — Memcached is a pure key-value cache with none of that. If the requirement is genuinely "cache opaque blobs with LRU eviction and nothing else," Memcached's simpler multi-threaded design can have an edge on raw throughput for that narrow case; but most teams pick Redis because they outgrow "just a cache" quickly (rate limiting, leaderboards, session stores, queues).

**Q: Is Redis a database or a cache?**
A: It can be either, depending on configuration. Used with persistence disabled or as a volatile store fronting a source of truth, it's a cache. Used with AOF persistence, replication, and treated as the system of record for certain data (e.g., session state, real-time leaderboards), it functions as a primary database for that data. The distinction is about how you configure durability and how you treat data loss, not a hard architectural boundary.

**Q: What kinds of workloads is Redis a poor fit for?**
A: Workloads needing complex ad hoc queries/joins across large relational datasets, workloads where the entire dataset can't reasonably fit in RAM (Redis is memory-bound, and disk-backed strategies like Redis on Flash are a specialized exception), and workloads requiring strong multi-key transactional guarantees across a sharded cluster (cross-slot transactions in Redis Cluster are restricted).

## Related Topics

- [strings-lists-sets.md](./strings-lists-sets.md)
- [hashes-and-sorted-sets.md](./hashes-and-sorted-sets.md)
- [persistence.md](./persistence.md)
- [caching-patterns.md](./caching-patterns.md)
- [replication-and-sentinel.md](./replication-and-sentinel.md)
