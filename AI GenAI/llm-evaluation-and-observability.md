# LLM Evaluation and Observability

Evaluation is now one of the most important GenAI interview topics. LLM outputs are probabilistic, so production teams need systematic ways to measure quality, safety, groundedness, latency, cost, and user satisfaction.

Observability helps debug what happened: prompt, context, retrieved chunks, model, parameters, tool calls, response, latency, token usage, and user feedback.

## Evaluation Types

- Golden dataset evaluation
- Human evaluation
- LLM-as-judge
- Unit tests for prompts
- Retrieval evaluation
- A/B testing
- Regression testing
- Safety testing

## Metrics

- Answer correctness
- Groundedness
- Citation accuracy
- Retrieval recall
- Hallucination rate
- Refusal accuracy
- Latency
- Cost per request
- Token usage
- User satisfaction

## Interview Questions & Answers

**Q: How do you evaluate a RAG chatbot?**  
A: Evaluate retrieval recall, context relevance, answer correctness, groundedness, citation accuracy, refusal behavior, latency, and cost using a representative test set.

**Q: What is LLM-as-judge?**  
A: Using an LLM to grade outputs. It scales evaluation but needs rubrics, calibration, spot checks, and bias control.

**Q: Why are exact-match metrics often weak for GenAI?**  
A: Many valid answers can be worded differently. Use semantic, rubric-based, human, or task-specific metrics.

**Q: What should you log in production?**  
A: Prompt version, model, parameters, retrieved context IDs, tool calls, output, latency, token usage, errors, feedback, and safety flags, while respecting privacy.

