# Sharding

Sharding is MongoDB's mechanism for horizontal scaling: instead of one replica set holding an entire collection's data, the collection is partitioned across multiple shards (each shard is itself typically a replica set for high availability), so both storage capacity and write/read throughput can grow by adding more machines rather than by making one machine bigger. This addresses the ceiling replication alone can't — replication improves availability and read scaling, but every replica set member still holds the full data set and the primary still absorbs every write; sharding is what lets the data set and the write load itself be split up.

The core decision that determines whether sharding works well or badly is the shard key — the field (or compound set of fields) MongoDB uses to decide which shard each document belongs to. Every document's shard key value is hashed or range-mapped into "chunks," contiguous ranges of shard key values, and MongoDB's balancer automatically splits chunks that grow too large and migrates chunks between shards to keep data roughly evenly distributed. A good shard key has high cardinality (many distinct values, so chunks can be split finely), even distribution of both data and — critically — write traffic across the key's range, and ideally aligns with your application's common query patterns so queries can be routed to a single shard instead of broadcast to all of them.

The classic shard key mistake is choosing a monotonically increasing field — a timestamp, an auto-incrementing counter, or a default `ObjectId` used directly as a range shard key — because all new writes land in the chunk holding the current "highest" value, meaning every insert goes to the same one shard while the rest of the cluster sits idle. This is called a hotspot, and it defeats the entire purpose of sharding for writes even though the data technically ends up "distributed" once historical chunks are migrated. The standard fixes are hashing the shard key (spreads writes evenly by hash, at the cost of losing range-query locality) or choosing a compound shard key that leads with something high-cardinality and roughly random (like a hashed `userId`) rather than a raw timestamp.

Architecturally, applications never talk to shards directly. They connect through `mongos`, a lightweight routing process that knows, via metadata stored on the config servers (themselves a small replica set), which shard holds which chunks, and routes each query to the right shard(s) — a single shard when the query includes the shard key, or a scatter-gather query across every shard when it doesn't. Config servers are the source of truth for the cluster's chunk-to-shard mapping and must themselves be highly available, since `mongos` routing depends entirely on their metadata being correct and reachable.

## Examples

```js
// Enabling sharding on a database and a collection with a compound shard key
sh.enableSharding("shop");
sh.shardCollection("shop.orders", { customerId: "hashed" });
// hashed shard key on customerId -> writes spread evenly across shards,
// and queries filtering by customerId route to a single shard
```

```js
// The classic hotspot anti-pattern: a monotonically increasing shard key
// concentrates all new writes onto whichever shard holds the current max chunk
sh.shardCollection("shop.events", { createdAt: 1 }); // BAD — avoid this

// Better: hash the key, or lead a compound key with a high-cardinality field
sh.shardCollection("shop.events", { createdAt: "hashed" });                // spreads writes
sh.shardCollection("shop.events", { deviceId: 1, createdAt: 1 });          // compound, deviceId leads
```

```js
// Checking chunk distribution and cluster shape
sh.status();                       // shard list, chunk ranges, balancer state
db.orders.getShardDistribution();  // per-shard document/chunk counts for one collection
sh.isBalancerRunning();            // whether the balancer is actively migrating chunks
```

## Common Pitfalls / Gotchas

- Choosing a monotonically increasing shard key (timestamp, default `ObjectId`, auto-increment counter) without hashing it — this creates a write hotspot where all new inserts land on a single shard, negating the benefit of sharding for write throughput.
- Choosing a low-cardinality shard key (like a status field with 3 possible values) — chunks can't be split finely enough, so a small number of shards end up holding disproportionately large, unsplittable chunks.
- Querying without including the shard key — a query that doesn't reference the shard key has to be broadcast to every shard (scatter-gather), which is far more expensive than a single-shard targeted query.
- Sharding too early, before understanding real access patterns, or sharding on a field convenient for one query pattern while ignoring that it creates a hotspot or scatter-gather cost for other common queries.
- Forgetting that the shard key (or its immutable prefix) generally cannot be changed after data is loaded without a full re-shard — the choice has long-term consequences and should be made deliberately, not by default.

## Interview Questions & Answers

**Q: What problem does sharding solve that replication alone doesn't?**
A: Replication improves availability and lets you scale reads across secondaries, but every replica set member still stores the entire data set, and all writes still go through one primary. Sharding partitions the data itself across multiple shards, so both storage capacity and write throughput can scale horizontally by adding more shards, rather than being capped by what a single replica set's primary and disks can hold.

**Q: What makes a good shard key?**
A: High cardinality (many distinct values, so chunks can be split finely), even distribution of data and — especially — write traffic across the key's range, and alignment with common query patterns so most queries can target a single shard rather than scatter-gather across all of them.

**Q: Why is a monotonically increasing field (like a timestamp or default ObjectId) usually a bad shard key choice?**
A: Because every new document has a shard key value higher than all previous ones, every insert lands in the chunk currently holding the maximum value — which lives on one shard. All write traffic concentrates on that single shard while the rest of the cluster does no write work, defeating the purpose of horizontal write scaling. Hashing the key, or leading a compound key with a higher-cardinality, more randomly-distributed field, avoids this hotspot.

**Q: What roles do `mongos` and the config servers play in a sharded cluster?**
A: `mongos` is the routing layer applications connect to — it doesn't store data itself, but routes each query to the correct shard(s) based on chunk metadata. The config servers (a small replica set) store that metadata — the authoritative mapping of which chunk ranges live on which shard. `mongos` instances read that metadata to route queries and are essentially stateless without it.

**Q: What happens when you query a sharded collection without including the shard key?**
A: `mongos` can't determine which shard(s) hold the matching documents, so it has to broadcast the query to every shard (a scatter-gather query) and merge the results. This works correctly but is significantly more expensive than a targeted query that includes the shard key and can be routed to a single shard.

## Related Topics
- [replication.md](./replication.md)
- [schema-design.md](./schema-design.md)
- [performance-tuning.md](./performance-tuning.md)
