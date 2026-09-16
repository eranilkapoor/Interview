# Distributed Systems Concepts

Distributed systems run across multiple machines and communicate over unreliable networks. They are powerful but harder to reason about because failures are partial and timing is unpredictable.

## Key Concepts

- Replication
- Partitioning
- Consensus
- Leader election
- Quorum
- Idempotency
- Retries and timeouts
- Circuit breakers
- Backpressure
- Distributed tracing

## Interview Q&A

**Q: Why are distributed systems hard?**  
A: Because networks fail, messages delay or duplicate, clocks differ, nodes crash, and partial failure is normal.

**Q: What is quorum?**  
A: A minimum number of nodes that must agree or respond before an operation is considered successful.

**Q: Why are retries dangerous?**  
A: Retries can amplify load, create duplicate side effects, and worsen outages unless combined with timeouts, backoff, idempotency, and circuit breakers.

