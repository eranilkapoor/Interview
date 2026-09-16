# Design Payment System

Payment systems prioritize correctness, idempotency, security, auditability, and reliability.

## Requirements

- Initiate payment
- Confirm payment
- Handle retries
- Refund
- Webhook processing
- Audit trail

## High-Level Design

- Payment API
- Payment orchestration service
- Provider adapter
- Ledger
- Transaction database
- Webhook handler
- Queue
- Fraud/risk checks

## Key Principles

- Idempotency keys
- Immutable transaction records
- Strong audit logs
- Secure secret handling
- Webhook signature verification
- Reconciliation jobs

## Interview Q&A

**Q: Why is idempotency critical in payments?**  
A: Network retries can duplicate requests. Idempotency ensures the same request does not create multiple charges.

**Q: How do you handle payment provider webhooks?**  
A: Verify signature, store event, process idempotently, update transaction state, and retry failures safely.

**Q: Should payment status be updated synchronously?**  
A: Initial request may be synchronous, but final status often depends on async provider callbacks/webhooks.

