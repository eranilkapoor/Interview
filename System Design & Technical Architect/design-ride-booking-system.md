# Design Ride Booking System

Design a ride booking system like Uber or Ola.

## Requirements

- Rider requests ride
- Match nearby driver
- Track driver location
- Calculate fare
- Complete trip and payment
- Notifications

## High-Level Design

- Rider app
- Driver app
- API gateway
- Location service
- Matching service
- Trip service
- Pricing service
- Payment service
- Notification service

## Key Challenges

- Real-time driver location
- Geospatial search
- Matching algorithm
- Surge pricing
- Trip state consistency
- High availability

## Interview Q&A

**Q: How do you find nearby drivers?**  
A: Store driver locations in geospatial index/grid and query nearby cells based on rider location.

**Q: How do you track live location?**  
A: Drivers periodically send location updates. Store latest location in fast storage like Redis/geospatial index and stream updates to riders.

**Q: How do you avoid assigning one driver to multiple riders?**  
A: Use atomic state update or locking around driver assignment.

