# Non-Functional Requirements

Non-functional requirements describe how the system should behave: availability, latency, scalability, consistency, durability, security, privacy, compliance, maintainability, and cost. These requirements usually drive architecture more than features do.

## Key NFRs

- **Availability:** how often the system must be usable.
- **Latency:** how quickly responses must return.
- **Throughput:** how much traffic the system must handle.
- **Scalability:** ability to grow with users/data.
- **Consistency:** how fresh/correct data must be across replicas.
- **Durability:** whether committed data can be lost.
- **Security:** authentication, authorization, encryption, auditability.
- **Maintainability:** how easily teams can change the system.
- **Cost:** infrastructure and operational expense.

## Example

For a payment system, correctness, idempotency, security, and auditability matter more than ultra-low latency. For a live chat system, latency and availability may matter more than strong global consistency.

## Interview Q&A

**Q: Why are NFRs important in system design?**  
A: They decide architecture tradeoffs. A system needing 99.99% availability, low latency, and strong consistency will require different storage, replication, deployment, and failover decisions than a simple internal tool.

**Q: How do you handle conflicting NFRs?**  
A: Prioritize based on business impact. For example, strong consistency may increase latency; low cost may reduce redundancy; high availability may require eventual consistency.

**Q: Which NFRs are often forgotten?**  
A: Observability, cost, compliance, maintainability, and disaster recovery.

