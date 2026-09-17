# Introduction to Docker

Docker is a platform for packaging an application together with everything it needs to run — code, runtime, system libraries, environment variables, and configuration — into a single unit called an **image**, and then running that image as an isolated process called a **container**. It exists to solve a very old, very specific pain: "it works on my machine." Before containers, a developer's laptop, the CI server, the QA environment, and production could each have subtly different OS versions, library versions, or configuration — and an app that ran fine in one place would break in another because the *environment* around the code was never actually the same thing twice. Docker collapses that gap by making the environment itself part of the shipped artifact instead of something each machine has to reproduce by hand.

Before containers, the two common ways to isolate workloads were bare metal (run everything for one app directly on one machine — wasteful, and one app's misbehaving process could affect another) and virtual machines (use a hypervisor to run several full guest operating systems, each with its own kernel, on one physical machine). VMs solved the isolation and density problem but at real cost: each VM boots a full OS, consumes hundreds of MB to GBs of disk and RAM just for the guest OS itself, and takes tens of seconds to minutes to start. Containers take a different approach entirely: instead of virtualizing hardware and running many kernels, all containers on a host share the *one* host kernel, and isolation is provided by kernel features — namespaces (what a process can see: its own PID tree, network stack, mounts, hostname) and cgroups (how much CPU/memory/IO a process can use). The result is a unit that starts in milliseconds to low seconds, weighs megabytes instead of gigabytes, and still gives each container its own filesystem, process tree, and network interface.

Docker itself is not a single program — it's a client-server system. The `docker` command you type is the **Docker CLI**, a thin client that sends REST API requests (over a Unix socket on Linux/macOS, or a named pipe on Windows) to the **Docker daemon**, `dockerd`, which is the long-running background service that actually does the work: building images, managing networks and volumes, and supervising containers. `dockerd` doesn't create containers directly either — it delegates to **containerd**, a separate daemon (donated to the CNCF, also used directly by Kubernetes) that manages the container lifecycle and image transfer, which in turn calls **runc**, a small CLI tool implementing the OCI (Open Container Initiative) runtime spec, to do the actual low-level work of creating namespaces/cgroups and starting the container process. This layering is why Docker, containerd, and Kubernetes can all interoperate — they agree on the OCI image and runtime specs rather than each reinventing container creation.

The basic lifecycle is: you write a `Dockerfile` describing how to build an image, run `docker build` to produce a read-only image (a stack of filesystem layers plus metadata), optionally push that image to a registry like Docker Hub, and then `docker run` to start a container — a writable, running instance of that image. Multiple containers can be started from the same image, each getting its own isolated filesystem (via a writable layer on top of the image's read-only layers), process namespace, and network namespace, while sharing the same underlying host kernel.

## Examples

```dockerfile
# A minimal Dockerfile for a Node.js HTTP service
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```
This is the whole recipe: start from a small base image that already has Node.js installed, copy in dependency manifests first (so the dependency-install layer is cached separately from app code), install dependencies, copy the rest of the source, document the port the app listens on, and declare the startup command. `docker build -t my-api:1.0 .` turns this into an image.

```bash
docker build -t my-api:1.0 .
docker run -d --name api -p 3000:3000 my-api:1.0
docker ps
# CONTAINER ID   IMAGE          COMMAND                  STATUS         PORTS                    NAMES
# 3f1a9c2e7b21   my-api:1.0     "node server.js"         Up 4 seconds   0.0.0.0:3000->3000/tcp   api
```
`docker build` produces the image locally. `docker run -d ... -p 3000:3000` starts a detached container from it, mapping host port 3000 to the container's port 3000. `docker ps` confirms the container is alive and shows the port mapping — this is the client talking to `dockerd` over its API, not shelling out to some other process.

```bash
docker inspect api --format '{{.State.Pid}} {{.NetworkSettings.IPAddress}}'
docker exec -it api sh
```
`docker inspect` reveals that a container is really just a regular Linux process on the host (it has a PID visible from the host) with its own namespaced view of the world and its own IP inside Docker's virtual network. `docker exec` opens a shell *inside* that namespace to poke around — useful for confirming what "isolated" actually means in practice.

## Common Pitfalls / Gotchas

- Treating a container like a lightweight VM you SSH into and hand-configure — containers are meant to be disposable and rebuilt from the Dockerfile, not patched in place; state or manual fixes made inside a running container vanish when it's removed.
- Forgetting that a container only stays alive as long as its main process (PID 1) keeps running — if that process exits (or the entrypoint script forks and returns), the container stops, even if you started other background processes inside it.
- Not understanding the CLI/daemon split when debugging — `docker` commands fail differently depending on whether the *CLI* can't reach the daemon (e.g. "Cannot connect to the Docker daemon") versus the *daemon* rejecting the build/run itself.
- Assuming an image built on one architecture (e.g. Apple Silicon/arm64) will run anywhere — images are architecture-specific unless built as multi-arch manifests, so `exec format error` on a different host is common.
- Confusing "Docker Desktop" with "Docker Engine" — on macOS/Windows, Docker Desktop actually runs a lightweight Linux VM under the hood to host the daemon, because containers fundamentally need a Linux kernel to provide namespaces/cgroups.

## Interview Questions & Answers

**Q: What problem does Docker actually solve, in concrete terms?**
A: Environment drift. Without containers, "works on my machine" happens because dev, test, and prod machines can silently differ in OS packages, library versions, or configuration, and there's no guarantee the thing you tested is the thing that ships. Docker packages the application with its exact runtime environment into an immutable image, so the same bytes that passed CI are the same bytes that run in production — the environment becomes part of the versioned artifact instead of ambient machine state.

**Q: Walk me through what happens between typing `docker run nginx` and a container actually starting.**
A: The Docker CLI sends a request over the REST API (typically over a Unix socket) to `dockerd`. `dockerd` checks if the `nginx` image exists locally; if not, it pulls it from the configured registry (Docker Hub by default). It then hands off to `containerd`, which prepares the container's filesystem bundle and invokes `runc`, an OCI-compliant runtime, to actually create the Linux namespaces and cgroups and exec the container's process. `containerd` then supervises that running process going forward.

**Q: How is a container different from just running a process directly on the host?**
A: A containerized process is still an ordinary process from the host kernel's point of view — `docker inspect` shows you its real host PID — but it's launched inside a set of Linux namespaces (PID, network, mount, UTS, IPC, user) so it sees its own isolated process tree, filesystem, hostname, and network stack, and inside a cgroup that caps its CPU/memory/IO usage. No new kernel, no hypervisor — just kernel-level fencing around a normal process.

**Q: Why does Docker Desktop need a Linux VM on macOS or Windows?**
A: Because namespaces and cgroups are Linux kernel features — they don't exist in the macOS or Windows kernels. Docker Desktop runs a small, purpose-built Linux VM in the background (via HyperKit/Virtualization.framework on macOS, or WSL2/Hyper-V on Windows) so that `dockerd` has an actual Linux kernel to schedule containers against, then transparently forwards the CLI and networking through to that VM.

**Q: What's the difference between an image and a container?**
A: An image is a read-only, versioned template — a stack of filesystem layers plus metadata (entrypoint, exposed ports, env vars) produced by `docker build`. A container is a running (or stopped) instance created from an image via `docker run`, with its own thin writable layer on top and its own process/network namespace. You can start many independent containers from one image, the same way you can start many processes from one executable file.

## Related Topics
- [docker-components.md](./docker-components.md)
- [features-of-docker.md](./features-of-docker.md)
- [docker-vs-virtual-machines.md](./docker-vs-virtual-machines.md)
- [dockerfile.md](./dockerfile.md)
- [images-and-containers.md](./images-and-containers.md)
