# Load Balancing and Traffic Management

Load balancing distributes traffic across multiple backend instances to improve availability, scalability, and fault tolerance.

## Common Algorithms

- Round robin
- Least connections
- Weighted routing
- IP hash
- Latency-based routing
- Geographic routing

## Layers

- DNS load balancing
- L4 load balancing: TCP/UDP
- L7 load balancing: HTTP-aware routing
- API gateway routing
- Service mesh routing

## Interview Q&A

**Q: Why do we need a load balancer?**  
A: To distribute traffic, remove unhealthy instances, support horizontal scaling, terminate TLS, and enable routing rules.

**Q: What is sticky session?**  
A: Sticky session routes a user to the same backend instance. It can simplify session handling but hurts load distribution and failover. Prefer external session storage when possible.

**Q: What happens if the load balancer fails?**  
A: Use managed load balancers, active-passive or active-active setup, DNS failover, and health checks.

