# Kubernetes Overview

Kubernetes is a container orchestration system: given a fleet of machines and a set of containerized workloads, it decides which machine runs which container, keeps the actual state of the cluster converging toward the state you declared, and replaces or reschedules containers when they fail, when nodes die, or when you change the declared state. The unit of "declared state" is a set of API objects — Pods, Deployments, Services, and so on — stored as records in a cluster-wide datastore, and everything else in Kubernetes exists to keep the real world matching those records.

A cluster splits into a **control plane** and **worker nodes**. The control plane is the brain: the **API server** (`kube-apiserver`) is the single front door that every other component and every `kubectl` command talks to — it validates and persists objects; **etcd** is the distributed key-value store that durably holds all cluster state (every Pod spec, every Secret, every ConfigMap); the **scheduler** (`kube-scheduler`) watches for newly created Pods that have no node assigned and picks a node for them based on resource requests, affinity rules, taints/tolerations, and other constraints; and the **controller manager** (`kube-controller-manager`) runs the control loops — the Deployment controller, ReplicaSet controller, Node controller, and others — that each watch a slice of state and push the cluster toward what's declared. Worker nodes are where containers actually run: the **kubelet** is the agent on each node that talks to the API server, receives Pod specs assigned to that node, and tells the container runtime (containerd, CRI-O) to start/stop containers accordingly, plus runs liveness/readiness probes; **kube-proxy** programs the node's networking rules (iptables or IPVS) so traffic to a Service's virtual IP gets routed to the right backend Pods; and the **container runtime** is the actual engine (via the CRI — Container Runtime Interface) that pulls images and runs containers.

The single most important mental model in Kubernetes is the **reconciliation loop** (also called the desired-state/actual-state loop, or level-triggered control). You never tell Kubernetes "start 3 more Pods" as an imperative command that executes once — instead you declare "I want 3 replicas of this Pod template" as persistent desired state, and a controller continuously compares that desired state against the actual state it observes (via watches on the API server) and takes corrective action whenever they diverge: too few Pods, create more; too many, delete some; a node disappears, reschedule its Pods elsewhere. This is why Kubernetes is self-healing and why it's resilient to controllers restarting or missing individual events — a controller that crashes and restarts just re-reads current vs. desired state and resumes, rather than needing to replay a missed command.

Kubernetes' object model follows this loop pattern almost everywhere: `spec` (what you want) is user-supplied and desired, `status` (what's actually true) is written back by controllers, and the entire system is built from independent controllers each responsible for reconciling one kind of object, communicating only through the API server and etcd rather than talking to each other directly. Understanding this — that Kubernetes is a distributed system of controllers converging on declared state, not a command-and-control script runner — is the foundation every other topic in this folder builds on.

## Examples

```bash
# See the control plane and worker nodes in a cluster
kubectl get nodes -o wide
# NAME              STATUS   ROLES           VERSION
# control-plane-1   Ready    control-plane   v1.29.2
# worker-1          Ready    <none>          v1.29.2
# worker-2          Ready    <none>          v1.29.2
```

```bash
# Watch the reconciliation loop in action: scale a Deployment and observe
# the ReplicaSet controller create Pods to converge on the new desired state
kubectl create deployment nginx --image=nginx:1.25 --replicas=2
kubectl scale deployment nginx --replicas=5
kubectl get pods -l app=nginx -w
# New Pods appear one by one as the controller reconciles actual (2) toward desired (5)
```

```bash
# Inspect the core control-plane components running as static Pods
# (on a kubeadm-style cluster, these live in the kube-system namespace)
kubectl get pods -n kube-system
# kube-apiserver-control-plane-1
# etcd-control-plane-1
# kube-scheduler-control-plane-1
# kube-controller-manager-control-plane-1
# kube-proxy-worker-1
# kube-proxy-worker-2
```

## Common Pitfalls / Gotchas

- Treating `kubectl` commands as imperative one-shot actions instead of understanding that most of them write desired state to etcd via the API server, and a controller does the actual work asynchronously — this is why a `kubectl delete pod` on a Pod owned by a Deployment doesn't actually reduce your replica count, a new Pod is created immediately to replace it.
- Assuming etcd is just a cache — it's the single source of truth for the entire cluster; losing etcd without a backup means losing the cluster's state entirely, which is why etcd backup/restore is a real production concern, not an afterthought.
- Forgetting that the scheduler only *assigns* a node to a Pod once — it doesn't continuously rebalance Pods across nodes afterward (that's what descheduler add-ons or the Cluster Autoscaler handle separately).
- Confusing "the control plane is highly available" with "my application is highly available" — control-plane HA (multiple API server/etcd replicas) protects cluster management operations; your application's availability still depends on replica count, PodDisruptionBudgets, and spreading Pods across nodes/zones.
- Not realizing kube-proxy's iptables/IPVS rules are node-local — a newly joined node needs kube-proxy running before Service traffic can be routed correctly through it.

## Interview Questions & Answers

**Q: What is the reconciliation loop, and why is it central to how Kubernetes works?**
A: It's the pattern where a controller continuously compares desired state (the `spec` you declared) against observed actual state (the `status`) and issues corrective actions to close any gap, rather than executing a one-time imperative command. It's central because nearly every Kubernetes behavior — self-healing, rolling updates, autoscaling — is just a specific controller running this same loop. It also makes the system resilient: a controller can crash, restart, or miss an individual event and still converge correctly because it re-derives what to do from current state rather than relying on a command history.

**Q: What's the difference between the API server, etcd, and the controller manager?**
A: The API server is the stateless front door — it validates requests, enforces authn/authz, and is the only component that talks directly to etcd. etcd is the durable, distributed key-value store that actually holds all cluster state. The controller manager runs the reconciliation loops (Deployment controller, Node controller, etc.) that watch the API server for changes and take action — it never touches etcd directly, only through the API server.

**Q: What happens, step by step, when you run `kubectl apply -f deployment.yaml`?**
A: `kubectl` sends the manifest to the API server, which validates it and persists it to etcd, then the Deployment controller (in the controller manager) notices the new/changed Deployment and creates or updates a ReplicaSet; the ReplicaSet controller in turn notices it doesn't have enough Pods matching its selector and creates Pod objects (still unscheduled); the scheduler notices unscheduled Pods and assigns each one to a node; the kubelet on that node notices a Pod has been assigned to it and instructs the container runtime to pull the image and start the container, then reports status back through the API server.

**Q: Why does Kubernetes use a declarative model instead of an imperative one, and what's the tradeoff?**
A: Declarative state lets the system self-heal and survive partial failures — you describe the end state once, and controllers keep re-driving toward it regardless of what goes wrong in between, which is essential at cluster scale where nodes and processes fail constantly. The tradeoff is that it's harder to reason about "what will happen right now" from a single command, since the actual change happens asynchronously through however many controllers are involved, and debugging requires understanding which controller owns which part of the convergence rather than reading a linear script.

**Q: What's the difference between the kubelet and kube-proxy?**
A: The kubelet is the node agent responsible for the Pod lifecycle — it receives Pod specs for its node, talks to the container runtime to actually run containers, runs liveness/readiness/startup probes, and reports Pod status back to the API server. kube-proxy is only concerned with networking — it watches Services and Endpoints and programs the node's packet-forwarding rules (iptables/IPVS) so traffic sent to a Service's ClusterIP gets load-balanced to the right backend Pod IPs. Neither talks to the other; both independently watch the API server.

## Related Topics

- [pods.md](./pods.md)
- [deployments.md](./deployments.md)
- [services.md](./services.md)
- [namespaces.md](./namespaces.md)
- [troubleshooting.md](./troubleshooting.md)
