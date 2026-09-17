# Amazon CloudWatch

CloudWatch is AWS's native monitoring and observability service — it collects metrics, logs, and events from virtually every AWS service (and, via the CloudWatch agent, from your own EC2/on-prem hosts and custom application code) and gives you a place to visualize them, alarm on them, and react to them automatically. It's the default "is anything wrong" layer for an AWS-based system: every managed service (Lambda invocations/errors/duration, RDS CPU/connections, ALB request counts/latency/5xx rate, SQS queue depth) publishes metrics to CloudWatch with zero setup, and you build on top of that baseline with custom metrics, dashboards, and alarms specific to your application.

Metrics are numeric time series — a namespace (e.g., `AWS/EC2`), a metric name (`CPUUtilization`), and a set of dimensions (`InstanceId=i-0123...`) uniquely identify one data stream, published at some resolution (standard is 1-minute; high-resolution custom metrics can go down to 1 second). Beyond built-in service metrics, you can publish custom metrics from your own application code (e.g., "checkout latency," "cache hit rate," "failed login attempts") using `PutMetricData` — anything you can compute a number for can become a metric, and this is how CloudWatch bridges pure infrastructure monitoring into actual business/application observability.

Alarms watch a metric against a threshold over an evaluation period and change state (OK / ALARM / INSUFFICIENT_DATA) when the condition is met for the configured number of consecutive periods, and that state change can trigger an SNS notification, an Auto Scaling action, or a Lambda function. A well-designed alarm avoids both extremes: too sensitive (a single 1-minute spike pages someone at 3 a.m. for a self-healing blip) and too loose (a real incident goes unnoticed because the threshold or evaluation window is too forgiving) — tuning the evaluation periods and datapoints-to-alarm settings is a real production skill, not a one-time checkbox.

Logs work differently from metrics: CloudWatch Logs ingests unstructured or structured text (application logs, Lambda execution logs, VPC Flow Logs) into log groups, which are further subdivided into log streams (typically one per source instance/container/invocation). You can run ad hoc or saved queries against log data with CloudWatch Logs Insights, extract metrics out of log patterns with metric filters (e.g., count occurrences of `"ERROR"` and turn that count into an alarmable metric), and set per-log-group retention (logs are kept forever by default until you set a retention policy, which is a common surprise cost).

CloudWatch Events was the original name for what is now largely EventBridge — the distinction still trips people up. EventBridge is the evolved, more general event bus: it supports custom application "event buses" in addition to the AWS-service default bus, richer content-based filtering on event payloads, and third-party SaaS event sources, whereas the legacy CloudWatch Events surface (rules on the default bus, cron/rate-based scheduled rules) still exists and is fully interoperable with EventBridge — CloudWatch Events rules and EventBridge rules are the same underlying rule engine on the default event bus, and new development should target EventBridge's API/console even for AWS-service-only use cases, since it's the actively developed superset.

## Examples

```bash
# Publish a custom application metric (checkout latency in milliseconds)
# from your own code — anything you can compute a number for is fair game
aws cloudwatch put-metric-data \
  --namespace "MyApp/Checkout" \
  --metric-name LatencyMs \
  --dimensions Service=checkout,Environment=prod \
  --value 182 \
  --unit Milliseconds
```

```bash
# Create an alarm on ALB 5xx error rate: fires if the average exceeds 5
# over 2 consecutive 1-minute periods, notifying an SNS topic
aws cloudwatch put-metric-alarm \
  --alarm-name alb-high-5xx-rate \
  --namespace AWS/ApplicationELB \
  --metric-name HTTPCode_Target_5XX_Count \
  --dimensions Name=LoadBalancer,Value=app/my-alb/50dc6c495c0c9188 \
  --statistic Sum \
  --period 60 \
  --evaluation-periods 2 \
  --datapoints-to-alarm 2 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:ops-alerts
```

```bash
# CloudWatch Logs Insights query: find the slowest requests in the last hour
# from a Lambda function's log group
aws logs start-query \
  --log-group-name "/aws/lambda/checkout-handler" \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, @duration, @message
                   | filter @type = "REPORT"
                   | sort @duration desc
                   | limit 20'
```

## Common Pitfalls / Gotchas

- Leaving log group retention at "Never expire" (the default) — logs accumulate indefinitely and become a real, silently-growing cost line; set an explicit retention period (`aws logs put-retention-policy`) per log group based on actual compliance/debugging needs.
- Alarms with too short an evaluation window flapping on normal transient spikes, causing alert fatigue that trains people to ignore pages — tune evaluation periods and `datapoints-to-alarm` (e.g., "3 out of 5" instead of "1 out of 1") to distinguish real degradation from noise.
- Relying only on default AWS-service metrics and never publishing custom application metrics — infrastructure looking "healthy" (CPU, memory, request count) says nothing about whether checkout is actually succeeding for real users.
- Forgetting that basic EC2 monitoring is 5-minute resolution by default — you need to enable detailed (1-minute) monitoring, or install the CloudWatch agent for OS-level metrics like memory and disk usage, which EC2 doesn't publish out of the box at all.
- Confusing metric math/aggregation statistics — averaging a rate metric like error count across instances can hide a single instance that's completely failing while others are fine; per-resource dimensions and `Sum`/`Maximum` statistics often surface problems that `Average` masks.
- Treating CloudWatch Events and EventBridge as unrelated services — they share the same underlying rule engine on the default bus; new work should target EventBridge for its richer filtering and custom bus support.

## Interview Questions & Answers

**Q: What's the difference between a CloudWatch metric, a log, and an alarm?**
A: A metric is a numeric time series (e.g., CPU utilization over time). A log is unstructured or structured text data ingested into log groups/streams that you can search and query. An alarm watches a metric against a threshold over an evaluation window and changes state (OK/ALARM), which can then trigger a notification or automated action (SNS, Auto Scaling, Lambda) — metrics and logs are data, alarms are the reactive layer built on top of metric data.

**Q: How would you turn information buried in logs into something you can alarm on?**
A: Create a CloudWatch Logs metric filter on the log group that matches a pattern (e.g., lines containing `"ERROR"` or a specific status code), which increments a CloudWatch metric each time the pattern matches. Once that's a metric, you can attach a standard alarm to it just like any built-in service metric — this is the standard way to make application-level log events (not natively metrics) alarmable.

**Q: Why might you avoid setting an alarm to fire on a single breached data point?**
A: A single 1-minute spike is often a transient, self-correcting blip — a brief GC pause, a momentary network hiccup — not a real incident. Firing (and paging someone) on one data point causes alert fatigue and trains responders to ignore or delay-triage alarms. Requiring multiple consecutive breaching periods (e.g., 3 out of 5 evaluation periods) filters out noise while still catching sustained real degradation reasonably quickly.

**Q: What's the relationship between CloudWatch Events and EventBridge?**
A: EventBridge is the evolved, actively-developed event bus service; CloudWatch Events was its original name/scope, limited to a single default bus reacting to AWS service events and scheduled (cron/rate) rules. EventBridge adds custom event buses for your own application events, richer content-based pattern filtering, and third-party SaaS event source integrations, but both share the same underlying rule engine on the default bus — an existing CloudWatch Events rule is fully interoperable with EventBridge, and new work should target the EventBridge API/console.

**Q: A dashboard shows healthy CPU and low error counts, but users are reporting slow checkouts. What's missing?**
A: Infrastructure-level metrics say the hosts are fine, but they say nothing about business-logic-level performance or correctness. The gap is application-level observability — custom metrics (e.g., checkout latency, payment-provider call duration, cache hit rate) published from the application itself, plus distributed tracing to see where time is actually being spent across service calls, since "the servers are up" and "the feature works well for users" are genuinely different questions.

## Related Topics
- [observability.md](./observability.md)
- [cost-optimization.md](./cost-optimization.md)
- [lambda.md](./lambda.md)
- [ec2-auto-scaling.md](./ec2-auto-scaling.md)
- [sns.md](./sns.md)
- [well-architected-framework.md](./well-architected-framework.md)
