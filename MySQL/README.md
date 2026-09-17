# MySQL Interview Prep

This folder is a personal knowledge base for studying and teaching core MySQL concepts, built for interview preparation and for explaining these topics to others. Each file covers one concept in depth — a real conceptual explanation of how it actually works, practical SQL examples you could run against a real schema, common pitfalls and gotchas, and interview-style Q&A — so you can both refresh your own understanding quickly and use the material to walk someone else through the same concept from scratch.

MySQL interviews tend to move from schema fundamentals, to querying and joins, to indexing and performance, to transactions and correctness, and finally to operational concerns like procedures and disaster recovery. This folder is organized to match that progression.

## Table of Contents

### Fundamentals & Schema Design
- [MySQL Overview](./mysql-overview.md) — relational model, InnoDB vs MyISAM, MySQL vs NoSQL
- [Tables and Schemas](./tables-and-schemas.md) — CREATE TABLE, data types, primary/foreign keys, ALTER TABLE
- [Normalization](./normalization.md) — 1NF/2NF/3NF worked example, denormalization tradeoffs

### Querying & Joins
- [SELECT Queries](./select-queries.md) — WHERE/ORDER BY/LIMIT/GROUP BY/HAVING, subqueries
- [Joins](./joins.md) — INNER/LEFT/RIGHT/FULL OUTER (and MySQL's UNION workaround)

### Indexing & Performance
- [Indexes](./indexes.md) — B-tree structure, primary vs secondary/composite indexes, covering indexes, EXPLAIN
- [Query Optimization](./query-optimization.md) — reading EXPLAIN, avoiding SELECT *, the N+1 query problem

### Transactions & ACID
- [Transactions and ACID](./transactions-and-acid.md) — BEGIN/COMMIT/ROLLBACK, the four ACID properties, isolation levels

### Operations: Procedures & Backup
- [Stored Procedures](./stored-procedures.md) — CREATE PROCEDURE, IN/OUT parameters, when to use vs application logic
- [Backup and Recovery](./backup-and-recovery.md) — mysqldump, binary logs and point-in-time recovery, replication

## Interview Questions & Answers — Curated

**1. What's the difference between InnoDB and MyISAM? (Beginner)**
InnoDB supports transactions, foreign keys, and row-level locking, and has been the default engine since MySQL 5.5. MyISAM has none of those — no transactions, no FK enforcement, table-level locking on writes — and survives mainly in legacy systems. See [mysql-overview.md](./mysql-overview.md).

**2. INNER JOIN vs LEFT JOIN, with an example. (Beginner)**
`INNER JOIN` returns only rows with a match on both sides — joining customers to orders this way drops any customer with zero orders. `LEFT JOIN` keeps every row from the left table, filling unmatched right-side columns with `NULL` — so a customer with no orders still appears once, with `order_id = NULL`. See [joins.md](./joins.md).

**3. Does MySQL support FULL OUTER JOIN? (Intermediate)**
Not natively. The standard workaround is `UNION`-ing two `LEFT JOIN`s — one joining A to B, one joining B to A — which together produce every matched pair plus every unmatched row from both sides. See [joins.md](./joins.md).

**4. What's the difference between WHERE and HAVING? (Beginner)**
`WHERE` filters individual rows before grouping and can't reference aggregates. `HAVING` filters groups after `GROUP BY`, specifically for aggregate conditions like `HAVING COUNT(*) > 5`. See [select-queries.md](./select-queries.md).

**5. 1NF vs 2NF vs 3NF — explain with an example. (Intermediate)**
1NF: atomic column values, no repeating groups. 2NF: every non-key column depends on the *whole* composite primary key, not part of it. 3NF: non-key columns depend on nothing but the primary key — no transitive dependencies (e.g., `customer_city` derivable from `customer_zip` belongs in a separate `customers` table). See [normalization.md](./normalization.md).

**6. What data structure backs a MySQL index, and how does it speed up a query? (Intermediate)**
A B-tree (B+tree) — a balanced, sorted tree where every leaf sits at the same depth, so lookups and range scans take a small, bounded number of page reads regardless of table size, turning an O(n) full scan into roughly O(log n). See [indexes.md](./indexes.md).

**7. What's the difference between a clustered index and a secondary index in InnoDB? (Intermediate)**
The primary key is the clustered index — its B-tree leaves *are* the row data, stored in primary-key order. A secondary index's leaves store the indexed column(s) plus the primary key, so a lookup through it needs an extra step back into the clustered index for any column not in the secondary index itself. See [indexes.md](./indexes.md) and [mysql-overview.md](./mysql-overview.md).

**8. What is the leftmost-prefix rule for composite indexes? (Intermediate)**
A composite index `(A, B, C)` is sorted by A, then B within A, then C within (A, B). It can serve queries filtering on A, or A+B, or A+B+C, but generally not on B or C alone without A. See [indexes.md](./indexes.md).

**9. What is a covering index? (Intermediate/Advanced)**
An index that includes every column a query needs, so MySQL can answer the query from the index's B-tree alone without touching the underlying table row — shown as "Using index" in `EXPLAIN`. See [indexes.md](./indexes.md).

**10. Explain the four ACID properties with concrete examples. (Intermediate)**
Atomicity — a funds transfer's debit and credit both happen or neither does. Consistency — a transaction can never leave constraints violated. Isolation — concurrent transactions don't see each other's uncommitted changes (how strictly depends on isolation level). Durability — once COMMIT returns, the change survives a crash, via InnoDB's write-ahead redo log. See [transactions-and-acid.md](./transactions-and-acid.md).

**11. Dirty read vs non-repeatable read vs phantom read. (Advanced)**
Dirty read: seeing another transaction's uncommitted change. Non-repeatable read: re-reading the same row twice and getting a different value because another transaction committed a change in between. Phantom read: re-running the same range query twice and getting a different *set* of rows because rows were inserted/deleted in between. See [transactions-and-acid.md](./transactions-and-acid.md).

**12. What isolation level does MySQL use by default, and what does it guarantee? (Advanced)**
`REPEATABLE READ`. It prevents dirty reads and non-repeatable reads, and InnoDB's specific implementation also prevents most phantom reads via gap locking — stronger than the SQL standard's minimum for that level. See [transactions-and-acid.md](./transactions-and-acid.md).

**13. Why is `SELECT *` considered bad practice? (Beginner/Intermediate)**
It pulls unneeded columns (wasting bandwidth), defeats covering indexes since the index rarely includes every column, and is fragile to future schema changes. See [query-optimization.md](./query-optimization.md).

**14. What is the N+1 query problem, and how do you fix it? (Intermediate/Advanced)**
Fetching N parent rows with one query, then issuing a separate query per row for related data — N+1 total queries instead of a small constant number. Fix by batching with a single `JOIN` or a `WHERE id IN (...)` query. See [query-optimization.md](./query-optimization.md).

**15. How would you diagnose a slow query? (Intermediate/Advanced)**
Start with `EXPLAIN` (or `EXPLAIN ANALYZE`) to see the actual access plan — access type, chosen index, estimated/actual rows, and `Extra` flags like "Using filesort" or "Using temporary" that signal expensive extra work. See [query-optimization.md](./query-optimization.md) and [indexes.md](./indexes.md).

**16. When would you use a stored procedure instead of application-layer logic? (Intermediate/Advanced)**
When minimizing round trips matters for a performance-critical, tightly-scoped operation, or when multiple independent services need a guaranteed-identical implementation of a multi-step operation. Most general business logic is better kept in the application layer for testability and portability. See [stored-procedures.md](./stored-procedures.md).

**17. How do you recover data after an accidental DELETE without a WHERE clause, a few hours after the last backup? (Advanced)**
Restore the last full backup, then use `mysqlbinlog` to replay binary log events from that backup's position up to just before the destructive statement — point-in-time recovery. This replays every legitimate write since the backup while excluding the bad one. See [backup-and-recovery.md](./backup-and-recovery.md).

**18. What's the difference between backup/PITR and replication as recovery strategies? (Advanced)**
Backups plus binary logs let you reconstruct state as of any point in time, which is what you need after data corruption — you deliberately don't replay the bad statement. Replication keeps a live replica in sync for fast failover if the primary server fails, but a replica faithfully applies every write, including bad ones, so it doesn't protect against corruption the way PITR does. Both are typically used together. See [backup-and-recovery.md](./backup-and-recovery.md).

**19. Why should you use DECIMAL instead of FLOAT for money? (Beginner)**
`FLOAT`/`DOUBLE` are binary floating point and can't exactly represent many decimal fractions, so arithmetic accumulates rounding errors. `DECIMAL(p,s)` stores an exact fixed-point value, so currency totals reconcile exactly. See [tables-and-schemas.md](./tables-and-schemas.md).

**20. What does a foreign key constraint enforce, and what's the difference between ON DELETE CASCADE and RESTRICT? (Beginner/Intermediate)**
It ensures a column's value matches an existing row in the referenced table (or is NULL, if allowed). `RESTRICT` blocks deleting a parent row while children still reference it; `CASCADE` automatically deletes those children too. See [tables-and-schemas.md](./tables-and-schemas.md).

## How to Use This Folder

Work through the sections in order: **Fundamentals & Schema Design** first, since every other topic assumes you understand tables, types, and normalization. **Querying & Joins** next — this is the material interviewers probe most in live coding rounds. **Indexing & Performance** after that, since it depends on understanding how queries and joins actually execute. **Transactions & ACID** stands mostly on its own but is easiest to appreciate once you've seen real multi-statement queries. **Operations: Procedures & Backup** last — it's the most senior/operational material and builds on everything before it.

For interview prep specifically: skim each file's own "Interview Questions & Answers" section for a focused per-topic review, then use the "Curated" list above as a cross-cutting mock-interview pass once the individual topics feel solid. Try writing and running each SQL example against a local MySQL instance rather than just reading it — the syntax sticks far better once you've seen the actual result set.
</content>
