# Amazon SNS

SNS (Simple Notification Service) is a fully managed publish/subscribe messaging service — a publisher sends a single message to an SNS topic, and SNS pushes a copy of that message to every current subscriber of the topic, without the publisher needing to know who or how many subscribers exist. This is the core architectural value: it decouples the producer from consumers entirely, letting you add or remove subscribers over time without ever touching the publishing code. Subscribers can be SQS queues, Lambda functions, HTTP/HTTPS endpoints, email, SMS, or mobile push notification services — a single topic can fan a single published message out to all of them simultaneously.

That fan-out capability is the defining SNS pattern: publish one order-created event to a topic, and have it simultaneously trigger a Lambda function that sends a confirmation email, land on an SQS queue that a fulfillment service polls, and hit an HTTPS webhook for a partner integration — all from one publish call, with each consumer processing independently and at its own pace. This is frequently combined with SQS specifically because SNS itself is push-based and doesn't durably retain a message if a subscriber is briefly unavailable (HTTP endpoints in particular can fail delivery), whereas an SQS queue subscribed to the topic durably holds the message until a consumer is ready to process it — the "fan-out to SQS" pattern gives you both broadcast semantics and durable, at-your-own-pace consumption.

Subscription filter policies let each subscriber declare, as a JSON policy attached to its subscription, which messages it actually wants based on message attributes — so a topic can publish every order event, while a "high-value orders" subscriber's filter policy only lets messages with `orderTotal > 500` reach it, without the publisher needing any awareness of that filtering logic or having to publish to multiple topics. This keeps a single topic reusable for many different downstream concerns instead of requiring topic-per-consumer-type sprawl.

SNS offers two topic types with materially different guarantees. Standard topics provide at-least-once delivery with best-effort ordering (messages can arrive out of order or, rarely, be delivered more than once) and support very high, effectively unbounded throughput — the right default for most notification/event use cases where occasional duplicates or reordering are tolerable or handled idempotently downstream. FIFO topics provide strict ordering (within a message group) and exactly-once delivery, at the cost of significantly lower throughput limits, and they can only deliver to FIFO SQS queues, not Lambda, HTTP, or other subscriber types directly — FIFO topics are for cases where order and exact-once semantics genuinely matter (e.g., a sequence of state-transition events for a single order that must be processed in order).

## Examples

```bash
# Create a standard topic and subscribe an SQS queue to it — the canonical
# fan-out-to-SQS pattern, giving durable buffering downstream of a broadcast topic
aws sns create-topic --name order-events
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:111122223333:order-events \
  --protocol sqs \
  --notification-endpoint arn:aws:sqs:us-east-1:111122223333:fulfillment-queue
```

```javascript
// Publish a message with attributes using AWS SDK v3 — subscribers with a matching
// filter policy on `orderTotal` will receive it, others won't, with no code change
// needed on the publisher side to add or remove filtered subscribers later.
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const sns = new SNSClient({});

await sns.send(new PublishCommand({
  TopicArn: "arn:aws:sns:us-east-1:111122223333:order-events",
  Message: JSON.stringify({ orderId: "ord_123", orderTotal: 742.50 }),
  MessageAttributes: {
    orderTotal: { DataType: "Number", StringValue: "742.50" },
  },
}));
```

```json
// Subscription filter policy — only orders over 500 reach this particular subscriber,
// even though the publisher sends every order event to the same topic
{
  "orderTotal": [{ "numeric": [">", 500] }]
}
```

## Common Pitfalls / Gotchas

- Publishing directly to Lambda/HTTP subscribers without an SQS buffer in between and assuming durability — if a Lambda subscriber is throttled or an HTTP endpoint is briefly down, SNS retries with backoff but ultimately can drop the message after retries are exhausted; SQS fan-out gives durable at-least-once buffering that raw HTTP/Lambda subscriptions don't.
- Forgetting that FIFO topics can only deliver to FIFO SQS queues — you cannot subscribe a Lambda function or HTTPS endpoint directly to a FIFO topic, which surprises teams that assume FIFO is a drop-in upgrade to a standard topic.
- Not confirming SQS subscriptions' access policy correctly — the SQS queue's resource policy must explicitly allow the SNS topic to send messages to it, a step that's easy to miss when subscribing programmatically outside the console (which sets it up automatically).
- Assuming standard-topic ordering — standard topics are best-effort ordered, so a consumer that requires strict sequential processing of events (e.g., "created" before "shipped") needs either a FIFO topic/queue pair or to handle reordering/deduplication itself.
- Over-relying on filter policies as a security boundary — filter policies control which messages a subscriber receives, not authorization to the topic itself; anyone with `sns:Subscribe` permission on the topic can still subscribe and choose their own filter.
- Publishing large payloads directly in the SNS message body instead of a reference — SNS messages are capped at 256 KB just like SQS, so large payloads (e.g., full documents or images) need to be stored in S3 with only a reference published through the topic.

## Interview Questions & Answers

**Q: Explain the SNS fan-out pattern and why it's commonly paired with SQS.**
A: SNS fan-out means publishing one message to a topic and having it delivered to multiple independent subscribers simultaneously — Lambda functions, SQS queues, HTTP endpoints, email, and so on — decoupling the publisher from needing to know who consumes its events. It's commonly paired with SQS specifically because SNS itself doesn't durably retain undelivered messages if a subscriber is unavailable; subscribing an SQS queue to the topic gives that branch of the fan-out durable, at-least-once storage that a consumer can process at its own pace, combining broadcast semantics with reliable buffered consumption.

**Q: What's the difference between a standard SNS topic and a FIFO SNS topic?**
A: Standard topics offer at-least-once delivery with best-effort ordering and very high throughput — messages can occasionally arrive out of order or be duplicated, which is fine for most notification and event-broadcasting use cases. FIFO topics guarantee strict ordering within a message group and exactly-once delivery, but at significantly lower throughput, and they can only fan out to FIFO SQS queues — not Lambda or HTTP subscribers directly — making them appropriate specifically when message order and exact-once processing are correctness requirements, not just nice-to-haves.

**Q: How do subscription filter policies work, and what problem do they solve?**
A: Each subscription can attach a JSON filter policy that declares which message attributes it wants to receive — SNS evaluates each published message's attributes against every subscriber's filter policy and only delivers to subscribers whose policy matches. This solves the problem of needing many different narrow consumers off of one broad event stream without the publisher having to know about or branch its publishing logic for each consumer's specific interest; a single topic can serve many different downstream concerns, and adding a new filtered subscriber requires zero changes to the publisher.

**Q: If a subscriber's Lambda function is being throttled, what happens to messages SNS tries to push to it?**
A: SNS retries delivery to a failing or throttled Lambda subscriber using an exponential backoff retry policy for a configurable period, but if retries are exhausted without success, the message is dropped unless a dead-letter queue is configured on the subscription to capture it. This is exactly why the fan-out-to-SQS pattern is preferred for anything that needs durability guarantees — an SQS-backed subscription holds the message until a consumer successfully processes it, rather than relying on SNS's bounded retry window.

## Related Topics
- [sqs.md](./sqs.md)
- [lambda.md](./lambda.md)
- [api-gateway.md](./api-gateway.md)
- [cloudwatch.md](./cloudwatch.md)
- [fault-isolation.md](./fault-isolation.md)
