# AWS IAM (Identity and Access Management)

IAM is the service that controls *who* can do *what* to *which* resources in an AWS account. It is global (not region-scoped) and free to use, and it underlies every other AWS service — every API call is authenticated and authorized through IAM before the requesting service ever executes it. IAM has four core identity types: **Users** (long-term credentials representing a human or a static application identity — a username/password for console access and/or an access key pair for programmatic access), **Groups** (a collection of users that policies are attached to collectively, so you manage permissions at the group level instead of per-user), **Roles** (an identity with no long-term credentials of its own — instead, a trusted principal such as an EC2 instance, a Lambda function, a federated SSO user, or another AWS account *assumes* the role via the STS `AssumeRole` API and receives short-lived, automatically-rotated temporary credentials), and **Policies** (JSON documents that define permissions).

The recommended pattern for granting AWS resources (EC2 instances, Lambda functions, ECS tasks) access to other AWS services is always a Role, never an IAM User's static access keys embedded in code or an EC2 instance's environment variables. A role attached to an EC2 instance profile or a Lambda execution role hands out credentials that expire automatically (typically within an hour) and are rotated transparently by the AWS SDK — there's no secret to leak, rotate, or accidentally commit to source control.

Policies come in two flavors that are easy to conflate. **Identity-based policies** are attached to a user, group, or role and describe what that identity is allowed to do. **Resource-based policies** are attached directly to a resource — an S3 bucket policy, an SQS queue policy, a KMS key policy, a Lambda resource policy — and describe who is allowed to access that resource, including principals in *other* AWS accounts. Resource-based policies are the only way to grant cross-account access without the other account having to assume a role in yours (though role assumption is often still preferred for auditability).

Authorization evaluation follows a specific algorithm that is a favorite interview topic: by default, every request is **implicitly denied**. AWS then evaluates all applicable policies — identity-based, resource-based, permissions boundaries, SCPs, session policies — and looks for an explicit **Deny** anywhere in that set; if found, the request is denied, full stop, no exceptions. If there's no explicit Deny, AWS looks for at least one explicit **Allow** (from either the identity-based policy or a resource-based policy); if one exists, the request is allowed. If neither an explicit Allow nor Deny is found, the implicit deny stands. Two additional guardrails narrow what's *possible* without granting anything themselves: a **Permissions Boundary** is a managed policy attached to a user or role that caps the maximum permissions that identity can ever have, regardless of how generous its identity-based policies are; a **Service Control Policy (SCP)**, set at the AWS Organizations level on an account or OU, caps the maximum permissions for every principal in that account, including its root user. Neither boundaries nor SCPs grant access on their own — they only restrict the ceiling.

## Examples

```bash
# Create a role that only an EC2 instance can assume, then attach a policy to it.
aws iam create-role \
  --role-name app-server-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": { "Service": "ec2.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy \
  --role-name app-server-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess
```
This is the standard pattern for giving an EC2 instance access to AWS APIs: create a role with a trust policy that only allows `ec2.amazonaws.com` to assume it, attach permission policies to the role, then attach the role to the instance via an instance profile — no access keys ever touch the box.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowReadWriteOwnPrefix",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::app-uploads/${aws:userid}/*"
    },
    {
      "Sid": "DenyOutsideVPC",
      "Effect": "Deny",
      "Action": "s3:*",
      "Resource": "arn:aws:s3:::app-uploads/*",
      "Condition": {
        "StringNotEquals": { "aws:SourceVpc": "vpc-0abc123456789" }
      }
    }
  ]
}
```
A least-privilege identity policy scoped with a policy variable (`${aws:userid}`) so each caller can only touch their own prefix, combined with an explicit `Deny` condition that blocks access from outside a specific VPC — demonstrating that the explicit Deny wins regardless of what the Allow statement grants.

```bash
# Assume a cross-account role to get temporary credentials.
aws sts assume-role \
  --role-arn arn:aws:iam::222233334444:role/CrossAccountAuditRole \
  --role-session-name audit-session \
  --external-id "shared-secret-123"
```
Cross-account access via role assumption: account `222233334444` trusts the caller's account in its role's trust policy, and the caller receives temporary `AccessKeyId`/`SecretAccessKey`/`SessionToken` credentials scoped to whatever the role's permission policies allow. The `ExternalId` mitigates the "confused deputy" problem when a third party is involved.

## Common Pitfalls / Gotchas

- Attaching policies directly to individual IAM users instead of to groups (or better, using roles) — this doesn't scale and makes periodic access review painful; AWS itself recommends users never hold standalone policies.
- Forgetting that an explicit `Deny` in *any* applicable policy — identity, resource, boundary, or SCP — overrides every `Allow`, including `AdministratorAccess`. A support engineer's first debugging step for an unexpected `AccessDenied` should be searching for a stray Deny, not just checking if an Allow exists.
- Confusing a Permissions Boundary or SCP with something that *grants* access — they only set a ceiling. A role with `AdministratorAccess` but a boundary that only allows S3 actions can still only touch S3.
- Long-lived IAM user access keys checked into source control or left unrotated for years — this is one of the most common real-world breach vectors; prefer roles for workloads and mandate MFA + short rotation for the human users who must have keys.
- Using wildcard resources (`"Resource": "*"`) or wildcard actions (`"Action": "*"`) "temporarily" during development and never tightening them before shipping to production.
- Forgetting that IAM policy changes are eventually consistent — a newly attached policy or role trust relationship can take up to several seconds (occasionally longer) to propagate globally, which can cause confusing transient `AccessDenied` errors right after a change.

## Interview Questions & Answers

**Q: Walk me through exactly how AWS decides whether to allow or deny a request.**
A: Every request starts implicitly denied. AWS collects every policy that applies — identity-based policies on the calling principal, resource-based policies on the target resource, permissions boundaries, SCPs, and any session policies — and checks for an explicit `Deny` anywhere in that set. If one exists, the request is denied immediately, regardless of any Allow. If no Deny is found, AWS checks whether there is at least one explicit `Allow` from either an identity-based or resource-based policy. If so, the request is allowed; if not, the implicit deny stands and the request fails.

**Q: Why would you use a Role instead of an IAM User with access keys for an application running on EC2?**
A: A role provides temporary, automatically-rotated credentials obtained via STS, delivered to the instance through the instance metadata service — there's no long-lived secret to store, leak, or manually rotate. If the instance is compromised, the exposed credentials expire within the hour rather than remaining valid indefinitely like a static access key would.

**Q: What's the difference between an identity-based policy and a resource-based policy, and when do you need the latter?**
A: An identity-based policy is attached to a user, group, or role and defines what that principal can do. A resource-based policy is attached to the resource itself (S3 bucket policy, SQS queue policy, KMS key policy) and defines who can access it, including principals from other AWS accounts. You need a resource-based policy specifically for cross-account access, since an identity policy in Account A cannot by itself grant access to a resource in Account B — either the resource policy in B must allow A's principal, or a role in B must be assumed.

**Q: What's the difference between a Permissions Boundary and a Service Control Policy?**
A: Both are guardrails that set a maximum permission ceiling rather than granting anything themselves. A Permissions Boundary is attached to a specific IAM user or role and limits what that one identity can ever do, even if its own policies are broader. An SCP is set at the AWS Organizations level on an account or organizational unit and limits every principal in that account, including the root user — it's an org-wide governance control, whereas a boundary is a per-identity control typically used to let a team create their own roles without those roles escalating beyond a defined limit.

**Q: How does IAM Access Analyzer help with security review?**
A: It analyzes resource-based policies (S3 buckets, IAM roles, KMS keys, Lambda functions, SQS queues, etc.) using automated reasoning to identify resources that are accessible from outside your account or AWS Organization — i.e., unintended external access — and surfaces each as a finding you can review and remediate, rather than requiring someone to manually audit every policy for overly broad principals.

## Related Topics
- [key-management-service.md](./key-management-service.md)
- [cognito.md](./cognito.md)
- [data-encryption.md](./data-encryption.md)
- [network-security.md](./network-security.md)
- [well-architected-framework.md](./well-architected-framework.md)
- [s3.md](./s3.md)
