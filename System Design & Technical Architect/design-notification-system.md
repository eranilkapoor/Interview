# Design Notification System

Design a system that sends email, SMS, push, and in-app notifications.

## Requirements

- Multiple channels
- User preferences
- Templates
- Retry and failure handling
- Rate limiting
- Delivery tracking

## High-Level Design

- Notification API
- Preference service
- Template service
- Queue
- Channel workers
- Provider integrations
- Delivery log database

## Key Decisions

- Use async queues to decouple notification creation from delivery.
- Use provider fallback for critical notifications.
- Respect user preferences and opt-outs.
- Use idempotency to avoid duplicate sends.

## Interview Q&A

**Q: Why use queues?**  
A: Notification providers can be slow or fail. Queues smooth spikes, support retries, and keep user-facing APIs fast.

**Q: How do you avoid duplicate notifications?**  
A: Use idempotency keys, deduplication windows, and delivery status tracking.

**Q: How do you handle provider failure?**  
A: Retry with backoff, route to fallback provider, and send failed events to a dead-letter queue.

