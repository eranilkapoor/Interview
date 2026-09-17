# Amazon Aurora

Aurora is AWS's proprietary, cloud-native relational database engine — MySQL-compatible and PostgreSQL-compatible editions exist, but "compatible" is the key word: Aurora is not vanilla RDS MySQL or RDS PostgreSQL running on different hardware, it's a re-engineered engine that speaks the same wire protocol and SQL dialect while replacing the storage and replication layers entirely. This distinction is exactly what interviewers are testing when they ask "what's the difference between RDS and Aurora" — RDS for MySQL/PostgreSQL uses each engine's native storage and replication; Aurora replaces that layer with AWS's own distributed storage system.

The architectural core of Aurora is decoupling compute from storage. The storage layer is a distributed, log-structured system that automatically grows up to 128 TB per database without any manual provisioning, and every write is automatically replicated six ways across three Availability Zones — the storage layer itself handles this replication, not the database engine, and Aurora only needs 4 of 6 storage copies to acknowledge a write and 3 of 6 to read, so it tolerates losing an entire AZ (two copies) without any availability impact and can even lose an additional copy during an AZ outage while still serving reads. This is fundamentally different from standard RDS Multi-AZ, where the *engine* replicates synchronously to one standby.

Because storage is decoupled, Aurora Replicas (up to 15 of them) all read from the same underlying distributed storage volume rather than replaying a stream of changes into their own separate storage — this is why Aurora replica lag is typically single-digit milliseconds, dramatically lower than the seconds-to-minutes lag you can see on standard RDS read replicas doing real logical/physical replication. Aurora Replicas also participate in automatic failover with configurable priority tiers, and failover typically completes in around 30 seconds or less — faster than standard RDS Multi-AZ failover — because promoting a replica doesn't require re-establishing a replication stream; it's already reading the same storage the writer was using.

Aurora Serverless v2 lets compute capacity scale automatically based on load, measured in Aurora Capacity Units (ACUs), scaling up and down in fine-grained increments within seconds — useful for variable or unpredictable workloads (dev/test environments, infrequently used applications, multi-tenant SaaS where per-tenant load varies wildly) where provisioning for peak capacity around the clock would be wasteful. Aurora Global Database extends this architecture across regions: a primary region handles writes, and up to five secondary regions receive replicated data with typically under one second of lag, using dedicated, purpose-built replication infrastructure that's physically separate from the storage volume serving user reads — so cross-region replication doesn't compete with local read/write I/O the way naive cross-region read replicas would. Global Database is designed for global read locality and disaster recovery with a low RPO, with managed planned/unplanned failover across regions.

## Examples

```bash
# Create an Aurora PostgreSQL cluster (the cluster owns storage; instances attach to it)
aws rds create-db-cluster \
  --db-cluster-identifier orders-aurora-cluster \
  --engine aurora-postgresql \
  --engine-version 15.4 \
  --master-username admin \
  --master-user-password "$DB_PASSWORD" \
  --vpc-security-group-ids sg-0123456789abcdef0

aws rds create-db-instance \
  --db-instance-identifier orders-aurora-writer \
  --db-cluster-identifier orders-aurora-cluster \
  --engine aurora-postgresql \
  --db-instance-class db.r6g.large
```
Note the two-step model: the cluster is the storage/replication unit, and one or more instances (writer + readers) attach to it — this is structurally different from RDS, where the instance and its storage are one unit.

```bash
# Add a low-latency read replica and set failover priority
aws rds create-db-instance \
  --db-instance-identifier orders-aurora-reader-1 \
  --db-cluster-identifier orders-aurora-cluster \
  --engine aurora-postgresql \
  --db-instance-class db.r6g.large \
  --promotion-tier 1
```
`--promotion-tier 1` gives this replica the highest priority to be promoted first if the writer fails — Aurora's failover mechanism uses this to pick a deterministic successor rather than an arbitrary one.

```json
// CloudFormation: Aurora Serverless v2 scaling configuration on the cluster
{
  "Type": "AWS::RDS::DBCluster",
  "Properties": {
    "Engine": "aurora-mysql",
    "EngineMode": "provisioned",
    "ServerlessV2ScalingConfiguration": {
      "MinCapacity": 0.5,
      "MaxCapacity": 8
    }
  }
}
```
The cluster scales compute between 0.5 and 8 ACUs automatically based on load within seconds — appropriate for a workload with unpredictable bursts where paying for constant peak capacity would be wasteful.

## Common Pitfalls / Gotchas

- Assuming Aurora Replicas replicate the same way standard RDS read replicas do — they don't do independent logical replication; they share the same distributed storage volume as the writer, which is precisely why their lag is so much lower. Explaining Aurora replication as "just RDS replication but faster" misses the actual architecture.
- Treating Aurora Global Database's secondary-region replication as suitable for local writes — secondary regions are read-only until a (managed, but not instantaneous) failover promotes one to primary; it's not a multi-writer, multi-region setup.
- Not realizing storage costs and I/O are billed somewhat differently from standard RDS — Aurora bills for storage consumed and I/O operations, which under I/O-heavy workloads can shift the cost profile compared to RDS's simpler provisioned-storage model (mitigated by Aurora I/O-Optimized configurations, but still worth explicitly checking).
- Setting Aurora Serverless v2's `MinCapacity` too low for a production workload with any sustained baseline traffic — scaling from a very low floor still takes some time to ramp, and a workload with a real baseline should set a `MinCapacity` that reflects it rather than 0.5 ACU.
- Assuming a promoted Aurora Replica or Global Database secondary is instantly consistent with the old writer — while replication lag is typically very low, it is not zero; a failover can still lose the last few milliseconds of unreplicated writes, so applications with zero-data-loss requirements still need to design for that possibility.
- Forgetting that some MySQL/PostgreSQL extensions, storage engines, or engine-specific features aren't supported in Aurora precisely because the storage layer is custom — "compatible" doesn't mean "identical," and a migration from self-managed MySQL/PostgreSQL should be validated against Aurora's specific compatibility notes.

## Interview Questions & Answers

**Q: What's fundamentally different about Aurora's architecture compared to standard RDS for MySQL/PostgreSQL?**
A: RDS uses each engine's native storage and replication mechanisms — a Multi-AZ standby is synchronously replicated at the engine level, and read replicas use logical/physical replication streams. Aurora replaces the storage layer entirely with a distributed, log-structured storage system that auto-scales to 128 TB and replicates every write six ways across three AZs at the storage layer itself. Compute (the database engine instances) is decoupled from this storage, which is why Aurora Replicas share the same storage as the writer instead of maintaining their own copies.

**Q: Why is Aurora Replica lag so much lower than standard RDS read replica lag?**
A: Because Aurora Replicas don't replicate data into their own separate storage the way RDS read replicas do — they read directly from the same distributed storage volume the writer uses. There's no need to ship and replay a full logical or physical replication stream to a separate copy; replicas mainly need to stay current on which storage segments have been updated, which is why lag is typically single-digit milliseconds versus RDS replicas which can lag by seconds or more under load.

**Q: How does Aurora tolerate losing an Availability Zone without downtime?**
A: Every write is replicated to 6 storage copies across 3 AZs (2 copies per AZ). Aurora only requires 4 of 6 copies to acknowledge a write and 3 of 6 to satisfy a read, so it can lose an entire AZ (2 copies) and continue accepting both writes and reads without interruption, and can even tolerate losing one additional copy during an AZ outage while maintaining read availability.

**Q: When would you choose Aurora Serverless v2 over a fixed-size provisioned Aurora cluster?**
A: When load is unpredictable, spiky, or has long idle periods — dev/test environments, infrequently accessed applications, or multi-tenant systems where individual tenant load varies significantly. Serverless v2 scales compute (in ACUs) up and down automatically within seconds based on demand, avoiding the cost of provisioning for peak capacity continuously. For a workload with a large, steady, predictable baseline, a fixed provisioned instance is usually more cost-efficient since Serverless v2 carries a premium per ACU versus equivalent reserved provisioned capacity.

**Q: How does Aurora Global Database achieve sub-second cross-region replication without impacting the primary region's performance?**
A: It uses dedicated, purpose-built replication infrastructure that is physically separate from the storage volume serving local reads/writes, so cross-region log shipping doesn't compete for I/O with the primary region's own storage operations. This gets typical replication lag under one second across regions, and enables a managed failover or switchover to a secondary region for disaster recovery with a low RPO.

## Related Topics
- [rds.md](./rds.md)
- [dynamodb.md](./dynamodb.md)
- [redshift.md](./redshift.md)
- [elasticache.md](./elasticache.md)
- [fault-isolation.md](./fault-isolation.md)
- [cloudwatch.md](./cloudwatch.md)
