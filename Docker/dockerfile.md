# Dockerfile Best Practices

A Dockerfile is easy to get *working* and surprisingly easy to get *wrong* in ways that only show up later — as a 1.5GB image where 1.2GB is compiler toolchain nobody runs in production, as a CI pipeline that reinstalls every dependency on every commit because one early line invalidated the cache, or as a container that runs as root because nobody thought about it. This page is the optimization/best-practices angle on Dockerfiles: how to structure instructions so builds are fast, images are small, and the result is safe to run. For the instruction-by-instruction syntax reference (what `ARG` vs `ENV` actually do, how `CMD`/`ENTRYPOINT` interact), see [docker-file.md](./docker-file.md).

The single most impactful practice is **ordering instructions from least-to-most frequently changing**, because Docker's build cache works layer-by-layer: it hashes each instruction plus its inputs, and the moment one layer's inputs change, that layer *and every layer after it* gets rebuilt from scratch, even if later instructions didn't actually change. This is why the canonical pattern copies dependency manifests (`package.json`, `requirements.txt`, `go.mod`) and installs dependencies *before* copying the rest of the application source — source code changes on every commit, dependency lists change rarely, so putting the expensive install step first (relative to source) means it stays cached across most builds. Get this order backwards — `COPY . .` before `RUN npm install` — and every single code change forces a full dependency reinstall, turning a 3-second cached build into a 90-second one.

The second major lever is **final image size**, which matters for pull time, attack surface, and storage cost across every host and registry that holds a copy. Multi-stage builds (see [multi-stage-builds.md](./multi-stage-builds.md)) are the primary tool: compile or build in a stage with the full toolchain, then `COPY --from=` only the compiled artifact into a minimal final stage. Choosing a small base image matters too — `alpine` variants are commonly 5-10x smaller than `debian`/`ubuntu`-based equivalents, and distroless or `scratch` images go further by dropping the shell and package manager entirely, which also shrinks the attack surface (nothing to `exec` into, no shell for an attacker to abuse post-compromise). Combining `RUN` commands with `&&` and cleaning up in the *same* layer matters for image size too — `RUN apt-get update && apt-get install -y foo && rm -rf /var/lib/apt/lists/*` keeps the apt cache out of the image entirely, whereas doing the cleanup in a later `RUN` only removes the files from the final filesystem view while the earlier layer (which still contains them) remains part of the image's total size.

The third practice, often skipped under deadline pressure, is **build determinism and safety**: pinning base image versions (`node:22.4.0-alpine`, not `node:latest`) so a rebuild six months from now doesn't silently pull a different major version with breaking changes; using a `.dockerignore` to keep `.git`, `node_modules`, and secrets out of the build context (both for build speed and to stop accidental `COPY . .` leaks); and ending the Dockerfile with a non-root `USER` instruction so the container doesn't run as root by default, since a compromised root process in a container has a meaningfully larger blast radius than a compromised unprivileged one.

## Examples

```dockerfile
# Anti-pattern: cache-hostile ordering — every source change reinstalls all dependencies
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci --omit=dev
CMD ["node", "server.js"]
```
Because `COPY . .` runs before `npm ci`, any change anywhere in the source tree invalidates the cache for `COPY . .` — and every layer after it, including the install step — forcing a full dependency reinstall on every rebuild.

```dockerfile
# Fixed: cache-friendly ordering + non-root user + pinned base image
FROM node:22.4.0-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```
Now `npm ci` only reruns when `package*.json` actually changes; ordinary source edits reuse the cached dependency layer. The image also runs as the non-root `node` user (built into the official Node image) instead of root, and the base image is pinned to an exact version rather than a moving `latest`/`22` tag.

```dockerfile
# Combining RUN steps and cleaning up in the same layer keeps apt cache out of the image
FROM debian:bookworm-slim
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*
```
If `rm -rf /var/lib/apt/lists/*` were a separate, later `RUN` instruction instead, the apt package lists would still be baked into the earlier layer and counted in the image's total size — union filesystem layers are additive, not something a later layer can shrink.

## Common Pitfalls / Gotchas

- Copying all source before installing dependencies, destroying cache reuse on every code change — always copy manifest files (`package.json`, `go.sum`, `requirements.txt`) and install first, then copy the rest.
- Using floating tags (`node:latest`, `python:3`) for base images — builds become non-reproducible, and a routine rebuild months later can silently pull a new major version with breaking changes.
- Cleaning up temp files/package caches in a separate `RUN` layer instead of the same one that created them — the bloat is already baked into the earlier layer and the image doesn't shrink.
- Skipping `.dockerignore` and letting `COPY . .` pull in `.git`, `node_modules`, build artifacts, or a local `.env` file into the build context and potentially into the image.
- Leaving the container running as root because `USER` was never set — the default, and a real hardening gap in production images.
- Installing dev dependencies (test frameworks, linters, type checkers) into the final production image instead of using a multi-stage build to leave them behind in the builder stage.

## Interview Questions & Answers

**Q: Why does instruction order in a Dockerfile matter for build performance?**
A: Docker's layer cache is sequential and input-hashed: each instruction produces a layer keyed by that instruction plus its inputs, and the first layer whose inputs changed invalidates every layer after it, regardless of whether those later instructions would have produced the same output. Ordering instructions from least-to-most frequently changing — dependency manifests and installs before application source — maximizes how often the expensive early layers get reused instead of rebuilt.

**Q: What concretely makes a Docker image smaller, beyond just "use alpine"?**
A: Multi-stage builds that leave build tools and dev dependencies behind in an intermediate stage, copying only the final compiled/bundled artifact into a minimal runtime stage; combining install-and-cleanup commands into a single `RUN` layer so removed files don't remain baked into an earlier layer; using `--omit=dev`/production-only installs; and choosing a base image with a smaller footprint (alpine, distroless, or scratch for statically compiled binaries) appropriate to the runtime's actual needs.

**Q: Why is pinning exact base image versions considered a best practice instead of always tracking `latest`?**
A: `latest` (or a loose tag like `node:22`) can point to a different underlying image over time as new patch/minor versions are published, so an unmodified Dockerfile can produce a different, potentially breaking build weeks or months later with no code change to blame. Pinning an exact version (or better, a digest) makes builds reproducible — the same Dockerfile at the same commit always resolves to the same base image.

**Q: What's the security argument for setting `USER` to a non-root account at the end of a Dockerfile?**
A: Containers share the host kernel, so a process running as root inside a container still has root-level capabilities within that container's namespace, and a container-escape or kernel vulnerability is materially more dangerous if the escaping process was root than if it was an unprivileged user. Setting `USER` to a non-root account is a low-cost step that reduces the blast radius of both application-level vulnerabilities (e.g., arbitrary file write) and any future container-breakout class of bug.

**Q: How do you keep an `apt-get`/`apk` package cache out of the final image?**
A: Perform the update, install, and cache-cleanup (`rm -rf /var/lib/apt/lists/*` for apt, or use `--no-cache` for apk) all within the same `RUN` instruction, chained with `&&`. Because each `RUN` produces one layer, doing cleanup in that same instruction means the cache files never get committed to a layer in the first place; splitting cleanup into a later `RUN` only hides the files from the final container's filesystem view — the earlier layer, and its size, is still part of the image.

## Related Topics
- [docker-file.md](./docker-file.md)
- [multi-stage-builds.md](./multi-stage-builds.md)
- [container-security.md](./container-security.md)
- [images-and-containers.md](./images-and-containers.md)
- [docker-in-production.md](./docker-in-production.md)
