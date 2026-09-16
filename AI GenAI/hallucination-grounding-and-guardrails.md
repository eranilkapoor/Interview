# Hallucination, Grounding, and Guardrails

Hallucination happens when an AI system produces unsupported, incorrect, or fabricated output. Grounding means tying the response to trusted sources or tool results. Guardrails are constraints and checks that keep outputs safe and aligned with policy.

You cannot eliminate hallucination completely, but you can reduce risk through retrieval, constraints, evaluation, verification, citations, and fallback behavior.

## Common Techniques

- RAG with trusted sources
- Citations
- Refusal rules
- Output validation
- Tool verification
- Structured schemas
- Safety classifiers
- Human review
- Confidence thresholds

## Interview Questions & Answers

**Q: How do you reduce hallucination in a GenAI application?**  
A: Use grounded context, retrieve from trusted data, require citations, validate outputs, lower randomness for factual tasks, add refusal behavior, and evaluate hallucination cases.

**Q: What is a guardrail?**  
A: A rule, model, validation step, or workflow control that prevents unsafe, invalid, or policy-violating behavior.

**Q: What is grounding?**  
A: Ensuring the model's answer is based on provided documents, database results, tool outputs, or verified sources.

**Q: What should the system do when context is missing?**  
A: It should say it does not have enough information, ask a clarifying question, or route to a human/source rather than inventing an answer.

