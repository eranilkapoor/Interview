# MongoDB Overview

MongoDB is a document-oriented NoSQL database: instead of rows in tables with a fixed schema, it stores data as BSON documents (a binary superset of JSON) grouped into collections. Where a relational database forces you to decide up front exactly which columns every row will have, and to split related data across multiple normalized tables joined at query time, MongoDB lets each document carry its own shape — nested objects, arrays, and optional fields — and stores an entire logical entity (say, an order with its line items and shipping address) as one self-contained document. The rough mapping is: database → database, collection → table, document → row, field → column — but the analogy breaks down quickly because documents are hierarchical and schema-flexible, while rows are flat and schema-rigid.

That schema flexibility is MongoDB's central tradeoff. It's a genuine advantage when your data is naturally document-shaped (a user profile, a product catalog entry, an event log, a CMS page) or when your schema evolves quickly and you don't want a migration for every new optional field. It becomes a liability when your data is inherently relational — many entities that reference each other in complex, many-to-many ways, with strong consistency and ad-hoc join requirements across all of them — because MongoDB's `$lookup` joins are less mature and less performant than a relational engine's, and without application-level discipline "flexible schema" can degrade into "no schema," where documents in the same collection drift into inconsistent shapes over time. MongoDB reduces that risk with optional JSON Schema validation attached to a collection, but the flexibility is still opt-out rather than opt-in the way a relational schema is.

In practice, "MongoDB vs. relational" isn't really an either/or choice at the level of "which database should this company use" — it's a per-workload decision. Content and catalog data, product/user profiles, real-time analytics on semi-structured events, and systems that need to scale writes horizontally across commodity hardware tend to fit MongoDB well. Systems that need multi-row, multi-table ACID transactions as their primary access pattern, heavy ad-hoc joins across many normalized tables, or strict referential integrity enforced by the database itself (foreign keys, cascading constraints) tend to fit a relational database better. Modern MongoDB (4.0+) does support multi-document ACID transactions, which narrows this gap, but transactions remain the exception rather than the default access pattern in a well-designed MongoDB schema — the idiomatic approach is to model data so that a single document read or write covers what you need, and only reach for a transaction when that's genuinely not possible.

## Examples

```js
// A document-oriented view of an order — one document holds the whole entity
db.orders.insertOne({
  _id: ObjectId(),
  customerId: ObjectId("64f1a2b3c4d5e6f7a8b9c0d1"),
  status: "paid",
  items: [
    { sku: "SKU-1001", qty: 2, price: 19.99 },
    { sku: "SKU-2002", qty: 1, price: 49.99 }
  ],
  shippingAddress: { city: "Austin", state: "TX", zip: "78701" },
  createdAt: new Date()
});
```

```js
// Inspecting the "shape" of documents already in a collection —
// there's no schema catalog to query; you introspect the data itself
db.orders.findOne();               // see one full document
db.orders.find().limit(5).pretty(); // eyeball a sample for shape drift
```

```js
// Optional schema validation — MongoDB is schema-flexible by default,
// but you can enforce structure per collection when you need guardrails
db.createCollection("orders", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["customerId", "status", "items"],
      properties: {
        status: { enum: ["pending", "paid", "shipped", "cancelled"] },
        items: { bsonType: "array", minItems: 1 }
      }
    }
  }
});
```

## Common Pitfalls / Gotchas

- Treating "schema-flexible" as "no design needed" — without deliberate modeling, collections drift into inconsistent document shapes that are painful to query and migrate later.
- Porting a fully normalized relational schema straight into MongoDB (one collection per relational table, joined constantly with `$lookup`) — this throws away the main benefit of the document model and performs worse than either a proper relational design or a proper document design.
- Assuming MongoDB has no schema at all — validators, application-level ODMs (like Mongoose), and disciplined field naming all impose schema; it's just enforced outside the storage engine by default instead of baked into `CREATE TABLE`.
- Choosing MongoDB purely for "web scale" reasons without checking whether the workload is actually document-shaped and whether the team is prepared to handle eventual consistency and denormalization tradeoffs.

## Interview Questions & Answers

**Q: How does MongoDB's data model differ from a relational database's?**
A: MongoDB stores self-contained BSON documents in collections, where each document can have its own fields and nested structure. A relational database stores flat rows in rigidly-typed tables and relies on joins across normalized tables to reconstruct a full entity. MongoDB favors embedding related data into one document to avoid joins; relational databases favor normalization and joins to avoid duplication.

**Q: When would you choose MongoDB over a relational database, and vice versa?**
A: Choose MongoDB when data is naturally document-shaped, the schema evolves frequently, you need to scale writes horizontally, or most reads fetch one logical entity at a time. Choose a relational database when you need strong multi-table transactional guarantees as the default access pattern, heavy ad-hoc joins across many normalized entities, or strict referential integrity enforced by the database itself.

**Q: Is MongoDB "schema-less"? What does that actually mean in practice?**
A: Not really — it's schema-flexible, not schema-less. There's no mandatory table definition, so documents in the same collection can technically have different fields, but real applications still have an implicit or explicit schema, enforced through JSON Schema validators, an ODM layer, or team convention. The difference from relational databases is where and how strictly that schema is enforced, not whether one exists.

**Q: What is BSON and why does MongoDB use it instead of plain JSON?**
A: BSON (Binary JSON) is a binary-encoded superset of JSON that adds types JSON lacks natively — like `Date`, `ObjectId`, `Decimal128`, and binary data — and is faster to parse and more compact to traverse than text JSON because field lengths are encoded up front instead of requiring a full text scan.

**Q: What's a common mistake teams make when moving from a relational database to MongoDB?**
A: Recreating the relational schema one-to-one — a collection per table, foreign-key-style references everywhere, and constant `$lookup` joins. This gives up the main benefit of the document model (fetching a whole entity in one read) while still not getting the referential integrity guarantees a relational database provides. The better approach is to redesign around access patterns: embed what's read together, reference what's large, shared, or independently updated.

## Related Topics
- [documents-and-collections.md](./documents-and-collections.md)
- [schema-design.md](./schema-design.md)
- [crud-operations.md](./crud-operations.md)
- [transactions.md](./transactions.md)
