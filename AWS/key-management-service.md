# AWS KMS (Key Management Service)

KMS is a managed service for creating and controlling cryptographic keys used across AWS — it is the backing mechanism behind SSE-KMS on S3, EBS encryption, RDS encryption, Secrets Manager, and countless other services' "encrypt at rest" options, and it can also be called directly by application code. The central object is the **KMS key** (formerly called a Customer Master Key/CMK) — a logical key resource, never exported in plaintext, used to encrypt/decrypt data or, more commonly at scale, to encrypt/decrypt the small data keys used in envelope encryption. KMS keys come in three ownership tiers: **AWS owned keys** (used internally by a service, not visible or billed to you, no control at all), **AWS managed keys** (visible in your account as `aws/s3`, `aws/ebs`, etc., created automatically the first time a service needs one, free, automatically rotated every year, but you cannot edit their key policy or control rotation), and **Customer managed keys** (you create them explicitly, fully control the key policy, can enable/disable automatic annual rotation, can schedule deletion with a mandatory 7–30 day waiting window, and pay a small monthly fee plus per-API-call charges).

Access control for a KMS key is primarily governed by its **key policy** — a resource-based policy attached directly to the key, which is mandatory (every key must have one) and is evaluated *in addition to* any IAM identity policies the caller has. This is a common point of confusion: having `kms:Decrypt` in your IAM policy is not sufficient if the key's own policy doesn't also permit you (directly, or via a statement that defers to IAM policies with something like `"Principal": {"AWS": "arn:aws:iam::ACCOUNT:root"}`). For narrower, temporary, programmatic delegation without editing the key policy itself, KMS supports **grants** — short-lived, revocable permissions typically created by an application to let a specific downstream principal perform specific operations (e.g., letting an EC2 instance's role decrypt objects on behalf of a request) without a policy-editing round trip.

For symmetric customer-managed keys, KMS supports **automatic annual key rotation** — when enabled, KMS generates new backing key material every year while keeping the *same* key ID and ARN, transparently retaining all previous versions of the key material internally so data encrypted under an older rotation is still decryptable without any application-visible change. This is distinct from manually rotating a key, which creates a genuinely new key resource and requires you to re-encrypt data or update key aliases yourself. For disaster recovery or low-latency multi-region encryption without re-encrypting data across regions, KMS offers **Multi-Region keys** — a primary key and one or more replica keys that share the same key material and key ID, letting an application encrypt in one region and decrypt in another. For workloads that require dedicated, single-tenant hardware and full control over key material (e.g., strict compliance regimes needing FIPS 140-2 Level 3 validated hardware, versus KMS's Level 2/3 mixed validation), **AWS CloudHSM** is the alternative — it gives you a dedicated HSM cluster you fully manage, at significantly more operational overhead than KMS.

## Examples

```bash
# Create a customer-managed symmetric key with automatic annual rotation enabled.
aws kms create-key \
  --description "App-tier data encryption key" \
  --key-usage ENCRYPT_DECRYPT \
  --key-spec SYMMETRIC_DEFAULT

aws kms enable-key-rotation --key-id 1234abcd-12ab-34cd-56ef-1234567890ab

aws kms create-alias \
  --alias-name alias/app-data-key \
  --target-key-id 1234abcd-12ab-34cd-56ef-1234567890ab
```
Creating a dedicated customer-managed key (rather than relying on an AWS-managed key) gives full control over the key policy and rotation, and the alias lets application code and CloudFormation templates reference a stable name instead of a raw key ID/ARN that changes if the key is ever recreated.

```json
{
  "Version": "2012-10-17",
  "Id": "app-data-key-policy",
  "Statement": [
    {
      "Sid": "EnableRootAccountIAMPolicies",
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::123456789012:root" },
      "Action": "kms:*",
      "Resource": "*"
    },
    {
      "Sid": "AllowLambdaExecutionRoleToUseKey",
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::123456789012:role/order-processor-lambda-role" },
      "Action": ["kms:Decrypt", "kms:GenerateDataKey"],
      "Resource": "*"
    }
  ]
}
```
A typical key policy: the first statement defers key administration to IAM policies in the account (the common "enable IAM policies" pattern), and the second explicitly grants a specific Lambda execution role only the two actions it actually needs (`Decrypt` and `GenerateDataKey`) rather than broad key management rights — least privilege applied at the resource-policy layer.

```javascript
// Envelope encryption using GenerateDataKey, via @aws-sdk/client-kms (v3).
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from "@aws-sdk/client-kms";

const kms = new KMSClient({ region: "us-east-1" });
const keyId = "alias/app-data-key";

// Encrypt: get a plaintext + encrypted data key pair, use the plaintext copy locally.
const { Plaintext, CiphertextBlob } = await kms.send(
  new GenerateDataKeyCommand({ KeyId: keyId, KeySpec: "AES_256" })
);

// Decrypt: send only the small encrypted data key back to KMS to recover it.
const { Plaintext: recoveredKey } = await kms.send(
  new DecryptCommand({ CiphertextBlob })
);
```
This is the exact SDK-level pattern SSE-KMS and encryption clients use internally — `GenerateDataKeyCommand` never sends your bulk data to KMS, only requests a fresh AES-256 key, so KMS's request-size limits and per-call cost apply only to key operations, not to the payload itself.

## Common Pitfalls / Gotchas

- Assuming an IAM policy granting `kms:Decrypt` is enough — the key's own resource-based key policy must *also* allow the caller (directly or by deferring to IAM), since KMS evaluates both. A missing key policy statement is one of the most common causes of confusing `AccessDeniedException` errors that look like an IAM problem but aren't.
- Deleting a KMS key without understanding the consequence — any data encrypted under it becomes permanently unrecoverable. AWS enforces a mandatory 7–30 day waiting period specifically to prevent accidental, irreversible data loss; there's no way to shorten or skip it.
- Calling the `Encrypt` API directly on payloads larger than 4 KB and hitting a size-limit error — anything bigger requires the envelope-encryption pattern via `GenerateDataKey` instead.
- Confusing automatic key rotation (transparent, same key ID, only for symmetric customer-managed keys, opt-in) with the assumption that *all* KMS keys rotate automatically by default — AWS managed keys rotate yearly automatically with no opt-out or opt-in choice, but asymmetric and HMAC customer-managed keys don't support automatic rotation at all and must be rotated manually if needed.
- Hitting KMS API request-rate throttling (`ThrottlingException`) under high-throughput encryption workloads, because every `GenerateDataKey`/`Decrypt` call counts against a per-account, per-region request quota — high-volume systems should cache data keys briefly or use envelope encryption to minimize KMS round trips rather than calling KMS per record.
- Forgetting that cross-region access to a (non-multi-region) KMS key isn't possible — a key created in `us-east-1` cannot decrypt or encrypt from `eu-west-1` directly; you need a Multi-Region key or must re-encrypt data with a region-local key.

## Interview Questions & Answers

**Q: What's the difference between an AWS managed key and a customer managed key?**
A: An AWS managed key (like `aws/s3`) is created automatically the first time a service needs one, is free, rotates automatically every year, and you cannot view or edit its key policy — AWS controls it. A customer managed key is one you explicitly create, giving you full control of its key policy, the ability to enable or disable automatic rotation, the ability to disable the key or schedule its deletion, and — at the cost of a monthly fee — the granularity needed for strict least-privilege access control and detailed CloudTrail auditing per key.

**Q: Why can't you just call the KMS `Encrypt` API on a 50 MB file?**
A: The `Encrypt` API is limited to 4 KB of plaintext per call by design — KMS is meant to protect small, high-value secrets like data keys, not serve as a bulk encryption service. For anything larger, you implement envelope encryption yourself: call `GenerateDataKey` to receive a plaintext AES key and its KMS-encrypted counterpart, encrypt the actual file locally with the plaintext key (no size limit), discard the plaintext key from memory, and store only the ciphertext plus the small encrypted data key.

**Q: Both an IAM policy and a KMS key policy seem to grant a role permission to use a key, but calls still fail with AccessDenied. What's the likely cause?**
A: KMS key policies and IAM identity policies are evaluated together, and unlike most AWS services, the resource-based key policy is not optional — every key must have one, and by default it must explicitly allow the caller (or explicitly defer to IAM policies via a `"Principal": {"AWS": "arn:...:root"}` statement with `kms:*`, the standard default policy AWS creates). If the key policy was edited and that deferral statement was removed, an IAM policy allowing `kms:Decrypt` is not sufficient on its own — the key policy must independently authorize the caller too.

**Q: What are KMS grants and when would you use one instead of editing the key policy?**
A: A grant is a temporary, revocable, and narrowly-scoped permission on a key, created programmatically via the `CreateGrant` API, typically to delegate specific operations (like `Decrypt` or `GenerateDataKey`) to a specific principal for a specific purpose without a full key-policy edit and redeploy. They're useful for dynamic, short-lived delegation patterns — for example, a service granting a downstream Lambda temporary decrypt access tied to a single workflow — where editing and redeploying the key policy for every such grant would be operationally heavy and harder to audit at fine granularity.

**Q: When would you reach for CloudHSM instead of KMS?**
A: When you need single-tenant, dedicated hardware security modules with full administrative control over key material and cryptographic operations — for example, compliance requirements mandating FIPS 140-2 Level 3 validation end-to-end, or needing to import and directly control key material outside AWS's standard KMS model. The tradeoff is significant added operational responsibility: you manage the HSM cluster, its high availability, backups, and user management yourself, versus KMS's fully managed, multi-tenant model that suffices for the vast majority of use cases.

## Related Topics
- [data-encryption.md](./data-encryption.md)
- [iam.md](./iam.md)
- [s3.md](./s3.md)
- [cognito.md](./cognito.md)
- [network-security.md](./network-security.md)
