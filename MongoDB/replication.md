# Replication

A MongoDB replica set is a group of `mongod` instances holding the same data set, providing both high availability and read scaling. One member is elected primary and accepts all writes; the rest are secondaries that continuously replicate the primary's writes by tailing the oplog (operations log) and applying the same operations in the same order to their own copies of the data. A typical production replica set has an odd number of members (commonly three) so that elections can always resolve to a majority without a tie.

The oplog is a special capped collection (`local.oplog.rs`) that records every write operation the primary performs, in order, and it's the single mechanism that makes replication work: secondaries continuously pull new entries from the primary's oplog and apply them locally, and a newly added or resyncing secondary can catch up by replaying oplog history from the point it fell behind. Because the oplog is capped at a configured size, it only retains a finite window of history — if a secondary falls behind for longer than that window, it can no longer catch up via normal replication and needs a full resync instead, which is why oplog sizing and monitoring replication lag both matter operationally.

If the primary becomes unreachable — a crash, a network partition, a planned maintenance step-down — the remaining members hold an election to choose a new primary. This uses a Raft-derived consensus protocol: a member calls for an election, other members vote, and a candidate needs votes from a majority of all voting members (not just the members currently reachable) to become primary. That majority requirement is exactly why replica sets are deployed with an odd number of members: it avoids ties and, more importantly, ensures at most one side of any network partition can ever reach a majority and elect a primary, which is what prevents "split-brain" (two primaries active at once).

Two client-facing knobs tune how replication trades off consistency versus performance: read preference controls which member(s) a client is allowed to read from (`primary` for the strongest consistency, `secondary`/`secondaryPreferred` to offload read traffic at the cost of possibly reading slightly stale data, `nearest` to minimize latency), and write concern controls how many members must acknowledge a write before the driver considers it successful (`w: 1` acknowledges as soon as the primary applies it — fast, but that write could theoretically be lost if the primary fails before replicating it; `w: "majority"` waits for acknowledgment from a majority of the replica set — slower, but durable against a single node failure, and required for a write to be guaranteed non-rollback-able after a primary election).

## Examples

```js
// Initiating a three-member replica set
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongo1:27017" },
    { _id: 1, host: "mongo2:27017" },
    { _id: 2, host: "mongo3:27017" }
  ]
});

rs.status();  // check current primary/secondary roles and health
```

```js
// Read preference — trade strict consistency for read scaling/latency
db.orders.find({ status: "paid" }).readPref("secondaryPreferred");
// primary            -> always read from primary (strongest consistency)
// secondary          -> always read from a secondary (may be stale)
// secondaryPreferred -> prefer secondary, fall back to primary if none available
// nearest            -> lowest network latency, regardless of role
```

```js
// Write concern — trade write latency for durability guarantees
db.orders.insertOne(
  { customerId: ObjectId(), total: 59.98 },
  { writeConcern: { w: "majority", wtimeout: 5000 } }
);
// w: 1          -> acknowledged once the primary applies it (fastest, least durable)
// w: "majority" -> acknowledged once a majority of the replica set applies it (durable)
```

## Common Pitfalls / Gotchas

- Reading from secondaries (`secondaryPreferred`/`secondary`) without accounting for replication lag — a secondary can lag behind the primary, so a read immediately after a write may not reflect that write yet.
- Deploying an even number of voting members, or too few members, which increases the chance of an election tie or makes it impossible to reach a majority during a partition — production replica sets are almost always an odd number (3, 5, 7).
- Using `w: 1` for writes that absolutely must survive a primary failure (financial transactions, critical state changes) — an acknowledged `w: 1` write can theoretically be rolled back if the primary crashes before replicating it to any secondary.
- Letting the oplog size be too small for the actual write volume — if a secondary falls behind by more than the oplog's retention window, it can't catch up incrementally and needs an expensive full resync.
- Assuming a replica set gives you multi-datacenter write availability automatically — a network partition that isolates the primary's datacenter without a voting majority there causes that datacenter to lose its primary until reachability (and majority) is restored.

## Interview Questions & Answers

**Q: How does a replica set elect a new primary?**
A: When the current primary becomes unreachable, remaining members hold an election using a Raft-derived consensus protocol. A candidate must receive votes from a majority of all voting members in the replica set configuration (not just currently reachable ones) to become primary, which is why replica sets are deployed with an odd number of members — it avoids ties and ensures at most one side of a network partition can ever reach a majority.

**Q: What is the oplog and why is its size important?**
A: The oplog is a capped collection on the primary that records every write operation in order; secondaries continuously replicate by tailing and applying oplog entries. Because it's capped, it only holds a finite window of history — if a secondary falls behind longer than that window, it can't catch up incrementally and needs a full resync, so oplog size has to be large enough to cover realistic replication lag or maintenance windows.

**Q: What's the difference between `w: 1` and `w: "majority"` write concern?**
A: `w: 1` acknowledges a write as soon as the primary has applied it in memory — fastest, but that write could theoretically be lost if the primary fails before replicating it to any secondary. `w: "majority"` waits for acknowledgment from a majority of replica set members before confirming the write, which is slower but guarantees the write survives a single-node failure and won't be rolled back after a subsequent election.

**Q: What are the different read preference modes and when would you use each?**
A: `primary` (default) reads only from the primary for the strongest consistency. `secondary`/`secondaryPreferred` route reads to secondaries to offload read traffic from the primary, at the cost of possibly reading slightly stale data due to replication lag. `nearest` picks whichever member has the lowest network latency regardless of role, useful when low latency matters more than which specific member serves the read.

**Q: Why does a replica set need an odd number of members?**
A: Elections require a majority of all voting members to succeed, and an odd count avoids the possibility of a tied vote. It also ensures that during a network partition, at most one side of the split can contain a majority of members — the other side simply can't elect a primary — which is the mechanism that prevents two primaries from existing simultaneously (split-brain).

## Related Topics
- [sharding.md](./sharding.md)
- [transactions.md](./transactions.md)
- [performance-tuning.md](./performance-tuning.md)
