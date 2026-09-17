# Hashes and Sorted Sets

A Redis hash is a field-value map stored under a single key — conceptually a small object or row, where you can set, get, and increment individual fields without transferring or rewriting the entire structure. This makes hashes the natural choice for storing structured records like a user profile or a product, since you can update `HINCRBY user:42 login_count 1` without touching any other field, and Redis stores hashes with a very compact encoding (`listpack`) when they're small, which is more memory-efficient than storing each field as a separate top-level string key with a naming convention like `user:42:name`.

A Redis sorted set (zset) is a collection of unique members, each associated with a floating-point score, kept in score order internally (via a skip list plus a hash table for O(1) score lookup by member). This dual structure is what makes sorted sets so powerful: `ZADD`/`ZSCORE`/`ZINCRBY` give O(log N) or O(1) updates, while `ZRANGE`/`ZRANGEBYSCORE`/`ZREVRANGE` give efficient ordered range queries. The canonical use case is a leaderboard — score by points, member by player ID — where you need both "what's this player's rank/score" and "who's in the top 10" to be fast, and a sorted set gives you both. Sorted sets are also used for time-ordered data (score = timestamp), priority queues (score = priority), and rate limiting via sliding windows (score = request timestamp, then `ZREMRANGEBYSCORE` to expire old entries).

The relationship between hashes and sorted sets in system design is complementary rather than competing: a hash answers "what are the details of this specific entity," while a sorted set answers "how is this entity ranked/ordered relative to others." A typical leaderboard feature actually uses both — a sorted set (`leaderboard`) for scores/ranks, and a hash per player (`player:42`) for profile details, joined by the same ID.

Both types support partial updates without full-object rewrites and both have scan variants (`HSCAN`, `ZSCAN`) for safely iterating large collections without blocking, mirroring the `SCAN` pattern used for the main keyspace.

## Examples

```bash
# Hashes: store and update a user object as fields, not a serialized blob
127.0.0.1:6379> HSET user:42 name "Anil" email "anil@example.com" logins 0
(integer) 3
127.0.0.1:6379> HINCRBY user:42 logins 1
(integer) 1
127.0.0.1:6379> HGETALL user:42
1) "name"
2) "Anil"
3) "email"
4) "anil@example.com"
5) "logins"
6) "1"
127.0.0.1:6379> HGET user:42 email
"anil@example.com"
```

```bash
# Sorted sets: leaderboard with score updates and top-N ranking
127.0.0.1:6379> ZADD leaderboard 1500 "player:1" 2200 "player:2" 1800 "player:3"
(integer) 3
127.0.0.1:6379> ZINCRBY leaderboard 50 "player:1"
"1550"
127.0.0.1:6379> ZREVRANGE leaderboard 0 2 WITHSCORES
1) "player:2"
2) "2200"
3) "player:3"
4) "1800"
5) "player:1"
6) "1550"
```

```bash
# Sorted sets: range query by score, and rank lookup for one member
127.0.0.1:6379> ZRANGEBYSCORE leaderboard 1500 2000
1) "player:1"
127.0.0.1:6379> ZREVRANK leaderboard "player:1"
(integer) 2
```

## Common Pitfalls / Gotchas

- Serializing an entire object to JSON and storing it as one string under `HSET` (or worse, as a plain `SET`) — this defeats the purpose of hashes, since you then have to read/deserialize/mutate/reserialize/write the whole object for a one-field change instead of using `HSET field value` directly.
- Letting a hash or sorted set grow unbounded on a single key (e.g., a "global" leaderboard with millions of members, or a hash with millions of fields) — memory for a single key's data structure isn't distributed across a cluster's hash slots, so one giant key becomes a hot spot; consider sharding by category/region instead.
- Using `ZRANGE` (ascending) when you meant `ZREVRANGE` (descending) — a very common off-by-direction bug when building "top N" leaderboards, since scores are stored ascending internally.
- Forgetting that sorted set scores are floats (double precision) — for extremely large integer scores or when exact integer precision matters beyond ~2^53, precision loss is possible.
- Using `HGETALL` on a hash with a huge number of fields, or `ZRANGE key 0 -1` on a huge sorted set — both are O(N) and block the single thread; use `HSCAN`/`ZSCAN` for iteration over large structures.

## Interview Questions & Answers

**Q: Why use a Redis hash to store a user object instead of storing the whole object as a JSON string?**
A: A hash lets you read and write individual fields (`HGET`, `HSET`, `HINCRBY`) without touching the rest of the object, which is both faster and avoids race conditions where two clients might overwrite each other's changes to different fields. Storing the object as a single JSON string means any update requires a full read-modify-write of the entire blob, and two concurrent updates to different logical fields can clobber each other.

**Q: How would you implement a real-time leaderboard showing the top 10 players, and how would you get a specific player's rank even if they're not in the top 10?**
A: Use a sorted set with player ID as the member and score as their points: `ZADD leaderboard <score> <player>`. For the top 10, `ZREVRANGE leaderboard 0 9 WITHSCORES`. For a specific player's rank regardless of position, `ZREVRANK leaderboard <player>` gives their 0-indexed rank in O(log N), and `ZSCORE leaderboard <player>` gives their raw score — no need to pull the whole leaderboard to compute either.

**Q: What's the internal structure that makes sorted sets efficient for both "get by score range" and "get score by member"?**
A: Internally, a sorted set is backed by two structures: a skip list (ordered by score, enabling efficient range scans like `ZRANGEBYSCORE`) and a hash table (mapping member to score, enabling O(1) `ZSCORE` lookups). This dual representation is why sorted sets support both ordered range queries and direct membership/score lookups efficiently, unlike a plain sorted list (which would need a scan for member lookup) or a plain hash (which has no ordering).

**Q: How would you build a sliding-window rate limiter using a sorted set?**
A: Store one sorted set per client/key, where each request adds a member (e.g., a unique request ID) with the current timestamp as its score: `ZADD ratelimit:user123 <now> <request_id>`. Before allowing a new request, remove entries older than the window with `ZREMRANGEBYSCORE ratelimit:user123 -inf (now-window)`, then check `ZCARD ratelimit:user123` against the allowed limit. This gives an accurate sliding window (unlike a fixed-bucket counter) at the cost of O(log N) per request plus periodic cleanup.

**Q: When would a hash be a poor choice compared to just using top-level string keys?**
A: When the fields need independent TTLs (Redis hash fields don't support per-field expiration in the same way top-level keys do, though newer Redis versions added `HEXPIRE` for field-level TTLs), or when the number of fields is enormous and grows unboundedly on one key, creating a single oversized value that's expensive to serialize/transfer as a whole for operations like `HGETALL`. In those cases, separate keys (possibly with a naming convention) may distribute load and memory more evenly, especially in a clustered deployment.

## Related Topics

- [strings-lists-sets.md](./strings-lists-sets.md)
- [expiration-and-eviction.md](./expiration-and-eviction.md)
- [redis-cluster.md](./redis-cluster.md)
- [caching-patterns.md](./caching-patterns.md)
