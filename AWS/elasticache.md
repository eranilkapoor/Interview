# Amazon ElastiCache

ElastiCache is AWS's fully managed in-memory data store, offered as either Redis (technically "Valkey" is now the AWS-recommended open-source successor after Redis's licensing change, but the service and concepts are the same) or Memcached engines. Its purpose is to sit in front of a slower backing store — usually a relational or document database — and serve frequently-requested data from memory in sub-millisecond time, taking read (and sometimes write) load off the database and cutting response latency dramatically compared to hitting disk-backed storage on every request.

The engine choice matters and is a real interview topic, not a coin flip. Memcached is a simple, multi-threaded, pure key-value cache with no persistence, no replication, and no complex data types — its selling point is straightforward horizontal scaling by adding nodes and simplicity when all you need is a fast, disposable cache. Redis is single-threaded per node but far richer: it supports complex data structures (lists, sets, sorted sets, hashes, streams), persistence (snapshotting and append-only-file logging so data can survive a restart), replication with automatic failover (Multi-AZ), pub/sub messaging, and Lua scripting for atomic multi-step operations. In practice, Redis is the default choice today for almost everything beyond the simplest disposable cache, precisely because of that feature depth — Memcached is chosen specifically when you want its multi-threaded simplicity and genuinely have no need for persistence, replication, or richer data structures.

Two caching patterns dominate real usage. Cache-aside (lazy loading) has the application check the cache first; on a miss, it reads from the database, then writes that result into the cache before returning it — subsequent reads hit the cache until the entry expires or is evicted. This is simple and resilient to cache failures (a cold or down cache just means every read temporarily falls through to the database) but means the first request after any miss pays full database latency, and it does nothing to help write-heavy paths. Write-through has the application (or a wrapping layer) write to the cache and the database together as part of the same write path, keeping the cache always warm and consistent with the database at the cost of extra write latency and complexity, and cache entries that are written but never read still consume memory. Most production systems default to cache-aside for reads and layer in explicit invalidation or a short TTL to bound staleness, reaching for write-through specifically when read-after-write consistency for that data matters.

TTL (time-to-live) and eviction policy are what keep a cache from either serving indefinitely stale data or growing without bound. Every cached entry can carry an expiration; once it passes, the entry is treated as a miss and refreshed on next access. When memory fills up before TTLs naturally expire enough entries, an eviction policy decides what to remove — common Redis policies include `allkeys-lru` (evict the least recently used key regardless of whether it has a TTL), `volatile-lru` (only evict among keys that have a TTL set, leaving persistent keys alone), and `noeviction` (reject new writes once full, which is rarely what you want for a pure cache workload). Choosing the wrong policy is a subtle production bug: `noeviction` on a cache that's expected to auto-evict causes write errors under memory pressure instead of graceful eviction.

Redis cluster mode shards data across multiple node groups (shards), each with its own primary and optional read replicas, using hash slots to distribute keys — this is how you scale a Redis dataset beyond what a single node's memory can hold, and how you get higher aggregate throughput than one node can serve. Non-cluster-mode Redis (a single primary with up to 5 read replicas) is simpler and sufficient when the dataset fits comfortably on one node and you mainly need read scaling and Multi-AZ failover rather than horizontal write/data sharding.

## Examples

```bash
# Create a Redis replication group with Multi-AZ automatic failover and
# cluster mode disabled (single shard, primary + 2 read replicas)
aws elasticache create-replication-group \
  --replication-group-id checkout-cache \
  --replication-group-description "Checkout service read cache" \
  --engine redis \
  --cache-node-type cache.r6g.large \
  --num-cache-clusters 3 \
  --automatic-failover-enabled \
  --multi-az-enabled
```

```python
# Cache-aside pattern in application code: check cache, fall back to DB,
# populate the cache with a TTL so staleness is bounded
import redis, json

cache = redis.Redis(host="checkout-cache.abc123.use1.cache.amazonaws.com", port=6379)

def get_product(product_id):
    key = f"product:{product_id}"
    cached = cache.get(key)
    if cached:
        return json.loads(cached)  # cache hit

    product = db.query_product(product_id)      # cache miss: fall through to DB
    cache.setex(key, 300, json.dumps(product))   # cache with a 5-minute TTL
    return product
```

```bash
# Set eviction policy explicitly rather than relying on the default —
# volatile-lru only evicts keys that have a TTL, leaving un-expiring keys alone
aws elasticache modify-cache-parameter-group \
  --cache-parameter-group-name my-redis-params \
  --parameter-name-values "ParameterName=maxmemory-policy,ParameterValue=volatile-lru"
```

## Common Pitfalls / Gotchas

- Choosing Memcached out of habit or unfamiliarity with Redis, then later needing persistence, replication, or richer data types Memcached simply doesn't support — evaluate the actual requirements up front rather than defaulting.
- Leaving `maxmemory-policy` at `noeviction` on a workload that's meant to behave as a pure cache — once memory fills, writes start failing instead of gracefully evicting old entries, which usually surfaces as a confusing production incident rather than a capacity-planning conversation.
- Cache stampede / thundering herd: a popular key expires and many concurrent requests all miss simultaneously and hammer the database at once to repopulate it — mitigated with jittered TTLs, a short "lock" while one request repopulates, or serving stale-while-revalidate.
- Treating the cache as a system of record — ElastiCache (especially Memcached, and Redis without persistence enabled) is not guaranteed durable storage; a cache flush or node replacement can lose data, and anything that must survive that needs to live in the actual database.
- Setting TTLs too long for data that changes — stale reads propagate to every user hitting the cache until expiration; setting them too short defeats the purpose of caching by pushing most traffic back to the database anyway. This tradeoff needs to be tuned per data type, not set globally.
- Ignoring hot keys/hot shards in cluster mode — a single extremely popular key can overload the one shard/node it hashes to even though the cluster's aggregate capacity looks fine, since Redis cluster mode shards by key hash, not by load.

## Interview Questions & Answers

**Q: Redis vs Memcached — how do you choose?**
A: Memcached is simpler and multi-threaded, but has no persistence, no built-in replication, and only supports plain key-value strings — good when you want a disposable, horizontally-scalable cache and truly need nothing more. Redis is richer: complex data structures, optional persistence, Multi-AZ replication with automatic failover, pub/sub, and atomic scripting — it's the default choice for most production use cases today specifically because of that depth, and Memcached is chosen deliberately, not by default.

**Q: Explain cache-aside vs write-through, and when you'd pick each.**
A: Cache-aside has the application read from the cache first, and on a miss, read from the database and populate the cache before returning — simple, resilient to cache outages (falls through to the DB), but the first post-miss request always pays full DB latency. Write-through writes to the cache and database together on every write, keeping the cache always warm and consistent, at the cost of added write latency and caching entries that may never be read. Cache-aside is the more common default; write-through is worth it specifically when read-after-write consistency matters for that data.

**Q: What does an eviction policy control, and what's the risk of getting it wrong?**
A: It controls what ElastiCache removes when memory fills up before TTLs naturally expire enough data — for example, `allkeys-lru` evicts the least recently used key regardless of TTL, `volatile-lru` only evicts among keys with a TTL set, and `noeviction` rejects new writes instead of evicting anything. Getting it wrong (e.g., leaving `noeviction` on a workload meant to behave as a cache) turns a capacity problem into write failures in production instead of graceful, invisible eviction.

**Q: What is a cache stampede and how do you prevent one?**
A: It's when a popular cache key expires and a burst of concurrent requests all miss at once, each independently hitting the database to repopulate the same key — which can spike database load sharply right at the moment the cache was supposed to be protecting it. Mitigations include adding jitter to TTLs so keys don't all expire in lockstep, using a short-lived lock so only one request repopulates the key while others wait or serve stale data, or serving slightly stale data while one background request refreshes it.

**Q: When would you use Redis cluster mode instead of a single-shard replication group?**
A: When the dataset no longer fits in a single node's memory, or when you need more aggregate throughput than one primary (plus its read replicas) can serve. Cluster mode shards data across multiple node groups by hash slot, each independently scalable, versus non-cluster-mode Redis, which is a single primary with up to 5 read replicas — sufficient for read scaling and Multi-AZ failover, but not for scaling the dataset size itself.

## Related Topics
- [rds.md](./rds.md)
- [aurora-db.md](./aurora-db.md)
- [dynamodb.md](./dynamodb.md)
- [observability.md](./observability.md)
- [well-architected-framework.md](./well-architected-framework.md)
