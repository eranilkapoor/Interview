# Docker in Production

Running a container locally with `docker run` is a completely different problem from running one in production, because a single `docker run` gives you no automatic recovery, no visibility into whether the process inside is actually healthy versus merely alive, no bound on how much host memory or CPU it can consume, and no coordination across multiple hosts. Production hardening starts with closing those individual gaps at the container level — health checks, resource limits, logging, and restart policies — and ends with recognizing that a single Docker host, however well configured, cannot give you rolling deployments, self-healing across node failures, or scheduling across a fleet, which is the point at which you hand off to an orchestrator.

Docker's `HEALTHCHECK` instruction lets the container declare its own liveness probe: a command the daemon runs periodically inside the container, whose exit code (0 = healthy, 1 = unhealthy) is exposed via `docker ps` and `docker inspect`. This matters because a process can be running (PID 1 alive) while being completely unable to serve traffic — deadlocked, out of DB connections, stuck in an infinite GC pause — and `docker run` alone has no way to distinguish "running" from "working." Compose exposes the same idea via a service's `healthcheck` key, and additionally lets `depends_on` wait for a dependency to report healthy before starting a dependent service. The liveness/readiness distinction, borrowed from and made explicit in Kubernetes, matters conceptually even in plain Docker: a *liveness* check answers "should this be restarted because it's stuck," while a *readiness* check answers "should this currently receive traffic" — plain Docker only really gives you the liveness half through `HEALTHCHECK`; readiness-aware traffic routing is something orchestrators or load balancers layer on top.

Left unconstrained, a container can consume all memory and CPU on its host, starving neighbors or the host OS itself. `--memory` sets a hard cap; if the container's total RSS exceeds it, the Linux kernel's OOM killer terminates a process inside the container (typically PID 1, killing the whole container) rather than letting it exceed the cgroup limit — this shows up as exit code 137 and an `OOMKilled: true` flag in `docker inspect`. `--memory-swap` controls the *combined* memory+swap ceiling (setting it equal to `--memory` disables swap for the container entirely, which is usually what you want in production so a memory leak fails fast via OOM-kill rather than degrading performance by swapping). `--cpus` caps how much CPU time the container's cgroup can use (e.g., `--cpus=1.5` limits it to 1.5 cores' worth of scheduling), which prevents one noisy container from starving others on a shared host but doesn't reserve capacity the way a scheduler's resource *requests* do.

By default, container stdout/stderr go to the `json-file` logging driver, which writes to a file on the host with **no rotation** unless configured — left alone, a chatty container will eventually fill the host's disk. Setting `max-size` and `max-file` on the `json-file` driver caps individual log file size and how many rotated files are kept. Production setups more commonly ship logs off-host entirely via a different driver — `syslog` to forward to a syslog daemon, `awslogs` to stream directly to CloudWatch Logs, or `fluentd`/`gelf` to feed a centralized aggregation pipeline (ELK, Loki, Datadog) — since relying on logs sitting on an ephemeral container host is incompatible with hosts that get replaced or containers that get rescheduled elsewhere. Restart policies (`--restart`) close the last local-recovery gap: `no` (default, never restart), `on-failure[:max-retries]` (restart only on non-zero exit, optionally capped), `always` (restart unconditionally, even after a manual `docker stop` followed by daemon restart), and `unless-stopped` (like `always`, but respects an explicit manual stop across daemon restarts) — `unless-stopped` is the common production default for long-running services since it self-heals from crashes without fighting an operator's intentional stop.

Even with all of the above configured correctly, a single Docker host is still a single point of failure and a single scheduling domain: there's no rolling update primitive (deploying a new version means manually stopping and starting containers, with an availability gap unless you script something), no rescheduling if the host itself dies, and no way to spread replicas across multiple machines for capacity or fault tolerance. That gap — multi-node scheduling, rolling/canary updates with automatic rollback, self-healing by rescheduling failed containers elsewhere, and cluster-wide service discovery — is exactly what orchestrators (Docker Swarm, Kubernetes) exist to solve, which is why "production Docker" beyond a single small service almost always means Docker containers running under one of those, not raw `docker run`.

## Examples

```dockerfile
# HEALTHCHECK in a Dockerfile: probe an HTTP endpoint every 30s
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci --omit=dev
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1
CMD ["node", "server.js"]
```

`--start-period` gives the app a grace window on startup before failed checks count against `--retries`; after 3 consecutive failures the container is marked `unhealthy` in `docker ps`, though Docker itself won't restart it automatically — an external supervisor or orchestrator has to act on that status.

```yaml
# docker-compose.yml: resource limits, logging, restart policy, and healthcheck together
services:
  api:
    build: .
    ports:
      - "3000:3000"
    deploy:
      resources:
        limits:
          cpus: "1.5"
          memory: 512M
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/healthz"]
      interval: 30s
      timeout: 3s
      retries: 3
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    restart: unless-stopped
```

`deploy.resources.limits` is honored by `docker compose up` for plain Compose (as CPU/memory caps translated to the underlying `docker run` flags) and is also the same schema Swarm reads when this file is deployed as a stack; `max-size`/`max-file` bound total on-disk log growth to roughly 30MB for this service.

```bash
# Equivalent constraints applied directly via docker run
docker run -d \
  --name api \
  --memory=512m --memory-swap=512m --cpus=1.5 \
  --restart=unless-stopped \
  --log-driver=awslogs \
  --log-opt awslogs-region=us-east-1 \
  --log-opt awslogs-group=/prod/api \
  my-api:1.4.0
```

Setting `--memory-swap` equal to `--memory` disables swap for this container, so a memory leak triggers an OOM-kill (fast, visible failure) instead of silently degrading performance via swapping; logs stream straight to CloudWatch instead of accumulating in a local JSON file.

## Common Pitfalls / Gotchas

- Never setting `max-size`/`max-file` on `json-file` logging and having a verbose container quietly fill the host's disk over weeks, eventually taking down every other container on that host too.
- Confusing "container is running" with "container is healthy" — without a `HEALTHCHECK`, a hung process behind a dead HTTP server looks identical to a working one from `docker ps`.
- Setting `--memory` without also setting `--memory-swap`, so the container can still balloon past the intended cap by swapping instead of getting OOM-killed, degrading host performance instead of failing fast.
- Using `--restart=always` for a job you expect to run once and exit — it will restart forever, including after a deliberate `docker stop`, unless you use `unless-stopped` (which respects manual stops) or `on-failure` instead.
- Treating `docker run` restart policies as equivalent to orchestrator self-healing — a restart policy only recovers a container on the *same host*; if the host itself goes down, nothing brings the container back until someone intervenes, which is the core reason single-host Docker doesn't scale to real production availability requirements.

## Interview Questions & Answers

**Q: What does the `HEALTHCHECK` instruction actually give you that a running process doesn't already guarantee?**
A: It distinguishes "the process is alive" from "the process is actually able to do its job." A container can have a running PID 1 while its HTTP server is deadlocked or its DB connection pool is exhausted; `HEALTHCHECK` runs a real probe command on an interval and exposes `healthy`/`unhealthy`/`starting` status via `docker ps`/`docker inspect`, which downstream tooling (load balancers, orchestrators, monitoring) can act on — plain Docker itself won't auto-restart on `unhealthy`, but Swarm and Kubernetes will reschedule based on it.

**Q: A container keeps getting killed with exit code 137. What's happening?**
A: 137 is 128 + 9, i.e., the container's main process received SIGKILL — almost always because it hit its `--memory` cgroup limit and the kernel's OOM killer terminated it. `docker inspect` on the container will show `OOMKilled: true` in that case. The fix is either raising the memory limit if the workload genuinely needs it, or finding and fixing a memory leak if it doesn't.

**Q: What's the difference between `--restart=always` and `--restart=unless-stopped`?**
A: Both restart the container automatically on crash and on daemon/host reboot. The difference is manual intervention: with `always`, even an explicit `docker stop` gets undone the next time the Docker daemon restarts (the container comes back up); with `unless-stopped`, a manual stop is remembered and respected across daemon restarts — the container stays stopped until someone explicitly starts it again. `unless-stopped` is the more common production default for exactly this reason.

**Q: Why shouldn't you just rely on the default `json-file` logging driver in production?**
A: Two reasons: by default it doesn't rotate, so logs can grow unbounded and fill host disk unless you explicitly set `max-size`/`max-file`; and even rotated, the logs only live on that one host's disk, which doesn't survive the container being rescheduled elsewhere or the host being replaced. Production setups typically ship logs to a centralized destination — `awslogs` to CloudWatch, `fluentd`/`gelf` into an aggregation pipeline, or `syslog` — so logs outlive and are decoupled from any single container instance.

**Q: You've got health checks, resource limits, logging, and restart policies all correctly configured on a single Docker host. Why isn't that "production-ready" at scale?**
A: All of those mechanisms are scoped to a single host — a restart policy can't help you if the host itself dies, there's no way to roll out a new version without an availability gap because there's no built-in rolling-update primitive, and there's no way to spread load or replicas across multiple machines. That's precisely the gap orchestrators close: Swarm or Kubernetes add multi-node scheduling, automated rolling updates with rollback, and rescheduling of containers away from failed nodes, none of which raw `docker run`/Compose on one host can provide.

## Related Topics

- [docker-swarm.md](./docker-swarm.md)
- [docker-compose.md](./docker-compose.md)
- [docker-compose-file.md](./docker-compose-file.md)
- [container-security.md](./container-security.md)
- [docker-registry.md](./docker-registry.md)
- [docker-swarm-vs-kubernetes.md](./docker-swarm-vs-kubernetes.md)
