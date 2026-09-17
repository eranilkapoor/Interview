# Pods

A Pod is the smallest deployable unit in Kubernetes — not a container. You never schedule a bare container directly; you always schedule a Pod, which is a wrapper around one or more containers that are guaranteed to be co-located on the same node and share certain resources. This distinction matters because a lot of what looks like "container configuration" in Kubernetes (networking, some volumes, lifecycle) is actually scoped at the Pod level, shared by everything inside it.

Containers within a single Pod share a **network namespace**: they all see the same IP address and port space, so they can reach each other over `localhost`, and the Pod as a whole gets one cluster-routable IP shared across containers. They can also share **volumes** — a volume defined at the Pod level can be mounted into multiple containers in that Pod, letting them exchange data through the filesystem. What they do *not* share by default is process namespace or filesystem — each container still has its own isolated root filesystem and process tree unless you explicitly opt into `shareProcessNamespace`. This is why the most common multi-container pattern is the **sidecar**: a main application container paired with a helper container (a log shipper, a service-mesh proxy like Envoy, a config-reloader) that needs network/volume proximity to the main container but should remain a separately versioned, separately restartable unit. A related but distinct pattern is the **init container** — a container that runs to completion *before* any regular containers start, commonly used to wait for a dependency or seed a shared volume; unlike sidecars, init containers run sequentially and must each exit successfully before the next starts.

A Pod moves through a defined set of **phases** over its lifecycle: `Pending` (accepted by the cluster but one or more containers aren't running yet — commonly waiting to be scheduled or waiting on an image pull), `Running` (bound to a node and at least one container is running), `Succeeded` (all containers terminated successfully and won't restart — typical for Jobs), `Failed` (all containers terminated and at least one terminated in failure), and `Unknown` (the Pod's state can't be determined, usually a node communication problem). Within `Running`, individual containers also have their own states (`Waiting`, `Running`, `Terminated`) visible via `kubectl describe pod`. Kubernetes also uses three kinds of **probes** to make lifecycle decisions about a container: a **liveness probe** determines if a container is still healthy — if it fails, the kubelet kills and restarts the container; a **readiness probe** determines if a container is ready to accept traffic — if it fails, the Pod is removed from Service endpoints without being restarted; and a **startup probe** delays the other two probes until a slow-starting application has finished initializing.

Pods are meant to be treated as **ephemeral and disposable** — you almost never create a bare Pod directly in production. Instead you create a higher-level controller (a Deployment, StatefulSet, DaemonSet, or Job) that owns a Pod template and manages the actual Pod objects on your behalf, recreating them under a new name/IP whenever they die. This is a frequent interview trip-up: a Pod created directly has no controller watching over it, so if it crashes or its node dies, nothing brings it back — that's specifically why Deployments exist as a layer on top.

## Examples

```yaml
# A minimal multi-container Pod: app container + sidecar sharing a volume
apiVersion: v1
kind: Pod
metadata:
  name: web-with-sidecar
  labels:
    app: web
spec:
  containers:
    - name: app
      image: myregistry/web-app:1.4.0
      ports:
        - containerPort: 8080
      volumeMounts:
        - name: shared-logs
          mountPath: /var/log/app
      readinessProbe:
        httpGet:
          path: /healthz
          port: 8080
        initialDelaySeconds: 5
        periodSeconds: 10
      livenessProbe:
        httpGet:
          path: /healthz
          port: 8080
        initialDelaySeconds: 15
        periodSeconds: 20
    - name: log-shipper
      image: fluent/fluent-bit:2.2
      volumeMounts:
        - name: shared-logs
          mountPath: /var/log/app
          readOnly: true
  volumes:
    - name: shared-logs
      emptyDir: {}
```

```yaml
# An init container that waits for a dependency before the main app starts
apiVersion: v1
kind: Pod
metadata:
  name: app-with-init
spec:
  initContainers:
    - name: wait-for-db
      image: busybox:1.36
      command: ['sh', '-c', 'until nc -z postgres-svc 5432; do sleep 2; done']
  containers:
    - name: app
      image: myregistry/web-app:1.4.0
```

```bash
# Inspect a Pod's phase, container states, and recent events
kubectl get pod web-with-sidecar -o wide
kubectl describe pod web-with-sidecar
# Look at the Events section at the bottom for scheduling/pull/probe failures

# Stream logs from one container in a multi-container Pod
kubectl logs web-with-sidecar -c log-shipper -f
```

## Common Pitfalls / Gotchas

- Creating bare Pods directly in production manifests instead of through a Deployment/StatefulSet/Job — a standalone Pod has no controller to recreate it if it crashes or its node fails.
- Confusing liveness and readiness probes — a failing liveness probe restarts the container (which does nothing to fix a slow dependency and can cause restart loops), while a failing readiness probe should be used to pull the Pod out of load-balancing without killing it.
- Putting unrelated containers in one Pod for convenience — containers in a Pod are always scheduled, scaled, and restarted together, so bundling things that have independent scaling needs (e.g., app and database) defeats the point of separate deployability.
- Forgetting that `emptyDir` volumes used to share data between containers in a Pod are deleted when the Pod is removed — they are not a substitute for persistent storage.
- Not setting resource `requests`/`limits` on every container — an unset request makes the Pod `BestEffort` QoS class, making it the first thing evicted under node memory pressure.

## Interview Questions & Answers

**Q: Why is the Pod, not the container, the smallest deployable unit in Kubernetes?**
A: Because real applications often need more than one tightly coupled process running together — a main process plus a proxy, log shipper, or config watcher — and Kubernetes needs a unit that guarantees those processes land on the same node, share a network identity (so they can talk over `localhost`), and can share storage. Scheduling, scaling, and networking are all defined at the Pod level specifically so that a group of containers with this kind of tight coupling can be treated as one atomic thing.

**Q: What's the difference between a sidecar container and an init container?**
A: An init container runs to completion before any regular container starts, and if there are multiple, they run one at a time in order — used for one-time setup like waiting on a dependency or seeding a volume. A sidecar runs alongside the main container for the Pod's entire lifetime, sharing its network and optionally its volumes, typically providing an ongoing supporting function (proxying, log shipping, metrics scraping) rather than a one-time setup step.

**Q: What's the difference between a liveness probe and a readiness probe, and what happens when each fails?**
A: A liveness probe answers "is this container still working correctly?" — if it fails, the kubelet kills the container and restarts it according to the Pod's restart policy. A readiness probe answers "is this container currently able to serve traffic?" — if it fails, the Pod is removed from the Endpoints of any Service selecting it (so traffic stops being routed to it), but the container itself is left running and untouched. Using a liveness probe where a readiness probe belongs is a common mistake — it turns a temporary dependency slowdown into an unnecessary restart loop.

**Q: A Pod you created directly (not via a Deployment) just died. What happens to it?**
A: Nothing brings it back. A bare Pod has no owning controller watching desired vs. actual state, so once it's deleted or its node fails, it's simply gone — `kubectl get pods` will show it as `Failed` or it will disappear entirely if the node itself was lost. This is exactly why Deployments/ReplicaSets exist: they own a Pod template and continuously ensure the declared replica count is actually running.

**Q: How would you debug a Pod that's stuck in `Pending`?**
A: Run `kubectl describe pod <name>` and read the Events section — it will usually show a scheduling failure reason directly, such as insufficient CPU/memory on all nodes, an unsatisfied node affinity/taint rule, or an unbound PersistentVolumeClaim the Pod depends on. If Events show nothing useful, check `kubectl get nodes` for node readiness and `kubectl top nodes` for actual available capacity, since `Pending` almost always means the scheduler could not find (or is still waiting to find) a node that satisfies the Pod's requirements.

## Related Topics

- [kubernetes-overview.md](./kubernetes-overview.md)
- [deployments.md](./deployments.md)
- [services.md](./services.md)
- [configmaps-and-secrets.md](./configmaps-and-secrets.md)
- [troubleshooting.md](./troubleshooting.md)
