# Joins

A join combines rows from two or more tables based on a related column, which is what lets a normalized schema (separate `customers` and `orders` tables, linked by `customer_id`) be reassembled into the combined view an application or report actually needs. Which join type you use encodes what should happen to rows on either side that *don't* find a match, and getting that choice wrong is one of the most common real-world SQL bugs — a report that silently drops customers with zero orders because it used `INNER JOIN` instead of `LEFT JOIN` is a classic example.

`INNER JOIN` returns only rows that have a match on both sides — a customer with no orders is simply absent from the result, and an order somehow referencing a nonexistent customer (shouldn't happen with a proper foreign key, but can in unconstrained data) is also excluded. `LEFT JOIN` (equivalently `LEFT OUTER JOIN`) keeps every row from the left table regardless of whether it matches, filling in `NULL` for every column from the right table when there's no match — this is the standard way to answer "give me all customers, and their orders if they have any." `RIGHT JOIN` is the mirror image (keep every row from the right table), and in practice it's rarely used, since any `RIGHT JOIN` can be rewritten as a `LEFT JOIN` by swapping the table order, and most style guides prefer `LEFT JOIN` everywhere for consistency. A `FULL OUTER JOIN` — keep every row from both sides, matched or not — is standard SQL, but **MySQL does not implement it natively**; the standard workaround is a `LEFT JOIN UNION a RIGHT JOIN` (or more simply, `LEFT JOIN` unioned with a second `LEFT JOIN` with the tables swapped, filtering the second to only unmatched rows), using `UNION` (not `UNION ALL`) to deduplicate the rows that matched on both sides.

A join's `ON` clause is what determines matching, and it's worth being precise about where a filter belongs: for `INNER JOIN`, putting a condition in `ON` versus `WHERE` produces the same result, but for `LEFT JOIN` it does not — a condition on the *right* table's columns in `WHERE` runs after the join and will discard the `NULL`-filled unmatched rows you specifically wanted to keep, silently turning your `LEFT JOIN` back into something that behaves like an `INNER JOIN`. The fix is to put right-table filter conditions inside the `ON` clause instead, so they're applied *during* matching rather than after. Interviewers ask about this specifically because it's a subtle, easy-to-ship bug: "show me all customers and their orders from this year, including customers with none" requires the date filter in `ON`, not `WHERE`.

## Examples

```sql
-- INNER JOIN: only customers that have at least one order
SELECT c.id, c.full_name, o.id AS order_id, o.total_amount
FROM customers c
INNER JOIN orders o ON o.customer_id = c.id;

-- LEFT JOIN: every customer, with NULLs for those who have no orders
SELECT c.id, c.full_name, o.id AS order_id, o.total_amount
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id;
-- A customer with zero orders appears once, with order_id and total_amount = NULL

-- The ON vs WHERE trap on a LEFT JOIN
-- WRONG: this silently becomes an INNER JOIN because unmatched rows have o.status = NULL,
-- and "NULL = 'paid'" is never true, so WHERE drops them
SELECT c.id, c.full_name, o.id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.status = 'paid';

-- RIGHT: filter the right-table condition inside ON so unmatched customers survive
SELECT c.id, c.full_name, o.id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'paid';
```

```sql
-- FULL OUTER JOIN workaround: MySQL has no native FULL OUTER JOIN,
-- so UNION two LEFT JOINs with the table order swapped
SELECT c.id AS customer_id, o.id AS order_id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
UNION
SELECT c.id AS customer_id, o.id AS order_id
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id;
-- UNION (not UNION ALL) drops the duplicate rows that matched on both sides
```

## Common Pitfalls / Gotchas

- Putting a filter on the "nullable" side's column in `WHERE` instead of `ON` for a `LEFT JOIN` — this turns it into a de facto `INNER JOIN` because `WHERE` evaluates after the join and discards the `NULL`-filled unmatched rows.
- Forgetting MySQL has no native `FULL OUTER JOIN` and trying to write one directly — it's a syntax error; you need the `LEFT JOIN UNION RIGHT JOIN`-style workaround.
- Joining on columns without matching, compatible types or without an index on the join column — this forces a full scan of one side per row of the other, which is catastrophic on large tables (see [indexes.md](./indexes.md)).
- Using `SELECT *` across a multi-table join — ambiguous or duplicate column names (both tables might have an `id` or `created_at`) make the result confusing and waste bandwidth on columns nobody needs.
- Accidentally producing a cartesian product by forgetting the `ON` clause (or by joining on a non-unique, non-selective column), causing row counts to multiply unexpectedly.

## Interview Questions & Answers

**Q: What's the difference between `INNER JOIN` and `LEFT JOIN`, with an example?**
A: `INNER JOIN` returns only rows with a match on both sides — joining `customers` to `orders` this way excludes any customer who hasn't placed an order. `LEFT JOIN` keeps every row from the left table (`customers`) regardless of a match, filling unmatched right-side columns with `NULL` — so a customer with zero orders still appears once, with `order_id` as `NULL`. You'd use `LEFT JOIN` for "all customers, with their orders if any," and `INNER JOIN` for "only customers who have ordered."

**Q: Does MySQL support `FULL OUTER JOIN`?**
A: Not natively — MySQL's JOIN syntax doesn't include `FULL OUTER JOIN`. The standard workaround is a `UNION` of two `LEFT JOIN`s: one joining table A to table B normally, and a second joining B to A (effectively a right join expressed as a left join), which together produce every matched pair plus every unmatched row from both sides. `UNION` (not `UNION ALL`) is used to avoid duplicating the rows that matched in both queries.

**Q: Why does putting a condition on the right table in `WHERE` change the behavior of a `LEFT JOIN`?**
A: Because `WHERE` is evaluated after the join has already happened. For rows where the left table had no match, every right-table column is `NULL` — so a condition like `WHERE o.status = 'paid'` evaluates to unknown/false for those rows and they get filtered out, even though you wanted to keep them. Moving that condition into the `ON` clause applies it during the matching step instead, so unmatched left rows are preserved with `NULL`s as intended.

**Q: What happens if you join two tables without a proper `ON` condition, or on a column with very low selectivity?**
A: Without an `ON` condition (or with `CROSS JOIN`), you get a cartesian product — every row from table A paired with every row from table B, which grows multiplicatively and can produce an enormous, mostly meaningless result set. Joining on a low-selectivity column (like a boolean flag) produces a similar effect in miniature: each row on one side matches a large fraction of rows on the other, ballooning the result and the work needed to compute it.

**Q: How would you find customers who have never placed an order?**
A: `LEFT JOIN` customers to orders and filter for the rows where the join didn't find a match: `SELECT c.* FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL;`. The `WHERE o.id IS NULL` check works here specifically because it's checking a column that can only be `NULL` as a result of the failed join, not because of real data.

## Related Topics
- [select-queries.md](./select-queries.md)
- [tables-and-schemas.md](./tables-and-schemas.md)
- [indexes.md](./indexes.md)
- [normalization.md](./normalization.md)
</content>
