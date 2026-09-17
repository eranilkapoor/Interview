# Performance Optimization

Optimizing a Node.js API is a diagnostic process, not a checklist applied blindly. The single-threaded JavaScript execution model means that any single request that runs slowly, or any code that blocks the event loop, has an outsized effect on every other concurrent request being served by that process — so the first job in a performance investigation is figuring out *where* time is actually being spent before changing anything. A common interview trap is jumping straight to "add caching" or "add more servers" without first identifying whether the bottleneck is CPU-bound application code, a slow database query, a slow downstream API call, or the network itself.

The general diagnostic flow is: measure first (don't guess), then narrow down using logs/APM (Application Performance Monitoring) tooling, then look at the database query plan if the bottleneck involves data access, then apply the fix that actually matches the bottleneck — indexing, caching, pagination, moving work off the request path, or pooling connections — and finally load test to confirm the fix actually moved the needle under realistic concurrency, not just in isolation.

A senior-level answer distinguishes between fixes for different bottleneck classes: a slow, unindexed database query needs an index or query restructuring, not a cache (a cache just delays when you have to pay that cost, and adds a staleness problem); a CPU-bound computation (image processing, large JSON transforms, cryptographic hashing) needs to be moved off the main thread (`worker_threads`) or off-process entirely (a queue + background worker), not "await"ed inline, because `await` doesn't yield the CPU — it only yields while waiting on I/O; and a chatty API that makes many small sequential downstream calls needs batching or parallelization (`Promise.all`), not a bigger server.

## Examples

```javascript
// BAD: N+1 query pattern — one query per item, sequential
async function getOrdersWithCustomers(orderIds) {
  const results = [];
  for (const id of orderIds) {
    const order = await db.orders.findById(id);           // N queries
    const customer = await db.customers.findById(order.customerId); // N more queries
    results.push({ order, customer });
  }
  return results;
}

// BETTER: batch-fetch, then join in memory
async function getOrdersWithCustomersFast(orderIds) {
  const orders = await db.orders.find({ _id: { $in: orderIds } }); // 1 query
  const customerIds = [...new Set(orders.map(o => o.customerId))];
  const customers = await db.customers.find({ _id: { $in: customerIds } }); // 1 query
  const byId = new Map(customers.map(c => [String(c._id), c]));
  return orders.map(order => ({ order, customer: byId.get(String(order.customerId)) }));
}
```

```javascript
// Offloading a CPU-bound task instead of blocking the event loop inline
const { Worker } = require('worker_threads');

function hashInBackground(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./hash-worker.js', { workerData: data });
    worker.once('message', resolve);
    worker.once('error', reject);
  });
}
// A synchronous crypto.pbkdf2Sync(data, ...) call here would block every
// other request on this process until it finished.
```

```javascript
// Redis cache-aside for a read-heavy, expensive-to-compute endpoint
async function getProductCatalog(categoryId) {
  const cacheKey = `catalog:${categoryId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const products = await db.products.find({ categoryId }).lean();
  await redis.set(cacheKey, JSON.stringify(products), 'EX', 60); // 60s TTL
  return products;
}
```

## Common Pitfalls / Gotchas

- Adding caching before fixing an unindexed query — the cache hides the problem under normal load but the next cache-cold request (or a cache invalidation storm) is just as slow as before, and now you also have a staleness problem to manage.
- Using `Promise.all` to "parallelize" a set of writes that must happen in order, or that share a resource with limited concurrency (e.g. hammering a downstream API with 500 simultaneous requests) — parallelism needs to be bounded (a concurrency limiter / worker pool), not unlimited.
- Assuming `async`/`await` yields the CPU — it only yields while genuinely waiting on I/O. A CPU-heavy synchronous loop inside an `async` function still blocks the event loop exactly as much as if it weren't async at all.
- Optimizing based on a symptom observed once locally instead of production metrics under real concurrency and real data volumes — the bottleneck under 10 requests/sec is often completely different from the bottleneck under 1000 requests/sec.
- Forgetting to load-test after applying a fix, and shipping a change that "should" help without confirming it actually did.

## Interview Questions & Answers

**Q: A specific API endpoint is slow. Walk through how you'd investigate it.**
A: First measure — check APM traces/logs to see where time is actually going (application code, database, downstream API, network). If it's database-bound, run `explain()`/`EXPLAIN` on the query to check for missing indexes or a bad query plan. If it's CPU-bound application code, profile it (`--prof`, clinic.js, or a CPU flame graph) to find the hot function. Only after identifying the actual bottleneck would I apply a targeted fix — an index, batching, caching, or moving work off the request path — and then load test to confirm the improvement holds under concurrency.

**Q: Why doesn't `async`/`await` prevent the event loop from being blocked?**
A: `await` only suspends the current function and yields control back to the event loop while waiting on a genuinely asynchronous operation (I/O, a timer, a promise resolving from another task). If the code inside an `async` function does synchronous, CPU-heavy work — a large loop, JSON.parse on a huge payload, a synchronous crypto call — that work still runs to completion on the single JS thread before anything else can run, exactly as if `async` weren't there at all.

**Q: When is caching the wrong fix?**
A: When the underlying operation is cheap to fix directly (e.g. a missing index turning a full collection scan into an indexed lookup), caching just adds complexity and a staleness/invalidation problem on top of a problem that didn't need it. Caching is the right fix when the underlying computation or fetch is inherently expensive or slow (an external API call, an expensive aggregation) and slightly stale data is acceptable for that use case.

**Q: How would you decide between `worker_threads` and moving work to a separate queue/service?**
A: `worker_threads` is appropriate when the work is CPU-bound, needs to happen as part of serving the current request (the user is waiting for the result), and stays within the same process/deployment. A queue + background worker (Kafka/SQS/BullMQ) is appropriate when the work can happen asynchronously after responding to the user (e.g. sending a confirmation email, generating a report), or needs to scale independently of the API tier, or needs durability/retry semantics that an in-process worker thread doesn't provide.

## Related Topics
- [event-loop.md](./event-loop.md)
- [worker_threads.md](./worker_threads.md)
- [cluster.md](./cluster.md)
- [memory-leaks.md](./memory-leaks.md)
- [blocking.md](./blocking.md)
- [streams.md](./streams.md)
