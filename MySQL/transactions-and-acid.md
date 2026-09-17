# Transactions and ACID

A transaction is a sequence of one or more SQL statements that MySQL guarantees will either all take effect together, or none of them will — there's no partial, half-applied state visible to anything else. You start one explicitly with `BEGIN` (or `START TRANSACTION`), run your statements, and finish with `COMMIT` to make the changes permanent or `ROLLBACK` to discard everything since `BEGIN` as if it never happened. The canonical example is a funds transfer: debiting one account and crediting another must happen together, because a crash or error between the two statements would otherwise either destroy money or create it out of nowhere. Only transactional storage engines support this — InnoDB does, MyISAM does not (see [mysql-overview.md](./mysql-overview.md)) — so the engine choice for a table isn't just a performance detail, it determines whether transactions even apply to it at all.

**ACID** is the set of four guarantees a transactional database makes, and each one maps to a concrete failure it prevents. **Atomicity** means the transaction is all-or-nothing — if any statement fails or you call `ROLLBACK`, every change made so far in that transaction is undone, achieved via InnoDB's undo log. **Consistency** means the database moves from one valid state to another valid state — constraints (foreign keys, `CHECK`, `UNIQUE`) are enforced throughout, so a transaction can never commit a state that violates them; this is less a mechanism InnoDB implements directly and more the *outcome* that atomicity, isolation, and your own constraints jointly guarantee. **Isolation** means concurrently running transactions don't see each other's uncommitted, in-progress changes — how strictly is tunable (see isolation levels below). **Durability** means once a transaction commits, the change survives even an immediate crash or power loss — InnoDB achieves this with a write-ahead redo log: changes are flushed to a durable log *before* the commit is acknowledged, so after a crash, InnoDB can replay the log to reconstruct any committed change that hadn't yet been written back to the actual data files.

Isolation is the subtlest of the four, because full isolation (transactions behaving as if they ran one at a time, serially) is expensive, so SQL defines weaker isolation levels that trade some correctness guarantees for concurrency, and it matters to know exactly which "read anomaly" each level permits or prevents. A **dirty read** is reading another transaction's uncommitted changes — possible only at `READ UNCOMMITTED`, the weakest level, rarely used in practice. A **non-repeatable read** is when you read a row twice in the same transaction and get different values because another transaction committed a change to it in between — prevented by `REPEATABLE READ` and stronger. A **phantom read** is when you re-run the same range query twice in one transaction and get a *different set of rows* (not just changed values) because another transaction inserted or deleted rows matching your condition in between — technically defined as prevented only at `SERIALIZABLE`, though InnoDB's specific implementation of `REPEATABLE READ` (its default) also prevents most phantom reads in practice via gap locking, which is a MySQL-specific detail worth knowing. `READ COMMITTED` sits in between: it prevents dirty reads but allows non-repeatable reads, since each statement sees a fresh snapshot as of when *that statement* started, not as of when the transaction started. `SERIALIZABLE` is the strictest — it behaves as if every transaction ran one at a time — and prevents all three anomalies, at the cost of the most locking and the least concurrency.

## Examples

```sql
-- A basic atomic transfer -- both updates commit together or neither does
START TRANSACTION;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;

-- Rolling back on a failed check instead of trusting both statements blindly
START TRANSACTION;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
-- application checks: did this leave balance negative?
-- SELECT balance FROM accounts WHERE id = 1;
-- if balance < 0:
ROLLBACK;
-- otherwise:
-- COMMIT;
```

```sql
-- Checking and setting the isolation level
SELECT @@transaction_isolation;

SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;

START TRANSACTION;
SELECT balance FROM accounts WHERE id = 1;  -- snapshot depends on isolation level
-- ... another session commits a change to accounts.id = 1 here ...
SELECT balance FROM accounts WHERE id = 1;  -- may return a different value under READ COMMITTED
COMMIT;
```

```sql
-- Using a SAVEPOINT to roll back part of a transaction without discarding all of it
START TRANSACTION;
UPDATE orders SET status = 'processing' WHERE id = 100;
SAVEPOINT before_payment;
UPDATE accounts SET balance = balance - 50 WHERE id = 1;
-- suppose the payment step fails a validation check:
ROLLBACK TO SAVEPOINT before_payment;  -- undoes only the balance update
COMMIT;  -- the status change to 'processing' is still committed
```

## Common Pitfalls / Gotchas

- Forgetting to `COMMIT` (or relying on autocommit being off) and leaving a transaction open, which holds locks and can block other sessions indefinitely.
- Assuming `REPEATABLE READ` (InnoDB's default) behaves exactly like the SQL standard's minimal definition — InnoDB's version also prevents most phantom reads via gap locks, which is stronger than the standard requires and a genuinely MySQL-specific detail.
- Wrapping long-running, non-transactional work (like calling an external API) inside a database transaction — it holds locks and an open transaction for the entire duration, which can badly hurt concurrency.
- Using `SERIALIZABLE` everywhere "to be safe" without understanding the throughput cost — it maximizes correctness guarantees but also maximizes locking and can turn concurrent workloads into effectively serial ones.
- Not handling deadlocks — InnoDB detects deadlocks and automatically rolls back one of the involved transactions, but application code needs to catch that error and retry; assuming a transaction always succeeds is a common source of silent data loss under load.

## Interview Questions & Answers

**Q: Explain the four ACID properties with a concrete example for each.**
A: Atomicity — a funds transfer's debit and credit either both happen or neither does, even if the server crashes mid-transaction. Consistency — a transaction can never leave the database violating a constraint, like a foreign key pointing at a row that doesn't exist. Isolation — two transactions running at the same time don't see each other's uncommitted, in-progress changes (how strictly depends on isolation level). Durability — once `COMMIT` returns success, the change survives a crash immediately afterward, because InnoDB's redo log persisted it before acknowledging the commit.

**Q: What's the difference between a dirty read, a non-repeatable read, and a phantom read?**
A: A dirty read is seeing another transaction's *uncommitted* changes — it might get rolled back and never really happened. A non-repeatable read is re-reading the *same row* twice in one transaction and getting a different value, because another transaction committed an update to it in between. A phantom read is re-running the *same range query* twice and getting a different *set* of rows, because another transaction inserted or deleted matching rows in between — it's about the row count/set changing, not a single row's value.

**Q: What isolation level does MySQL (InnoDB) use by default, and what does it guarantee?**
A: `REPEATABLE READ`. Per the SQL standard it prevents dirty reads and non-repeatable reads but technically permits phantom reads; InnoDB's specific implementation goes further and also prevents most phantom reads through gap locking (locking the "gaps" between index records, not just the records themselves), which is a detail specific to MySQL's InnoDB engine rather than the standard's minimum requirement.

**Q: What's the tradeoff between `READ COMMITTED` and `SERIALIZABLE`?**
A: `READ COMMITTED` gives each individual statement a fresh snapshot as of when that statement starts, so it allows non-repeatable reads but offers better concurrency since it locks less. `SERIALIZABLE` makes transactions behave as if they ran one at a time, preventing all three anomalies (dirty, non-repeatable, and phantom reads), but at the cost of much heavier locking, more blocking between transactions, and lower overall throughput. Most applications default to `REPEATABLE READ` or `READ COMMITTED` and reserve `SERIALIZABLE` for narrow cases where strict correctness genuinely outweighs concurrency.

**Q: How does InnoDB implement durability given that writing every change straight to the data files on every commit would be slow?**
A: Through a write-ahead redo log. When a transaction commits, InnoDB doesn't need to have already flushed every changed data page to disk — it only needs the redo log entries describing those changes durably written (and by default, `fsync`'d) before acknowledging the commit. If the server crashes before the actual data pages are flushed, InnoDB replays the redo log on restart to reapply any committed changes that weren't yet persisted to the data files, which is far cheaper than flushing full pages synchronously on every single commit.

## Related Topics
- [mysql-overview.md](./mysql-overview.md)
- [tables-and-schemas.md](./tables-and-schemas.md)
- [stored-procedures.md](./stored-procedures.md)
- [backup-and-recovery.md](./backup-and-recovery.md)
</content>
