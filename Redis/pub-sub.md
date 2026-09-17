# Pub/Sub

Redis pub/sub (publish/subscribe) is a simple messaging pattern where publishers send messages to named channels, and any client currently subscribed to that channel receives the message immediately. It's implemented as a lightweight broadcast mechanism: `PUBLISH channel message` sends a message, and `SUBSCRIBE channel` puts a client connection into subscriber mode, where it receives every message published to that channel from that point forward. Pattern subscriptions (`PSUBSCRIBE news.*`) let a client subscribe to multiple channels matching a glob pattern in one call.

The defining characteristic of Redis pub/sub — and the thing interviewers most want you to articulate — is that it is fire-and-forget with no persistence. If a subscriber isn't connected at the moment a message is published, that subscriber simply never receives it; there's no buffering, no message log, no replay, and no acknowledgment mechanism. Redis doesn't track which clients "should" receive which messages beyond the current instant — a message that has no subscribers connected when it's published is discarded immediately with no record that it ever existed. This makes classic pub/sub well suited for ephemeral, best-effort notifications where losing a message occasionally is acceptable: cache invalidation broadcasts to multiple application servers, live chat message delivery to currently-connected clients, real-time dashboards, or coordinating events between processes that are expected to be up simultaneously.

This is precisely where Redis Streams differ and why they were introduced as a separate data type rather than an extension of pub/sub: Streams persist every entry in an append-only log (`XADD`), support consumers reading from any point in history (`XRANGE`, `XREAD` from an offset), and support consumer groups with explicit acknowledgment (`XREADGROUP`/`XACK`), so a message isn't lost if a consumer is offline when it's produced — it just reads it later. Choosing between pub/sub and Streams is really choosing between "broadcast to whoever happens to be listening right now, no history" versus "durable log that any consumer can replay or catch up on."

Redis pub/sub also has an important operational note: subscribed connections are dedicated to receiving messages and generally shouldn't issue normal data commands on the same connection (older Redis versions restricted this more strictly; RESP3 relaxed it somewhat). In a clustered deployment, `PUBLISH` messages are broadcast across the whole cluster via the cluster bus so subscribers connected to any node receive messages published to any node, though `SPUBLISH`/`SSUBSCRIBE` (shard channels) were added for better scalability within Redis Cluster by keeping pub/sub traffic local to a shard.

## Examples

```bash
# Terminal 1: subscribe to a channel and block waiting for messages
127.0.0.1:6379> SUBSCRIBE notifications
Reading messages... (press Ctrl-C to quit)
1) "subscribe"
2) "notifications"
3) (integer) 1
```

```bash
# Terminal 2: publish a message to that channel
127.0.0.1:6379> PUBLISH notifications "cache:user:42 invalidated"
(integer) 1   # returns the number of subscribers that received it
```

```bash
# Pattern subscription across multiple related channels
127.0.0.1:6379> PSUBSCRIBE "orders.*"
Reading messages...
# A PUBLISH to "orders.created" or "orders.shipped" both arrive here
127.0.0.1:6379> PUBLISH orders.created '{"orderId":501}'
(integer) 1
```

## Common Pitfalls / Gotchas

- Assuming a published message is queued for a subscriber that connects later — it isn't. If no client is subscribed at the exact moment of `PUBLISH`, the message is gone permanently; there is no backlog or history in classic pub/sub.
- Using pub/sub for anything that requires guaranteed delivery (billing events, order processing, audit logs) — a dropped connection or a brief subscriber restart silently loses messages with no error surfaced anywhere. Use Streams with consumer groups for that instead.
- Not handling reconnection logic in subscriber clients — if a subscriber's connection drops (network blip, server restart) and reconnects a second later, every message published during that gap is lost with no way to detect or recover it.
- Relying on the return value of `PUBLISH` (subscriber count) as a delivery confirmation — it only tells you how many clients were subscribed *at that instant*, not that they successfully processed the message.
- Overloading a single channel with high-volume, high-fanout traffic without considering `SPUBLISH`/`SSUBSCRIBE` shard channels in a clustered deployment, which can create cluster-bus broadcast overhead as `PUBLISH` propagates to every node.

## Interview Questions & Answers

**Q: What happens to a message published on a channel with zero active subscribers?**
A: It's discarded immediately. Redis pub/sub has no persistence or buffering layer — `PUBLISH` simply delivers the message synchronously to whatever clients are subscribed at that instant and returns the count of recipients (which can be zero). There's no queue holding the message for a client that subscribes a moment later.

**Q: When would you choose Redis Streams over pub/sub for a messaging use case?**
A: Whenever delivery matters even if a consumer is temporarily offline — Streams persist every message in an append-only log, so a consumer can read from where it left off (`XREAD` with a last-seen ID) or use a consumer group (`XREADGROUP`) with explicit acknowledgment (`XACK`) to guarantee at-least-once processing. Pub/sub is appropriate when messages are inherently ephemeral and losing one occasionally is fine — e.g., "refresh your UI, something changed" notifications — but not for anything like order events, payment confirmations, or audit trails.

**Q: How would you implement multi-server cache invalidation using Redis pub/sub?**
A: Each application server subscribes to an invalidation channel (e.g., `SUBSCRIBE cache:invalidate`) on startup. When any server writes data that makes a cached value stale, it calls `PUBLISH cache:invalidate <cache-key>`. Every subscribed server receives the message and evicts that key from its local in-process cache. This works well precisely because the requirement is "best-effort, eventually consistent local caches" — if a server briefly disconnects and misses an invalidation, the worst outcome is a stale local cache entry until the next invalidation or TTL expiry, which is an acceptable failure mode for this use case (unlike, say, financial transactions).

**Q: Does `PUBLISH` guarantee message ordering, and does it block the publisher?**
A: Within a single Redis instance, messages published to the same channel are delivered to a given subscriber in the order they were published, since command processing is single-threaded and sequential. `PUBLISH` itself is a fast, synchronous, non-blocking-from-the-caller's-perspective command — it fans the message out to current subscribers and returns immediately with the subscriber count; it doesn't wait for subscribers to process anything.

**Q: In a Redis Cluster deployment, how does pub/sub behave differently from a single-instance setup, and what problem do shard channels (`SPUBLISH`/`SSUBSCRIBE`) solve?**
A: By default, `PUBLISH` messages are propagated across the entire cluster via the cluster bus, so a client subscribed on any node receives messages published on any other node — this guarantees delivery regardless of which node a subscriber connects to, but means every `PUBLISH` generates cluster-wide broadcast traffic even if only one node actually has subscribers. Shard channels (`SPUBLISH channel message` / `SSUBSCRIBE channel`) scope pub/sub traffic to the shard (hash slot) owning the channel key, avoiding that cluster-wide broadcast overhead for use cases where publishers and subscribers can be co-located by design, at the cost of subscribers needing to connect to the specific shard that owns the channel.

## Related Topics

- [streams.md](./streams.md)
- [redis-cluster.md](./redis-cluster.md)
- [redis-overview.md](./redis-overview.md)
- [caching-patterns.md](./caching-patterns.md)
