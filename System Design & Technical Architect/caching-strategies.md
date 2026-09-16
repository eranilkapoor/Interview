# Caching Strategies

Caching stores frequently accessed data closer to the user or application to reduce latency and backend load. It improves performance but introduces consistency, invalidation, and memory tradeoffs.

## Cache Locations

- Browser cache
- CDN
- API gateway cache
- Application memory cache
- Distributed cache like Redis
- Database query cache or materialized views

## Patterns

- Cache-aside
- Read-through
- Write-through
- Write-behind
- Refresh-ahead

## Interview Q&A

**Q: What is cache-aside?**  
A: The application checks cache first. On miss, it reads from database, stores result in cache, and returns it. It is common and simple but requires explicit invalidation.

**Q: How do you invalidate cache?**  
A: TTL, event-based invalidation, versioned keys, write-through updates, or manual purge. The right choice depends on freshness requirements.

**Q: What is cache stampede?**  
A: Many requests miss the cache simultaneously and overload the database. Mitigation includes locks, request coalescing, jittered TTLs, and refresh-ahead.

