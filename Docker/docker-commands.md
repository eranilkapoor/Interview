# Docker Commands

The Docker CLI is organized around two nouns you manipulate constantly — images (immutable build artifacts) and containers (running or stopped instances of an image) — plus supporting commands for logs, networks, and cleanup. Most day-to-day work happens through `docker run` to create and start a container, `docker ps` to see what's running, `docker exec` to get inside a live container, and `docker logs` to see what it's printed. Understanding the exact flags matters in interviews because they signal whether you've actually operated containers versus just read about them — for example, knowing that `-p` publishes a port mapping while `-P` (capital) publishes *all* exposed ports to random host ports, or that `--rm` and `-d` are frequently combined but solve different problems.

A second cluster of commands manages the image lifecycle: `docker build` compiles a Dockerfile into an image, `docker pull`/`docker push` move images to and from a registry, and `docker images`/`docker rmi` list and delete local images. Because Docker caches build layers and keeps stopped containers and dangling images around by default, disk usage grows quietly over time — `docker system prune` (and its more aggressive `-a` variant) is the standard remedy, and knowing what it deletes (and what it deliberately leaves alone, like named volumes, unless you pass `--volumes`) is a common practical question.

The distinction between stopping, killing, and removing a container also comes up frequently: `docker stop` sends SIGTERM then SIGKILL after a grace period (default 10s), `docker kill` sends SIGKILL immediately, and `docker rm` deletes the container's writable layer and metadata entirely — you generally can't `rm` a running container without `-f`. Being fluent with these commands, and able to read their output (container IDs, exit codes, port mappings), is what separates "knows Docker exists" from "has run Docker in anger."

## Examples

```bash
# Run an nginx container in detached mode, map host port 8080 to container port 80,
# name it for easy reference, mount a host directory as a volume, and auto-remove on exit
docker run -d --name web -p 8080:80 -v $(pwd)/html:/usr/share/nginx/html:ro --rm nginx:1.27-alpine

# -d          detach (run in background, prints container ID)
# --name web  give it a human-readable name instead of a random one
# -p 8080:80  host:container port mapping
# -v ...:ro   bind mount, read-only inside the container
# --rm        remove the container automatically when it stops
```

This is the single most-used command in Docker: it pulls the image if not present locally, creates a container, and starts it with the given configuration.

```bash
# Inspect what's running, tail logs, and get an interactive shell inside a live container
docker ps                                    # running containers only
docker ps -a                                 # include stopped/exited containers too
docker logs -f --tail 100 web                # follow logs, starting from the last 100 lines
docker exec -it web sh                       # open an interactive shell inside the running container
```

`docker exec` runs a *new* process inside an *already-running* container's namespaces — it does not start the container. `-it` combines `-i` (keep STDIN open) and `-t` (allocate a pseudo-TTY), which is what makes the shell interactive.

```bash
# Build an image with a build-time argument, tag it, and push it to a registry
docker build -t myorg/api:1.4.0 -f Dockerfile.prod --build-arg NODE_ENV=production --no-cache .
docker tag myorg/api:1.4.0 myorg/api:latest
docker push myorg/api:1.4.0
docker push myorg/api:latest

# Clean up unused images, stopped containers, and networks to reclaim disk space
docker system prune -a --volumes
```

`--no-cache` forces every layer to rebuild instead of reusing Docker's layer cache — useful when you suspect a stale cached `RUN apt-get update` layer is masking newer packages. `docker system prune -a --volumes` is destructive: `-a` also removes unused (not just dangling) images, and `--volumes` removes unused named volumes, so it's not something you run against a host with data you care about without checking first.

## Common Pitfalls / Gotchas

- Forgetting `-a` on `docker ps` and concluding a container "doesn't exist" when it actually exited and is just hidden from the default running-only view.
- Confusing `docker stop` (graceful SIGTERM, then SIGKILL after the timeout) with `docker kill` (immediate SIGKILL) — using `kill` on a database container can corrupt in-flight writes.
- Running `docker rm` on a container that's still running and being surprised by the error; reaching for `-f` habitually instead of stopping it properly, which skips graceful shutdown.
- Mixing up `-p` (explicit host:container port mapping) with `-P` (publish all `EXPOSE`d ports to random ephemeral host ports) — `-P` is rarely what you want outside of quick testing.
- Assuming `docker system prune` deletes volumes — by default it does not; you must pass `--volumes` explicitly, which is a deliberate safety default since volumes usually hold data.
- Using `docker build` without `-t` and ending up with an untagged, `<none>:<none>` image that's hard to reference afterward except by its ID.

## Interview Questions & Answers

**Q: What's the difference between `docker stop` and `docker kill`?**
A: `docker stop` sends SIGTERM to the container's main process, giving it a grace period (10 seconds by default, configurable with `-t`) to shut down cleanly, then sends SIGKILL if it hasn't exited. `docker kill` sends SIGKILL (or another signal you specify with `-s`) immediately, with no chance for the process to clean up — open file handles, in-flight transactions, or connection draining are all abandoned.

**Q: What does `docker exec` actually do, and how is it different from `docker run`?**
A: `docker run` creates a brand-new container from an image and starts it. `docker exec` starts an additional process inside a container that is already running, sharing its namespaces (filesystem, network, PID). You use `run` to create the container in the first place and `exec` to inspect or interact with one that's already alive, e.g., `docker exec -it <container> sh` to get a shell.

**Q: How do you find out why a container exited?**
A: `docker ps -a` shows the exit code in the STATUS column (e.g., `Exited (137) 2 minutes ago`); 137 = 128 + 9 means it was SIGKILLed, often by the OOM killer. `docker logs <container>` shows stdout/stderr from the process up to the point it died. `docker inspect <container>` gives the full JSON, including `State.OOMKilled` and `State.ExitCode`, for deeper diagnosis.

**Q: What's the difference between `docker images -a`/dangling images and what `docker system prune` removes?**
A: A dangling image is one with no tag, usually left behind when you rebuild an image with the same tag (the old layer set becomes `<none>:<none>`). Plain `docker system prune` removes stopped containers, dangling images, unused networks, and build cache. Adding `-a` extends image removal to *all* images not referenced by any container (not just dangling ones); adding `--volumes` additionally removes unused named volumes, which is the only part of prune that can lose persistent data.

**Q: How would you pass a secret API key into a container at runtime without baking it into the image?**
A: Use `-e KEY=value` (or `--env-file` for many at once) on `docker run` to inject it as an environment variable at container start, not at build time. This keeps the secret out of the image layers (and out of `docker history`), unlike using `ARG`/`ENV` inside the Dockerfile, which would persist it into the built image or its build history.

## Related Topics
- [docker-file.md](./docker-file.md)
- [docker-components.md](./docker-components.md)
- [docker-compose.md](./docker-compose.md)
- [images-and-containers.md](./images-and-containers.md)
- [docker-registry.md](./docker-registry.md)
- [container-security.md](./container-security.md)
