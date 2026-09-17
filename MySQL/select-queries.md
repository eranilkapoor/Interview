# SELECT Queries

`SELECT` is how you read data out of MySQL, and its clauses execute in a specific logical order that's different from the order you type them — understanding that order is what lets you reason correctly about what a query actually does. Conceptually, MySQL first determines the row source (`FROM`, including any `JOIN`s), filters those rows with `WHERE`, groups the survivors with `GROUP BY`, filters the *groups* with `HAVING`, computes the final column list in `SELECT`, removes duplicates if `DISTINCT` is present, orders the result with `ORDER BY`, and finally trims it with `LIMIT`/`OFFSET`. The single most common source of confusion is `WHERE` versus `HAVING`: `WHERE` filters individual rows *before* grouping and cannot reference aggregate functions like `COUNT()` or `SUM()`, while `HAVING` filters *after* grouping and exists specifically to filter on aggregate results — "give me customers with more than 5 orders" is a `HAVING COUNT(*) > 5`, not a `WHERE`.

Aggregation and grouping are where `SELECT` moves from simple filtering into real analysis. `GROUP BY` collapses rows that share a value (or combination of values) in the grouped columns into a single output row per group, and any non-grouped column in the `SELECT` list must be wrapped in an aggregate function (`COUNT`, `SUM`, `AVG`, `MIN`, `MAX`) — MySQL will let you omit this under the default (non-strict) `ONLY_FULL_GROUP_BY` mode disabled, but doing so produces a value chosen arbitrarily from the group, which is a real bug, not a feature; modern MySQL enables `ONLY_FULL_GROUP_BY` by default specifically to catch this. Subqueries let you nest a query inside another — in the `WHERE` clause to filter based on a computed set (`WHERE id IN (SELECT ...)`), in the `FROM` clause as a "derived table" you can then join against, or as a **correlated subquery** that references a column from the outer query and re-runs once per outer row (powerful, but often rewritable as a `JOIN` for much better performance, since MySQL has to evaluate it repeatedly rather than once).

Sorting and pagination round out the everyday `SELECT` toolkit. `ORDER BY` sorts the final result set (ascending by default, `DESC` for descending, and you can sort by multiple columns with different directions each), and `LIMIT n OFFSET m` (or the shorthand `LIMIT m, n`) trims it to a page of results — but `OFFSET` on a large table is deceptively expensive, because MySQL still has to scan and discard the first `m` rows before returning the next `n`; deep pagination (`OFFSET 500000`) is a classic performance trap that's usually better solved with "keyset pagination" (`WHERE id > :last_seen_id ORDER BY id LIMIT n`), which lets an index seek straight to the right spot instead of scanning past everything before it.

## Examples

```sql
-- WHERE filters rows, ORDER BY + LIMIT paginate the result
SELECT id, customer_id, status, total_amount, created_at
FROM orders
WHERE status = 'paid' AND created_at >= '2026-01-01'
ORDER BY created_at DESC
LIMIT 20 OFFSET 40;
```

```sql
-- GROUP BY + HAVING: customers with more than 5 paid orders,
-- and their total spend -- note COUNT/SUM belong in SELECT/HAVING, not WHERE
SELECT customer_id, COUNT(*) AS order_count, SUM(total_amount) AS total_spent
FROM orders
WHERE status = 'paid'
GROUP BY customer_id
HAVING COUNT(*) > 5
ORDER BY total_spent DESC;
```

```sql
-- A subquery in WHERE (set membership) vs the equivalent, usually faster, JOIN
SELECT id, email
FROM customers
WHERE id IN (SELECT customer_id FROM orders WHERE status = 'paid');

SELECT DISTINCT c.id, c.email
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE o.status = 'paid';

-- A correlated subquery: each customer's most recent order date
SELECT c.id, c.email,
  (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) AS last_order_at
FROM customers c;
```

## Common Pitfalls / Gotchas

- Putting an aggregate condition in `WHERE` instead of `HAVING` — `WHERE COUNT(*) > 5` is a syntax error because `WHERE` runs before grouping/aggregation happens.
- Selecting non-aggregated, non-grouped columns alongside `GROUP BY` and assuming a "sensible" value comes back — without `ONLY_FULL_GROUP_BY` this can silently return an arbitrary row's value per group.
- Using `OFFSET` for deep pagination on a large table — the database still has to walk past every skipped row, so `LIMIT 20 OFFSET 1000000` gets dramatically slower as the offset grows; keyset pagination avoids this.
- Writing a correlated subquery where a `JOIN` would do the same job — a correlated subquery re-executes once per outer row, which can turn a fast query into a slow one on large tables.
- Forgetting that `NULL` never equals anything in `WHERE`, including itself — `WHERE column = NULL` matches nothing; you need `WHERE column IS NULL`.

## Interview Questions & Answers

**Q: What's the difference between `WHERE` and `HAVING`?**
A: `WHERE` filters individual rows before any grouping happens and can't reference aggregate functions. `HAVING` filters groups after `GROUP BY` has collapsed rows, and it's specifically meant for conditions on aggregates, like `HAVING SUM(total_amount) > 1000`. If a condition doesn't involve an aggregate, it belongs in `WHERE` since filtering earlier is cheaper — fewer rows reach the grouping step.

**Q: In what logical order does MySQL evaluate a SELECT statement's clauses?**
A: Roughly: `FROM`/`JOIN` (determine source rows) → `WHERE` (filter rows) → `GROUP BY` (form groups) → `HAVING` (filter groups) → `SELECT` (compute output columns) → `DISTINCT` → `ORDER BY` → `LIMIT`/`OFFSET`. This is why you can `ORDER BY` a column alias defined in `SELECT`, but you can't reference that same alias inside `WHERE` — `WHERE` runs before the `SELECT` list is evaluated.

**Q: Why is `LIMIT ... OFFSET 100000` slow on a large table, and how would you fix it?**
A: MySQL has to read and discard all 100,000 skipped rows before it can start returning the requested page, even though none of them are sent back — the cost grows linearly with the offset. The standard fix is keyset (cursor-based) pagination: instead of an offset, remember the last row's sort key from the previous page and query `WHERE id > :last_id ORDER BY id LIMIT 20`, which lets the index seek directly to the right starting point.

**Q: What's a correlated subquery, and why can it be a performance problem?**
A: A correlated subquery references a column from its outer query, so conceptually it re-runs once for every row the outer query produces, rather than being computed once. On a small outer result set that's fine, but on a large one it can turn what looks like a simple query into something with far worse complexity than an equivalent `JOIN`, which the optimizer can usually execute as a single combined access plan instead of row-by-row re-execution.

**Q: How do you get the top N rows per group in MySQL (e.g., each customer's most recent order)?**
A: In MySQL 8.0+, window functions are the cleanest way: `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC)` in a CTE, then filter `WHERE row_num = 1` in the outer query. Before window functions were available, the common pattern was a correlated subquery or a self-join comparing each row to the max value within its group.

## Related Topics
- [tables-and-schemas.md](./tables-and-schemas.md)
- [joins.md](./joins.md)
- [indexes.md](./indexes.md)
- [query-optimization.md](./query-optimization.md)
</content>
