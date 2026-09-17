# Release Strategies

Once a change passes CI/CD, *how* it actually reaches production is its own design problem — the goal is always to minimize the blast radius of a bad release and to have a fast, reliable way back if something goes wrong. **Blue-green deployment** keeps two identical production environments ("blue" — currently live, and "green" — the new version), deploys the new version fully to the idle environment, runs whatever validation is needed against it, and then flips a router or load balancer to send all traffic to green in one atomic switch. If something's wrong, rolling back means flipping the router back to blue, which is close to instantaneous — but it requires running two full production-sized environments simultaneously (at least during the switch), which is expensive, and a fully atomic switch means either 100% of users are on the new version or 0%, with no gradual exposure in between.

**Canary deployment** takes the opposite approach to exposure: instead of an all-or-nothing switch, the new version is rolled out to a small slice of traffic (say, 5% of users or servers) while most traffic still hits the old version, and that slice is closely monitored for errors, latency regressions, or other symptoms before gradually increasing the percentage (5% → 25% → 50% → 100%) until the rollout completes or a problem is caught and the canary is pulled back with minimal impact. **Rolling deployment** is the more common default in orchestrators like Kubernetes: instances of the old version are replaced with the new version incrementally, a few at a time, rather than switching an entire environment at once — it doesn't require doubled infrastructure like blue-green, but a partially-rolled-out deployment briefly runs old and new versions side by side, which the application needs to tolerate.

**Feature flags** decouple *deploying* code from *releasing* a feature to users — the code for a new feature can be merged and deployed to production while dark (hidden behind a flag that's off for everyone), then turned on gradually for a percentage of users, a specific customer segment, or instantly for everyone, entirely independent of any further deploy. This is what makes trunk-based development practical (unfinished work can sit on `main`, deployed but inactive, instead of needing a long-lived branch) and gives you a release mechanism that's faster than any deployment strategy — flipping a flag is instant, no rebuild or redeploy required, which also makes it the fastest possible rollback for a bad feature: flip the flag off rather than redeploying the previous version. The common thread across all of these strategies is the same one running through this whole folder: reduce the cost of being wrong. Every one of them exists to make a bad release cheap and fast to detect and reverse, rather than trying to guarantee in advance that no release will ever be bad.

## Examples

```text
Blue-green: atomic switch between two full environments

  [ Load Balancer ] --> [ Blue: v1.4 ]  (currently live)
                          [ Green: v1.5 ] (deployed, validated, idle)

  Cut over: [ Load Balancer ] --> [ Green: v1.5 ]  (now live)
  Rollback: flip the load balancer back to Blue — near-instant
```

```yaml
# Kubernetes rolling update: replace pods incrementally
apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout-service
spec:
  replicas: 10
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1   # at most 1 pod down at a time
      maxSurge: 1          # at most 1 extra pod during rollout
  template:
    spec:
      containers:
        - name: checkout
          image: checkout-service:v1.5
```

```text
Canary rollout progression, watched at each step:

5% traffic -> v1.5   |  95% traffic -> v1.4   (watch error rate, latency)
   |  looks healthy after 15 min
25% traffic -> v1.5  |  75% traffic -> v1.4
   |  looks healthy after 15 min
100% traffic -> v1.5                          (rollout complete)

If error rate spikes at any step: route traffic back to v1.4,
0% impact beyond the canary slice that already saw it.
```

```javascript
// Feature flag: deploy the code dark, release independently of deploy
if (featureFlags.isEnabled('new-checkout-flow', { userId })) {
  return renderNewCheckout();
}
return renderLegacyCheckout();
// Turning this on for 100% of users requires no redeploy —
// just flipping the flag's rollout percentage to 100.
```

## Common Pitfalls / Gotchas

- Choosing blue-green without accounting for the cost of running two full production environments simultaneously, or for backward-incompatible database migrations that neither old nor new version can safely share.
- Running a canary but not actually watching it closely enough, or for long enough, before increasing the percentage — a canary only helps if someone (or an automated system) is actively comparing its error rate/latency against the baseline.
- Deploying via rolling update without making the application tolerate old and new versions running simultaneously — a rolling deploy is only safe if API/schema changes are backward compatible during the transition window.
- Leaving stale feature flags in code long after a feature is fully released — accumulated dead flags make the codebase harder to reason about and are a common source of "why is this code even here" confusion.
- Treating a feature flag flip as risk-free just because it's fast — a flag controlling a large behavior change still needs the same monitoring discipline as a full deploy, since flipping it can cause a real production incident just as easily.

## Interview Questions & Answers

**Q: What's the difference between blue-green and canary deployment?**
A: Blue-green deploys the new version to a fully separate, idle environment and switches all traffic to it atomically — rollback is an instant router flip back to the old environment, but it's all-or-nothing and requires doubled infrastructure. Canary deployment gradually shifts a small, increasing percentage of traffic to the new version while closely monitoring it, giving a much smaller blast radius if something's wrong, at the cost of a slower rollout and needing real-time monitoring to make the gradual-increase decision safely.

**Q: How do feature flags change the relationship between deploying and releasing?**
A: They decouple the two entirely — code for a new feature can be merged and deployed to production while a flag keeps it dark (invisible to users), and later "released" by flipping the flag for some or all users, with no new deploy required. This makes trunk-based development practical (unfinished features can live on `main`, deployed but inactive) and provides the fastest possible rollback for a bad feature: flip the flag off instead of rolling back a deploy.

**Q: Why does a rolling deployment require backward compatibility between versions, in a way blue-green doesn't?**
A: Because during a rolling update, old and new versions of the application run side by side serving live traffic simultaneously — if they share a database, both versions need to work correctly against whatever schema exists at that moment. Blue-green avoids this specific problem for the application tier because only one version is ever receiving live traffic at a time, though a shared database migration can still create the same compatibility constraint across both strategies.

**Q: When would you choose canary over blue-green, or vice versa?**
A: Choose canary when you want the smallest possible blast radius and have good real-time monitoring to make gradual-rollout decisions safely — it's well suited to high-traffic services where even a small percentage is a meaningful, catchable sample. Choose blue-green when you need a very fast, simple, all-or-nothing cutover and rollback (with less operational complexity than managing gradual percentages) and can afford to run two full-sized environments, at least temporarily during the switch.

**Q: What's the fastest rollback mechanism among these release strategies, and why?**
A: A feature flag flip — it requires no redeploy, no infrastructure switch, just toggling a flag's state, which typically takes effect within seconds. Blue-green's router flip is the next fastest (still no redeploy, just re-routing traffic). A rolling deployment rollback is the slowest of the three, since it requires redeploying the previous version incrementally the same way the bad version was rolled out.

## Related Topics

- [ci-cd.md](./ci-cd.md)
- [source-code-management.md](./source-code-management.md)
- [scalability-and-reliability.md](./scalability-and-reliability.md)
- [monitoring-and-logging.md](./monitoring-and-logging.md)
