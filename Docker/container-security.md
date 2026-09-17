# Container Security

Containers share the host's kernel, which is the single fact that shapes almost every container security practice — a container is process isolation (namespaces + cgroups), not a hardware-level security boundary like a VM's hypervisor. Root inside a container is still root as far as the kernel is concerned unless you've explicitly remapped or restricted it; a container escape (via a kernel vulnerability, a misconfigured mount, or an overly permissive capability set) running as root can compromise the host, not just the container. Every practice below exists to shrink that blast radius: run as an unprivileged user, ship less code that could be vulnerable, know what CVEs you're actually shipping, keep secrets out of the image entirely, and constrain what a compromised container can do even if something does go wrong.

The first and cheapest control is not running as root inside the container. A Dockerfile with no `USER` instruction runs its process as UID 0 by default, and while user-namespace remapping exists to make that UID 0 map to an unprivileged UID on the host, it's not the default and many production setups don't enable it — meaning "root in the container" often really is root as the kernel sees it for anything the container can reach (bind mounts, exposed sockets, kernel bugs). Adding `USER appuser` (with a corresponding `RUN adduser` earlier in the build) makes an attacker who achieves code execution inside the container still have to find a *separate* privilege escalation before they get root, rather than starting from root already. This is why "the container is isolated anyway" is a weak argument against running as root — isolation reduces but does not eliminate the value of not already being root when a kernel-level or capability-based escape is found.

Minimizing the base image reduces attack surface directly: fewer installed packages means fewer CVEs to track and fewer binaries an attacker can abuse post-compromise (no shell, no package manager, no curl, in the extreme case). `alpine`-based images are popular for being small, though musl-libc compatibility occasionally bites; **distroless** images (Google's `gcr.io/distroless/*`) go further, shipping just the language runtime and your app with no shell, no package manager, and no OS userland at all; `FROM scratch` is the extreme end — a genuinely empty base, viable for statically linked binaries (common with Go) where there's no runtime dependency to include at all. None of this replaces scanning, but a smaller image gives a scanner less to find and an attacker less to work with if they do get in.

Image scanning tools — Docker's own `docker scout`, Aqua's open-source `trivy`, and Anchore's `grype` are the common ones — inspect an image's layers against CVE databases and report known vulnerabilities by package and severity, typically integrated into CI so a build fails (or at least warns) above some severity threshold before the image ever reaches a registry. This catches vulnerable *dependencies* baked into the image (an outdated OpenSSL, a CVE'd base OS package) that code review alone won't surface, but it only knows about *known, disclosed* CVEs — it's a floor, not a guarantee of security.

Secrets handling is where a lot of otherwise-careful setups quietly fail: putting a secret in an `ENV` instruction, a plain `ARG`, or just `COPY`ing a credentials file into the image bakes it into a layer, and Docker image layers are immutable and cached — even if a later layer deletes the file, the secret is still recoverable from the earlier layer in the image history (`docker history`, or simply extracting the layer tarballs) and travels with the image to every registry and host that pulls it. BuildKit's `--mount=type=secret` (used as `RUN --mount=type=secret,id=mysecret cat /run/secrets/mysecret` inside the Dockerfile, supplied at build time via `docker build --secret id=mysecret,src=./secret.txt`) is the correct fix: the secret is mounted into the build container only for the duration of that specific `RUN` step and is never written into any layer. At runtime, Swarm has native `docker secret create`/`docker service create --secret`, which mounts secrets as in-memory files under `/run/secrets/` inside the container rather than passing them as environment variables (env vars are readable by any process that can inspect the container, get dumped in crash reports, and are visible via `docker inspect`). Beyond Docker's own primitives, most production setups pull secrets from an external manager (Vault, AWS Secrets Manager, cloud KMS-backed stores) at container startup rather than baking or injecting them at build time at all.

Runtime hardening further constrains what a compromised container can do. `docker run --read-only` mounts the container's root filesystem read-only, so even if an attacker gets code execution, they can't persist a payload to disk or tamper with application files — anything the app genuinely needs to write (temp files, caches) gets an explicit `--tmpfs /tmp` (or a named volume) rather than a writable root. `--cap-drop ALL` strips every Linux capability from the container (capabilities are the fine-grained privileges root traditionally bundles all together — `NET_BIND_SERVICE`, `SYS_ADMIN`, `CHOWN`, etc.), and you then `--cap-add` back only the specific ones the app actually needs (e.g., `NET_BIND_SERVICE` to bind a port below 1024), following least privilege instead of the wide-open default capability set Docker otherwise grants. `--privileged` disables essentially all of this isolation at once — full device access, all capabilities, no seccomp/AppArmor confinement — and should be treated as an almost-never-justified escape hatch; if a container "needs `--privileged`" it usually needs one or two specific capabilities or device mounts instead, not everything.

## Examples

```dockerfile
# Non-root user + minimal base + no baked-in secret
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

FROM gcr.io/distroless/nodejs22-debian12
WORKDIR /app
COPY --from=build /app /app
USER nonroot
CMD ["server.js"]
```

The build stage uses a full Alpine image to install dependencies, but the final runtime stage is a distroless image with no shell or package manager, running as the built-in `nonroot` user rather than root.

```bash
# Build-time secret via BuildKit, never written into an image layer
DOCKER_BUILDKIT=1 docker build \
  --secret id=npmrc,src=$HOME/.npmrc \
  -t my-api:1.4.0 .
```

```dockerfile
# Inside the Dockerfile: the secret is mounted only for this RUN step
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci --omit=dev
```

Because the secret is mounted rather than copied, it exists only in the ephemeral build container for that one `RUN` instruction and never appears in `docker history` or any committed layer.

```bash
# Runtime hardening: read-only root filesystem, dropped capabilities, no privilege escalation
docker run -d \
  --name api \
  --read-only \
  --tmpfs /tmp \
  --cap-drop ALL \
  --cap-add NET_BIND_SERVICE \
  --security-opt no-new-privileges \
  -p 80:80 \
  my-api:1.4.0
```

`--read-only` blocks writes anywhere except the explicit `/tmp` tmpfs; `--cap-drop ALL` then `--cap-add NET_BIND_SERVICE` grants only the one capability needed to bind port 80 as a non-root user, instead of the full default capability set.

```bash
# Scan an image for known CVEs before pushing it
trivy image --severity HIGH,CRITICAL my-api:1.4.0
docker scout cves my-api:1.4.0
```

Wiring either of these into CI to fail the build above a chosen severity threshold catches known-vulnerable dependencies before the image ever reaches a registry.

## Common Pitfalls / Gotchas

- Putting a secret in `ENV` or a plain `ARG`/`COPY` — it becomes permanently embedded in the image's layer history and is extractable by anyone who can pull the image, even if a later layer deletes the file.
- Skipping `USER` in a Dockerfile and shipping everything as root by default — the easiest and cheapest hardening step is also the most commonly skipped one.
- Reaching for `--privileged` to fix a permissions error instead of identifying the one or two capabilities actually required — it silently disables nearly all container isolation at once.
- Treating a clean scanner report as proof of security — scanners only catch *known, disclosed* CVEs in packages they recognize; zero-days, misconfigurations, and application-logic vulnerabilities are invisible to them.
- Using `alpine` for its size without checking musl-libc compatibility issues with native dependencies, or assuming "small image" alone equals "secure image" — size reduces surface area but doesn't replace scanning or patching.
- Forgetting that a multi-stage build's earlier stages can still leak secrets if a secret is `COPY`'d (rather than `--mount`'d) into an early stage, even if the final stage doesn't `COPY --from` that layer — anyone with access to build cache or intermediate layers can still retrieve it.

## Interview Questions & Answers

**Q: Why is running a container as root still a real security concern, given that containers are already isolated by namespaces?**
A: Namespace and cgroup isolation is process-level, not a hard security boundary like a hypervisor — the container shares the host's kernel. If an attacker achieves code execution in a container running as root and then finds a kernel vulnerability, a capability misconfiguration, or a mount escape, they inherit root on the host, not just the container. Running as a non-root user via `USER` doesn't prevent every escape, but it removes the "already root" starting point, forcing an attacker to chain an additional privilege escalation.

**Q: Why does putting a secret in a Dockerfile `ENV` instruction leak it, even if you unset the variable in a later layer?**
A: Docker images are built as a stack of immutable, cached layers, and each instruction that touches the filesystem or environment creates or modifies a layer that's retained in the image's history regardless of what later layers do. Unsetting an env var or deleting a file in a subsequent `RUN` doesn't remove it from the earlier layer — it's still present in `docker history` output and recoverable by extracting the layer tarballs directly, so the secret ships with the image to every place it's pulled.

**Q: What's the correct way to use a secret during a Docker build without it ending up in the final image?**
A: Use BuildKit's secret mount: `docker build --secret id=name,src=./file` at build time, and inside the Dockerfile `RUN --mount=type=secret,id=name ...`. The secret file is made available only inside the filesystem of that specific `RUN` step's ephemeral build container and is never written into any committed layer, so it doesn't appear in the final image or its history — unlike `COPY`ing a secret file in, which bakes it into a layer permanently.

**Q: What does `--cap-drop ALL --cap-add NET_BIND_SERVICE` accomplish, and why not just leave the defaults?**
A: Docker's default capability set grants a broad-but-not-full slice of root's traditional privileges to every container (things like `CHOWN`, `SETUID`, `NET_RAW`) whether or not the app needs them. Dropping all of them and adding back only what's actually required — here, just the ability to bind a privileged port below 1024 — follows least privilege: if the container is compromised, the attacker only has the one capability you explicitly granted rather than the whole default set, meaningfully shrinking what a successful exploit can actually do.

**Q: Why is `--privileged` dangerous, and what should you use instead?**
A: `--privileged` disables nearly every isolation mechanism at once — it grants all Linux capabilities, removes seccomp and AppArmor/SELinux confinement, and gives the container access to host devices — effectively making the container's root equivalent to host root for most practical purposes. It's almost never actually required; the usual underlying need (access one device, bind a low port, modify certain kernel parameters) is satisfiable with a specific `--cap-add`, a scoped `--device` mount, or a narrower `--security-opt`, all of which preserve isolation for everything the container doesn't explicitly need.

## Related Topics

- [docker-registry.md](./docker-registry.md)
- [docker-hub.md](./docker-hub.md)
- [docker-file.md](./docker-file.md)
- [multi-stage-builds.md](./multi-stage-builds.md)
- [docker-in-production.md](./docker-in-production.md)
- [images-and-containers.md](./images-and-containers.md)
