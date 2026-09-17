# MySQL Overview

MySQL is an open-source relational database management system (RDBMS) built around the relational model: data lives in tables (relations) made of rows and typed columns, tables relate to each other through foreign keys, and you query and manipulate that data declaratively with SQL rather than by writing procedural access code. The server itself is a client-server system — a `mysqld` process that accepts connections over TCP (default port 3306) or a Unix socket, parses and optimizes incoming SQL, and delegates actual row storage and retrieval to a pluggable **storage engine**. That separation between the SQL layer (parser, optimizer, query cache historically, replication) and the storage layer is the single most important architectural fact about MySQL, because it explains almost every "why does MySQL behave this way" interview question.

The default and now near-universal storage engine is **InnoDB**. InnoDB is a transactional engine: it supports `BEGIN`/`COMMIT`/`ROLLBACK`, enforces foreign key constraints, implements row-level locking (not table-level), and organizes every table as a **clustered index** on the primary key — meaning the table's rows are physically stored in primary-key order, and the primary key is "free" to look up by while every secondary index stores the primary key as a pointer back to the row. InnoDB also provides crash recovery through a write-ahead redo log, and MVCC (multi-version concurrency control) so readers don't block writers. The older **MyISAM** engine predates InnoDB and is largely legacy today: it has no transactions, no foreign keys, and locks at the table level on writes, but it's simpler and was historically faster for read-heavy, write-rarely workloads and full-text search before InnoDB gained full-text support. In a modern interview, "when would you use MyISAM" has basically one honest answer: almost never for new work — InnoDB is the default in MySQL 5.5+ for good reason, and MyISAM shows up mostly in legacy systems or very specific append-only/archival use cases.

Choosing MySQL (or a relational database generally) versus a NoSQL alternative like DynamoDB, MongoDB, or Redis comes down to what your data and access patterns actually look like. MySQL is the right tool when your data has real structure and relationships you need to query flexibly and consistently — orders that belong to customers that have addresses, inventory that needs to reconcile exactly, financial ledgers where a transaction must touch multiple rows atomically or not at all. Its ACID transactions and foreign key constraints give you strong correctness guarantees essentially for free. NoSQL stores tend to win when you need to scale writes horizontally across many commodity nodes beyond what a single primary can handle, when your access pattern is simple key-based lookups at very high throughput (a session store, a cache, an event stream), or when your schema is genuinely variable/document-shaped and forcing it into normalized tables would fight the data rather than model it. In practice, many production systems use both: MySQL as the system of record for transactional, relational data, and a NoSQL store alongside it for caching, session state, or high-volume denormalized read paths — the two aren't strictly competitors, they solve different problems well.

## Examples

```sql
-- Check which storage engine a table uses
SHOW TABLE STATUS LIKE 'orders'\G

-- Check (or set) the default storage engine for new tables
SHOW VARIABLES LIKE 'default_storage_engine';

-- Explicitly create a table with InnoDB (the default since MySQL 5.5)
CREATE TABLE orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  total_cents INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
```

```sql
-- Connect from the command line and check server/version info,
-- the kind of environment-orientation question interviewers ask first
mysql -u app_user -p -h db.internal.example.com -P 3306 myapp_production

SELECT VERSION();
SHOW DATABASES;
```

## Common Pitfalls / Gotchas

- Assuming every table in a database uses the same engine — engine is set per table (`ENGINE=InnoDB`), so a legacy schema can have a mix, and MyISAM tables silently lack the transactional/FK guarantees engineers expect.
- Forgetting that InnoDB tables are clustered on the primary key — a poorly chosen primary key (e.g., a random UUID) causes expensive page splits and fragmentation under write load, unlike an auto-incrementing integer which appends in order.
- Treating MySQL as infinitely horizontally scalable for writes — a single MySQL primary has a ceiling; scaling writes further requires sharding, a different engine, or a distributed variant (e.g., Aurora, Vitess), which is a real architectural decision, not a config flag.
- Reaching for NoSQL "because it's faster" without checking whether the real bottleneck is missing indexes or bad query patterns in MySQL — a well-indexed MySQL table can comfortably handle far more read/write throughput than people assume.

## Interview Questions & Answers

**Q: What's the difference between InnoDB and MyISAM, and why does InnoDB win by default today?**
A: InnoDB supports transactions (BEGIN/COMMIT/ROLLBACK), enforces foreign keys, uses row-level locking, and provides crash recovery via a redo log. MyISAM has none of those — it has no transactions or FK enforcement, and it locks at the table level for writes, which serializes concurrent writers. InnoDB has been the default engine since MySQL 5.5 because almost every real application benefits from transactional integrity and better write concurrency; MyISAM mainly survives in legacy systems.

**Q: What does it mean that InnoDB tables are "clustered" on the primary key?**
A: The table's rows are physically stored on disk in primary-key order, as leaves of a B-tree keyed by the primary key. That makes primary-key lookups and range scans very fast since the row data is right there in the index. Every secondary index, by contrast, stores the indexed column(s) plus the primary key value, and a lookup through a secondary index does an extra step ("bookmark lookup") back into the clustered index to fetch the full row.

**Q: When would you choose MySQL over a NoSQL database like DynamoDB or MongoDB for a new project?**
A: When the data is genuinely relational — multiple entities that reference each other and need to be queried together — and when you need strong consistency and multi-row transactional guarantees, like financial or inventory systems. MySQL's foreign keys, joins, and ACID transactions solve those problems directly. I'd lean NoSQL instead when the access pattern is simple key-based lookups at extreme scale, the schema is naturally variable/document-shaped, or I need to scale writes horizontally beyond what a single relational primary can handle.

**Q: Is MySQL ACID-compliant?**
A: With the InnoDB storage engine, yes — InnoDB implements all four ACID properties (atomicity, consistency, isolation, durability) through mechanisms like the transaction log, locking, and MVCC. With MyISAM, no — there are no transactions at all, so atomicity and isolation guarantees simply don't exist for that engine.

**Q: How does MySQL's client-server architecture work at a high level?**
A: The `mysqld` server process listens for client connections (TCP or Unix socket), authenticates the connection, and hands incoming SQL to the parser and optimizer, which builds an execution plan. The optimizer's plan is then executed against whichever storage engine the target table uses, which handles the actual reading/writing of pages to disk and buffer pool caching. This layered design is why storage engines are pluggable per table without changing the SQL interface applications use.

## Related Topics
- [tables-and-schemas.md](./tables-and-schemas.md)
- [indexes.md](./indexes.md)
- [transactions-and-acid.md](./transactions-and-acid.md)
- [backup-and-recovery.md](./backup-and-recovery.md)
</content>
