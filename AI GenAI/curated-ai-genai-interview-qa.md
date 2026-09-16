# Curated AI GenAI Interview Q&A

## Beginner

**Q: What is an LLM?**  
A: A Large Language Model is a model trained on large text/code datasets to understand and generate language by predicting tokens.

**Q: What is a prompt?**  
A: The instruction and context sent to a model to guide its output.

**Q: What is RAG?**  
A: Retrieval-Augmented Generation retrieves external knowledge and gives it to the LLM so answers can be grounded in relevant sources.

**Q: What are embeddings?**  
A: Numerical vectors that represent semantic meaning of text or other data.

## Intermediate

**Q: How do you choose between RAG and fine-tuning?**  
A: Use RAG for fresh/private knowledge and citation-grounded answers. Use fine-tuning for behavior, style, format, or repeated task performance.

**Q: How do you evaluate a GenAI feature?**  
A: Use representative test cases, human review, LLM-as-judge with rubric, retrieval metrics, hallucination checks, latency/cost tracking, and production feedback.

**Q: How do you reduce latency in an LLM app?**  
A: Use smaller/faster models, reduce context size, cache, stream output, optimize retrieval, parallelize tool calls, and avoid unnecessary agent loops.

**Q: How do you handle sensitive data?**  
A: Redact/minimize PII, enforce access control, use approved providers, encrypt data, avoid logging sensitive prompts, and maintain audit trails.

## Advanced

**Q: A RAG bot gives wrong answers even though documents exist. How do you debug?**  
A: Check chunking, embedding quality, query rewriting, vector search recall, metadata filters, reranker output, prompt assembly, context ordering, citation logic, and eval examples.

**Q: An agent keeps calling the same tool in a loop. What do you do?**  
A: Add step limits, tool-call budgets, better stopping criteria, state tracking, tool result summaries, loop detection, and fallback/human escalation.

**Q: How do you prevent prompt injection in RAG?**  
A: Treat retrieved text as data, not instruction; isolate system prompts; restrict tool permissions; validate actions outside the model; use allowlists; monitor attacks; and avoid exposing secrets.

**Q: How do you design evals for subjective tasks like summarization?**  
A: Define a rubric: factual accuracy, coverage, conciseness, tone, format, and safety. Use human-labeled examples, LLM-as-judge with calibration, and regression tests.

**Q: How would you build a production GenAI assistant?**  
A: Define tasks, data permissions, RAG/tool strategy, prompt versions, model routing, guardrails, evals, observability, cost controls, feedback loop, fallback behavior, and rollout plan.

## Architect-Level

**Q: What are the main risks in GenAI architecture?**  
A: Hallucination, data leakage, prompt injection, high cost, latency, vendor dependency, poor evaluation, unsafe automation, and lack of observability.

**Q: How do you explain GenAI ROI to stakeholders?**  
A: Tie the use case to measurable outcomes: reduced handling time, improved search accuracy, faster document processing, better support deflection, developer productivity, or lower operational cost.

**Q: What should be human-approved in AI workflows?**  
A: High-risk actions: payments, legal/medical advice, account changes, destructive operations, customer commitments, and decisions affecting rights or compliance.

