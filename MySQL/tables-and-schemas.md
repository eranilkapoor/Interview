# Tables and Schemas

A MySQL table is a typed, structured container for rows: you declare a fixed set of named columns up front, each with a specific data type and constraints, and every row must conform to that shape. This is the core discipline relational databases impose compared to schemaless stores — the schema is enforced by the database itself, not by application code, which means malformed data (a string where a number belongs, a missing required field, a duplicate that should be unique) gets rejected at the point of insertion rather than silently corrupting downstream logic. Designing a good schema means picking the right data type for each column (not just "will it fit" but "what's the smallest correct type," since that affects storage size, index size, and performance at scale), defining a primary key that uniquely and efficiently identifies each row, and using foreign keys to make relationships between tables explicit and enforced rather than implicit and hopeful.

Choosing data types is one of the most consequential and most under-taught schema decisions. Integer types (`TINYINT`, `SMALLINT`, `INT`, `BIGINT`) come in fixed byte widths — use the smallest one that can't overflow, since it directly shrinks storage and index size across potentially billions of rows. String types split into fixed-width `CHAR` (padded, fast for truly fixed-length data like country codes) and variable-width `VARCHAR(n)` (stores only what's used, up to the declared max) versus `TEXT`/`BLOB` for large variable content that can't be efficiently indexed as a whole. Dates and times split into `DATE`, `DATETIME` (a fixed calendar timestamp, no timezone awareness), and `TIMESTAMP` (stored as UTC internally, auto-converted on read/write based on session timezone, and — critically — limited to the year 2038 range, unlike `DATETIME`). `DECIMAL(p,s)` stores exact fixed-point numbers and should always be used for money instead of `FLOAT`/`DOUBLE`, which are binary floating point and can introduce rounding errors that are unacceptable in financial calculations.

Constraints are what turn a table from "a place to put data" into "a place that only holds correct data." A `PRIMARY KEY` uniquely identifies each row and, under InnoDB, physically determines row storage order (see [mysql-overview.md](./mysql-overview.md) on clustered indexes) — it's implicitly `NOT NULL` and unique. A `FOREIGN KEY` constraint ties a column in one table to the primary (or unique) key of another, and MySQL enforces referential integrity automatically: you can't insert a row referencing a parent that doesn't exist, and you can configure what happens when the parent is deleted or updated (`ON DELETE CASCADE`, `ON DELETE RESTRICT`, `ON DELETE SET NULL`, etc.). `UNIQUE` constraints enforce no-duplicates on non-key columns (like an email address), `NOT NULL` forbids missing values, `DEFAULT` supplies a value when none is given, and `CHECK` constraints (fully enforced since MySQL 8.0.16) validate arbitrary row-level conditions like `CHECK (price >= 0)`. Once a table exists in production, `ALTER TABLE` is how you evolve it — adding columns, changing types, adding indexes or constraints — and on large InnoDB tables, understanding which `ALTER TABLE` operations can run online (without blocking writes) versus which require a full table rebuild is a real operational concern, not just syntax trivia.

## Examples

```sql
-- A schema with primary keys, foreign keys, and sensible types
CREATE TABLE customers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_customers_email (email)
) ENGINE=InnoDB;

CREATE TABLE orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  status ENUM('pending', 'paid', 'shipped', 'cancelled') NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB;
```

```sql
-- Evolving a schema safely with ALTER TABLE
ALTER TABLE orders ADD COLUMN notes VARCHAR(500) NULL AFTER status;
ALTER TABLE orders MODIFY COLUMN total_amount DECIMAL(12,2) NOT NULL;
ALTER TABLE orders ADD INDEX idx_orders_customer_created (customer_id, created_at);
ALTER TABLE customers ADD COLUMN phone VARCHAR(20) NULL;
```

```sql
-- Inspecting an existing schema
DESCRIBE orders;
SHOW CREATE TABLE orders\G
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'myapp_production' AND table_name = 'orders';
```

## Common Pitfalls / Gotchas

- Using `VARCHAR(255)` for everything out of habit instead of sizing columns to their actual data — it wastes nothing on disk for VARCHAR itself (it's variable-length), but it does waste index memory and hides real constraints the schema should be enforcing.
- Storing money as `FLOAT`/`DOUBLE` instead of `DECIMAL` — binary floating point can't represent many decimal fractions exactly, so accumulated rounding errors creep into totals.
- Forgetting `ON DELETE`/`ON UPDATE` behavior on foreign keys, then being surprised when a parent-row delete either fails (default `RESTRICT`) or silently cascades and deletes far more than expected (`CASCADE`).
- Adding a large `ALTER TABLE` (e.g., changing a column type on a huge InnoDB table) during peak traffic without checking whether it requires a full table copy — some `ALTER TABLE` operations run online with `ALGORITHM=INSTANT`/`INPLACE`, others lock or rebuild the whole table.
- Choosing `TIMESTAMP` for a far-future date column without realizing its year-2038 range limit — `DATETIME` doesn't have that ceiling.

## Interview Questions & Answers

**Q: What's the difference between `CHAR` and `VARCHAR`?**
A: `CHAR(n)` is fixed-length — MySQL always stores (and pads) exactly `n` characters, which is fast for genuinely fixed-length data like a 2-letter country code. `VARCHAR(n)` is variable-length — it stores only the actual content plus a small length prefix, up to a declared maximum of `n` characters, which is the right choice for most text fields where length varies.

**Q: Why should you use `DECIMAL` instead of `FLOAT` for currency?**
A: `FLOAT`/`DOUBLE` are binary floating-point types that cannot exactly represent many base-10 decimal fractions (like 0.1), so arithmetic on them accumulates small rounding errors — unacceptable when totals must reconcile exactly. `DECIMAL(p,s)` stores an exact fixed-point number, so `DECIMAL(10,2)` always represents currency values to the cent with no drift.

**Q: What does a foreign key constraint actually enforce, and what happens on `ON DELETE CASCADE` vs `ON DELETE RESTRICT`?**
A: A foreign key ensures a column's value must match an existing value in the referenced table's primary/unique key (or be NULL, if allowed) — you can't insert an order for a customer_id that doesn't exist. `ON DELETE RESTRICT` (the safer default) blocks deleting a parent row while child rows still reference it. `ON DELETE CASCADE` instead automatically deletes those child rows too, which is convenient but dangerous if applied somewhere a cascading delete could silently wipe out more data than intended.

**Q: Can you add a column to a huge production table without locking it for the duration?**
A: Often yes, in modern InnoDB (5.6+ and especially 8.0). Simple operations like adding a nullable column without a default requiring a rewrite can use `ALGORITHM=INSTANT` (metadata-only, near-instant even on huge tables). Others can use `ALGORITHM=INPLACE`, which avoids a full table copy but still takes some time and a brief metadata lock. Some changes (like changing a column's data type in certain ways) still require a full table rebuild via `ALGORITHM=COPY`, which can hold things up on a large table — you'd check with `ALTER TABLE ... ALGORITHM=INPLACE, LOCK=NONE` or a tool like `pt-online-schema-change`/`gh-ost` for safety on very large or highly trafficked tables.

**Q: What's the difference between a primary key and a unique key?**
A: A table can have only one primary key, it's implicitly `NOT NULL`, and under InnoDB it determines the physical clustering order of the table's rows. A table can have multiple unique keys, and unique keys (unlike the primary key) can allow `NULL` values — in fact multiple NULLs are typically permitted in a unique column, since NULL is never considered equal to another NULL for uniqueness purposes.

## Related Topics
- [mysql-overview.md](./mysql-overview.md)
- [select-queries.md](./select-queries.md)
- [indexes.md](./indexes.md)
- [normalization.md](./normalization.md)
</content>
