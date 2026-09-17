# Amazon DynamoDB

DynamoDB is AWS's fully managed NoSQL database, built around a key-value/document model rather than tables-with-fixed-schemas-and-joins. Every table needs a primary key, which is either a simple primary key (just a partition key) or a composite primary key (partition key + sort key). The partition key determines which physical storage partition an item lives on — DynamoDB hashes it internally to distribute items across partitions — while the sort key, when present, orders items within a single partition key's item collection, enabling efficient range queries like "all orders for customer X between two dates" without scanning the whole table.

Capacity comes in two modes. On-Demand billing charges per request and scales automatically with no capacity planning, good for unpredictable or spiky traffic and new workloads where you don't yet know your access patterns. Provisioned capacity has you specify Read Capacity Units (RCUs) and Write Capacity Units (WCUs) up front — cheaper at steady, predictable volume, and can be paired with Application Auto Scaling to adjust provisioned capacity based on a target utilization metric. Under-provisioning either mode leads to throttling (`ProvisionedThroughputExceededException`), so understanding your access patterns before choosing is part of the design, not an afterthought.

Secondary indexes are where DynamoDB's data-modeling discipline really shows. A Global Secondary Index (GSI) has its own partition key (and optional sort key), independent of the base table's key, its own provisioned capacity, and is always eventually consistent — you can create or delete a GSI at any time on an existing table. A Local Secondary Index (LSI) shares the base table's partition key but defines an alternate sort key, shares the base table's capacity, supports optional strongly consistent reads, and — critically — must be defined at table creation time and cannot be added later. This LSI restriction is a common design trap: teams that didn't anticipate a query pattern find they can't retrofit an LSI without recreating the table, whereas a GSI can be bolted on later.

Read consistency is a deliberate tradeoff exposed directly in the API: eventually consistent reads (the default) are cheaper — one RCU covers up to 4 KB — and may briefly return stale data after a very recent write; strongly consistent reads (`ConsistentRead: true`) always reflect the latest successful write but cost double the RCUs and aren't available on GSIs at all. DynamoDB Streams captures an ordered, near-real-time log of item-level changes (insert/modify/remove), commonly wired to a Lambda trigger for change-data-capture patterns like replicating writes to OpenSearch, maintaining a materialized aggregate, or fanning out events. TTL lets you mark items for automatic, no-cost background deletion once a timestamp attribute passes — useful for session data or ephemeral records, though the actual deletion can lag the TTL by up to 48 hours since it isn't instantaneous. Item size is capped at 400 KB, and single-digit-millisecond latency is achievable at effectively unlimited scale as long as the partition key has enough cardinality to spread load evenly — a low-cardinality or skewed key creates a "hot partition," where one partition absorbs disproportionate traffic and throttles well before the table's aggregate provisioned capacity is exhausted.

For read-heavy workloads needing sub-millisecond latency beyond what DynamoDB itself offers, DAX (DynamoDB Accelerator) is an in-memory, write-through caching layer that sits in front of the table and is API-compatible with the DynamoDB SDK. For multi-item atomicity, `TransactWriteItems`/`TransactGetItems` provide ACID transactions across up to 100 items or 4 MB per transaction, at roughly double the cost of the equivalent non-transactional operations.

## Examples

```js
// Composite key table: put and query with the SDK v3
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));

await client.send(new PutCommand({
  TableName: "Orders",
  Item: { customerId: "cust#123", orderDate: "2026-09-10", status: "SHIPPED", total: 84.5 },
}));

// Efficient range query using the sort key — no table scan involved
const result = await client.send(new QueryCommand({
  TableName: "Orders",
  KeyConditionExpression: "customerId = :c AND orderDate BETWEEN :start AND :end",
  ExpressionAttributeValues: { ":c": "cust#123", ":start": "2026-01-01", ":end": "2026-12-31" },
}));
```
The composite key (`customerId` as partition key, `orderDate` as sort key) lets you fetch a bounded, ordered slice of one customer's orders in a single request instead of scanning the table.

```json
// CloudFormation snippet: table with On-Demand billing and a GSI for querying by status
{
  "Type": "AWS::DynamoDB::Table",
  "Properties": {
    "TableName": "Orders",
    "BillingMode": "PAY_PER_REQUEST",
    "AttributeDefinitions": [
      { "AttributeName": "customerId", "AttributeType": "S" },
      { "AttributeName": "orderDate", "AttributeType": "S" },
      { "AttributeName": "status", "AttributeType": "S" }
    ],
    "KeySchema": [
      { "AttributeName": "customerId", "KeyType": "HASH" },
      { "AttributeName": "orderDate", "KeyType": "RANGE" }
    ],
    "GlobalSecondaryIndexes": [{
      "IndexName": "status-index",
      "KeySchema": [{ "AttributeName": "status", "KeyType": "HASH" }],
      "Projection": { "ProjectionType": "ALL" }
    }],
    "StreamSpecification": { "StreamViewType": "NEW_AND_OLD_IMAGES" }
  }
}
```
The GSI on `status` lets you query "all orders currently SHIPPED" across every customer — a pattern the base table's key schema can't serve directly — and the stream spec enables downstream Lambda triggers for CDC.

```js
// Multi-item ACID transaction: decrement inventory only if it stays non-negative
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";

await client.send(new TransactWriteCommand({
  TransactItems: [
    {
      Update: {
        TableName: "Inventory",
        Key: { sku: "WIDGET-1" },
        UpdateExpression: "SET stock = stock - :qty",
        ConditionExpression: "stock >= :qty",
        ExpressionAttributeValues: { ":qty": 2 },
      },
    },
    {
      Put: {
        TableName: "Orders",
        Item: { orderId: "ord#789", sku: "WIDGET-1", qty: 2 },
      },
    },
  ],
}));
```
Both writes succeed or both fail together — if stock would go negative, the whole transaction is rejected, preventing overselling without needing a separate distributed lock.

## Common Pitfalls / Gotchas

- Designing with a low-cardinality partition key (e.g., `status` with three possible values, or a fixed `tenantId` for a single large tenant) — creates a hot partition where one partition's throughput ceiling throttles requests long before the table's total provisioned/on-demand capacity is reached.
- Trying to add an LSI to an existing table — impossible; LSIs must be declared at table creation. This is the single most common DynamoDB modeling regret and usually means recreating the table and migrating data.
- Using `Scan` instead of `Query` for anything beyond ad-hoc admin tooling — a `Scan` reads every item in the table (or index) and filters afterward, burning RCUs proportional to table size regardless of how few items match.
- Assuming GSI reads are strongly consistent — they're always eventually consistent, so a write followed immediately by a GSI query can miss the new item for a brief window; `ConsistentRead` isn't even an option on GSIs.
- Not accounting for TTL deletion lag — items past their TTL timestamp are typically removed within 48 hours, not instantly, so code that assumes immediate disappearance (e.g., relying on TTL alone to enforce a hard business deadline) will be wrong.
- Underestimating item size limits and access patterns during modeling — a 400 KB item cap plus DynamoDB's "design for your queries first" philosophy (denormalize, duplicate data, single-table design) is a real mental shift from relational modeling, and retrofitting new access patterns onto a table designed around the wrong key schema is expensive.

## Interview Questions & Answers

**Q: What's the difference between a Global Secondary Index and a Local Secondary Index?**
A: A GSI has its own partition key (and optional sort key) independent of the base table, its own provisioned capacity, can be added or removed at any time, and only supports eventually consistent reads. An LSI shares the base table's partition key but uses an alternate sort key, shares the base table's RCU/WCU capacity, supports strongly consistent reads, and — critically — must be defined when the table is created; it can never be added afterward.

**Q: Explain the difference between eventually consistent and strongly consistent reads, and when you'd pay for the latter.**
A: Eventually consistent reads (the default) may return slightly stale data if read immediately after a write to the same item, but cost one RCU per 4 KB. Strongly consistent reads always return the most recent successful write, at double the RCU cost, and aren't available on GSIs at all. You'd choose strong consistency for something like reading a value right after updating it in the same request flow (e.g., a balance check right after a debit) where stale data would cause a correctness bug, not just a UX quirk.

**Q: What causes a "hot partition," and how do you design around it?**
A: A hot partition happens when the partition key has low cardinality or skewed access — many requests land on the same partition key value, and that single partition's throughput ceiling gets exhausted even though the table overall has plenty of spare capacity. The fix is choosing a higher-cardinality key, or adding a random or calculated suffix (write sharding) to spread a naturally hot key like `status` or a single large tenant's ID across multiple physical partition key values, then fanning queries back out across the shards.

**Q: How would you keep a search index or analytics store in sync with DynamoDB in near real time?**
A: Enable DynamoDB Streams on the table, which emits an ordered, near-real-time log of item-level changes (new/old images), and attach a Lambda function as a trigger on the stream. The Lambda processes each change batch and pushes it to the downstream system (OpenSearch, a data warehouse, a cache invalidation, etc.) — this is the standard change-data-capture pattern and avoids dual-writing from the application itself.

**Q: When would you reach for DAX instead of just tuning DynamoDB capacity?**
A: When you need latency below what DynamoDB itself provides (sub-millisecond vs. single-digit millisecond) or need to absorb a very read-heavy, repeat-key access pattern without linearly scaling RCUs — DAX is a managed, write-through, in-memory cache in front of the table, API-compatible with the DynamoDB SDK so it requires minimal application changes. It's not a substitute for good key design; a hot partition problem isn't solved by adding a cache in front of it if writes are the bottleneck.

## Related Topics
- [rds.md](./rds.md)
- [aurora-db.md](./aurora-db.md)
- [elasticache.md](./elasticache.md)
- [lambda.md](./lambda.md)
- [cost-optimization.md](./cost-optimization.md)
- [iam.md](./iam.md)
