# Design Chat System

Design a real-time chat system for one-to-one and group messaging.

## Requirements

- Send and receive messages in real time.
- One-to-one and group chats.
- Online/offline delivery.
- Message history.
- Read receipts and typing indicators.

## High-Level Design

- Web/mobile clients
- WebSocket gateway
- Chat service
- Message store
- Presence service
- Notification service
- Queue/event broker

## Storage

- Messages can be stored in a NoSQL database optimized by conversation ID and timestamp.
- User and group metadata can be stored in SQL or document DB.
- Redis can track online presence.

## Interview Q&A

**Q: Why WebSockets?**  
A: They allow persistent bidirectional communication, which is useful for real-time messaging.

**Q: How do you deliver messages to offline users?**  
A: Store messages durably, mark delivery state, and send push notifications. When the user reconnects, sync missed messages.

**Q: How do you scale WebSocket connections?**  
A: Use multiple gateway nodes, sticky routing or shared pub/sub, connection registry, and horizontal scaling.

