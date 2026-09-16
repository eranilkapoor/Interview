# RAG Architecture

Retrieval-Augmented Generation combines retrieval with generation. Instead of relying only on the model's internal knowledge, the system retrieves relevant external context and asks the LLM to answer using that context.

RAG is common because it improves grounding, supports private/company data, reduces hallucination, and avoids frequent fine-tuning when knowledge changes.

## RAG Pipeline

1. Document ingestion
2. Cleaning and normalization
3. Chunking
4. Embedding generation
5. Vector storage
6. Query embedding
7. Retrieval
8. Reranking
9. Prompt assembly
10. LLM response
11. Citation and evaluation

## Interview Questions & Answers

**Q: Design a RAG system for customer support.**  
A: Ingest support docs, FAQs, tickets, and policies; chunk and embed them; store vectors with metadata and permissions; retrieve top relevant chunks for user questions; rerank; build a grounded prompt; answer with citations; log feedback; evaluate for accuracy, hallucination, latency, and coverage.

**Q: RAG vs fine-tuning?**  
A: Use RAG for dynamic knowledge and grounding in external data. Use fine-tuning to change behavior, style, format, or domain task performance. They can be combined.

**Q: Why can RAG still hallucinate?**  
A: Retrieval may miss relevant context, context may be contradictory, prompt may allow unsupported claims, or the model may ignore evidence. Add better retrieval, reranking, citations, refusal rules, and evals.

**Q: How do you improve RAG quality?**  
A: Better chunking, metadata filters, hybrid search, query rewriting, reranking, domain-specific embeddings, citation checks, eval datasets, and human feedback loops.

