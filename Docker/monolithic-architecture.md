# Monolithic Architecture

A monolith is an application built and deployed as a single unit: one codebase, one build artifact, one running process (or a small fixed set of identical replicas behind a load balancer), containing all the application's functionality — user-facing API, business logic, background jobs, and often the admin interface — in one place. Internally the code may well be organized into modules or layers with clean boundaries, but at the deployment and runtime level there is no separation: everything ships together, starts together, and runs in the same process space.

That single-process nature is what makes monoliths simpler in the early stages of a project. Calls between modules are ordinary in-process function calls, not network requests, so there's no serialization overhead, no need to handle partial failure of a downstream call, and no need for service discovery or an API gateway. Transactional consistency is comparatively easy — a single database transaction can span multiple "modules" of the monolith because they're really just different code paths sharing the same process and often the same database connection, whereas achieving equivalent consistency across microservices generally requires distributed transaction patterns like sagas. Debugging is also more tractable: a single stack trace shows you the full call path from HTTP handler to database call, with one set of logs, one process to attach a debugger to, and no need to correlate a request across service boundaries.

The costs show up as the application and the team grow. Because there is one deployable unit, any change — even a one-line fix to an unrelated module — requires rebuilding, testing, and redeploying the entire application, so release velocity is coupled across the whole team even when their changes don't logically overlap. Scaling is similarly all-or-nothing: if only the image-processing code path is under heavy load, you can't scale just that subsystem — you have to run more full copies of the entire monolith, wasting resources on the parts that weren't actually the bottleneck. Fault isolation is weak: an unhandled exception, memory leak, or resource exhaustion in one module runs in the same process as everything else, so it can take down or degrade the entire application rather than being contained to the failing feature. And as the codebase grows, onboarding gets harder — new engineers have to load a much larger mental model to make a safe change, module boundaries tend to erode over time without hard process/network boundaries enforcing them, and the whole application is generally locked into one language/runtime, making it harder to adopt a better-suited technology for one specific piece.

None of this means a monolith is the wrong choice by default — for a small team, or an early-stage product where the priority is iterating on product-market fit as fast as possible, a monolith is very often the *right* engineering decision. It avoids the very real operational overhead of microservices: no service mesh, no distributed tracing setup, no per-service CI/CD pipeline, no need to reason about network partitions and eventual consistency between services that used to just be one database transaction. This is the "monolith first" argument (popularized by Martin Fowler) — start with a well-modularized monolith, and only split out services once you have concrete evidence of where the scaling, team-ownership, or deployment-cadence pain actually is, rather than guessing at service boundaries before you understand the domain well enough to draw them correctly.

## Examples

```
# Typical monolith layout — one deployable, internally modular
myapp/
  src/
    users/         # module boundary enforced only by convention/imports
    orders/
    payments/
    inventory/
  package.json      # one dependency tree, one language/runtime for everything
  Dockerfile         # one image, one process type to build and deploy
```
Even with clean internal module folders, everything here ships as a single container image and a single process — there's no independent deploy or scale unit below the whole application.

```dockerfile
# A monolith's Dockerfile is typically simple: one build, one runtime process
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "src/server.js"]
```
Contrast this with a microservices setup, which would need a separate Dockerfile, image, and deployment pipeline per service — the monolith's simplicity here is a direct consequence of there being only one thing to build and run.

```yaml
# docker-compose.yml — scaling a monolith means running more identical copies
# of the WHOLE app, since there's no way to scale one subsystem independently
services:
  app:
    build: .
    ports:
      - "3000-3002:3000"
    deploy:
      replicas: 3        # three full copies of the entire application
  db:
    image: postgres:16
```
If only, say, the reporting endpoints inside `app` were under load, all three replicas still carry the full weight of every other module — there's no way to scale reporting alone without extracting it into its own deployable.

## Common Pitfalls / Gotchas

- Assuming "monolith" means poorly organized code — a monolith can be (and should be) internally modular with clean interfaces between packages; the term refers to the deployment unit, not the code quality or internal structure.
- Treating "monolith first" as permission to skip module boundaries entirely — if internal boundaries aren't enforced from the start, extracting a microservice later becomes far harder because responsibilities have silently bled across what were supposed to be separate modules.
- Redeploying the whole application for trivial, isolated changes and treating that cost as unavoidable — this is the real driver behind eventually splitting out a monolith, not "microservices are inherently better."
- Underestimating how much operational complexity microservices add (service discovery, distributed tracing, network retries/timeouts, data consistency across services) and switching away from a monolith before the team or scale actually justifies it.
- Sharing one database across all modules in a monolith without discipline can create implicit coupling between modules that looks decoupled in code but isn't in the schema — this is what makes eventual extraction into services painful if column/table dependencies were never tracked.

## Interview Questions & Answers

**Q: What are the concrete advantages of a monolith over microservices, beyond "it's simpler"?**
A: In-process function calls instead of network calls, which removes serialization overhead and eliminates a whole class of partial-failure handling. Easier transactional consistency, since one database transaction can span multiple modules directly. Simpler debugging, since a single stack trace and log stream covers the full request path. And far less operational overhead — one CI/CD pipeline, one deployment target, no service mesh or distributed tracing infrastructure needed.

**Q: What's the main scaling limitation of a monolith?**
A: You can only scale the entire application as one unit — if one subsystem (e.g. image processing) is the actual bottleneck, you still have to run more full replicas of everything, including parts that aren't under load, which wastes compute and doesn't let you tune resource allocation (CPU vs. memory-heavy instances, for example) per subsystem the way you could with independently deployed services.

**Q: What is the "monolith first" argument, and why might a senior engineer recommend it even for a project expected to eventually need microservices?**
A: It argues that you should start with a well-modularized monolith and only extract services once you have real, observed evidence of where scaling or team-ownership boundaries actually need to be — because drawing service boundaries correctly requires understanding the domain, and that understanding is usually incomplete at the start of a project. Splitting into microservices too early risks getting the boundaries wrong, which is far more expensive to fix across network-separated services than within a single codebase, and it adds distributed-systems operational overhead before the team has enough scale or org size to justify it.

**Q: How does fault isolation differ between a monolith and microservices?**
A: In a monolith, all modules run in the same process, so an unhandled exception, memory leak, or unbounded resource consumption in one module can degrade or crash the entire application, taking down unrelated functionality with it. In microservices, a crash in one service is contained to that service's process — other services keep running, though the calling services now need to handle that dependency being unavailable, which introduces its own complexity (timeouts, retries, circuit breakers) that a monolith never has to deal with.

**Q: If a team is small (say, 3-5 engineers) and pre-product-market-fit, would you recommend microservices or a monolith, and why?**
A: A monolith. At that team size, the primary constraint on progress is speed of iteration, not independent scalability or independent deployability across teams — microservices' main benefits (team-level deploy independence, per-service scaling, technology heterogeneity) don't pay off until you have enough team/traffic scale to need them, while their costs (distributed systems complexity, more infrastructure to operate, slower end-to-end debugging) apply immediately regardless of team size.

## Related Topics
- [microservice-architecture.md](./microservice-architecture.md)
- [docker-in-production.md](./docker-in-production.md)
- [docker-swarm-vs-kubernetes.md](./docker-swarm-vs-kubernetes.md)
- [dockerizing-applications.md](./dockerizing-applications.md)
- [docker-compose.md](./docker-compose.md)
