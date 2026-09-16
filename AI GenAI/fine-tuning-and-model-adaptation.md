# Fine-Tuning and Model Adaptation

Fine-tuning adapts a model using additional training data. It can improve style, format, domain behavior, or task performance, but it is not the best answer for every problem.

Many interviewers ask when to use prompt engineering, RAG, fine-tuning, or a smaller custom model. Strong answers compare tradeoffs.

## Adaptation Options

- Prompt engineering
- Few-shot examples
- RAG
- Fine-tuning
- LoRA/adapters
- Distillation
- Preference tuning

## Interview Questions & Answers

**Q: When should you fine-tune instead of using RAG?**  
A: Fine-tune when you need consistent behavior, style, classification, structured output, or domain-specific task performance. Use RAG when the model needs fresh or private knowledge.

**Q: Can fine-tuning add new knowledge?**  
A: It can, but it is usually not ideal for frequently changing facts. RAG is better for dynamic knowledge because documents can be updated without retraining.

**Q: What data is needed for fine-tuning?**  
A: High-quality examples matching the desired task and output format. Bad or inconsistent data can make the model worse.

**Q: What are risks of fine-tuning?**  
A: Overfitting, data leakage, cost, evaluation gaps, harder rollback, and degraded general performance.

