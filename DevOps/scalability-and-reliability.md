# Scalability and Reliability

Scaling a system to handle more load comes in two basic flavors. **Vertical scaling** (scaling up) means giving a single machine more resources — more CPU, more RAM, a faster disk — which is simple (no application changes needed, no distributed-systems complexity) but hits a hard ceiling (there's a biggest machine you can buy) and creates a single point of failure (if that one bigger machine goes down, everything depending on it goes down with it). **Horizontal scaling** (scaling out) means adding more machines and distributing load across them, which has no theoretical ceiling and naturally provides redundancy (one instance failing doesn't take down the whole service), but requires the application to be designed for it — statelessness, or externalized state (sessions in Redis rather than in-process memory), and a load balancer to distribute traffic. Most modern cloud-native architectures default to horizontal scaling specifically because it composes with redundancy — the same mechanism that lets you handle more load also lets you survive losing a node.

Reliability targets are formalized through **SLAs, SLOs, and SLIs** — the same trio from SRE practice: an SLI is the measured metric, an SLO is the internal target for it, an SLA is the external, often contractual promise (see `sre-basics.md` for the full breakdown). Redundancy is the mechanical foundation that makes hitting those targets possible: no single component — no single server, no single availability zone, no single database instance — should be able to take the whole system down by itself. This shows up as running multiple instances behind a load balancer, replicating a database across multiple nodes (with automatic failover to a replica if the primary dies), and increasingly, spreading infrastructure across multiple availability zones or regions so that a single data-center-level failure doesn't become a full outage.

Load balancing is the traffic-distribution layer that makes horizontal scaling and redundancy actually work together: it sits in front of a pool of servers and routes each incoming request to a healthy instance, using an algorithm like round-robin (rotate through instances evenly), least-connections (send to whichever instance currently has the fewest active requests), or weighted (send proportionally more traffic to more powerful instances). Just as important as the routing algorithm is health checking — a load balancer that keeps sending traffic to an instance that's actually broken defeats the purpose of having redundancy at all, so load balancers continuously probe each instance and automatically pull unhealthy ones out of rotation until they recover. Together, horizontal scaling, redundancy, and load balancing are the concrete mechanisms behind the abstract promise an SLO makes — an SLO target is a commitment on paper; these are the actual engineering choices that make hitting it possible under real failure conditions.

## Examples

```text
Vertical vs horizontal scaling:

Vertical:    [ 1 server: 4 CPU, 16GB ]  -->  [ 1 server: 16 CPU, 64GB ]
             Simple, but a ceiling exists and it's a single point of failure.

Horizontal:  [ 1 server ]  -->  [ server ] [ server ] [ server ]
                                     \        |        /
                                      \       |       /
                                    [   load balancer  ]
             No hard ceiling; a server dying doesn't take the service down.
```

```nginx
# nginx as a simple load balancer with a health check
upstream app_servers {
    least_conn;
    server 10.0.0.11:8080 max_fails=3 fail_timeout=30s;
    server 10.0.0.12:8080 max_fails=3 fail_timeout=30s;
    server 10.0.0.13:8080 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    location / {
        proxy_pass http://app_servers;
    }
    location /health {
        access_log off;
        return 200 "ok";
    }
}
```

```text
Redundancy across failure domains:

Region: us-east-1
  AZ-a: [app x2] [db-primary]
  AZ-b: [app x2] [db-replica]  <- automatic failover if AZ-a's db dies
  AZ-c: [app x2]

Losing any single AZ still leaves the service running, because no
component that's a single point of failure lives in only one AZ.
```

## Common Pitfalls / Gotchas

- Scaling vertically as a default without a plan for what happens when you hit the ceiling — teams often discover the hard limit under load, at the worst possible time, rather than planning for horizontal scale in advance.
- Building a horizontally scaled application that still keeps state in process memory (like in-memory sessions) — this breaks the moment a load balancer routes a user's next request to a different instance that doesn't have that state.
- Load balancing without real health checks — round-robin routing to an instance that's up but broken (returning errors, or hung) actively makes reliability worse, not better, since it keeps sending real users to a dead end.
- Achieving redundancy within a single availability zone only — protects against a single server or rack failure but not against a zone-level outage, which cloud providers do experience.
- Confusing scalability with reliability — a system can scale to huge load and still have a single point of failure that takes it all down; they're related but require separate deliberate design decisions.

## Interview Questions & Answers

**Q: What's the difference between vertical and horizontal scaling, and when would you choose each?**
A: Vertical scaling adds more resources to one machine — simple, no architecture changes, but has a hard ceiling and remains a single point of failure. Horizontal scaling adds more machines and distributes load across them — no hard ceiling and naturally redundant, but requires the application to support statelessness or externalized state, plus a load balancer. Vertical scaling is reasonable for a quick, simple fix or a workload that's genuinely hard to parallelize; horizontal scaling is the standard choice for anything that needs to survive node failures or scale past what one machine can handle.

**Q: What's the relationship between SLA, SLO, and SLI?**
A: SLI is the actual measured metric (e.g. current success rate), SLO is the internal target for that metric, and SLA is the external, often contractual commitment to customers — typically set looser than the SLO to leave a safety margin. Redundancy, horizontal scaling, and load balancing are the concrete engineering mechanisms that make hitting an SLO achievable under real-world failure conditions.

**Q: How does a load balancer decide which server should get the next request, and why does health checking matter as much as the algorithm?**
A: Common algorithms include round-robin (rotate evenly), least-connections (send to the instance with fewest active requests), and weighted routing (favor more powerful instances). Health checking matters just as much because an algorithm that keeps routing to an unhealthy instance defeats the purpose of redundancy — the load balancer needs to continuously probe each instance and remove unhealthy ones from rotation, or "redundant" instances that are actually broken just quietly degrade user experience.

**Q: Why is redundancy across multiple availability zones or regions more resilient than redundancy within a single zone?**
A: Because a single AZ can suffer a zone-wide failure (power, networking, a natural disaster) that takes down every instance in it regardless of how many redundant copies exist there. Spreading redundant instances and data replicas across multiple AZs (or regions, for the highest-stakes systems) means a single zone-level failure degrades capacity rather than causing a full outage.

**Q: A service scales horizontally fine under normal load but falls over during a traffic spike. What would you investigate?**
A: Whether the scaling is happening fast enough — auto-scaling policies with slow trigger thresholds or long instance boot times can lag behind a sudden spike — and whether a downstream dependency (a database, a third-party API, a shared cache) is the actual bottleneck rather than the horizontally-scaled application tier itself; adding more app instances doesn't help if they're all waiting on the same saturated database connection pool.

## Related Topics

- [sre-basics.md](./sre-basics.md)
- [infrastructure-as-code.md](./infrastructure-as-code.md)
- [monitoring-and-logging.md](./monitoring-and-logging.md)
- [release-strategies.md](./release-strategies.md)
