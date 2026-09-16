# Tokens, Context Window, and Sampling

LLMs process text as tokens, not raw words. A token may be a word, part of a word, punctuation, or symbol. The context window is the maximum amount of input and output tokens the model can consider in one request.

Sampling controls how the model chooses the next token. The same model can behave more deterministic or more creative depending on parameters like temperature, top-p, max tokens, and penalties.

## Key Parameters

- **Temperature:** higher means more random/creative.
- **Top-p:** nucleus sampling; limits choices to likely token mass.
- **Max tokens:** output length limit.
- **Stop sequences:** tell the model when to stop.
- **Frequency/presence penalties:** reduce repetition.

## Interview Questions & Answers

**Q: What is a token?**  
A: A unit of text processed by an LLM. Tokens are created by a tokenizer and may represent full words, subwords, characters, punctuation, or spaces.

**Q: What happens when input exceeds the context window?**  
A: The model cannot attend to all content. You must summarize, chunk, retrieve relevant content, or use a model with a larger context window.

**Q: Temperature vs top-p?**  
A: Temperature changes randomness globally. Top-p restricts sampling to the smallest set of tokens whose cumulative probability reaches p.

**Q: How do you reduce hallucination using parameters?**  
A: Lower temperature can reduce randomness, but grounding, retrieval, evaluation, and constraints are more important than sampling alone.

