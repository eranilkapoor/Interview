# Amazon RDS

RDS is AWS's managed relational database service — it runs a real, unmodified (or lightly patched) database engine of your choice — MySQL, PostgreSQL, MariaDB, Oracle, or SQL Server — while AWS takes over the operational burden: provisioning, OS/engine patching, automated backups, and failover orchestration. Unlike Aurora (see [aurora-db.md](./aurora-db.md)), RDS engines use conventional, engine-native storage and replication — there's no AWS-proprietary distributed storage layer underneath, which is exactly why Aurora exists as a separate, faster option for MySQL/PostgreSQL workloads that outgrow standard RDS.

High availability in RDS is delivered through Multi-AZ deployments: a synchronous standby replica is maintained in a different Availability Zone, and RDS automatically fails over to it (updating the DB's DNS endpoint to point at the new primary) if the primary becomes unhealthy or during planned maintenance. The important nuance interviewers probe is that classic Multi-AZ is purely for availability, not read scaling — the standby is not accessible for reads in the traditional single-standby Multi-AZ model, it exists solely as a synchronously-replicated failover target. (Some engines now support "Multi-AZ with two readable standbys," a newer deployment option that does allow reading from the standbys — but the original, more commonly tested Multi-AZ model does not.)

Read scaling instead comes from Read Replicas: asynchronously replicated copies of the primary, which can serve read traffic to offload it from the primary, can be created cross-region for geographic read locality or DR, and can be promoted to a fully independent, standalone writable database if needed. Because replication is asynchronous, read replicas can lag behind the primary by a variable amount under heavy write load — an important consistency caveat versus Multi-AZ's synchronous standby.

Backups come in two forms: automated backups, which support point-in-time recovery to any second within the configured retention window (via a daily snapshot plus continuous transaction log capture, taken during a configurable backup window), and manual snapshots, which persist indefinitely until explicitly deleted, independent of the retention window setting — useful for a "before this migration" checkpoint you want to keep regardless of the automated retention policy. Configuration is managed through parameter groups (engine-level settings like `max_connections` or `innodb_buffer_pool_size`) and option groups (engine-specific add-on features, e.g., Oracle Transparent Data Encryption or SQL Server Native Backup) — both are applied at the DB instance level and some parameter changes require a reboot to take effect.

## Examples

```bash
# Create a Multi-AZ PostgreSQL instance with automated backups and encryption at rest
aws rds create-db-instance \
  --db-instance-identifier orders-db-prod \
  --engine postgres \
  --engine-version 16.3 \
  --db-instance-class db.r6g.xlarge \
  --allocated-storage 200 \
  --multi-az \
  --master-username admin \
  --master-user-password "$DB_PASSWORD" \
  --backup-retention-period 7 \
  --storage-encrypted \
  --vpc-security-group-ids sg-0123456789abcdef0
```
`--multi-az` provisions a synchronous standby in another AZ for automatic failover; `--backup-retention-period 7` enables 7 days of point-in-time recovery.

```bash
# Create a cross-region read replica to offload reporting queries and serve as a DR base
aws rds create-db-instance-read-replica \
  --db-instance-identifier orders-db-reporting-replica \
  --source-db-instance-identifier arn:aws:rds:us-east-1:111122223333:db:orders-db-prod \
  --db-instance-class db.r6g.large \
  --region us-west-2
```
Cross-region replicas serve read-only reporting/analytics traffic without touching the primary's capacity, and can be promoted to a standalone database during a regional failover.

```bash
# Restore a database to a specific point in time (e.g., minutes before a bad deploy corrupted data)
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier orders-db-prod \
  --target-db-instance-identifier orders-db-prod-restored \
  --restore-time "2026-09-15T14:32:00Z"
```
Point-in-time recovery creates a brand-new instance restored to the given second, using the automated backup's base snapshot plus replayed transaction logs — the original instance is left untouched, so you can validate the restore before cutting over.

## Common Pitfalls / Gotchas

- Assuming the Multi-AZ standby can serve read traffic — in the classic single-standby Multi-AZ model it cannot; it exists purely as a synchronous failover target. Read scaling requires separate Read Replicas.
- Not accounting for read replica lag — under heavy write load, asynchronous replication can fall meaningfully behind, so routing read-after-write-sensitive queries to a replica can return stale data.
- Forgetting that some parameter group changes are "pending reboot" — they don't take effect until the instance restarts, and a static parameter change applied without realizing that can silently do nothing until the next maintenance window reboot.
- Underestimating storage autoscaling/IOPS costs on provisioned-IOPS storage — throughput requirements that look fine at low traffic can become the dominant cost line as an application scales, well before compute becomes the bottleneck.
- Confusing backup retention period with snapshot lifetime — automated backups (and their point-in-time recovery window) are deleted when the retention period rolls past or the instance is deleted (unless you take a final snapshot), while manual snapshots persist indefinitely and independently until you explicitly delete them.
- Running a Multi-AZ failover test without validating application-level retry/reconnect logic — failover changes which physical host the DNS endpoint resolves to, and connections held open by an application that doesn't handle a dropped connection gracefully can hang rather than reconnect.

## Interview Questions & Answers

**Q: What's the actual difference between Multi-AZ and a Read Replica in RDS?**
A: Multi-AZ maintains a synchronous standby in a different AZ purely for high availability — RDS automatically fails over to it if the primary fails, and in the classic model the standby isn't queryable for reads. A Read Replica is an asynchronously replicated, independently readable copy used for scaling read traffic or cross-region DR, and it can be manually promoted to a standalone writable instance. They solve different problems — availability versus read scalability — and are often used together.

**Q: Why might a report running against a read replica show data that doesn't match the primary?**
A: Read replicas use asynchronous replication, so under sufficient write load or network latency the replica can lag behind the primary by anywhere from milliseconds to (in extreme cases) minutes. Any query sensitive to very recent writes should hit the primary directly, or the application needs to tolerate eventual consistency on replica reads.

**Q: How does point-in-time recovery actually work under the hood?**
A: RDS takes a daily automated snapshot and continuously streams transaction logs to S3 during the backup window. To restore to a specific second, RDS starts from the most recent snapshot before that time and replays the transaction log forward to the exact requested timestamp, materializing the result as a brand-new DB instance — the source instance is never modified in place.

**Q: What's the difference between a parameter group and an option group?**
A: A parameter group configures engine-level runtime settings (e.g., `max_connections`, buffer pool size, timeouts) — analogous to my.cnf/postgresql.conf settings. An option group enables and configures engine-specific bolt-on features that aren't plain configuration values, like Oracle TDE or SQL Server Native Backup/Restore. Both are attached to a DB instance, and changes to either may require a reboot depending on whether the specific setting is dynamic or static.

**Q: A team wants zero read-scaling limits and faster failover than RDS Multi-AZ typically offers for a MySQL workload — what would you suggest, and why?**
A: Aurora MySQL — it decouples storage from compute with a distributed, auto-scaling storage layer replicated six ways across three AZs, supports up to 15 low-latency (typically single-digit-millisecond replication lag) Aurora Replicas versus RDS's smaller practical replica count and higher replication lag, and generally fails over in around 30 seconds or less, faster than standard RDS Multi-AZ failover. See [aurora-db.md](./aurora-db.md) for the full comparison.

## Related Topics
- [aurora-db.md](./aurora-db.md)
- [dynamodb.md](./dynamodb.md)
- [redshift.md](./redshift.md)
- [elasticache.md](./elasticache.md)
- [cloudwatch.md](./cloudwatch.md)
- [data-encryption.md](./data-encryption.md)
