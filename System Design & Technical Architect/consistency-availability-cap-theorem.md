# Consistency, Availability, and CAP Theorem

CAP theorem says that during a network partition, a distributed system must choose between consistency and availability. It does not mean you always choose only two out of three in normal operation.

## Terms

- **Consistency:** every read gets the latest write.
- **Availability:** every request receives a non-error response.
- **Partition tolerance:** system continues despite network splits.

## Consistency Models

- Strong consistency
- Eventual consistency
- Read-your-writes consistency
- Causal consistency

## Interview Q&A

**Q: Explain CAP theorem simply.**  
A: If network communication breaks between nodes, the system can either reject some requests to preserve consistency or accept requests and risk stale/conflicting data.

**Q: When is eventual consistency acceptable?**  
A: Feeds, analytics, notifications, search indexes, recommendations, and non-critical counters. It is usually not acceptable for payments or inventory reservation without safeguards.

**Q: How do you handle conflicts?**  
A: Versioning, timestamps, vector clocks, business rules, conflict resolution workflows, or choosing a single writer.

