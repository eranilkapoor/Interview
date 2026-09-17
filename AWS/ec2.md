# Amazon EC2

Amazon EC2 (Elastic Compute Cloud) provides resizable virtual servers ("instances") that run on AWS's hypervisor fleet — you choose an instance family sized for CPU/memory/network needs, boot it from an AMI (Amazon Machine Image, a snapshot of an OS + installed software), attach storage, and get root/administrator access to a machine you fully control. It sits at the "I manage the OS" end of the compute spectrum, contrasted with fully managed platforms like Lambda or Elastic Beanstalk where AWS owns the underlying host.

Instances come in families tuned for different workloads: general purpose (t3/t4g burstable, m5/m6i balanced) for typical web/app servers; compute-optimized (c5/c6i) for CPU-bound workloads like batch processing or gaming servers; memory-optimized (r5, x1) for in-memory databases and caches; and storage-optimized (i3 with NVMe instance store, d2 with dense HDD) for data warehousing and distributed file systems. Picking the wrong family is a common cost/performance mistake — a burstable t-family instance that exhausts its CPU credit balance under sustained load will throttle hard, while an m5 running at 10% utilization is wasted spend.

Storage comes in two flavors that get confused constantly: instance store is physically attached NVMe/SSD storage that is extremely fast but ephemeral — data is lost on stop, terminate, or underlying hardware failure (though it survives reboot). EBS (Elastic Block Store) is network-attached, persists independently of the instance lifecycle, and can be snapshotted to S3 and reattached to a different instance. Pricing options range from On-Demand (pay per second, no commitment), Reserved Instances (1 or 3 year commitment for up to ~72% discount), Savings Plans (a more flexible dollar-based commitment across instance families), Spot Instances (bid on spare capacity for up to 90% discount, but AWS can reclaim the instance with a 2-minute interruption warning), to Dedicated Hosts (a physical server billed to you alone, for licensing or compliance needs).

Network-layer security has two independent, commonly confused layers: Security Groups are stateful (a response to allowed inbound traffic is automatically allowed out) and support allow-only rules, evaluated at the instance/ENI level. Network ACLs are stateless (you must explicitly allow both directions) and support both allow and deny rules, evaluated at the subnet level as a second layer of defense. IMDSv2 (Instance Metadata Service v2) requires a session token obtained via a PUT request before GET requests to the metadata endpoint succeed, closing off the SSRF attack class where a vulnerable web app on the instance could be tricked into fetching `169.254.169.254/latest/meta-data/iam/security-credentials/` and leaking the instance's IAM role credentials — IMDSv1 has no such protection and should be disabled on new instances.

EC2 is the right choice when you need full control over the OS, custom kernel modules, licensing that requires dedicated hardware, or workloads that don't fit a container/serverless model cleanly. Compare against Lightsail (a simplified, flat-rate wrapper around EC2+networking+storage for simple apps with less flexibility), ECS/Fargate (if you've already containerized and want AWS to manage the host layer), and Lambda (if the workload is short-lived, event-driven, and stateless) — the same application can often run on any of these, and the choice comes down to how much operational ownership you want versus how much control you need.

## Examples

```bash
# Launch a t3.micro from an Amazon Linux 2023 AMI into a specific subnet and security group,
# using IMDSv2-only (http-tokens required) to close off the SSRF metadata-theft vector
aws ec2 run-instances \
  --image-id ami-0abcdef1234567890 \
  --instance-type t3.micro \
  --key-name my-keypair \
  --subnet-id subnet-0123456789abcdef0 \
  --security-group-ids sg-0123456789abcdef0 \
  --metadata-options "HttpTokens=required,HttpEndpoint=enabled" \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=web-01}]'
```

```json
// IAM policy granting an application role permission to describe and start/stop only
// instances tagged Project=checkout — least-privilege scoping instead of ec2:* on "*"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DescribeAll",
      "Effect": "Allow",
      "Action": "ec2:DescribeInstances",
      "Resource": "*"
    },
    {
      "Sid": "StartStopScopedByTag",
      "Effect": "Allow",
      "Action": ["ec2:StartInstances", "ec2:StopInstances"],
      "Resource": "arn:aws:ec2:*:*:instance/*",
      "Condition": {
        "StringEquals": { "aws:ResourceTag/Project": "checkout" }
      }
    }
  ]
}
```

```yaml
# CloudFormation snippet: an EBS-backed instance with a security group allowing only
# HTTPS inbound, demonstrating stateful SG rules vs. subnet-level NACLs
Resources:
  WebSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Allow HTTPS inbound only
      VpcId: !Ref MyVpc
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0
  WebInstance:
    Type: AWS::EC2::Instance
    Properties:
      InstanceType: t3.small
      ImageId: ami-0abcdef1234567890
      SecurityGroupIds: [!Ref WebSecurityGroup]
      BlockDeviceMappings:
        - DeviceName: /dev/xvda
          Ebs:
            VolumeSize: 20
            VolumeType: gp3
            DeleteOnTermination: true
```

## Common Pitfalls / Gotchas

- Leaving IMDSv1 enabled — a compromised app on the instance can hit the unauthenticated metadata endpoint and steal the instance role's temporary IAM credentials via SSRF. Enforce `HttpTokens=required` (IMDSv2).
- Confusing instance store with EBS — stopping (not just rebooting) an instance backed by instance store wipes its data permanently; only EBS-backed root volumes persist across stop/start.
- Forgetting Spot Instances can be reclaimed with only a 2-minute warning — unsuitable for stateful workloads without checkpointing, but excellent for fault-tolerant batch/CI workloads.
- Over-provisioning instance family/size "just in case," burning budget on unused CPU/memory instead of right-sizing with CloudWatch utilization data or Compute Optimizer.
- Security Groups only allow — there's no explicit deny rule — so a public-facing SG accidentally left permissive can't be locked down with a "deny" rule; you must remove or narrow the allow rule itself.
- Not accounting for data transfer costs — cross-AZ and internet-egress traffic is billed per GB and is a frequent surprise line item on the bill, especially for chatty multi-AZ architectures.

## Interview Questions & Answers

**Q: What's the difference between Security Groups and Network ACLs?**
A: Security Groups are stateful and operate at the instance/ENI level — they only support allow rules, and return traffic for an allowed request is automatically permitted regardless of outbound rules. Network ACLs are stateless and operate at the subnet level — they support both allow and deny rules, and you must explicitly permit both the request and the response direction. NACLs are typically used as a coarse subnet-wide guardrail, with Security Groups doing the fine-grained per-instance enforcement.

**Q: Why would you choose Spot Instances, and what's the catch?**
A: Spot Instances let you bid on AWS's unused capacity for up to ~90% off On-Demand pricing, which is excellent for stateless, fault-tolerant, interruptible workloads like CI runners, batch rendering, or distributed data processing where a node dying and being replaced is a non-event. The catch is AWS can reclaim the capacity with only a 2-minute interruption notice via the instance metadata endpoint, so Spot is unsuitable for anything without checkpointing or that can't tolerate ungraceful termination.

**Q: What is IMDSv2 and what problem does it solve?**
A: IMDSv1 lets any process on the instance make a simple GET request to `169.254.169.254` to retrieve instance metadata, including the temporary credentials of the attached IAM role — if an application on the instance has an SSRF vulnerability, an attacker can trick it into fetching that URL and stealing the role's credentials remotely. IMDSv2 requires first obtaining a session token via a PUT request with a hop-limit-respecting TTL header before any GET will succeed, which most SSRF payloads can't replicate (particularly because many SSRF proxies strip the PUT verb or custom headers), meaningfully closing that attack path.

**Q: When would you pick EC2 over Lambda or Elastic Beanstalk for a given workload?**
A: EC2 when you need full OS control (custom kernel modules, specific runtime versions, licensing tied to physical/dedicated hardware), long-running stateful processes, or workloads with predictable, sustained load where Reserved Instances/Savings Plans beat Lambda's per-invocation pricing. Elastic Beanstalk if you want AWS to provision and wire together the EC2/ASG/ELB stack for you while still retaining access to tune it. Lambda if the workload is short-lived, bursty, and event-driven, where you don't want to manage any server lifecycle at all.

**Q: How does EC2 pricing model risk versus commitment, and how would you choose between On-Demand, Reserved Instances, and Savings Plans?**
A: On-Demand carries no commitment and the highest per-hour price — right for unpredictable or short-lived workloads. Reserved Instances commit to a specific instance family/region for 1 or 3 years in exchange for up to ~72% discount, best for steady, predictable baseline capacity you're confident you'll run for the full term. Savings Plans commit to a dollar-per-hour spend rather than a specific instance type, trading some discount depth for flexibility to shift between instance families or even to Fargate/Lambda — generally the better default for teams whose architecture might evolve during the commitment period.

## Related Topics
- [ec2-auto-scaling.md](./ec2-auto-scaling.md)
- [lambda.md](./lambda.md)
- [elastic-beanstalk.md](./elastic-beanstalk.md)
- [lightsail.md](./lightsail.md)
- [vpc.md](./vpc.md)
- [iam.md](./iam.md)
