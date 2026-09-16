# LLM and Transformer Basics

Large Language Models are neural networks trained to predict and generate text. Most modern LLMs are based on the transformer architecture, which uses attention mechanisms to understand relationships between tokens in a sequence.

Transformers are powerful because self-attention lets the model weigh relevant parts of the input context when generating output. This makes them effective for summarization, question answering, coding, reasoning-like tasks, translation, and dialogue.

## Core Concepts

- Tokenization
- Embeddings
- Self-attention
- Multi-head attention
- Positional encoding
- Pretraining
- Instruction tuning
- RLHF or preference tuning
- Inference

## Interview Questions & Answers

**Q: What is self-attention?**  
A: Self-attention lets each token in a sequence attend to other tokens and compute contextual meaning. For example, it helps a model understand what "it" refers to in a sentence.

**Q: Why are transformers better than older RNN-style models for LLMs?**  
A: Transformers parallelize training better and handle long-range dependencies more effectively through attention, while RNNs process sequences step by step.

**Q: What is pretraining?**  
A: Pretraining is the initial phase where a model learns language patterns from massive datasets, usually through next-token prediction or related objectives.

**Q: What is instruction tuning?**  
A: Instruction tuning trains or adapts a model to follow human instructions better, making it more useful for chat, Q&A, and task completion.

