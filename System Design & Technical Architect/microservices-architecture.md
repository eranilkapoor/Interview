# Microservices Architecture

Microservices split a system into independently deployable services around business capabilities. They can improve team autonomy and scaling but add network, data, observability, and operational complexity.

## Use Microservices When

- Domain boundaries are clear.
- Teams can own services independently.
- Services have different scaling needs.
- Deployment independence is valuable.
- Operational maturity exists.

## Avoid Microservices When

- Team is small.
- Domain is not understood.
- Deployment and monitoring are immature.
- Distributed transactions would dominate.
- A modular monolith would solve the problem.

## Interview Q&A

**Q: How do services communicate?**  
A: Synchronously via REST/gRPC or asynchronously via events/queues. Use sync for immediate responses and async for decoupled workflows.

**Q: How do you handle data consistency across services?**  
A: Avoid shared databases, use service-owned data, events, sagas, idempotency, and eventual consistency where acceptable.

**Q: What is the biggest challenge with microservices?**  
A: Operational complexity: distributed tracing, deployment, versioning, data consistency, network failures, and ownership boundaries.

