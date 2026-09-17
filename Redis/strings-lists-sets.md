# Strings, Lists, and Sets

Strings, lists, and sets are the three most fundamental Redis data types, and each maps to a specific class of problem. A Redis string is a binary-safe byte sequence (up to 512MB) that can hold text, serialized JSON, an integer, or even binary data like a small image — it's the type used for simple key-value caching, counters, and flags. A Redis list is an ordered, doubly-linked collection of strings that supports fast push/pop from both ends, making it a natural fit for queues, stacks, and "recent activity" feeds. A Redis set is an unordered collection of unique strings, backed internally by a hash table (or an intset for small collections of integers), giving O(1) membership tests and native support for set algebra — union, intersection, difference — which is difficult to do efficiently in most other stores.

The key thing that distinguishes Redis from "a hash map with a network interface" is that operations on these types are atomic and often composable in a single round trip. `INCR` doesn't require the client to `GET`, add 1, and `SET` back — it happens atomically on the server, so concurrent increments from multiple clients never lose an update. Similarly, `SINTERSTORE` computes the intersection of two sets and stores the result as a new set, entirely server-side, which is how features like "mutual friends" or "users who bought both A and B" get implemented efficiently without pulling entire sets to the application layer.

Lists deserve special attention because of a common gotcha: `LPUSH`/`RPUSH`/`LRANGE` are O(1) for pushes at the ends but `LINDEX`/`LINSERT` in the middle of a list are O(N), and `LRANGE` over a large range is O(N) in the range size. Lists are implemented as linked lists (or a compact "listpack" encoding for small lists), which is why they're excellent for queue-like access patterns (push one end, pop the other) but poor for random access or as a general-purpose array. For blocking queue consumption, `BLPOP`/`BRPOP` let a worker wait for an item to arrive rather than polling.

Sets and their ordered cousin, sorted sets (covered separately), are the workhorse for anything involving "does this collection contain X," deduplication, or relationship modeling like tags, followers, or feature flags per user.

## Examples

```bash
# Strings: basic cache entry with TTL, and an atomic counter
127.0.0.1:6379> SET user:42:name "Anil Kapoor" EX 3600
OK
127.0.0.1:6379> GET user:42:name
"Anil Kapoor"
127.0.0.1:6379> INCR page:views:home
(integer) 1
127.0.0.1:6379> INCRBY page:views:home 5
(integer) 6
```

```bash
# Lists: a simple job queue using push/pop from opposite ends (FIFO)
127.0.0.1:6379> LPUSH jobs:queue "job:101" "job:102"
(integer) 2
127.0.0.1:6379> RPOP jobs:queue
"job:101"
127.0.0.1:6379> LRANGE jobs:queue 0 -1
1) "job:102"
```

```bash
# Sets: unique tags per article and intersection across two sets
127.0.0.1:6379> SADD article:5:tags "redis" "databases" "caching"
(integer) 3
127.0.0.1:6379> SADD article:9:tags "redis" "kubernetes"
(integer) 2
127.0.0.1:6379> SMEMBERS article:5:tags
1) "redis"
2) "databases"
3) "caching"
127.0.0.1:6379> SINTER article:5:tags article:9:tags
1) "redis"
```

## Common Pitfalls / Gotchas

- Using `LRANGE mylist 0 -1` on a huge list to "get everything" — this is O(N) and can be slow/blocking; page through with bounded ranges or reconsider the data structure.
- Treating a Redis list as a random-access array — `LINDEX`/`LINSERT` in the middle are O(N); if you need indexed access, a different structure (or restructuring the access pattern) is usually better.
- Forgetting that `SADD`/`SREM` on a set don't preserve insertion order — if order matters, use a list or a sorted set instead of a plain set.
- Using `SMEMBERS` on a very large set to iterate all members — like `KEYS`, this returns everything in one blocking call; use `SSCAN` for large sets.
- Not setting a TTL on cache-style string keys, leading to unbounded memory growth as stale keys accumulate forever.
- Confusing `SET key value` (which by default has no TTL and overwrites unconditionally) with `SET key value NX EX ttl` (used for locks/idempotent writes) — the option flags materially change the semantics.

## Interview Questions & Answers

**Q: Why would you choose a Redis list over a Redis set for a task queue?**
A: A list preserves insertion order and supports efficient push/pop from either end (`LPUSH`/`RPUSH`/`LPOP`/`RPOP`/`BLPOP`), which matches FIFO/LIFO queue semantics naturally. A set has no ordering and no concept of "the next item to process" — it's designed for membership tests and uniqueness, not sequencing. Lists also support blocking pops (`BLPOP`), letting workers wait efficiently for new jobs instead of polling.

**Q: How does `INCR` avoid race conditions that a naive GET-then-SET counter would have?**
A: `INCR` (and `INCRBY`) executes atomically on the server as a single command — because Redis processes commands one at a time on its single thread, there's no window where two clients can both read the same value and write back a stale increment. A client-side "read, add 1, write" sequence, by contrast, is inherently racy: two clients can both read 5, both compute 6, and both write 6, losing one increment.

**Q: What's the time complexity difference between `LPUSH`/`RPUSH` and `LINSERT`, and why does it matter?**
A: `LPUSH`/`RPUSH` are O(1) because they only touch the head or tail of the underlying linked structure. `LINSERT` (inserting before/after a specific element) is O(N) because Redis has to scan the list to find that element first. This matters because a list that looks fine at small scale can become a serious bottleneck if code path relies on O(N) middle-of-list operations as the list grows — the fix is usually to redesign the access pattern (e.g., use a sorted set with scores instead of positional inserts).

**Q: How would you implement "find users who follow both account A and account B" efficiently in Redis?**
A: Model each account's followers as a Redis set (`SADD followers:A user1 user2 ...`), then run `SINTER followers:A followers:B` to get the intersection server-side in one call, or `SINTERSTORE result followers:A followers:B` to persist the result as a new set for reuse. This avoids pulling both full follower lists to the application and computing the intersection in application code, which would be slower and use more bandwidth.

**Q: What's the difference between `SET key value EX 60` and separately calling `SET key value` then `EXPIRE key 60`?**
A: Functionally similar in the end state, but `SET ... EX 60` sets the value and TTL atomically in a single command, so there's no window where the key exists without an expiry. Doing it as two separate commands introduces a brief gap (between the `SET` and the `EXPIRE`) during which the key is persistent — if the process crashes or the connection drops between the two calls, the key never gets its TTL set at all.

## Related Topics

- [hashes-and-sorted-sets.md](./hashes-and-sorted-sets.md)
- [expiration-and-eviction.md](./expiration-and-eviction.md)
- [caching-patterns.md](./caching-patterns.md)
- [redis-overview.md](./redis-overview.md)
