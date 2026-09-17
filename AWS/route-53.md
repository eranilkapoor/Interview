# Route 53

Route 53 is AWS's managed DNS service, and it's also a domain registrar — you can register a domain directly through it, or bring a domain registered elsewhere and just use Route 53 to host its DNS records (its name is a nod to DNS's default port, 53). At its core it does what any DNS service does: answer queries mapping names to IP addresses or other records. What makes it interesting for interviews and real architecture is its set of routing policies, which turn DNS resolution into a traffic-management tool rather than just a static lookup table.

Simple routing returns one (or a static set of) value(s) for a record with no logic attached — the default for a single-target record. Weighted routing splits traffic across multiple resources by assigned percentage weights, which is how you implement DNS-level canary releases or A/B testing (send 5% of traffic to a new version, then ramp up). Latency-based routing returns the resource in the AWS region that gives the user the lowest measured latency, useful for globally distributed applications with regional deployments. Failover routing pairs a primary and secondary resource with health checks — if the primary fails its health check, Route 53 starts answering with the secondary, implementing active-passive DR entirely in DNS. Geolocation routing routes based on the *user's* geographic location (country/continent), useful for content licensing or localization requirements ("EU users must be served from an EU endpoint"). Geoproximity routing is similar but routes based on geographic *distance* between user and resource, and lets you apply a "bias" to expand or shrink the effective geographic region a resource serves — it requires using Route 53 Traffic Flow (the visual policy editor/versioning tool) rather than being settable as a plain record type. Multivalue Answer routing returns up to eight healthy records selected at random per query, giving basic client-side load balancing with health-check awareness — it is explicitly not a substitute for a real load balancer since it has no connection draining, no content-based routing, and relies on the client retrying a different IP on failure.

Alias records are a Route 53-specific extension of the DNS standard, not part of the DNS spec itself. A plain CNAME can't be used at a zone apex (e.g. `example.com` itself, as opposed to `www.example.com`) because the DNS spec forbids a CNAME from coexisting with other record types (like the required NS/SOA records) at the same name — this is exactly the situation at a zone apex. An Alias record sidesteps this because it isn't a CNAME at all: it's a Route 53-internal mapping evaluated at query time, which is why it can be set on the apex and point directly at an ALB, a CloudFront distribution, an S3 static website endpoint, or another Route 53 record. Alias records are also free to query (standard CNAME/A record queries against Route 53 are billed; alias queries to AWS resources are not) and automatically track the target resource's IP changes, which matters for something like an ALB whose IPs are not static.

Route 53 health checks are the mechanism that makes Failover, Multivalue Answer, and some Weighted configurations actually respond to real outages: a health check periodically probes an endpoint (HTTP/HTTPS/TCP, or even a CloudWatch alarm) and Route 53 stops returning unhealthy resources' records once a health check fails, without requiring any change to application code.

## Examples

```bash
# Create a failover record pair: primary in us-east-1, secondary in us-west-2, driven by a health check
aws route53 change-resource-record-sets --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.example.com",
        "Type": "A",
        "SetIdentifier": "primary",
        "Failover": "PRIMARY",
        "AliasTarget": {
          "HostedZoneId": "Z35SXDOTRQ7X7K",
          "DNSName": "primary-alb-1234.us-east-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'
```
This makes `api.example.com` resolve to the primary ALB as long as it's healthy, and lets a paired `SECONDARY` record (pointing to a standby-region ALB) take over automatically on failure — DR failover with no application changes.

```json
{
  "AliasTarget": {
    "HostedZoneId": "Z2FDTNDATAQYW2",
    "DNSName": "d111111abcdef8.cloudfront.net",
    "EvaluateTargetHealth": false
  }
}
```
An Alias record pointing the apex domain `example.com` directly at a CloudFront distribution — something a CNAME record could never do at the zone apex, and it costs nothing extra to query since it's an AWS-target alias.

```bash
# Weighted routing for a canary release: 95% to v1, 5% to v2
aws route53 change-resource-record-sets --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "app.example.com", "Type": "A",
        "SetIdentifier": "v2-canary", "Weight": 5,
        "AliasTarget": {"HostedZoneId": "Z35SXDOTRQ7X7K", "DNSName": "v2-alb.us-east-1.elb.amazonaws.com", "EvaluateTargetHealth": true}
      }
    }]
  }'
```
Combined with a `95`-weighted `v1-primary` record, this gradually shifts real production traffic to a new version at the DNS layer — useful when you want to canary across entirely separate stacks/ALBs rather than within a single target group.

## Common Pitfalls / Gotchas

- Forgetting that DNS changes are not instant even with low TTLs — clients, resolvers, and ISPs cache records, so a failover or cutover can take longer to fully propagate than the TTL alone suggests, especially for clients that ignore TTL (some OS/browser DNS caches).
- Using a CNAME at the zone apex — it's disallowed by the DNS spec because NS/SOA records must also exist there; you need an Alias record (or, for non-AWS targets, some registrars' non-standard "ANAME"/"flattening" workaround) instead.
- Assuming Multivalue Answer routing is a real load balancer — it has no connection draining, no weighted distribution beyond "up to 8 random healthy records," and depends on the client actually retrying a different returned IP on connection failure, which not all clients do well.
- Setting TTLs too high on records you might need to fail over or repoint quickly (some default to 300s or higher) — lower the TTL in advance of a planned migration or DR test, since you can't retroactively "unpropagate" an already-cached high-TTL answer.
- Health checks against a private/internal-only endpoint — public Route 53 health checkers run from outside your VPC by default and cannot reach private IPs; you need a CloudWatch-alarm-based health check instead for private resources.
- Forgetting `EvaluateTargetHealth` on an Alias record pointing at another record/resource — without it, Route 53 won't factor the target's own health into whether to return this alias, which can undermine a failover setup that depends on health propagating through a chain of aliases.

## Interview Questions & Answers

**Q: Why can't you use a plain CNAME record at a domain's zone apex, and how does Route 53 solve this?**
A: The DNS specification prohibits a CNAME from coexisting with other record types at the same name, and the zone apex must also hold NS and SOA records — so a CNAME there would violate the spec. Route 53's Alias record is not a CNAME at all; it's a Route 53-specific mechanism resolved internally at query time, so it can legally sit at the apex while still pointing at an AWS resource like an ALB, CloudFront distribution, or S3 website endpoint, and it updates automatically if that resource's underlying IPs change.

**Q: How would you implement an active-passive multi-region failover using only Route 53?**
A: Create two records with the same name, one marked `Failover: PRIMARY` pointing at the primary region's endpoint (typically via Alias to an ALB or CloudFront) and one marked `SECONDARY` pointing at the standby region, each with `EvaluateTargetHealth` and/or an attached health check. As long as the primary's health check passes, Route 53 answers with the primary. When it fails, Route 53 automatically starts answering with the secondary's record — no application or infrastructure change needed, just DNS-level failover, though clients still need to respect TTL to pick up the change.

**Q: What's the difference between weighted routing and geoproximity routing, and when would you use each?**
A: Weighted routing splits traffic by an arbitrary percentage you assign, independent of the requester's location — useful for canary releases, A/B tests, or gradual migrations. Geoproximity routing routes based on the geographic distance between the user and each resource, with an adjustable "bias" per resource to expand or shrink its effective catchment area; it's for directing users to their nearest deployment (minimizing latency due to geography) rather than for arbitrary traffic-splitting experiments, and it requires Route 53 Traffic Flow.

**Q: Is Multivalue Answer routing a replacement for a load balancer? Why or why not?**
A: No. It returns up to eight healthy IP addresses per query, selected at random, giving basic distribution and health-check awareness at the DNS layer, but it has none of a real load balancer's capabilities — no connection draining, no content-based routing rules, no weighted or least-connections algorithms, and it depends entirely on the client retrying a different returned address if the first one fails, which not all clients handle gracefully. It's best used as a lightweight complement (e.g., for a fleet of stateless endpoints) rather than as a substitute for ALB/NLB.

**Q: A user reports still hitting the old server 20 minutes after you changed a DNS record with a 300-second TTL. What's going on?**
A: Several layers can cache beyond the record's TTL: the user's OS DNS cache, browser DNS cache, or their ISP's resolver may not strictly honor TTL, and some resolvers cache more aggressively than they should. Route 53 itself answers the new value immediately, but propagation to every downstream cache isn't instantaneous or fully guaranteed within exactly the TTL window. Practically, you plan DNS cutovers by lowering the TTL well in advance of the change (so old cached answers expire quickly once you do switch), and you don't treat "TTL has passed" as a hard guarantee for every client.

## Related Topics
- [cloudfront.md](./cloudfront.md)
- [elastic-load-balancing.md](./elastic-load-balancing.md)
- [fault-isolation.md](./fault-isolation.md)
- [vpc.md](./vpc.md)
- [observability.md](./observability.md)
- [well-architected-framework.md](./well-architected-framework.md)
