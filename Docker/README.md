# Docker Interview Preparation

This folder is a focused Docker interview-prep guide, built around 22 topic files. Each file follows the same structure: a real conceptual explanation of the topic, 2-3 working Dockerfile/CLI/docker-compose.yml examples, common pitfalls, a set of interview Q&A pairs, and links to closely related topics in this folder. The goal is depth over breadth — every file is written to survive a senior-level follow-up question ("why", "what breaks", "how would you debug it"), not just recite a definition.

## Table of Contents

### Fundamentals
- [Introduction to Docker](./introduction-to-docker.md) — what Docker is, the "works on my machine" problem, CLI/daemon/containerd/runc architecture
- [Features of Docker](./features-of-docker.md) — namespaces/cgroups isolation, layered filesystem, portability, the OCI image spec
- [Docker Components](./docker-components.md) — Docker Engine architecture in depth: dockerd, containerd, runc, Docker Desktop
- [Images and Containers](./images-and-containers.md) — the image (immutable template) vs container (running instance) distinction, copy-on-write
- [Docker vs Virtual Machines](./docker-vs-virtual-machines.md) — OS-level isolation vs hypervisor virtualization, overhead, boot time, security boundary

### Building Images
- [Docker File](./docker-file.md) — Dockerfile instruction syntax reference: FROM, RUN, COPY vs ADD, CMD vs ENTRYPOINT, ARG vs ENV
- [Dockerfile](./dockerfile.md) — Dockerfile best practices: layer caching, image size, build determinism, non-root images
- [Multi-Stage Builds](./multi-stage-builds.md) — building in one stage, shipping only the compiled artifact in a slim final stage
- [Dockerizing Applications](./dockerizing-applications.md) — a hands-on walkthrough containerizing a Node.js app from scratch

### Running and Connecting Containers
- [Docker Commands](./docker-commands.md) — CLI reference: run, ps, exec, logs, build, push/pull, inspect
- [Networks](./networks.md) — bridge, host, none, overlay, macvlan drivers, custom bridge DNS, `docker network` commands
- [Volumes](./volumes.md) — named volumes vs bind mounts vs tmpfs, volume drivers, data persistence

### Compose and Multi-Container Apps
- [Docker Compose](./docker-compose.md) — the Compose CLI/workflow: up, down, logs, service-name DNS resolution
- [Docker Compose File](./docker-compose-file.md) — the compose.yml schema: services, networks, volumes, depends_on, healthchecks

### Registries
- [Docker Hub](./docker-hub.md) — the public registry: official/verified images, tags, pull rate limits
- [Docker Registry](./docker-registry.md) — private/self-hosted registries, ECR/GCR/ACR, authentication

### Orchestration
- [Docker Swarm](./docker-swarm.md) — Swarm mode, services, stacks, manager/worker nodes, overlay networks
- [Docker Swarm vs Kubernetes](./docker-swarm-vs-kubernetes.md) — complexity, scaling, ecosystem, when to choose which

### Production and Security
- [Docker in Production](./docker-in-production.md) — health checks, resource limits, logging drivers, restart policies
- [Container Security](./container-security.md) — non-root users, minimal base images, image scanning, secrets management

### Architecture and Design
- [Microservice Architecture](./microservice-architecture.md) — how Docker enables independently deployable, independently scalable services
- [Monolithic Architecture](./monolithic-architecture.md) — the contrast case: when a single deployable unit is still the right call

## Interview Questions & Answers — Curated

**Beginner**

**Q: What is the difference between a Docker image and a Docker container?**
A: An image is an immutable, read-only, layered template — built once via `docker build` and identified by a content hash. A container is a running (or stopped) instance created from an image, with its own thin writable layer on top and its own process/network namespace. Many independent containers can be started from one image, the same way many processes can run from one executable file.

**Q: Why do containers start so much faster than virtual machines?**
A: Containers don't boot a guest operating system — all containers on a host share the one host kernel, and isolation comes from Linux namespaces (isolated view of PIDs, network, mounts) and cgroups (resource limits), not a hypervisor. A VM has to boot an entire guest kernel and OS before your application even starts.

**Q: What does the `EXPOSE` instruction in a Dockerfile actually do?**
A: Nothing at runtime — it's purely documentation/metadata recorded in the image, telling humans and tools which port the containerized process listens on. The port still has to be explicitly published with `docker run -p` or a Compose `ports:` entry to be reachable from outside the container's network.

**Q: What's the difference between `COPY` and `ADD`?**
A: `COPY` does a plain, predictable copy from the build context into the image. `ADD` does that too, but also auto-extracts local tar archives and can fetch remote URLs directly — behavior that's rarely what you actually want, which is why `COPY` is the recommended default.

**Q: What happens if the main process in a container exits?**
A: The container stops immediately, even if other background processes were started inside it. A container's lifecycle is tied to its PID 1 process, not to "is anything running inside it" — this is different from a VM, which keeps running as long as its OS is up.

**Intermediate**

**Q: Why does Dockerfile instruction order affect build speed?**
A: Docker's build cache is layer-by-layer and sequential: each instruction is hashed together with its inputs, and the first layer whose inputs changed invalidates every layer after it. Putting dependency manifests and install steps before application source code means routine source changes don't force a full dependency reinstall on every build.

**Q: Explain how `CMD` and `ENTRYPOINT` interact.**
A: `ENTRYPOINT` is the fixed executable that always runs; `CMD` supplies its default arguments (or is the entire command if there's no `ENTRYPOINT`). Anything passed after the image name on `docker run` replaces `CMD`, not `ENTRYPOINT` — it gets appended as arguments to the entrypoint instead. This lets base images like `postgres` fix their setup logic in `ENTRYPOINT` while letting users override just the trailing command.

**Q: Named volume, bind mount, or tmpfs — how do you choose?**
A: Named volumes for data that needs to persist and be managed by Docker (databases) — they're portable and can use pluggable storage drivers. Bind mounts for tying a container to an arbitrary host path, most commonly live-reloading local source code during development. tmpfs for data that should never touch disk at all, such as short-lived secrets.

**Q: Why is `depends_on` in a Compose file not sufficient to guarantee a dependency is ready?**
A: `depends_on` only waits for the dependency's container to *start*, not for the service inside it to actually be ready to accept connections (a database container can be "running" seconds before Postgres itself accepts connections). Combining `depends_on` with a `healthcheck` and a `condition: service_healthy` closes that gap.

**Q: What's the real difference between the default bridge network and a user-defined bridge network?**
A: Both isolate containers into their own network namespace on a private subnet, but the default bridge network does not provide automatic DNS-based service discovery between containers — you'd have to link containers manually or use IPs. A user-defined bridge network gives every attached container automatic DNS resolution by container/service name, which is why Compose always creates one per project instead of using the default bridge.

**Advanced**

**Q: Walk through how a multi-stage build reduces final image size, concretely.**
A: Each `FROM` starts a new, independent stage with its own filesystem; earlier stages (with full compilers, dev dependencies, build tools) are used only during the build and are not included in the final image unless explicitly copied forward. `COPY --from=<stage>` pulls just the compiled artifact (a binary, a bundled `dist/` folder) into a minimal final stage — so the shipped image contains the runtime and the artifact, not the toolchain that produced it.

**Q: Why can `ARG` values still leak secrets even though they're not present in the final image's runtime environment?**
A: `ARG` values are recorded in the image's build history and layer cache metadata — `docker history --no-trunc` (or inspecting cached layers) can reveal them even though they don't appear in a running container's environment variables. Real secrets should be injected via `docker run -e` from a secure source, Docker/Swarm secrets, or BuildKit's `--secret` mount, none of which persist the value into a layer.

**Q: When would you choose Docker Swarm over Kubernetes today, if at all?**
A: When the team is small, already deep in Docker tooling, has modest scaling/scheduling needs, and wants to avoid Kubernetes's much larger operational surface (etcd, control plane components, CRDs, a steeper learning curve). Swarm's ecosystem and community adoption have shrunk significantly industry-wide, so the honest tradeoff is operational simplicity now versus a smaller hiring pool and ecosystem later if the project grows.

**Q: How does Docker's container-escape risk differ from a VM's escape risk, and what does that imply for multi-tenant workloads?**
A: A container escape can potentially reach the shared host kernel directly, since all containers on a host run under one kernel with namespace/cgroup fencing rather than full hardware virtualization; a VM escape has to break out of the hypervisor's much stronger, hardware-assisted isolation boundary first. For strongly multi-tenant or untrusted workloads, this is why VMs (or gVisor/Kata-style sandboxed runtimes on top of containers) are still preferred over bare containers.

**Q: What's the actual mechanism that lets Docker share a base image's layers across many unrelated images, and why does that matter operationally?**
A: Every Dockerfile instruction produces an immutable, content-addressed filesystem layer, and the union filesystem (OverlayFS on Linux) presents a stack of layers as one merged view without copying data between them. If two images both start `FROM node:22-alpine`, that base layer is stored once on disk and referenced by both — so pulling a second image that shares a base with one you already have only downloads the new layers, and disk usage doesn't scale linearly with the number of images sharing a common ancestor.

## How to Use This Folder

Start with the Fundamentals group so the architecture (image vs container, namespaces/cgroups, the CLI-to-runc chain) is solid before the rest — nearly every other file assumes it. From there, read topics in pairs that reinforce each other (`docker-file.md` with `dockerfile.md`, `docker-compose.md` with `docker-compose-file.md`, `docker-hub.md` with `docker-registry.md`, `microservice-architecture.md` with `monolithic-architecture.md`). For each topic, practice giving a short spoken answer that hits: what problem it solves, a concrete example, the main tradeoff, and how you'd debug it under pressure — that's the shape senior interview answers tend to take, and it's the same shape each file's Interview Questions & Answers section models.
