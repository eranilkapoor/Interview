# Stored Procedures

A stored procedure is a named, precompiled block of SQL and procedural logic (variables, conditionals, loops, error handling) stored inside the database itself and invoked with `CALL procedure_name(...)`, rather than being assembled and sent as ad-hoc SQL from application code every time. MySQL's procedural extension to SQL supports `IN` parameters (values passed into the procedure), `OUT` parameters (values the procedure hands back to the caller, in addition to or instead of a normal result set), and `INOUT` parameters (passed in, potentially modified, and returned). Procedures live in a specific database schema, are created with `DELIMITER` tricks to let the procedure body itself contain semicolons without prematurely ending the `CREATE PROCEDURE` statement, and can contain full control flow — `IF`/`CASE`, `WHILE`/`REPEAT`/`LOOP`, declared local variables, cursors for row-by-row iteration, and handlers for catching specific error conditions.

The practical case for stored procedures centers on a few real advantages. Moving multi-statement logic into the database can reduce round trips between application and database — instead of the application issuing several separate queries (each a network round trip) to check a condition and then act on it, a single `CALL` executes the whole sequence server-side. It also centralizes logic that multiple applications or services need to share consistently — if three different services all need to perform the same validated multi-step update, a stored procedure guarantees they all do it the same way rather than each reimplementing (and potentially drifting from) the same business rule. Procedures can also be granted execute permission independently of granting direct table access, which is occasionally used as a security boundary — a low-privilege application user can be allowed to `CALL` a specific procedure that performs a controlled operation, without being granted broad `SELECT`/`UPDATE` rights on the underlying tables directly.

Those advantages come with real costs that are exactly why most modern application teams keep business logic in the application layer instead, and default to stored procedures only for narrow, well-justified cases. Procedural SQL is a much less ergonomic, less testable language than general-purpose application languages — no mature dependency injection, weaker debugging tools, and it doesn't fit into the same code review, version control, and CI/CD workflows the rest of the application uses unless a team deliberately builds that tooling for it. Logic embedded in stored procedures is invisible to application-level code search and harder to unit test in isolation. It also creates a form of vendor/engine lock-in — logic written as MySQL procedures doesn't port to a different database without a rewrite, whereas application-layer logic in Java/Python/Node is database-agnostic by comparison. The pragmatic modern guideline: use application-layer logic as the default for business rules, and reach for a stored procedure specifically when you need to minimize round trips for a performance-critical, tightly-scoped operation, or when you genuinely need multiple independent applications to share one guaranteed-consistent implementation of a data operation.

## Examples

```sql
-- A stored procedure with an IN parameter and a normal SELECT result set
DELIMITER $$

CREATE PROCEDURE get_orders_for_customer(IN p_customer_id INT)
BEGIN
  SELECT id, status, total_amount, created_at
  FROM orders
  WHERE customer_id = p_customer_id
  ORDER BY created_at DESC;
END $$

DELIMITER ;

CALL get_orders_for_customer(42);
```

```sql
-- IN + OUT parameters, transaction handling, and error handling inside a procedure
DELIMITER $$

CREATE PROCEDURE transfer_funds(
  IN p_from_account INT,
  IN p_to_account INT,
  IN p_amount DECIMAL(10,2),
  OUT p_success BOOLEAN
)
BEGIN
  DECLARE current_balance DECIMAL(10,2);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET p_success = FALSE;
  END;

  START TRANSACTION;

  SELECT balance INTO current_balance
  FROM accounts WHERE id = p_from_account FOR UPDATE;

  IF current_balance < p_amount THEN
    ROLLBACK;
    SET p_success = FALSE;
  ELSE
    UPDATE accounts SET balance = balance - p_amount WHERE id = p_from_account;
    UPDATE accounts SET balance = balance + p_amount WHERE id = p_to_account;
    COMMIT;
    SET p_success = TRUE;
  END IF;
END $$

DELIMITER ;

CALL transfer_funds(1, 2, 100.00, @ok);
SELECT @ok;
```

```sql
-- Managing procedures
SHOW PROCEDURE STATUS WHERE Db = 'myapp_production';
SHOW CREATE PROCEDURE get_orders_for_customer\G
DROP PROCEDURE IF EXISTS get_orders_for_customer;
```

## Common Pitfalls / Gotchas

- Forgetting `DELIMITER $$` (or another custom delimiter) before `CREATE PROCEDURE` — without it, the first semicolon inside the procedure body prematurely terminates the statement.
- Putting complex business logic in a procedure and losing the ability to unit test it the way application code is tested — procedural SQL debugging and testing tooling is generally far weaker.
- Granting broad table access alongside procedure `EXECUTE` rights, defeating the security-boundary benefit procedures can otherwise provide.
- Using a stored procedure purely to "avoid writing SQL in the app" without an actual round-trip or consistency reason — this just moves complexity into a harder-to-review, harder-to-version place for no real benefit.
- Forgetting that logic living only in stored procedures isn't visible to normal code search/grep across the application codebase, making it easy for new team members to miss that it exists at all.

## Interview Questions & Answers

**Q: What's the difference between an `IN`, `OUT`, and `INOUT` parameter in a MySQL stored procedure?**
A: `IN` (the default) passes a value into the procedure that can be read but whose changes inside the procedure don't propagate back to the caller. `OUT` doesn't take an initial value from the caller — it's used purely to pass a value back out, typically via a session variable like `CALL my_proc(@result)` followed by `SELECT @result`. `INOUT` does both: the caller's value is passed in, the procedure can read and modify it, and the modified value is visible to the caller after the call returns.

**Q: When would you choose a stored procedure over putting the same logic in the application layer?**
A: When minimizing round trips matters for a performance-critical, tightly-scoped operation (bundling several dependent statements into one network call), or when multiple independent services need to perform the exact same multi-step data operation and you want to guarantee they can't drift apart by reimplementing it differently. For most general business logic, application-layer code is preferred because it's easier to test, version, code-review, and keep database-agnostic.

**Q: What are the downsides of putting significant business logic into stored procedures?**
A: Procedural SQL has weaker tooling than general-purpose languages for testing, debugging, and code review; it doesn't integrate cleanly with typical application CI/CD and version-control workflows unless a team builds that out deliberately; it's invisible to normal application-level code search; and it creates lock-in to MySQL specifically, since procedural SQL doesn't port to another database engine without a rewrite.

**Q: How can stored procedures be used as a security boundary?**
A: You can grant an application's database user `EXECUTE` permission on a specific procedure without granting it direct `SELECT`/`INSERT`/`UPDATE` access to the underlying tables. The procedure performs a controlled, validated operation server-side, so the calling user can trigger only that specific, vetted behavior rather than issuing arbitrary queries against the tables directly.

**Q: How do you handle errors inside a stored procedure?**
A: With a `DECLARE ... HANDLER` block — for example, `DECLARE EXIT HANDLER FOR SQLEXCEPTION` catches any SQL exception raised in the procedure body, letting you `ROLLBACK` an open transaction and set an output status before the procedure exits, instead of letting the error propagate as an uncontrolled failure back to the caller.

## Related Topics
- [transactions-and-acid.md](./transactions-and-acid.md)
- [select-queries.md](./select-queries.md)
- [tables-and-schemas.md](./tables-and-schemas.md)
</content>
