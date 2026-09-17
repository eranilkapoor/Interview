# Features of Docker

Docker's headline features aren't marketing bullet points — each one maps to a specific underlying mechanism, and being able to name that mechanism is what separates a real answer from a memorized one. The core feature is **lightweight isolation**: rather than virtualizing hardware and booting a full guest OS per workload (the VM approach), Docker uses Linux **namespaces** to give each container its own isolated view of PIDs, network interfaces, mount points, hostname, and inter-process communication, and **cgroups** (control groups) to limit and account for the CPU, memory, and I/O a container's processes can consume. Because there's no guest kernel to boot and no hypervisor layer to traverse, containers start in milliseconds to low seconds and have near-native performance, at the cost of a slightly weaker isolation boundary than a VM (a container escape can potentially reach the shared host kernel; a VM escape has to break out of the hypervisor itself).

The second core mechanism is the **layered, union filesystem**. Every instruction in a Dockerfile (`RUN`, `COPY`, `ADD`) produces a new, immutable, content-addressed filesystem layer, and Docker stacks these layers using a union filesystem driver — OverlayFS on modern Linux — which presents them as a single merged view without actually copying data between layers. This has two practical payoffs: build caching (if a layer's inputs haven't changed, Docker reuses the cached layer instead of rebuilding it — this is why Dockerfiles put `COPY package.json` + `RUN npm install` *before* `COPY . .`, so dependency installation is cached separately from app code changes) and storage efficiency (multiple images sharing a common base layer, e.g. `node:22-alpine`, only store that base once on disk; a running container adds one thin writable layer on top via copy-on-write).

**Portability** is a direct consequence of the image format itself, not a separate feature — an image is a self-contained bundle of filesystem layers plus metadata (entrypoint, env, exposed ports) conforming to the OCI image spec, so the exact same image runs identically on a developer's laptop, a CI runner, and a production host, as long as they're all running a compatible kernel/architecture. This is also what the **Docker Hub / registry** ecosystem is built around: a registry is just a versioned, content-addressable store for images (identified by SHA256 digest, tagged with human-readable names), letting teams `push`/`pull` images the same way they'd push/pull code from Git.

Beyond a single container, Docker provides **Compose** for defining and running multi-container applications from one declarative YAML file (useful for local dev — e.g. an app plus its database plus a cache, all networked together with one `docker compose up`), and for production-scale orchestration across many hosts, **Swarm** (Docker's built-in, simpler orchestrator) or **Kubernetes** (the de facto standard, which itself runs containers via containerd/CRI, not via `dockerd` directly) handle scheduling, service discovery, rolling updates, and self-healing across a cluster.

## Examples

```bash
docker run -d --name limited-app \
  --memory="256m" --cpus="0.5" \
  nginx:alpine
docker stats limited-app --no-stream
# CONTAINER ID   NAME            CPU %     MEM USAGE / LIMIT     MEM %
# a1b2c3d4e5f6   limited-app     0.03%     3.6MiB / 256MiB       1.41%
```
`--memory` and `--cpus` are a direct CLI front-end for cgroups: the kernel enforces these limits, killing the container's process (OOM-kill) if it exceeds its memory cap, and throttling CPU time if it exceeds its share. `docker stats` reads the same cgroup accounting data back out.

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
# ---
FROM node:22-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["node", "server.js"]
```
This shows layer caching in action: as long as `package*.json` doesn't change, the `RUN npm ci` layer is reused across rebuilds even if application source code changes constantly, because Docker hashes each instruction's inputs and only invalidates layers (and everything after them) when those inputs change.

```yaml
# docker-compose.yml — one command brings up an app + its database
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://user:pass@db:5432/appdb
    depends_on:
      - db
  db:
    image: postgres:16-alpine
    volumes:
      - db-data:/var/lib/postgresql/data
volumes:
  db-data:
```
This demonstrates the multi-container orchestration feature: Compose creates a private network where `api` can reach `db` by service name (`db`), and a named volume so the database's data survives container restarts. `docker compose up` builds/pulls both, starts them in dependency order, and networks them together.

## Common Pitfalls / Gotchas

- Assuming layer caching is "free" regardless of Dockerfile order — putting `COPY . .` before dependency installation invalidates the cache on every source change, forcing a full `npm install`/`pip install` on every build.
- Not setting `--memory`/`--cpus` (or Compose `deploy.resources.limits`) in shared environments — an unbounded container can starve every other container on the same host for CPU or memory, since without cgroup limits it can consume as much as the kernel scheduler gives it.
- Believing images are fully portable across CPU architectures — an image built on arm64 (e.g. Apple Silicon) won't run on an amd64 host without a multi-arch manifest (`docker buildx build --platform`) or emulation (QEMU), and will fail with `exec format error`.
- Treating Compose as a production orchestrator — Compose is a local/single-host tool; it has no built-in rolling updates, health-based rescheduling across hosts, or multi-node scheduling the way Swarm or Kubernetes do.
- Not pruning old layers/images — because every build produces new immutable layers, `docker images`/`docker system df` can balloon in size over time; `docker system prune` (used carefully) reclaims that space.
- Confusing "OverlayFS presents a merged view" with "layers are merged/copied on disk" — layers stay physically separate and read-only; only the top writable layer changes, which is what makes sharing base layers across images cheap.

## Interview Questions & Answers

**Q: How does Docker achieve isolation without the overhead of a virtual machine?**
A: It uses two Linux kernel features instead of a hypervisor: namespaces, which give a process its own isolated view of PIDs, network interfaces, mounts, and hostname; and cgroups, which meter and cap the CPU, memory, and I/O that process can use. Because all containers share the one host kernel — there's no guest kernel to boot — containers start in milliseconds and have effectively native CPU/memory performance, at the cost of a weaker isolation boundary than a full VM.

**Q: Explain how Docker's layered filesystem makes builds faster.**
A: Each Dockerfile instruction produces an immutable, content-hashed layer. When you rebuild, Docker compares each instruction's inputs against the cache and reuses any layer whose inputs are unchanged, only rebuilding from the first changed layer onward. That's why the standard pattern is to copy dependency manifests and install dependencies *before* copying application source — source changes constantly, so putting it last means the expensive dependency-install layer stays cached across most builds.

**Q: What's the difference between Compose and Swarm/Kubernetes?**
A: Compose defines and runs a multi-container application on a single Docker host from a declarative YAML file — it's built for local development and simple deployments. Swarm and Kubernetes are cluster orchestrators: they schedule containers across many hosts, handle service discovery, load balancing, rolling updates, and automatically reschedule containers when a node fails. Compose has no concept of a multi-node cluster on its own, though `docker stack deploy` can consume a Compose-formatted file to deploy onto a Swarm cluster.

**Q: How would you prevent one noisy container from starving others on the same host?**
A: Set explicit cgroup-backed resource limits — `--memory` and `--cpus` on `docker run`, or the equivalent `deploy.resources.limits` block in Compose/Swarm. Without limits, a container can consume unbounded CPU and memory, and the kernel's OOM killer may end up killing an unrelated, well-behaved process on the host under memory pressure rather than the offending container specifically.

**Q: Why can the same Docker image run identically on a laptop, in CI, and in production?**
A: Because the image bundles the application together with its full runtime environment — filesystem layers, installed dependencies, environment variables, entrypoint — as a single immutable, content-addressed artifact conforming to the OCI image spec. As long as the host kernel and CPU architecture are compatible, running that image doesn't depend on anything installed on the host beyond the Docker/OCI runtime itself, eliminating the class of bugs caused by environment drift between machines.

## Related Topics
- [introduction-to-docker.md](./introduction-to-docker.md)
- [docker-vs-virtual-machines.md](./docker-vs-virtual-machines.md)
- [docker-compose.md](./docker-compose.md)
- [multi-stage-builds.md](./multi-stage-builds.md)
- [docker-swarm-vs-kubernetes.md](./docker-swarm-vs-kubernetes.md)
