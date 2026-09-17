# Amazon Redshift

Redshift is a fully managed OLAP (online analytical processing) data warehouse — built for complex analytical queries that scan and aggregate large volumes of historical data, not for the high-frequency, low-latency single-row reads/writes that OLTP databases like RDS or DynamoDB handle. Choosing Redshift versus RDS/Aurora for a workload comes down to that distinction: "give me the total revenue by region for the last three years, grouped and filtered a dozen ways" is a Redshift-shaped question; "fetch this one customer's current order status" is not.

Two architectural choices make Redshift good at analytical workloads. First, columnar storage: data is stored column-by-column on disk rather than row-by-row, so a query that aggregates one or two columns across billions of rows only reads the storage blocks for those columns, not entire rows — this is a large I/O win for typical analytics queries and also compresses far better than row storage since values within a column tend to be similar. Second, MPP (massively parallel processing): a Redshift cluster has one leader node, which parses and plans queries, and multiple compute nodes, each internally divided into slices, which execute the query plan in parallel against their own portion of the data and return partial results to the leader node for final aggregation. This is why cluster sizing (node count and type) directly controls query parallelism, not just storage capacity.

How table data is distributed across those compute nodes is a first-class design decision, controlled by distribution style. `KEY` distribution places all rows sharing the same value of a chosen distribution key column on the same node — ideal for large fact tables frequently joined on that key, since matching rows for a join already sit together and avoid shuffling data across the network mid-query. `EVEN` distribution round-robins rows across nodes regardless of value — a reasonable default when there's no obvious join key or the table isn't frequently joined. `ALL` distribution replicates the entire table onto every node — appropriate for small, frequently-joined dimension tables (like a "countries" or "product categories" lookup table), where the cost of storing a full copy on every node is trivial but avoids a costly broadcast/redistribution during every join. Getting distribution style wrong is one of the most common real-world sources of slow Redshift queries, showing up as heavy "network" time in `EXPLAIN` output from redistributing rows mid-query.

Sort keys are the complementary decision: they determine the physical on-disk row order within each slice, which lets Redshift skip reading storage blocks entirely for ranges outside a query's filter (zone maps track the min/max value per block) — a compound sort key on `(date, region)` makes "last 30 days for region X" queries dramatically cheaper than an unsorted table forcing a full scan. Redshift Spectrum extends the same query engine to data sitting directly in S3, in formats like Parquet or ORC, without loading it into the cluster at all — separate compute and storage from the cluster itself, billed per data scanned — which is the standard pattern for querying huge historical datasets you don't want to pay to store twice (once in S3, once loaded into Redshift), or for joining "cold" S3 data against "hot" data that lives in the cluster proper.

## Examples

```sql
-- Fact table using KEY distribution on the join column, dimension table replicated with ALL
CREATE TABLE sales_fact (
  sale_id BIGINT,
  customer_id BIGINT,
  product_id INT,
  sale_date DATE,
  amount DECIMAL(10,2)
)
DISTSTYLE KEY
DISTKEY (customer_id)
SORTKEY (sale_date, customer_id);

CREATE TABLE customer_dim (
  customer_id BIGINT,
  region VARCHAR(50),
  segment VARCHAR(50)
)
DISTSTYLE ALL;
```
Distributing `sales_fact` by `customer_id` colocates each customer's sales with their dimension row (replicated on every node via `ALL`), so joining them doesn't require shuffling rows across the network at query time; the compound sort key makes date-range-filtered queries skip irrelevant blocks.

```sql
-- Redshift Spectrum: query historical Parquet data in S3 without loading it into the cluster
CREATE EXTERNAL SCHEMA spectrum_schema
FROM DATA CATALOG
DATABASE 'analytics_archive'
IAM_ROLE 'arn:aws:iam::111122223333:role/redshift-spectrum-role';

SELECT region, SUM(amount) AS total_sales
FROM spectrum_schema.sales_archive_2019_2022
WHERE sale_date >= '2019-01-01'
GROUP BY region;
```
This queries multi-year archived sales sitting in S3 as Parquet directly, at S3-scan pricing, without ever loading that data into (and paying cluster storage for) the warehouse itself.

```bash
# Load data efficiently into Redshift from S3 using COPY (far faster than row-by-row INSERT)
aws redshift-data execute-statement \
  --cluster-identifier analytics-cluster \
  --database analytics \
  --db-user admin \
  --sql "COPY sales_fact FROM 's3://data-lake-bucket/sales/2026/09/' \
         IAM_ROLE 'arn:aws:iam::111122223333:role/redshift-copy-role' \
         FORMAT AS PARQUET;"
```
`COPY` loads data in parallel across all cluster slices directly from S3, which is the standard bulk-ingestion path into Redshift — individual `INSERT` statements are drastically slower for anything beyond trivial volumes.

## Common Pitfalls / Gotchas

- Using Redshift as an OLTP database — single-row lookups and high-frequency small transactional writes perform poorly on a columnar, MPP-oriented engine optimized for large scans, not point queries.
- Choosing `EVEN` distribution (or the wrong `KEY`) on large tables that are frequently joined — causes expensive data redistribution across the network at query time, which shows up as high "network"/redistribution cost in `EXPLAIN` plans and is a very common real-world performance complaint.
- Loading data with many small `INSERT` statements instead of `COPY` from S3 — row-by-row inserts don't parallelize across slices the way bulk `COPY` does and are dramatically slower and more expensive at any real volume.
- Ignoring `VACUUM` and table statistics — Redshift doesn't reclaim space or re-sort rows from updates/deletes automatically the way some databases do; stale statistics also lead the query planner to make poor join-order and distribution decisions, degrading performance over time until `VACUUM`/`ANALYZE` (or auto-vacuum, which exists but isn't a complete substitute for understanding it) is run.
- Sizing the cluster around storage needs alone and forgetting query concurrency/parallelism — node count directly bounds how many query slices can run at once, so a storage-adequate but node-sparse cluster can still bottleneck badly under concurrent analytical load; Concurrency Scaling and RA3 node types (which separate storage from compute) help but don't remove the tradeoff entirely.
- Underestimating Redshift Spectrum scan costs — Spectrum is billed per byte scanned from S3, so an unpartitioned or unfiltered query over a huge Parquet dataset can quietly become expensive; partitioning the S3 data (e.g., by date) and filtering on partition columns keeps scans — and cost — bounded.

## Interview Questions & Answers

**Q: Why is Redshift's columnar storage well suited to analytical queries but poorly suited to OLTP workloads?**
A: Columnar storage groups values of the same column together on disk, so a query aggregating a handful of columns across millions of rows only reads the relevant column blocks, and similar adjacent values compress well — a big win for wide-table analytical scans. But OLTP workloads typically read/write entire rows (all columns of one record) very frequently at low latency, which means reconstructing a full row from columnar storage requires touching many separate column blocks — the opposite of what columnar storage optimizes for.

**Q: Explain the three Redshift distribution styles and when you'd use each.**
A: `KEY` distributes rows by a chosen column's value so matching rows land on the same node — ideal for large tables frequently joined on that column, since it avoids redistributing data across the network during the join. `EVEN` round-robins rows across nodes with no regard to value — a safe default when there's no dominant join pattern. `ALL` replicates the full table onto every node — best for small, frequently-joined dimension tables, where the storage overhead of full replication is trivial but it eliminates redistribution cost entirely for every join against it.

**Q: What is Redshift Spectrum, and why would you use it instead of just loading everything into the cluster?**
A: Spectrum lets Redshift query data sitting directly in S3 (commonly Parquet/ORC, often via a Glue Data Catalog external schema) without first loading it into cluster storage, using separate compute from the cluster itself and billing per byte scanned. It's the standard approach for querying large historical or infrequently-accessed datasets you don't want to pay to store twice, or for joining "cold" archival data against "hot" data that lives in the warehouse, without provisioning a bigger (and more expensive) cluster just to hold rarely-queried history.

**Q: A dashboard query joining a 2-billion-row fact table to a 50-row lookup table is slow — what would you check first?**
A: Distribution style on both tables. If the fact table isn't distributed by the join key (or the lookup table isn't set to `ALL` distribution), Redshift has to redistribute one side of the join across the network for every query, which is expensive at that scale. Making the tiny lookup table `DISTSTYLE ALL` (replicated on every node) and distributing the fact table by the join key eliminates that redistribution entirely — a 50-row table replicated on every node costs essentially nothing in storage.

**Q: What's the difference between a distribution key and a sort key, and can a table have both?**
A: Yes, and they solve different problems. The distribution key decides which physical node a row lives on (affecting join efficiency and data movement across the network). The sort key decides the on-disk row order within each node/slice (affecting how much data a scan can skip via zone maps for range-filtered queries, like a date filter). A well-modeled large fact table commonly has both — a distribution key matching its most common large join, and a sort key matching its most common range filter, such as date.

## Related Topics
- [rds.md](./rds.md)
- [aurora-db.md](./aurora-db.md)
- [s3.md](./s3.md)
- [dynamodb.md](./dynamodb.md)
- [cost-optimization.md](./cost-optimization.md)
- [cloudwatch.md](./cloudwatch.md)
