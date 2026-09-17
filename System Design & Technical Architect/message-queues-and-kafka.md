# Message Queues and Kafka

A message queue or event streaming platform decouples the service that produces work or an event (the producer) from the service that processes it (the consumer), so they don't need to be online, fast, or available at the same moment. Instead of a producer calling a consumer's API directly and waiting for a response (synchronous, tightly coupled, and only as reliable as the consumer's uptime), the producer writes a message to the broker and moves on; the consumer reads and processes it independently, at its own pace. This is the backbone of scalable microservice communication for anything that doesn't need an immediate response: order processing, notifications, analytics events, audit logs, and cross-service data synchronization.

Kafka is a distributed event streaming platform, and it's architecturally different from a traditional message queue like RabbitMQ or SQS in an important way: Kafka retains messages on disk for a configurable retention period (not just until they're consumed), organizes them into **topics** split across **partitions** for parallelism, and lets multiple independent **consumer groups** each read the full stream at their own pace and offset — a message isn't deleted once one consumer reads it. A traditional queue (RabbitMQ, SQS) is closer to a work-distribution model: a message is typically delivered to one consumer in a group and then removed, better suited to "exactly one worker should handle this job" than to "many independent systems all need to react to this event, potentially replaying history."

Within a Kafka topic, each partition is an ordered, append-only log; Kafka guarantees ordering *within* a partition but not across partitions of the same topic, which is why choosing a good partition key (e.g. a customer ID, so all events for one customer land on the same partition and stay ordered relative to each other) matters for correctness. Consumers within a consumer group divide the partitions among themselves so the group as a whole processes the topic in parallel, while each consumer tracks its own **offset** (position in the log) so it can resume where it left off after a restart.

## Common Components

- Producer — writes events to a topic
- Broker — a Kafka server that stores and serves partitions
- Topic — a named stream of events, split into partitions
- Partition — an ordered, append-only log; the unit of parallelism
- Consumer group — a set of consumers sharing the work of reading a topic
- Offset — a consumer's bookmark/position within a partition
- Dead-letter queue (DLQ) — where messages that repeatedly fail processing are routed for later inspection
- Retry policy — controls how and how many times a failed message is retried before going to the DLQ

## Kafka vs RabbitMQ vs SQS

| | Kafka | RabbitMQ | SQS |
|---|---|---|---|
| Model | Distributed log, retained on disk | Traditional message broker | Managed cloud queue |
| Delivery | Multiple consumer groups can each replay the full stream | Typically one consumer per message within a group | One consumer per message (standard) or FIFO ordering (FIFO queues) |
| Ordering | Guaranteed per-partition | Guaranteed per-queue (single consumer) | Best-effort (standard) or per-message-group (FIFO) |
| Best for | High-throughput event streaming, replay, multiple independent consumers | Complex routing (exchanges), task queues, RPC-style patterns | Simple, fully-managed decoupling within AWS, minimal ops overhead |
| Ops overhead | Higher (cluster, ZooKeeper/KRaft, partitions to manage) | Moderate | Lowest (fully managed) |

## Designing Reliable Consumers

- **Idempotency**: a consumer can receive the same message more than once (most brokers offer at-least-once delivery, not exactly-once, in practice), so processing must be safe to repeat — e.g. an `upsert` keyed on a unique event ID rather than a raw `insert` that would create duplicates.
- **Retry with backoff**: transient failures (a downstream service briefly unavailable) should be retried with exponential backoff rather than either failing permanently or retrying in a tight loop that amplifies load on an already-struggling downstream service.
- **Dead-letter queue**: after a bounded number of retries, a message that still fails should be moved to a DLQ instead of blocking the partition/queue indefinitely or being silently dropped — this lets the rest of the stream keep flowing while the failed message is inspected and reprocessed manually or by a separate remediation job.
- **Circuit breaker**: if a downstream dependency a consumer calls is failing consistently, a circuit breaker stops sending it requests for a cooldown period instead of retrying every message against a service that's clearly down, preventing pointless load and faster-failing back to the DLQ/retry path.

## Use Cases

- Order processing pipelines (order placed → payment → notification → analytics, each as an independent consumer)
- Notification systems (fan-out a single event to email, SMS, and push services)
- Audit logging (an immutable, replayable record of what happened)
- Data synchronization between services/databases (change data capture)
- Asynchronous, long-running workflows (document processing, report generation)
- Real-time analytics and stream processing

## Interview Questions & Answers

**Q: Why use Kafka instead of having services call each other's APIs directly?**
A: Direct synchronous calls couple the caller's success and latency to the callee's availability and speed — if the downstream service is slow or down, the caller is blocked or fails too. Kafka decouples them: the producer writes an event and moves on regardless of whether consumers are currently online, consumers process at their own pace, and multiple independent consumers can react to the same event without the producer needing to know about any of them.

**Q: How does Kafka guarantee ordering, and what's the catch?**
A: Kafka guarantees ordering only *within* a single partition, not across an entire topic. Messages with the same partition key always land on the same partition and are processed in the order they were written. This means choosing a partition key that groups related events together (e.g. all events for one entity) is essential if relative ordering between those events matters — a poor key choice can silently break ordering guarantees the application actually depends on.

**Q: Queue vs topic — what's the practical difference in delivery semantics?**
A: A queue-style model (RabbitMQ work queues, SQS standard queues) typically delivers each message to exactly one consumer in a group, and the message is effectively gone once processed — suited to distributing discrete units of work. A topic-style model (Kafka, pub/sub) allows multiple independent consumer groups to each read the entire stream at their own offset, and messages are retained regardless of whether they've been "consumed" — suited to broadcasting events to multiple independent systems that each care about them for different reasons.

**Q: How do you handle a message that keeps failing to process?**
A: Retry a bounded number of times with exponential backoff to absorb transient failures, then route the message to a dead-letter queue instead of retrying forever or dropping it silently. The DLQ lets the rest of the stream keep flowing uninterrupted while the failed message is inspected, fixed, and reprocessed (or discarded) separately — blocking an entire partition on one poison message would stall everything behind it.

**Q: Why does exactly-once processing matter, and how do you actually achieve it in practice?**
A: Most brokers, including Kafka in typical configurations, provide at-least-once delivery — a message can be redelivered after a consumer crash before it commits its offset, for example. True exactly-once *processing* is usually achieved not by relying on the broker alone, but by making the consumer's side effect idempotent — e.g. using the message's unique ID as an idempotency key in an upsert, or maintaining a processed-IDs table checked before applying an effect — so redelivery is harmless even though delivery itself isn't guaranteed to happen exactly once.

## Related Topics
- [event-driven-architecture.md](./event-driven-architecture.md)
- [microservices-architecture.md](./microservices-architecture.md)
- [distributed-systems-concepts.md](./distributed-systems-concepts.md)
- [scalability-and-performance.md](./scalability-and-performance.md)
