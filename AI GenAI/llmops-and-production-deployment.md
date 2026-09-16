# LLMOps and Production Deployment

LLMOps is the practice of deploying, monitoring, evaluating, and maintaining LLM-powered applications. It overlaps with MLOps, DevOps, and application observability, but GenAI adds prompt versions, model versions, retrieval quality, safety, token cost, and probabilistic outputs.

## Production Concerns

- Model selection
- Prompt versioning
- Evaluation pipeline
- Latency and streaming
- Token/cost tracking
- Rate limits
- Caching
- Fallback models
- Data privacy
- Observability
- Incident response

## Interview Questions & Answers

**Q: How do you deploy an LLM feature safely?**  
A: Start with offline evals, limited rollout, monitoring, safety checks, feedback collection, fallback behavior, and rollback plan.

**Q: How do you reduce LLM cost?**  
A: Use smaller models where possible, cache responses, reduce context, optimize retrieval, batch jobs, route simple tasks to cheaper models, and monitor token usage.

**Q: How do you handle model provider outage?**  
A: Use retries with backoff, fallback model/provider, degraded mode, queue non-urgent tasks, and communicate impact.

**Q: What is prompt versioning?**  
A: Tracking prompt changes like code changes so outputs can be reproduced, tested, reviewed, and rolled back.

