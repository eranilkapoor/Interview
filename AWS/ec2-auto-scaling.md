# EC2 Auto Scaling

EC2 Auto Scaling automatically adjusts the number of running EC2 instances in a group to match demand, replace unhealthy instances, and maintain a target capacity — without it, you'd either over-provision for peak load (wasting money) or under-provision and get paged when traffic spikes. The core object is the Auto Scaling Group (ASG): a logical collection of instances defined by a min, max, and desired capacity, spread across one or more Availability Zones, that AWS keeps converged on the desired count by launching or terminating instances as needed.

An ASG launches instances from a Launch Template — a versioned, reusable spec of AMI, instance type, key pair, security groups, user data, and IAM instance profile. Launch Configurations are the legacy predecessor: they're immutable (can't be edited, only replaced) and frozen — AWS no longer adds new EC2 features to them, so launch templates are the correct choice for anything new, and they additionally support versioning, mixed instance policies (for Spot/On-Demand diversification), and T-family unlimited burst mode.

Scaling policies decide when to change capacity. Target tracking is the simplest and most common — you declare a target metric value (e.g., "keep average CPU at 50%") and AWS manages the CloudWatch alarms and adjustments itself. Step scaling gives finer control, adding/removing different amounts of capacity depending on how far a metric has breached a threshold (e.g., +2 instances if CPU > 70%, +4 if CPU > 90%). Scheduled scaling sets capacity ahead of known traffic patterns (e.g., scale up before a 9am traffic ramp). Predictive scaling uses ML on historical CloudWatch data to forecast load and pre-provision capacity ahead of time, combining well with target tracking as a reactive backstop.

Health is judged by two independent checks: EC2 status checks (is the instance itself reachable and healthy at the hypervisor/OS level) and, if attached to a load balancer, ELB health checks (is the application actually responding correctly on its health-check path). An ASG can mark an instance "healthy" by EC2 checks while the application inside it is deadlocked — attaching ELB health checks to the ASG closes that gap, since the ASG will then terminate and replace instances the load balancer considers unhealthy, not just ones the hypervisor considers unhealthy.

Two operational features matter for production reliability: cooldown periods (a window after a scaling activity during which further scaling triggers are suppressed, preventing rapid flapping from noisy metrics) and lifecycle hooks (pause an instance in the `Pending` or `Terminating` state so custom code can run — e.g., pulling secrets and warming caches before an instance goes into service, or draining connections and shipping final logs before termination). Warm pools keep a set of pre-initialized, stopped (or running) instances ready to be moved into service faster than a cold launch, cutting the scale-out latency for workloads with slow boot/bootstrap times.

## Examples

```bash
# Create an Auto Scaling Group from a launch template, spanning two subnets/AZs,
# with min/max/desired capacity and ELB health checks attached
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name web-asg \
  --launch-template "LaunchTemplateName=web-lt,Version=\$Latest" \
  --min-size 2 --max-size 10 --desired-capacity 2 \
  --vpc-zone-identifier "subnet-0123abcd,subnet-0456efgh" \
  --target-group-arns arn:aws:elasticloadbalancing:us-east-1:111122223333:targetgroup/web-tg/abc123 \
  --health-check-type ELB \
  --health-check-grace-period 120
```

```bash
# Attach a target-tracking policy that keeps average CPU utilization around 50%,
# letting AWS manage the underlying CloudWatch alarms instead of hand-rolling step rules
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name web-asg \
  --policy-name cpu-target-tracking \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration '{
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ASGAverageCPUUtilization"
    },
    "TargetValue": 50.0
  }'
```

```yaml
# CloudFormation: a lifecycle hook that pauses new instances in Pending:Wait so a
# configuration-management step can complete before the instance is put into service
Resources:
  WarmupHook:
    Type: AWS::AutoScaling::LifecycleHook
    Properties:
      AutoScalingGroupName: !Ref WebASG
      LifecycleTransition: "autoscaling:EC2_INSTANCE_LAUNCHING"
      HeartbeatTimeout: 300
      DefaultResult: CONTINUE
```

## Common Pitfalls / Gotchas

- Still using Launch Configurations for new ASGs — they're frozen (no new EC2 features, no versioning) and AWS explicitly recommends Launch Templates for everything new.
- Setting `min-size` too low for cost savings and getting caught out by a zonal failure — with min=1 in a single AZ, an AZ outage means zero capacity until the ASG notices and relaunches elsewhere.
- Forgetting `--health-check-type ELB` — by default the ASG only checks EC2 status, so an instance that's "up" but returning 500s from the app never gets replaced automatically.
- Scaling policies fighting each other — combining an aggressive step-scaling policy with target tracking on the same metric without understanding precedence can cause oscillation ("flapping") between scale-out and scale-in.
- Cooldown periods set too long delay legitimate scale-out during a real traffic spike; set too short causes thrashing from noisy short-term metric spikes.
- Not using lifecycle hooks for graceful termination — instances get abruptly killed mid-request during scale-in unless a `Terminating` hook gives time to drain connections and finish in-flight work.

## Interview Questions & Answers

**Q: What's the difference between a Launch Template and a Launch Configuration?**
A: A Launch Configuration is the legacy, immutable way to define an ASG's instance spec — it can't be edited or versioned, and AWS has frozen it, so it doesn't get new EC2 features (like mixed instance types or T-family unlimited mode). A Launch Template is the modern replacement: versioned, mutable in the sense that you create new versions, and it supports advanced features like mixing Spot and On-Demand instances in one ASG. AWS recommends Launch Templates for any new Auto Scaling Group.

**Q: Explain target tracking vs. step scaling.**
A: Target tracking lets you declare a desired value for a metric (e.g., 50% average CPU) and AWS manages the CloudWatch alarms and capacity adjustments to hold that value — it's the simplest option and correct for most cases. Step scaling requires you to define the CloudWatch alarms yourself and specify exactly how much capacity to add or remove at each breach threshold (e.g., +1 instance at 60% CPU, +3 instances at 85% CPU), giving finer control for workloads where a uniform response to any breach isn't appropriate.

**Q: What's a lifecycle hook and when would you use one?**
A: A lifecycle hook pauses an instance in the `Pending:Wait` (launching) or `Terminating:Wait` state for up to 48 hours (with heartbeat extensions), giving custom code time to run before the ASG completes the transition. On launch, this is commonly used to pull secrets, warm application caches, or register with service discovery before traffic is routed to the instance. On termination, it's used to drain in-flight connections, flush logs/metrics, or deregister cleanly, avoiding abrupt request failures during scale-in.

**Q: Why would EC2 status checks alone be insufficient for a web-serving ASG, and how do you fix that?**
A: EC2 status checks only verify that the instance is reachable at the hypervisor/OS level — they can't tell if the web server process crashed, is deadlocked, or is returning errors. If the ASG only used EC2 checks, an instance could sit in the group indefinitely serving 500s. Setting `health-check-type` to `ELB` makes the ASG defer to the load balancer's application-level health checks instead, so instances failing real health-check requests get terminated and replaced.

**Q: What are warm pools and what problem do they solve?**
A: A warm pool keeps a set of pre-initialized EC2 instances (stopped or running, outside the ASG's active capacity) ready to be moved into service quickly. This matters for workloads with slow boot/bootstrap times — installing dependencies, warming JIT caches, pulling large containers — where a cold launch during a scale-out event would be too slow to respond to a sudden traffic spike. The warm pool absorbs that latency ahead of time.

## Related Topics
- [ec2.md](./ec2.md)
- [elastic-load-balancing.md](./elastic-load-balancing.md)
- [elastic-beanstalk.md](./elastic-beanstalk.md)
- [cloudwatch.md](./cloudwatch.md)
- [cloudformation.md](./cloudformation.md)
- [fault-isolation.md](./fault-isolation.md)
