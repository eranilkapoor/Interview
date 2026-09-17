# Aggregation Pipeline

The aggregation pipeline is MongoDB's framework for transforming and summarizing documents through a sequence of stages, each of which takes the output of the previous stage as its input — conceptually like piping data through a series of Unix commands. Each stage does one job: `$match` filters documents (like a SQL `WHERE`), `$group` buckets and summarizes them (like `GROUP BY`), `$project` reshapes which fields survive (like a `SELECT` list), `$sort` orders them, `$limit`/`$skip` paginate, and `$lookup` pulls in related documents from another collection (like a `JOIN`). Because it's a pipeline, stage order matters for both correctness and performance — filtering early with `$match` before an expensive `$group` or `$lookup` shrinks the working set and can make the difference between an index-backed fast query and a full collection scan followed by heavy in-memory processing.

The mapping to SQL is close enough to be a useful mental model but not exact. `$group`'s `_id` field is the grouping key (it can be `null` for "one group total," a single field, or a composite object of several fields), and accumulator operators like `$sum`, `$avg`, `$max`, `$push`, and `$addToSet` fill the role of SQL aggregate functions. `$lookup` performs a left outer join by default, matching a `localField` in the current collection against a `foreignField` in another, and it always returns an array field (even for a one-to-one relationship) that you typically unwind with `$unwind` afterward. Unlike a relational join, `$lookup` cannot use most indexes efficiently across sharded collections and is meaningfully more expensive than embedding the same data, which is part of why MongoDB schema design leans toward embedding when the related data is small and tightly coupled.

Performance-wise, the aggregation pipeline benefits from the same principles as regular queries: an early `$match` (and, ideally, `$sort` before `$group` when it can use an index) can use indexes the same way `find()` does, while stages like `$group`, `$sort` without an index, and `$lookup` typically require the server to hold intermediate results in memory (bounded by a 100MB per-stage limit unless `allowDiskUse: true` is set). Reordering stages — pushing `$match` and `$limit` as early as possible, projecting away unneeded fields before a `$group` — is one of the most direct ways to speed up an aggregation without touching indexes at all.

## Examples

```js
// $match + $group + $sort — total paid amount per customer, largest first
// (mirrors: SELECT userId, SUM(amount) FROM orders WHERE status='paid' GROUP BY userId ORDER BY total DESC)
db.orders.aggregate([
  { $match: { status: "paid" } },
  { $group: { _id: "$userId", total: { $sum: "$amount" }, orders: { $sum: 1 } } },
  { $sort: { total: -1 } }
]);
```

```js
// $project to reshape output, plus $lookup to join in related customer docs
// (mirrors: SELECT o.orderId, c.name FROM orders o JOIN customers c ON o.customerId = c._id)
db.orders.aggregate([
  { $match: { status: "paid" } },
  {
    $lookup: {
      from: "customers",
      localField: "customerId",
      foreignField: "_id",
      as: "customer"
    }
  },
  { $unwind: "$customer" },
  { $project: { orderId: 1, amount: 1, customerName: "$customer.name", _id: 0 } }
]);
```

```js
// A pipeline that filters early to stay index-backed, then aggregates —
// $match first lets the server use an index on { status: 1, createdAt: -1 }
// before the more expensive $group stage runs on a smaller set of documents
db.orders.aggregate([
  { $match: { status: "paid", createdAt: { $gte: ISODate("2026-01-01") } } },
  { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, revenue: { $sum: "$amount" } } },
  { $sort: { _id: 1 } }
], { allowDiskUse: true });
```

## Common Pitfalls / Gotchas

- Putting `$match` late in the pipeline (or omitting it) when it could run first — this forces expensive stages like `$group` or `$lookup` to process far more documents than necessary and prevents the stage from using an index.
- Forgetting that `$lookup` always produces an array, even for a logically one-to-one relationship — downstream code that expects a single object breaks unless you `$unwind` (or use `$first`/index into the array) after the lookup.
- Not setting `allowDiskUse: true` on pipelines that sort or group large datasets — by default, a stage that exceeds 100MB of memory throws an error instead of spilling to disk.
- Using `$lookup` heavily across a sharded cluster or large collections as a substitute for proper schema design — it's meaningfully slower than an equivalent embedded read, especially without an index on the foreign field.
- Confusing `$project`'s field-inclusion/exclusion rules — you generally can't mix inclusion (`1`) and exclusion (`0`) in the same `$project` stage except for `_id`, which is the one field you can always exclude alongside inclusions.

## Interview Questions & Answers

**Q: How does the aggregation pipeline compare to SQL's `GROUP BY` and `JOIN`?**
A: `$group` plays the role of `GROUP BY` — its `_id` is the grouping key and accumulator operators like `$sum`/`$avg`/`$push` act as aggregate functions. `$lookup` plays the role of a left outer `JOIN`, matching a local field against a foreign field in another collection, but it always returns an array (even for 1:1 relationships) and is generally more expensive than a relational join, especially on sharded data.

**Q: Why does the order of stages in an aggregation pipeline matter for performance?**
A: Each stage feeds the next, so an early `$match` (and where possible, an early `$sort` that can use an index) shrinks the number of documents that expensive downstream stages like `$group` or `$lookup` have to process, and lets the pipeline use an existing index the way `find()` would. Putting `$match` late means the server has already done unnecessary work on documents that get filtered out anyway.

**Q: What does `$group` with `_id: null` do?**
A: It puts every input document into a single group, which is how you compute an aggregate over the entire filtered collection — e.g., total revenue across all orders — rather than a per-key breakdown.

**Q: Why would you need `allowDiskUse: true` on an aggregation?**
A: Stages like `$group` and `$sort` build intermediate results in memory, and by default a single stage is capped at 100MB; exceeding that without `allowDiskUse: true` throws an error. Setting it lets MongoDB spill intermediate data to temporary files on disk, trading some speed for the ability to process larger datasets.

**Q: What's a case where you'd prefer embedding over using `$lookup` to join data at query time?**
A: When the related data is small, bounded, and always read together with its parent — e.g., a shipping address on an order. Embedding avoids the extra join cost of `$lookup` entirely; reserve `$lookup` for genuinely separate, large, or independently-updated collections where duplication would be worse than the join cost.

## Related Topics
- [crud-operations.md](./crud-operations.md)
- [documents-and-collections.md](./documents-and-collections.md)
- [indexes.md](./indexes.md)
- [performance-tuning.md](./performance-tuning.md)
