# AWS Network Security

Network security in AWS is not a single service — it's a layered set of controls you compose: Security Groups and Network ACLs for traffic filtering at the instance and subnet level, AWS WAF for application-layer (Layer 7) protection, AWS Shield for DDoS protection, and access patterns like Systems Manager Session Manager that reduce the network surface you need to expose at all. Understanding when each layer applies — and that they stack rather than substitute for each other — is the core of designing a defensible VPC.

Security Groups are stateful, attached to individual ENIs (in practice, usually thought of as "attached to an instance"), and support allow rules only — there is no explicit "deny" rule in a Security Group, you simply don't add an allow rule for traffic you want blocked, and everything not explicitly allowed is implicitly denied. Being stateful means that if inbound traffic is allowed in, the corresponding outbound response traffic is automatically permitted regardless of outbound rules, and vice versa — you don't need a matching outbound rule just to let a response back out. Network ACLs (NACLs) operate at the subnet level, are stateless (meaning return traffic must be explicitly allowed by a separate rule — an inbound allow does not imply the corresponding outbound response is permitted), and support both explicit allow and explicit deny rules, evaluated in order by rule number from lowest to highest until a match is found. NACLs are a second, coarser-grained layer — most day-to-day traffic control is done with Security Groups, and NACLs are typically reserved for subnet-wide blocks (e.g. explicitly denying a known-bad CIDR range at the subnet boundary) since the stateless nature and evaluation-order model make them easy to misconfigure for routine allow-listing.

AWS WAF operates at Layer 7 and attaches to CloudFront, ALB, or API Gateway (also App Runner and AppSync) to filter HTTP requests based on rules: AWS Managed Rule Groups cover common threats like SQL injection and XSS signatures out of the box, rate-based rules throttle or block IPs exceeding a request-rate threshold (a first line of defense against application-layer floods and credential-stuffing/scraping), and custom rules let you match on IP ranges, headers, request body content, geographic origin, or any combination via WAF's rule statement logic. WAF operates on requests that have already reached the AWS edge/load balancer layer — it's about filtering malicious or abusive *application-layer* traffic, distinct from network/transport-layer DDoS mitigation.

AWS Shield Standard is automatically enabled for every AWS customer at no extra cost and defends against the most common network and transport layer (Layer 3/4) DDoS attacks — SYN floods, UDP reflection attacks, and similar — for resources like CloudFront, Route 53, and ELB. Shield Advanced is a paid subscription that adds enhanced detection for larger and more sophisticated attacks, near-real-time visibility into attacks in progress, integration with WAF for automatic rule deployment during an attack, 24/7 access to the AWS DDoS Response Team (DRT) for hands-on help during an active incident, and cost protection against scaling charges incurred as a result of a DDoS attack.

Finally, a lot of "network security" in practice is about minimizing exposed attack surface in the first place. The traditional pattern for reaching private instances was a bastion host (a jump box in a public subnet with SSH/RDP open, from which you hop to private instances) — this works but means you're permanently managing an open inbound port to the internet. AWS Systems Manager Session Manager replaces this pattern for most use cases: it establishes a session to an instance via the SSM agent over an outbound-only connection to the Systems Manager service, requiring zero open inbound ports, controlling access entirely through IAM policy rather than network reachability plus SSH keys, and logging every session to CloudTrail/S3/CloudWatch Logs for audit purposes.

## Examples

```bash
# Security Group: allow inbound HTTPS from anywhere, SSH only from a specific bastion/management CIDR
aws ec2 authorize-security-group-ingress --group-id sg-0123456789 \
  --protocol tcp --port 443 --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress --group-id sg-0123456789 \
  --protocol tcp --port 22 --cidr 203.0.113.0/24
```
Note there's no explicit "deny" — anything not covered by an allow rule (e.g. port 3389/RDP) is implicitly blocked, and because Security Groups are stateful, the response traffic for these connections doesn't need a matching outbound rule.

```bash
# Network ACL: explicitly deny a known-bad CIDR at the subnet boundary before the general allow rule
aws ec2 create-network-acl-entry --network-acl-id acl-0123456789 \
  --rule-number 100 --protocol -1 --rule-action deny \
  --cidr-block 198.51.100.0/24 --ingress

aws ec2 create-network-acl-entry --network-acl-id acl-0123456789 \
  --rule-number 200 --protocol -1 --rule-action allow \
  --cidr-block 0.0.0.0/0 --ingress
```
Because NACL rules are evaluated in ascending rule-number order and stop at the first match, the deny rule at 100 must come before the broader allow at 200 — and since NACLs are stateless, you also need a corresponding egress rule allowing the response traffic out.

```json
{
  "Name": "rate-limit-login",
  "Priority": 1,
  "Statement": {
    "RateBasedStatement": {
      "Limit": 300,
      "AggregateKeyType": "IP",
      "ScopeDownStatement": {
        "ByteMatchStatement": {
          "SearchString": "/api/login",
          "FieldToMatch": {"UriPath": {}},
          "TextTransformations": [{"Priority": 0, "Type": "NONE"}],
          "PositionalConstraint": "EXACTLY"
        }
      }
    }
  },
  "Action": {"Block": {}},
  "VisibilityConfig": {"SampledRequestsEnabled": true, "CloudWatchMetricsEnabled": true, "MetricName": "loginRateLimit"}
}
```
A WAF rate-based rule scoped specifically to `/api/login` that blocks any single IP exceeding 300 requests per 5-minute window — a common defense against credential-stuffing attacks without rate-limiting legitimate traffic to the rest of the site.

## Common Pitfalls / Gotchas

- Forgetting that NACLs are stateless — allowing inbound traffic on a port without a matching outbound allow rule for the ephemeral response ports (typically 1024-65535) silently breaks connections, a very common "it works with Security Groups alone but breaks when I add a NACL" bug.
- Relying on Security Group source references incorrectly — referencing another Security Group as the source only works within the same VPC (or peered VPC with the right setup); it's not a CIDR and doesn't work across account boundaries without a shared/peered network path.
- Treating WAF as protection against network/transport-layer DDoS — it isn't; WAF filters Layer 7 HTTP requests, while volumetric SYN floods and similar attacks are handled by Shield, not WAF.
- Leaving bastion hosts with SSH open to `0.0.0.0/0` "temporarily" — this is one of the most common real-world breach vectors; Session Manager removes the need for any open inbound port at all and should be the default unless there's a specific reason for direct SSH.
- Assuming Shield Standard is sufficient for a high-value or frequently-targeted application — Standard handles common/automatic mitigation, but Shield Advanced's DRT engagement, enhanced detection, and cost protection matter a lot for anything business-critical or a known DDoS target.
- Over-scoping Security Group rules to `0.0.0.0/0` for convenience during development and never tightening them before production — an open "allow all from anywhere" rule left on a database or admin port is a routine cause of real incidents.

## Interview Questions & Answers

**Q: What's the fundamental difference between a Security Group and a Network ACL?**
A: Security Groups are stateful and operate at the instance/ENI level, support allow rules only (implicit deny for everything else), and don't require a separate rule for return traffic. NACLs are stateless and operate at the subnet level, support both explicit allow and explicit deny rules evaluated in order by rule number, and require you to separately permit both the inbound and outbound legs of any connection since return traffic isn't automatically allowed.

**Q: Why would you ever need a NACL if Security Groups already control traffic?**
A: NACLs give you a coarser, subnet-wide control point that's independent of any individual instance's Security Group configuration — most importantly, they can explicitly *deny* traffic, which Security Groups cannot do. This matters for scenarios like blocking a known-malicious CIDR range at the subnet boundary regardless of what any instance's Security Group allows, or as a defense-in-depth backstop if a Security Group is ever misconfigured too permissively.

**Q: What's the difference between what AWS WAF and AWS Shield each protect against?**
A: WAF operates at Layer 7 and filters based on HTTP request content — SQL injection/XSS patterns, rate limits per IP, geographic or header-based rules — protecting against application-layer attacks and abuse. Shield protects at the network and transport layer (Layer 3/4) against DDoS attacks like SYN floods or reflection/amplification attacks. They're complementary: Shield Advanced can even trigger WAF rule deployment automatically as part of mitigating a detected attack, but neither substitutes for the other's layer of protection.

**Q: How does Systems Manager Session Manager improve on the traditional bastion host pattern?**
A: A bastion host requires an instance in a public subnet with an inbound port (SSH/RDP) open to some CIDR range, meaning you're always managing exposed attack surface and SSH key distribution. Session Manager instead uses the SSM agent on the target instance to establish an outbound-only connection to the Systems Manager service — no inbound ports need to be open at all, even in the Security Group. Access is governed entirely by IAM policy instead of network reachability plus credentials, and every session is logged, which also gives you a much better audit trail than SSH access typically does.

**Q: You need to allow your application servers to talk to your RDS database, but not to each other. How do you set this up with Security Groups?**
A: Create a Security Group for the database that allows inbound traffic on the DB port only from the application servers' Security Group (referencing the SG ID as the source, not a CIDR) — this automatically covers any instance in that app Security Group regardless of IP changes from scaling. Separately, don't add a rule to the app servers' own Security Group allowing inbound traffic from itself/each other; since Security Groups are allow-only and default-deny, omitting that rule is sufficient to prevent lateral traffic between app instances while still letting them reach the database.

## Related Topics
- [vpc.md](./vpc.md)
- [iam.md](./iam.md)
- [cloudfront.md](./cloudfront.md)
- [elastic-load-balancing.md](./elastic-load-balancing.md)
- [data-encryption.md](./data-encryption.md)
- [fault-isolation.md](./fault-isolation.md)
