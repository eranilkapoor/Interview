# Streams

Redis Streams is an append-only log data type, introduced in Redis 5, purpose-built for durable event/message data — the kind of workload people often reach for Kafka to solve, at a smaller scale and with a much simpler operational footprint. Each entry in a stream has a unique, monotonically increasing ID (by default `<millisecond-timestamp>-<sequence>`, though IDs can be assigned explicitly) and a set of field-value pairs, so a stream is essentially a persisted, ordered sequence of small records that multiple independent consumers can read, re-read, and track their position in.

The fundamental operations are `XADD` to append an entry (`XADD mystream '*' field value ...`, where `*` tells Redis to auto-generate the ID), `XRANGE`/`XREVRANGE` to read a slice of the log by ID range (supporting `-`/`+` for the full range), and `XREAD` to read new entries after a given ID, optionally with `BLOCK` to wait for new data like a tail -f. Because entries persist in the stream (subject to trimming, discussed below), a consumer that was offline can catch up by reading from wherever it last left off — this is the core capability pub/sub lacks entirely.

Where Streams really differentiate themselves is consumer groups, which let multiple consumer processes cooperatively process a stream with each entry delivered to exactly one consumer in the group (not broadcast to every consumer, unlike pub/sub or a plain `XREAD`). `XGROUP CREATE` sets up a named group at a starting position, `XREADGROUP GROUP mygroup consumer1 ...` reads new entries and assigns them to that specific consumer, and — critically — each delivered entry sits in a "pending entries list" (PEL) until the consumer explicitly calls `XACK` to confirm it was processed. If a consumer crashes before acknowledging, `XPENDING` reveals the stuck entries and `XCLAIM`/`XAUTOCLAIM` let another consumer take over ownership of them, giving Streams at-least-once delivery semantics with explicit failure recovery — something neither plain pub/sub nor a plain list-based queue provides out of the box.

Unlike RDB/AOF-only durability, streams don't grow forever by default in most real deployments — teams typically cap size with `XADD ... MAXLEN ~ 10000 ...` (approximate trimming, cheaper than exact) or trim explicitly with `XTRIM`, balancing "how much history do consumers actually need to replay" against unbounded memory growth. The contrast worth internalizing for interviews: pub/sub is ordered, fire-and-forget broadcast with zero persistence; a list-based queue (`LPUSH`/`BRPOP`) gives durable point-to-point delivery but no replay once popped and no multi-consumer-group fan-out; Streams give durable, replayable, ordered logs with both broadcast-style (`XREAD` by multiple independent readers) and load-balanced (`XREADGROUP` by a consumer group) consumption patterns.

## Examples

```bash
# Append events to a stream with auto-generated IDs
127.0.0.1:6379> XADD orders:events '*' orderId 501 status "created"
"1700000000000-0"
127.0.0.1:6379> XADD orders:events '*' orderId 501 status "shipped"
"1700000000123-0"
127.0.0.1:6379> XRANGE orders:events - +
1) 1) "1700000000000-0"
   2) 1) "orderId"
      2) "501"
      3) "status"
      4) "created"
2) 1) "1700000000123-0"
   2) 1) "orderId"
      2) "501"
      3) "status"
      4) "shipped"
```

```bash
# Consumer group setup and reading with per-consumer delivery + ack
127.0.0.1:6379> XGROUP CREATE orders:events order-processors 0
OK
127.0.0.1:6379> XREADGROUP GROUP order-processors worker-1 COUNT 10 STREAMS orders:events '>'
1) 1) "orders:events"
   2) 1) 1) "1700000000000-0"
         2) 1) "orderId"
            2) "501"
            3) "status"
            4) "created"
127.0.0.1:6379> XACK orders:events order-processors 1700000000000-0
(integer) 1
```

```bash
# Inspect unacknowledged entries and cap stream size
127.0.0.1:6379> XPENDING orders:events order-processors
1) (integer) 1
2) "1700000000123-0"
3) "1700000000123-0"
4) 1) 1) "worker-1"
      2) "1"
127.0.0.1:6379> XADD orders:events MAXLEN '~' 10000 '*' orderId 502 status "created"
"1700000000456-0"
```

## Common Pitfalls / Gotchas

- Treating `XREAD` (without a consumer group) as load-balanced across multiple readers — it isn't; every independent `XREAD` caller sees the same entries (broadcast-like), whereas `XREADGROUP` within a consumer group distributes distinct entries across consumers so each entry goes to exactly one consumer in that group.
- Forgetting to call `XACK` after successfully processing an entry read via `XREADGROUP` — unacknowledged entries stay in the pending entries list forever, consuming memory and needing manual recovery (`XPENDING` + `XCLAIM`/`XAUTOCLAIM`) if the original consumer never comes back.
- Letting a stream grow unbounded with no `MAXLEN`/`XTRIM` policy — since every `XADD` is durable and kept until trimmed, an unbounded high-throughput stream will consume ever-increasing memory.
- Confusing Streams with pub/sub and assuming stream reads are "live only" — `XRANGE`/`XREAD` from an explicit ID can replay history; the log persists past the moment of writing, unlike a pub/sub message.
- Not handling consumer crash-recovery — if a consumer dies mid-processing, its claimed entries sit in the PEL under its name until another process notices via `XPENDING` and reclaims them with `XCLAIM`/`XAUTOCLAIM`; a naive implementation that never checks pending entries can silently drop work forever.

## Interview Questions & Answers

**Q: What's the core difference between Redis Streams and Redis pub/sub?**
A: Streams persist every entry in an ordered, append-only log with unique IDs, so consumers can read historical entries, catch up after being offline, and replay from any point; pub/sub delivers messages only to clients subscribed at the exact instant of publish, with zero persistence — a message to a channel with no active subscribers is gone forever. Streams trade the pure simplicity of pub/sub for durability and replayability, at the cost of needing to think about trimming (memory growth) and consumer position tracking.

**Q: How do consumer groups in Streams differ from just having multiple clients call `XREAD` on the same stream?**
A: With plain `XREAD`, every client that reads the stream sees the same entries — it's a broadcast/fan-out read model, like each reader having their own view of the whole log. With a consumer group (`XGROUP CREATE` + `XREADGROUP`), each new entry is delivered to exactly one consumer within the group, giving load-balanced, competing-consumers semantics — useful for scaling out processing of a single logical workload across multiple worker processes, where you want each event handled once, not once per worker.

**Q: What happens if a consumer in a group reads an entry via `XREADGROUP` but crashes before calling `XACK`?**
A: The entry remains in that consumer's pending entries list (PEL) — Redis considers it delivered-but-unacknowledged, not lost and not re-delivered automatically. Another process can inspect stuck entries with `XPENDING`, and reclaim ownership of entries idle longer than some threshold using `XCLAIM` (or the more convenient `XAUTOCLAIM`), after which that new consumer can process and `XACK` them. This is what gives Streams at-least-once delivery with explicit, observable failure recovery, rather than silently losing work.

**Q: Why would you use `MAXLEN ~` instead of an exact `MAXLEN` when trimming a stream on `XADD`?**
A: The `~` (approximate) flag lets Redis trim in a way that's efficient against the underlying radix-tree storage structure — it removes whole internal storage nodes rather than trimming to an exact count, making the operation much cheaper. The tradeoff is the stream may end up slightly longer than the specified `MAXLEN` at any given moment. For most use cases (keeping "roughly the last N events"), that imprecision is an acceptable cost for significantly better write-path performance compared to exact trimming on every append.

**Q: You need an event log that multiple independent services can each replay from the beginning, but also want one internal worker pool to process each event exactly once (not once per pool member). Can Streams support both patterns on the same stream?**
A: Yes — that's exactly the dual consumption model Streams support. Each independent service can do its own plain `XREAD`/`XRANGE` starting from ID `0` (or wherever it last checkpointed), seeing every entry in the stream independently of other readers. Separately, the internal worker pool joins a single consumer group (`XGROUP CREATE ... order-processors 0` then `XREADGROUP GROUP order-processors <consumer-name> ...`), and Redis distributes each entry to exactly one worker in that group. Both consumption patterns read from the same underlying log without interfering with each other.

## Related Topics

- [pub-sub.md](./pub-sub.md)
- [persistence.md](./persistence.md)
- [caching-patterns.md](./caching-patterns.md)
- [redis-overview.md](./redis-overview.md)
