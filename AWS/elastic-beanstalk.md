# AWS Elastic Beanstalk

Elastic Beanstalk is a PaaS (platform-as-a-service) orchestration layer that provisions and wires together the underlying AWS resources for a web application — EC2 instances, an Auto Scaling Group, an Elastic Load Balancer, and optionally an RDS database — from a bundle of your application code plus configuration. It sits between "raw EC2 you configure yourself" and "fully abstracted platform where you can't see the infrastructure": Beanstalk creates real, ordinary EC2/ASG/ELB resources in your account that you can inspect, SSH into, and modify directly in the console if needed, unlike Lambda or a fully managed container platform where the compute layer is invisible to you.

Beanstalk supports two environment tiers. A web server environment handles HTTP(S) requests directly behind a load balancer — the standard shape for a REST API or web app. A worker environment instead pulls jobs from an SQS queue that Beanstalk provisions for you, running background/asynchronous processing (report generation, image processing, batch jobs) decoupled from the request/response cycle — this is Beanstalk's built-in answer to "how do I run background jobs" without you hand-wiring SQS polling infrastructure yourself.

Deployment policy is a key operational decision with real tradeoffs. All at once pushes the new version to every instance simultaneously — fastest, but causes downtime/errors during the deploy window, appropriate only for dev/test. Rolling deploys the new version to a batch of instances at a time, reducing capacity during the rollout (fine if you can tolerate slightly reduced capacity). Rolling with additional batch launches a new batch of instances first, deploys to them, then rolls through the rest — this avoids any capacity loss at the cost of a brief spike in running-instance count (and cost). Immutable deployment creates an entirely new, parallel Auto Scaling Group with the new version, validates its health, then swaps traffic and terminates the old one — the safest option because a bad deploy never touches production capacity and rollback is just discarding the new ASG. Blue/Green isn't a single-click Beanstalk deployment policy but a pattern you implement by standing up a second full environment and swapping CNAMEs (or using Route 53 weighted routing) once the new environment is validated, giving you an even cleaner separation and the ability to keep the old environment live as an instant rollback target.

Configuration beyond what the console/CLI wizard exposes is done through `.ebextensions` — YAML/JSON config files checked into your application source under an `.ebextensions/` directory that let you run commands, install packages, write files, and set environment-specific resource options as part of every deployment, effectively giving you infrastructure-as-code control over the underlying EC2 instances without leaving the Beanstalk deployment model.

Choose Beanstalk when you want a managed deployment pipeline and standard architecture (load-balanced, auto-scaled web app, optionally with a worker tier) without hand-assembling the ASG/ELB/RDS wiring yourself, but still want the ability to reach into the underlying EC2 instances when you need to. Compare against raw EC2 + Auto Scaling (more setup work, full control, best when your architecture doesn't fit Beanstalk's opinions), ECS/Fargate (if you've containerized and want container-native orchestration instead), and Lambda (if the workload is better modeled as short event-driven functions rather than a long-running server process).

## Examples

```yaml
# .ebextensions/01-packages.config — installs a system package and writes an
# environment-specific config file as part of every Beanstalk deployment
packages:
  yum:
    git: []

files:
  "/etc/nginx/conf.d/proxy.conf":
    mode: "000644"
    owner: root
    group: root
    content: |
      client_max_body_size 20M;
```

```bash
# Create a new Beanstalk environment with a Rolling with additional batch deployment
# policy, avoiding capacity loss during rollout — good default for production web tiers
aws elasticbeanstalk create-environment \
  --application-name checkout-service \
  --environment-name checkout-prod \
  --solution-stack-name "64bit Amazon Linux 2023 v6.1.0 running Node.js 20" \
  --option-settings \
    Namespace=aws:elasticbeanstalk:command,OptionName=DeploymentPolicy,Value=RollingWithAdditionalBatch \
    Namespace=aws:autoscaling:asg,OptionName=MinSize,Value=2 \
    Namespace=aws:autoscaling:asg,OptionName=MaxSize,Value=8
```

```bash
# Deploy a new application version using the EB CLI, then watch environment health —
# the standard local dev-to-prod loop for a Beanstalk-managed web environment
eb deploy checkout-prod
eb health checkout-prod --refresh
```

## Common Pitfalls / Gotchas

- Treating Beanstalk as a black box and never touching `.ebextensions` — teams then hand-edit the underlying EC2 instances or security groups directly in the console, and those changes get silently reverted or conflict on the next deployment/environment rebuild.
- Using the "All at once" deployment policy in production because it's the default in some workflows — it causes real downtime during every deploy and should be reserved for dev/test environments only.
- Forgetting that a worker environment tier requires the application to expose an HTTP endpoint that Beanstalk's internal SQS daemon (`aws-sqsd`) calls to deliver each queued job — it's not a raw queue-consumer loop you write yourself.
- Letting environment configuration drift between staging and production by editing settings ad hoc in the console instead of via saved configuration templates or `.ebextensions`, making environments non-reproducible.
- Underestimating that Immutable deployments temporarily double the running instance count (old + new ASG) during validation, which briefly increases cost and can hit account EC2 limits on smaller accounts.
- Assuming Beanstalk auto-updates the underlying platform (AMI/runtime) — platform versions must be actively managed and upgraded; an environment left alone can end up running a deprecated, unpatched platform version with no automatic security patching.

## Interview Questions & Answers

**Q: What actually happens "under the hood" when you deploy an application to Elastic Beanstalk?**
A: Beanstalk provisions and manages a real set of AWS resources on your behalf — typically an Auto Scaling Group of EC2 instances running your application behind an Elastic Load Balancer, plus optionally an RDS database and an SQS queue for a worker tier. Unlike a fully abstracted PaaS, those resources are ordinary resources in your own account: you can see them in the EC2/ASG/ELB consoles, SSH into instances, and inspect CloudWatch metrics directly, while Beanstalk continues to manage their configuration and deployment lifecycle for you.

**Q: Compare the Rolling, Rolling with additional batch, and Immutable deployment policies.**
A: Rolling deploys the new version to instances in batches, temporarily reducing total capacity by the batch size during rollout. Rolling with additional batch avoids that capacity dip by first launching one extra batch of new instances before rolling through the rest, at the cost of briefly running more instances (and paying for them) than steady state. Immutable goes further by creating an entirely separate, parallel Auto Scaling Group running the new version, health-checking it fully before cutting traffic over and only then terminating the old ASG — it's the safest option because a failed deployment never touches any instance serving live traffic, and rollback is simply discarding the new ASG.

**Q: What is a Beanstalk worker environment, and how does it differ from a web server environment?**
A: A web server environment handles synchronous HTTP(S) requests behind a load balancer — the standard shape for an API or web app. A worker environment instead processes background jobs: Beanstalk provisions an SQS queue for it, and a local daemon (`aws-sqsd`) on each worker instance polls that queue and delivers each message as an HTTP POST to your application's configured endpoint, which processes it and returns success/failure to control message deletion/retry. This gives you a managed async job-processing tier without wiring the SQS polling and IAM permissions yourself.

**Q: When would you choose Elastic Beanstalk over provisioning EC2 and an Auto Scaling Group yourself?**
A: Beanstalk when your application fits its opinionated model (a standard web tier, optionally with an RDS database and a worker tier) and you want AWS to handle provisioning, load balancer wiring, deployment orchestration, and environment health monitoring out of the box, while still retaining the ability to drop down to the underlying EC2 instances when necessary. Raw EC2 + Auto Scaling when your architecture doesn't fit that shape — custom networking topologies, non-standard health-check requirements, or infrastructure you want fully defined and versioned via your own CloudFormation/Terraform rather than Beanstalk's environment configuration model.

## Related Topics
- [ec2.md](./ec2.md)
- [ec2-auto-scaling.md](./ec2-auto-scaling.md)
- [elastic-load-balancing.md](./elastic-load-balancing.md)
- [sqs.md](./sqs.md)
- [lambda.md](./lambda.md)
- [infrastructure-as-code.md](./infrastructure-as-code.md)
