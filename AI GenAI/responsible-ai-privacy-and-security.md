# Responsible AI, Privacy, and Security

Responsible AI focuses on building AI systems that are fair, safe, explainable, privacy-aware, secure, and aligned with human values and business policies.

In enterprise interviews, security and privacy are central. Interviewers may ask about PII handling, prompt injection, data leakage, audit logs, model access, and regulatory concerns.

## Key Areas

- PII detection and redaction
- Consent and data minimization
- Access control
- Prompt injection defense
- Data leakage prevention
- Bias and fairness
- Toxicity and unsafe content
- Auditability
- Human-in-the-loop

## Interview Questions & Answers

**Q: How do you protect sensitive data in GenAI apps?**  
A: Minimize data sent to models, redact PII, enforce access control, use approved providers, encrypt data, log carefully, and avoid training on private data without consent.

**Q: What is prompt injection defense?**  
A: Treat user and retrieved content as untrusted, separate instructions from data, restrict tools, validate outputs, enforce policies outside the model, and monitor attacks.

**Q: What is human-in-the-loop?**  
A: A workflow where humans review, approve, or correct AI outputs, especially for high-risk decisions.

**Q: Why is auditability important?**  
A: Teams need to explain what input, context, prompt, model, and tool calls produced an output, especially in regulated or customer-impacting systems.

