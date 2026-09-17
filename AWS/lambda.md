# AWS Lambda

AWS Lambda is a serverless compute service that runs your code in response to events without you provisioning or managing any server — you upload a function, define what triggers it (an HTTP request via API Gateway, a new S3 object, a message on an SQS queue, a DynamoDB Stream record, a scheduled CloudWatch Event/EventBridge rule), and AWS handles allocating an execution environment, running your code, and tearing it down. You're billed per invocation and per GB-second of memory/duration used, rounded to the millisecond, rather than paying for idle server time.

Execution environments are ephemeral containers that AWS creates on demand. When no warm environment is available, a "cold start" occurs — AWS has to initialize a new environment, load your deployment package/runtime, and run any code outside your handler (module-level imports, SDK client construction) before your handler executes; this adds latency, most noticeably for large deployment packages, JVM-based runtimes, or (historically) functions attached to a VPC. VPC cold starts used to be a serious tax because Lambda had to attach an ENI per environment, but AWS's Hyperplane networking model now pre-provisions and shares ENIs across environments, largely closing that gap. For latency-sensitive synchronous paths (like an API Gateway-fronted endpoint), Provisioned Concurrency keeps a specified number of execution environments pre-initialized and warm at all times, at an additional hourly cost independent of invocations.

Memory is configurable from 128 MB to 10,240 MB in 1 MB increments, and — critically — CPU allocation scales proportionally with memory, so a CPU-bound function that's slow can often be fixed by turning memory up rather than optimizing code, since you get more vCPU alongside more RAM (at roughly 1,769 MB you get the equivalent of one full vCPU). Maximum execution timeout is 15 minutes; anything longer needs Step Functions orchestration, Fargate, or a different compute model entirely. `/tmp` gives ephemeral local disk, configurable from 512 MB to 10,240 MB, useful for scratch space during an invocation but not for state that must survive across invocations (a new environment gets a fresh empty `/tmp`).

Concurrency is governed at multiple levels: the account has a default regional concurrent-execution limit (commonly 1,000, a soft limit you can request increases for), shared across all functions unless carved up. Reserved concurrency both guarantees a slice of that pool for a specific function and caps it from exceeding that slice — useful for protecting critical functions from being starved by noisy neighbors, or for throttling a function that would otherwise overwhelm a downstream dependency like a relational database. Functions without reserved concurrency draw from the shared "unreserved" pool. Event source mappings (Lambda's polling mechanism for SQS, DynamoDB Streams, and Kinesis) add another dimension — batch size, batching window, and parallelization factor all affect throughput and error-handling semantics (a batch failure can retry the whole batch unless you enable partial batch response).

Two IAM concepts are often confused: the execution role is the IAM role the function itself assumes at runtime, governing what AWS resources the function's code is allowed to call (e.g., permission to read from a specific S3 bucket). The resource-based policy (function policy) governs the reverse — who/what is allowed to invoke the function (e.g., granting `apigateway.amazonaws.com` permission to invoke it, or granting a specific AWS account cross-account invoke access). Lambda Layers let you package shared code, dependencies, or binaries separately from your function code and attach them to multiple functions, keeping deployment packages smaller and dependency management centralized — with the tradeoff that a Layer update requires redeploying every function using it to actually pick up the change (layers are pinned by version ARN, not auto-updated).

Lambda fits workloads that are short-lived, event-driven, and bursty/unpredictable in traffic, where you don't want to own server lifecycle at all — compare against EC2 (full control, best for steady sustained load where Reserved Instance pricing wins), Elastic Beanstalk (if you want a managed PaaS but still want visibility into the underlying EC2/ASG stack), and ECS/Fargate (containers, when the workload needs to run longer than 15 minutes or needs a runtime/dependency footprint Lambda's packaging model doesn't fit well).

## Examples

```javascript
// Node.js Lambda handler using AWS SDK v3 — reads an S3 object referenced in the
// triggering event and writes a derived record to DynamoDB. Client is constructed
// outside the handler so it's reused across warm invocations, avoiding re-init cost.
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const s3 = new S3Client({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event) => {
  const record = event.Records[0].s3;
  const obj = await s3.send(new GetObjectCommand({
    Bucket: record.bucket.name,
    Key: record.object.key,
  }));
  const body = await obj.Body.transformToString();

  await ddb.send(new PutCommand({
    TableName: "ProcessedUploads",
    Item: { key: record.object.key, size: obj.ContentLength, processedAt: Date.now() },
  }));

  return { statusCode: 200 };
};
```

```bash
# Invoke a function synchronously and inspect the response, then check its current
# reserved concurrency — useful when diagnosing throttling (429 TooManyRequestsException)
aws lambda invoke --function-name process-upload --payload '{"key":"test.json"}' out.json
aws lambda get-function-concurrency --function-name process-upload
```

```json
// Resource-based policy statement granting API Gateway permission to invoke the
// function — distinct from the function's own execution role, which governs what
// the function is allowed to call, not who can call it
{
  "Sid": "AllowAPIGatewayInvoke",
  "Effect": "Allow",
  "Principal": { "Service": "apigateway.amazonaws.com" },
  "Action": "lambda:InvokeFunction",
  "Resource": "arn:aws:lambda:us-east-1:111122223333:function:process-upload",
  "Condition": {
    "ArnLike": { "AWS:SourceArn": "arn:aws:execute-api:us-east-1:111122223333:abc123/*/POST/uploads" }
  }
}
```

## Common Pitfalls / Gotchas

- Constructing SDK clients or doing heavy initialization inside the handler instead of at module scope — this reruns that cost on every single invocation instead of once per warm environment, inflating both latency and cost.
- Hitting the account-level concurrency ceiling because one function without reserved concurrency scales unbounded and starves every other function in the account — set reserved concurrency on critical or database-backed functions to both guarantee and cap their share.
- Assuming `/tmp` or any local state persists between invocations — each cold environment starts with an empty `/tmp`, and even warm environments can be recycled by AWS at any time without notice.
- Underestimating deployment package limits: 50 MB zipped for direct console/CLI upload, 250 MB unzipped including all layers, or up to 10 GB via container images in ECR — large dependency trees (e.g., full ML libraries) often force a move to container-image packaging.
- A Lambda function backed by an SQS/DynamoDB Streams event source mapping that fails partway through a batch will, by default, retry the entire batch — without enabling `ReportBatchItemFailures` (partial batch response), a single poison-pill record can block the whole batch from making progress.
- Forgetting that provisioned concurrency is billed hourly regardless of invocation volume — it eliminates cold starts but isn't "free," and over-provisioning it for low-traffic functions can quietly become one of the largest line items in a serverless bill.

## Interview Questions & Answers

**Q: What causes a Lambda cold start, and how do you mitigate it?**
A: A cold start happens when no warm execution environment exists for an invocation, forcing AWS to provision a new one, load the runtime and deployment package, and execute any module-level initialization code before the handler runs. Mitigations include keeping deployment packages small, moving expensive setup (SDK clients, DB connections) to module scope so it's reused across warm invocations, choosing a faster-starting runtime, and — for latency-critical paths — enabling Provisioned Concurrency to keep a pool of environments pre-warmed at all times.

**Q: What's the difference between a Lambda function's execution role and its resource-based (function) policy?**
A: The execution role is the IAM role the function assumes when it runs — it controls what AWS APIs and resources the function's code is permitted to call, like reading from a specific S3 bucket or writing to a DynamoDB table. The resource-based policy is attached to the function itself and controls the opposite direction: who or what is allowed to invoke the function, such as granting API Gateway or an EventBridge rule permission to trigger it, or allowing cross-account invocation.

**Q: How does reserved concurrency differ from provisioned concurrency?**
A: Reserved concurrency sets both a floor and a ceiling on how many concurrent execution environments a specific function can use out of the account's shared pool — it guarantees that capacity for the function while also preventing it from exceeding that number, which is useful for both protecting critical functions from noisy neighbors and throttling functions that would overwhelm a downstream dependency. Provisioned concurrency is a different mechanism entirely — it pre-initializes a specified number of warm execution environments so invocations skip the cold-start path, at a continuous hourly cost regardless of whether those environments are actually invoked.

**Q: Why might increasing a Lambda function's memory setting make it run faster, even if it isn't memory-bound?**
A: Lambda allocates CPU proportionally to the configured memory — vCPU share scales up alongside memory, reaching the equivalent of one full vCPU around 1,769 MB. A function that's actually CPU-bound (heavy JSON parsing, image processing, compression) can see substantial wall-clock speedups from a higher memory setting even though it never approaches that memory ceiling, sometimes lowering total cost too since GB-seconds go down even as the per-second memory rate goes up.

**Q: What are the deployment package size limits, and what do you do when you exceed them?**
A: Direct upload via the console or CLI zip is capped at 50 MB; the unzipped package including all attached Layers is capped at 250 MB. When dependencies exceed that — common with large ML/data libraries — the options are trimming the dependency tree, splitting shared code into Layers (which are counted toward the same 250 MB unzipped limit, so this doesn't always help), or switching to container image packaging via ECR, which supports images up to 10 GB and lets you use a full custom base image.

## Related Topics
- [api-gateway.md](./api-gateway.md)
- [sqs.md](./sqs.md)
- [sns.md](./sns.md)
- [ec2.md](./ec2.md)
- [elastic-beanstalk.md](./elastic-beanstalk.md)
- [iam.md](./iam.md)
