# AWS Cost Optimization

Cost Optimization is one of the six Well-Architected pillars, and in practice it comes down to a handful of recurring levers: pay for commitment where usage is predictable, pay for spare capacity where workloads are flexible, right-size instead of over-provisioning "just in case," and move data to cheaper storage tiers as it ages and gets accessed less. None of these are exotic tricks — they're deliberate tradeoffs between cost, risk, and operational flexibility, and a large fraction of real-world AWS overspend comes from simply never revisiting decisions (instance sizes, storage classes, unused resources) made once at launch and never re-evaluated as actual usage patterns became clear.

For compute, the core choice is how much you're willing to commit versus how much flexibility you need. On-Demand has no commitment and the highest per-hour price, right for unpredictable or short-lived workloads. Reserved Instances (RIs) commit to a specific instance family and region for a 1- or 3-year term for up to ~72% off, best for steady baseline capacity you're confident you'll run the whole term. Savings Plans commit to a dollar-per-hour spend rather than a specific instance type, trading a little discount depth for the flexibility to shift across instance families, and even across EC2/Fargate/Lambda for Compute Savings Plans — generally the better default when your architecture might evolve during the commitment period. Spot Instances bid on AWS's spare capacity for up to ~90% off On-Demand, with the catch that AWS can reclaim the instance with only a 2-minute warning, making Spot ideal for stateless, fault-tolerant, interruptible workloads (CI runners, batch jobs, horizontally-scaled fleets with graceful node replacement) and a poor fit for anything stateful without checkpointing.

Right-sizing means matching instance size to actual observed utilization instead of guessing generously upfront. CloudWatch utilization metrics (CPU, memory via the CloudWatch agent, network) and AWS Compute Optimizer (which analyzes historical usage and recommends specific instance type changes) are the standard tools — an m5.2xlarge sitting at 8% average CPU utilization for months is a very common and very fixable waste pattern, and a burstable t-family instance that's constantly out of CPU credit and throttling is the opposite problem, silently degrading performance instead of overspending.

For storage, S3 lifecycle policies automatically transition objects between storage classes as they age — S3 Standard for actively accessed data, Standard-IA (Infrequent Access) for data accessed rarely but needing millisecond retrieval, Glacier Instant/Flexible/Deep Archive for long-term archival with retrieval times from milliseconds to many hours, at steeply decreasing storage cost and increasing retrieval cost/latency at each tier. S3 Intelligent-Tiering automates this transition based on observed access patterns instead of a fixed age-based rule, which is worth the small monitoring fee when access patterns are unpredictable and you'd otherwise either overpay keeping everything in Standard or risk retrieval fees/latency moving things to Glacier too aggressively.

Visibility and governance close the loop: Cost Explorer visualizes spend over time, broken down by service, linked account, or (critically) cost allocation tags, letting you answer "which team/project/environment is actually driving this bill" rather than staring at one undifferentiated total. Consistent tagging (`Project`, `Environment`, `Team`, `CostCenter`) applied at resource-creation time — ideally enforced via tag policies or Service Control Policies rather than hoped for — is the prerequisite that makes that breakdown possible at all; untagged resources are a recurring, entirely preventable source of "we don't know what this is or who owns it, so nobody will delete it" waste.

## Examples

```bash
# Get Compute Optimizer's right-sizing recommendations for currently
# running EC2 instances based on actual observed utilization history
aws compute-optimizer get-ec2-instance-recommendations \
  --instance-arns arn:aws:ec2:us-east-1:123456789012:instance/i-0123456789abcdef0
```

```json
// S3 lifecycle policy: move objects to Standard-IA after 30 days, Glacier
// Flexible Retrieval after 90 days, and expire them entirely after 2 years
{
  "Rules": [
    {
      "ID": "TierAndExpireLogs",
      "Filter": { "Prefix": "logs/" },
      "Status": "Enabled",
      "Transitions": [
        { "Days": 30, "StorageClass": "STANDARD_IA" },
        { "Days": 90, "StorageClass": "GLACIER" }
      ],
      "Expiration": { "Days": 730 }
    }
  ]
}
```

```bash
# Cost Explorer: total cost for the last 30 days grouped by cost allocation
# tag "Project" — requires the tag to be activated as a cost allocation tag first
aws ce get-cost-and-usage \
  --time-period Start=2026-08-18,End=2026-09-17 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=TAG,Key=Project
```

## Common Pitfalls / Gotchas

- Buying Reserved Instances for a workload that's still architecturally in flux — a 1- or 3-year commitment to a specific instance family locks in savings only if you actually run that shape of capacity the whole term; a Savings Plan is usually the safer default when the architecture might change.
- Never revisiting instance sizing after initial launch — utilization patterns change as an application matures, and "we picked m5.xlarge at launch two years ago" is rarely still the right size without ever having checked.
- Using Spot for stateful workloads without checkpointing — the 2-minute reclamation warning is real, and ungraceful termination of a stateful process (not just a stateless worker) causes data loss or corruption, not just a brief capacity dip.
- Leaving S3 objects in Standard forever regardless of access pattern — the single most common avoidable storage cost is data that's rarely touched sitting in the most expensive storage class with no lifecycle policy applied.
- No tagging discipline — untagged or inconsistently tagged resources make Cost Explorer's breakdowns useless for accountability, and untagged/unowned resources are the ones nobody feels safe deleting even when they're clearly unused.
- Forgetting data transfer costs — cross-AZ traffic, internet egress, and (for Glacier) retrieval fees are frequent surprise line items that don't show up when only looking at compute/storage unit pricing in isolation.
- Retrieving from Glacier Deep Archive urgently — expedited retrieval either isn't available or is disproportionately expensive at the coldest tiers; lifecycle decisions should account for realistic retrieval-time and retrieval-cost needs, not just storage cost.

## Interview Questions & Answers

**Q: On-Demand vs Reserved Instances vs Savings Plans vs Spot — how do you choose for a given workload?**
A: On-Demand for unpredictable or short-lived workloads with no commitment appetite. Reserved Instances for steady, predictable baseline load you're confident about for the full 1- or 3-year term, in exchange for the deepest discount tied to a specific instance family. Savings Plans for a similar discount level but committed as a dollar amount rather than an instance type, giving flexibility to shift across families or even compute platforms as the architecture evolves. Spot for stateless, fault-tolerant, interruptible workloads where a 2-minute reclamation notice is a non-event, in exchange for up to ~90% savings.

**Q: How would you reduce S3 storage costs for a bucket with years of accumulated logs?**
A: Apply a lifecycle policy that transitions objects to progressively cheaper storage classes as they age — Standard to Standard-IA after some weeks, then to Glacier Flexible or Deep Archive after months, and expire objects entirely once they pass a retention requirement. If access patterns are unpredictable rather than reliably age-based, S3 Intelligent-Tiering automates the same idea based on observed access instead of a fixed schedule.

**Q: How do you right-size an over-provisioned fleet of EC2 instances?**
A: Pull actual utilization history from CloudWatch (CPU at minimum; memory and disk if the CloudWatch agent is installed) over a representative period, and use AWS Compute Optimizer, which analyzes that history and recommends specific smaller (or larger, or different family) instance types. Validate with a canary/staged rollout rather than resizing the whole fleet at once, since aggregate averages can hide instances with genuinely higher peak load.

**Q: Why is tagging a cost optimization practice, not just an organizational nicety?**
A: Cost Explorer and Cost and Usage Reports can only break spend down by tag if resources are actually tagged consistently at creation time (e.g., `Project`, `Environment`, `Team`). Without that, cost visibility collapses to one undifferentiated total, nobody can be held accountable for what they're spending, and unowned/untagged resources tend to accumulate indefinitely because no one is confident enough about what they are to delete them.

**Q: What's the tradeoff Glacier makes to achieve such low storage cost, and where does that break down?**
A: Glacier's tiers trade retrieval latency and retrieval cost for dramatically lower storage cost — Flexible Retrieval can take minutes to hours, and Deep Archive up to 12+ hours, with retrieval fees that scale with how much data you pull and how urgently. It breaks down when data is moved there without accounting for realistic retrieval needs — for example, compliance data that must occasionally be produced quickly ends up either expensive to retrieve in a hurry or simply unable to meet an SLA from that tier.

## Related Topics
- [s3.md](./s3.md)
- [s3-glacier.md](./s3-glacier.md)
- [ec2.md](./ec2.md)
- [ec2-auto-scaling.md](./ec2-auto-scaling.md)
- [well-architected-framework.md](./well-architected-framework.md)
- [cloudwatch.md](./cloudwatch.md)
