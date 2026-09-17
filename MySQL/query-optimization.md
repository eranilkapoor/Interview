# Query Optimization

Query optimization starts with `EXPLAIN`, because guessing why a query is slow wastes time that reading the actual execution plan doesn't. Prefixing any `SELECT` (or `UPDATE`/`DELETE`) with `EXPLAIN` shows how MySQL's optimizer intends to execute it: which table it reads first, the access `type` for each table (roughly best to worst: `system`/`const` for a single-row lookup by primary/unique key, `eq_ref`/`ref` for index lookups, `range` for an index range scan, `index` for a full index scan, and `ALL` for a full table scan — the one you're almost always trying to eliminate on a large table), which index (if any) was actually chosen under `key`, the estimated `rows` examined, and an `Extra` column carrying important flags: "Using index" means the query was fully answered from a covering index (great), "Using filesort" means MySQL had to sort results in memory or on disk because no index provided the needed order (often avoidable), and "Using temporary" means a temp table was created mid-query, common with certain `GROUP BY`/`DISTINCT` patterns and worth investigating on a hot path. `EXPLAIN ANALYZE` (MySQL 8.0.18+) goes further and actually runs the query, reporting real timing and row counts per step instead of the optimizer's estimates — invaluable when the optimizer's row estimates are simply wrong.

A short list of habits accounts for most real-world query performance problems. `SELECT *` pulls every column regardless of what's actually needed, which wastes network bandwidth, defeats covering indexes (since the index almost certainly doesn't include every column in the table), and can silently break application code when the table's columns change later — always name the columns you need. Missing or wrongly-ordered indexes are the single most common cause of slow queries (covered in depth in [indexes.md](./indexes.md)): check `EXPLAIN` for `type: ALL` on a large table and treat it as a signal to add or reorder an index, not something to just accept. Functions wrapped around indexed columns in `WHERE` (`WHERE DATE(created_at) = ...`) prevent index use for the same reason described in [indexes.md](./indexes.md) — rewrite as a sargable range condition instead. And large `OFFSET`-based pagination degrades linearly with offset size, as covered in [select-queries.md](./select-queries.md) — keyset pagination avoids the problem entirely for deep pages.

The **N+1 query problem** deserves special attention because it's an application-layer pattern that manifests as a database performance problem, and it's one of the most common real bugs in production systems using an ORM. It happens when code fetches a list of N parent rows with one query, then loops over them and issues a *separate* query per row to fetch related data — for example, fetching 50 orders, then looping and running `SELECT * FROM order_items WHERE order_id = ?` once per order, for 51 total queries instead of 2. Each individual query might be fast, but the *number* of round trips scales linearly with the result set size, and network latency per round trip (even a fraction of a millisecond, multiplied by hundreds or thousands of rows) can dominate total response time far more than any single query's execution cost. The fix is almost always to replace the per-row queries with a single query that fetches everything needed up front — either a `JOIN`, or a single `WHERE order_id IN (...)` query batching all the needed IDs — trading N+1 round trips for 2, at the cost of slightly more application-side logic to reassemble the results into the shape the per-row loop expected.

## Examples

```sql
-- Reading EXPLAIN output to diagnose a slow query
EXPLAIN SELECT o.id, o.total_amount, c.full_name
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.status = 'paid' AND o.created_at >= '2026-01-01'
ORDER BY o.created_at DESC
LIMIT 20;
-- Look for: type = ALL on a large table (missing index),
-- Extra = "Using filesort" (no index satisfies the ORDER BY),
-- rows examined much larger than rows actually returned
```

```sql
-- The N+1 problem and its fix
-- BAD: 1 query for orders, then N queries (one per order) for items
-- SELECT id FROM orders WHERE customer_id = 42;
-- for each order_id: SELECT * FROM order_items WHERE order_id = ?;

-- GOOD: 1 query for orders, 1 batched query for all their items
SELECT id FROM orders WHERE customer_id = 42;
SELECT * FROM order_items WHERE order_id IN (101, 102, 103, 104);
-- application code groups the second result set by order_id in memory

-- Or, even simpler when the shapes fit: a single JOIN
SELECT o.id AS order_id, oi.product_id, oi.quantity
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.customer_id = 42;
```

```sql
-- Avoiding SELECT * and a non-sargable filter in the same query
-- BAD
SELECT * FROM orders WHERE YEAR(created_at) = 2026;

-- GOOD -- only needed columns, and a range condition that can use an index
SELECT id, customer_id, total_amount
FROM orders
WHERE created_at >= '2026-01-01' AND created_at < '2027-01-01';
```

## Common Pitfalls / Gotchas

- Optimizing based on assumptions instead of `EXPLAIN` output — a query that "should" be slow because of its shape might already be fine, and one that "looks" simple can hide a full table scan.
- Adding an index reactively after seeing one slow query, without checking whether it actually gets used (`EXPLAIN` again afterward) or whether it hurts write throughput on a busy table more than it helps this one read.
- Shipping an ORM-generated data-fetching loop without checking the query log/count — N+1 patterns are extremely easy to introduce accidentally with lazy-loaded associations and are often invisible until the table grows.
- Using `LIMIT` to "fix" a slow query without addressing why it's slow — limiting the *output* rows doesn't reduce the rows MySQL has to *examine* if there's no supporting index or filter.
- Trusting the optimizer's `rows` estimate in `EXPLAIN` blindly on tables with stale statistics — running `ANALYZE TABLE` periodically (or after large data changes) keeps the optimizer's cardinality estimates accurate.

## Interview Questions & Answers

**Q: Walk through how you'd diagnose a slow query in a production MySQL database.**
A: Start with `EXPLAIN` (or `EXPLAIN ANALYZE` for real timing) to see the actual execution plan — which access type is used per table, which index (if any) was chosen, and whether `Extra` shows costly steps like "Using filesort" or "Using temporary." From there, check whether an index exists that fits the query's filter/sort columns in the right order, whether the query is unnecessarily selecting more columns than needed, and whether it's part of a loop from application code (an N+1 pattern) rather than a single, standalone slow statement.

**Q: What is the N+1 query problem, and how do you fix it?**
A: It's when fetching N related rows requires N+1 total queries — one to get the parent rows, then one more per parent row to get its related data — instead of batching that related-data fetch into a single query. It commonly shows up with ORMs and lazy-loaded associations. The fix is replacing the per-row queries with either a single `JOIN` or a single `WHERE id IN (...)` query covering all needed IDs at once, cutting round trips from N+1 down to a small constant number.

**Q: Why is `SELECT *` considered bad practice in production queries?**
A: It fetches every column regardless of what's used, wasting network bandwidth and memory on unused data; it prevents the query from being satisfied by a covering index, since the index almost never includes every column in the table; and it's fragile — if someone adds a large new column to the table later, every `SELECT *` consumer starts pulling it whether it needs it or not, and application code indexing results positionally can break if column order changes.

**Q: What does "Using filesort" in `EXPLAIN`'s `Extra` column mean, and how would you address it?**
A: It means MySQL couldn't use an index to produce the result in the order `ORDER BY` requested, so it had to sort the result set separately (in memory, or on disk if it's large) after retrieving it. The fix is usually adding (or extending) an index that already stores rows in the needed sort order — for example, an index on `(customer_id, created_at)` can satisfy both a `WHERE customer_id = ?` filter and an `ORDER BY created_at` without a separate sort step.

**Q: What's the difference between `EXPLAIN` and `EXPLAIN ANALYZE`?**
A: `EXPLAIN` shows the optimizer's *planned* execution — estimated row counts and the chosen access strategy — without actually running the query. `EXPLAIN ANALYZE` (MySQL 8.0.18+) actually executes the query and reports real, measured timing and row counts for each step of the plan, which is more reliable when you suspect the optimizer's cost estimates (based on table statistics) are inaccurate.

## Related Topics
- [indexes.md](./indexes.md)
- [select-queries.md](./select-queries.md)
- [joins.md](./joins.md)
- [mysql-overview.md](./mysql-overview.md)
</content>
