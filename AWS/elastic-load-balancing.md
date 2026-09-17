# Elastic Load Balancing (ALB / NLB / CLB)

Elastic Load Balancing (ELB) is AWS's managed layer for distributing incoming traffic across multiple targets (EC2 instances, containers, IP addresses, or Lambda functions) so no single target is overwhelmed and unhealthy targets are automatically taken out of rotation. AWS offers three load balancer types under the ELB umbrella, and picking the right one depends almost entirely on which OSI layer your routing decisions need to happen at.

Application Load Balancer (ALB) operates at Layer 7 (HTTP/HTTPS/WebSocket) and can make routing decisions based on the actual content of the request — path (`/api/*` vs `/static/*`), host header (`api.example.com` vs `admin.example.com`), HTTP method, query string, or custom headers. It routes to target groups, and a target group can hold EC2 instances, IP addresses (including on-prem via VPN/Direct Connect), or even Lambda functions as targets. This makes ALB the natural fit for web applications and microservices where you want one load balancer to front many backend services differentiated by URL or hostname, rather than provisioning a separate load balancer per service.

Network Load Balancer (NLB) operates at Layer 4 (TCP/UDP/TLS) and is built for raw throughput and latency — it can handle millions of requests per second with microsecond-level latency because it doesn't parse application-layer content at all, it just forwards connections. NLB is the only ELB type that supports a static IP address (or an Elastic IP) per Availability Zone, which matters when downstream clients or firewalls need to allowlist a fixed IP rather than a DNS name. It also preserves the client's source IP address all the way to the target by default (ALB requires reading the `X-Forwarded-For` header instead, since it terminates the TCP connection itself). NLB is the right choice for non-HTTP TCP/UDP protocols, extreme performance requirements, or when static IPs are a hard requirement.

Classic Load Balancer (CLB) is the original ELB product, operating at Layer 4 with limited Layer 7 features. It predates target groups and content-based routing, and AWS actively recommends migrating off it to ALB or NLB — it exists today mostly in legacy accounts. A useful cross-cutting feature across ELB types is cross-zone load balancing: when enabled, each load balancer node distributes requests evenly across *all* registered targets in *all* enabled AZs, not just the targets in the AZ that received the request — without it, traffic distribution can become skewed if AZs have unequal numbers of healthy targets. Health checks (HTTP/HTTPS path checks for ALB, TCP/HTTP checks for NLB) continuously probe targets and mark them in-service or out-of-service, which is what lets the load balancer stop sending traffic to a failing instance before it causes user-facing errors.

## Examples

```bash
# Create an ALB, a target group with a health check, and register targets
aws elbv2 create-load-balancer --name web-alb --type application \
  --subnets subnet-aaa subnet-bbb --security-groups sg-0123456789

aws elbv2 create-target-group --name web-tg --protocol HTTP --port 80 \
  --vpc-id vpc-0123456789abcdef0 --health-check-path /healthz \
  --health-check-interval-seconds 15 --healthy-threshold-count 2

aws elbv2 register-targets --target-group-arn arn:aws:elasticloadbalancing:...:targetgroup/web-tg/abc \
  --targets Id=i-0123456789abcdef0 Id=i-0fedcba9876543210
```
This sets up the target group AWS will health-check every 15 seconds, removing an instance from rotation automatically after it fails the threshold — the mechanism behind zero-downtime rolling deploys.

```json
{
  "Type": "forward",
  "Conditions": [{"Field": "path-pattern", "Values": ["/api/*"]}],
  "Actions": [{"Type": "forward", "TargetGroupArn": "arn:aws:elasticloadbalancing:...:targetgroup/api-tg"}]
}
```
An ALB listener rule that routes only `/api/*` requests to the API target group, letting one ALB and one domain front multiple backend services (e.g. `/api/*` to a Node service, everything else to a static-asset target group) instead of standing up separate load balancers.

```bash
# Create an NLB with a static Elastic IP per AZ, for clients that need to allowlist a fixed IP
aws elbv2 create-load-balancer --name partner-nlb --type network \
  --subnet-mappings SubnetId=subnet-aaa,AllocationId=eipalloc-0111 \
                     SubnetId=subnet-bbb,AllocationId=eipalloc-0222
```
Useful when an external partner's firewall only allows connections from specific IPs — ALB can't offer this directly (its IPs are not guaranteed stable), but NLB can bind Elastic IPs per subnet/AZ.

## Common Pitfalls / Gotchas

- Trying to allowlist an ALB's IP addresses directly — ALB IPs are not static and can change; if a downstream system needs a fixed IP, you need NLB (with Elastic IPs) or a Global Accelerator in front.
- Forgetting that ALB terminates the TCP connection, so the backend sees the load balancer's IP as the source unless you read `X-Forwarded-For` (and `X-Forwarded-Proto`) from the request — code that logs or authorizes based on "client IP" silently breaks without this.
- Leaving cross-zone load balancing off (it's off by default for NLB, on by default for ALB) when AZs have unequal target counts, causing uneven load and hot instances in the AZ with fewer registered targets.
- Health check path/port misconfigured so it doesn't reflect actual application health — e.g. checking `/` when the app only fails on `/api/orders`, letting a genuinely broken instance stay "healthy" and keep receiving traffic.
- Deregistration delay (connection draining) defaults to 300 seconds — during a deploy or scale-in, instances can stay registered and receiving new connections far longer than expected if this isn't tuned down for fast-cycling deployments.
- Mixing up target group "target type" (instance vs IP vs Lambda) with what's actually registered — e.g. registering by instance ID when the target group was created with target type `ip` silently fails to route traffic.

## Interview Questions & Answers

**Q: When would you choose NLB over ALB?**
A: When you need Layer 4 performance at extreme scale (millions of requests/second, microsecond latency), a non-HTTP protocol (raw TCP/UDP, e.g. a custom protocol or gaming server), a static/Elastic IP per AZ for client allowlisting, or preservation of the original client source IP without relying on `X-Forwarded-For`. ALB is preferred whenever you need content-based routing — path, host, or header — since NLB has no visibility into HTTP semantics.

**Q: What does "cross-zone load balancing" actually change?**
A: Without it, each load balancer node only distributes traffic to targets registered in its own AZ, so if AZ A has 8 healthy targets and AZ B has 2, and traffic is split evenly across the load balancer nodes in each AZ, the 2 targets in AZ B get disproportionately more traffic per-instance than the 8 in AZ A. With it enabled, every load balancer node considers all targets across all enabled AZs, evening out the per-target load regardless of which AZ received the request.

**Q: How does ALB know a target is unhealthy, and what happens to in-flight requests when it's marked unhealthy?**
A: ALB polls the configured health check path/port at the configured interval; after the unhealthy threshold count of consecutive failures, the target is marked out-of-service and removed from routing consideration for new requests. Requests already in flight to that target are not forcibly killed by the health check itself, but if the target is genuinely down, those requests will simply fail/timeout at the client — health checks prevent new requests from going to bad targets, they don't retroactively fix requests already sent.

**Q: Why can't you see the real client IP address in your ALB-fronted application by default, and how do you get it?**
A: ALB operates as a full Layer 7 proxy — it terminates the client's TCP connection and opens a new one to the target, so from the target's perspective the source IP is the ALB node's IP. ALB injects the original client IP into the `X-Forwarded-For` header (and `X-Forwarded-Proto`/`X-Forwarded-Port`), so the application needs to read that header rather than the raw socket peer address. NLB, by contrast, preserves the original source IP at the TCP layer since it's a Layer 4 passthrough (unless you're using TLS termination on NLB).

**Q: What's deregistration delay and why does it matter during deployments?**
A: It's the time (default 300s) ELB waits after a target is deregistered or fails a health check before completing in-flight requests and stopping new ones from being sent to it — effectively a connection-draining grace period. During fast rolling deployments or autoscaling scale-in events, a long deregistration delay can slow down deploys or keep terminating instances receiving traffic longer than intended; tuning it lower (e.g. to match your app's typical request duration) speeds up deploys without cutting off legitimate long-running requests.

## Related Topics
- [vpc.md](./vpc.md)
- [ec2-auto-scaling.md](./ec2-auto-scaling.md)
- [route-53.md](./route-53.md)
- [fault-isolation.md](./fault-isolation.md)
- [network-security.md](./network-security.md)
- [observability.md](./observability.md)
