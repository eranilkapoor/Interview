# SQL vs NoSQL

SQL databases are relational and schema-driven. NoSQL databases include document, key-value, wide-column, and graph databases. The choice should come from access patterns and consistency requirements, not fashion.

## Choose SQL When

- Strong transactions are needed.
- Relationships and joins are important.
- Reporting and ad hoc queries matter.
- Data structure is stable.
- Consistency is critical.

## Choose NoSQL When

- Schema is flexible.
- Data is document-like or key-value.
- Horizontal scaling is a primary requirement.
- Access patterns are simple and predictable.
- High write throughput is needed.

## Interview Q&A

**Q: Is NoSQL always more scalable than SQL?**  
A: No. Many SQL databases scale very well with replicas, partitioning, and managed cloud services. NoSQL can scale horizontally more naturally for certain access patterns, but it has tradeoffs.

**Q: Can MongoDB support transactions?**  
A: Yes, MongoDB supports multi-document transactions, but document modeling should still avoid unnecessary distributed transactions where possible.

**Q: What is polyglot persistence?**  
A: Using different databases for different needs, such as PostgreSQL for transactions, Redis for cache, Elasticsearch for search, and S3 for object storage.

