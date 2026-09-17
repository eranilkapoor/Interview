# Fault Isolation

Fault isolation is the architectural practice of containing failure so that when something breaks, it takes down as little as possible with it — the guiding metric is "blast radius": how much of the system is affected when one component fails. AWS's physical infrastructure is built around this idea from the ground up, and the same principle repeats at every layer above it, from how you place infrastructure across a region down to how you partition tenants within a single service.

The foundational building block is the distinction between Availability Zones (AZs) and Regions. A Region is a fully independent geographic area (e.g., `us-east-1`) containing multiple AZs; an AZ is one or more discrete physical data centers with independent power, cooling, and networking, connected to other AZs in the same region by low-latency private links. AZs are deliberately built to fail independently — a power outage, fire, or network failure in one AZ should not cascade into another. This is why a Multi-AZ deployment (an RDS primary in one AZ with a synchronous standby in another, or an Auto Scaling group spreading instances across 3 AZs behind a load balancer) is the standard baseline for production availability on AWS: it survives the loss of an entire data center, not just a single server. Multi-region goes a step further, protecting against a failure mode that takes out an entire region (rare, but it has happened), at substantially higher cost and complexity — most systems don't need multi-region, and reaching for it before Multi-AZ is exhausted is usually solving the wrong problem first.

The bulkhead pattern, borrowed from ship design (a ship's hull is divided into watertight compartments so a hull breach floods one compartment instead of sinking the whole ship), is the same idea applied to software: partition resources — connection pools, thread pools, queues, even entire service instances — per dependency or per tenant, so that one failing or slow dependency can't exhaust a shared resource pool and starve unrelated requests. A classic failure without bulkheads: a service shares one HTTP connection pool across calls to five downstream APIs; one of those APIs starts responding slowly, all the pool's connections get tied up waiting on it, and now requests to the other four completely healthy APIs fail too, purely from resource starvation — a single slow dependency degrading everything. Separate pools (or circuit breakers) per dependency contain that failure to just the calls actually affected.

Cell-based architecture takes bulkheading to the level of whole-system partitioning: instead of one large deployment serving all traffic/tenants, the system is divided into multiple independent, identical "cells," each a complete, isolated stack (compute, data store, everything) serving a subset of customers, with a thin routing layer in front directing each request to its cell. A bug, a bad deploy, a capacity exhaustion event, or a runaway noisy-neighbor tenant in one cell only affects the customers assigned to that cell — the blast radius is capped at one cell's share of total traffic, not 100% of it. This is how very large-scale AWS-style systems (and AWS's own internal services) bound the worst-case impact of an inevitable eventual failure, rather than trying to make failure impossible.

Shuffle sharding is a subtler, statistical technique for reducing blast radius without the operational overhead of full cell partitioning: instead of assigning each customer/tenant to one fixed shard (so any bad shard fully takes out every customer on it), each customer is assigned to a random, unique combination of a small number of shards from a larger pool. With enough shards and combinations, the probability that any two given customers share the *exact same* set of resources becomes small — so a problem caused by one noisy or malicious tenant degrades only the handful of resources their combination touches, and it's statistically unlikely that this fully overlaps with any other specific customer's combination, containing the practical impact even though every underlying resource is technically shared infrastructure.

## Examples

```bash
# Spread an Auto Scaling group's instances across 3 AZs so the loss of
# one entire data center doesn't take the whole fleet down
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name web-fleet \
  --launch-template LaunchTemplateName=web-lt,Version='$Latest' \
  --min-size 6 --max-size 12 --desired-capacity 6 \
  --vpc-zone-identifier "subnet-az1a,subnet-az1b,subnet-az1c" \
  --target-group-arns arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/web-tg/abc123
```

```python
# Bulkhead pattern: separate connection pools per downstream dependency so
# one slow/failing API can't starve calls to the others via a shared pool
import requests
from requests.adapters import HTTPAdapter

payments_session = requests.Session()
payments_session.mount("https://", HTTPAdapter(pool_maxsize=10))  # isolated pool

inventory_session = requests.Session()
inventory_session.mount("https://", HTTPAdapter(pool_maxsize=10))  # separate pool

# If payments.internal starts timing out, inventory_session's pool is
# completely unaffected — calls to inventory keep flowing normally.
```

```yaml
# RDS Multi-AZ: a synchronous standby in a second AZ that automatically
# takes over on primary failure — fault isolation for the database tier
Resources:
  OrdersDb:
    Type: AWS::RDS::DBInstance
    Properties:
      Engine: postgres
      DBInstanceClass: db.r6g.large
      MultiAZ: true
      AllocatedStorage: 100
```

## Common Pitfalls / Gotchas

- Deploying to a single AZ "to save cost" — a single AZ outage becomes a full outage; Multi-AZ is the baseline, not an optional upgrade, for anything expected to be production-available.
- Reaching for multi-region before exhausting Multi-AZ — multi-region solves a much rarer failure mode at far higher cost/complexity (data replication consistency, routing, failover orchestration); most availability requirements are fully met by Multi-AZ alone.
- Sharing one resource pool (connections, threads, a single queue) across calls to multiple independent downstream dependencies — without a bulkhead, one dependency's slowness starves the others through resource exhaustion, even though those other dependencies are completely healthy.
- No circuit breaker paired with the bulkhead — a bulkhead limits how much of a shared resource one dependency can consume, but without a circuit breaker to stop calling a known-failing dependency, requests still queue up and eventually time out inside their isolated pool, just more slowly.
- Assuming shared infrastructure is inherently "unsafe" without recognizing shuffle sharding and similar techniques exist specifically to make large-scale multi-tenant sharing statistically safe without full physical isolation per tenant.
- Building cell-based architecture prematurely for a system at a scale that doesn't need it — the operational complexity of routing, per-cell deployment, and per-cell capacity management is real overhead that isn't justified until blast-radius concerns at large scale actually demand it.

## Interview Questions & Answers

**Q: What's the difference between an Availability Zone and a Region, and why does that distinction matter for fault isolation?**
A: A Region is a fully independent geographic area; an AZ is one or more physically separate data centers within a region with independent power, cooling, and networking, connected to sibling AZs by low-latency links. AZs are built to fail independently, so spreading a deployment across multiple AZs (Multi-AZ) protects against losing an entire data center — a much more common and much cheaper-to-mitigate failure than losing an entire region, which is why Multi-AZ is the standard availability baseline and multi-region is reserved for stricter requirements.

**Q: Explain the bulkhead pattern and give a concrete example of the failure it prevents.**
A: The bulkhead pattern isolates resources (connection pools, thread pools, queues) per dependency or tenant so that one failing/slow component can't exhaust a resource shared with unrelated work. A concrete example: a service using one shared HTTP connection pool for five downstream APIs — if one API starts responding slowly, all the pool's connections get tied up waiting on it, and calls to the other four healthy APIs start failing purely from pool exhaustion. Giving each dependency its own pool contains the damage to just the calls actually affected by the slow dependency.

**Q: What is cell-based architecture and what problem does it solve that Multi-AZ alone doesn't?**
A: Cell-based architecture partitions an entire system into multiple independent, identical stacks ("cells"), each serving a subset of customers, with a routing layer directing traffic to the right cell. Multi-AZ protects against infrastructure failure (a data center going down) but a bad deploy, a software bug, or a single noisy tenant can still affect 100% of traffic across all AZs simultaneously since it's the same application logic and (often) the same shared capacity everywhere. Cells cap that blast radius to just the customers on the affected cell, regardless of whether the root cause was infrastructure or software.

**Q: What is shuffle sharding and how does it reduce blast radius without full physical isolation?**
A: Instead of assigning each tenant to one fixed shard, shuffle sharding assigns each tenant a unique random combination of a few shards drawn from a larger pool. Because each tenant's specific combination is different, the probability that any two tenants share the exact same full set of shards is low — so a problem caused by one bad tenant degrades only their specific combination of resources, and it's statistically unlikely to fully overlap with any other single tenant, containing practical impact even on genuinely shared infrastructure.

**Q: How would you reduce blast radius in a multi-tenant system without a full cell-based rewrite?**
A: Start with the cheaper techniques: ensure Multi-AZ deployment as the baseline, add bulkheads (isolated resource pools) around each downstream dependency so one slow dependency can't starve calls to healthy ones, pair bulkheads with circuit breakers to stop calling a dependency that's clearly failing, and consider shuffle sharding for shared resource pools serving many tenants so no single tenant's failure mode can affect the full customer base. Full cell-based partitioning is the heavier, later-stage tool once these techniques are exhausted and scale genuinely demands it.

## Related Topics
- [vpc.md](./vpc.md)
- [elastic-load-balancing.md](./elastic-load-balancing.md)
- [ec2-auto-scaling.md](./ec2-auto-scaling.md)
- [rds.md](./rds.md)
- [well-architected-framework.md](./well-architected-framework.md)
