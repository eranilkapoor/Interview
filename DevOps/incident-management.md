# Incident Management

Incident management is the structured process for responding to a system disruption — from the moment it's detected through diagnosis, mitigation, resolution, and the learning that happens afterward. The first thing most incident processes establish is a **severity scale** (commonly SEV1 through SEV4, or P1-P4), because "how bad is this" determines everything downstream: who gets paged, how urgently, whether customers get proactively notified, and how much process overhead is justified. A SEV1 ("complete outage, revenue-impacting, all hands") gets an immediate page and an incident commander; a SEV4 ("minor cosmetic bug, no user impact") might just become a ticket for the next sprint. Getting severity classification right is itself a skill — over-classifying trains people to treat pages as noise, under-classifying delays the urgency a real outage needs.

On-call rotations are how teams distribute the responsibility of being reachable for pages outside business hours without burning out any one person — typically a weekly or bi-weekly rotation across a team, sometimes with a "primary" and "secondary" (secondary gets paged if primary doesn't acknowledge within some window) as a safety net against a missed page. **Runbooks** are the operational memory that make on-call sustainable: a documented, step-by-step guide for diagnosing and mitigating a specific known failure mode ("if the payment queue depth exceeds 10k, do X, then check Y"), written so that whoever is on call — not just the person who originally understood the system best — can respond effectively at 3 AM without having to reason a fix from first principles under pressure. Good on-call culture also treats being paged too often as a bug in the system (alert fatigue, flaky alerts, a genuinely fragile component) to be fixed, not a fact of life to be endured.

**MTTD** (mean time to detect) and **MTTR** (mean time to resolve/recover) are the standard metrics for measuring incident response effectiveness — MTTD measures how long a problem existed before anyone noticed (a function of monitoring and alerting quality), MTTR measures how long it took from detection to resolution (a function of runbooks, tooling, rollback speed, and team practice). After an incident is resolved, the **postmortem** (or "post-incident review") is where the real long-term value gets captured: a written timeline of what happened, what the impact was, and — critically, per the DevOps-culture principle of blamelessness — what about the *system* allowed the incident to happen and what concrete follow-up actions (better alerting, a missing safeguard, a runbook gap) would prevent recurrence or catch it faster next time. A postmortem that produces no action items, or one that focuses on which individual made a mistake instead of what process let that mistake reach production, has failed at its actual purpose regardless of how well-written the timeline is.

## Examples

```text
Severity scale, mapped to response:

SEV1  Full outage / data loss risk / revenue-impacting
      -> immediate page, incident commander assigned, status page updated

SEV2  Major feature broken, partial impact, workaround may exist
      -> immediate page, no status page unless it persists

SEV3  Minor degradation, small subset of users affected
      -> ticket, addressed within the current sprint

SEV4  Cosmetic issue, no functional impact
      -> backlog, no paging
```

```text
Runbook excerpt: "Payment queue depth alert"

1. Check queue depth dashboard: <link>
2. If depth > 10k and rising:
   a. Check payment-provider status page for an outage
   b. If provider is down: enable maintenance mode, notify support team
   c. If provider is up: check worker pod count; scale workers via
      `kubectl scale deployment payment-worker --replicas=10`
3. Page #payments-oncall if queue depth exceeds 50k or provider outage > 15 min
```

```text
Postmortem skeleton (blameless):

- Summary: what broke, user impact, duration
- Timeline: detection -> diagnosis -> mitigation -> resolution (timestamped)
- Root cause: what in the SYSTEM allowed this (not who did what)
- What went well / what went poorly during response
- Action items: concrete, owned, with due dates (e.g. "add alert for X — @owner — by Fri")
```

## Common Pitfalls / Gotchas

- Misclassifying severity, especially under-classifying — treating a revenue-impacting outage as a SEV3 delays the urgency and staffing a real incident needs.
- Writing a postmortem that assigns blame to an individual instead of examining what process or missing safeguard let the mistake reach production — this discourages honest incident reporting going forward.
- Producing a postmortem with no concrete, owned action items — a well-written timeline that changes nothing about the system has captured the story but not the value.
- Having no runbook for a known, recurring failure mode, forcing every on-call engineer to re-diagnose the same problem from scratch under pressure.
- Confusing MTTD and MTTR, or optimizing only one — a fast MTTR is much less valuable if MTTD is so slow that damage is already done before anyone notices.

## Interview Questions & Answers

**Q: How would you classify incident severity, and why does it matter?**
A: By user/business impact — is it a full outage, a partial degradation, or a cosmetic issue — because severity determines who gets paged, how urgently, and whether customers are proactively notified. Getting it wrong in either direction causes real damage: over-classifying causes alert fatigue and wastes urgent response capacity on minor issues, under-classifying delays the response a genuine outage needs.

**Q: What's the difference between MTTD and MTTR, and why track both?**
A: MTTD (mean time to detect) measures how long an incident existed before it was noticed — it reflects monitoring and alerting quality. MTTR (mean time to resolve) measures how long it took from detection to actual resolution — it reflects runbook quality, tooling, and rollback speed. A team can have excellent MTTR but still cause significant damage if MTTD is slow, because the problem ran undetected for a long time before the fast response even started.

**Q: What makes a postmortem "blameless," and why is that important?**
A: It focuses on what about the system or process allowed the incident to happen — a missing safeguard, an unclear runbook, an alert that didn't fire — rather than which individual made a mistake. It's important because people only report the full, honest sequence of events (including their own errors) when they trust they won't be punished for it, and an honest account is the only way to find the actual root cause instead of a convenient scapegoat.

**Q: What's a runbook, and why does it matter for on-call sustainability?**
A: A documented, step-by-step guide for diagnosing and mitigating a specific known failure mode. It matters because it lets whoever is on call respond effectively without having to be the original expert on that system or reason a fix from scratch under 3 AM pressure — it converts tribal knowledge held by one or two people into something the whole rotation can execute.

**Q: An incident keeps recurring even after being "resolved" each time. What does that suggest about the incident process?**
A: That the postmortems are addressing symptoms rather than root cause — likely producing no real action items, or action items that never get prioritized against other work. The fix is treating postmortem action items as owned, tracked work with real follow-through, and specifically asking in each review "why didn't the last postmortem prevent this."

## Related Topics

- [monitoring-and-logging.md](./monitoring-and-logging.md)
- [sre-basics.md](./sre-basics.md)
- [devops-culture.md](./devops-culture.md)
