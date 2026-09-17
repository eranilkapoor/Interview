# Data Encryption on AWS

Data encryption on AWS is organized around two orthogonal axes: the *state* of the data (at rest vs. in transit) and *who performs the encryption* (AWS on your behalf, server-side, vs. your own application, client-side). Encryption at rest protects data while it's stored on a physical medium — an EBS volume, an S3 object on disk, an RDS database's underlying storage — so that someone with access to the raw storage media (a stolen disk, an improperly decommissioned drive) cannot read it. Encryption in transit protects data while it moves across a network — TLS/SSL for HTTPS calls to S3 or API Gateway, TLS for connections to an RDS instance — so that someone intercepting network traffic (a man-in-the-middle) cannot read it. These are independent controls: you can have one without the other, and a well-architected system uses both.

Server-side encryption (SSE) means AWS itself performs the encryption and decryption transparently — you upload plaintext, AWS encrypts it before writing to disk, and decrypts it before returning it to an authorized caller; the complexity is invisible to your application. S3 offers three SSE variants: **SSE-S3** (AWS manages the encryption keys entirely, no KMS involvement, free), **SSE-KMS** (backed by a KMS key you choose, giving you key policies, audit trail via CloudTrail, and rotation control, at the cost of a per-request KMS API charge and KMS request-rate limits), and **SSE-C** (you supply your own encryption key with every request; AWS uses it to encrypt/decrypt but never stores it — you are fully responsible for key management and losing the key means losing the data). Client-side encryption means your application encrypts the data *before* it ever leaves your control and sends AWS only ciphertext — AWS never sees the plaintext or holds the key that could decrypt it, which is the strongest model for data you don't want a cloud provider to ever be able to read, at the cost of you owning all key management complexity.

The mechanism underlying almost all of this at scale is **envelope encryption**, the pattern AWS KMS implements: rather than encrypting your actual data directly with a slow, tightly-rate-limited master key, you generate a unique, random **data key**, use that data key (a fast symmetric AES-256 operation) to encrypt the actual payload locally, then encrypt *that data key* with your KMS master key and store the small encrypted data key alongside the ciphertext. To decrypt later, you send only the small encrypted data key to KMS to be decrypted, then use the returned plaintext data key locally to decrypt the actual payload. The master key material never leaves KMS's hardware security modules and is never exposed to encrypt bulk data directly — this is exactly what SSE-KMS, the S3 encryption client, and the DynamoDB encryption client all do under the hood.

## Examples

```bash
# Enforce TLS-only access (encryption in transit) via an S3 bucket policy condition.
aws s3api put-bucket-policy --bucket my-sensitive-data --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "DenyInsecureTransport",
    "Effect": "Deny",
    "Principal": "*",
    "Action": "s3:*",
    "Resource": ["arn:aws:s3:::my-sensitive-data", "arn:aws:s3:::my-sensitive-data/*"],
    "Condition": { "Bool": { "aws:SecureTransport": "false" } }
  }]
}'
```
This denies any S3 request that doesn't use HTTPS, closing the "encryption at rest but plaintext in transit" gap — a bucket can be fully SSE-KMS encrypted at rest and still leak data if a client connects over plain HTTP.

```bash
# Upload an S3 object with server-side encryption using a customer-managed KMS key.
aws s3 cp ./report.csv s3://my-sensitive-data/report.csv \
  --sse aws:kms \
  --sse-kms-key-id arn:aws:kms:us-east-1:123456789012:key/1234abcd-12ab-34cd-56ef-1234567890ab
```
SSE-KMS with an explicit customer-managed key (rather than the default SSE-S3 or the AWS managed `aws/s3` key) gives you a dedicated key policy, a CloudTrail audit trail of every encrypt/decrypt call against this specific key, and the ability to disable or revoke it independently of other data.

```javascript
// Client-side envelope encryption pattern using @aws-sdk/client-kms (conceptual, v3).
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from "@aws-sdk/client-kms";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const kms = new KMSClient({ region: "us-east-1" });

async function encryptPayload(plaintext, keyId) {
  // 1. Ask KMS for a fresh data key: plaintext copy (used locally, never sent back)
  //    and an encrypted copy (safe to store).
  const { Plaintext, CiphertextBlob } = await kms.send(
    new GenerateDataKeyCommand({ KeyId: keyId, KeySpec: "AES_256" })
  );
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Plaintext, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  // Store ciphertext + iv + CiphertextBlob (the encrypted data key) together.
  return { ciphertext, iv, encryptedDataKey: CiphertextBlob, authTag: cipher.getAuthTag() };
}
```
This is the envelope encryption pattern by hand: `GenerateDataKeyCommand` returns both a plaintext data key (used immediately and then discarded from memory) and its KMS-encrypted form (persisted); the KMS master key itself never touches the 5MB+ payload, avoiding KMS's request size limits and reducing calls to the master key.

## Common Pitfalls / Gotchas

- Assuming "encrypted at rest" means the data is fully protected — it says nothing about encryption in transit, and a database with encrypted storage but an unencrypted network connection still leaks plaintext to anyone sniffing traffic.
- Using SSE-C (customer-provided keys) and losing the key — AWS never stores it, so there is no recovery path; the object becomes permanently undecryptable.
- Enabling S3 default bucket encryption but not blocking unencrypted `PutObject` requests via a bucket policy condition (`s3:x-amz-server-side-encryption`) — default encryption only applies when no encryption is explicitly specified in the request, not as an unconditional enforcement.
- Calling the KMS `Encrypt` API directly on large payloads — it's capped at 4 KB of plaintext; anything larger requires implementing envelope encryption yourself with `GenerateDataKey`.
- Forgetting that enabling encryption at rest on an existing unencrypted resource (e.g., an EBS volume or RDS instance) usually doesn't retroactively encrypt existing data — for EBS you must snapshot and re-create the volume with encryption enabled; for RDS you typically need to snapshot, copy the snapshot with encryption enabled, and restore from that.
- Treating client-side encryption as strictly "more secure" without considering the operational cost — you now own key distribution, rotation, and recovery entirely yourself, and losing your keys means losing your data with no AWS-side recovery.

## Interview Questions & Answers

**Q: Explain envelope encryption and why KMS uses it instead of encrypting data directly with the master key.**
A: Envelope encryption uses a two-tier key structure: a unique data key encrypts the actual payload using fast symmetric encryption, and that data key is itself encrypted by a KMS master key that never leaves KMS's HSMs. This avoids sending potentially large payloads to KMS (whose `Encrypt` API is capped at 4 KB) and limits the master key's exposure — it's only ever used to encrypt/decrypt small data keys, not bulk data, which reduces the blast radius if any single data key is somehow compromised and keeps master key API usage low-volume and easy to audit.

**Q: What's the difference between SSE-S3, SSE-KMS, and SSE-C?**
A: All three encrypt data at rest server-side, but differ in key ownership and control. SSE-S3 uses keys fully managed by AWS with no visibility or control on your part, and is free. SSE-KMS uses a KMS key you choose (AWS-managed or customer-managed), giving you a key policy, rotation control, and a CloudTrail audit trail of every use, at the cost of KMS request charges and rate limits. SSE-C requires you to supply the actual encryption key with every request; AWS uses it transiently and never stores it, meaning you own full responsibility for the key's lifecycle and recovery.

**Q: When would you choose client-side encryption over server-side encryption?**
A: When you need assurance that AWS itself never has access to the plaintext — for example, regulatory requirements demanding the cloud provider be unable to read the data, or a threat model that includes a compromised or subpoenaed AWS environment. The tradeoff is that you take on full responsibility for key generation, distribution to every client that needs to decrypt, rotation, and recovery — AWS can't help you recover data if you lose the client-side key.

**Q: A large file upload to S3 is failing when you try to encrypt it directly through the KMS `Encrypt` API. Why, and what's the fix?**
A: The KMS `Encrypt` API only accepts up to 4 KB of plaintext per call — it's designed for small values like data keys or configuration secrets, not bulk data. For anything larger you need to implement envelope encryption: call `GenerateDataKey` to get a data key, encrypt the actual payload locally with that data key (which has no such size limit), then store the small KMS-encrypted copy of the data key alongside the ciphertext. This is exactly what SSE-KMS does internally.

**Q: How do you enforce that all traffic to an S3 bucket uses encryption in transit?**
A: Add a bucket policy statement with `"Effect": "Deny"` on all actions where the condition `aws:SecureTransport` is `false`. Since an explicit Deny always overrides any Allow, this guarantees any request made over plain HTTP is rejected regardless of what other permissions the caller has, closing the gap between "encrypted at rest" and "still vulnerable to interception in transit."

## Related Topics
- [key-management-service.md](./key-management-service.md)
- [iam.md](./iam.md)
- [s3.md](./s3.md)
- [network-security.md](./network-security.md)
- [cognito.md](./cognito.md)
- [well-architected-framework.md](./well-architected-framework.md)
