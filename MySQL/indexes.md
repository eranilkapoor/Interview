# Indexes

An index is a separate, ordered data structure MySQL maintains alongside a table specifically to make lookups fast — without one, finding a row matching some condition means scanning every row in the table (a "full table scan"), which is fine for a few hundred rows and catastrophic for a few hundred million. InnoDB's default index structure is a **B-tree** (technically a B+tree): a balanced, sorted tree where every leaf is at the same depth, so a lookup, a range scan, or an ordered traversal all take a bounded, small number of page reads regardless of table size — that's the whole reason indexes turn O(n) scans into roughly O(log n) lookups. As covered in [mysql-overview.md](./mysql-overview.md), InnoDB's primary key *is* the table — it's a **clustered index**, meaning the leaf nodes of that B-tree contain the actual row data, not just a pointer to it. Every other index on the table is a **secondary index**: its leaves store the indexed column(s) plus the primary key value, so a secondary-index lookup that needs columns outside the index has to do an extra step (a "bookmark lookup") back into the clustered index by primary key to fetch the rest of the row.

A **composite (multi-column) index** — `INDEX (customer_id, created_at)` — is sorted first by the leftmost column, then by the next column within each value of the first, and so on. This "leftmost prefix" rule is the single most misunderstood fact about composite indexes: the index can be used to satisfy a query filtering on `customer_id` alone, or on `customer_id AND created_at` together, but it generally cannot be used to satisfy a query filtering on `created_at` alone, because within the tree, rows aren't sorted by `created_at` independent of `customer_id`. Column order in a composite index should usually be chosen by putting equality-filtered columns first and range-filtered columns last, since a range condition (`>`, `<`, `BETWEEN`) on a column stops the index from being useful for sorting/filtering any columns after it in the same lookup. A **covering index** is a composite index that happens to include every column a particular query needs — when that's true, MySQL can answer the query entirely from the index itself without ever touching the underlying table (visible in `EXPLAIN` as "Using index"), which is often the single biggest performance win available for a hot read path.

`EXPLAIN` is how you actually verify whether MySQL is using an index the way you expect, rather than guessing — it shows the query plan the optimizer chose: which table is accessed first, what access `type` is used (`const`/`eq_ref`/`ref`/`range`/`index`/`ALL`, roughly best to worst), which index (if any) was chosen (`key`), how many rows the optimizer estimates it will examine (`rows`), and extra notes like "Using filesort" (an expensive sort not satisfied by an index) or "Using temporary" (a temp table was needed, common with certain `GROUP BY`/`DISTINCT` patterns). An index frequently goes unused even when one technically exists on the filtered column, for reasons worth memorizing: wrapping the column in a function or expression (`WHERE YEAR(created_at) = 2026` can't use a plain index on `created_at`, but `WHERE created_at >= '2026-01-01' AND created_at < '2027-01-01'` can), comparing across incompatible types (comparing a string column to a number forces an implicit conversion), using a leading wildcard in `LIKE '%foo'` (a trailing wildcard `LIKE 'foo%'` can still use the index, but a leading one can't, since the sort order doesn't help find matches in the middle/end of a string), or the optimizer simply deciding a full scan is cheaper because the filter isn't selective enough — a boolean column with only 2 distinct values rarely benefits from an index, since it doesn't narrow the row set much either way.

## Examples

```sql
-- A composite index and the leftmost-prefix rule
CREATE INDEX idx_orders_customer_created ON orders (customer_id, created_at);

-- Uses the index (leftmost column, then range on the second column)
SELECT * FROM orders WHERE customer_id = 42 AND created_at >= '2026-01-01';

-- Uses the index (leftmost column only)
SELECT * FROM orders WHERE customer_id = 42;

-- Does NOT use idx_orders_customer_created -- created_at isn't the leftmost column
SELECT * FROM orders WHERE created_at >= '2026-01-01';
```

```sql
-- EXPLAIN: reading a query plan
EXPLAIN SELECT id, total_amount FROM orders
WHERE customer_id = 42 AND created_at >= '2026-01-01'
ORDER BY created_at DESC;

-- Key columns to read in the output:
-- type: "ref" or "range" is good; "ALL" means a full table scan
-- key:  which index (if any) MySQL actually chose
-- rows: estimated rows examined -- lower is better
-- Extra: "Using index" = covering index (great);
--        "Using filesort" / "Using temporary" = extra, avoidable work
```

```sql
-- A covering index: satisfies the whole query from the index alone
CREATE INDEX idx_orders_covering ON orders (customer_id, created_at, total_amount);

EXPLAIN SELECT customer_id, created_at, total_amount
FROM orders
WHERE customer_id = 42
ORDER BY created_at DESC;
-- Extra: "Using index" -- InnoDB never has to touch the clustered index / full row
```

## Common Pitfalls / Gotchas

- Assuming an index on column B is used just because it exists, when the query only filters on column A of a composite `(A, B)` index without touching A — the leftmost-prefix rule means it isn't.
- Wrapping an indexed column in a function in `WHERE` (`WHERE DATE(created_at) = '2026-01-01'`) — this prevents the optimizer from using a plain index on that column; rewrite as a range instead.
- Over-indexing a write-heavy table — every index has to be updated on every `INSERT`/`UPDATE`/`DELETE`, so indexes speed up reads at a real cost to write throughput and storage.
- Adding an index on a low-cardinality column (like a boolean or a 3-value status flag) expecting a big speedup — with few distinct values, the optimizer often reasonably chooses a full scan anyway.
- Not checking `EXPLAIN` before assuming a slow query is "just slow" — often it's one missing or wrongly-ordered index away from a completely different, much cheaper access plan.

## Interview Questions & Answers

**Q: What data structure does MySQL (InnoDB) use for indexes, and why?**
A: A B-tree (B+tree, specifically) — a balanced, sorted tree structure where all leaf nodes sit at the same depth. That balance guarantees lookups, range scans, and ordered reads all take a small, bounded number of disk-page reads regardless of table size, turning what would be an O(n) full scan into roughly O(log n).

**Q: What's the difference between a primary/clustered index and a secondary index in InnoDB?**
A: The primary key is the clustered index — its B-tree leaves *are* the actual row data, physically stored in primary-key order. A secondary index's B-tree leaves store only the indexed column(s) plus the primary key value; if a query needs columns not in that secondary index, MySQL does an extra lookup back into the clustered index by primary key (a "bookmark lookup") to fetch the rest of the row.

**Q: Explain the leftmost-prefix rule for composite indexes.**
A: A composite index `(A, B, C)` is sorted by A first, then B within each A value, then C within each (A, B) pair. It can be used for queries filtering on A alone, on A and B, or on A, B, and C — but generally not for queries filtering on B or C without A, because the index isn't independently sorted by those columns. This is why column order in a composite index matters: put the columns you'll always filter by (equality conditions) first.

**Q: What is a covering index, and why is it valuable?**
A: An index that includes every column a query needs — both the filter/sort columns and the columns being selected. When a query is fully covered, MySQL can answer it by reading only the index's B-tree and never touching the underlying table row at all, which `EXPLAIN` reports as "Using index." It's valuable because it eliminates the extra clustered-index lookup a normal secondary-index query would need, often cutting I/O dramatically on hot read paths.

**Q: Give a concrete example of a query that won't use an existing index on the filtered column, and explain why.**
A: `WHERE YEAR(created_at) = 2026` on a table with a plain index on `created_at` won't use that index efficiently, because wrapping the column in the `YEAR()` function means MySQL would have to compute `YEAR(created_at)` for every row to check the condition — the stored index order (by raw `created_at` value) doesn't correspond to the function's output order. The fix is to express it as a range the index actually supports: `WHERE created_at >= '2026-01-01' AND created_at < '2027-01-01'`.

## Related Topics
- [mysql-overview.md](./mysql-overview.md)
- [select-queries.md](./select-queries.md)
- [joins.md](./joins.md)
- [query-optimization.md](./query-optimization.md)
</content>
