# Amazon Lightsail

Lightsail is AWS's simplified virtual private server (VPS) product — it bundles compute, block storage, static IP, DNS, and a chunk of data transfer into a single flat, predictable monthly price, aimed at the same audience as DigitalOcean Droplets or a basic shared-hosting-plus-VPS offering rather than at teams building complex cloud-native architectures. Where EC2 exposes dozens of independent decisions (instance family, EBS volume type/size, security groups, VPC subnet placement, Elastic IP allocation, data-transfer pricing), Lightsail collapses most of those into a handful of fixed-size "bundles" you pick from, trading flexibility for a drastically simpler mental model and billing.

Lightsail ships preconfigured blueprints — one-click images for WordPress, LAMP, Node.js, Django, Magento, and similar common stacks — so getting a working application server running takes minutes without hand-installing a web server, runtime, and database yourself. It also offers Lightsail-managed databases (a simplified counterpart to RDS), container services (a simplified counterpart to ECS/Fargate for running containers), and object storage, all under the same flat-pricing philosophy, making it a genuinely self-contained small-application platform rather than just "cheap EC2."

The tradeoff is real: Lightsail instances live in a simplified, mostly-hidden networking layer rather than a VPC you design yourself, scaling is manual (resize the instance or add a load balancer/instance yourself; there's no native Auto Scaling Group), and the ecosystem of advanced AWS integrations (fine-grained IAM policies, complex VPC peering, most native AWS service integrations) either doesn't apply or requires "graduating" out of Lightsail. AWS explicitly supports this graduation path — you can export a Lightsail instance's snapshot into a full EC2 AMI/VPC setup once the application outgrows Lightsail's constraints, so starting on Lightsail isn't necessarily a dead end for growth, just a deliberate simplicity-first starting point.

Lightsail is the right call for simple websites, small business applications, developer sandboxes, low-traffic APIs, and situations where the person managing it isn't a dedicated infrastructure engineer and predictable flat billing matters more than fine-grained control. EC2 (plus Auto Scaling, VPC design, and the rest of the AWS networking/IAM stack) is the right call once you need horizontal scaling, custom networking topologies, granular security controls, or integration with the broader AWS service ecosystem — and Elastic Beanstalk sits in between as a middle ground: more AWS-native and scalable than Lightsail, but still far less hands-on setup than raw EC2.

## Examples

```bash
# Create a Lightsail instance from the Node.js blueprint in a specific bundle (size) —
# note how few decisions this requires compared to an equivalent ec2 run-instances call
aws lightsail create-instances \
  --instance-names node-app-1 \
  --availability-zone us-east-1a \
  --blueprint-id nodejs \
  --bundle-id small_3_0
```

```bash
# Attach a static IP so the instance's public address survives a stop/start cycle,
# then open the app's port through Lightsail's simplified firewall interface
aws lightsail allocate-static-ip --static-ip-name node-app-1-ip
aws lightsail attach-static-ip --static-ip-name node-app-1-ip --instance-name node-app-1
aws lightsail put-instance-public-ports \
  --instance-name node-app-1 \
  --port-infos fromPort=3000,toPort=3000,protocol=TCP
```

```bash
# Export a Lightsail instance snapshot so it can be launched as a full EC2 instance —
# the "graduation path" once an app outgrows Lightsail's fixed bundles and simplified networking
aws lightsail create-instance-snapshot \
  --instance-name node-app-1 \
  --instance-snapshot-name node-app-1-snapshot
aws lightsail export-snapshot --source-snapshot-name node-app-1-snapshot
```

## Common Pitfalls / Gotchas

- Assuming Lightsail scales like EC2 Auto Scaling — it doesn't have a native ASG equivalent; horizontal scaling means manually adding instances behind a Lightsail load balancer, which is far more limited than target-tracking policies on EC2.
- Underestimating the bundled data-transfer allowance — Lightsail includes a fixed amount of outbound transfer per bundle, and traffic beyond that is billed per GB, which can surprise a suddenly-popular small site.
- Forgetting that Lightsail's simplified firewall (instance-level public ports) is the only network access control layer — there's no separate NACL/Security-Group two-layer model like in a VPC, so misconfiguring it exposes the instance directly.
- Losing the public IP after a stop/start because a static IP was never allocated and attached — Lightsail instances get a new ephemeral public IP on restart otherwise, breaking DNS records pointed at the old one.
- Treating Lightsail-managed databases as a full RDS replacement — they offer far fewer engine options, less granular parameter tuning, and simpler backup/replication controls than RDS.
- Building deep coupling to Lightsail-specific APIs/blueprints and then discovering the "export to EC2" graduation path still requires meaningful rework of networking, IAM, and scaling assumptions — it's a snapshot export, not a seamless lift-and-shift.

## Interview Questions & Answers

**Q: When would you recommend Lightsail over EC2 for a new project?**
A: When the workload is a simple website, small business app, internal tool, or dev/test sandbox, where predictable flat monthly billing and minimal setup time matter more than fine-grained control — and especially when the person running it doesn't want to design a VPC, security groups, and IAM policies from scratch. Lightsail's blueprints get a working WordPress/LAMP/Node.js server running in minutes. Once the project needs horizontal auto-scaling, custom networking, or deep integration with other AWS services, EC2 (or Elastic Beanstalk as a middle ground) becomes the better fit.

**Q: How does Lightsail's pricing model differ from EC2's, and what's the tradeoff?**
A: Lightsail bundles compute, storage, a static IP, and a data-transfer allowance into one flat monthly price per bundle size, so costs are predictable and simple to reason about upfront. EC2 prices compute, EBS storage, Elastic IPs, and data transfer independently and offers multiple purchasing models (On-Demand, Reserved, Spot, Savings Plans), which is more cost-optimizable at scale but requires understanding and managing several moving cost variables instead of one flat number.

**Q: What is the "graduation path" from Lightsail to EC2, and why does it matter?**
A: AWS lets you export a Lightsail instance snapshot into an EC2-compatible AMI, which can then be launched into a normal EC2/VPC environment with full access to Security Groups, Auto Scaling, and the rest of the AWS networking stack. It matters because it means starting a project on Lightsail for simplicity doesn't lock you out of scaling up later — though in practice it's a snapshot export and re-architecture, not a one-click migration, since Lightsail's simplified networking and firewall model doesn't map directly onto VPC/Security-Group concepts.

**Q: What are Lightsail's limitations compared to EC2 for a growing production application?**
A: No native Auto Scaling Group equivalent (scaling is manual, or via a basic load balancer with manually added instances), a simplified networking layer instead of a full VPC you can design (limiting subnet topology, peering, and advanced routing), a much smaller set of instance/bundle sizing options than EC2's instance family catalog, and fewer/less granular integrations with other AWS services (IAM policies are coarser, and many native AWS service integrations that EC2 workloads take for granted don't apply directly to Lightsail resources).

## Related Topics
- [ec2.md](./ec2.md)
- [ec2-auto-scaling.md](./ec2-auto-scaling.md)
- [elastic-beanstalk.md](./elastic-beanstalk.md)
- [vpc.md](./vpc.md)
- [cost-optimization.md](./cost-optimization.md)
