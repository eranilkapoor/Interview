# DevOps Interview Preparation

DevOps interview questions rarely stay abstract for long — an interviewer who asks "what's CI/CD" is almost always going to follow up with "okay, walk me through how you'd design a pipeline for X" or "tell me about a real incident and what changed afterward." This folder is built around that pattern: each topic covers the real mental model (not a dictionary definition), a couple of concrete, technically accurate examples (real YAML, real Terraform, real Prometheus config — not placeholder pseudo-code), the mistakes people actually make with it, and a handful of interview Q&A pairs that go past the one-line definition into tradeoffs and debugging.

## Table of Contents

**Delivery process and culture**
- [Waterfall Model](./waterfall-model.md)
- [Agile Methodology](./agile-methodology.md)
- [DevOps Culture](./devops-culture.md)

**Build and release**
- [Source Code Management](./source-code-management.md)
- [CI/CD](./ci-cd.md)
- [Release Strategies](./release-strategies.md)

**Infrastructure and configuration**
- [Infrastructure as Code](./infrastructure-as-code.md)
- [Configuration Management](./configuration-management.md)
- [Secrets Management](./secrets-management.md)

**Operating in production**
- [Monitoring and Logging](./monitoring-and-logging.md)
- [Incident Management](./incident-management.md)
- [SRE Basics](./sre-basics.md)
- [Scalability and Reliability](./scalability-and-reliability.md)

## Interview Questions & Answers — Curated

**Beginner**

**Q: What is DevOps, in your own words?**
A: DevOps is the practice of merging development and operations into shared ownership of a system's full lifecycle — build, test, deploy, run — supported by automation (CI/CD, infrastructure as code) and measurement (metrics, SLOs), so that the team that builds software also feels the operational consequences of running it, instead of throwing a build "over the wall" to a separate ops team.

**Q: What's the difference between continuous delivery and continuous deployment?**
A: Both mean every change that passes the pipeline produces a release-ready artifact. Delivery stops there and waits for a human to approve the release to production; deployment removes that manual gate and releases automatically. See [ci-cd.md](./ci-cd.md).

**Q: What is Infrastructure as Code, and why is it better than manually configuring servers through a console?**
A: IaC defines infrastructure in version-controlled, declarative configuration files instead of manual console clicks, giving you code review, change history, and reliable reproducibility — you can recreate an entire environment from the files, which "ClickOps" infrastructure has no equivalent for. See [infrastructure-as-code.md](./infrastructure-as-code.md).

**Q: What's the difference between horizontal and vertical scaling?**
A: Vertical scaling adds resources to one machine (simple, but has a ceiling and stays a single point of failure); horizontal scaling adds more machines behind a load balancer (no hard ceiling, naturally redundant, but requires the app to support statelessness). See [scalability-and-reliability.md](./scalability-and-reliability.md).

**Q: What are the three pillars of observability?**
A: Metrics (numeric trends), logs (discrete event records), and traces (a request's path across services) — metrics tell you something is wrong, logs and traces help you find out why. See [monitoring-and-logging.md](./monitoring-and-logging.md).

**Intermediate**

**Q: What is idempotency, and why does it matter for configuration management and infrastructure as code?**
A: An idempotent operation produces the same end state no matter how many times it's applied. Both configuration management (Ansible, Chef, Puppet) and IaC (Terraform) tools are built around declaring a desired state and being safely re-runnable, so drift gets corrected automatically on the next run instead of the tool duplicating or erroring on already-applied changes. See [configuration-management.md](./configuration-management.md) and [infrastructure-as-code.md](./infrastructure-as-code.md).

**Q: What is an SLI, SLO, and SLA, and how do they relate to each other?**
A: SLI is the measured metric, SLO is the internal target for it, SLA is the external (often contractual) commitment — usually set looser than the SLO to leave a reaction margin before a customer-facing breach. See [sre-basics.md](./sre-basics.md).

**Q: What is an error budget, and what does it let a team do?**
A: The allowed amount of failure implied by an SLO. While a service is within budget, the team can ship and take risks freely; once exhausted, priority shifts to reliability work — it turns risk tolerance into an agreed number instead of an ongoing argument. See [sre-basics.md](./sre-basics.md).

**Q: What's the difference between blue-green, canary, and rolling deployments?**
A: Blue-green switches all traffic between two full environments atomically (fast rollback, doubled infrastructure). Canary gradually shifts a small, increasing percentage of traffic to the new version while monitoring it (smallest blast radius, slower). Rolling replaces instances incrementally without doubled infrastructure, but runs old and new versions side by side during the rollout. See [release-strategies.md](./release-strategies.md).

**Q: Why is trunk-based development considered a better fit for CI/CD than Git-flow for a continuously deployed service?**
A: CI's core value — catching integration issues within minutes — depends on merging back to a shared branch constantly; long-lived feature or release branches recreate the "big merge at the end" problem CI exists to eliminate. Git-flow's release-branch ceremony is built for discrete, versioned releases, which a continuously deployed service doesn't have. See [source-code-management.md](./source-code-management.md).

**Q: If a secret is accidentally committed to Git, is deleting it in a later commit enough?**
A: No — Git preserves full history, so the secret remains retrievable from the earlier commit. The real fix is rotating the credential immediately and treating it as compromised, separately from any history rewrite. See [secrets-management.md](./secrets-management.md).

**Advanced**

**Q: What's the difference between toil and normal operational work, and why does SRE explicitly try to cap it?**
A: Toil is manual, repetitive, automatable work that scales linearly with service size and produces no lasting engineering value. SRE caps the fraction of time spent on it because unchecked toil crowds out the automation work that would eliminate it, compounding over time. See [sre-basics.md](./sre-basics.md).

**Q: What makes a postmortem "blameless," and why does that actually improve reliability rather than just feeling nicer?**
A: It focuses on what about the system or process allowed an incident, not which individual erred. This matters because people only report the full, honest sequence of events — including their own mistakes — when they trust they won't be punished for it, and an honest account is the only path to the real root cause instead of a convenient scapegoat. See [incident-management.md](./incident-management.md) and [devops-culture.md](./devops-culture.md).

**Q: How would you design secrets access for a CI/CD pipeline deploying to production?**
A: Give the pipeline a short-lived, scoped identity (an OIDC-federated cloud role rather than a static access key) to authenticate to a secrets manager at run time, request only what that step needs, and never persist secrets to disk or logs — broad standing credentials on a CI runner are a common way one compromised pipeline becomes a full production breach. See [secrets-management.md](./secrets-management.md).

**Q: A service is well within its error budget. Should the team ship a risky change without extra caution?**
A: The error budget means the team has room to take on risk, but "has budget" isn't the same as "no caution warranted" — a change with severe, low-probability failure modes still deserves proportionate safeguards (canary rollout, monitoring, a fast rollback plan), because a budget is meant to enable calculated risk-taking, not to replace judgment about how a specific change could fail. See [sre-basics.md](./sre-basics.md) and [release-strategies.md](./release-strategies.md).

**Q: How do CI/CD, infrastructure as code, and monitoring reinforce each other in a mature DevOps pipeline?**
A: IaC provisions the environment a pipeline deploys into reproducibly; CI/CD moves code through that environment safely in small, fast-failing increments; monitoring closes the loop by proving whether a deploy actually succeeded in production, not just in a test suite, and by feeding data back into the next release decision (rollback, canary promotion, error budget status). Each one materially depends on the others actually working — a fast pipeline deploying to hand-configured, undocumented infrastructure with no monitoring is not meaningfully safer than the manual process it replaced. See [ci-cd.md](./ci-cd.md), [infrastructure-as-code.md](./infrastructure-as-code.md), and [monitoring-and-logging.md](./monitoring-and-logging.md).

## How to Use This Folder

Read a topic's full explanation first, not just the Q&A — the interview answers are written to build on the conceptual section, and skipping straight to Q&A tends to produce memorized-sounding answers instead of ones you can adapt when an interviewer changes the constraints. After reading a topic, try explaining it out loud in under a minute: the problem it solves, how it works, one real tradeoff, and one way it fails. Study topics in the same theme group together (for example, CI/CD alongside Release Strategies and Source Code Management) since interviewers frequently chain follow-up questions across them in a single conversation.
