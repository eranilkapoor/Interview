# Amazon SQS

Amazon SQS (Simple Queue Service) is a fully managed message queue used to decouple producers from consumers so they can scale, fail, and deploy independently. A producer sends a message to a queue and moves on; one or more consumers poll the queue, process messages, and explicitly delete them when done. If a consumer is slow, crashes, or is being deployed, messages simply accumulate in the queue instead of being lost or blocking the producer — this is the core value of asynchronous messaging versus a direct synchronous call between services.

SQS offers two queue types with meaningfully different guarantees. Standard queues offer nearly unlimited throughput, at-least-once delivery, and best-effort ordering — a message can occasionally be delivered more than once or out of order, which is the price paid for massive horizontal scalability. FIFO queues (suffixed `.fifo`) guarantee exactly-once processing and strict ordering within a message group, at the cost of lower throughput (3,000 msg/sec with batching, per API action) and requiring a `MessageGroupId` (and often a `MessageDeduplicationId` or content-based deduplication) on every send. Most systems default to Standard and only reach for FIFO when strict ordering (e.g., financial transaction sequencing) is a hard requirement.

The visibility timeout is the mechanism that makes "at-least-once" safe to build on: when a consumer receives a message, SQS doesn't delete it — it becomes invisible to other consumers for a configurable window (default 30s). If the consumer finishes processing and calls `DeleteMessage` before the timeout expires, the message is gone for good. If the consumer crashes, times out, or simply never calls delete, the message becomes visible again and another consumer picks it up — which is exactly why "at-least-once" means your application code processing a message must be idempotent (safe to run twice), since duplicate delivery is a normal, expected occurrence, not an edge case.

Messages that repeatedly fail processing (bad data, a bug, a downstream dependency permanently down) would otherwise be redelivered forever, blocking the queue and burning consumer resources. A dead-letter queue (DLQ) solves this: you configure a redrive policy with a `maxReceiveCount`, and once a message has been received (and not deleted) that many times, SQS automatically moves it to a separate DLQ instead of redelivering it to the main queue. This isolates poison-pill messages for offline inspection/alerting without stalling healthy traffic.

Polling comes in two modes. Short polling returns immediately, even if the queue is empty, which wastes API calls and can miss messages that arrive milliseconds after the empty response (since SQS only queries a subset of servers). Long polling (`WaitTimeSeconds` up to 20) holds the connection open until a message arrives or the timeout elapses, dramatically cutting empty responses, API cost, and latency — long polling should be the default for virtually every SQS consumer.

## Examples

```bash
# Create a Standard queue with a redrive policy pointing failed messages
# to a DLQ after 5 failed receive attempts, and long polling enabled by default
aws sqs create-queue \
  --queue-name orders-dlq \
  --attributes '{"MessageRetentionPeriod":"1209600"}'

aws sqs create-queue \
  --queue-name orders-queue \
  --attributes '{
    "VisibilityTimeout": "60",
    "ReceiveMessageWaitTimeSeconds": "20",
    "RedrivePolicy": "{\"deadLetterTargetArn\":\"arn:aws:sqs:us-east-1:123456789012:orders-dlq\",\"maxReceiveCount\":\"5\"}"
  }'
```

```bash
# Long-poll for messages, process idempotently, then delete only on success —
# never delete before processing completes, or a crash mid-processing loses the message
aws sqs receive-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789012/orders-queue \
  --wait-time-seconds 20 \
  --max-number-of-messages 10 \
  --attribute-names All

# After successful, idempotent processing of ReceiptHandle "AQEB...":
aws sqs delete-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789012/orders-queue \
  --receipt-handle "AQEB..."
```

```json
// FIFO queue send requiring a MessageGroupId (ordering scope) and a
// MessageDeduplicationId (or content-based dedup) to guarantee exactly-once
{
  "QueueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/payments.fifo",
  "MessageBody": "{\"orderId\": \"ORD-1042\", \"amount\": 49.99}",
  "MessageGroupId": "customer-88213",
  "MessageDeduplicationId": "ORD-1042-charge-attempt-1"
}
```

## Common Pitfalls / Gotchas

- Treating SQS as strictly-ordered, exactly-once by default — Standard queues are neither; duplicate and out-of-order delivery are normal, and consumers must be written idempotently (e.g., using the message's business key to detect and skip reprocessing).
- Deleting a message before processing finishes, or before the side effect (e.g., a DB write) is confirmed durable — a crash between delete and the actual effect silently loses work.
- Setting the visibility timeout too short relative to actual processing time — the message becomes visible again and gets picked up by a second consumer while the first is still working on it, causing duplicate processing under normal (non-crash) conditions.
- Forgetting to configure a DLQ — without one, a permanently-failing message (bad payload, downstream outage) gets redelivered forever, consuming consumer capacity and hiding the fact that something is broken.
- Using short polling (or `WaitTimeSeconds=0`) — burns far more API calls/cost and adds latency for sparse queues; long polling should be the default.
- Choosing FIFO everywhere "to be safe" — its throughput ceiling and per-group serialization can become a real bottleneck; use it only where ordering/exactly-once truly matters, not as a blanket default.

## Interview Questions & Answers

**Q: What does "at-least-once delivery" mean in SQS, and what does it require of your consumer code?**
A: A message may be delivered to a consumer more than once — for example, if the consumer crashes after receiving a message but before deleting it, or if the visibility timeout expires while processing is still in progress. This means consumer logic must be idempotent: processing the same message twice must produce the same end state as processing it once, typically by checking/recording a unique business key before applying an effect like a charge or a database write.

**Q: Explain the visibility timeout and how it relates to duplicate processing.**
A: When a consumer receives a message, SQS hides it from other consumers for the visibility timeout window instead of deleting it immediately. If the consumer deletes the message before the timeout expires, it's gone. If it doesn't (crash, bug, or processing simply took longer than the timeout), the message becomes visible again and can be picked up by another consumer — which is why the timeout should be set comfortably above your expected (p99, not average) processing time.

**Q: What's a dead-letter queue and why is it necessary?**
A: A DLQ is a separate queue that a "poison pill" message — one that has failed processing `maxReceiveCount` times — is automatically moved into via a redrive policy, instead of being redelivered forever. Without a DLQ, a message that always fails (bad data, a permanent downstream error) loops indefinitely, wasting consumer capacity and burying the failure instead of surfacing it for investigation or alerting.

**Q: Standard vs FIFO queues — how do you choose?**
A: Standard gives near-unlimited throughput with at-least-once delivery and best-effort ordering — the right default for most workloads (notifications, logs, generic task queues) where occasional duplication/reordering is tolerable. FIFO guarantees exactly-once processing and strict ordering per `MessageGroupId`, at a much lower throughput ceiling, and is worth the cost only when correctness genuinely depends on order or exact-once semantics, e.g., sequencing debits/credits on the same account.

**Q: Why is long polling generally preferred over short polling?**
A: Short polling returns immediately even when the queue is empty and, because SQS distributes messages across many backend servers, may report an empty result even though a message exists on a server it didn't query — wasting API calls and adding latency to actually receiving the message. Long polling (`WaitTimeSeconds` up to 20) holds the request open until a message arrives or the timeout elapses, cutting down empty responses, cost, and end-to-end latency, with no real downside for typical consumers.

## Related Topics
- [sns.md](./sns.md)
- [lambda.md](./lambda.md)
- [api-gateway.md](./api-gateway.md)
- [cloudwatch.md](./cloudwatch.md)
- [observability.md](./observability.md)
- [well-architected-framework.md](./well-architected-framework.md)
