# Architecture Review Checklist

Use this checklist before presenting a design or reviewing someone else's architecture.

## Requirements

- Are functional requirements clear?
- Are non-functional requirements defined?
- Is scope clear?
- Are assumptions documented?

## Architecture

- Are components and responsibilities clear?
- Is data flow understandable?
- Are service boundaries justified?
- Are synchronous and asynchronous flows identified?

## Data

- Is the data model clear?
- Are indexes planned?
- Is consistency requirement defined?
- Are backup and restore plans included?

## Security

- Authentication and authorization
- Encryption in transit and at rest
- Secret management
- Rate limiting
- Audit logging
- Compliance needs

## Reliability

- Failure modes
- Retries and timeouts
- Circuit breakers
- Disaster recovery
- Health checks
- Rollback plan

## Observability

- Logs
- Metrics
- Traces
- Alerts
- Dashboards
- Runbooks

## Cost and Operations

- Cost drivers
- Scaling policy
- Deployment strategy
- Ownership
- Maintenance complexity

## Final Interview Summary

End every design answer by summarizing:

- What the system does.
- Why the architecture fits the requirements.
- The biggest tradeoffs.
- The first improvements you would make with more time.

