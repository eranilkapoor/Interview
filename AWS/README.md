# AWS Interview Prep

This folder is a personal knowledge base for studying and teaching core AWS concepts, built for interview preparation and for explaining these topics to others. Each file covers one service or concept in depth — a real conceptual explanation of how it actually works, practical CLI/SDK/IAM-policy examples, common pitfalls and cost/security traps, and interview-style Q&A — so you can both refresh your own understanding quickly and use the material to walk someone else through the same concept from scratch.

AWS itself is enormous (AWS lists well over 200 services today), so this folder doesn't try to cover everything. It focuses on the services and cross-cutting concepts that come up most often in real interviews: compute, storage, databases, networking, security/IAM, serverless, observability, cost, and the architectural principles (the Well-Architected Framework) that tie all of it together.

## Table of Contents

### Compute
- [EC2](./ec2.md)
- [EC2 Auto Scaling](./ec2-auto-scaling.md)
- [Elastic Beanstalk](./elastic-beanstalk.md)
- [Lightsail](./lightsail.md)

### Storage
- [S3](./s3.md)
- [S3 Glacier](./s3-glacier.md)

### Databases
- [DynamoDB](./dynamodb.md)
- [RDS](./rds.md)
- [Aurora DB](./aurora-db.md)
- [Redshift](./redshift.md)
- [ElastiCache](./elasticache.md)

### Networking & Content Delivery
- [VPC](./vpc.md)
- [Elastic Load Balancing](./elastic-load-balancing.md)
- [Route 53](./route-53.md)
- [CloudFront](./cloudfront.md)
- [Fault Isolation](./fault-isolation.md)

### Security, IAM & Encryption
- [IAM](./iam.md)
- [Network Security](./network-security.md)
- [Data Encryption](./data-encryption.md)
- [Key Management Service (KMS)](./key-management-service.md)
- [Cognito](./cognito.md)

### Serverless & Integration
- [Lambda](./lambda.md)
- [API Gateway](./api-gateway.md)
- [SNS](./sns.md)
- [SQS](./sqs.md)
- [Chime](./chime.md)

### Observability & Cost
- [CloudWatch](./cloudwatch.md)
- [Observability](./observability.md)
- [Cost Optimization](./cost-optimization.md)

### Infrastructure as Code & Architecture Principles
- [CloudFormation](./cloudformation.md)
- [Infrastructure as Code](./infrastructure-as-code.md)
- [Well-Architected Framework](./well-architected-framework.md)

## Interview Questions & Answers — Curated

**1. ALB vs NLB vs CLB — how do you choose? (Intermediate)**
ALB (Application Load Balancer) operates at Layer 7 and understands HTTP/HTTPS/WebSocket, so it can route by path, host, or header — the right choice for web apps and microservices. NLB (Network Load Balancer) operates at Layer 4 (TCP/UDP/TLS), handles millions of requests per second with ultra-low latency, and supports a static IP per AZ — the right choice when you need raw throughput, non-HTTP protocols, or clients that need to allowlist a fixed IP. CLB (Classic Load Balancer) is legacy and AWS recommends migrating off it entirely. See [elastic-load-balancing.md](./elastic-load-balancing.md).

**2. How does S3 achieve its durability and availability? (Intermediate)**
S3 Standard is designed for 99.999999999% (11 nines) durability by synchronously storing redundant copies of an object across a minimum of three physically separate Availability Zones within a region, and it verifies checksums continuously to detect and repair bit rot. Availability (99.99% for Standard) is a separate SLA about the service being reachable to serve requests, distinct from durability (data not being lost). See [s3.md](./s3.md).

**3. IAM role vs IAM user vs resource-based policy — what's the difference? (Intermediate)**
A user has long-term credentials for a specific human or application identity. A role has no long-term credentials — it's assumed via STS for temporary credentials, and is the recommended way to grant permissions to AWS services (EC2, Lambda) or federated/cross-account principals. A resource-based policy (like an S3 bucket policy) is attached directly to the resource rather than to an identity, and can grant access to principals in other accounts without them assuming a role in your account. See [iam.md](./iam.md).

**4. How does IAM evaluate whether a request is allowed? (Advanced)**
Default deny: unless something explicitly allows the action, it's denied. An explicit Deny anywhere (identity policy, resource policy, permission boundary, or SCP) always wins over any Allow, no matter where the Allow comes from. Otherwise, access requires at least one explicit Allow (from an identity-based or resource-based policy) that isn't blocked by a permission boundary or Service Control Policy ceiling. See [iam.md](./iam.md).

**5. What are Lambda cold-start mitigation strategies? (Advanced)**
Use provisioned concurrency to keep a pool of pre-initialized execution environments warm; minimize deployment package size and avoid heavy SDK/library initialization in the global scope where possible; choose a lighter runtime (e.g. avoid unnecessarily large custom containers); keep functions out of a VPC unless required, since VPC-attached functions historically had extra ENI-attachment cold-start latency (largely mitigated today by Hyperplane ENIs, but still worth knowing). See [lambda.md](./lambda.md).

**6. VPC Peering vs Transit Gateway — when would you use each? (Advanced)**
VPC Peering is a direct 1:1 connection between two VPCs and is not transitive — if A peers with B and B peers with C, A still cannot reach C through B. It's fine for a small number of VPCs. Transit Gateway is a regional hub-and-spoke router that connects many VPCs and on-premises VPNs transitively through a single attachment point, which scales far better once you have more than a handful of VPCs to connect. See [vpc.md](./vpc.md).

**7. What are the pillars of the AWS Well-Architected Framework? (Beginner/Intermediate)**
Six pillars: Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, and Sustainability (added in 2021). Each has its own design principles used as a structured lens for evaluating architecture tradeoffs — interviewers often use this framework as scaffolding for "how would you design X" questions. See [well-architected-framework.md](./well-architected-framework.md).

**8. Security Group vs Network ACL? (Intermediate)**
Security Groups are stateful and operate at the instance/ENI level — you only define allow rules, and return traffic is automatically permitted. Network ACLs are stateless and operate at the subnet level — you must define both allow and deny rules, evaluated in numeric order, and explicitly allow return traffic yourself. See [network-security.md](./network-security.md) and [vpc.md](./vpc.md).

**9. DynamoDB partition key vs sort key, and on-demand vs provisioned capacity? (Intermediate)**
The partition key (hash key) determines which physical partition an item lives on; adding a sort key creates a composite primary key that allows multiple items per partition key, queryable by sort key range. On-demand capacity auto-scales and bills per request, good for unpredictable traffic; provisioned capacity requires specifying RCU/WCU up front (optionally with Auto Scaling layered on top), which is cheaper for steady, predictable workloads. See [dynamodb.md](./dynamodb.md).

**10. RDS Multi-AZ vs Read Replicas? (Intermediate)**
Multi-AZ creates a synchronous standby in a different AZ purely for high availability and automatic failover — it is not used for read scaling in the classic model. Read Replicas use asynchronous replication and exist specifically to offload read traffic (and can even span regions); they can be promoted to standalone instances but don't provide automatic failover. See [rds.md](./rds.md).

**11. RDS vs Aurora — why would you pick Aurora? (Advanced)**
Aurora is AWS's proprietary MySQL/PostgreSQL-compatible engine with a distributed, auto-scaling storage layer (up to 128 TB) replicated 6 ways across 3 AZs, decoupled from compute. It supports up to 15 read replicas with typically single-digit-millisecond replication lag (versus higher lag on standard RDS replicas) and generally faster failover than RDS Multi-AZ. The tradeoff is Aurora is a smaller set of compatible engines and a different cost model, not a drop-in replacement for every RDS engine (e.g. no Aurora Oracle/SQL Server). See [aurora-db.md](./aurora-db.md) and [rds.md](./rds.md).

**12. How would you design a fan-out messaging architecture with SNS and SQS? (Intermediate/Advanced)**
Publish once to an SNS topic, and subscribe multiple SQS queues (one per consuming service) to that topic — SNS pushes a copy of each message to every subscribed queue. This decouples the publisher from consumers, lets each consumer process independently at its own pace with SQS's durability and retry semantics, and lets you add new consumers later without touching the publisher. See [sns.md](./sns.md) and [sqs.md](./sqs.md).

**13. What is envelope encryption, and why does KMS use it? (Advanced)**
Envelope encryption encrypts the actual data with a fast symmetric data key, then encrypts that (small) data key with a KMS master key that never leaves KMS. This avoids sending large payloads to the KMS API (whose direct Encrypt call is capped at 4 KB) and limits the master key's exposure to only ever encrypting/decrypting small data keys, not bulk data. See [key-management-service.md](./key-management-service.md) and [data-encryption.md](./data-encryption.md).

**14. CloudFormation vs Terraform vs CDK? (Intermediate/Advanced)**
CloudFormation is AWS-native, free, declarative YAML/JSON with built-in rollback and drift detection, but AWS-only. Terraform is multi-cloud, also declarative (HCL), but requires you to manage a state file (commonly stored in S3 with DynamoDB locking). CDK compiles real code (TypeScript/Python/etc.) down to CloudFormation templates, giving you loops, conditionals, and reusable higher-level constructs while still getting CloudFormation's deployment guarantees underneath. See [cloudformation.md](./cloudformation.md) and [infrastructure-as-code.md](./infrastructure-as-code.md).

**15. How do you keep S3 costs under control at scale? (Intermediate)**
Use lifecycle policies to transition infrequently accessed objects to cheaper storage classes (Standard-IA, Glacier) or expire them automatically, use S3 Intelligent-Tiering when access patterns are unpredictable, avoid excessive PUT/LIST/GET request costs from bad access patterns (e.g. millions of small objects listed repeatedly), and watch for accidental cross-region data transfer or retrieval fees on Glacier. See [s3.md](./s3.md), [s3-glacier.md](./s3-glacier.md), and [cost-optimization.md](./cost-optimization.md).

**16. What's the difference between encryption at rest and in transit, and does one make the other unnecessary? (Beginner/Intermediate)**
Encryption at rest protects stored data (on disk, in a database, in S3) from someone who gains access to the underlying storage. Encryption in transit (TLS) protects data moving across a network from interception. They protect against different threats and are not substitutes for each other — a well-architected system uses both. See [data-encryption.md](./data-encryption.md).

**17. What are the main EC2 purchasing options, and when would you use Spot Instances? (Intermediate)**
On-Demand (pay per hour/second, no commitment, most expensive), Reserved Instances and Savings Plans (commit to 1 or 3 years for a discount, best for steady baseline load), and Spot Instances (bid on spare capacity for up to ~90% off, but can be reclaimed with a 2-minute warning) — best for fault-tolerant, interruption-tolerant workloads like batch processing, CI runners, or stateless horizontally-scaled fleets. See [ec2.md](./ec2.md) and [cost-optimization.md](./cost-optimization.md).

**18. Cognito User Pools vs Identity Pools? (Intermediate/Advanced)**
User Pools handle authentication — a managed user directory issuing JWTs after sign-in. Identity Pools handle authorization — they exchange an identity (from a User Pool, social login, or even a guest/unauthenticated session) for temporary AWS credentials via STS, so client apps can call AWS services directly. They're frequently confused but solve different problems and are often used together. See [cognito.md](./cognito.md).

**19. What's the difference between horizontal and vertical scaling on AWS, and which does Auto Scaling do? (Beginner)**
Vertical scaling means making a single resource bigger (a larger EC2 instance type); horizontal scaling means adding more instances of the same size behind a load balancer. EC2 Auto Scaling is horizontal scaling — it adjusts the number of instances in a group based on demand, which is generally preferred for availability (no single point of failure) and has no hard ceiling the way a single instance's max size does. See [ec2-auto-scaling.md](./ec2-auto-scaling.md).

**20. How would you reduce blast radius in a multi-tenant AWS system? (Advanced)**
Use fault isolation boundaries deliberately: spread workloads across multiple Availability Zones so a single AZ failure doesn't take the whole system down, and for very large systems consider cell-based architecture (partitioning tenants/traffic into independent, fully-isolated "cells") and shuffle sharding (spreading load so that any given pair of customers rarely shares the exact same set of underlying resources), so a single bad actor or noisy tenant can't degrade the whole fleet. See [fault-isolation.md](./fault-isolation.md).

## How to Use This Folder

Work through the sections roughly in the order listed above:

1. **Compute** and **Storage** first — EC2 and S3 are the two services almost every other AWS topic assumes familiarity with.
2. **Databases** next — RDS/Aurora/DynamoDB come up in nearly every "design a backend" interview question.
3. **Networking & Content Delivery** after that — VPC concepts (subnets, routing, security groups) are foundational to understanding how every other service is actually deployed and secured.
4. **Security, IAM & Encryption** — IAM's policy evaluation model in particular is asked about constantly and is worth over-preparing.
5. **Serverless & Integration** and **Observability & Cost** can be read in either order once the above is solid — they build on the compute/networking/security fundamentals.
6. **Infrastructure as Code & Architecture Principles** last — the Well-Architected Framework in particular is easiest to appreciate once you've seen enough individual services to recognize the tradeoffs it's naming.

For interview prep specifically: skim each file's own "Interview Questions & Answers" section for a focused per-topic review, then use the "Curated" list above as a cross-cutting mock-interview pass once the individual topics feel solid.
