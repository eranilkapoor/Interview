# Volumes

Containers are meant to be ephemeral — when a container is removed, its writable layer goes with it, and anything written there (a SQLite file, uploaded images, log files) is gone. Volumes exist to give containers a place to persist data, or to share data between the host and a container, independent of the container's own lifecycle. Docker provides three distinct mechanisms for this — named volumes, bind mounts, and tmpfs mounts — and choosing the wrong one is a very common source of confusion between "works on my machine" development setups and production deployments.

Named volumes are storage areas fully managed by the Docker daemon. `docker volume create mydata` creates one, and Docker stores its actual data under `/var/lib/docker/volumes/mydata/_data` on the host (on Linux; the path is virtualized on Docker Desktop). You never reference that path directly — you just mount the volume by name (`-v mydata:/var/lib/postgresql/data`), and Docker manages the mapping. Because Docker owns the lifecycle, named volumes survive `docker-compose down` (unless you pass `-v`), survive container removal, and can be backed by pluggable volume drivers — the default `local` driver just uses the host filesystem, but third-party drivers (e.g. `rexray`, cloud-provider CSI-backed drivers) can back a named volume with EBS, Azure Disk, NFS, or other network/cloud storage, which is what makes named volumes viable for stateful workloads in orchestrated, multi-host environments. This makes named volumes the right default for anything that needs to persist and that you don't need to inspect or edit directly from the host — database data directories being the canonical example.

Bind mounts map an arbitrary, already-existing path on the host directly into the container: `-v /home/anil/myapp/src:/app/src`. Unlike named volumes, Docker has no ownership or management of that path — it's just a pass-through into whatever is already on the host filesystem, which is exactly why they're the standard tool for local development: you bind-mount your source directory into a container running a dev server with hot-reload, edit files in your normal editor on the host, and the container sees changes instantly without rebuilding the image. The tradeoff is portability and isolation — a bind mount hardcodes an assumption about the host's directory layout, which is fine on a laptop but fragile or meaningless on a remote production host, and because the container can write back to that host path, permission/ownership mismatches between the container's user and host user are a frequent source of "permission denied" bugs.

tmpfs mounts (`--tmpfs /app/cache`, Linux hosts only) are backed purely by host memory — nothing is ever written to disk, either on the host or inside a writable container layer. They're the right tool for data that's sensitive (secrets you don't want to persist anywhere, even transiently) or purely transient/performance-sensitive (scratch/cache directories), and they disappear the instant the container stops, with no cleanup needed and no risk of leaking onto disk.

## Examples

```bash
# Named volume: create explicitly, then mount by name for a database
docker volume create pgdata
docker run -d --name db \
  -v pgdata:/var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=devpass \
  postgres:16
# Data in /var/lib/postgresql/data survives `docker rm -f db` and reattaches
# to a brand-new container as long as it mounts the same `pgdata` volume.
```
`postgres:16` writes its data files to `/var/lib/postgresql/data` inside the container; because that path is backed by the `pgdata` named volume rather than the container's writable layer, removing and recreating the container doesn't lose the database.

```yaml
# docker-compose.yml — mixing a bind mount (live source) with a named volume (persisted DB)
services:
  api:
    build: .
    volumes:
      - ./src:/app/src              # bind mount: host source, live-reloaded in the container
    ports:
      - "3000:3000"
    command: npm run dev

  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data   # named volume: managed, persistent
    environment:
      POSTGRES_PASSWORD: devpass

volumes:
  pgdata:   # must be declared at the top level for Compose to manage it
```
Compose auto-creates `pgdata` as a named volume the first time you run `docker compose up`, and it persists across `docker compose down` unless you explicitly run `docker compose down -v`; the `./src:/app/src` bind mount has no such lifecycle — it's just the host directory, always current.

```bash
# --mount vs -v: --mount is more explicit and catches typos at parse time
docker run -d \
  --mount type=volume,source=pgdata,target=/var/lib/postgresql/data \
  --mount type=bind,source=/home/anil/app/config,target=/etc/app/config,readonly \
  --mount type=tmpfs,target=/app/cache,tmpfs-size=64m \
  postgres:16
```
`--mount` requires explicit `type=` and `source=`/`target=` keys, which fails loudly on typos, whereas the older `-v host:container:ro` shorthand silently creates a new anonymous or named volume if the source path doesn't already resolve as expected — `--mount` is generally recommended for scripts and production configs for that reason.

## Common Pitfalls / Gotchas

- Confusing `-v /host/path:/container/path` (a bind mount, because the source starts with `/` or `./`) with `-v myvolume:/container/path` (a named volume, because the source is a bare name) — the `-v` flag uses the same syntax for both, and it's easy to typo a named volume into an accidental bind mount to a relative path.
- Anonymous volumes (`-v /container/path` with no source) get a random hash name and pile up invisibly — `docker volume ls` fills with orphaned volumes over time unless you periodically run `docker volume prune`.
- Bind-mounting a directory that doesn't yet exist on the host — Docker will silently create it as an empty directory owned by root, which is rarely what you want and can mask a typo'd path.
- Permission mismatches between the container's process UID and the host directory's ownership on a bind mount — a container running as a non-root user can get `EACCES` errors against a host directory owned by a different UID, especially across Linux hosts where UID mapping isn't automatic (Docker Desktop on Mac/Windows papers over this with its VM layer).
- Forgetting that `docker-compose down` does NOT remove named volumes by default — you need `docker-compose down -v` to also drop them, which is a common source of "my data didn't actually get reset" confusion, and also the exact command that accidentally destroys a dev database when someone assumes `-v` is harmless.
- Using a bind mount for a database data directory in production — file-locking, performance characteristics, and permission semantics of arbitrary host filesystems are not what database engines are tuned for; named/managed volumes (or cloud block storage via a volume driver) are the correct choice.

## Interview Questions & Answers

**Q: What's the actual difference between a named volume and a bind mount?**
A: A named volume is fully managed by Docker — you refer to it by name, Docker decides where it physically lives (under `/var/lib/docker/volumes/` by default), and it can be backed by pluggable drivers for cloud storage. A bind mount is a direct mapping of an existing host path into the container, with no abstraction — you specify the exact host path, and Docker has no involvement in managing or tracking it beyond the mount itself.

**Q: Why do bind mounts make sense for local development but not for production databases?**
A: In development you want instant visibility of source-code edits inside a running container, and you're working on a single known machine where the host path is stable and inspectable — that's exactly what a bind mount gives you for free. In production, you want Docker (or the orchestrator) to manage storage lifecycle, potentially back it with reliable cloud block storage, and not depend on a specific host's directory layout, which points to named volumes with an appropriate volume driver instead.

**Q: What is tmpfs and when would you use it over a volume?**
A: A tmpfs mount is backed entirely by host RAM and is never written to disk anywhere — not in the container's layer, not on the host filesystem. It's appropriate for secrets you don't want to risk persisting (even transiently) and for scratch/cache data where disk I/O would be a bottleneck. The tradeoff is that it counts against host memory and vanishes completely — including on container restart, not just removal.

**Q: If you run `docker-compose down` without `-v`, what happens to your named volumes?**
A: They're preserved. `down` stops and removes containers, networks, and (by default) anonymous volumes tied to those containers, but named volumes declared under the top-level `volumes:` key persist so the next `docker-compose up` reattaches to the same data. You must explicitly pass `-v`/`--volumes` to also drop named volumes.

**Q: How would you back a Docker named volume with cloud storage like AWS EBS or NFS instead of local disk?**
A: By specifying a non-default volume driver when creating the volume, e.g. `docker volume create --driver rexray/ebs --opt size=20 mydata`, or configuring a driver in the Compose file's `volumes:` section with `driver` and `driver_opts`. The volume is still referenced by name exactly as a local volume would be — the driver abstracts away where the bytes physically live, which is what makes stateful containers portable across hosts in a Swarm or orchestrated cluster.

## Related Topics
- [docker-components.md](./docker-components.md)
- [docker-compose.md](./docker-compose.md)
- [docker-compose-file.md](./docker-compose-file.md)
- [networks.md](./networks.md)
- [docker-in-production.md](./docker-in-production.md)
- [container-security.md](./container-security.md)
