# Event-Driven Architecture

Event-driven architecture uses events to communicate that something happened. It decouples producers and consumers and is useful for scalable, asynchronous workflows.

## Common Components

- Producer
- Event broker
- Topic or queue
- Consumer
- Dead-letter queue
- Retry policy
- Event schema

## Use Cases

- Order processing
- Notification systems
- Audit logging
- Data synchronization
- Async workflows
- Streaming analytics

## Interview Q&A

**Q: Queue vs topic?**  
A: Queue usually distributes messages among consumers in a group. Topic broadcasts events to multiple subscribers.

**Q: How do you handle duplicate events?**  
A: Design consumers to be idempotent, use unique event IDs, deduplication tables, and safe retry logic.

**Q: What is a dead-letter queue?**  
A: A place for messages that cannot be processed after retries. It helps inspect failures without blocking the main queue.

