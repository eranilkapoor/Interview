# Indexes

An index in MongoDB is a separate, ordered data structure (a B-tree, by default) that maps field values to the storage locations of the documents that contain them, so a query can find matching documents without scanning every document in the collection. Without a useful index, `find()` performs a collection scan (`COLLSCAN`) — it reads every document and checks it against the filter, which is fine for a small collection and increasingly disastrous as a collection grows. Every collection automatically gets a unique index on `_id`; every other index is something you deliberately create based on your actual query patterns.

MongoDB supports several index shapes beyond a plain single-field index. A compound index covers multiple fields together and is ordered by field order — an index on `{ status: 1, createdAt: -1 }` efficiently serves queries that filter on `status` alone, or on `status` and `createdAt` together, but not a query that filters on `createdAt` alone (this is the "prefix rule": a compound index serves any query matching a left-to-right prefix of its fields). A multikey index is what MongoDB automatically creates when you index a field that holds an array — it indexes each array element individually, so a query can find a document by any one of the values in that array. A text index supports full-text search with language-aware stemming and relevance scoring, which is a fundamentally different mechanism from `$regex` matching and only one text index is allowed per collection.

`explain()` is how you verify whether a query is actually using the index you think it is, rather than guessing. Running `db.collection.find(filter).explain("executionStats")` returns a `winningPlan` showing the actual stage tree the query executed — `IXSCAN` means an index was used, `COLLSCAN` means it wasn't — plus statistics like `totalDocsExamined` versus `nReturned`. A well-selective index should examine roughly as many documents as it returns; if `totalDocsExamined` is orders of magnitude larger than `nReturned`, the index isn't selective enough for that query, or the wrong index is being chosen. The best case is a covered query, where every field the query needs (both filter and projection) is present in the index itself, so MongoDB never has to fetch the actual document from disk at all — visible in `explain()` as `totalDocsExamined: 0`.

Selectivity is the key property that makes an index actually useful: an index on a field with few distinct values relative to the collection size (like a boolean `isActive` flag) narrows the search very little, because most documents share the same value, whereas an index on a field with many distinct values (like `email`) narrows the search to a small handful of documents immediately. Indexes aren't free — each one adds overhead to every write (insert, update, delete) on the collection because the index structure has to be kept up to date — so the practical skill is indexing for the queries you actually run, not indexing every field defensively.

## Examples

```js
// Single-field, compound, and multikey indexes
db.orders.createIndex({ status: 1 });                       // single-field
db.orders.createIndex({ status: 1, createdAt: -1 });        // compound (prefix rule applies)
db.orders.createIndex({ tags: 1 });                          // multikey — tags is an array field

// Text index for full-text search (only one per collection)
db.articles.createIndex({ title: "text", body: "text" });
db.articles.find({ $text: { $search: "aggregation pipeline" } });
```

```js
// Using explain() to check whether a query is index-backed
db.orders.find({ status: "paid", createdAt: { $gte: ISODate("2026-01-01") } })
         .explain("executionStats");

// Key things to check in the output:
//   winningPlan.stage        -> "IXSCAN" (good) vs "COLLSCAN" (bad)
//   executionStats.totalDocsExamined vs nReturned -> should be close
//   winningPlan.inputStage.indexName -> confirms which index was chosen
```

```js
// A covered query — the index contains every field the query needs,
// so MongoDB never touches the underlying documents on disk
db.orders.createIndex({ status: 1, customerId: 1 });
db.orders.find(
  { status: "paid" },
  { customerId: 1, _id: 0 }
).explain("executionStats");
// executionStats.totalDocsExamined: 0  -> confirms this is a covered query
```

## Common Pitfalls / Gotchas

- Creating an index on every field "just in case" — each index slows down every write to the collection and consumes RAM/disk, so unused or low-selectivity indexes are pure overhead.
- Building a compound index in the wrong field order — a compound index only serves queries that filter on a left-to-right prefix of its fields; `{ createdAt: -1, status: 1 }` does not efficiently serve a query that filters on `status` alone.
- Indexing a low-selectivity field (like a boolean flag or a status with only 3 possible values) and expecting a big performance win — a query using that index alone still has to examine a large fraction of the collection.
- Never actually running `explain()` and just assuming an index is being used — it's easy for a query to silently fall back to a collection scan (e.g., due to a `$regex` without an anchor, a type mismatch, or a missing index) without any error being raised.
- Forgetting that an array field creates a multikey index automatically, and that compound indexes can only have at most one multikey (array) field — trying to index two array fields together in one compound index throws an error.

## Interview Questions & Answers

**Q: What does `explain()` tell you, and what's the difference between `IXSCAN` and `COLLSCAN`?**
A: `explain("executionStats")` returns the actual query plan MongoDB chose, including which stage did the work. `IXSCAN` means the query used an index to locate candidate documents; `COLLSCAN` means it scanned every document in the collection and filtered in memory. You also check `totalDocsExamined` versus `nReturned` — a healthy index-backed query examines close to what it returns.

**Q: What is the "prefix rule" for compound indexes?**
A: A compound index on fields `{ a: 1, b: 1, c: 1 }` can serve queries filtering on `a` alone, `a` and `b`, or `a`, `b`, and `c` together — any left-to-right prefix of the indexed fields — but not a query filtering on `b` or `c` alone without `a`. Field order in the index definition should match the most common query patterns, generally putting equality filters before range/sort fields.

**Q: What is a covered query and why is it faster?**
A: A covered query is one where every field the query filters on and returns is present in the index itself, so MongoDB can answer it entirely from the index without fetching the full document from the collection. It's faster because it avoids the extra disk/memory lookup to retrieve the actual document — visible in `explain()` output as `totalDocsExamined: 0`.

**Q: What makes an index "selective," and why does selectivity matter?**
A: Selectivity is how much an index narrows down the candidate document set — a field with many distinct values relative to the collection size (like an email) is highly selective, while a field with few distinct values (like a boolean) is not. Low-selectivity indexes still leave the query examining a large fraction of the collection, so they provide much less benefit than their write-time overhead costs.

**Q: What's the tradeoff of adding more indexes to a collection?**
A: Indexes speed up reads that they cover, but every index has to be updated on every insert, update, and delete that touches its fields, adding write latency and consuming additional RAM and disk. The practical approach is to index based on actual, measured query patterns rather than adding indexes defensively for every field.

## Related Topics
- [performance-tuning.md](./performance-tuning.md)
- [aggregation-pipeline.md](./aggregation-pipeline.md)
- [crud-operations.md](./crud-operations.md)
- [schema-design.md](./schema-design.md)
