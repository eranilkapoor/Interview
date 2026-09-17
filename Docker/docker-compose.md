# Docker Compose

Docker Compose is a tool for defining and running multi-container applications from a single command. Instead of hand-writing a series of `docker run` commands with matching `--network` flags, volume paths, and environment variables for every service, you describe the whole stack — app, database, cache, message queue — in one `compose.yml` file, and Compose figures out build order, networking, and startup for you. It ships as a CLI plugin (`docker compose`, the modern V2 syntax written in Go and bundled with Docker Desktop and recent Docker Engine installs) replacing the older standalone Python `docker-compose` binary; both read the same file format, but `docker compose` (no hyphen) is what you should reach for today.

The core workflow is `docker compose up`, which builds (or pulls) images as needed, creates a dedicated bridge network for the project, creates any named volumes, and starts every defined service — by default in the foreground, streaming interleaved logs from all containers, or with `-d` to run detached. `docker compose down` tears it all back down — stopping and removing containers and the project's network (but *not* named volumes, unless you add `--volumes`). In between, `docker compose ps` shows the status of just this project's containers, and `docker compose logs -f <service>` tails a specific service's output the same way `docker logs -f` would for a single container.

Compose automatically namespaces everything it creates with a **project name** — by default the name of the directory containing the compose file (overridable with `-p` or `COMPOSE_PROJECT_NAME`) — which is how you can have multiple independent copies of the same stack (e.g., feature branches) running side by side without container-name or network collisions. Critically, Compose creates a default bridge network for the project and attaches every service to it, and within that network each service is reachable by other services using its **service name as a DNS hostname** — a `web` service can connect to `postgresql://db:5432` without knowing the database container's IP address, because Compose's embedded DNS resolves `db` to the right container. This is arguably the single most useful thing Compose gives you over raw `docker run`.

Compose files and Swarm are related but distinct: the same YAML schema (with some Swarm-specific keys like `deploy`) can be handed to `docker stack deploy -c compose.yml mystack` to run the same services as a Swarm service stack across a cluster, rather than as plain containers on one host. Compose itself, however, is strictly single-host — it has no concept of scheduling across multiple machines; that's what Swarm (or Kubernetes) adds on top of the same declarative file format.

## Examples

```bash
# Start a stack in the background, check its status, then tail one service's logs
docker compose up -d
docker compose ps
docker compose logs -f api

# Rebuild just one service's image and recreate only that container
docker compose up -d --build api

# Tear everything down, including named volumes (data loss for anything not backed up)
docker compose down --volumes
```

`up -d --build` is the common "I changed the Dockerfile or source, rebuild and restart just this service" loop during local development, without restarting unrelated containers like the database.

```bash
# Run multiple isolated copies of the same stack side by side using project names
docker compose -p myapp-feature-x up -d
docker compose -p myapp-feature-y up -d
docker compose -p myapp-feature-x down
```

Each `-p` value gets its own network and container namespace, so `myapp-feature-x_db_1` and `myapp-feature-y_db_1` can run concurrently on the same machine without port or name conflicts (assuming host ports differ), which is useful for testing multiple branches locally.

```bash
# Run a one-off command in the context of a service (its image, env, and network)
# without starting the whole stack or leaving a container behind
docker compose run --rm api npm run migrate

# Scale a stateless service to multiple replicas (only works for services without a fixed host port)
docker compose up -d --scale worker=3
```

`docker compose run` is distinct from `up`: it starts a *new*, one-off container for the given service (useful for migrations, one-off scripts, or debugging shells) rather than starting the service as defined for long-running operation, and `--rm` cleans it up afterward.

## Common Pitfalls / Gotchas

- Assuming services are reachable by container name from the host machine the same way they are from other containers — the service-name DNS resolution only works *inside* the Compose network, between containers; from the host you still connect via the published port on `localhost`.
- Running old standalone `docker-compose` (hyphenated, Python-based, now deprecated) alongside the new `docker compose` plugin and getting subtly different behavior or version support — stick to the plugin form.
- Forgetting that `docker compose down` does not remove named volumes by default, so a "fresh start" that's supposed to wipe the database silently doesn't, until you add `--volumes` (or `-v`).
- Not realizing `docker compose up` reuses existing containers if their config hasn't changed — after editing environment variables directly in a running container (not the compose file) and re-running `up`, your out-of-band changes get silently overwritten or ignored depending on what changed.
- Two different Compose projects on the same host trying to bind the same host port, since ports are a host-wide resource regardless of project name isolation.

## Interview Questions & Answers

**Q: How do containers in a Compose stack communicate with each other?**
A: Compose creates a default bridge network scoped to the project and attaches every service's container to it, and Compose's embedded DNS resolves each service's name to its container's IP on that network. So a service named `api` can reach the database simply by connecting to hostname `db` (its service name) on whatever port Postgres listens on inside the container — no manual `--link` flags or hardcoded IPs needed.

**Q: What's the difference between `docker compose up` and `docker compose run`?**
A: `up` starts (or recreates) every service defined in the file as long-running containers, matching what's declared. `run` starts a single, one-off container for one named service — useful for a database migration, a management command, or an interactive debugging shell — and by default doesn't start that service's normal dependencies' long-running siblings the same way, nor does it publish the service's normal ports unless you pass `--service-ports`. It's meant for ad hoc tasks, not for standing the stack up.

**Q: Does `docker compose down` delete my database data?**
A: Not by default. `down` stops and removes the containers and the project's network, but named volumes persist on disk and get reattached the next time you `docker compose up`. Data loss only happens if you explicitly add `--volumes`/`-v` to `down`, or if the data was only ever stored in the container's writable layer rather than a declared volume.

**Q: How does Docker Compose relate to Docker Swarm?**
A: They share the same Compose file schema (v3+), but Compose runs everything on a single Docker host with no cluster awareness, while `docker stack deploy -c compose.yml <stack>` takes that same file and deploys it as services across a Swarm cluster, using Swarm-specific keys under `deploy` (replicas, placement constraints, update policy) that plain `docker compose up` ignores. Compose is for local/single-host development; Swarm stacks are for multi-node orchestration using the same file format as a starting point.

**Q: You changed an environment variable in the compose file for one service. What does `docker compose up -d` actually do?**
A: Compose diffs the desired configuration against the running containers' configuration. For the service whose config changed, it stops and removes the old container and creates a new one with the updated environment — other, unchanged services are left running untouched. This selective recreation is why `up -d` is safe to re-run repeatedly during development instead of tearing down the whole stack each time.

## Related Topics
- [docker-compose-file.md](./docker-compose-file.md)
- [docker-swarm.md](./docker-swarm.md)
- [docker-commands.md](./docker-commands.md)
- [networks.md](./networks.md)
- [docker-swarm-vs-kubernetes.md](./docker-swarm-vs-kubernetes.md)
