# Embeddings and Semantic Search

Embeddings convert text, images, or other data into numerical vectors that capture semantic meaning. Similar concepts should have vectors close to each other in vector space.

Semantic search uses embeddings to find content by meaning instead of exact keywords. It is the foundation of many RAG systems, recommendation systems, duplicate detection flows, clustering, and AI-powered search features.

## Typical Flow

1. Split documents into chunks.
2. Generate embeddings for each chunk.
3. Store vectors with metadata.
4. Embed the user query.
5. Retrieve nearest chunks.
6. Pass relevant chunks to the LLM.

## Interview Questions & Answers

**Q: What are embeddings?**  
A: Dense numerical representations of data that capture semantic meaning. Similar items should have similar vectors.

**Q: Why use embeddings instead of keyword search?**  
A: Embeddings can match meaning even when exact words differ. For example, "car insurance" can match "vehicle coverage."

**Q: What is cosine similarity?**  
A: A metric that measures the angle between vectors. It is commonly used to compare semantic similarity.

**Q: What makes embeddings bad for retrieval?**  
A: Poor chunking, wrong embedding model, missing metadata, noisy documents, domain mismatch, and lack of reranking.

