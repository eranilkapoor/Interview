# Replication and Sentinel

Redis replication is a primary-replica (formerly "master-slave") model where one Redis instance accepts all writes and one or more replica instances maintain a continuously-updated copy of the dataset by receiving a stream of write commands from the primary. Setting up replication is simple — a replica runs `REPLICAOF <primary-host> <primary-port>` (or is configured with `replicaof` in redis.conf) and Redis handles the rest: the replica performs an initial full sync (the primary takes an RDB-style snapshot and sends it over), then switches to receiving a live stream of write commands (the replication backlog) to stay current. Replication is asynchronous by default — the primary acknowledges a client's write and returns immediately without waiting for replicas to confirm they've received it, which keeps write latency low but means a replica can lag behind the primary and a crash on the primary right after a write can lose that write if it hadn't yet reached any replica.

Replication by itself gives you read scaling (route reads to replicas to spread load) and a hot standby copy of the data, but it does not give you automatic failover — if the primary dies, replicas just sit there, still replicas, with no writes accepted anywhere until a human (or a script) manually promotes one of them with `REPLICAOF NO ONE`. This is the gap Redis Sentinel fills. Sentinel is a separate, specialized set of Redis processes that continuously monitor primary and replica instances, agree (via quorum voting) that a primary is genuinely down (not just unreachable from one Sentinel's perspective), and automatically perform the failover: promote a replica to primary, reconfigure the other replicas to follow the new primary, and publish the new topology so correctly-configured clients can discover the new primary address without manual intervention.

Sentinel's quorum concept is central to correctness: individual Sentinels can have false positives (network partition from their own vantage point, not necessarily the primary actually being down), so a single Sentinel's opinion isn't enough to trigger failover. A configured quorum number of Sentinels must independently agree the primary is unreachable before one of them is elected (via a Raft-like leader election among Sentinels) to actually carry out the failover — this protects against a single Sentinel's flaky network view causing an unnecessary, disruptive failover. Because replication is asynchronous, failover under Sentinel is not lossless: any writes accepted by the old primary but not yet replicated to the promoted replica at the moment of failure are lost — Sentinel restores availability, not zero-data-loss guarantees, unless `min-replicas-to-write`/`min-replicas-max-lag` are tuned to reject writes when replication is too far behind (trading availability for reduced data-loss risk).

For most production deployments needing both scale and high availability, Sentinel is used for small-to-medium deployments with a single primary and a handful of replicas, while Redis Cluster (covered separately) is used when the dataset itself needs to be sharded across many primaries — Cluster actually has failover built into it natively for each shard, so Sentinel and Cluster solve overlapping-but-distinct problems and aren't typically combined (Cluster doesn't need Sentinel).

## Examples

```bash
# On the replica: point it at a primary and confirm replication role
127.0.0.1:6380> REPLICAOF 127.0.0.1 6379
OK
127.0.0.1:6380> INFO replication
# role:slave, master_link_status:up, master_repl_offset:...
```

```bash
# On the primary: check connected replicas and replication offset
127.0.0.1:6379> INFO replication
# role:master, connected_slaves:1, slave0:ip=...,offset=...
127.0.0.1:6379> WAIT 1 1000
(integer) 1   # block until 1 replica acks, or timeout (ms) elapses
```

```bash
# Query Sentinel for the current primary address and force a manual failover
127.0.0.1:26379> SENTINEL get-master-addr-by-name mymaster
1) "127.0.0.1"
2) "6379"
127.0.0.1:26379> SENTINEL failover mymaster
OK
```

## Common Pitfalls / Gotchas

- Assuming replication is synchronous by default — it isn't; a write can be acknowledged to the client before any replica has received it, so a primary crash immediately after a write can lose that write even with replicas configured. `WAIT` can be used to block for N replicas to acknowledge, trading latency for stronger durability on specific writes.
- Deploying a single Sentinel instance — quorum-based failure detection requires multiple independent Sentinels (typically 3+, in odd numbers, spread across failure domains) so a single Sentinel's crash or network partition doesn't itself trigger or prevent failover incorrectly.
- Pointing application clients directly at a hardcoded primary IP/hostname instead of discovering it through Sentinel (`SENTINEL get-master-addr-by-name`) — after a failover, the primary's address changes, and a hardcoded client keeps writing to what is now a demoted replica (or nothing).
- Not tuning `min-replicas-to-write`/`min-replicas-max-lag` when data-loss-on-failover risk matters — without it, the primary happily keeps accepting writes even if replicas are badly lagging or completely disconnected, maximizing the potential data loss window during an eventual failover.
- Confusing Sentinel (high availability for a single primary-replica set) with Redis Cluster (horizontal sharding across multiple primaries) — they solve different problems and aren't typically run together; Cluster has its own failover mechanism.

## Interview Questions & Answers

**Q: Why is Redis replication asynchronous by default, and what's the durability consequence?**
A: Asynchronous replication lets the primary acknowledge a write to the client immediately after applying it locally, without waiting for the write to reach any replica — this keeps write latency low and avoids making every write dependent on replica network round-trip time. The consequence is that a primary crash immediately after acknowledging a write, but before that write propagated to any replica, permanently loses that write even though the client was told it succeeded. `WAIT numreplicas timeout` can force a specific write to block until it's confirmed on N replicas, giving tunable durability at the cost of latency for that command.

**Q: What problem does Sentinel solve that plain replication doesn't?**
A: Plain replication keeps replica(s) up to date with the primary but has no automatic response to the primary failing — if the primary crashes, every replica just stays a replica, and writes are impossible until a human manually promotes one. Sentinel continuously monitors the primary and replicas, detects a genuine primary failure via quorum agreement among multiple Sentinel processes, and automatically promotes a replica to primary, reconfigures the remaining replicas, and informs clients of the new topology — turning what would be a manual, slow recovery into an automated one.

**Q: Why does Sentinel require quorum (multiple Sentinels agreeing) instead of acting on a single Sentinel's observation that the primary is down?**
A: A single Sentinel might be unable to reach the primary due to its own network issue (a partition affecting just that Sentinel) rather than the primary actually being down — acting unilaterally on that would trigger an unnecessary and disruptive failover. Requiring a configured quorum of independent Sentinels to agree ("objectively down," not just "subjectively down" from one Sentinel's view) filters out false positives caused by one Sentinel's localized network problems, and only then does a Sentinel get elected (leader election among Sentinels) to actually carry out the failover.

**Q: Can Sentinel-managed failover guarantee zero data loss?**
A: No — because replication to the failed-over-from primary was asynchronous, any writes accepted by the old primary but not yet replicated to the replica that gets promoted are lost. Sentinel restores write availability quickly, but doesn't retroactively recover unreplicated writes. Teams that need to bound this risk configure `min-replicas-to-write N` and `min-replicas-max-lag seconds`, which make the primary refuse new writes if it doesn't have at least N replicas connected within the allowed lag — trading some write availability for a tighter bound on potential data loss.

**Q: How should an application discover the current primary's address in a Sentinel-managed setup, and why not just hardcode it?**
A: Applications should query Sentinel itself (`SENTINEL get-master-addr-by-name <name>`) or use a Redis client library with built-in Sentinel support, which handles discovering the current primary and automatically reconnecting after a failover. Hardcoding the primary's address defeats the purpose of Sentinel — after a failover, the actual primary is a different host/port, and a client that only knows the old address will keep trying to write to what is now a stale replica (or a dead host), causing an outage that Sentinel was supposed to prevent.

## Related Topics

- [redis-cluster.md](./redis-cluster.md)
- [persistence.md](./persistence.md)
- [redis-overview.md](./redis-overview.md)
- [caching-patterns.md](./caching-patterns.md)
