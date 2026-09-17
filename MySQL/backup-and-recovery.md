# Backup and Recovery

`mysqldump` is the standard, built-in tool for logical backups: it connects to a running MySQL server and produces a plain-text file of SQL statements (`CREATE TABLE`, `INSERT`) that, when replayed against an empty database, reconstructs the data exactly. Its biggest advantages are simplicity, portability across MySQL versions and even engines, and human-readability of the output — you can diff, grep, or manually edit a dump if needed. Its biggest limitation is that a straightforward dump of an InnoDB database is either inconsistent (if taken while writes are happening, different tables can reflect different points in time) or requires locking (blocking writes for the duration), unless you use `--single-transaction`, which opens one long-running transaction under InnoDB's MVCC snapshot isolation so the entire dump reflects one consistent point in time without blocking other connections. For large databases, `mysqldump` is also comparatively slow to restore, since restoring means re-executing every `INSERT` and rebuilding every index from scratch — physical backup tools (like Percona XtraBackup, which copies InnoDB's actual data files) exist specifically to restore faster at scale, though `mysqldump` remains the standard answer for small-to-medium databases and for interview purposes.

A full backup alone only gets you back to the moment it was taken — everything written after that point is lost unless you also have **binary logs**. MySQL's binary log (`binlog`) records every statement (or, in row-based format, every row change) that modifies data, in order, as it happens — its original purpose is replication (see below), but it doubles as the mechanism for **point-in-time recovery (PITR)**: restore the most recent full backup, then replay binary log events from the exact moment the backup was taken up to the exact moment just before whatever incident you're recovering from (a bad deploy, an accidental `DELETE` without a `WHERE` clause), using `mysqlbinlog` to extract and replay the relevant range of events. This is the concrete answer to "how do you recover from an accidental data-destroying query three hours after a backup" — you don't lose those three hours of legitimate writes, you replay all of them except the bad one.

**Replication** — one or more replica servers continuously applying the primary's binary log to keep their own copy of the data in sync — solves a different but related problem: not "how do I recover data I already lost" but "how do I avoid losing access to my data (or the server) at all." A replica provides disaster recovery (if the primary server or its entire host/AZ fails, a replica can be promoted to become the new primary with comparatively little data loss, versus restoring a backup from scratch) and, as a side benefit, lets you offload read traffic to replicas so the primary isn't the sole source for every query. Traditional MySQL replication is asynchronous by default (the primary doesn't wait for a replica to confirm before considering a transaction committed, so a replica can lag slightly behind, and a failover can lose the most recent unreplicated writes), though semi-synchronous and fully synchronous (Group Replication / InnoDB Cluster) configurations exist for workloads that can't tolerate that gap. Backups, binary logs, and replication aren't competing solutions — a real production setup typically layers all three: periodic full backups as the base, continuous binary logging for point-in-time recovery within the backup interval, and replication for high availability and failover, each covering a different failure scenario.

## Examples

```bash
# A consistent logical backup of a whole database using mysqldump,
# safe to run against a live InnoDB database without blocking writers
mysqldump --single-transaction --routines --triggers \
  -u backup_user -p myapp_production > myapp_production_2026-09-17.sql

# Restoring that backup into a fresh database
mysql -u root -p myapp_production < myapp_production_2026-09-17.sql
```

```sql
-- Enabling and inspecting binary logging (typically set in my.cnf, shown here at runtime)
SHOW VARIABLES LIKE 'log_bin';
SHOW BINARY LOGS;
SHOW MASTER STATUS;  -- current binlog file + position, the PITR starting point
```

```bash
# Point-in-time recovery: restore last full backup, then replay the binlog
# from that backup's position up to just before a bad statement at 14:32:07
mysql -u root -p myapp_production < myapp_production_2026-09-17.sql

mysqlbinlog --start-position=154 --stop-datetime="2026-09-17 14:32:00" \
  /var/lib/mysql/binlog.000042 | mysql -u root -p myapp_production
# Replays every real write between the backup and just before the incident,
# deliberately excluding the destructive statement itself
```

## Common Pitfalls / Gotchas

- Running `mysqldump` without `--single-transaction` against a live InnoDB database under write load — the dump can end up inconsistent across tables, reflecting different moments in time for each one.
- Treating a full backup as sufficient recovery on its own — without binary logs enabled, you can only ever restore to the moment of the last backup, losing everything written since.
- Never testing a restore — a backup that has never actually been restored successfully is an untested assumption, not a real disaster recovery plan; restores can fail for reasons a backup job alone won't surface (corrupted file, missing privileges, incompatible version).
- Confusing replication with backup — a replica continuously applies every change the primary makes, including an accidental destructive statement; replication protects against *server* loss, not against *bad data* being faithfully copied everywhere just as fast as it was written.
- Not monitoring replication lag — if a replica is meaningfully behind and the primary fails, failing over to that replica can silently lose more recent committed writes than expected.

## Interview Questions & Answers

**Q: What does `mysqldump --single-transaction` do, and why does it matter for InnoDB?**
A: It wraps the entire dump in one long-running transaction, relying on InnoDB's MVCC to give that transaction a consistent snapshot of the data as of the moment it started — every table in the dump reflects that same point in time, and other connections can keep reading and writing normally throughout, without being blocked. Without it, a dump taken while writes are happening can end up with different tables reflecting different moments, producing an internally inconsistent backup.

**Q: How would you recover data after an accidental `DELETE` without a `WHERE` clause ran a few hours after the last backup?**
A: Restore the most recent full backup, then use `mysqlbinlog` to extract and replay binary log events starting from that backup's exact binlog position, up to just *before* the timestamp of the destructive `DELETE` — this is point-in-time recovery. It replays every legitimate write made in the hours since the backup while deliberately excluding the bad statement, so you don't lose that window of otherwise-valid data.

**Q: What's the difference between backup/PITR and replication as disaster recovery strategies?**
A: A backup plus binary logs lets you reconstruct the database's state as of any point in time, which is what you need after data corruption or an accidental destructive statement — you deliberately choose *not* to replay the bad part. Replication keeps a live, continuously-updated replica in sync with the primary, which is what you need if the primary server itself becomes unavailable — you fail over to the replica quickly, but a replica faithfully applies every write the primary made, bad statements included, so it doesn't protect against data corruption the way PITR does. Production systems typically use both, since they cover different failure modes.

**Q: Is MySQL's default replication synchronous or asynchronous, and what does that imply for failover?**
A: Asynchronous by default — the primary commits a transaction and returns success to the client without waiting for any replica to confirm it has received or applied that change. That means a replica can lag behind, and if the primary fails at exactly the wrong moment, whatever writes hadn't yet reached the replica are lost on failover. Semi-synchronous replication (the primary waits for at least one replica to acknowledge receipt before committing) or fully synchronous options like Group Replication reduce or eliminate that gap, at some cost to write latency/throughput.

**Q: Why might you use a tool like Percona XtraBackup instead of `mysqldump` for a very large database?**
A: `mysqldump` is a logical backup — restoring it means re-running every `INSERT` and rebuilding every index from scratch, which gets slow as data grows into the tens or hundreds of gigabytes and beyond. XtraBackup performs a physical, near-hot copy of InnoDB's actual data files, which is both faster to take and dramatically faster to restore at scale, since it skips re-executing SQL and rebuilding indexes entirely — the tradeoff is it's more MySQL/InnoDB-specific and less human-readable than a SQL dump.

## Related Topics
- [transactions-and-acid.md](./transactions-and-acid.md)
- [mysql-overview.md](./mysql-overview.md)
- [tables-and-schemas.md](./tables-and-schemas.md)
</content>
