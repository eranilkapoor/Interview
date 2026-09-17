# Docker File

A Dockerfile is a text file of sequential instructions that Docker's builder executes to produce an image, one layer per instruction (roughly — the builder can also merge some). This page is a syntax/instruction reference — what each instruction does and how they interact. For build-optimization and best-practices guidance (layer ordering, cache invalidation, minimizing image size), see [dockerfile.md](./dockerfile.md), which covers that angle instead.

Every Dockerfile starts with `FROM <image>[:tag]`, which sets the base image and resets the build context's inherited metadata; a Dockerfile can have multiple `FROM` lines for multi-stage builds, each starting a fresh stage. `RUN` executes a command inside a temporary container during the build and commits the result as a new layer — it's for anything that needs to happen at build time (installing packages, compiling code). `WORKDIR` sets the working directory for all subsequent instructions in that stage (and creates the directory if it doesn't exist) — it's the correct way to change directories in a Dockerfile, since `RUN cd /app` wouldn't persist across instructions (each `RUN` is its own shell invocation). `EXPOSE` is purely documentation/metadata — it does not actually publish a port; the port still has to be published at `docker run -p` or via `ports:` in Compose. It exists so tools and humans reading the Dockerfile know what the container listens on, and `docker run -P` uses it to know which ports to auto-publish.

`COPY` and `ADD` both bring files from the build context into the image, but `COPY` is the one you should default to — it does a plain, predictable copy. `ADD` additionally auto-extracts local tar archives into the destination and can fetch remote URLs directly, which sounds convenient but is a common source of surprising, hard-to-audit behavior (a URL fetch that isn't cached the way a `RUN curl` would be, or an unexpected extraction). Docker's own documentation recommends `COPY` unless you specifically need `ADD`'s tar-extraction behavior.

`CMD` and `ENTRYPOINT` both specify what runs when the container starts, but they interact rather than simply override each other. `ENTRYPOINT` sets the fixed, primary command (the executable); `CMD` supplies default *arguments* to it — or, if there's no `ENTRYPOINT` at all, `CMD` is the entire command. Critically, whatever you pass after `docker run <image>` on the command line replaces `CMD` entirely (when both are in exec form), but does not touch `ENTRYPOINT` — it gets appended as arguments to it instead. This is exactly why well-designed base images (like the official `postgres` or `node` images) use `ENTRYPOINT` for a fixed setup script and `CMD` for the default thing to run, letting you override just the trailing command at `docker run` time without having to know or repeat the entrypoint logic.

| ENTRYPOINT | CMD | `docker run image` runs | `docker run image foo` runs |
|---|---|---|---|
| (none) | `["a","b"]` | `a b` | `foo` (CMD fully replaced) |
| `["a"]` | (none) | `a` | `a foo` |
| `["a"]` | `["b"]` | `a b` | `a foo` (CMD replaced by args) |

`ARG` and `ENV` are both variables, but scoped very differently. `ARG` defines a build-time-only variable, available during the build (interpolatable into `RUN`, `COPY`, etc. via `${...}`) but **not present in the final image** or in a running container's environment — inspecting a container with `docker inspect` or running `printenv` inside it will not show an `ARG` value unless it was explicitly re-exposed via `ENV`. `ENV` defines a variable that persists into the built image's metadata and is set in every container started from it, visible to `docker inspect` and to the running process. A common pattern is `ARG` for a value only needed during the build (like a version pin) and `ENV NAME=${ARG_NAME}` when you need that same value available at runtime too — note `ARG` values declared before the first `FROM` are also out of scope inside build stages unless re-declared after `FROM`.

`USER` sets the user (and optionally group) that subsequent instructions and the final container process run as — defaulting to `root` if never set, which is a security smell for production images; switching to a non-root user is a standard hardening step. `LABEL` attaches arbitrary key-value metadata to the image (maintainer, version, git commit) queryable via `docker inspect`, purely informational with no runtime effect. A `.dockerignore` file, sitting alongside the Dockerfile, excludes matching paths (like `.git`, `node_modules`, `*.log`) from the build context sent to the daemon — this both speeds up builds (a smaller context uploads faster) and prevents accidentally `COPY`ing secrets or bloat into an image.

## Examples

```dockerfile
# ARG vs ENV: ARG is build-time only, ENV persists into the running container
FROM node:22-alpine

ARG NODE_VERSION=22          # build-time only — gone from the final image's runtime env
ENV APP_ENV=production       # persists — visible via `docker inspect` and `printenv` in the container

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

USER node                    # drop from root to the unprivileged `node` user for the final image
EXPOSE 3000                  # documentation only — still needs -p 3000:3000 at `docker run`
CMD ["node", "server.js"]
```

Running `docker inspect` on a container built from this image shows `APP_ENV=production` in `Config.Env`, but no trace of `NODE_VERSION` — that's the ARG/ENV scoping rule in practice.

```dockerfile
# ENTRYPOINT + CMD interaction, the way official images commonly use it
FROM postgres:16-alpine

COPY init-db.sh /docker-entrypoint-initdb.d/
ENTRYPOINT ["docker-entrypoint.sh"]   # fixed setup logic, always runs
CMD ["postgres"]                      # default argument to the entrypoint — the thing being launched
```

`docker run mypg` runs `docker-entrypoint.sh postgres`. `docker run mypg postgres -c log_statement=all` replaces just the `CMD` portion, running `docker-entrypoint.sh postgres -c log_statement=all` — you get the entrypoint's setup behavior (initializing the data directory, running init scripts) *and* your custom Postgres flags, without duplicating any of the entrypoint's logic yourself.

```
# .dockerignore — keep the build context small and prevent leaking secrets into the image
.git
.env
node_modules
npm-debug.log
Dockerfile
.dockerignore
*.md
dist/
```

Excluding `.git` and `node_modules` from the context is often the single biggest build-context-size reduction available; excluding `.env` prevents a stray `COPY . .` from ever pulling real secrets into an image layer, where they'd be recoverable by anyone with `docker history` access even after being deleted in a later layer.

## Common Pitfalls / Gotchas

- Using `ADD` out of habit for local file copies — it behaves like `COPY` for that case but silently auto-extracts local `.tar`/`.tar.gz` archives, which is surprising if you didn't intend it; default to `COPY` unless you specifically need extraction or a remote URL fetch.
- Assuming `CMD` arguments given at `docker run` also override `ENTRYPOINT` — they don't; exec-form `ENTRYPOINT` always runs, and anything after the image name on the CLI replaces `CMD`, getting appended as arguments to `ENTRYPOINT`, not substituted into it.
- Putting a secret in `ARG`/`ENV` and assuming it's safe because `ARG` "isn't in the final image" — `ARG` values are still recorded in the image's build history/cache and visible via `docker history --no-trunc`, so neither is safe for real secrets; use `docker run -e`, a secrets manager, or BuildKit's `--secret` mount instead.
- Forgetting `WORKDIR` and using `RUN cd /app && ...` — each `RUN` spawns a fresh shell, so a `cd` in one `RUN` instruction has no effect on the next one; `WORKDIR` is the only instruction that persists a directory change across instructions.
- Never setting `USER`, leaving the container process running as root by default, which widens the blast radius of any container-escape vulnerability.
- Missing a `.dockerignore` and accidentally `COPY`ing `.git`, `node_modules`, or a local `.env` file into the image because a broad `COPY . .` picked up everything in the build context.

## Interview Questions & Answers

**Q: What's the difference between `ARG` and `ENV`, and why does it matter for secrets?**
A: `ARG` defines a variable only available during the image build — it can be used to parameterize `RUN`/`COPY` instructions but is not set in the environment of containers created from the resulting image. `ENV` defines a variable that's baked into the image's metadata and set in every container's environment at runtime, visible via `docker inspect` or `printenv`. Neither is safe for secrets, though: `ARG` values are still recorded in the build cache/history (`docker history --no-trunc` can reveal them), so real secrets should be injected at `docker run -e` / via a secrets manager, not through either instruction.

**Q: Explain how `CMD` and `ENTRYPOINT` interact when both are present.**
A: `ENTRYPOINT` defines the fixed executable that always runs; `CMD` supplies default arguments to it. If you run the container with no trailing command (`docker run image`), Docker runs `ENTRYPOINT`'s command with `CMD`'s arguments appended. If you supply a trailing command (`docker run image foo bar`), that replaces `CMD` entirely — `ENTRYPOINT`'s command still runs, now with `foo bar` as its arguments instead of the Dockerfile's `CMD`. If there's no `ENTRYPOINT` at all, `CMD` alone is run (and in that case, a trailing command at `docker run` replaces it completely).

**Q: Why does `EXPOSE 3000` in a Dockerfile not actually make the app reachable from outside the container?**
A: `EXPOSE` is purely documentation embedded in the image's metadata — it tells anyone reading the Dockerfile (and tools like `docker run -P`) which port the containerized process listens on, but it performs no actual network publishing. You still have to explicitly publish the port at run time with `docker run -p 3000:3000` (or the `ports:` key in a compose file) to map it to a host port; without that, the port is only reachable from other containers on the same Docker network, not from the host or outside world.

**Q: Why is `COPY` generally preferred over `ADD`?**
A: `COPY` does exactly one thing — copy files/directories from the build context into the image — with predictable, easy-to-audit behavior. `ADD` does that too, but also silently auto-extracts recognized local archive formats (tar, gzip, etc.) into the destination, and can fetch content from a remote URL directly into the image. Those extra behaviors are rarely what you actually want and can introduce unexpected layers or unauditable remote fetches, so Docker's own guidance is to default to `COPY` and reach for `ADD` only when you specifically need archive extraction.

**Q: If you declare `ARG VERSION=1.0` before the first `FROM` in a multi-stage Dockerfile, is it usable inside every stage?**
A: No — an `ARG` declared before the first `FROM` is only in scope for use *in* `FROM` lines themselves (e.g., `FROM node:${VERSION}`); it goes out of scope once a build stage starts. To use that value inside a stage's instructions, you must re-declare `ARG VERSION` again after that stage's `FROM` line, at which point it picks up the value passed at build time (or its default) and becomes usable in `RUN`, `COPY --from`, etc. within that stage.

## Related Topics
- [dockerfile.md](./dockerfile.md)
- [multi-stage-builds.md](./multi-stage-builds.md)
- [docker-commands.md](./docker-commands.md)
- [docker-compose-file.md](./docker-compose-file.md)
- [images-and-containers.md](./images-and-containers.md)
- [container-security.md](./container-security.md)
