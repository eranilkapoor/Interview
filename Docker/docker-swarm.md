# Docker Swarm

Swarm is Docker's built-in clustering and orchestration mode — it takes a group of Docker hosts (physical or virtual machines, each running the Docker daemon) and turns them into a single logical cluster you can deploy services onto, without installing any separate orchestrator. It ships inside the Docker Engine itself; running `docker swarm init` on one host is enough to turn "a machine with Docker on it" into "a one-node Swarm cluster," and you scale it out from there by joining more nodes.

A Swarm cluster is made of **manager** nodes and **worker** nodes. Managers maintain the cluster's desired state (which services should exist, how many replicas, which networks/secrets are defined) and handle scheduling — deciding which node each task/container should run on. Workers just execute the tasks they're assigned; they don't participate in cluster-management decisions. Managers agree on cluster state using the **Raft consensus algorithm**: an odd number of managers (3, 5, 7 — never an even number, since Raft needs a majority quorum) replicate the cluster state log among themselves, so the cluster tolerates the loss of up to `(N-1)/2` managers without losing the ability to make decisions or losing data — with 3 managers you can lose 1 and stay available; with 5 you can lose 2. A single-manager Swarm works fine for dev/test but has no tolerance for that manager going down; production Swarm clusters use 3 or 5 managers specifically for this fault tolerance. Managers can also act as workers by default (they'll run application tasks alongside management duties) unless you explicitly drain them with `docker node update --availability drain`, which is common in production so management capacity isn't competing with application load.

The unit of deployment in Swarm is a **service**, not a bare container — `docker service create --name web --replicas 3 nginx:1.27` tells the cluster "I want 3 replicas of this task running, always," and Swarm's manager continuously reconciles actual state toward that desired state: if a task dies or the node running it goes down, Swarm schedules a replacement elsewhere in the cluster automatically, with no manual intervention. This reconciliation loop is the core value proposition over plain `docker run` — it's genuine self-healing across the whole cluster, not just a per-container restart policy on a single host. Multiple services are normally deployed together as a **stack**, using the same Compose file format (v3+) you'd use with `docker compose` locally: `docker stack deploy -c docker-compose.yml myapp` reads the file's `services:` and turns each into a Swarm service, using the `deploy:` key for Swarm-specific settings (replicas, resource limits, update/rollback config, placement constraints) that plain Compose ignores.

Cross-host container-to-container communication is handled by **overlay networks** — a virtual network (using VXLAN encapsulation) that spans every node in the cluster, so containers on different physical hosts can reach each other by service name exactly as if they were on the same Docker bridge network locally; `docker network create -d overlay my-net` creates one, and services attached to it get automatic DNS-based service discovery and built-in load balancing across replicas (via the internal "VIP" — virtual IP — or DNS round-robin mode). Rolling updates are handled with `docker service update` (e.g., `docker service update --image my-api:1.5.0 web`), which replaces replicas incrementally according to the service's configured `update-parallelism` and `update-delay`, and can be configured to auto-rollback if health checks fail during the rollout. Scaling is just `docker service scale web=6` (or editing `replicas` in the stack file and redeploying), and Swarm handles redistributing tasks across available nodes to satisfy the new count, respecting any placement constraints you've defined.

## Examples

```bash
# Initialize a Swarm on the first manager node, then join workers/managers from other hosts
docker swarm init --advertise-addr 192.168.1.10
# Output includes a join token; run the printed command on other nodes, e.g.:
docker swarm join --token SWMTKN-1-xxxx 192.168.1.10:2377
```

`--advertise-addr` tells other nodes which IP to reach this manager on; the join token differs for worker vs. manager roles (`docker swarm join-token worker` / `docker swarm join-token manager` retrieve them later).

```bash
# Create a replicated service on an overlay network, then scale and roll out an update
docker network create -d overlay backend-net
docker service create --name web --replicas 3 --network backend-net -p 8080:80 nginx:1.27
docker service scale web=6
docker service update --image nginx:1.27.1 --update-parallelism 2 --update-delay 10s web
```

`--update-parallelism 2 --update-delay 10s` rolls the new image out two tasks at a time with a 10-second pause between batches, rather than replacing all 6 replicas simultaneously.

```yaml
# docker-compose.yml deployed as a Swarm stack (uses the `deploy` key, Swarm-only)
services:
  web:
    image: my-api:1.5.0
    ports:
      - "8080:80"
    networks:
      - backend
    deploy:
      replicas: 4
      update_config:
        parallelism: 1
        delay: 15s
        failure_action: rollback
      restart_policy:
        condition: on-failure
      placement:
        constraints:
          - node.role == worker

networks:
  backend:
    driver: overlay
```

```bash
docker stack deploy -c docker-compose.yml myapp
```

`deploy.update_config.failure_action: rollback` makes Swarm automatically revert to the previous version if the rollout's health checks fail; `placement.constraints` keeps this service off manager nodes.

## Common Pitfalls / Gotchas

- Running a production Swarm with an even number of managers, or just 1 — an even count doesn't improve fault tolerance over the next-lower odd count (5 managers tolerate the same 2 failures as... actually fewer than 7), and a single manager means the cluster has zero tolerance for that node failing.
- Forgetting that a plain `docker-compose.yml`'s `deploy:` key is silently ignored by `docker compose up` locally — it only takes effect when the same file is used with `docker stack deploy`, which surprises people who expect resource limits to apply in both contexts.
- Not draining manager nodes (`docker node update --availability drain`), so application containers compete with the manager's Raft/scheduling workload for resources on busy clusters.
- Assuming `docker service scale` guarantees even distribution across nodes — placement also depends on constraints, resource reservations, and current load; it's "best effort reconciliation," not a guaranteed even spread.
- Losing quorum by taking down too many managers at once (more than `(N-1)/2`) — the cluster becomes unable to schedule or reconcile anything, even though existing running containers keep running until they exit.

## Interview Questions & Answers

**Q: What's the difference between a manager node and a worker node in Swarm?**
A: Managers maintain the cluster's desired state and make scheduling decisions, replicating that state among themselves via Raft consensus; workers just execute the tasks assigned to them and have no say in cluster-wide decisions. Managers can also run application workloads by default unless explicitly drained, but only managers participate in the Raft quorum that keeps the cluster's state consistent.

**Q: Why does Swarm recommend an odd number of manager nodes, like 3 or 5?**
A: Raft consensus requires a strict majority of managers to agree before cluster state changes are committed, so with N managers the cluster tolerates up to `floor((N-1)/2)` manager failures while still functioning. An odd count maximizes fault tolerance per manager added — 3 managers tolerate 1 failure, 5 tolerate 2 — while an even number (say 4) tolerates the same 1 failure as 3 but costs an extra node, so there's no benefit to even counts.

**Q: How does a Swarm service differ from just running containers with `docker run --restart=always` on several hosts manually?**
A: A service is a declarative desired-state object owned by the cluster's managers — you declare "N replicas of this image," and Swarm continuously reconciles actual running tasks toward that count across the *entire cluster*, automatically rescheduling a task onto a different node if the one it was on fails. `docker run --restart=always` only recovers a container on the same host it was already running on; if that host goes down, nothing brings it back elsewhere without manual intervention.

**Q: What is an overlay network in Swarm, and why is it needed?**
A: It's a virtual, cluster-spanning network (built on VXLAN encapsulation) that lets containers on different physical/VM hosts communicate as if they were on the same local Docker network, with built-in service-name DNS resolution and load balancing across a service's replicas. It's needed because Swarm services can be scheduled onto any node in the cluster, and a normal single-host bridge network has no way to route traffic between containers that end up on different machines.

**Q: How would you roll out a new image version to a running Swarm service with minimal downtime, and how would a bad rollout get reverted?**
A: `docker service update --image <new-image> <service>`, configured with `--update-parallelism` and `--update-delay` (or the stack file's `deploy.update_config`) to replace replicas incrementally rather than all at once, so capacity is never fully drained. If `update_config.failure_action` is set to `rollback` and the new tasks fail their health checks during the rollout, Swarm automatically reverts the service to its previous image/config without manual intervention; otherwise you can trigger `docker service rollback <service>` manually.

## Related Topics

- [docker-swarm-vs-kubernetes.md](./docker-swarm-vs-kubernetes.md)
- [docker-in-production.md](./docker-in-production.md)
- [docker-compose.md](./docker-compose.md)
- [docker-compose-file.md](./docker-compose-file.md)
- [networks.md](./networks.md)
- [docker-registry.md](./docker-registry.md)
