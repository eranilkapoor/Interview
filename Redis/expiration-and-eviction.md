# Expiration and Eviction

Redis has two related but distinct mechanisms for reclaiming memory: key expiration (TTLs you set explicitly on individual keys) and eviction (Redis automatically removing keys under memory pressure according to a configured policy). Expiration is opt-in and precise — you tell Redis "this key should stop existing after N seconds," typically to model cache freshness, session lifetimes, or temporary locks. Eviction is a safety valve that only kicks in when the instance is close to its configured `maxmemory` limit, and it removes keys according to a policy you choose, regardless of whether those keys had an explicit TTL.

For expiration, `EXPIRE key seconds` (or `PEXPIRE` for milliseconds, `EXPIREAT`/`PEXPIREAT` for an absolute time) sets a TTL on an existing key, `TTL key` (or `PTTL`) reports the remaining time in seconds (or milliseconds), and `PERSIST key` removes a TTL, making the key permanent again. Internally, Redis expires keys two ways: lazily, when a key is accessed and found to be past its expiry (returned as if it doesn't exist), and actively, via a background cycle that periodically samples a set of keys with TTLs and removes any that have expired, even if nothing ever reads them. This matters because a key with a short TTL that's never accessed again won't leak memory forever — the active expire cycle will eventually clean it up.

Eviction only activates once `maxmemory` is set and reached. Redis then applies one of several policies, configured via `maxmemory-policy`: `noeviction` (the default — Redis returns errors on write commands once memory is full, but reads still work), `allkeys-lru` (evict the least-recently-used key across the entire keyspace, regardless of whether it has a TTL), `volatile-lru` (evict the least-recently-used key, but only among keys that have a TTL set), `allkeys-lfu` and `volatile-lfu` (evict based on least-frequently-used tracking instead of recency, better for workloads with a mix of hot and cold keys where recency alone is misleading), `allkeys-random`/`volatile-random` (evict a random key from the respective pool), and `volatile-ttl` (evict the key with the nearest expiration time first). Choosing `volatile-*` policies means keys without a TTL are treated as permanent and protected from eviction — useful when some keys are cache (expendable) and others are primary data (must never be silently evicted).

The practical distinction interviewers probe for: expiration is a correctness/freshness mechanism you design deliberately per key; eviction is an operational safety mechanism that only matters once you're near a memory ceiling, and picking the wrong policy (e.g., `allkeys-lru` when some keys are actually your system of record) can silently delete data you needed to keep.

## Examples

```bash
# Setting and inspecting TTLs
127.0.0.1:6379> SET session:abc123 "user:42" EX 1800
OK
127.0.0.1:6379> TTL session:abc123
(integer) 1800
127.0.0.1:6379> PERSIST session:abc123
(integer) 1
127.0.0.1:6379> TTL session:abc123
(integer) -1
```

```bash
# Configuring maxmemory and an eviction policy at runtime
127.0.0.1:6379> CONFIG SET maxmemory 100mb
OK
127.0.0.1:6379> CONFIG SET maxmemory-policy allkeys-lru
OK
127.0.0.1:6379> CONFIG GET maxmemory-policy
1) "maxmemory-policy"
2) "allkeys-lru"
```

```bash
# Checking whether a key exists / has no TTL, and forcing removal
127.0.0.1:6379> TTL nonexistent:key
(integer) -2
127.0.0.1:6379> SET permanent:flag "on"
OK
127.0.0.1:6379> TTL permanent:flag
(integer) -1
127.0.0.1:6379> DEL permanent:flag
(integer) 1
```

## Common Pitfalls / Gotchas

- Leaving `maxmemory-policy` at the default `noeviction` in a cache deployment — once memory fills up, writes start failing with `OOM command not allowed` errors instead of Redis quietly evicting old cache entries, which can take down an application that assumed Redis would "just handle it."
- Using `allkeys-lru` when the instance stores both disposable cache data and must-keep primary data (e.g., a queue or a counter with no TTL) — under memory pressure, Redis can evict the important untyped keys right along with the cache entries, since `allkeys-*` policies don't distinguish.
- Forgetting to set `maxmemory` at all — without it, Redis will keep allocating memory until the OS kills the process (OOM killer) or the host runs out of RAM, which is a much worse failure mode than controlled eviction.
- Assuming `TTL` of `-1` means "expired" — it actually means "no TTL set, key is persistent." A `TTL` of `-2` means the key doesn't exist (already expired or never existed). Confusing these two return values is a common bug.
- Setting very large `EXPIRE` batches (e.g., writing millions of keys with the exact same TTL) — they can all become eligible for active expiration at once, creating a burst of cleanup work; staggering (jittered) TTLs avoids this.

## Interview Questions & Answers

**Q: What's the difference between key expiration and key eviction in Redis?**
A: Expiration is a per-key TTL you set explicitly (`EXPIRE`, `SET ... EX`) that causes a key to be removed once its time is up, independent of memory pressure — it's a correctness/freshness mechanism. Eviction is Redis proactively removing keys because the instance has hit its configured `maxmemory` limit; which keys get removed and whether TTL-less keys are eligible depends entirely on the `maxmemory-policy` setting. A key can be evicted long before its TTL would have expired it, and eviction can happen to keys with no TTL at all if the policy is `allkeys-*`.

**Q: Explain the difference between `allkeys-lru` and `volatile-lru`.**
A: Both evict the least-recently-used key when memory pressure triggers eviction, but `allkeys-lru` considers every key in the keyspace as a candidate, while `volatile-lru` only considers keys that have a TTL set — keys without a TTL are treated as protected/permanent and are never evicted under `volatile-lru`. You'd choose `volatile-lru` when some data in the instance is your system of record (no TTL, must never be silently deleted) and other data is expendable cache (has a TTL).

**Q: What happens if you never set `maxmemory` on a production Redis instance?**
A: Redis will keep growing its memory usage without bound as new keys are written, since there's no ceiling to trigger eviction. Eventually this can exhaust the host's available RAM, potentially triggering the OS out-of-memory killer to terminate the Redis process abruptly — a much less graceful failure than controlled eviction under a configured `maxmemory` limit and policy.

**Q: How does Redis implement lazy vs active expiration, and why does it need both?**
A: Lazy expiration checks a key's TTL at access time — if a client reads a key whose TTL has passed, Redis deletes it on the spot and returns as if it never existed. Active expiration runs as a background cycle that samples keys with TTLs and proactively deletes any that have expired, even if no client ever accesses them again. Redis needs both because lazy-only expiration would let memory leak from expired-but-never-accessed keys (they'd sit in memory forever), while active-only expiration might not catch a just-expired key fast enough before a client tries to read it.

**Q: A leaderboard feature stores scores in a sorted set with no TTL, but the same Redis instance also caches HTTP responses with short TTLs. What eviction policy would you pick, and why?**
A: `volatile-lru` (or `volatile-lfu` if access frequency matters more than recency) — this restricts eviction to keys that have a TTL, protecting the leaderboard's sorted set (which has no TTL and is primary data, not disposable cache) from ever being evicted, while still reclaiming memory from the expendable HTTP cache entries under pressure. `allkeys-lru` would risk evicting the leaderboard data itself if it happened to be least-recently touched, which would be a correctness bug, not just a cache miss.

## Related Topics

- [strings-lists-sets.md](./strings-lists-sets.md)
- [persistence.md](./persistence.md)
- [caching-patterns.md](./caching-patterns.md)
- [redis-overview.md](./redis-overview.md)
