# AWS CloudFormation

CloudFormation is AWS's native infrastructure-as-code service: you describe the AWS resources you want (EC2 instances, VPCs, IAM roles, S3 buckets, and hundreds of other resource types) in a declarative JSON or YAML template, and CloudFormation figures out the create/update/delete API calls needed to make reality match that template. Instead of clicking through the console or writing imperative scripts that call the AWS SDK step by step, you commit a template to version control and let CloudFormation own the entire provisioning lifecycle, including dependency ordering, rollback on failure, and tracking what it created so it can clean up later.

A deployed template becomes a stack — a single unit that CloudFormation manages as a whole. Update the template and redeploy, and CloudFormation computes a diff against the stack's current state; you can preview that diff as a change set before executing it, seeing exactly which resources will be created, modified in place, or replaced (some property changes, like an RDS instance's engine, force a full replacement — a destructive operation worth catching before it happens). If a stack update fails partway through, CloudFormation automatically rolls back every resource in that update to its last known-good state, so you never end up with half of a template applied — this automatic all-or-nothing behavior is one of CloudFormation's biggest advantages over ad hoc scripting.

Templates use intrinsic functions to wire resources together without hardcoding values that aren't known until deploy time: `Ref` returns a resource's primary identifier (or a parameter's value), `Fn::GetAtt` (shorthand `!GetAtt`) pulls a specific attribute off a resource (like an ALB's DNS name), and `Fn::Sub` performs string interpolation, commonly used to build ARNs or names that embed a `Ref`. Parameters make templates reusable across environments (dev/staging/prod) by accepting input at deploy time, Outputs expose values (like a created VPC ID) for other stacks or for operators to consume, and nested stacks let you decompose a large template into smaller, independently-manageable stacks referenced from a parent — useful for splitting networking, IAM, and application layers so a change to one doesn't require re-evaluating the whole template.

Drift detection addresses the problem of resources changing outside CloudFormation's knowledge — someone manually tweaks a security group rule in the console, and now the stack's template no longer matches deployed reality. Running drift detection compares live resource configuration against the template and reports which resources and properties have diverged, which is important because CloudFormation's own update/rollback logic assumes it has full control; undetected drift can cause confusing update failures or, worse, an update silently reverting a manual emergency fix.

CloudFormation's main competitors are Terraform (multi-cloud, HCL syntax, requires you to manage state yourself, larger community module ecosystem) and AWS CDK (write actual TypeScript/Python/Java code that synthesizes down to a CloudFormation template, giving you loops, conditionals, and abstraction while still getting CloudFormation's deployment engine, rollback, and drift detection underneath). CloudFormation itself is free (you pay only for the resources it creates), AWS-native with day-one support for new AWS features, and doesn't require you to host or secure a separate state file the way Terraform does — its state lives entirely in the AWS-managed stack.

## Examples

```yaml
# A parameterized template: an S3 bucket + IAM role, using Ref, Fn::Sub, and Outputs
Parameters:
  EnvironmentName:
    Type: String
    AllowedValues: [dev, staging, prod]

Resources:
  AppBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub "myapp-${EnvironmentName}-artifacts"
      VersioningConfiguration:
        Status: Enabled

  AppRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub "myapp-${EnvironmentName}-role"
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Principal: { Service: lambda.amazonaws.com }
            Action: sts:AssumeRole
      Policies:
        - PolicyName: ReadWriteBucket
          PolicyDocument:
            Version: "2012-10-17"
            Statement:
              - Effect: Allow
                Action: [s3:GetObject, s3:PutObject]
                Resource: !Sub "${AppBucket.Arn}/*"  # GetAtt via shorthand + Sub

Outputs:
  BucketName:
    Value: !Ref AppBucket
  RoleArn:
    Value: !GetAtt AppRole.Arn
```

```bash
# Create a change set to preview an update before applying it — never skip this
# step on a production stack, since some changes force resource replacement
aws cloudformation create-change-set \
  --stack-name myapp-prod \
  --change-set-name add-versioning \
  --template-body file://template.yaml \
  --parameters ParameterKey=EnvironmentName,ParameterValue=prod

aws cloudformation describe-change-set \
  --stack-name myapp-prod --change-set-name add-versioning
# Review "Replacement": "True" entries carefully before executing

aws cloudformation execute-change-set \
  --stack-name myapp-prod --change-set-name add-versioning
```

```bash
# Detect drift — flags resources changed outside CloudFormation (e.g. a manual
# console edit to a security group) so you can reconcile before the next update
aws cloudformation detect-stack-drift --stack-name myapp-prod
# returns a StackDriftDetectionId to poll:
aws cloudformation describe-stack-drift-detection-status \
  --stack-drift-detection-id abc-123
aws cloudformation describe-stack-resource-drifts \
  --stack-name myapp-prod --stack-resource-drift-status-filters MODIFIED DELETED
```

## Common Pitfalls / Gotchas

- Editing a stack's resources manually in the console "just this once" — this causes drift, and the next CloudFormation update may silently revert the manual fix or fail unexpectedly because reality no longer matches the template's assumptions.
- Not previewing a change set before executing it — some property changes (e.g., changing an RDS `Engine` or renaming certain resources) force replacement, which for a database means data loss unless you've planned a migration path.
- Hardcoding account-specific or region-specific values (account IDs, AMI IDs, AZ names) instead of using Parameters, Mappings, or `AWS::Region`/`AWS::AccountId` pseudo-parameters — breaks portability across environments and accounts.
- Deleting a stack without realizing `DeletionPolicy` defaults to deleting the resource — for anything stateful (RDS, S3 buckets with data), set `DeletionPolicy: Retain` or `Snapshot` explicitly so a stack deletion doesn't destroy data.
- Letting templates grow into a single monolithic file covering unrelated concerns (networking, IAM, app resources all together) — nested stacks or separate stacks with cross-stack references keep the blast radius of any one update smaller.
- Assuming rollback is free — a failed update rolling back can itself fail (e.g., if the original resource was deleted out from under it), leaving a stack in `UPDATE_ROLLBACK_FAILED`, which requires manual intervention (`continue-update-rollback` skipping the broken resource) to recover.

## Interview Questions & Answers

**Q: What happens if a CloudFormation stack update fails partway through?**
A: CloudFormation automatically rolls back every resource change made during that update, returning the whole stack to its last successful state — it's all-or-nothing, not partial. If the rollback itself fails (for example, a resource CloudFormation expects to revert to was deleted out-of-band), the stack lands in `UPDATE_ROLLBACK_FAILED` and needs manual remediation, often via `continue-update-rollback` with a list of resources to skip.

**Q: What's the difference between `Ref` and `Fn::GetAtt`?**
A: `Ref` returns a resource's "primary" identifier as defined by that resource type (e.g., an S3 bucket's name, an EC2 instance's instance ID) or a parameter's supplied value. `Fn::GetAtt` retrieves a specific named attribute of a resource that isn't necessarily its primary identifier — for example, an S3 bucket's ARN (`!GetAtt MyBucket.Arn`) or an ALB's DNS name — which attributes are available depends on the resource type.

**Q: What is a change set and why would you always use one for production changes?**
A: A change set is a preview of exactly what a template update would do to a stack — which resources get created, modified in place, or replaced — without actually applying it. It's essential for production because some property changes force full resource replacement (destructive for stateful resources like databases), and a change set is how you catch that before it happens instead of after.

**Q: What is stack drift and why does it matter?**
A: Drift is when a resource's live configuration no longer matches what the stack's template says it should be, typically because someone changed it outside CloudFormation (console, CLI, another tool). It matters because CloudFormation's change/update logic assumes it has full knowledge of resource state; undetected drift can cause confusing update failures, or an update can silently overwrite a manual emergency fix that was never reflected back into the template.

**Q: How does CloudFormation compare to Terraform and CDK?**
A: CloudFormation is AWS-native, free, and manages its own state internally with built-in rollback and drift detection, but it only works with AWS. Terraform is multi-cloud with a large module ecosystem, but you're responsible for managing (and securing/locking) its state file yourself, commonly in S3 with DynamoDB for locking. CDK lets you write actual imperative code (TypeScript, Python, etc.) with loops, conditionals, and reusable constructs, which synthesizes down to a CloudFormation template — so you get real programming-language ergonomics while still inheriting CloudFormation's deployment engine and guarantees underneath.

## Related Topics
- [infrastructure-as-code.md](./infrastructure-as-code.md)
- [well-architected-framework.md](./well-architected-framework.md)
- [iam.md](./iam.md)
- [ec2.md](./ec2.md)
- [cost-optimization.md](./cost-optimization.md)
