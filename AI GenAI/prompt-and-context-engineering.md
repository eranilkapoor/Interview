# Prompt and Context Engineering

Prompt engineering is designing instructions and examples to guide model behavior. Context engineering is broader: selecting, structuring, compressing, and injecting the right information into the model at the right time.

Modern interviews often go beyond zero-shot/few-shot definitions. Interviewers ask how you debug unreliable prompts, structure outputs, prevent prompt injection, evaluate prompt changes, and manage prompts in production.

## Techniques

- Clear role and task instruction
- Few-shot examples
- Structured output schemas
- Delimiters for context
- Step-by-step planning where appropriate
- Tool-use instructions
- Refusal rules
- Prompt versioning
- Context compression

## Interview Questions & Answers

**Q: What is few-shot prompting?**  
A: Providing examples in the prompt so the model follows the desired format or reasoning pattern.

**Q: How do you get reliable JSON output?**  
A: Use structured output features if available, define a schema, validate responses, retry with repair prompts, and keep examples simple.

**Q: How do you debug a bad prompt?**  
A: Inspect inputs, outputs, retrieved context, model parameters, ambiguity, missing constraints, and failure categories. Then change one variable at a time and evaluate on a test set.

**Q: What is prompt injection?**  
A: A malicious or accidental instruction in user or retrieved content that tries to override system instructions or leak data.

