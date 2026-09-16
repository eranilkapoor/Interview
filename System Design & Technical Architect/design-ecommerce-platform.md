# Design E-Commerce Platform

Design an e-commerce platform with catalog, cart, checkout, payment, inventory, and order management.

## Requirements

- Product browsing and search
- Cart management
- Checkout
- Payment
- Inventory reservation
- Order tracking
- Notifications

## High-Level Design

- Frontend
- API gateway
- Catalog service
- Search service
- Cart service
- Order service
- Payment service
- Inventory service
- Notification service
- Database, cache, queue, object storage

## Key Challenges

- Inventory consistency
- Payment idempotency
- Order state machine
- Search indexing
- Cart persistence
- Flash-sale traffic

## Interview Q&A

**Q: How do you avoid overselling inventory?**  
A: Use inventory reservation, atomic updates, database constraints, or distributed locking carefully. Keep reservation expiration.

**Q: How do you handle payment retries?**  
A: Use idempotency keys and store payment attempt state to prevent duplicate charges.

**Q: How do you scale product browsing?**  
A: CDN, cache, read replicas, search index, and denormalized catalog views.

