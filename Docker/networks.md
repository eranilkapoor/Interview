# Docker Networking

Every container gets network connectivity through a driver, and the driver you choose determines how the container reaches other containers, the host, and the outside world. Docker ships five built-in drivers — `bridge`, `host`, `none`, `overlay`, and `macvlan` — each solving a different isolation/connectivity tradeoff, and picking the right one is a frequent source of "why can't these two containers talk to each other" debugging in interviews and in practice.

`bridge` is the default. When the daemon starts, it creates a virtual bridge interface on the host called `docker0`, and every container that doesn't specify a network gets attached to it with its own private IP in that bridge's subnet, NATed out through the host for external traffic. The critical gotcha: containers on this *default* bridge network can only reach each other by IP address, not by name — there's no built-in DNS resolution on `docker0`. This trips people up constantly because the fix is simple but non-obvious: create a user-defined bridge network with `docker network create mynet` and attach containers to it instead; Docker runs an embedded DNS server for every user-defined bridge network, so containers on it can resolve each other by container name or Compose service name out of the box. This is exactly why `docker-compose` "just works" for service-to-service calls like `http://db:5432` — Compose creates a dedicated user-defined bridge network for the project automatically and every service joins it.

`host` networking removes network isolation entirely — the container shares the host's network namespace directly, so a process listening on port 3000 inside the container is listening on port 3000 on the host, with no NAT and no port mapping layer. This means `-p` port publishing is meaningless (and disallowed) with `--network host`, and it gets you the best possible network throughput/latency since there's no virtual bridge or NAT translation in the path, at the cost of losing per-container network isolation and losing the ability to run two containers on the same host port. It's Linux-only — Docker Desktop on Mac/Windows runs containers inside a Linux VM, so `host` mode there means "shares the VM's namespace," not the actual Mac/Windows host's.

`none` disables networking entirely — the container gets only a loopback interface, no external connectivity at all. It's used for security-sensitive batch/compute workloads that should have zero ability to make network calls, deliberately, as a hard guarantee rather than a policy you hope holds.

`overlay` extends a virtual network across multiple Docker hosts, which is what makes Swarm services on different physical machines able to reach each other by service name as if they were on the same LAN — traffic between hosts is encapsulated (VXLAN) and can be encrypted. It requires a key-value store coordinated by Swarm's built-in raft consensus (you don't set this up manually; `docker swarm init` handles it) and is meaningless on a single, non-Swarm host.

`macvlan` assigns a container its own MAC address and IP address directly on the physical network, making it appear to the rest of the LAN as a distinct physical device rather than something behind the host's NAT. This is used when you need containers to be directly addressable on the same subnet as other physical machines — legacy applications that expect to bind to a "real" network-visible IP, or network appliances/monitoring tools that need to see genuine per-container MAC addresses.

## Examples

```bash
# Default bridge: no automatic DNS — containers must use IPs
docker run -d --name web1 nginx:alpine
docker run -it --rm alpine ping web1          # fails: name doesn't resolve
docker run -it --rm alpine ping 172.17.0.2    # works: direct IP on docker0

# User-defined bridge: automatic embedded DNS by container name
docker network create appnet
docker run -d --name web2 --network appnet nginx:alpine
docker run -it --rm --network appnet alpine ping web2   # resolves and succeeds
```
This is the concrete demonstration of the default-bridge-vs-user-defined-bridge gotcha: identical setup, but only the named network gives you name-based service discovery.

```yaml
# docker-compose.yml — Compose creates a project-scoped bridge network automatically
services:
  api:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - db
    environment:
      DATABASE_URL: postgres://user:pass@db:5432/appdb   # "db" resolves via embedded DNS

  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: pass
```
Running `docker compose up` here creates a network named `<projectdir>_default` (a user-defined bridge) and attaches both services to it, so `api` can reach `db` by that service name with no manual `docker network create` step — this is Compose's default behavior, not something declared explicitly in this file.

```bash
# host networking: no port mapping, container binds directly to the host's port
docker run -d --network host nginx:alpine
curl http://localhost:80     # reaches nginx directly, no -p flag involved

# inspecting and managing networks
docker network ls
docker network inspect appnet          # shows connected containers, subnet, gateway
docker network connect appnet web1     # attach an already-running container to a network
docker network rm appnet               # fails if containers are still attached
```
`docker network connect` is useful for attaching a container to a second network after the fact — containers can belong to multiple networks simultaneously, which is how you'd let a container reach both an internal `db` network and a public-facing `web` network without exposing the database to the public one.

## Common Pitfalls / Gotchas

- Assuming container-name DNS resolution works on the default `docker0` bridge — it doesn't; only user-defined bridge networks (and Compose's auto-created network) get the embedded DNS server.
- Using `--network host` on Docker Desktop for Mac/Windows and expecting it to bind to the actual host OS's ports — it binds to the Linux VM's network namespace that Docker Desktop runs inside, not the Mac/Windows host directly, so the ports may not behave exactly as expected.
- Trying to use `-p`/`--publish` with `--network host` — port publishing is a bridge-network/NAT concept; with host networking there's no mapping layer to configure, and Docker will ignore or reject the flag.
- Forgetting that `docker network rm` fails silently-ish (with an "active endpoints" error) if any container is still attached — you have to disconnect or stop those containers first.
- Deploying `overlay` networking outside of Swarm mode and expecting it to work — overlay networks require Swarm's raft-based control plane to coordinate, they aren't usable standalone the way bridge/host/none are.
- Two Compose projects both using default network names can collide or fail to isolate properly if you don't set an explicit `COMPOSE_PROJECT_NAME` or `name:` in the Compose file, since Compose derives the network name from the project/directory name by default.

## Interview Questions & Answers

**Q: Why can't two containers on the default bridge network reach each other by container name, but they can on a user-defined bridge?**
A: The default `docker0` bridge predates Docker's embedded DNS feature and never runs a DNS resolver for containers attached to it — they only get IP-based connectivity. User-defined bridge networks (created via `docker network create`, or automatically by Compose) run an embedded DNS server that registers each container's name and resolves it for every other container on that same network. This is purely a difference in which networks have DNS wired up, not a difference in underlying connectivity.

**Q: When would you use `host` networking instead of the default bridge?**
A: When you need maximum network performance with no NAT/bridge overhead — e.g. a high-throughput proxy or monitoring agent — or when an application needs to observe the host's real network interfaces directly rather than a virtualized one. The cost is losing per-container network isolation and port-mapping flexibility: the container's ports are the host's ports, full stop, so you also lose the ability to run multiple containers of the same service on different host ports.

**Q: What problem does `overlay` networking solve that `bridge` can't?**
A: `bridge` networks are local to a single Docker host — a bridge network's containers can't reach containers on a different host's bridge network at all. `overlay` networks span multiple hosts in a Swarm cluster, encapsulating container-to-container traffic (via VXLAN) so that services on different physical or virtual machines can address each other by name as if they were co-located, which is a prerequisite for running a multi-node Swarm service.

**Q: What's the difference between `none` and just not exposing any ports on a bridge network?**
A: Not exposing ports only prevents *inbound* connections from outside the container's network — the container can still make outbound calls and can still talk to other containers on the same bridge network. `--network none` removes networking capability entirely: the container has no interface but loopback, so it cannot make any outbound network call either. It's a much stronger guarantee, used for workloads that must be provably unable to exfiltrate data over the network.

**Q: How does Docker Compose decide what network to put your services on, and can you override it?**
A: By default, Compose creates one network per project (named after the project/directory, e.g. `myapp_default`) and attaches every service defined in the Compose file to it, giving them DNS-based discovery by service name automatically. You can override this by defining custom networks under the top-level `networks:` key and assigning specific services to specific networks — useful for isolating a database network from a public-facing network within the same Compose project.

## Related Topics
- [docker-compose.md](./docker-compose.md)
- [docker-compose-file.md](./docker-compose-file.md)
- [docker-swarm.md](./docker-swarm.md)
- [docker-components.md](./docker-components.md)
- [volumes.md](./volumes.md)
- [container-security.md](./container-security.md)
