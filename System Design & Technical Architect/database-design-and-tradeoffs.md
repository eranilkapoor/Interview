# Database Design and Tradeoffs

Database design is one of the most important parts of system design. The right storage choice depends on data model, access patterns, consistency needs, scalability, reporting, latency, and operational maturity.

## Design Steps

1. Identify entities.
2. Identify relationships.
3. Identify read/write patterns.
4. Choose SQL, NoSQL, search, cache, graph, or time-series storage.
5. Define indexes.
6. Plan partitioning and replication.
7. Define backup and restore strategy.

## Common Tradeoffs

- Normalization vs denormalization
- Strong consistency vs availability
- Single database vs polyglot persistence
- Read replicas vs write complexity
- Sharding vs operational complexity

## Interview Q&A

**Q: How do you decide indexes?**  
A: Based on query patterns, filtering, sorting, joins, and cardinality. Indexes speed reads but add write overhead and storage cost.

**Q: When would you denormalize data?**  
A: When read performance and query simplicity matter more than write complexity, and when duplication can be managed safely.

**Q: What is sharding?**  
A: Splitting data across multiple database nodes by a shard key. It improves scale but complicates queries, transactions, migrations, and hot-key handling.

