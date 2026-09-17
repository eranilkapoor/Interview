# SRE Basics

Site Reliability Engineering (SRE), as defined by Google's original SRE book, is "what happens when you ask a software engineer to design an operations function" — instead of treating reliability as a set of manual runbooks and human judgment calls, SRE applies software-engineering discipline (automation, measurable targets, data-driven decisions) to keeping systems running. The single idea that most distinguishes SRE from traditional ops is the **error budget**: reliability targets are expressed as an SLO (Service Level Objective) — say, 99.9% of requests succeed over a rolling 30 days — and the *allowed* failure (0.1% in this example) is the error budget. As long as a service is operating within its error budget, the team is free to take risks: ship features fast, deploy more often, experiment. Once the error budget is exhausted, the team's priority explicitly shifts to reliability work — slowing down releases, fixing the underlying issues — until the budget recovers. This turns "how much risk can we take" from a political argument into a number everyone already agreed to.

SLI, SLO, and SLA are a commonly confused trio worth being precise about: an **SLI** (Service Level Indicator) is the actual measured metric — e.g., the percentage of HTTP requests that returned a 2xx/3xx status in the last 5 minutes. An **SLO** (Service Level Objective) is the internal target for that indicator — e.g., "99.9% of requests succeed, measured monthly" — and is what the error budget is calculated from. An **SLA** (Service Level Agreement) is an external, usually contractual commitment to a customer, often with financial penalties for breach, and is typically set looser than the internal SLO specifically to leave a safety margin — you want to breach your own SLO and react internally well before you're anywhere near breaching the customer-facing SLA.

**Toil** is SRE's term for the other half of the philosophy: manual, repetitive, automatable operational work that scales linearly with service size and produces no lasting engineering value — restarting a stuck process by hand every time it happens, manually provisioning a new customer's resources, hand-editing a config for every deploy. Google's SRE practice historically caps the fraction of an SRE's time that should go to toil (often cited around 50%) specifically because unchecked toil crowds out the engineering work (automation, tooling, architectural fixes) that would eliminate that toil permanently — it's a trap that gets worse over time if not deliberately fought. This is the core cultural difference from traditional ops: traditional ops often treats manual firefighting as the job; SRE treats manual firefighting as a bug to be engineered away, and uses the error budget as the lever that forces a real, negotiated tradeoff between shipping velocity and reliability investment instead of leaving it as an unstated tension between teams.

## Examples

```text
SLI / SLO / SLA in one service:

SLI (measured):  99.94% of requests succeeded in the last 30 days
SLO (internal target): 99.9% success over a rolling 30 days
SLA (contractual, external): 99.5% success over a rolling 30 days,
                              with service credits owed below that

Error budget = 100% - SLO = 0.1% of requests allowed to fail per 30 days
Budget remaining this period = SLO (99.9%) - SLI (99.94%) = still within budget
```

```text
Error budget policy, in practice:

Budget healthy (SLI comfortably above SLO):
  -> ship features, deploy freely, experiment with riskier changes

Budget nearly exhausted (SLI approaching SLO):
  -> feature freeze, prioritize reliability fixes, slow down releases
     until the SLO is comfortably met again
```

```text
Toil vs engineering work:

Toil (automate away):
  - manually restarting a crashed worker process each time it happens
  - hand-provisioning a new tenant's database

Engineering work (what toil reduction buys time for):
  - building a supervisor that auto-restarts crashed workers
  - building self-service tenant provisioning
```

## Common Pitfalls / Gotchas

- Chasing 100% reliability — it's not just expensive, it's usually the wrong target, since users often can't tell the difference between 99.99% and 100%, and the marginal cost of the last 0.01% is disproportionately high.
- Confusing SLO and SLA — the SLA is an external, often contractual commitment and should be looser than the internal SLO, giving room to react before a customer-facing breach.
- Treating an error budget as a hard permission slip to ignore reliability entirely while budget remains — it's a shared, negotiated tradeoff mechanism, not a license to ship recklessly.
- Letting toil accumulate without measuring or capping it — because toil scales with service size, unchecked toil eventually consumes all available engineering time and the automation that would reduce it never gets built.
- Setting an SLO without data — an SLO should reflect what users actually need and what's realistically achievable, not a round number picked without evidence.

## Interview Questions & Answers

**Q: What is an error budget, and what does it actually let a team do?**
A: It's the allowed amount of failure implied by an SLO — if the SLO is 99.9% success, the error budget is the 0.1% failure that's considered acceptable. While a service is within budget, the team can ship features and take on risk freely; once the budget is exhausted, the team's priority shifts explicitly to reliability work until it recovers. It converts "how much risk is okay" from an ongoing argument into an agreed, measurable number.

**Q: What's the difference between an SLI, an SLO, and an SLA?**
A: An SLI is the actual measured value of a metric (e.g., current success rate). An SLO is the internal target for that metric (e.g., 99.9% success). An SLA is an external, often contractual commitment to customers, usually set looser than the SLO with financial penalties for breach, specifically to leave a safety margin so you react to an SLO miss before ever approaching an SLA violation.

**Q: What is toil, and why does SRE treat it as something to actively eliminate rather than just staff for?**
A: Toil is manual, repetitive, automatable operational work that scales with service size and produces no lasting engineering value. SRE treats it as a problem to engineer away — rather than just hiring more people to absorb it — because toil that isn't actively reduced grows over time and crowds out the automation and architectural work that would have eliminated it, creating a compounding trap.

**Q: Why might a team deliberately choose an SLO lower than 100%?**
A: Because pursuing ever-higher reliability has steeply increasing marginal cost, and beyond a certain point users can't perceive the difference — 99.9% versus 99.99% uptime is invisible to most users but the engineering cost to close that gap can be enormous. An SLO should reflect the reliability users actually need, not the maximum theoretically achievable, and setting it deliberately below 100% also creates the error budget that makes shipping velocity possible at all.

**Q: How is SRE different from traditional operations?**
A: Traditional ops often treats manual firefighting and runbook-following as the core of the job. SRE applies software engineering discipline to operations — measurable SLOs, error budgets as an explicit risk-tradeoff mechanism, and a deliberate cap on toil that forces automation of repetitive work — treating reliability as something engineered and measured rather than maintained through manual effort and tribal knowledge.

## Related Topics

- [monitoring-and-logging.md](./monitoring-and-logging.md)
- [incident-management.md](./incident-management.md)
- [scalability-and-reliability.md](./scalability-and-reliability.md)
- [devops-culture.md](./devops-culture.md)
