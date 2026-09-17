# Dockerizing Applications

"Dockerizing" an application means taking something that currently only runs because of manual setup on your machine — a specific Node version, `npm install` run at some point, a `.env` file nobody versioned — and turning it into a self-contained image that runs identically anywhere Docker runs. The process is mechanical once you've done it a few times, but the order of operations matters: which files you copy first determines how much of the build gets cached and reused, and what you exclude from the build context determines both image size and whether you accidentally bake secrets or host-specific artifacts into the image.

Start from a real, minimal Node app: a `package.json` declaring dependencies and a start script, and a `server.js` that boots an HTTP server. Nothing about dockerizing it requires rewriting the app — the Dockerfile wraps the existing app, it doesn't replace it.

```json
// package.json
{
  "name": "todo-api",
  "version": "1.0.0",
  "scripts": { "start": "node server.js" },
  "dependencies": { "express": "^4.19.2" }
}
```

```js
// server.js
const express = require('express');
const app = express();
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.listen(3000, () => console.log('listening on 3000'));
```

The Dockerfile itself follows a deliberate order: pick a small, pinned base image, set a working directory, copy *only* the dependency manifests and install first, then copy the rest of the source, then declare the port and startup command. Copying `package*.json` before the rest of the source is the single most important habit here — Docker caches each layer keyed on its instruction's inputs, so as long as `package.json`/`package-lock.json` haven't changed, `RUN npm ci` is skipped entirely on rebuilds even when application code changes constantly, which is by far the most common case during active development.

```dockerfile
# Dockerfile
FROM node:22-alpine
WORKDIR /app

# Dependency layer — cached independently of source changes
COPY package*.json ./
RUN npm ci --omit=dev

# Source layer — changes here don't invalidate the dependency layer above
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
```

Before building, add a `.dockerignore` so the build context — everything sent to the Docker daemon when you run `docker build .` — doesn't include things that shouldn't be in the image or even touched during the build: `node_modules` (it gets installed fresh inside the image against the image's own platform/architecture, so a host-installed copy is both useless and a cache-buster), `.git` (bloats the context for no runtime benefit), and `.env` (local secrets that must never be baked into a shared image layer).

```
# .dockerignore
node_modules
.git
.env
npm-debug.log
Dockerfile
.dockerignore
```

Build and run it, mapping a host port to the container's port so it's reachable from outside:

```bash
docker build -t todo-api:1.0 .
docker run -d --name todo-api -p 3000:3000 todo-api:1.0
curl http://localhost:3000/health
# {"status":"ok"}
```

Now add a database. The moment the app needs a second process to run alongside it, a single `docker run` stops being convenient — you'd have to manually create a network, start the database container on it, and pass connection details as environment variables by hand. This is exactly the problem Compose solves: describe both services declaratively, and `docker compose up` builds/pulls, networks, and starts them together in dependency order.

```yaml
# docker-compose.yml
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://appuser:apppass@db:5432/appdb
    depends_on:
      - db
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: appuser
      POSTGRES_PASSWORD: apppass
      POSTGRES_DB: appdb
    volumes:
      - db-data:/var/lib/postgresql/data

volumes:
  db-data:
```

`docker compose up` builds the `api` image from the local Dockerfile, pulls `postgres:16-alpine`, creates a private network where `api` can reach the database simply by the service name `db` (Compose's built-in DNS resolves service names within the project's network), and mounts a named volume so `db-data` survives container restarts and recreations. Nothing about `server.js` needed to hardcode a host or port for Postgres — that's exactly why the connection string is injected via `DATABASE_URL` rather than baked into the image.

## Examples

```bash
# Full local dev loop once Compose is in place
docker compose up --build      # rebuild api's image if the Dockerfile/source changed, then start both services
docker compose logs -f api     # tail just the api service's logs
docker compose exec api sh     # shell into the running api container
docker compose down            # stop and remove containers + network (add -v to also drop the named volume)
```
This is the everyday workflow once an app is dockerized with a database dependency: one command to bring the whole stack up, standard `docker compose` subcommands to introspect running services instead of juggling raw container IDs.

```dockerfile
# Tightening the image: pin the base image digest and drop to a non-root user
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN addgroup -S app && adduser -S app -G app
USER app
EXPOSE 3000
CMD ["npm", "start"]
```
Beyond the basic caching pattern, a production-minded Dockerfile also avoids running the app as root inside the container — `USER app` switches the process to an unprivileged user before `CMD` runs, so a container-escape or dependency vulnerability doesn't hand an attacker root inside (and potentially beyond) the container.

```bash
docker build -t todo-api:1.1 .
docker run --rm todo-api:1.1 node -e "console.log(process.getuid())"
# 1000   (a non-root UID, not 0)
```
A quick sanity check that the non-root user actually took effect — running an arbitrary one-off command against the built image confirms the process UID isn't 0 before you ever deploy it.

## Common Pitfalls / Gotchas

- Copying the whole source tree before installing dependencies (`COPY . .` then `RUN npm install`) — this invalidates the dependency-install cache layer on every single source change, turning every build into a full reinstall.
- Forgetting `.dockerignore` and accidentally including `node_modules` in the build context — at best this wastes build-context transfer time; at worst a host-built `node_modules` (wrong OS/architecture for native modules) gets copied in and silently breaks the container.
- Committing a `.env` file into the image via `COPY . .` without excluding it — secrets end up baked into an image layer permanently, retrievable by anyone who can pull the image, even after the file is "removed" in a later layer.
- Not pinning the base image tag (`FROM node` instead of `FROM node:22-alpine`) — builds become non-reproducible as the `latest` tag moves underneath you over time.
- Relying on `depends_on` in Compose to mean "wait until the database is actually ready to accept connections" — it only waits for the container to *start*, not for Postgres inside it to finish initializing; apps that connect immediately on boot need their own retry/backoff logic or a healthcheck-based `depends_on: condition: service_healthy`.

## Interview Questions & Answers

**Q: Why does the order of `COPY` instructions in a Dockerfile matter?**
A: Docker caches each layer based on a hash of that instruction's inputs, and invalidating one layer forces every layer after it to rebuild. Copying `package.json`/`package-lock.json` and running the install before copying the rest of the source means the expensive dependency-install layer stays cached across rebuilds triggered by ordinary source-code changes, which are far more frequent than dependency changes.

**Q: What goes in a `.dockerignore` file and why?**
A: Anything that shouldn't be part of the build context or baked into the image: `node_modules` (reinstalled fresh inside the image, and a host copy may be built for the wrong platform), `.git` (irrelevant to runtime, just adds context size), and secrets like `.env` files (must never end up as bytes in a shared image layer). It works like `.gitignore` but controls what's sent to the Docker daemon for the build, not just what's committed.

**Q: How do you pass configuration like a database connection string into a containerized app without hardcoding it?**
A: Via environment variables, set either with `docker run -e` or in a Compose file's `environment:` block, and read at runtime from `process.env` in the app. This keeps the image itself environment-agnostic — the same built image can run against a local Postgres in dev and a managed database in production purely by changing the injected environment, with no rebuild required.

**Q: Once you add a database, why move from `docker run` to Compose?**
A: Because running multiple related containers by hand means manually creating a shared network, starting each container with the right flags in the right order, and wiring connection details between them yourself. Compose expresses all of that declaratively in one YAML file — service definitions, an automatically created private network with DNS-based service discovery (so `api` can reach `db` by name), and named volumes for persistent data — and brings the whole stack up or down with a single command.

**Q: How would you make a dockerized app safer to run in production beyond just getting it working?**
A: Pin the base image to a specific tag (ideally with a digest) rather than a moving tag like `latest`; run the process as a non-root user via `USER`; keep secrets out of the image and inject them at runtime instead; set resource limits (`--memory`/`--cpus` or Compose's `deploy.resources.limits`) so one container can't starve others; and use a `.dockerignore` to keep the build context minimal and free of anything sensitive.

## Related Topics
- [dockerfile.md](./dockerfile.md)
- [docker-file.md](./docker-file.md)
- [docker-compose.md](./docker-compose.md)
- [docker-compose-file.md](./docker-compose-file.md)
- [images-and-containers.md](./images-and-containers.md)
- [volumes.md](./volumes.md)
