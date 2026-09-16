# Worker Threads

Worker Threads belongs to the Node skill set. In interviews, it is useful because it shows whether you can connect theory with the way real systems are built, tested, deployed, and maintained.

The right mental model is: Node.js runtime behavior, event-loop scheduling, core modules, streams, networking, security, and production service design. A strong answer should explain the core idea, the normal workflow, the tradeoffs, and the failure modes. Avoid memorized one-line definitions; interviewers usually follow up by asking how you used the concept in a project or how you would debug it under pressure.

For teaching, begin with the problem, then show the smallest practical example, then discuss what changes at production scale. That makes the topic easier to remember and easier to adapt when the interviewer changes the constraints.

## Examples

~~~js
import { createServer } from 'node:http';
createServer((req, res) => res.end('Worker Threads')).listen(3000);
~~~

This example gives a practical anchor for the topic so you can explain the workflow rather than only naming the concept.

~~~js
import { pipeline } from 'node:stream/promises';
// Use backpressure-aware APIs for large data instead of buffering everything in memory.
~~~

This example highlights how Worker Threads connects to real project decisions: configuration, safety, performance, or maintainability.

~~~bash
# Interview checklist for Worker Threads
echo "Problem solved"
echo "Main mechanism"
echo "Tradeoffs"
echo "Debugging and production concerns"
~~~

Use this checklist when answering follow-up questions. It keeps the answer structured and prevents you from missing operational details.

## Common Pitfalls / Gotchas

- Blocking the event loop with CPU-heavy work or synchronous filesystem calls.
- Ignoring backpressure when using streams.
- Treating process-level errors as normal request errors.
- Trusting user input in filesystem, crypto, URL, or child-process APIs.

## Interview Questions & Answers

**Q: What is Worker Threads in the context of Node?**  
A: It is a Node topic that helps solve problems around Node.js runtime behavior, event-loop scheduling, core modules, streams, networking, security, and production service design. The best answer explains the problem first, then the mechanism, then a real example.

**Q: When would you use Worker Threads in a production project?**  
A: Use it when the project requirement matches the problem it solves and the tradeoffs are acceptable. Also explain how you would test, monitor, secure, or roll back the implementation.

**Q: What should you compare Worker Threads with?**  
A: Compare it with simpler alternatives in the same stack. Mention complexity, performance, team familiarity, deployment impact, and long-term maintenance.

**Q: How would you debug an issue related to Worker Threads?**  
A: Start by reproducing the issue, checking configuration and logs, isolating the smallest failing case, and validating assumptions with tooling specific to Node.

**Q: What is a senior-level point to mention?**  
A: Senior answers include ownership, observability, failure recovery, security boundaries, cost or resource usage, and how the decision affects other teams.

## Related Topics

- [blocking.md](./blocking.md)
- [buffers.md](./buffers.md)
- [child-process.md](./child-process.md)
