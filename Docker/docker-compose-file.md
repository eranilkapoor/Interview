# Docker Compose File

The `compose.yml` (historically `docker-compose.yml`) file is a declarative YAML schema for describing a multi-container application — what to run, how it's built, how it's configured, and how its pieces connect. This file is distinct from the `docker compose` *tool* covered in [docker-compose.md](./docker-compose.md): this page is about the file's schema and keys; that one is about the CLI workflow that reads it. The three top-level keys you'll see in almost every real file are `services` (the containers to run), `networks` (custom networks beyond the project's implicit default), and `volumes` (named volumes for persistent data), plus an optional `version` key that modern Compose largely ignores in favor of auto-detecting schema capabilities.

Each entry under `services` describes one container's desired state. `build` points at a Dockerfile (a path, or an object with `context`/`dockerfile`/`args` for more control) and tells Compose to build the image locally; `image` instead names a pre-built image to pull. You can specify both — `build` with `image` gives the built image that tag, useful for pushing it afterward. `ports` maps `"host:container"` pairs (e.g., `"3000:3000"`), while `expose` only documents a port to other containers on the same network without publishing it to the host. Environment configuration comes via `environment` (inline key-value pairs, directly in the file, visible to anyone with the file) or `env_file` (path to a `.env`-style file, kept out of version control, better for secrets during local development — though neither is a substitute for a real secrets manager in production).

`depends_on` controls startup *order*, not readiness — by default, Compose starts a container's dependencies and waits only until they've entered the "started" state (the process has been launched), not until the application inside is actually ready to accept connections. This trips people up constantly: an `api` service with `depends_on: [db]` can still start before Postgres has finished initializing and fail its first connection attempt. The fix is the extended form with a `condition`: `depends_on: db: condition: service_healthy`, combined with a `healthcheck` block on the `db` service (a `test` command, `interval`, `timeout`, and `retries`) — Compose then genuinely waits until the healthcheck reports healthy before starting the dependent service.

`volumes` at the service level maps host paths or named volumes into the container (`./data:/var/lib/postgresql/data` for a bind mount, or `db-data:/var/lib/postgresql/data` referencing a named volume declared in the top-level `volumes:` key) — named volumes are what you want for anything that must survive `docker compose down` and be managed by Docker rather than tied to a specific host path. `networks` at the service level attaches it to custom networks beyond Compose's implicit default, useful for isolating a database so only specific services can reach it. `restart` sets the restart policy (`no`, `always`, `on-failure`, `unless-stopped`) — `unless-stopped` is the common production default because it survives daemon restarts but respects an operator's explicit `docker stop`.

## Examples

```yaml
# compose.yml — a real three-service stack: app, database, and cache
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        NODE_ENV: production
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgres://app:secret@db:5432/appdb
      - REDIS_URL=redis://cache:6379
    depends_on:
      db:
        condition: service_healthy
      cache:
        condition: service_started
    restart: unless-stopped
    networks:
      - backend

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=app
      - POSTGRES_PASSWORD=secret
      - POSTGRES_DB=appdb
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - backend

  cache:
    image: redis:7-alpine
    networks:
      - backend

networks:
  backend:

volumes:
  db-data:
```

This is a realistic pattern: `api` genuinely waits for `db` to pass its healthcheck (not just "started"), Postgres data survives `docker compose down` because it lives in the named volume `db-data`, and all three services share a dedicated `backend` network rather than relying only on Compose's implicit default.

```yaml
# env_file keeps secrets out of the compose file itself
services:
  api:
    build: .
    env_file:
      - .env.production
    ports:
      - "3000:3000"
```

`.env.production` (added to `.gitignore`) holds the actual key-value pairs; the compose file only references it by path, so credentials never get committed alongside application config.

```yaml
# Multiple environments from one base file using an override file
# compose.yml (base) + compose.override.yml (auto-merged) or an explicit -f chain
services:
  api:
    build: .
    ports:
      - "3000:3000"
---
# compose.override.yml — applied automatically on top of compose.yml by `docker compose up`
services:
  api:
    volumes:
      - .:/app        # bind mount source for hot-reload in local dev only
    environment:
      - DEBUG=true
```

`docker compose up` automatically merges `compose.override.yml` on top of `compose.yml` if present, which is the standard pattern for keeping a clean base file and layering local-dev-only tweaks (like bind-mounting source for hot reload) without duplicating the whole file. For explicit environment-specific stacks, `docker compose -f compose.yml -f compose.prod.yml up` merges files in the order given.

## Common Pitfalls / Gotchas

- Relying on plain `depends_on` (without `condition: service_healthy`) to mean "wait until the dependency is actually ready" — it only waits until the container process has started, which for a database is well before it's accepting connections.
- Putting real secrets directly under `environment:` in a compose file that gets committed to git — use `env_file` pointed at a gitignored file, or better, a secrets manager, for anything beyond local dev placeholders.
- Confusing `ports` (publishes to the host, accessible from outside Docker) with `expose` (documents a port to other containers on the same network only, not reachable from the host) — many services don't need `ports` at all if only other containers in the stack talk to them.
- Using a bind mount (`./data:/var/lib/postgresql/data`) instead of a named volume for a database's data directory — it works, but ties the data to a specific host path and can hit permission/ownership mismatches between host and container users that named volumes avoid.
- Forgetting that `restart: always` will keep restarting a container even after an explicit `docker stop` once the Docker daemon itself restarts (e.g., after a host reboot) — `unless-stopped` is usually the safer intent.
- Expecting `docker compose down` to remove the named volumes declared under the top-level `volumes:` key — it doesn't, unless you pass `--volumes`.

## Interview Questions & Answers

**Q: Why doesn't `depends_on` alone guarantee my app won't fail to connect to the database on startup?**
A: `depends_on` in its short form only controls the *order* containers are started in — Compose waits for the dependency's container process to start, not for the application inside it to be ready to accept connections. A database container can report "started" the instant the Postgres binary launches, long before it's finished initialization and is listening for connections. To actually wait for readiness, you need the long form `depends_on: db: condition: service_healthy` paired with a `healthcheck` block defined on the `db` service.

**Q: What's the difference between `ports` and `expose` in a compose file?**
A: `ports` publishes a container port to the host machine (`"3000:3000"` makes the service reachable at `localhost:3000` from outside Docker entirely). `expose` only documents that a port is available to *other containers on the same Docker network* — it doesn't publish anything to the host. Services that are only ever called by other services in the same stack (like an internal cache) generally don't need `ports` at all.

**Q: When would you use a bind mount versus a named volume in a compose file?**
A: A bind mount (`./src:/app/src`) ties a container path directly to a specific host path — useful during local development for hot-reloading source code, since edits on the host are immediately visible inside the container. A named volume (`db-data:/var/lib/postgresql/data`) is managed by Docker itself, isn't tied to a particular host path, and is the right choice for data that needs to persist across container recreation (like a database's files) without depending on the host's directory layout, which also makes it portable across machines.

**Q: How does `env_file` differ from `environment` in a compose file, and why does it matter for secrets?**
A: `environment` sets variables inline, directly in the YAML — anyone who can read the compose file (and anyone who commits it to source control) sees the values. `env_file` instead references an external file (commonly `.env`) containing `KEY=value` pairs, which you keep out of version control via `.gitignore`. Functionally both end up as environment variables inside the container; the difference is entirely about where the values physically live and how easy they are to accidentally leak.

**Q: How would you run the same application with different configuration for local development versus a staging-like environment, without duplicating your whole compose file?**
A: Keep a base `compose.yml` with the shared, environment-agnostic configuration, and layer environment-specific overrides on top with either the auto-merged `compose.override.yml` (picked up automatically by `docker compose up`) for local-only tweaks, or explicit multiple `-f` flags (`docker compose -f compose.yml -f compose.staging.yml up`) for named environments. Compose deep-merges the files in the order given, so later files' values override earlier ones for matching keys.

## Related Topics
- [docker-compose.md](./docker-compose.md)
- [docker-file.md](./docker-file.md)
- [volumes.md](./volumes.md)
- [networks.md](./networks.md)
- [docker-swarm.md](./docker-swarm.md)
