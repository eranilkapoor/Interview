# Vector Databases

Vector databases store embeddings and support similarity search at scale. They are commonly used in RAG systems to retrieve relevant document chunks for a user query.

Examples include Pinecone, Weaviate, Milvus, Qdrant, Chroma, Redis vector search, Elasticsearch/OpenSearch vector search, and PostgreSQL with pgvector.

## Key Concepts

- Approximate nearest neighbor search
- Index types
- Metadata filtering
- Hybrid search
- Reranking
- Upserts and deletes
- Namespace/tenant isolation
- Vector dimensionality

## Interview Questions & Answers

**Q: Why do we need a vector database?**  
A: To store embeddings and retrieve semantically similar items efficiently at scale.

**Q: What is hybrid search?**  
A: Combining vector similarity search with keyword/BM25 search to improve recall and handle exact terms, product names, IDs, or rare words.

**Q: What is metadata filtering?**  
A: Filtering vectors by attributes such as tenant, document type, date, permissions, or region before or during retrieval.

**Q: What are vector DB production concerns?**  
A: Index freshness, deletes, tenant isolation, permissions, latency, recall, cost, backup, monitoring, and embedding version migration.

