# Images and Containers

An image and a container are related the way a class is related to an instance, or a compiled binary is related to a running process — the image is the static, immutable template, and the container is a live thing created from it. An image is built by `docker build` reading a Dockerfile: every instruction that changes the filesystem (`RUN`, `COPY`, `ADD`) produces a new, read-only filesystem layer, and the image itself is just an ordered stack of those layers plus metadata (the entrypoint/cmd, exposed ports, environment variables, working directory). Each layer, and the image as a whole, is content-addressed — identified by a SHA256 digest computed from its contents — so `docker pull` and `docker push` can detect exactly which layers are already present locally or in a registry and skip re-transferring anything unchanged. Once built, an image never changes; "updating" an image really means building a new one, typically with a new tag pointing at a new digest.

A container is what you get from `docker run <image>`: a new, thin, writable filesystem layer stacked on top of the image's read-only layers, combined with its own process and network namespaces. The mechanism that makes this cheap is a union filesystem — OverlayFS on modern Linux — which presents the stack of read-only image layers plus the container's one writable layer as a single merged view, without physically copying the read-only data anywhere. Writes inside the container use copy-on-write: modifying a file that exists in a lower, read-only layer causes OverlayFS to copy that file up into the container's writable layer first, then apply the change there, leaving the original image layer untouched. This is precisely what makes starting many containers from one image cheap — ten containers from the same `node:22-alpine` image share that image's layers read-only on disk, and each only pays for its own writable layer plus whatever it actually modifies, not ten full copies of the base OS.

This layering has a direct, practical consequence: a container's writable layer — and therefore anything the running process writes to its own filesystem that isn't in a mounted volume — is deleted along with the container. `docker rm` doesn't touch the underlying image; it just discards that one container's thin writable layer and its namespace/process state. This is why containers are meant to be treated as disposable — if you need data to outlive a specific container instance (a database's files, uploaded content), it has to live in a volume or bind mount, which is deliberately outside the union filesystem and outside the container's lifecycle entirely.

Containers also move through a defined lifecycle that images don't have, since an image is just a static artifact with no running state. `docker create` (or the create-then-start that `docker run` does implicitly) produces a container in the **created** state — filesystem and config are set up, but no process is running yet. `docker start` moves it to **running**. From there it can be `docker pause`d (process frozen via a cgroup freezer, still resident) and `docker unpause`d, or `docker stop`ped (sends SIGTERM, then SIGKILL after a grace period, ending the main process) into the **exited/stopped** state, from which it can be `docker start`ed again — a stopped container still exists on disk, writable layer intact, until it's explicitly `docker rm`'d, which is the only step that actually deletes it.

## Examples

```bash
docker build -t todo-api:1.0 .
docker image inspect todo-api:1.0 --format '{{.Id}}'
# sha256:3f4e2a9c8b7d1e6f5a4c3b2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f
```
The image's identity is a content hash, not its tag — `todo-api:1.0` is just a mutable label pointing at that digest. Rebuilding with the same tag but different content produces a new digest, and the old tagged digest becomes untagged ("dangling") unless something else still references it.

```bash
docker run -d --name c1 todo-api:1.0
docker run -d --name c2 todo-api:1.0
docker diff c1
# (empty until c1 writes something, e.g. a log file inside its own filesystem)
docker rm -f c1 c2
docker image ls todo-api
# todo-api:1.0 still present — removing containers never touches the image
```
Two containers started from the same image share its read-only layers on disk; `docker diff` shows only what's changed in a given container's own writable layer. Removing both containers frees their writable layers and namespaces, but the image they were built from is untouched and can still spawn new containers.

```bash
docker stop c2                 # SIGTERM, then SIGKILL after the grace period -> exited
docker start c2                # exited -> running again, writable layer preserved
docker inspect c2 --format '{{.State.Status}}'
# running
docker rm -f c2                # only now is the container's writable layer actually deleted
```
This walks the real lifecycle: stopping a container doesn't delete it — its writable layer and configuration persist on disk in the exited state, which is why `docker start` can bring the exact same container back rather than creating a new one. Only `docker rm` actually discards it.

## Common Pitfalls / Gotchas

- Expecting data written inside a container to survive `docker rm` — it lives in that container's own writable layer, which is deleted with the container; anything that must persist belongs in a volume or bind mount, not the container's filesystem.
- Confusing a stopped container with a deleted one — `docker stop` (or a crashed process) leaves the container in an *exited* state with its writable layer intact and restartable via `docker start`; only `docker rm` frees that layer.
- Assuming `docker rmi`/pruning an image affects running containers built from it — a running container has already copied what it needs into its own layer stack; you generally can't remove an image that a container (even a stopped one) still references until that container is removed first.
- Treating an image tag as a stable identifier — tags are mutable pointers that can be reassigned to a different digest by a later `docker build`/`docker push`; for real reproducibility, pin to a digest (`image@sha256:...`) rather than trusting a tag won't move.
- Not realizing multiple containers from the same image share the image's read-only layers on disk — this is why running many containers from one base image is so much cheaper in storage than it looks, but also why a change made *inside* one container is never visible to siblings started from the same image.

## Interview Questions & Answers

**Q: What's the precise technical difference between an image and a container?**
A: An image is an immutable, read-only stack of filesystem layers plus metadata, produced by `docker build` and identified by a content-addressed SHA256 digest. A container is a running (or stopped) instance created from an image via `docker run`/`docker create` — it adds one thin, writable filesystem layer on top of the image's read-only layers via copy-on-write, plus its own process and network namespaces. The image never changes; the container is the mutable, ephemeral thing built on top of it.

**Q: How can ten containers from the same image not use ten times the disk space?**
A: A union filesystem (OverlayFS on Linux) lets multiple containers mount the same set of read-only image layers simultaneously, merging them into each container's view without copying the underlying data. Each container only consumes additional disk space for its own writable layer — created lazily via copy-on-write only when that specific container modifies a file — so the shared base layers are stored exactly once regardless of how many containers reference them.

**Q: What happens on disk when a running container writes to a file that already exists in the image?**
A: OverlayFS performs a copy-up: it copies the file from the read-only lower layer into the container's writable upper layer, then applies the write there. The original file in the image's layer is untouched — every other container built from that image still sees the original, unmodified version, since the change only exists in this one container's private writable layer.

**Q: Walk through a container's lifecycle states.**
A: Created (filesystem and config are set up, no process started yet) → Running (main process started) → optionally Paused (process frozen in place via the cgroup freezer, still fully resident) → Stopped/Exited (main process ended, normally via SIGTERM then SIGKILL from `docker stop`, or on its own) → Removed (`docker rm` deletes the writable layer and container metadata entirely). A stopped container isn't gone — it can be restarted from the exited state with `docker start`, preserving its writable layer; only explicit removal actually deletes it.

**Q: If you remove all containers built from an image, does the image disappear too?**
A: No. Images and containers have independent lifecycles — `docker rm` only removes container-level state (the writable layer, namespaces, metadata). The image remains in local storage until it's explicitly removed with `docker rmi` (or pruned), and can be used to start new containers at any time.

## Related Topics
- [dockerfile.md](./dockerfile.md)
- [docker-components.md](./docker-components.md)
- [multi-stage-builds.md](./multi-stage-builds.md)
- [volumes.md](./volumes.md)
- [docker-vs-virtual-machines.md](./docker-vs-virtual-machines.md)
- [introduction-to-docker.md](./introduction-to-docker.md)
