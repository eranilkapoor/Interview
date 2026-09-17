# Infrastructure as Code (IaC)

Infrastructure as Code is the practice of defining infrastructure — servers, networks, databases, IAM permissions, every provisioned resource — in version-controlled configuration files rather than creating it by hand through a console or ad hoc scripts. The configuration becomes the source of truth: it can be code-reviewed like application code, diffed to see exactly what a change will do before it happens, reused across environments (dev/staging/prod) by parameterizing the same definitions, and reproduced deterministically if infrastructure needs to be rebuilt from scratch. The alternative — manually clicking through a console, or running one-off imperative scripts — has no audit trail, no easy way to know what's actually deployed versus what was intended, and no reliable way to reproduce an environment exactly.

The three major tools in this space make different tradeoffs. CloudFormation is AWS-native, free (you only pay for the resources it provisions), declarative YAML/JSON, with state and rollback fully managed by AWS — you never have to think about "where does the state file live," because CloudFormation owns it internally as part of the stack. Terraform (HashiCorp, using its own declarative HCL syntax) is multi-cloud — the same tool and largely the same workflow can provision AWS, GCP, Azure, and dozens of other providers — with a much larger open-source module ecosystem, but it requires you to manage a state file yourself (commonly stored remotely in S3 with DynamoDB used for state locking to prevent concurrent conflicting applies). CDK (Cloud Development Kit) lets you write actual imperative code — TypeScript, Python, Java, C# — that synthesizes down to a CloudFormation template at deploy time, giving you real language features (loops, conditionals, functions, reusable higher-level "construct" abstractions, and your IDE's type-checking) while still inheriting CloudFormation's deployment engine, rollback, and drift detection underneath.

Idempotency is the property that makes IaC trustworthy: applying the same configuration twice should produce the same end state as applying it once, whether or not anything actually changed. All three tools are designed around this — running `terraform apply` or deploying an unchanged CloudFormation template should report "no changes," not error out or duplicate resources. This is what lets teams safely re-run deployments, use IaC in CI/CD pipelines without special-casing "did this already run," and reason about infrastructure declaratively ("this is what I want it to look like") instead of imperatively ("run these specific steps in this specific order, and don't run them twice").

State management is where these tools genuinely differ and where real operational risk lives. CloudFormation's state is implicit and AWS-managed — a stack simply *is* its own state, queryable via the API. Terraform's state is an explicit file that maps your configuration to real-world resource IDs; if that state file is lost, corrupted, or diverges from a teammate's copy (the classic reason for remote state + locking), Terraform can lose track of what it's supposed to be managing, potentially trying to recreate resources that already exist or orphaning resources it can no longer see. This is why remote state (S3 backend) with locking (DynamoDB) is close to mandatory for any team using Terraform beyond a single person on a laptop.

Drift — infrastructure changing outside the IaC tool's knowledge, typically via a manual console edit — undermines all three tools identically: the tool's model of reality diverges from actual reality, and the next apply/deploy can produce confusing errors, unexpectedly revert a manual emergency fix, or (worse) silently succeed while leaving the drifted resource in an inconsistent state relative to what the tool believes. CloudFormation has built-in drift detection; Terraform's `terraform plan` will surface drift as an unexpected diff the next time it's run, though there's no dedicated standalone drift-detection command the way CloudFormation has one. The operational discipline that prevents drift in the first place is simple but easy to skip under incident pressure: never make an infrastructure change through the console that isn't also reflected back into the IaC configuration.

## Examples

```hcl
# Terraform: an S3 bucket + IAM role, using a remote S3 backend with
# DynamoDB locking — the standard team setup to avoid state file conflicts
terraform {
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "prod/network/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}

resource "aws_s3_bucket" "app_artifacts" {
  bucket = "myapp-prod-artifacts"
}

resource "aws_iam_role" "app_role" {
  name = "myapp-prod-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}
```

```typescript
// CDK (TypeScript): the same idea as the Terraform/CloudFormation examples,
// but as real code with loops/conditionals available, synthesizing to CFN
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

export class AppStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'AppBucket', {
      bucketName: 'myapp-prod-artifacts',
      versioned: true,
    });

    const role = new iam.Role(this, 'AppRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    bucket.grantReadWrite(role);  // higher-level construct: no manual policy JSON
  }
}
```

```bash
# Terraform workflow: plan (preview, like a CloudFormation change set) before
# apply — never apply directly against production without reviewing the diff
terraform init
terraform plan -out=tfplan
# review tfplan output: what will be created / changed in place / destroyed
terraform apply tfplan
```

## Common Pitfalls / Gotchas

- Making an infrastructure change directly in the console "just this once" — the IaC tool's state (CloudFormation stack, Terraform state file) no longer matches reality, and the next apply can revert the manual fix or fail with a confusing diff.
- Storing Terraform state locally (or in a plain, unlocked S3 bucket without DynamoDB locking) on a team — concurrent applies can corrupt the state file or produce conflicting changes with no coordination.
- Committing a Terraform state file to version control — it frequently contains sensitive values (passwords, keys) in plaintext and is exactly the kind of file that should live in a properly access-controlled remote backend, not git history.
- Treating `terraform plan` / a CloudFormation change set as optional and applying directly — skipping the preview step is how a destructive resource replacement (e.g., a change that forces recreating a database) reaches production unnoticed.
- Writing one giant configuration covering every unrelated concern (networking, IAM, every microservice) instead of splitting by logical boundary — increases blast radius of any single apply and makes plans/diffs much harder to actually review.
- Assuming idempotency means "safe to run concurrently" — idempotent means repeated *sequential* applies converge to the same state, not that two applies running at the same time against the same state won't conflict; locking (state locking, or CloudFormation's own concurrency handling) is still required.

## Interview Questions & Answers

**Q: What does idempotency mean in the context of IaC, and why does it matter?**
A: Applying the same configuration multiple times produces the same end result as applying it once — if nothing changed, the tool reports no changes rather than erroring or duplicating resources. It matters because it's what makes IaC safe to run repeatedly and to embed in CI/CD pipelines without special-casing "has this already been applied," and it's what lets you reason about infrastructure declaratively (describe the desired end state) instead of imperatively (script the exact steps).

**Q: CloudFormation vs Terraform vs CDK — what tradeoffs would you weigh when choosing?**
A: CloudFormation is AWS-native, free, and manages state internally with built-in rollback and drift detection, but only works with AWS. Terraform is multi-cloud with a large module ecosystem, but you own managing (and securing/locking) an explicit state file, typically in an S3 backend with DynamoDB locking. CDK gives you a real programming language with loops, conditionals, and reusable higher-level constructs, synthesizing down to CloudFormation, so you get CloudFormation's deployment guarantees with far better ergonomics for complex, parameterized infrastructure — at the cost of an extra build/synth step and needing to understand what it generates underneath when debugging.

**Q: What is state, in Terraform specifically, and what goes wrong if it's mismanaged?**
A: State is Terraform's explicit record mapping your configuration's resources to real-world resource IDs. If it's lost, corrupted, or diverges between teammates (e.g., stored locally instead of in a shared remote backend), Terraform loses track of what it's actually managing — it might try to recreate resources that already exist, or lose visibility into resources it previously created, orphaning them. This is why remote state (commonly S3) with locking (commonly DynamoDB) is standard practice for any team beyond a single developer.

**Q: What is drift and how does it undermine IaC regardless of which tool you use?**
A: Drift is infrastructure changing outside the IaC tool's awareness, usually via a manual console edit. Because every IaC tool's plan/update logic assumes its own record of state accurately reflects reality, drift causes that assumption to break — the next apply can produce a confusing diff, unexpectedly revert a manual emergency fix nobody reflected back into the configuration, or in the worst case succeed while leaving things inconsistent. The fix is process, not tooling: treat the IaC configuration as the only legitimate way to change managed infrastructure, and use drift detection (CloudFormation) or plan review (Terraform) regularly rather than only after an incident.

**Q: Why is committing a Terraform state file to git considered a serious mistake?**
A: State files commonly contain resource attributes in plaintext, including sensitive values like database passwords or generated secrets, since Terraform needs to track the full resulting configuration of everything it manages. Committing it to version control exposes those secrets in git history (which is very hard to fully purge) to anyone with repo access, and bypasses the locking and access control a proper remote backend (like S3 with IAM-restricted access and DynamoDB locking) is specifically designed to provide.

## Related Topics
- [cloudformation.md](./cloudformation.md)
- [well-architected-framework.md](./well-architected-framework.md)
- [iam.md](./iam.md)
- [cost-optimization.md](./cost-optimization.md)
