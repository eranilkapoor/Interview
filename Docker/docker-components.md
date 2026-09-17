# Docker Components

Docker's architecture is a client-server system layered on top of the OS kernel's isolation primitives (namespaces and cgroups on Linux). The **Docker CLI** (`docker`) is a thin client that talks to the **Docker daemon** (`dockerd`) over a REST API, typically through a Unix domain socket (`/var/run/docker.sock` on Linux/macOS) or a named pipe on Windows. This client-server split is why `docker` commands work identically whether the daemon is local or remote (e.g., `DOCKER_HOST=ssh://user@remotehost docker ps`) — the CLI just serializes your command into an HTTP request against the daemon's API.

`dockerd` itself doesn't run containers directly anymore — it delegates to **containerd**, a separate daemon (originally split out of Docker and donated to the CNCF) that manages the container lifecycle: pulling images, managing storage/snapshots, and supervising execution. containerd in turn shells out to **runc**, a low-level CLI tool that is the reference implementation of the **OCI (Open Container Initiative) runtime spec** — runc is the piece that actually calls into the Linux kernel to create namespaces (PID, network, mount, UTS, IPC) and cgroups (resource limits) and exec the container's process. This layering (CLI → dockerd → containerd → containerd-shim → runc) means each piece has a narrow, replaceable responsibility, and it's also why other tools (Kubernetes via `containerd` directly, or `nerdctl`) can reuse the same lower layers without going through Docker at all.

**Images** are read-only, layered filesystems plus metadata (entrypoint, env, exposed ports) built from a Dockerfile; each instruction typically produces a new layer, and layers are content-addressed and shared across images, which is why pulling a second image that shares a base with one you already have is fast. A **container** is an image plus a thin writable layer on top, plus the isolated namespaces/cgroups runc set up for it — stopping a container keeps that writable layer around (so `docker start` can resume it), while removing it discards that layer permanently. **Registries** (Docker Hub, ECR, GCR, a private Harbor/Nexus instance) are where images are stored and versioned by name and tag, and `docker pull`/`docker push` are just authenticated HTTP calls against a registry's API.

On Linux, dockerd talks to the kernel directly. On macOS and Windows, there is no native support for Linux namespaces/cgroups, so **Docker Desktop** runs a lightweight Linux VM in the background (historically HyperKit/xhyve on macOS, now Apple's Virtualization.framework; WSL2 on Windows) and dockerd runs *inside* that VM — the Docker CLI on your host is really just proxying to a daemon inside a hidden Linux VM. This explains several practical realities: why file I/O on bind-mounted volumes is slower on Mac/Windows than native Linux (it crosses a VM boundary), why Docker Desktop has a memory/CPU allocation setting for that VM, and why "it works differently on my Mac vs our Linux CI" bugs sometimes trace back to filesystem case-sensitivity or performance differences introduced by that VM layer.

## Examples

```bash
# The CLI is just a client — point it at a remote daemon over SSH and it behaves identically
DOCKER_HOST=ssh://deploy@prod-host.example.com docker ps
# Under the hood this is still an HTTP request to dockerd's REST API, just tunneled over SSH
```

This demonstrates the client-server split directly: no Docker-specific networking magic, just the CLI issuing REST calls to whatever daemon `DOCKER_HOST` points at.

```bash
# Inspect the actual component versions running on your machine
docker version
# Client: Docker Engine - Community, Version: 27.3.1 ...
# Server: Docker Engine - Community
#  Engine:      Version: 27.3.1
#  containerd:  Version: 1.7.22
#  runc:        Version: 1.1.14

docker info | grep -i "cgroup\|storage driver\|runtimes"
# Storage Driver: overlay2
# Cgroup Driver: systemd
# Runtimes: runc io.containerd.runc.v2
```

`docker version` and `docker info` surface the underlying components (containerd and runc versions, the storage driver used for image layers, the cgroup driver) that are otherwise invisible when you only interact through `docker run`/`docker build`.

```bash
# On a Linux host you can query containerd directly with its own CLI, bypassing dockerd entirely,
# which shows the layers are genuinely separate, independently operable pieces
sudo ctr --namespace moby containers list
sudo runc list
```

Because dockerd delegates to containerd (in the `moby` namespace when driven by Docker) and containerd delegates to runc, both lower layers expose their own tooling — proof that Docker is a composition of independently useful pieces, not a monolith.

## Common Pitfalls / Gotchas

- Treating "Docker" as one monolithic program — in interviews, being able to name dockerd, containerd, and runc separately, and describe why they're split, signals real depth.
- Forgetting that on macOS/Windows, dockerd runs inside a Linux VM, not natively — this explains bind-mount performance issues and why resource limits (CPU/RAM) are configured in Docker Desktop's settings rather than the host OS directly.
- Assuming the Docker CLI *is* the thing running containers — it's only a REST client; if `dockerd` is down, every `docker` command fails immediately with a connection error.
- Confusing an image (immutable, shared, layered) with a container (a running/stopped instance with its own writable layer) — a common source of "why did my changes disappear" confusion when someone edits files inside a container and then removes it without committing or using a volume.
- Not knowing that runc implements the OCI runtime spec, which is why alternative runtimes (gVisor's `runsc`, Kata Containers) can be swapped in as a drop-in replacement for stronger isolation.

## Interview Questions & Answers

**Q: Walk me through what happens, component by component, when you run `docker run nginx`.**
A: The Docker CLI sends a REST API request to dockerd (over the Unix socket). dockerd checks if the `nginx` image exists locally; if not, it asks containerd to pull it from the registry (Docker Hub by default). containerd unpacks the image layers into a snapshot and hands off container creation to a `containerd-shim` process, which invokes runc to actually create the Linux namespaces and cgroups and exec the container's process inside them. The shim stays around as the parent of the container process so containerd (and thus dockerd) can be restarted without killing running containers.

**Q: Why did Docker split containerd and runc out as separate projects instead of keeping everything in the `docker` daemon?**
A: To follow the single-responsibility principle and enable an ecosystem: containerd handles the general container lifecycle (pulling, storage, supervision) and is now a CNCF graduated project used directly by Kubernetes' CRI, independent of Docker. runc is a minimal reference implementation of the OCI runtime spec, so any tool that emits an OCI-compliant bundle can use runc (or a drop-in alternative like gVisor) without depending on Docker at all. This decoupling is also what let Kubernetes drop its `dockershim` and talk to containerd directly.

**Q: Why does Docker Desktop need a virtual machine on macOS but not on Linux servers?**
A: Docker containers rely on Linux kernel features — namespaces for isolation and cgroups for resource limiting — that don't exist natively on macOS's XNU kernel or Windows' NT kernel. On Linux, dockerd talks to the host kernel directly. On macOS/Windows, Docker Desktop runs a minimal Linux VM (via Apple's Virtualization.framework on Mac, or WSL2 on Windows) and dockerd runs inside that VM; the CLI and any bind-mounted files have to cross the VM boundary, which is the root cause of the slower bind-mount I/O often reported on those platforms.

**Q: What's the difference between an image and a container in terms of the filesystem?**
A: An image is a stack of read-only layers, each corresponding to a Dockerfile instruction, stored once and shared by content hash across every container created from it. A container adds one thin writable layer on top (copy-on-write) — any file the container process modifies gets copied up into that layer first. Removing the container discards that writable layer; the underlying image layers are untouched and can be reused by other containers.

**Q: What is the OCI, and why does it matter for Docker interoperability?**
A: The Open Container Initiative defines vendor-neutral specifications for container images (the image-spec) and runtimes (the runtime-spec). Because Docker builds OCI-compliant images and runc implements the OCI runtime-spec, images built by Docker can be run by other OCI-compliant tools (Podman, containerd directly, Kubernetes), and Docker can swap in alternative OCI runtimes — this standardization is what prevents vendor lock-in at the image/runtime layer.

## Related Topics
- [introduction-to-docker.md](./introduction-to-docker.md)
- [images-and-containers.md](./images-and-containers.md)
- [docker-commands.md](./docker-commands.md)
- [docker-registry.md](./docker-registry.md)
- [docker-vs-virtual-machines.md](./docker-vs-virtual-machines.md)
- [container-security.md](./container-security.md)
