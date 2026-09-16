# Scalability and Performance

Scalability is the ability of a system to handle growth. Performance is how efficiently it handles current workload. A scalable system is not automatically fast, and a fast system is not automatically scalable.

## Common Techniques

- Horizontal scaling
- Vertical scaling
- Load balancing
- Caching
- Database indexing
- Read replicas
- Partitioning/sharding
- Async processing
- Queues
- CDN
- Batch processing
- Backpressure

## Read-Heavy vs Write-Heavy

Read-heavy systems benefit from caching, CDN, replicas, and denormalized views. Write-heavy systems need careful partitioning, queueing, batching, and write-optimized storage.

## Interview Q&A

**Q: How do you scale a backend service?**  
A: Make it stateless if possible, place it behind a load balancer, scale horizontally, use shared external storage for state, add caching, monitor bottlenecks, and scale databases carefully.

**Q: What is the difference between latency and throughput?**  
A: Latency is time per request. Throughput is number of requests processed per unit time. A system can have high throughput but poor latency under queue buildup.

**Q: How do you find a performance bottleneck?**  
A: Measure first: application metrics, traces, database slow queries, CPU, memory, network, cache hit ratio, and external dependencies.

