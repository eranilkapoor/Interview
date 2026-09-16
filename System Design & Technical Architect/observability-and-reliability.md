# Observability and Reliability

Observability helps teams understand what a system is doing. Reliability is the ability of the system to perform correctly under expected and unexpected conditions.

## Three Pillars

- Logs
- Metrics
- Traces

## Reliability Practices

- Health checks
- Readiness and liveness probes
- Retry with backoff
- Circuit breakers
- Bulkheads
- Graceful degradation
- Rate limiting
- SLOs and error budgets
- Runbooks
- Incident reviews

## Interview Q&A

**Q: What should you monitor in a web service?**  
A: Request rate, error rate, latency, saturation, CPU, memory, database latency, queue depth, cache hit ratio, and dependency failures.

**Q: What is an SLO?**  
A: A Service Level Objective is a measurable reliability target, such as 99.9% successful requests under 300 ms.

**Q: What is graceful degradation?**  
A: Keeping core functionality available even when non-critical dependencies fail.

