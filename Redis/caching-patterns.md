# Caching Patterns

Caching with Redis isn't just "put data in Redis" — the pattern you choose determines when data is written to the cache, how stale reads can get, and what happens under load spikes or cache failures. The three canonical patterns are cache-aside (lazy loading), write-through, and write-behind, and each makes a different tradeoff between read/write latency, consistency, and implementation complexity.

Cache-aside (also called lazy loading) is the most common pattern: the application checks the cache first on a read; on a hit, it returns the cached value; on a miss, it reads from the source of truth (the database), writes that value into the cache (usually with a TTL), and returns it. Writes go directly to the database, and the corresponding cache entry is either invalidated (deleted, forcing the next read to repopulate it) or updated. The appeal is that only data actually requested gets cached — nothing is cached preemptively — and the cache can be entirely wiped or fail without losing data, since the database remains authoritative. The downside is every cache miss pays full database latency, and there's a window of staleness between a database write and the corresponding cache invalidation.

Write-through caching writes to the cache and the database synchronously, as part of the same write operation — the write isn't considered complete until both are updated. This keeps the cache always consistent with the database (no invalidation logic needed, no stale-read window), at the cost of higher write latency (every write pays for two systems) and cache being populated with data that might never be read again, wasting memory. Write-behind (write-back) takes this further: writes go to the cache immediately and are asynchronously flushed to the database later, batched or debounced. This gives the fastest possible write path and can absorb write bursts efficiently, but risks data loss if the cache fails before the async flush completes, and requires careful engineering (write queues, retry logic, ordering guarantees) to be safe — it's the most powerful but also most operationally complex of the three patterns.

A specific, high-stakes failure mode that shows up across all these patterns is the cache stampede (also called thundering herd): when a popular cache key expires, many concurrent requests can all miss the cache at once, and all of them independently hammer the database trying to repopulate the same key simultaneously — potentially overwhelming the database with redundant, identical work at exactly the moment it's least equipped to handle a burst. Two standard mitigations: locking (the first request to miss acquires a short-lived lock, e.g., `SET lock:key value NX PX 5000`, recomputes the value, and populates the cache while other concurrent requests either wait briefly or serve a slightly stale value instead of also hitting the database), and jittered TTLs (instead of every instance of a key expiring at exactly the same computed time, add randomized jitter to each TTL so expirations spread out over a window instead of clustering at one instant, which is especially important when many related keys are set at the same time with the same nominal TTL).

## Examples

```bash
# Cache-aside: check cache, miss, populate with a TTL (application-driven)
127.0.0.1:6379> GET product:501
(nil)
# App reads product:501 from the database, then populates the cache:
127.0.0.1:6379> SET product:501 '{"name":"Widget","price":9.99}' EX 300
OK
127.0.0.1:6379> GET product:501
"{\"name\":\"Widget\",\"price\":9.99}"
```

```bash
# Cache invalidation on write (cache-aside write path)
127.0.0.1:6379> DEL product:501
(integer) 1
# Next GET will be a miss, forcing a fresh read from the database on next request
```

```bash
# Stampede mitigation: acquire a short lock before recomputing an expired hot key
127.0.0.1:6379> SET lock:product:501 "worker-A" NX PX 5000
OK
# Only the client that got OK recomputes and repopulates the cache;
# a client that gets (nil) here should back off and retry shortly, or serve stale data.
127.0.0.1:6379> SET product:501 '{"name":"Widget","price":9.99}' EX 305
OK
127.0.0.1:6379> DEL lock:product:501
(integer) 1
```

## Common Pitfalls / Gotchas

- Using write-through everywhere by default — it doubles write latency for data that's rarely read, wasting both time and cache memory on entries with poor read/write ratios; cache-aside is usually the better default unless strict cache/database consistency is required.
- Setting the exact same TTL on many related keys populated at the same time (e.g., warming a cache in a batch job) — they all expire simultaneously later, creating a coordinated stampede; add random jitter (e.g., `TTL = 300 + random(0, 30)` seconds) to spread expirations out.
- Implementing write-behind without a durable, ordered write queue — if the process crashes after accepting a write into the cache but before flushing to the database, that write is lost with no record it was ever supposed to happen.
- Forgetting to handle the cache-aside race where two concurrent misses both read from the database and both write to the cache — usually harmless if they write the same value, but if the underlying data changed between the two reads, the cache can end up with a stale value written *after* a newer one, depending on write order.
- Not having a stampede mitigation strategy for genuinely hot keys (a viral post, a homepage banner) — without a lock or serve-stale-while-revalidating strategy, an expiring hot key can cause a synchronized burst of database load severe enough to cause a cascading outage.
- Treating cache invalidation as "delete the key" without considering multi-instance/cluster fan-out — if application servers each keep their own additional local cache layer on top of Redis, a Redis-level invalidation alone doesn't clear those local caches; pub/sub-based invalidation broadcast (see `pub-sub.md`) is often layered on top for that case.

## Interview Questions & Answers

**Q: What's the difference between cache-aside and write-through caching?**
A: In cache-aside, the application reads from the cache first and falls back to the database on a miss, populating the cache as a side effect of the miss; writes go to the database and the cache entry is invalidated or updated separately. In write-through, every write goes to the cache and the database together, synchronously, as one logical operation, so the cache is never stale relative to the database. Cache-aside only caches data that's actually been requested and tolerates cache failure gracefully (database stays authoritative), while write-through keeps stronger consistency but pays extra write latency and may cache data that's never read.

**Q: What is a cache stampede, and how would you prevent one?**
A: A cache stampede happens when a popular key expires (or the cache is cold-started) and many concurrent requests miss the cache simultaneously, all independently trying to recompute and repopulate the same value from the database at once — creating a redundant load spike on the database exactly when a single recomputation would have sufficed. Standard mitigations: a short-lived lock (`SET key val NX PX ttl`) so only one request recomputes the value while others wait or serve stale data; jittered TTLs so related keys don't all expire at the exact same moment; and "serve stale while revalidating," where an expired-but-recently-valid value is served immediately while one background request refreshes it.

**Q: Why would you add random jitter to cache TTLs instead of using a fixed expiration time for all keys?**
A: If many keys (or many instances of effectively the same key across a fleet) are populated at the same time with an identical fixed TTL, they all become eligible to expire at exactly the same instant, which reproduces the cache stampede problem at that moment — a burst of simultaneous misses hitting the database together. Adding jitter (e.g., a random +/- percentage on the TTL) spreads expirations out over a window, so misses trickle in rather than arriving as a synchronized spike.

**Q: When would write-behind caching be worth its added complexity?**
A: When write throughput is the dominant bottleneck and the application can tolerate a small, bounded risk of losing very recent writes in exchange for absorbing large write bursts without overwhelming the database — for example, high-frequency metrics ingestion, view counters, or activity logging where occasional loss of the last few updates during a crash is an acceptable tradeoff for dramatically lower write latency and better burst handling. It's generally not worth it for data with strict durability requirements (financial transactions, order state) unless paired with a durable write-ahead queue.

**Q: How do you decide what TTL to use for a cache-aside entry?**
A: Balance staleness tolerance against database load: a shorter TTL keeps data fresher but causes more cache misses (and thus more database load and higher tail latency); a longer TTL reduces database load but risks serving more stale data for longer. The right value depends on how often the underlying data actually changes and how costly a stale read is for that specific data — session data or a rapidly changing price might need a short TTL or explicit invalidation on write, while a rarely-changing product description can tolerate a much longer TTL.

## Related Topics

- [expiration-and-eviction.md](./expiration-and-eviction.md)
- [pub-sub.md](./pub-sub.md)
- [strings-lists-sets.md](./strings-lists-sets.md)
- [redis-overview.md](./redis-overview.md)
