# Amazon S3 Glacier

S3 Glacier is AWS's storage tier for data you need to keep but rarely (or almost never) access — think compliance archives, regulatory retention, old backups, and media libraries you might need once a year. Today it exists in two forms that are easy to conflate in interviews: the modern **S3 Glacier storage classes** (S3 Glacier Instant Retrieval, S3 Glacier Flexible Retrieval, and S3 Glacier Deep Archive), which you use through the ordinary S3 API/console exactly like any other storage class, and the older, standalone **Glacier vaults API**, a separate service with its own vaults, archives, and jobs model that predates S3 storage class integration. New designs almost always use the S3-integrated storage classes; the vaults API mostly shows up in legacy systems.

The core tradeoff across all Glacier tiers is retrieval latency versus storage cost — the colder the tier, the cheaper the per-GB storage price, but the slower and sometimes costlier the retrieval. S3 Glacier Instant Retrieval behaves almost like S3 Standard-IA — millisecond retrieval — but at Glacier-level storage pricing, for data accessed roughly once a quarter. S3 Glacier Flexible Retrieval (formerly just "S3 Glacier") offers three retrieval speed tiers: Expedited (1–5 minutes, for urgent one-off retrievals, priced highest per GB retrieved), Standard (3–5 hours, the default), and Bulk (5–12 hours, cheapest, good for large batch restores). S3 Glacier Deep Archive is the coldest and cheapest class AWS offers, with Standard retrieval in about 12 hours and Bulk retrieval in about 48 hours — intended for data you're legally required to keep but essentially never expect to read.

Two cost mechanics catch people off guard. First, retrieval itself is a billed operation — restoring an archived object (via `RestoreObject`) incurs a per-GB retrieval fee that scales with how fast you ask for it (Expedited costs meaningfully more than Bulk for the same data). Second, every Glacier class enforces a **minimum storage duration** — 90 days for Flexible Retrieval, 180 days for Deep Archive — and deleting or transitioning an object out before that window elapses triggers a prorated early-deletion charge for the remaining minimum-duration days, as if you'd kept it the full period. This makes Glacier a poor fit for data with an uncertain or short retention need.

For regulatory/compliance archives, **Vault Lock policies** (on the vaults API) or **S3 Object Lock** (on S3-integrated Glacier classes) provide WORM (write-once-read-many) enforcement — once locked, an object/archive cannot be deleted or overwritten, even by the account root, until its retention period expires or (for legal hold) the hold is explicitly removed. This is the mechanism auditors look for when a system claims immutable audit-log or financial-record retention (e.g., SEC Rule 17a-4).

## Examples

```bash
# Transition objects older than 365 days straight to Deep Archive via a lifecycle rule
aws s3api put-bucket-lifecycle-configuration \
  --bucket compliance-archive-bucket \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "archive-old-records",
      "Filter": { "Prefix": "records/" },
      "Status": "Enabled",
      "Transitions": [{ "Days": 365, "StorageClass": "DEEP_ARCHIVE" }]
    }]
  }'
```
This is the standard pattern for compliance data: keep it in Standard for a year for potential audits, then let it age into the cheapest tier automatically without any application code change.

```bash
# Restore a Deep Archive object so it becomes temporarily downloadable again
aws s3api restore-object \
  --bucket compliance-archive-bucket \
  --key records/2019/statement.pdf \
  --restore-request '{
    "Days": 7,
    "GlacierJobParameters": { "Tier": "Standard" }
  }'
# Poll with head-object until x-amz-restore shows ongoing-request="false", then GET normally
aws s3api head-object --bucket compliance-archive-bucket --key records/2019/statement.pdf
```
Objects in Glacier classes aren't directly downloadable — you must restore a temporary copy first (here, a ~12-hour Standard-tier restore), which stays accessible for the `Days` window before reverting to archive-only.

```json
// S3 Object Lock retention in COMPLIANCE mode — enforces WORM even against account root
{
  "Retention": {
    "Mode": "COMPLIANCE",
    "RetainUntilDate": "2031-01-01T00:00:00Z"
  }
}
```
Applied per-object via `PutObjectRetention`, this guarantees the object can't be deleted or overwritten by anyone — including the account owner — until the retention date, which is what satisfies WORM requirements for financial or legal records.

## Common Pitfalls / Gotchas

- Forgetting the minimum storage duration charge — deleting or lifecycle-transitioning an object 30 days into Deep Archive's 180-day minimum still bills you for the remaining ~150 days, prorated, as an early-deletion fee.
- Assuming Glacier objects are readable like normal S3 objects — a GET on an un-restored Glacier object fails; you must call `RestoreObject` first and wait for the retrieval job (minutes to nearly two days depending on tier) before the data is fetchable.
- Choosing Expedited retrieval as a default without realizing it costs substantially more per GB than Standard or Bulk — fine for a rare emergency restore, expensive if it becomes routine.
- Not accounting for the temporary restored copy also incurring standard S3 storage cost for its `Days` duration — you're briefly paying for both the archived copy and the restored copy.
- Confusing S3 Glacier Instant Retrieval with the other Glacier classes — it has millisecond access like S3 Standard-IA and needs no restore step at all, but people sometimes assume all "Glacier" objects require a restore wait.
- Locking objects with Object Lock COMPLIANCE mode before confirming the retention period is correct — COMPLIANCE mode cannot be shortened or removed by anyone, including AWS support, once applied; GOVERNANCE mode is the safer default for anything not legally mandated to be un-shortenable.

## Interview Questions & Answers

**Q: What's the difference between the three S3 Glacier storage classes?**
A: S3 Glacier Instant Retrieval gives millisecond access (no restore step) at Glacier pricing, for data touched maybe quarterly. S3 Glacier Flexible Retrieval requires an explicit restore job with three speed/price tiers — Expedited (1–5 min), Standard (3–5 hrs), Bulk (5–12 hrs) — for data accessed a few times a year. S3 Glacier Deep Archive is the cheapest and slowest, with Standard (~12 hrs) and Bulk (~48 hrs) retrieval only, for data kept purely for compliance/legal retention that's essentially never read.

**Q: Why might a lifecycle policy that moves objects to Deep Archive after only a few days end up costing more than expected?**
A: Deep Archive has a 180-day minimum storage duration charge. If objects are deleted, overwritten, or transitioned to another class before 180 days have elapsed since they entered Deep Archive, S3 bills a prorated early-deletion fee for the remaining days as if the object had stayed the full minimum — so archiving short-lived data into Deep Archive is a cost trap, not a saving.

**Q: How do you make archived data legally immutable (WORM) in S3 Glacier?**
A: Use S3 Object Lock (on the bucket, with Object Lock enabled at bucket creation) with a retention mode of COMPLIANCE, or a Vault Lock policy on the legacy vaults API. COMPLIANCE mode prevents deletion or modification by any principal, including the root account, until the retention date passes — this is what regulatory frameworks like SEC 17a-4 or FINRA require for immutable record retention. GOVERNANCE mode offers similar protection but permits users with special IAM permissions to alter or remove the lock.

**Q: A team needs to restore 50 TB of Deep Archive data for an audit next week — what would you tell them about cost and timing?**
A: Timing: Deep Archive restores take up to 12 hours (Standard tier) or up to 48 hours (Bulk tier) — there's no faster option, unlike Flexible Retrieval's Expedited tier, so this must be initiated well ahead of the audit deadline. Cost: they'll pay a per-GB retrieval fee (Bulk is far cheaper per GB than Standard at that volume) plus standard S3 storage cost for the restored temporary copy for however many days they set it to remain restored — at 50 TB, choosing Bulk over Standard retrieval could be a meaningful cost difference for a non-urgent, plannable restore.

## Related Topics
- [s3.md](./s3.md)
- [cost-optimization.md](./cost-optimization.md)
- [data-encryption.md](./data-encryption.md)
- [iam.md](./iam.md)
- [well-architected-framework.md](./well-architected-framework.md)
