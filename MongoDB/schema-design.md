# Schema Design

MongoDB schema design is organized around a single guiding question that's the opposite of relational design's starting point: "what does my application read and write, and how often?" — rather than "what is the fully normalized representation of this data?" Relational modeling starts from normalization (eliminate redundancy, one fact in one place) and defers performance concerns to query planning and joins at read time. MongoDB modeling starts from access patterns and treats some redundancy as an acceptable, even desirable, cost if it means the data you need for a given read is already sitting together in one document.

The central decision, covered in more depth in documents-and-collections, is embedding versus referencing, and it plays out differently for different relationship shapes. For one-to-few relationships (an order with a handful of line items, a blog post with a handful of tags), embedding is almost always right — the data is small, bounded, and read together. For one-to-many where "many" could grow large or unbounded (a customer with years of orders, a post with thousands of comments), the standard pattern flips: reference from the "many" side back to the "one" side (each order stores a `customerId`), rather than embedding an ever-growing array inside the "one" document. For many-to-many relationships (students and courses, products and categories), the common patterns are either referencing with an array of ids on one or both sides (a `studentIds` array on course, or vice versa) or, if the relationship itself carries data (an enrollment date, a grade), modeling the relationship as its own collection — effectively a join table, but one you query explicitly rather than one SQL joins implicitly.

Denormalization — deliberately duplicating a piece of data into multiple documents — is a first-class MongoDB technique, not a mistake to be avoided the way it often is in relational design. A common example: embedding a denormalized `customerName` directly on an order document, even though the canonical name lives on the customer document, because displaying an order list should not require a `$lookup`/join for every single row. The cost is that when a customer changes their name, every order that duplicated it is now stale unless you either accept that staleness (fine for a historical record like a shipped order) or run an update to propagate the change (justified when the duplicated field changes rarely and read volume is very high). Denormalization is a read-performance-for-write-complexity trade, and the right call depends on how often the duplicated data changes versus how often it's read.

The practical process is: identify your application's actual queries first (what does the dashboard load, what does the API endpoint return, what does the report aggregate), then design documents so the common queries are single-document reads wherever feasible, and only reach for references, `$lookup`, or a separate collection when the data is too large, too shared, or too independently-changing to embed. This is why two teams building superficially similar apps can land on very different MongoDB schemas — the "right" schema is a function of the read/write pattern, not an abstract property of the data's relationships the way a normalized relational schema is.

## Examples

```js
// One-to-few: embed. Tags are small, bounded, and always read with the post.
db.posts.insertOne({
  title: "MongoDB Schema Design",
  tags: ["mongodb", "nosql", "databases"],
  body: "..."
});
```

```js
// One-to-many (unbounded): reference from the "many" side.
// A customer could have thousands of orders — don't embed an array of them.
db.customers.insertOne({ _id: ObjectId("64f1..."), name: "Jane Doe" });
db.orders.insertOne({ _id: ObjectId(), customerId: ObjectId("64f1..."), total: 59.98 });

// Fetch a customer's orders with a separate query, not an embedded array
db.orders.find({ customerId: ObjectId("64f1...") });
```

```js
// Denormalization for read performance: duplicate customerName onto the order
// so listing orders doesn't require a $lookup for every row.
db.orders.insertOne({
  _id: ObjectId(),
  customerId: ObjectId("64f1..."),
  customerName: "Jane Doe",   // duplicated, accepted as stale for shipped orders
  total: 59.98,
  status: "shipped"
});

// Many-to-many with relationship data: model the relationship as its own collection
db.enrollments.insertOne({
  studentId: ObjectId("64f2..."),
  courseId: ObjectId("64f3..."),
  enrolledAt: new Date(),
  grade: null
});
```

## Common Pitfalls / Gotchas

- Designing the schema around the data's abstract relationships instead of the application's actual read/write patterns — a "textbook normalized" MongoDB schema often performs worse than one shaped by real queries.
- Embedding an unbounded one-to-many relationship (all of a customer's orders, all comments on a post) — this risks the 16MB document size limit and makes every write to the parent progressively more expensive as the array grows.
- Denormalizing data that changes frequently without a plan to propagate updates — duplicated fields that go stale silently (e.g., a duplicated price that never gets updated after a price change) cause subtle correctness bugs.
- Defaulting to referencing everything "to be safe" — over-referencing brings back the join costs and multiple-round-trip latency that the document model exists to avoid, for data that's small enough to just embed.
- Not revisiting schema decisions as access patterns change — a schema designed for one dashboard query can become a poor fit once a new feature needs a different, unanticipated read pattern.

## Interview Questions & Answers

**Q: What's the core difference between MongoDB schema design and relational schema design?**
A: Relational design starts from normalization — eliminate redundancy, one fact stored in one place — and relies on joins at query time to reconstruct related data. MongoDB design starts from the application's access patterns — what gets read together, how often, at what scale — and deliberately accepts some data duplication (denormalization) when it means common reads become single-document lookups instead of joins.

**Q: How do you decide whether to embed or reference a one-to-many relationship?**
A: It depends on whether the "many" side is bounded and always read with the "one" side. A handful of order line items: embed. A customer's potentially unbounded order history: reference, storing the `customerId` on each order and querying the orders collection separately, so the customer document doesn't grow without bound.

**Q: How would you model a many-to-many relationship, like students and courses, in MongoDB?**
A: If the relationship carries no extra data, reference with arrays of ids on one or both sides (e.g., a `courseIds` array on each student). If the relationship itself carries data — an enrollment date, a grade — model it as its own collection (an `enrollments` collection with `studentId` and `courseId` fields), similar to a relational join table, queried explicitly.

**Q: What is denormalization in MongoDB, and when is it justified?**
A: Deliberately duplicating a field into multiple documents to avoid a join/lookup at read time — e.g., storing a customer's name directly on each order. It's justified when the duplicated field changes rarely (or its staleness is acceptable, like a name at the time an order shipped) and the read volume that would otherwise need a `$lookup` is high; it's a read-performance-for-write-complexity tradeoff, not a universal default.

**Q: What's a common schema design mistake teams make when they're new to MongoDB?**
A: Porting a fully normalized relational schema directly — a collection per entity, foreign-key-style references everywhere, joining constantly with `$lookup`. This gives up the main advantage of the document model (fetching a whole logical entity in a single read) without gaining the referential integrity a relational database enforces natively.

## Related Topics
- [documents-and-collections.md](./documents-and-collections.md)
- [mongodb-overview.md](./mongodb-overview.md)
- [indexes.md](./indexes.md)
- [transactions.md](./transactions.md)
- [sharding.md](./sharding.md)
