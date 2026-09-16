# GenAI System Design Questions

GenAI system design combines normal distributed system design with AI-specific concerns: prompt/context management, retrieval, evaluation, safety, latency, cost, and model behavior.

## Common Design Prompts

- Design a RAG chatbot for customer support.
- Design an AI coding assistant.
- Design a document summarization system.
- Design an AI agent for ticket triage.
- Design an enterprise knowledge assistant.
- Design a meeting transcript summarizer.
- Design a resume screening assistant.
- Design a semantic search system.
- Design an AI email response assistant.
- Design an LLM evaluation platform.

## Design Framework

1. Clarify users and tasks.
2. Define data sources and permissions.
3. Choose model and retrieval approach.
4. Define prompt/context strategy.
5. Add evaluation and monitoring.
6. Add safety and guardrails.
7. Discuss latency and cost.
8. Plan rollout and feedback loop.

## Interview Questions & Answers

**Q: Design an enterprise knowledge assistant.**  
A: Ingest approved documents, apply permission-aware chunking, generate embeddings, store in vector DB with metadata, retrieve and rerank per query, assemble grounded prompt, return answer with citations, log feedback, evaluate quality, and enforce access control.

**Q: Design a document summarizer.**  
A: For small docs, summarize directly. For long docs, chunk, summarize chunks, combine summaries, preserve key entities, validate against source, and track hallucination with evals.

**Q: Design an AI agent for support ticket triage.**  
A: Classify ticket, retrieve history, suggest category/priority, call tools only with validated arguments, escalate uncertain cases, log rationale, and require human approval for customer-impacting actions.

**Q: What makes GenAI system design different from normal system design?**  
A: Probabilistic outputs, prompt/context quality, hallucination, safety, evals, token cost, model latency, and changing model behavior over time.

