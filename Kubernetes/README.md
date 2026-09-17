# Kubernetes Interview Preparation

This folder is a focused Kubernetes interview-prep guide, built around 10 topic files. Each file follows the same structure: a real conceptual explanation of the topic, 2-3 working YAML manifests and kubectl command examples, common pitfalls, a set of interview Q&A pairs, and links to closely related topics in this folder. The goal is depth over breadth — every file is written to survive a senior-level follow-up question ("why", "what breaks", "how would you debug it"), not just recite a definition.

## Table of Contents

### Architecture & Core Objects
- [Kubernetes Overview](./kubernetes-overview.md) — control plane (API server, etcd, scheduler, controller manager) vs worker nodes (kubelet, kube-proxy, container runtime), the reconciliation loop
- [Pods](./pods.md) — the smallest deployable unit, multi-container patterns (sidecar/init container), shared network namespace, lifecycle phases and probes
- [Deployments](./deployments.md) — the Deployment → ReplicaSet → Pod hierarchy, rolling updates, rollback, replica management

### Networking & Exposure
- [Services](./services.md) — ClusterIP/NodePort/LoadBalancer/ExternalName, DNS-based service discovery, selectors, kube-proxy mechanics
- [Ingress](./ingress.md) — L7 routing vs Services' L4, Ingress controllers, host/path-based routing, TLS termination

### Configuration & Storage
- [ConfigMaps and Secrets](./configmaps-and-secrets.md) — ConfigMap vs Secret, why base64 is not encryption, env var vs volume mount consumption and update propagation
- [Persistent Volumes](./persistent-volumes.md) — PV vs PVC, StorageClass and dynamic provisioning, access modes (RWO/ROX/RWX), reclaim policies
- [Namespaces](./namespaces.md) — logical (not network) isolation, ResourceQuotas, the `default`-namespace pitfall, cross-namespace DNS

### Scaling & Operations
- [Scaling and Autoscaling](./scaling-and-autoscaling.md) — manual scaling, HPA (CPU/memory/custom metrics), VPA, Cluster Autoscaler, how the three layers interact

### Package Management & Troubleshooting
- [Helm](./helm.md) — charts, templates, values.yaml, releases and revisions, install/upgrade/rollback
- [Troubleshooting](./troubleshooting.md) — `kubectl describe`/`logs`/`exec`, CrashLoopBackOff, ImagePullBackOff, Pending pods, OOMKilled, reading Events

## Interview Questions & Answers — Curated

**Beginner**

**Q: What is a Pod, and why isn't a container itself the smallest deployable unit?**
A: A Pod is the smallest deployable unit — a wrapper around one or more containers that are guaranteed to be scheduled together, share a network namespace (so they can talk over `localhost` and share one Pod IP), and can share volumes. Kubernetes needs a unit larger than a single container because real workloads often need tightly coupled helper processes (a sidecar proxy, a log shipper) that must be co-located with the main container, not just a bare process boundary.

**Q: ClusterIP vs NodePort vs LoadBalancer — what's the difference?**
A: ClusterIP is internal-only, reachable only from inside the cluster — the default and the right choice for service-to-service traffic. NodePort builds on it by also opening a static port on every node's IP, making it reachable from outside the cluster via any node's address, but with no real load balancing across nodes. LoadBalancer builds on NodePort by having the cloud provider provision an actual external load balancer targeting that NodePort — the standard way to expose a service to the internet on a managed cloud cluster.

**Q: What is the difference between a ConfigMap and a Secret?**
A: Both hold key-value configuration data and are consumed by Pods the same way (as env vars or mounted volumes), but a Secret's values are base64-encoded and Kubernetes applies slightly more protection around it by default (excluded from some describe output, eligible for etcd encryption at rest, usually tighter RBAC). Base64 is an encoding, not encryption — anyone with read access to the Secret object can trivially decode it, so real protection comes from RBAC and etcd encryption, not the Secret kind itself.

**Q: What causes `CrashLoopBackOff`?**
A: The container is starting and then exiting repeatedly, and Kubernetes keeps restarting it with an increasing backoff delay. It's virtually always an application-level issue — an unhandled exception, missing required config, or a failed dependency check at startup — debugged with `kubectl logs <pod> --previous` to see the crashed instance's own output, not the fresh restart's empty log.

**Q: What does `kubectl describe pod` show that `kubectl get pod` doesn't?**
A: `kubectl get pod` gives a one-line summary (name, status, restart count). `kubectl describe pod` gives the full spec/status plus, critically, the Events section — a chronological log of everything the cluster's controllers observed happening to that Pod (scheduling decisions, image pulls, probe failures). Most "why is this broken" questions are answered by Events before logs are even needed.

**Intermediate**

**Q: How does a Deployment perform a rolling update?**
A: Changing the Pod template inside a Deployment creates a brand-new ReplicaSet with the updated template; the Deployment controller then gradually scales the new ReplicaSet up and the old one down, bounded by `maxSurge` (extra Pods allowed above desired count) and `maxUnavailable` (how far below desired count is tolerated). New Pods only count as successfully rolled out once they pass their readiness probe, which is what makes a broken new version stall the rollout instead of taking the whole service down at once.

**Q: Why does the Deployment → ReplicaSet → Pod hierarchy exist instead of Deployments managing Pods directly?**
A: The extra ReplicaSet layer is what makes rollback cheap. Every template change creates a new ReplicaSet rather than mutating the old one in place, and the old ReplicaSet is kept around (scaled to zero, up to `revisionHistoryLimit`) instead of deleted — so `kubectl rollout undo` just re-scales a previous ReplicaSet back up rather than having to reconstruct an old Pod template from scratch.

**Q: How does a Pod discover another service just by name?**
A: Cluster DNS (typically CoreDNS) automatically creates a record for every Service as `<name>.<namespace>.svc.cluster.local`, and a Pod's default DNS search path auto-appends its own namespace — so a bare name resolves within the same namespace, while reaching a Service in a different namespace needs the namespace-qualified form.

**Q: What's the difference between a liveness probe and a readiness probe?**
A: A failing liveness probe causes the kubelet to kill and restart the container — it answers "is this still working?" A failing readiness probe removes the Pod from Service Endpoints without restarting it — it answers "can this currently serve traffic?" Using a liveness probe where a readiness probe belongs turns a temporary slow dependency into an unnecessary restart loop instead of just pausing traffic to that Pod.

**Q: Does a running Pod automatically pick up a ConfigMap or Secret change?**
A: Depends on how it's consumed. Environment variables are resolved once at container start and never refresh — the Pod needs a restart. Volume-mounted ConfigMaps/Secrets are updated on disk automatically by the kubelet, but only after a propagation delay (roughly up to its sync period) and not at all if `subPath` is used, and even then the application has to actively watch and reload the file itself.

**Q: What's the difference between a Service and an Ingress?**
A: A Service operates at L4 — it load-balances by IP and port with no awareness of HTTP content. Ingress operates at L7 — it routes based on hostname and URL path, letting many backend Services be exposed through one external entry point instead of provisioning a separate LoadBalancer per service. Ingress routes to Services, it doesn't replace them, and it does nothing at all without an Ingress controller actually running in the cluster to implement the rules.

**Q: What's the difference between a PersistentVolume and a PersistentVolumeClaim?**
A: A PersistentVolume is the actual storage resource — a real disk or share, either pre-provisioned or dynamically created. A PersistentVolumeClaim is a request for storage made by a Pod/user, stating requirements like size and access mode without referencing a specific PV. Kubernetes binds a PVC to a matching PV, and Pods mount the PVC, never the PV directly, which keeps application manifests portable across clusters with different storage backends.

**Advanced**

**Q: How does HPA decide to scale, and what does it actually change?**
A: HPA runs a control loop (roughly every 15 seconds by default) that fetches the current value of a target metric (CPU/memory via metrics-server, or a custom/external metric) across the workload's Pods, compares it to the configured target, and computes a new desired replica count proportionally. It doesn't talk to Pods directly — it only updates the `replicas` field on the Deployment/StatefulSet, and the existing ReplicaSet mechanism handles the actual Pod creation, making HPA effectively an automated version of `kubectl scale`.

**Q: HPA is at `maxReplicas` but new Pods are stuck `Pending`. What's actually happening?**
A: HPA has hit its configured ceiling and won't request more Pods regardless of the metric, so first check if `maxReplicas` is simply too low for peak load. Separately, `Pending` Pods mean the cluster doesn't have room to schedule them regardless of what HPA requests — check whether Cluster Autoscaler is enabled and not blocked (by PodDisruptionBudgets, cloud quota, or instance-type exhaustion), since HPA raising desired replicas is necessary but not sufficient without something adding node capacity.

**Q: Why can VPA and HPA conflict when applied to the same workload on the same metric?**
A: If VPA (in `Auto` mode) raises a Pod's CPU request, that changes the denominator HPA uses to compute utilization percentage for the same underlying CPU usage — so the two controllers can end up reacting to each other's changes rather than to real load, causing oscillation. The safer pattern is VPA managing requests (often in recommendation-only mode) while HPA scales on an independent signal like a custom application metric.

**Q: Explain ReadWriteOnce vs ReadWriteMany and a real incident caused by confusing them.**
A: RWO allows the volume to be mounted read-write by only one node at a time — most cloud block storage (EBS, Persistent Disk) is RWO-only. RWX allows concurrent read-write mounting from many nodes but requires a backend that supports it (NFS, EFS, a distributed filesystem). Scaling a Deployment that mounts an RWO PVC to multiple replicas is a classic incident: the first Pod grabs the volume, and every other replica lands on a different node and sits `Pending` indefinitely because the volume can't attach read-write to two nodes at once.

**Q: How does `helm rollback` actually work under the hood?**
A: Helm doesn't recompute anything at rollback time — every revision already has its fully rendered manifest stored (as a Secret in Helm 3), captured at the time it was installed/upgraded. `helm rollback <release> <revision>` simply re-applies that previously stored, already-rendered manifest set, conceptually parallel to how `kubectl rollout undo` reactivates a retained ReplicaSet, but operating on an entire multi-object application bundle instead of a single Pod template.

**Q: Why does base64 encoding in a Secret matter less than people think for security, and what actually protects Secret data?**
A: Base64 is a reversible encoding with no key — anyone with read access to the Secret object, or who can exec into a Pod mounting it, can decode it in one command. The real protections are RBAC (restricting who can `get`/`list` Secrets), etcd encryption at rest (so the datastore itself isn't plaintext-equivalent), and for stronger guarantees, an external secrets manager (Vault, AWS Secrets Manager) integrated via an operator so the actual secret material never lives in cluster manifests or git at all.

## How to Use This Folder

Start with `kubernetes-overview.md` so the control-plane/worker-node architecture and the reconciliation loop are solid — nearly every other topic assumes that mental model. From there, read topics in the grouped order above: Architecture & Core Objects first, then Networking, then Configuration & Storage, then Scaling & Operations, finishing with Package Management & Troubleshooting, since troubleshooting draws on failure modes introduced throughout the earlier files (probe failures from Pods, unbound PVCs from Persistent Volumes, scheduling failures from Scaling). For each topic, practice a short spoken answer that hits: what problem it solves, a concrete example, the main tradeoff, and how you'd debug it under pressure — that's the shape senior interview answers tend to take, and it's the same shape each file's Interview Questions & Answers section models.
