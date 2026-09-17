# Redis Cluster

Redis Cluster is Redis's native solution for horizontal scaling — splitting a dataset across multiple Redis nodes (sharding) so the total dataset size and write throughput aren't limited by a single machine's RAM and single thread. Instead of one primary holding the entire keyspace, a cluster divides the keyspace into 16384 fixed hash slots, and each primary node in the cluster owns a subset of those slots. Every key is deterministically mapped to exactly one slot using `CRC16(key) mod 16384`, and any client that knows the cluster's slot-to-node mapping can compute which node owns a given key without needing a central coordinator to ask.

Clients interact with a cluster largely as if it were a single Redis instance, with one important difference: if a client sends a command for a key whose slot isn't owned by the node it connected to, that node responds with a `MOVED` redirect telling the client which node actually owns the slot (or `ASK` during an in-progress slot migration, telling the client to retry against a specific node just for that one request). Cluster-aware client libraries handle these redirects transparently and typically cache the slot map locally, refreshing it when they observe redirects, so in practice the redirect overhead is minor once a client has learned the topology.

Resharding — moving hash slots (and the keys within them) from one node to another — is how Redis Cluster grows or rebalances. `CLUSTER ADDSLOTS`/`CLUSTER SETSLOT` and the `redis-cli --cluster reshard` tooling move ownership of specific slots between nodes, migrating the actual key data as part of the process. This can happen live, without downtime, which is what makes Cluster suitable for capacity growth without a full cutover — new nodes are added, some slots are reassigned to them, and clients simply start getting redirected to the new owners for those slots as the migration completes.

A key limitation interviewers probe for: multi-key operations (transactions via `MULTI`/`EXEC`, Lua scripts touching multiple keys, or simple multi-key commands like `MSET`/`SINTER` across arbitrary keys) only work if all the involved keys hash to the *same* slot — Cluster doesn't support atomic operations spanning arbitrary keys across different nodes, since that would require distributed transaction coordination Cluster deliberately doesn't provide. Hash tags solve this: wrapping a portion of a key in `{}` (e.g., `{user1000}.profile` and `{user1000}.orders`) tells Redis to hash only the substring inside the braces when computing the slot, so any keys sharing the same hash-tag substring are guaranteed to land in the same slot and can therefore be used together in a transaction, Lua script, or multi-key command. Each shard (a primary and its replicas) in a cluster also gets its own failover — a replica within that shard is promoted automatically if its primary fails, using a Cluster-native mechanism similar in spirit to what Sentinel provides for a non-clustered deployment, which is why Cluster and Sentinel are not typically combined.

## Examples

```bash
# Create a basic 6-node cluster (3 primaries, 3 replicas) from a set of running instances
redis-cli --cluster create \
  127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 \
  127.0.0.1:7003 127.0.0.1:7004 127.0.0.1:7005 \
  --cluster-replicas 1
```

```bash
# Inspect slot ownership and which slot a given key hashes to
127.0.0.1:7000> CLUSTER SLOTS
127.0.0.1:7000> CLUSTER KEYSLOT user1000
(integer) 12345
127.0.0.1:7000> CLUSTER NODES
# lists each node, its role (master/slave), and its owned slot ranges
```

```bash
# Hash tags: force related keys into the same slot for multi-key ops
127.0.0.1:7000> SET {user1000}.profile '{"name":"Anil"}'
OK
127.0.0.1:7000> SET {user1000}.orders '[]'
OK
127.0.0.1:7000> MGET {user1000}.profile {user1000}.orders
1) "{\"name\":\"Anil\"}"
2) "[]"
```

## Common Pitfalls / Gotchas

- Running a multi-key command (`MGET`, `MSET`, `SINTER`) or a `MULTI`/`EXEC` transaction across keys that don't share a hash tag — Cluster will return a `CROSSSLOT` error, since it can't guarantee atomicity across keys living on different nodes.
- Assuming Cluster gives unlimited horizontal scaling for a single hot key — sharding distributes different *keys* across nodes, but one extremely large or extremely hot single key still lives entirely on one node and can become a bottleneck no matter how many nodes are in the cluster.
- Overusing hash tags to force unrelated keys into the same slot "just in case" — this defeats the purpose of sharding by concentrating load back onto fewer nodes; hash tags should be used narrowly, only for keys that genuinely need to be operated on together.
- Not using a cluster-aware client library (or a proxy like a cluster-mode-aware connection pool) — a naive client that doesn't handle `MOVED`/`ASK` redirects will fail or silently misbehave against a sharded cluster.
- Confusing Redis Cluster with Sentinel — Cluster shards data across multiple primaries and provides its own per-shard failover; Sentinel provides HA/failover for a single primary-replica set with no sharding. They solve different problems and aren't typically deployed together.
- Forgetting that 16384 is a fixed, hardcoded number of hash slots regardless of cluster size — with a very large number of nodes, this can limit how finely slots (and thus load) can be distributed, though in practice this only matters at very large node counts.

## Interview Questions & Answers

**Q: How does Redis Cluster decide which node owns a given key?**
A: Every key is hashed with CRC16 and mapped via `CRC16(key) mod 16384` to one of 16384 fixed hash slots. Each primary node in the cluster owns a specific, non-overlapping range (or set) of those slots, and the mapping of slots to nodes is what "owns" a key — a client (or the cluster itself) can compute a key's slot deterministically without needing a lookup service, then consult the slot-to-node map to find the owning node.

**Q: Why can't you run a transaction across two arbitrary keys in Redis Cluster?**
A: Because Cluster shards the keyspace across independent nodes, and two arbitrary keys can easily hash to slots owned by different nodes. Redis Cluster deliberately doesn't implement distributed transaction coordination across nodes (no two-phase commit, no cross-node atomicity), so `MULTI`/`EXEC`, Lua scripts, and multi-key commands are only guaranteed to work atomically when every key involved maps to the same hash slot — attempting it across different slots returns a `CROSSSLOT` error.

**Q: What are hash tags, and what problem do they solve?**
A: A hash tag is a substring of a key wrapped in curly braces, e.g., `{user1000}.profile` — when present, Redis Cluster computes the key's slot using only the content inside the braces rather than the whole key. This lets you deliberately force a set of related keys (like a user's profile, orders, and settings) to all land in the same hash slot, even though they're different keys, which makes them eligible for multi-key operations and transactions together. The tradeoff is that all hash-tagged keys sharing that tag live on the same node, so overusing hash tags to group too much data under one tag undermines the load-distribution benefit of sharding.

**Q: What happens when a client sends a command for a key to the wrong node in a cluster?**
A: The node returns a `MOVED` error/redirect pointing to the node that actually owns the slot for that key, and a cluster-aware client library transparently retries the command against the correct node (and typically updates its cached slot map so future requests for keys in that slot go directly to the right node). During an active slot migration, a node might instead respond with `ASK`, telling the client to redirect just that one request to a specific node without permanently updating its slot map, since the migration is still in progress.

**Q: How does Redis Cluster handle a primary node failing, and how is this different from what Sentinel does?**
A: Each shard in a Cluster deployment (a primary plus its replicas) has built-in failover: if a primary becomes unreachable, the cluster's own failure-detection and consensus mechanism (gossip protocol among cluster nodes) promotes one of its replicas to take over that primary's hash slots, without needing an external process. This is functionally similar to what Sentinel does for a non-clustered primary-replica setup, but it's native to Cluster and operates per-shard across a sharded topology, which is why Cluster deployments don't also run Sentinel — Cluster already provides the equivalent capability as part of its core design.

## Related Topics

- [replication-and-sentinel.md](./replication-and-sentinel.md)
- [hashes-and-sorted-sets.md](./hashes-and-sorted-sets.md)
- [pub-sub.md](./pub-sub.md)
- [redis-overview.md](./redis-overview.md)
