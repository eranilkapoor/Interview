# System Design Interview Framework

System design interviews test how you think through ambiguity. The interviewer is not looking for one perfect architecture; they are checking whether you can clarify requirements, make reasonable assumptions, choose components, explain tradeoffs, and evolve the design under constraints.

## 45-Minute Structure

1. **Clarify requirements:** users, features, business goals, exclusions.
2. **Define non-functional requirements:** scale, latency, availability, consistency, security, compliance, cost.
3. **Estimate traffic and storage:** requests per second, data size, read/write ratio.
4. **Define APIs:** request/response shape, authentication, error handling.
5. **Design data model:** entities, relationships, indexes, partitioning.
6. **Create high-level architecture:** clients, gateway, services, databases, cache, queue, storage.
7. **Deep dive:** choose one or two important areas.
8. **Discuss failure modes:** retries, idempotency, failover, rate limiting.
9. **Discuss observability:** logs, metrics, traces, alerts.
10. **Summarize tradeoffs:** why this design is suitable and what you would improve later.

## Strong Opening Questions

- Who are the users?
- What are the must-have features?
- What is out of scope?
- What is the expected traffic?
- Is the system read-heavy or write-heavy?
- What latency is acceptable?
- Is strong consistency required?
- Are there compliance or security requirements?
- What is the expected availability?

## Interview Q&A

**Q: What is the first thing you do in a system design interview?**  
A: Clarify requirements. Do not jump into databases or microservices before knowing the business goal, core features, scale, and constraints.

**Q: How much estimation is needed?**  
A: Enough to justify design choices. You do not need exact math, but you should estimate traffic, storage, and read/write ratio to decide caching, partitioning, and scaling strategy.

**Q: What makes a senior design answer strong?**  
A: Tradeoff thinking. A senior answer explains why one approach fits the constraints, what it sacrifices, how it fails, and how to monitor or evolve it.

## Common Mistakes

- Starting with technology choices before requirements.
- Designing for unrealistic scale.
- Ignoring security and observability.
- Not discussing failure scenarios.
- Giving a diagram without explaining data flow.

