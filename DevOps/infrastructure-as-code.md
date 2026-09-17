# Infrastructure as Code

Infrastructure as Code (IaC) is the practice of defining cloud and on-prem infrastructure — VMs, networks, load balancers, databases, IAM roles — in machine-readable configuration files instead of clicking through a cloud console. Those files are checked into version control just like application code, which means infrastructure changes get code review, a commit history explaining why something changed, and the ability to recreate an entire environment reliably from scratch — something console-driven ("ClickOps") infrastructure can't offer, because there's no artifact describing what was actually clicked. Terraform (multi-cloud, HCL syntax), AWS CloudFormation (AWS-native, YAML/JSON), and Pulumi (uses general-purpose languages like TypeScript or Python instead of a custom DSL) are the common tools, but they all share the same underlying model.

The key conceptual split is **declarative versus imperative**. A declarative tool (Terraform, CloudFormation) has you describe the *desired end state* — "there should be an S3 bucket named X with versioning enabled" — and the tool computes and executes whatever create/update/delete operations are needed to get the real infrastructure to match that description; you don't tell it the steps, just the destination. An imperative approach (a bash script calling the AWS CLI step by step) has you specify the exact sequence of actions to take, which means the script's correctness depends on assumptions about the current state that can silently go stale — re-running it against infrastructure that's already partially provisioned can fail or duplicate resources. Declarative IaC tools sidestep that by diffing desired state against actual state on every run and only acting on the difference, which is the same idempotency idea configuration management tools use, just applied to cloud resources instead of OS/application configuration.

**State management** is the part of IaC that trips people up most in practice, and it's a favorite interview topic because it reveals whether someone has operated these tools for real. Terraform, in particular, keeps a state file that maps every resource block in your configuration to the real-world resource it created (a specific VM ID, a specific bucket ARN) — without that mapping, Terraform has no way to know what it's already responsible for versus what it needs to create fresh, or to compute an accurate diff on the next `plan`. That state file has to be stored somewhere shared and lockable (an S3 bucket with DynamoDB locking, Terraform Cloud) when more than one person or pipeline might run Terraform concurrently — two people applying against their own local, un-locked state files independently is a fast way to create duplicate, conflicting, or orphaned resources. Drift (someone manually changing a resource that Terraform manages, outside of Terraform) is the other classic failure mode: the state file says one thing, the real resource says another, and the next `plan` either shows a confusing diff or — worse — silently reverts the manual change on the next `apply`.

## Examples

```hcl
# main.tf — declarative desired state for an S3 bucket, Terraform/HCL
resource "aws_s3_bucket" "app_data" {
  bucket = "my-app-data-prod"
}

resource "aws_s3_bucket_versioning" "app_data" {
  bucket = aws_s3_bucket.app_data.id
  versioning_configuration {
    status = "Enabled"
  }
}
```

```bash
# The Terraform workflow: plan shows the diff before anything changes
terraform init      # download providers, configure remote state backend
terraform plan       # compute diff: desired (.tf files) vs actual (state)
terraform apply       # execute only the create/update/delete needed to converge
terraform destroy      # tear down everything this configuration manages
```

```hcl
# Remote state with locking — required once more than one person/pipeline
# runs Terraform against the same infrastructure
terraform {
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "prod/network.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"   # prevents two concurrent applies
  }
}
```

## Common Pitfalls / Gotchas

- Storing Terraform state locally (or committing it to Git) instead of in a shared, locked remote backend — this breaks team collaboration and risks two people applying conflicting changes simultaneously.
- Manually editing a resource that IaC manages ("just this once, through the console") — this causes drift, and the next `apply` can silently revert the manual change or produce a confusing, unexpected diff.
- Running `apply` without reading the `plan` output first — the plan is the safety check; skipping it means finding out about a destructive change (like a resource replacement that deletes and recreates a database) only after it happens.
- Hardcoding secrets (database passwords, API keys) directly into `.tf` files — these end up both in version control and in the state file in plaintext; use a secrets manager reference instead.
- Treating IaC as "write once" instead of something that's reviewed and iterated on like application code — infrastructure changes deserve the same PR review rigor as a code change, especially for anything that can delete or replace a resource.

## Interview Questions & Answers

**Q: What's the difference between declarative and imperative infrastructure automation?**
A: Declarative (Terraform, CloudFormation) has you describe the desired end state, and the tool computes the diff against actual state and executes only what's needed to converge — idempotent by design. Imperative (a script of CLI calls) specifies the exact sequence of steps to take, and re-running it against infrastructure that's already partially in that state can fail, error, or duplicate resources, because the script doesn't inherently know what already exists.

**Q: What is Terraform state, and why does it matter?**
A: It's a file that maps each resource in your configuration to the real-world resource it created, which is how Terraform knows what it manages and computes an accurate diff on the next plan. It matters because without a shared, lockable remote state (like S3 + DynamoDB locking), concurrent runs from different people or pipelines can create duplicate or conflicting resources, and losing the state file entirely means Terraform loses track of what it's responsible for.

**Q: What causes infrastructure "drift," and how do you deal with it?**
A: Drift happens when the real infrastructure changes outside of the IaC tool — usually a manual console edit or a change made by another automated process. You detect it by running `plan` regularly and treating any unexpected diff as a signal to investigate, and you deal with it either by importing the manual change back into the IaC definition (if it should be kept) or by re-applying to revert it (if it shouldn't) — and by restricting console/manual write access to IaC-managed resources going forward to prevent recurrence.

**Q: Why would you review a Terraform plan carefully before applying, beyond just checking for errors?**
A: Because some changes require a resource replacement (destroy + recreate) rather than an in-place update — for example, changing certain immutable attributes on a database. The plan output shows exactly which resources are being created, updated, or destroyed, and catching an unexpected destroy/recreate before applying is often the only thing standing between a routine change and a production outage.

**Q: How does infrastructure as code fit into a CI/CD pipeline?**
A: `terraform plan` typically runs automatically on a pull request so reviewers can see the exact infrastructure diff alongside the code diff, and `terraform apply` runs on merge to main (often with a manual approval gate for production), the same fast-fail, review-then-promote pattern used for application deployments — treating infrastructure changes with the same rigor as code changes rather than as a separate, less-reviewed process.

## Related Topics

- [configuration-management.md](./configuration-management.md)
- [ci-cd.md](./ci-cd.md)
- [secrets-management.md](./secrets-management.md)
- [scalability-and-reliability.md](./scalability-and-reliability.md)
