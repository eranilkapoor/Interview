# Cloud Architecture

Cloud architecture uses managed services, automation, networking, identity, observability, and cost controls to build reliable systems. Architects must balance speed, reliability, security, and cost.

## Core Cloud Building Blocks

- Compute: VM, containers, serverless
- Storage: object, block, file
- Database: relational, NoSQL, cache, warehouse
- Networking: VPC, subnets, routing, load balancers
- Security: IAM, KMS, secrets, security groups
- Observability: logs, metrics, traces, alerts
- Automation: Infrastructure as Code and CI/CD

## Interview Q&A

**Q: How do you design highly available cloud architecture?**  
A: Use multiple availability zones, load balancers, autoscaling, managed databases, health checks, backups, monitoring, and tested failover.

**Q: Serverless vs containers?**  
A: Serverless reduces operational overhead for event-driven workloads. Containers provide more control, portability, and are better for long-running services.

**Q: How do you control cloud cost?**  
A: Right-size resources, autoscale, use budgets and alerts, remove unused resources, use reserved/savings plans, lifecycle storage, and monitor cost per service/team.

