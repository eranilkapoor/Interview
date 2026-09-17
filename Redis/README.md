# Redis Interview Preparation

Redis is one of the most commonly probed technologies in backend and systems-design interviews because it sits at the intersection of several topics interviewers care about: data structures, concurrency/atomicity, caching strategy, durability tradeoffs, and distributed systems (replication, failover, sharding). This folder covers Redis from its core execution model through its data types, memory management, durability mechanisms, messaging primitives, caching patterns, and high-availability/scaling architecture — each file pairs real command syntax with the conceptual reasoning interviewers actually probe for (not just "what does the command do," but "why would you choose this, and what breaks if you don't understand the tradeoff").

## Table of Contents

**Fundamentals**
- [Redis Overview](./redis-overview.md) — in-memory model, the single-threaded event loop, why Redis is fast, common use cases

**Data Structures**
- [Strings, Lists, and Sets](./strings-lists-sets.md) — SET/GET/INCR, LPUSH/RPUSH/LRANGE, SADD/SMEMBERS/SINTER
- [Hashes and Sorted Sets](./hashes-and-sorted-sets.md) — HSET/HGETALL for objects, ZADD/ZRANGE/ZRANGEBYSCORE for leaderboards and ranking

**Memory Management**
- [Expiration and Eviction](./expiration-and-eviction.md) — EXPIRE/TTL/PERSIST, maxmemory-policy (noeviction/LRU/LFU variants)

**Durability**
- [Persistence](./persistence.md) — RDB snapshotting vs AOF logging, durability tradeoffs, hybrid persistence

**Messaging: Pub/Sub & Streams**
- [Pub/Sub](./pub-sub.md) — PUBLISH/SUBSCRIBE, fire-and-forget semantics, no replay
- [Streams](./streams.md) — XADD/XREAD/XRANGE, consumer groups (XREADGROUP/XACK), durable replayable logs

**Caching Patterns**
- [Caching Patterns](./caching-patterns.md) — cache-aside, write-through, write-behind, cache stampede mitigation

**High Availability & Scaling**
- [Replication and Sentinel](./replication-and-sentinel.md) — primary-replica async replication, Sentinel quorum-based automatic failover
- [Redis Cluster](./redis-cluster.md) — 16384 hash slots, resharding, hash tags for multi-key operations

## Interview Questions & Answers — Curated

**Beginner**

**Q: Why is Redis fast despite being single-threaded?**
A: All data lives in RAM (no disk seeks on the hot path), the data structures are purpose-built for O(1)/O(log N) operations, and the single-threaded design eliminates locking overhead when mutating the keyspace. The event loop multiplexes many client connections efficiently via OS-level mechanisms like epoll — "single-threaded" refers to command execution against the keyspace, not "one client at a time." Since Redis 6, network I/O can be handled by multiple threads, but command execution itself stays single-threaded to preserve atomicity.

**Q: What's the difference between a Redis list and a Redis set?**
A: A list is an ordered collection that allows duplicate values and supports efficient push/pop from either end (O(1)), making it suited for queues and stacks. A set is an unordered collection of unique values with O(1) membership tests and native support for set algebra (union, intersection, difference) — suited for tags, deduplication, and relationship modeling.

**Q: What does `EXPIRE key seconds` actually do, and what does `TTL key` returning `-1` versus `-2` mean?**
A: `EXPIRE` sets a time-to-live on an existing key, after which Redis removes it automatically. `TTL` returns the remaining seconds; a return of `-1` means the key exists but has no TTL set (it's persistent), while `-2` means the key doesn't exist at all (already expired or never existed) — these two are commonly confused.

**Q: What's the difference between RDB and AOF persistence?**
A: RDB takes periodic point-in-time binary snapshots of the whole dataset — compact and fast to load, but can lose several minutes of writes on a crash depending on the snapshot schedule. AOF logs every write command as it happens and replays them on restart, offering a much tighter durability window (as little as ~1 second of loss with `appendfsync everysec`) at the cost of larger files and slower restarts.

**Q: What happens to a Redis pub/sub message if no client is subscribed when it's published?**
A: It's discarded immediately and permanently. Redis pub/sub has no buffering or persistence — a message only reaches clients that are actively subscribed at the exact moment `PUBLISH` runs.

**Intermediate**

**Q: What's the difference between `allkeys-lru` and `volatile-lru` eviction policies?**
A: `allkeys-lru` considers every key in the keyspace eligible for eviction under memory pressure, while `volatile-lru` only evicts among keys that have a TTL set, treating keys without a TTL as protected/permanent. You'd choose `volatile-lru` when some data in the instance (e.g., a queue or counter) is primary data that must never be silently deleted, while other data is expendable cache.

**Q: What is a cache stampede, and how do you prevent one?**
A: A cache stampede happens when a popular key expires and many concurrent requests all miss the cache at once, independently hammering the database to recompute the same value simultaneously. Mitigations include a short-lived lock so only one request recomputes the value while others wait or serve stale data, and jittered TTLs so related keys don't all expire at the exact same instant and cause synchronized misses.

**Q: How does `ZADD`/sorted sets support an efficient leaderboard?**
A: A sorted set is backed internally by both a skip list (ordered by score, enabling efficient range queries like `ZREVRANGE` for "top N") and a hash table (member-to-score, enabling O(1) `ZSCORE` lookups and O(log N) `ZREVRANK` for a specific player's rank). This dual structure gives both ordered range access and direct member lookup efficiently, which a plain sorted list or plain hash couldn't provide alone.

**Q: Why does Redis need both lazy and active expiration?**
A: Lazy expiration checks a key's TTL when it's accessed and deletes it on the spot if expired — but a key that's never accessed again would otherwise sit in memory forever. Active expiration is a background cycle that samples and proactively removes expired keys regardless of access, preventing that memory leak.

**Q: When would you choose Redis Streams over pub/sub for messaging?**
A: Whenever delivery must survive a consumer being temporarily offline. Streams persist every entry in an append-only log with unique IDs, so a consumer can read from wherever it left off, and consumer groups (`XREADGROUP`/`XACK`) provide at-least-once delivery with explicit acknowledgment and failure recovery (`XPENDING`/`XCLAIM`). Pub/sub is appropriate only when occasional message loss is acceptable, e.g., "refresh your UI" notifications.

**Q: What's the difference between cache-aside and write-through caching?**
A: In cache-aside, reads check the cache first and populate it lazily on a miss from the database, while writes go to the database and the cache entry is invalidated or updated separately. In write-through, every write updates the cache and database together synchronously, keeping the cache always consistent at the cost of higher write latency and caching data that may never be read.

**Advanced**

**Q: How does Sentinel handle failover, and why does it require quorum?**
A: Sentinel processes continuously monitor the primary and replicas; when a configured quorum of independent Sentinels independently agree the primary is unreachable (not just one Sentinel's local view, which could reflect its own network issue), one Sentinel is elected to perform the failover — promoting a replica to primary, reconfiguring remaining replicas, and publishing the new topology. Quorum protects against a single Sentinel's false positive triggering a disruptive, unnecessary failover.

**Q: Can Sentinel-managed failover guarantee zero data loss? Why or why not?**
A: No. Redis replication is asynchronous by default, so writes acknowledged by the primary but not yet propagated to the replica that gets promoted are lost during failover. `min-replicas-to-write`/`min-replicas-max-lag` can bound this risk by making the primary refuse writes if it doesn't have enough replicas caught up within an acceptable lag, trading some write availability for a tighter bound on potential data loss.

**Q: How does Redis Cluster distribute keys, and why can't you run a transaction across two arbitrary keys?**
A: Every key is hashed via CRC16 to one of 16384 fixed hash slots, and each primary node owns a subset of those slots. Multi-key transactions only work atomically if every key involved maps to the same slot, since Cluster doesn't implement cross-node distributed transaction coordination — arbitrary keys can (and usually do) live on different nodes. Hash tags (`{tag}` in a key name) let you force related keys into the same slot deliberately so they can be used together.

**Q: What's the operational difference between Redis Cluster's failover and Sentinel's failover?**
A: They solve overlapping but distinct problems — Sentinel provides automatic failover for a single, non-sharded primary-replica set, while Cluster shards data across multiple primaries and has its own native, per-shard failover mechanism built directly into the cluster's gossip/consensus protocol. Because Cluster already provides equivalent failover capability per shard, Cluster deployments don't typically also run Sentinel.

**Q: Why would `appendfsync everysec` be preferred over `always` in most production systems, and what's actually being risked?**
A: `always` fsyncs to disk on every single write command, adding real latency to every write for near-zero data-loss guarantees; `everysec` batches the fsync to once per second, bounding potential data loss on a crash to roughly the last second of writes while avoiding that per-write latency cost. Most applications don't need the marginal durability improvement of `always` badly enough to pay its throughput cost on every write.

**Q: In Redis Cluster, what's the tradeoff of overusing hash tags to group many unrelated keys under one tag?**
A: All keys sharing a hash tag land on the same node/slot by design, so overusing hash tags to group unrelated data defeats the purpose of sharding — it concentrates load and memory back onto fewer nodes instead of distributing it, potentially recreating a single-node bottleneck inside what's supposed to be a horizontally scaled cluster. Hash tags should be scoped narrowly to keys that genuinely need atomic multi-key operations together.

## How to Use This Folder

Start with [Redis Overview](./redis-overview.md) to ground the single-threaded execution model, since it explains *why* many later tradeoffs exist (blocking commands, eviction under memory pressure, atomic operations). Then move through the data structure files, memory management, durability, messaging, caching patterns, and finally high-availability/scaling in roughly the order listed in the table of contents — later topics (Cluster, Sentinel) build on assumptions from earlier ones (replication, persistence). Each file follows the same structure: a conceptual explanation, real `redis-cli` command examples, common pitfalls, and 3-5 interview Q&A pairs — practice explaining each concept out loud in terms of the problem it solves, the mechanism, the tradeoff, and how you'd debug or monitor it in production, since that's the depth interviewers push for beyond a memorized definition.
