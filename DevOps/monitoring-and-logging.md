# Monitoring and Logging

Observability is usually broken into three complementary pillars: **metrics** (numeric time-series — request rate, error rate, CPU usage, queue depth — cheap to store and great for dashboards, alerting, and spotting trends), **logs** (discrete, timestamped, often unstructured or semi-structured event records — "user 42 login failed: invalid password" — great for understanding exactly what happened in one specific case), and **traces** (a record of a single request's full path through a distributed system, showing how long it spent in each service it touched). Monitoring is usually the term for the metrics-and-alerting half of this — watching known signals and reacting to threshold breaches — while "observability" is the broader idea of being able to ask arbitrary new questions about system behavior after the fact, including questions you didn't think to instrument in advance. The distinction matters in interviews: monitoring tells you *that* something is wrong (the error rate spiked), observability (rich logs, traces, high-cardinality metrics) helps you figure out *why*.

Prometheus and Grafana form the most common open-source metrics stack: Prometheus scrapes (pulls, rather than receives pushed) numeric metrics from instrumented services on a regular interval and stores them as time series, has its own query language (PromQL) for aggregating and alerting on that data, and Grafana sits on top as the dashboarding and visualization layer, able to query Prometheus (and many other data sources) and render graphs, tables, and alert panels. The ELK stack (Elasticsearch, Logstash, Kibana — often now "Elastic Stack," sometimes paired with Filebeat/Fluentd as lighter-weight shippers) is the equivalent common stack for logs: logs get shipped from every service, parsed/structured, indexed into Elasticsearch for fast full-text search, and browsed/visualized in Kibana. In an interview, being able to say which tool covers which pillar — and that they're complementary, not substitutes for each other — signals real hands-on exposure more than naming the tools alone.

Alerting is where monitoring turns from passive dashboards into something that pages a human, and getting alert thresholds right is a genuinely hard, high-value skill. An alert that's too sensitive (fires on any error-rate blip) trains the on-call engineer to ignore it — "alert fatigue" — which is dangerous because the one time it fires for something real, it gets dismissed along with the noise. An alert that's too loose (only fires once things are already catastrophically broken) gives no early warning at all. The standard approach is to alert on symptoms that matter to users (elevated error rate, elevated latency, a queue backing up) rather than every possible internal condition, and to tie thresholds to something meaningful — commonly an SLO burn rate (how fast you're consuming your error budget) rather than an arbitrary fixed number — so a page means "this is on track to violate a promise we made," not just "a number moved."

## Examples

```yaml
# prometheus.yml — scrape config: Prometheus pulls metrics from targets
scrape_configs:
  - job_name: 'checkout-service'
    scrape_interval: 15s
    static_configs:
      - targets: ['checkout-service:9100']
```

```yaml
# Prometheus alerting rule — symptom-based, not "CPU > 80%"
groups:
  - name: checkout-alerts
    rules:
      - alert: HighErrorRate
        expr: |
          rate(http_requests_total{job="checkout-service",status=~"5.."}[5m])
          / rate(http_requests_total{job="checkout-service"}[5m]) > 0.02
        for: 10m
        labels:
          severity: page
        annotations:
          summary: "Checkout error rate above 2% for 10 minutes"
```

```json
// Structured log line — parseable, searchable, correlatable to a trace
{
  "timestamp": "2026-09-17T14:02:11Z",
  "level": "error",
  "service": "checkout-service",
  "trace_id": "9f1c2a3b",
  "message": "payment provider timeout",
  "user_id": 4821,
  "latency_ms": 5032
}
```

## Common Pitfalls / Gotchas

- Alerting on internal, cause-level conditions (CPU at 85%) instead of user-facing symptoms (error rate, latency) — the former pages someone for something that may not matter at all to users, and misses real symptoms that don't correlate with the threshold chosen.
- Logging unstructured free-text instead of structured (JSON) logs — unstructured logs are much harder to query, filter, and correlate across services at scale.
- Setting alert thresholds too tight and causing alert fatigue — once an on-call engineer starts ignoring pages as noise, real incidents get missed too.
- Treating metrics dashboards as sufficient without logs or traces — a dashboard shows *that* latency spiked; without traces or logs you often can't tell *which* downstream call caused it.
- Logging sensitive data (passwords, full credit card numbers, tokens) in plaintext — logs often have broader access and longer retention than the systems that generated the data, making this a real security exposure.

## Interview Questions & Answers

**Q: What are the three pillars of observability, and what does each one answer?**
A: Metrics (numeric time series like error rate or latency — good for trends, dashboards, and alerting), logs (discrete event records — good for understanding exactly what happened in one specific case), and traces (a single request's path across services in a distributed system — good for finding which hop in a chain caused the latency or error). Metrics tell you something is wrong; logs and traces help you find out why.

**Q: What's the difference between monitoring and observability?**
A: Monitoring is watching a predefined set of signals and alerting when they cross known thresholds — it answers questions you thought to ask in advance. Observability is the broader capability of being able to ask new, unanticipated questions about system behavior after the fact, using rich logs, traces, and high-cardinality metrics — it's what lets you debug a novel failure mode you never explicitly instrumented for.

**Q: How does Prometheus's pull-based metrics model work, and how is it different from a push-based system?**
A: Prometheus scrapes metrics from instrumented targets at a configured interval — the target just exposes a metrics endpoint, and Prometheus is responsible for fetching it. A push-based system has the application actively send metrics to a collector. Pull-based makes it easy to see if a target has gone completely unreachable (a scrape failure is itself a signal) and centralizes control of scrape frequency, but requires Prometheus to know about and reach every target.

**Q: How do you decide where to set an alert threshold?**
A: Base it on user-facing symptoms tied to something you've promised, like an SLO, rather than an arbitrary internal number — for example, alert when the error-rate burn rate threatens to exhaust your monthly error budget, not just "5xx count > 10." The goal is that every page corresponds to a real, meaningful risk to users, which keeps the signal-to-noise ratio high enough that on-call engineers trust and act on alerts instead of tuning them out.

**Q: A dashboard shows a latency spike, but no single metric explains why. How would you dig further?**
A: Move from metrics into traces and logs for the affected window — traces show which downstream service or database call the extra time was actually spent in, and structured logs from that specific hop (filtered by the trace ID connecting them) usually reveal the concrete cause, like a slow query or a downstream timeout. This is the practical reason all three observability pillars matter together rather than any one in isolation.

## Related Topics

- [incident-management.md](./incident-management.md)
- [sre-basics.md](./sre-basics.md)
- [scalability-and-reliability.md](./scalability-and-reliability.md)
