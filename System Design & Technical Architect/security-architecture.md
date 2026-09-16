# Security Architecture

Security architecture ensures systems protect identity, data, infrastructure, APIs, and operations. In architect interviews, security must be part of the design, not an afterthought.

## Core Areas

- Authentication
- Authorization
- Encryption in transit
- Encryption at rest
- Secret management
- Network segmentation
- Input validation
- Rate limiting
- Audit logging
- Vulnerability management
- Compliance

## Interview Q&A

**Q: Authentication vs authorization?**  
A: Authentication verifies identity. Authorization decides what the verified identity can access.

**Q: How do you store passwords?**  
A: Use strong one-way hashing like bcrypt, scrypt, or Argon2 with salt. Never store plain text passwords or reversible encrypted passwords.

**Q: How do you secure service-to-service communication?**  
A: Use mTLS or signed tokens, least-privilege service accounts, network policies, secret rotation, and audit logs.

