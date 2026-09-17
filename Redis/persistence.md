# Persistence

Redis is an in-memory store, but "in-memory" doesn't have to mean "gone on restart." Redis offers two persistence mechanisms — RDB snapshotting and AOF (append-only file) logging — that write data to disk so it can be reloaded after a restart or crash, and they represent different points on the durability-versus-performance tradeoff curve.

RDB (Redis Database) persistence works by periodically forking the process and writing a compact, point-in-time binary snapshot of the entire dataset to disk (typically `dump.rdb`). Because the fork uses copy-on-write memory pages, the parent process keeps serving clients with minimal interruption while the child writes the snapshot. RDB is configured via `save` rules (e.g., "snapshot if at least 1 key changed in 900 seconds, or at least 10 keys changed in 300 seconds") or triggered manually with `SAVE` (blocking) or `BGSAVE` (non-blocking, forks a child). RDB's strength is that it produces small, fast-to-load files ideal for backups and fast restarts — its weakness is that any writes since the last snapshot are lost if the process crashes, so worst-case data loss is measured in minutes, not seconds.

AOF (Append-Only File) persistence takes the opposite approach: instead of periodic snapshots, Redis logs every write command to a file as it happens, and replays that log on startup to reconstruct the dataset. The `appendfsync` setting controls durability granularity: `always` (fsync every write — safest, slowest), `everysec` (fsync once per second — the default and generally recommended tradeoff, losing at most ~1 second of writes on a crash), or `no` (let the OS decide when to flush — fastest, least durable). Because the log grows forever with naive appending, Redis periodically rewrites it into a compact equivalent form via AOF rewrite (`BGREWRITEAOF`), which — like `BGSAVE` — forks a child process to do the work without blocking the main thread.

Modern Redis supports hybrid persistence: AOF rewrite can produce a file that starts with an RDB-format preamble (for fast bulk loading) followed by the incremental AOF commands since that snapshot, combining RDB's fast restart time with AOF's tighter durability window. In production, many teams run both RDB (for fast full backups/restore and disaster recovery portability) and AOF (for minimizing data loss window), accepting the extra disk I/O and disk space cost. The choice ultimately comes down to how much data loss is acceptable: RDB alone risks losing minutes of writes, AOF with `everysec` risks about a second, and AOF with `always` risks essentially nothing but at a real latency cost per write.

## Examples

```bash
# Trigger a non-blocking RDB snapshot and check when it last succeeded
127.0.0.1:6379> BGSAVE
Background saving started
127.0.0.1:6379> INFO persistence
# rdb_last_save_time, rdb_last_bgsave_status, aof_enabled, etc.
```

```bash
# Enable AOF at runtime and check its status
127.0.0.1:6379> CONFIG SET appendonly yes
OK
127.0.0.1:6379> CONFIG SET appendfsync everysec
OK
127.0.0.1:6379> CONFIG GET appendonly
1) "appendonly"
2) "yes"
```

```bash
# Trigger AOF rewrite to compact the log file
127.0.0.1:6379> BGREWRITEAOF
Background append only file rewriting started
127.0.0.1:6379> INFO persistence
# aof_rewrite_in_progress, aof_last_bgrewrite_status
```

## Common Pitfalls / Gotchas

- Assuming RDB snapshots alone give near-zero data loss — depending on the `save` schedule, a crash can lose everything written since the last snapshot, which could be many minutes of writes on a lightly configured instance.
- Running `SAVE` (the blocking variant) instead of `BGSAVE` on a live production instance — `SAVE` blocks all clients for the entire duration of the snapshot write, which can be seconds on a large dataset; `BGSAVE` forks and lets the parent keep serving.
- Not monitoring disk space for AOF growth — without periodic `BGREWRITEAOF` (which Redis can trigger automatically based on `auto-aof-rewrite-percentage`/`auto-aof-rewrite-min-size`), the append-only file can grow far larger than the dataset it represents.
- Choosing `appendfsync always` without understanding the latency cost — fsyncing on every single write command can significantly reduce throughput compared to `everysec`, and many teams over-provision durability they don't actually need.
- Forgetting that a `BGSAVE`/`BGREWRITEAOF` fork needs enough free memory to hold the copy-on-write pages — on a host with high write throughput and little memory headroom, the fork itself can cause memory spikes or even OOM.
- Treating persistence as a substitute for replication/backups — a corrupted or deleted RDB/AOF file on the only instance is still a total data loss event; persistence protects against process restarts and crashes, not disk failure or operator error, which is why off-host backups and replicas both still matter.

## Interview Questions & Answers

**Q: What's the fundamental tradeoff between RDB and AOF persistence?**
A: RDB takes periodic, compact, point-in-time snapshots — fast to save and fast to load, but any writes since the last snapshot are lost on a crash, so worst-case loss is measured in minutes depending on the `save` schedule. AOF logs every write command as it happens and replays them on restart, offering a much tighter durability window (as little as ~1 second of loss with `appendfsync everysec`, or virtually none with `always`), at the cost of a larger file on disk, slower restarts (replaying a command log is slower than loading a binary snapshot), and higher write-path overhead.

**Q: Why does `BGSAVE` fork a child process instead of writing the snapshot from the main thread?**
A: Forking lets the snapshot-writing work happen in a separate process while the parent (main Redis process) continues serving client requests without blocking. The fork relies on the OS's copy-on-write semantics for memory pages — the child initially shares the parent's memory pages and only copies a page when either process writes to it, so the fork itself is fast and memory overhead is proportional to how much data changes during the snapshot, not the full dataset size.

**Q: What does `appendfsync everysec` actually guarantee, and why is it the common default over `always`?**
A: It guarantees that, in the worst case, up to roughly one second of the most recent writes can be lost if the process crashes or the machine loses power, because the OS buffers writes and Redis fsyncs the AOF file once per second rather than after every single command. It's the common default because `always` (fsync every write) adds substantial latency to every write operation for a durability improvement (near-zero loss vs ~1 second) that most applications don't need to pay for, while `no` (let the OS decide) can lose much more data unpredictably.

**Q: How does hybrid AOF persistence (RDB preamble + AOF tail) improve on plain AOF?**
A: When Redis rewrites the AOF file (via `BGREWRITEAOF`), it can write the rewritten file with an RDB-format preamble representing the dataset at rewrite time, followed by AOF-format commands for writes that happened after that point. On restart, Redis loads the RDB preamble quickly (binary format, fast to parse) and then replays only the smaller trailing AOF segment, combining RDB's fast load time with AOF's tight durability window — rather than having to replay a potentially huge command log from scratch.

**Q: If an application can tolerate losing at most a few seconds of writes but needs fast restarts after a deploy, what persistence configuration would you recommend?**
A: Enable AOF with `appendfsync everysec` for the tight (~1 second) durability window, and let AOF rewrite use the hybrid RDB-preamble format (the default in modern Redis) so restarts load quickly instead of replaying a long command log from the start. Also keep RDB snapshotting configured on a reasonable schedule as an independent, portable backup artifact for disaster recovery, since RDB files are simpler to copy off-host and restore from than an AOF log.

## Related Topics

- [expiration-and-eviction.md](./expiration-and-eviction.md)
- [replication-and-sentinel.md](./replication-and-sentinel.md)
- [redis-overview.md](./redis-overview.md)
- [redis-cluster.md](./redis-cluster.md)
