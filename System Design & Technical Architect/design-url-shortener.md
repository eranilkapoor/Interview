# Design URL Shortener

Design a service like bit.ly that converts long URLs into short aliases and redirects users.

## Requirements

- Create short URL for a long URL.
- Redirect short URL to long URL.
- Optional custom alias.
- Expiration support.
- Analytics like click count.

## APIs

```http
POST /shorten
GET /{code}
GET /analytics/{code}
```

## High-Level Design

- API gateway
- URL service
- Code generation service
- Database for mappings
- Cache for hot URLs
- Analytics event queue
- Analytics processor

## Data Model

- code
- long_url
- user_id
- created_at
- expires_at
- click_count

## Key Decisions

- Generate unique code using base62 ID or random string.
- Use Redis cache for popular redirects.
- Use queue for analytics to avoid slowing redirects.
- Use DB unique constraint on code.

## Interview Q&A

**Q: How do you avoid duplicate short codes?**  
A: Use a unique constraint and retry, or generate from a central sequence and encode with base62.

**Q: How do you make redirects fast?**  
A: Cache code-to-URL mappings, keep service stateless, use CDN/edge caching where safe, and optimize database index on code.

**Q: How do you track analytics without slowing redirects?**  
A: Publish click events asynchronously to a queue and process them separately.

