# Microservice Architecture

A microservice architecture splits an application into a set of independently deployable services, each owning a narrow piece of business capability and communicating with the others over the network rather than through in-process function calls. Docker didn't invent this architectural style — it predates containers — but it removed most of the practical friction that used to make it painful: before containers, running "one service per deployable unit" meant either one process per physical/virtual machine (expensive, slow to provision) or carefully managing multiple services' conflicting dependencies on one shared host. Docker makes each service a self-contained image with its own dependencies, its own runtime, and its own lifecycle, so packaging, shipping, and running dozens of small services stops being materially harder than running one large one.

The core enabler is that each service becomes its own image and its own container (or set of container replicas): a `payments` service and a `notifications` service can be built from entirely different base images, different language runtimes, different dependency versions, with zero risk of one service's dependencies colliding with another's, because each container only sees what was explicitly put in its own image. This is what "polyglot" architecture means in practice — nothing stops the `recommendations` service from being written in Python with a machine-learning stack while `orders` is a Node/Express service and `payments` is a Java Spring service, because Docker's contract with each of them is identical (build an image, expose a port, run a container) regardless of what's inside. Service-to-service communication that would have been an in-process function call in a monolith becomes a network call instead — typically REST or gRPC over Docker's virtual network (containers on the same user-defined bridge network resolve each other by service/container name), which is fundamentally slower and less reliable than a function call: it can time out, the callee can be temporarily unreachable during a deploy, and it introduces serialization overhead that simply doesn't exist when two functions share a process.

The other major payoff is independence of deployment and scaling cadence. Each service has its own image, so it can be rebuilt, tested, and deployed on its own schedule without redeploying the rest of the system — a fix to `notifications` doesn't require rebuilding or restarting `orders`. Scaling follows the same logic: if `orders` is the traffic hotspot during a sale, you scale up only its container replica count (`docker service scale orders=10` under Swarm, or a Kubernetes Deployment/HPA), leaving `payments` and `notifications` at their normal replica counts — a monolith has no equivalent granularity, since scaling means running more copies of the entire application regardless of which part of it is actually under load.

None of this is free, and a balanced answer has to say so. Splitting a system into independently deployed, network-connected services trades one set of problems (a large, tightly coupled codebase, slower builds, one team's bug blocking everyone's deploy) for a different, genuinely harder set: distributed systems problems. Network calls fail in ways in-process calls don't (partial failure, timeouts, retries needing idempotency), services need a way to find each other at runtime (service discovery — DNS-based in Docker's default bridge/overlay networks, or a full service registry in larger deployments), debugging a request now means tracing it across multiple services and process boundaries (distributed tracing tools like Jaeger/OpenTelemetry become close to mandatory once you have more than a handful of services), and data consistency that used to be a single database transaction becomes a cross-service consistency problem (sagas, eventual consistency, outbox patterns) once each service owns its own data store. Managing the resulting fleet of containers — scheduling them across machines, restarting failed instances, routing traffic, rolling out updates without downtime — is itself enough work that it essentially requires an orchestrator like Kubernetes or Swarm once you're past a handful of services; Docker alone gets you the packaging and isolation, not the fleet management. The monolithic alternative isn't strictly worse, just differently shaped — simpler operationally, easier to reason about transactionally, and a legitimate default until a system's team size or scaling needs actually demand the split (see the fuller tradeoff discussion in monolithic-architecture.md).

## Examples

```yaml
# docker-compose.yml — a small microservice system, one container per service
services:
  orders:
    build: ./orders            # Node/Express
    ports: ["3000:3000"]
    environment:
      PAYMENTS_URL: http://payments:4000
    depends_on: [payments]

  payments:
    build: ./payments          # Java/Spring, unrelated runtime to orders
    ports: ["4000:4000"]

  notifications:
    build: ./notifications     # Python worker, consumes from a queue
    environment:
      QUEUE_URL: amqp://queue:5672
    depends_on: [queue]

  queue:
    image: rabbitmq:3-management-alpine
    ports: ["15672:15672"]
```
Three services, three different language runtimes, three independent images — `orders` reaches `payments` over HTTP using Compose's built-in service-name DNS (`http://payments:4000`), not an in-process call. Each service can be rebuilt and redeployed independently; changing `notifications`' Python code never requires touching or rebuilding the `orders` or `payments` images.

```bash
# Independent scaling: only the hot service gets more replicas (Swarm shown; same idea under k8s)
docker service scale myapp_orders=8 myapp_payments=2 myapp_notifications=1
docker service ls
# NAME                    REPLICAS
# myapp_orders             8/8
# myapp_payments           2/2
# myapp_notifications      1/1
```
This is the concrete payoff of splitting the app: `orders` gets 8 replicas to absorb a traffic spike while `payments` and `notifications`, which aren't under load, stay small — a monolith would have to scale the entire application as one unit to give `orders` more capacity.

```dockerfile
# payments/Dockerfile — a completely different runtime from orders' Node image,
# with zero conflict because each service only sees its own image's contents
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY target/payments-service.jar app.jar
EXPOSE 4000
CMD ["java", "-jar", "app.jar"]
```
Polyglot in practice: `payments` runs a JVM, `orders` runs Node, `notifications` runs Python — each Dockerfile only has to satisfy its own service's runtime needs, with no shared dependency tree to coordinate across teams.

## Common Pitfalls / Gotchas

- Splitting into microservices before there's an organizational reason to (multiple teams needing independent deploy cadence, or a genuine scaling hotspot) — the distributed-systems tax (network calls, service discovery, tracing, eventual consistency) is real cost paid immediately for a benefit that only materializes at a certain scale/team size.
- Treating a network call between two containers as if it were as reliable as a function call — it needs explicit timeout, retry, and failure-handling logic; a service that assumes its dependencies are always reachable will cascade-fail the first time one of them isn't.
- Giving each service its own database (the usual microservice recommendation) without a plan for cross-service data consistency — what used to be one ACID transaction across tables now needs a saga, an outbox pattern, or acceptance of eventual consistency.
- Running a dozen services with plain `docker run`/Compose in production and no orchestrator — Compose has no multi-host scheduling, rolling updates, or automatic rescheduling on node failure; a real microservice fleet at any real scale needs Swarm or (far more commonly today) Kubernetes.
- Underinvesting in observability — once a single user request fans out across several services, `docker logs` on one container stops being enough; distributed tracing and centralized log aggregation go from "nice to have" to close to mandatory.

## Interview Questions & Answers

**Q: How does Docker specifically make a microservice architecture more practical than it would be without containers?**
A: By making each service a self-contained, independently buildable and runnable unit with its own isolated dependencies. Before containers, running many small services meant either dedicating whole machines to each one (expensive, slow to provision) or fighting dependency conflicts between services sharing a host. Docker images bundle each service's exact runtime and dependencies, so services can use completely different languages and library versions with no collision risk, and can be built, shipped, and scaled independently as containers.

**Q: What's the main tradeoff a team accepts when moving from a monolith to microservices, in Docker terms?**
A: They trade a single, tightly-coupled but transactionally simple codebase for a distributed system of independently deployed containers communicating over the network. That buys independent deployment cadence and independent, targeted scaling per service, but it costs network reliability problems (timeouts, partial failures), the need for service discovery, harder debugging (a request now spans multiple services, usually requiring distributed tracing), and cross-service data consistency challenges that a single database transaction used to handle for free.

**Q: How would you scale just one hot service in a microservice deployment without touching the others?**
A: Since each service is its own image and its own set of container replicas, you scale that service's replica count independently — `docker service scale <service>=<n>` under Swarm, or adjusting a Kubernetes Deployment's replica count (manually or via a Horizontal Pod Autoscaler). The other services' containers are untouched, which is the concrete advantage over a monolith, where handling more load on one code path means running more copies of the entire application.

**Q: Why does a nontrivial microservice deployment usually need an orchestrator like Kubernetes rather than just Docker?**
A: Docker gives you the packaging and per-container isolation, but running many services reliably across multiple machines requires scheduling containers onto hosts, restarting failed ones, load-balancing traffic to healthy replicas, and rolling out updates without downtime — none of which plain `docker run` or Compose handles across a multi-host fleet. That's exactly the job an orchestrator does, which is why microservice architectures and container orchestrators tend to appear together in practice.

**Q: When would you recommend staying with a monolith instead of splitting into microservices?**
A: When the team is small enough that independent deploy cadence isn't a real bottleneck, the system doesn't have a specific component with dramatically different scaling needs than the rest, and the operational cost of distributed systems problems (network failures, service discovery, distributed tracing, cross-service consistency) would outweigh the benefit. A monolith is simpler to develop, test, and reason about transactionally, and remains a reasonable default until there's a concrete organizational or scaling reason to pay the microservices tax — see monolithic-architecture.md for the fuller tradeoff.

## Related Topics
- [monolithic-architecture.md](./monolithic-architecture.md)
- [docker-swarm-vs-kubernetes.md](./docker-swarm-vs-kubernetes.md)
- [docker-compose.md](./docker-compose.md)
- [networks.md](./networks.md)
- [docker-in-production.md](./docker-in-production.md)
- [dockerizing-applications.md](./dockerizing-applications.md)
