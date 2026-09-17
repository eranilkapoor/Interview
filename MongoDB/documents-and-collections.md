# Documents and Collections

A MongoDB document is the basic unit of storage: a BSON object made of field-value pairs, conceptually similar to a JSON object but with a richer type system (dates, binary data, 64-bit integers, `Decimal128`, and MongoDB's own `ObjectId` type). Documents are grouped into collections, which are analogous to tables but impose no fixed column set — two documents in the same collection can have different fields, different types for the same field name, or deeply nested structures that have no equivalent in a flat table row. A collection is really just a named bucket of documents that the application agrees to treat as one logical entity type.

Every document has an `_id` field that acts as its primary key within the collection and is immutable once set. If you don't supply one on insert, MongoDB generates a 12-byte `ObjectId` automatically — 4 bytes of timestamp, 5 bytes of a random machine/process identifier, and 3 bytes of an incrementing counter — which means ObjectIds are roughly sortable by creation time and are guaranteed unique without a central sequence generator, unlike an auto-incrementing relational primary key. MongoDB also automatically creates a unique index on `_id` for every collection, so lookups by `_id` are always index-backed.

The defining design decision in document modeling is embedding versus referencing. An embedded document is nested directly inside its parent (e.g., a shipping address embedded inside an order document); a reference stores just the related document's `_id` and requires a separate query — or a `$lookup` aggregation stage — to resolve it, much like a foreign key. Embedding is preferred when the nested data is only ever accessed together with its parent and doesn't grow unboundedly (an address, a small set of order line items). Referencing is preferred when the related data is large, shared across many parents, updated independently, or could grow without bound (a product referenced by thousands of orders, or a user's full comment history). This decision directly affects read performance (embedding avoids a second round trip) and write/update complexity (referencing avoids duplicating and re-synchronizing the same data everywhere it's used).

One hard constraint shapes a lot of this modeling: the maximum BSON document size is 16MB. It exists to prevent a single document from monopolizing RAM and network bandwidth during transfer, and it's the practical reason unbounded embedded arrays (e.g., embedding every comment ever made on a post, forever, inside the post document) are a modeling anti-pattern — that pattern works fine until the array grows large enough to approach the limit, at which point writes start failing outright. For genuinely unbounded one-to-many relationships, the standard pattern is to reference the "many" side from the "one" side (or vice versa) rather than embed it.

## Examples

```js
// A document with embedded sub-documents and an array — no separate
// "addresses" or "line_items" table needed for data that's always read together
db.orders.insertOne({
  _id: ObjectId(),
  customer: { name: "Jane Doe", email: "jane@example.com" },
  shippingAddress: { street: "12 Main St", city: "Austin", zip: "78701" },
  items: [
    { sku: "SKU-1001", qty: 2, price: 19.99 },
    { sku: "SKU-2002", qty: 1, price: 49.99 }
  ],
  createdAt: new Date()
});
```

```js
// Referencing instead of embedding — the product catalog is large and
// shared across many orders, so orders store a reference, not a copy
db.products.insertOne({ _id: ObjectId("64f1a2b3c4d5e6f7a8b9c0d1"), name: "Widget", price: 19.99 });
db.orders.insertOne({ _id: ObjectId(), productId: ObjectId("64f1a2b3c4d5e6f7a8b9c0d1"), qty: 2 });

// Resolving the reference at query time, similar to a SQL join
db.orders.aggregate([
  { $lookup: { from: "products", localField: "productId", foreignField: "_id", as: "product" } }
]);
```

```js
// ObjectId embeds a creation timestamp — useful for range queries by time
// without a separate createdAt field, and for sorting roughly by insertion order
const id = ObjectId();
print(id.getTimestamp()); // the moment this ObjectId was generated

db.events.find({
  _id: { $gte: ObjectId.createFromTime(Math.floor(Date.UTC(2026, 0, 1) / 1000)) }
});
```

## Common Pitfalls / Gotchas

- Embedding an array that grows without bound (all comments on a post, all events for a user) — eventually risks hitting the 16MB document limit and causes ever-larger documents to be rewritten on every update.
- Treating `_id` as something the application should manually set to a meaningful business value (like an email) without considering immutability — `_id` cannot be changed after insert; you'd have to delete and re-insert the whole document to "change" it.
- Over-referencing small, tightly-coupled data (like an address that only ever belongs to one order) — this adds unnecessary round trips (`$lookup` or a second query) for data that would be cheaper and simpler to just embed.
- Assuming two documents in the same collection have the same fields just because they usually do — with no rigid schema, absent fields, differently-typed fields, or legacy shapes from before a migration are all possible and must be handled defensively in application code.

## Interview Questions & Answers

**Q: What is the `_id` field and how is a default `ObjectId` constructed?**
A: `_id` is the mandatory primary key of every document, unique within its collection and indexed automatically. If not supplied, MongoDB generates a 12-byte `ObjectId` made of a 4-byte timestamp, a 5-byte random value, and a 3-byte incrementing counter — which makes it unique without a central sequence and roughly sortable by creation time.

**Q: When should you embed related data versus reference it?**
A: Embed when the related data is always read together with its parent, is bounded in size, and doesn't need to be updated independently of the parent. Reference when the data is large, shared across many parent documents, updated on its own schedule, or could grow unboundedly — referencing avoids both data duplication and the risk of exceeding the document size limit.

**Q: What is the maximum size of a single BSON document, and why does that limit exist?**
A: 16MB. It exists to keep a single document from consuming excessive RAM and bandwidth on a single read or write, and it's the practical ceiling that makes unbounded array embedding (e.g., an ever-growing comments array inside a post) an anti-pattern rather than a convenience.

**Q: How does querying with a reference differ from an embedded field, performance-wise?**
A: An embedded field is returned as part of the single document read — no extra round trip. A reference requires either a second query (fetch the related `_id`, then query the other collection) or a `$lookup` aggregation stage, which is closer to a SQL join and generally costs more than reading an embedded field, especially at scale.

**Q: Can two documents in the same collection have different sets of fields? Is that a problem?**
A: Yes — MongoDB doesn't enforce a fixed set of fields per collection by default. It's not inherently a problem, but uncontrolled field drift across documents (different field names for the same concept, inconsistent types) makes querying and application code fragile. Teams manage this with JSON Schema validators, ODM-level schemas, or careful migration discipline rather than relying on the database to reject bad shapes.

## Related Topics
- [mongodb-overview.md](./mongodb-overview.md)
- [schema-design.md](./schema-design.md)
- [crud-operations.md](./crud-operations.md)
- [indexes.md](./indexes.md)
