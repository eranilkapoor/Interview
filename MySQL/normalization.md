# Normalization

Normalization is the process of structuring a relational schema to eliminate redundant data and the update anomalies that redundancy causes, by splitting information into multiple related tables instead of repeating it across rows. The classic progression is a series of "normal forms," each one fixing a specific kind of structural problem left by the previous. **First normal form (1NF)** requires that every column hold a single, atomic value — no comma-separated lists stuffed into one cell, no repeating groups of columns like `phone1, phone2, phone3`. **Second normal form (2NF)** builds on 1NF and requires that every non-key column depend on the *entire* primary key, not just part of it — this only matters for tables with a composite primary key, where a column might depend on one key column but not the other. **Third normal form (3NF)** builds on 2NF and requires that non-key columns depend on *nothing but* the primary key — not on each other. A column that's derivable from another non-key column (a "transitive dependency") shouldn't live in the same table.

Walking through a real example makes this concrete. Start with a single denormalized `orders` table storing everything about an order in one row: `order_id, product_names (comma-separated), customer_name, customer_email, customer_city, customer_zip`. This violates 1NF immediately because `product_names` packs multiple values into one field — you can't easily query "which orders contain product X" or enforce a quantity per product. Splitting products into their own `order_items` table (one row per product per order) fixes 1NF. Now suppose `order_items` has a composite primary key `(order_id, product_id)` but also stores `product_name` and `unit_price` — those columns depend only on `product_id`, not on the full `(order_id, product_id)` pair, which violates 2NF; a `product_name` typo fixed on one order line wouldn't fix it on others referencing the same product. The fix is pulling `product_id, product_name, unit_price` into their own `products` table, referenced by `order_items.product_id`. Finally, if the original table stores `customer_city` and `customer_zip` on every order row, that violates 3NF — `customer_city` is derivable from `customer_zip` (or both are really attributes of the customer, not the order), a transitive dependency. Moving customer details into their own `customers` table, referenced by `orders.customer_id`, resolves it. The result of all three steps is four tables — `customers`, `orders`, `order_items`, `products` — each holding one kind of fact exactly once, connected by foreign keys.

Normalization isn't free, though, and the tradeoff is exactly what an interviewer wants you to articulate. Highly normalized schemas minimize redundancy and make updates safe (fix a product's name in one place, done) but require more joins to reconstruct a full picture, which costs read performance, especially at scale or under high query volume. **Denormalization** — deliberately storing some redundant or precomputed data — trades that write-time safety for read-time speed: storing a `customer_name` snapshot directly on an `orders` row (even though it's normalized elsewhere) avoids a join for a report that only needs the name as it was at order time, and also protects historical accuracy if the customer later changes their name. Common denormalization patterns include storing a computed aggregate (`order_count` on a `customers` row, updated via triggers or application logic) to avoid a `COUNT()` join on every page load, or duplicating a rarely-changing lookup value onto a hot table to eliminate a join from a latency-sensitive path. The right level of normalization is a judgment call based on actual read/write patterns, not a purity test — 3NF is a strong, safe default for transactional (OLTP) schemas, while analytical (OLAP) and reporting systems often denormalize aggressively on purpose.

## Examples

```sql
-- BEFORE: a denormalized table violating 1NF (repeating group) and 3NF (transitive dependency)
CREATE TABLE orders_denormalized (
  order_id INT PRIMARY KEY,
  product_names VARCHAR(500),   -- "Widget, Gadget, Sprocket" -- violates 1NF
  customer_name VARCHAR(120),
  customer_email VARCHAR(255),
  customer_city VARCHAR(100),   -- derivable from zip -- violates 3NF
  customer_zip VARCHAR(10)
);
```

```sql
-- AFTER: normalized to 3NF across four tables
CREATE TABLE customers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  zip VARCHAR(10) NOT NULL
);

CREATE TABLE products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL
);

CREATE TABLE orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE order_items (
  order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (order_id, product_id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

```sql
-- A deliberate, documented denormalization: cache order_count to avoid a COUNT() join
ALTER TABLE customers ADD COLUMN order_count INT UNSIGNED NOT NULL DEFAULT 0;

-- Kept in sync in application code or via trigger whenever an order is created:
UPDATE customers SET order_count = order_count + 1 WHERE id = 42;
```

## Common Pitfalls / Gotchas

- Confusing "no duplicate rows" with 1NF — 1NF is about atomic column values (no lists/repeating groups packed into one cell), not about row-level duplication.
- Applying 2NF reasoning to tables with a single-column primary key — 2NF only has teeth when the primary key is composite; with a single-column key, 2NF is automatically satisfied if 1NF is.
- Normalizing every table to 3NF+ by default regardless of actual read patterns, then wondering why a dashboard needs 8 joins to render one row — normalization should be balanced against real query needs, not treated as a universal goal.
- Denormalizing without a plan to keep the redundant copy in sync — a cached `order_count` that silently drifts from reality (because some code path forgets to update it) is worse than no cache at all.
- Treating normalization and normalization *forms* as strictly increasing quality — beyond 3NF (BCNF, 4NF, 5NF) exist but rarely matter for typical application schemas; 3NF is the practical target most interviewers actually expect.

## Interview Questions & Answers

**Q: What problem does normalization solve?**
A: It eliminates redundant storage of the same fact in multiple places, which in turn eliminates the "update anomalies" that redundancy causes — insert anomalies (can't add a fact without also adding unrelated data), update anomalies (a fact has to be changed in many places and might be missed in some), and delete anomalies (deleting one thing accidentally destroys another fact that had nowhere else to live).

**Q: Explain 1NF, 2NF, and 3NF with concrete examples.**
A: 1NF: every column holds a single atomic value — no comma-separated lists in one field; fix by giving repeating data its own table. 2NF: builds on 1NF, and every non-key column must depend on the *whole* composite primary key, not just part of it — e.g., in an `order_items(order_id, product_id)` table, a `product_name` column depending only on `product_id` violates 2NF and should move to a `products` table. 3NF: builds on 2NF, and non-key columns can't depend on each other (no transitive dependencies) — e.g., `customer_city` derivable from `customer_zip` on an `orders` table means customer data belongs in its own `customers` table.

**Q: What's the tradeoff of denormalization, and when would you deliberately denormalize?**
A: Denormalization reintroduces redundancy to avoid joins at read time, trading write-time complexity (keeping copies in sync) and storage for read speed. It's worth it on hot, latency-sensitive read paths where the join cost is measurable and the redundant data changes rarely or can be kept in sync reliably (via triggers, application logic, or an async job) — e.g., caching an aggregate count, or snapshotting a customer's name onto a historical order row so it doesn't change retroactively if the customer later updates their profile.

**Q: Does a composite primary key automatically satisfy 2NF?**
A: No — it's exactly the case where 2NF can be violated. If a non-key column in a table with primary key `(A, B)` actually only depends on `A` (not on `B`), that's a 2NF violation, even though the key itself is valid and unique. The fix is moving that column into a table keyed only by `A`.

**Q: Is 3NF always the right target for a schema?**
A: It's a strong practical default for OLTP (transactional) systems, where data integrity and cheap, safe writes matter most. But reporting/analytics (OLAP) schemas often deliberately denormalize into star or snowflake schemas, because their read patterns (large aggregations across many rows) benefit far more from avoiding joins than they're hurt by redundancy — and the data is typically loaded in batch, so update anomalies are less of a live concern than they are in a transactional system.

## Related Topics
- [tables-and-schemas.md](./tables-and-schemas.md)
- [joins.md](./joins.md)
- [indexes.md](./indexes.md)
- [query-optimization.md](./query-optimization.md)
</content>
