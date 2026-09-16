# API Design and Integration

API design defines how clients and services communicate. Good APIs are consistent, secure, versioned, observable, and easy to evolve.

## REST API Best Practices

- Resource-based URLs
- Correct HTTP methods
- Correct status codes
- Pagination and filtering
- Idempotency for retries
- Consistent error response format
- Authentication and authorization
- Rate limiting
- Versioning

## REST vs GraphQL vs gRPC

- **REST:** simple, cacheable, widely understood.
- **GraphQL:** flexible client-driven queries, useful for complex frontend needs.
- **gRPC:** high-performance service-to-service communication with strong contracts.

## Interview Q&A

**Q: How do you design idempotent APIs?**  
A: Use idempotency keys, safe retry behavior, unique request identifiers, and database constraints to avoid duplicate side effects.

**Q: How do you version APIs?**  
A: URI versioning, header versioning, or backward-compatible evolution. Prefer avoiding breaking changes when possible.

**Q: How do you secure APIs?**  
A: Authentication, authorization, input validation, HTTPS, rate limits, audit logs, and least-privilege service credentials.

