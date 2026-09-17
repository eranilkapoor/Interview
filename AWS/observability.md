# Observability

Observability is the ability to understand what's happening inside a system from the outside, purely by examining its outputs — as opposed to monitoring, which is checking predefined signals you already thought to look for. Monitoring answers questions you anticipated ("is CPU above 80%?"); observability lets you answer questions you didn't anticipate ("why did the 0.1% of requests from mobile clients in one region start timing out at 2:14 p.m., and what did they have in common?") by exploring the actual data after the fact. In a monolith running on one box, printf-debugging and a single log file often sufficed. In a distributed system with dozens of microservices, auto-scaled instances, and requests that hop through many hands, that stops working — you need signals that are correlated across services and instances, not scattered across boxes you'd have to SSH into individually.

The standard framing is "the three pillars": metrics, logs, and traces. Metrics are numeric time series (request rate, error rate, latency percentiles, queue depth) — cheap to store and query, great for dashboards and alarms, but they tell you *that* something is wrong, not *why*. Logs are discrete, timestamped events, often structured as JSON, that record what happened at a specific point — rich detail, but expensive to store at scale and hard to correlate across services without a shared identifier. Traces follow a single request as it moves across service boundaries, recording each "span" (a unit of work, like one service's handling of the request, or one downstream DB call) with timing and parent/child relationships — this is what actually shows you where time went in a call chain spanning five microservices, something no amount of staring at five separate log files or five separate latency dashboards can reconstruct as clearly.

On AWS, CloudWatch covers metrics and logs (metrics via `PutMetricData`/service-published metrics, logs via CloudWatch Logs and Logs Insights queries), and X-Ray covers distributed tracing. X-Ray works by having each service in a call chain emit trace segments (and instrumented SDK calls create subsegments automatically for things like DynamoDB or HTTP calls) tagged with a shared trace ID that's propagated across service boundaries via a header, so X-Ray can stitch every service's segment back together into a single end-to-end service map and timeline for one logical request. This is what lets you see, for one slow checkout request, that 900ms of its 950ms total was spent waiting on a specific downstream payment API call, rather than guessing which of five services was the bottleneck.

Correlation IDs are the low-tech but essential prerequisite that makes all of this tractable at the log level: a unique ID generated when a request first enters the system (often reused as, or paired with, the X-Ray trace ID) and threaded through every downstream call and every log line that request produces — as a header on outbound HTTP calls, as an attribute on queue messages, as a field in every structured log statement. Without it, correlating "these 40 log lines across 6 services all belong to the one request a customer is complaining about" is nearly impossible at any real scale; with it, a single Logs Insights query filtering on that ID reconstructs the full request's footprint across every service it touched.

Observability is not free — high-cardinality custom metrics, verbose debug-level logging left on in production, and 100%-sampled tracing all cost real money and can even add latency/overhead to the very system being observed. Practical systems sample traces (e.g., always trace errors and slow requests, sample a percentage of normal traffic), set log retention deliberately, and treat what to measure as a design decision made alongside the feature itself, not an afterthought bolted on after an incident reveals a blind spot.

## Examples

```bash
# X-Ray: retrieve the trace summary for a specific request, showing per-segment
# timing across every service the request touched
aws xray get-trace-summaries \
  --start-time $(date -d '10 minutes ago' +%s) \
  --end-time $(date +%s) \
  --filter-expression 'service("checkout-api") { fault = true }'

aws xray batch-get-traces --trace-ids "1-671a2b3c-abcdef1234567890abcdef12"
```

```json
// Structured application log line carrying a correlation ID that ties it to
// the same request's entries in every other service and to its X-Ray trace
{
  "timestamp": "2026-09-17T14:02:11.483Z",
  "level": "ERROR",
  "service": "payment-service",
  "correlationId": "1-671a2b3c-abcdef1234567890abcdef12",
  "message": "Downstream provider timeout after 3000ms",
  "orderId": "ORD-1042"
}
```

```python
# Propagating a correlation ID (reused as the X-Ray trace ID) from an
# incoming request header to an outgoing downstream call in a Python service
import requests
from aws_xray_sdk.core import xray_recorder

def call_payment_service(order_id, correlation_id):
    headers = {"X-Correlation-Id": correlation_id}
    with xray_recorder.in_subsegment("call_payment_service"):
        return requests.post(
            "https://payments.internal/charge",
            json={"orderId": order_id},
            headers=headers,
            timeout=3,
        )
```

## Common Pitfalls / Gotchas

- Confusing monitoring with observability — dashboards full of predefined metrics only answer questions you thought to ask in advance; without logs/traces you can explore, an unanticipated failure mode has no path to diagnosis.
- No correlation ID strategy — without a shared ID threaded through every service and log line for a given request, reconstructing what happened to one specific failing request across a distributed system is nearly impossible after the fact.
- 100% trace sampling in high-traffic production systems — collecting and storing every single trace at scale is expensive and often unnecessary; sample intelligently (always keep errors/slow requests, sample a percentage of the rest).
- Leaving verbose debug logging on permanently in production "just in case" — drives up log storage cost and makes Logs Insights queries slower and noisier without a corresponding benefit most of the time.
- Instrumenting metrics and traces only after an incident reveals a blind spot, instead of designing observability into a service alongside its business logic — retrofitting is always more expensive and misses the specific signal you needed during the incident that just happened.
- Treating logs as a substitute for metrics/traces or vice versa — each pillar answers a different class of question; relying on only one (e.g., "we have great dashboards but no tracing") leaves systematic blind spots for questions the other pillars are better suited to answer.

## Interview Questions & Answers

**Q: What's the difference between monitoring and observability?**
A: Monitoring is checking a predefined set of signals against thresholds — it answers questions you anticipated in advance, like "is error rate above 1%?" Observability is having rich enough, well-correlated data (metrics, logs, traces) that you can explore and answer questions you didn't anticipate, after the fact — like why one specific segment of traffic started failing in a way nobody built a dashboard for.

**Q: What are the three pillars of observability, and what does each answer that the others can't?**
A: Metrics are cheap numeric time series great for dashboards and alarms — they tell you *that* something is wrong (error rate spiked) but not why. Logs are discrete timestamped events with rich per-occurrence detail — they tell you what happened at one point, but correlating them across many services requires a shared identifier. Traces follow one request across every service boundary it crosses, showing exactly where time was spent in a multi-service call chain — something dashboards and isolated log files can't reconstruct on their own.

**Q: How does distributed tracing actually work across service boundaries, e.g., with X-Ray?**
A: A trace ID is generated when a request first enters the system and is propagated forward on every downstream call, typically as a header. Each service that handles the request emits a segment (and instrumented calls to things like databases create subsegments) tagged with that same trace ID and timing information. A tracing backend like X-Ray then stitches every service's segments back together by trace ID into one end-to-end timeline and service map for that single logical request.

**Q: What's a correlation ID and why is it foundational even before you adopt full distributed tracing?**
A: It's a unique identifier generated at the request's entry point and threaded through every downstream call and every log statement that request produces. It's what makes it possible to filter logs across many services down to exactly the entries belonging to one specific request — without it, correlating a customer's failing request across a distributed system is largely guesswork, since timestamps alone aren't a reliable enough correlation key at any real request volume.

**Q: Why not just trace 100% of requests in production?**
A: Full-fidelity tracing at 100% sampling has real storage/ingestion cost and can add measurable overhead to the system being traced, especially at high request volume. Most production systems sample: always capturing traces for errors and unusually slow requests (the ones you actually need to debug), while sampling only a percentage of normal successful traffic, which keeps cost and overhead bounded without losing visibility into the failures that matter most.

## Related Topics
- [cloudwatch.md](./cloudwatch.md)
- [well-architected-framework.md](./well-architected-framework.md)
- [sqs.md](./sqs.md)
- [lambda.md](./lambda.md)
- [cost-optimization.md](./cost-optimization.md)
