# Replication And Sentinel

Replication And Sentinel belongs to the Redis skill set. In interviews, it is useful because it shows whether you can connect theory with the way real systems are built, tested, deployed, and maintained.

The right mental model is: in-memory data structures, caching, TTLs, eviction, pub/sub, streams, persistence, replication, and cluster behavior. A strong answer should explain the core idea, the normal workflow, the tradeoffs, and the failure modes. Avoid memorized one-line definitions; interviewers usually follow up by asking how you used the concept in a project or how you would debug it under pressure.

For teaching, begin with the problem, then show the smallest practical example, then discuss what changes at production scale. That makes the topic easier to remember and easier to adapt when the interviewer changes the constraints.

## Examples

~~~bash
redis-cli SET session:123 '{"userId":42}' EX 3600
~~~

This example gives a practical anchor for the topic so you can explain the workflow rather than only naming the concept.

~~~bash
redis-cli ZADD leaderboard 100 user:1
redis-cli ZREVRANGE leaderboard 0 9 WITHSCORES
~~~

This example highlights how Replication And Sentinel connects to real project decisions: configuration, safety, performance, or maintainability.

~~~bash
# Interview checklist for Replication And Sentinel
echo "Problem solved"
echo "Main mechanism"
echo "Tradeoffs"
echo "Debugging and production concerns"
~~~

Use this checklist when answering follow-up questions. It keeps the answer structured and prevents you from missing operational details.

## Common Pitfalls / Gotchas

- Using Redis as a cache without TTLs or invalidation rules.
- Assuming all Redis deployments persist data the same way.
- Storing huge values or unbounded keys without memory planning.
- Ignoring eviction policy, replication lag, and hot-key patterns.

## Interview Questions & Answers

**Q: What is Replication And Sentinel in the context of Redis?**  
A: It is a Redis topic that helps solve problems around in-memory data structures, caching, TTLs, eviction, pub/sub, streams, persistence, replication, and cluster behavior. The best answer explains the problem first, then the mechanism, then a real example.

**Q: When would you use Replication And Sentinel in a production project?**  
A: Use it when the project requirement matches the problem it solves and the tradeoffs are acceptable. Also explain how you would test, monitor, secure, or roll back the implementation.

**Q: What should you compare Replication And Sentinel with?**  
A: Compare it with simpler alternatives in the same stack. Mention complexity, performance, team familiarity, deployment impact, and long-term maintenance.

**Q: How would you debug an issue related to Replication And Sentinel?**  
A: Start by reproducing the issue, checking configuration and logs, isolating the smallest failing case, and validating assumptions with tooling specific to Redis.

**Q: What is a senior-level point to mention?**  
A: Senior answers include ownership, observability, failure recovery, security boundaries, cost or resource usage, and how the decision affects other teams.

## Related Topics

- [caching-patterns.md](./caching-patterns.md)
- [expiration-and-eviction.md](./expiration-and-eviction.md)
- [hashes-and-sorted-sets.md](./hashes-and-sorted-sets.md)
