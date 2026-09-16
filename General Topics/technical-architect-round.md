# Technical Architect Round

Technical architect interviews test system design maturity, tradeoff thinking, scalability, security, integration design, cloud awareness, team guidance, and the ability to convert vague business requirements into reliable technical direction.

## Core Areas to Prepare

- Requirement clarification
- High-level architecture
- API design
- Database selection
- Caching strategy
- Authentication and authorization
- Scalability and performance
- Reliability and fault tolerance
- Observability
- Security
- Cloud deployment
- Cost optimization
- Technical governance
- Migration planning
- Design documentation

## Common Questions and Answer Direction

**Q: How do you design a scalable application?**  
A: Start with requirements: users, traffic, latency, data size, consistency needs, integrations, and failure tolerance. Then discuss frontend, API layer, services, database, cache, queue, storage, CDN, monitoring, and deployment.

**Q: Monolith vs microservices: how do you decide?**  
A: Choose monolith for simpler domains, smaller teams, and faster delivery. Choose microservices when boundaries are clear, teams are independent, scaling needs differ, and operational maturity exists.

**Q: How do you choose SQL vs NoSQL?**  
A: SQL for relational integrity, transactions, reporting, and structured data. NoSQL for flexible schemas, high write scale, document/key-value access, or distributed workloads. Mention access patterns.

**Q: How do you handle performance problems?**  
A: Measure first. Check frontend rendering, API latency, database queries, indexes, cache hit ratio, network calls, memory, CPU, and external dependencies.

**Q: How do you ensure architecture does not become over-engineered?**  
A: Match complexity to real requirements, use evolutionary design, validate assumptions, and avoid distributed systems until needed.

**Q: How do you document architecture?**  
A: Use diagrams, ADRs, API contracts, deployment views, data flow diagrams, threat models, and operational runbooks.

## Example Architecture Answer Structure

1. Clarify functional requirements.
2. Clarify non-functional requirements.
3. Define system boundaries.
4. Propose high-level components.
5. Explain data model and storage.
6. Explain communication patterns.
7. Discuss security.
8. Discuss scalability and reliability.
9. Discuss observability.
10. State tradeoffs and alternatives.

## Common Pitfalls

- Jumping into tools before requirements.
- Saying "microservices" for every problem.
- Ignoring security, monitoring, and failure recovery.
- Not discussing tradeoffs.
- Designing for imaginary scale.

