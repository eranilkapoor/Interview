# Namespaces

A Namespace is a mechanism for dividing a single physical cluster into multiple **logical** partitions. It's not a security or hardware isolation boundary the way a VM or a separate cluster is — Namespaces don't isolate network traffic, node resources, or the kernel; Pods in different namespaces still run on the same nodes, share the same underlying compute, and can reach each other over the network by default. What a Namespace actually scopes is **names and access**: most Kubernetes object names (Pods, Services, Deployments, ConfigMaps, Secrets) only need to be unique *within* a namespace, not cluster-wide, and it's the natural unit that RBAC, ResourceQuotas, and NetworkPolicies attach to.

The practical uses of Namespaces fall into a few buckets. **Multi-team/multi-environment separation** — `dev`, `staging`, `prod`, or per-team namespaces — lets different teams or environments coexist in one cluster with their own `web-app` Deployment name without colliding, and lets you scope RBAC so a team can only read/write resources in their own namespace. **Resource governance** via **ResourceQuota** objects, which cap the total CPU/memory/object-count a namespace can consume — without a quota, one namespace's workloads can starve every other namespace on the same cluster of resources, since nodes are a shared, cluster-wide pool regardless of namespace boundaries. **Blast-radius control** for RBAC and NetworkPolicy — Roles (as opposed to ClusterRoles) are namespace-scoped, so granting a team access to "everything in namespace `team-a`" is a clean, auditable boundary, and NetworkPolicies can be written to restrict traffic into/out of a namespace, turning the logical partition into an actual network boundary when combined with a CNI plugin that enforces NetworkPolicy (not all do by default).

Every cluster starts with a handful of built-in namespaces: `default` (where objects land if you don't specify a namespace — a common beginner pitfall, discussed below), `kube-system` (control-plane and core add-on components like CoreDNS, kube-proxy), `kube-public` (readable by all users, rarely used for anything meaningful), and `kube-node-lease` (holds Lease objects used for node heartbeat/health, an internal implementation detail).

A handful of Kubernetes object kinds are deliberately **cluster-scoped** rather than namespace-scoped — Nodes, PersistentVolumes (though PVCs are namespaced), ClusterRoles, StorageClasses, Namespaces themselves — because they represent cluster-wide infrastructure rather than something meaningful to duplicate per-team. Cross-namespace **service discovery** still works, just not with the bare Service name: a Pod in namespace `frontend` reaching a Service in namespace `backend` needs `backend-api.backend` (namespace-qualified) or the fully qualified `backend-api.backend.svc.cluster.local`, since the default DNS search path only auto-appends the Pod's *own* namespace.

## Examples

```yaml
# Creating a namespace with a ResourceQuota capping what it can consume
apiVersion: v1
kind: Namespace
metadata:
  name: team-a
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-a-quota
  namespace: team-a
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.cpu: "20"
    limits.memory: 40Gi
    pods: "50"
```

```yaml
# A namespace-scoped Role + RoleBinding granting a team access only within team-a
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: team-a
  name: deployment-manager
rules:
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "watch", "create", "update", "patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: team-a-deployment-managers
  namespace: team-a
subjects:
  - kind: Group
    name: team-a-engineers
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: deployment-manager
  apiGroup: rbac.authorization.k8s.io
```

```bash
# Working across namespaces from kubectl
kubectl get pods -n team-a
kubectl config set-context --current --namespace=team-a   # stop typing -n every time
kubectl get pods --all-namespaces                          # see everything cluster-wide

# Reaching a Service in another namespace from inside a Pod
# (namespace-qualified name, since bare name only resolves within the same namespace)
curl http://backend-api.backend.svc.cluster.local
```

## Common Pitfalls / Gotchas

- Forgetting to specify `-n <namespace>` (or set a default context namespace) and unknowingly operating on `default` — this is one of the single most common real-world mistakes: `kubectl apply`, `kubectl delete`, and `kubectl get` all silently target `default` if unspecified, which is especially dangerous with `kubectl delete`.
- Assuming Namespaces provide network isolation out of the box — by default, a Pod in one namespace can reach a Pod in any other namespace over the network; actual isolation requires explicit NetworkPolicies (and a CNI plugin that enforces them).
- Not setting a ResourceQuota and being surprised when one namespace's runaway workload starves every other namespace on the cluster — nodes are a shared pool regardless of namespace, so without quotas there's no per-namespace resource ceiling.
- Trying to namespace a cluster-scoped object like a Node, PersistentVolume, or ClusterRole — these kinds intentionally don't take a `namespace` field, and manifests that include one for them are simply ignored or rejected depending on the object.
- Reaching for many fine-grained namespaces as a substitute for real multi-tenancy security — Namespaces are a logical/organizational boundary, not a hard security boundary; genuinely untrusted multi-tenant workloads usually need separate clusters or additional sandboxing (gVisor/Kata), not just namespace separation.

## Interview Questions & Answers

**Q: What does a Namespace actually isolate, and what does it not isolate?**
A: It isolates names (most object names only need to be unique within their namespace) and gives RBAC, ResourceQuota, and NetworkPolicy a natural scope to attach to. It does not isolate compute — Pods across namespaces still share the same underlying nodes — and it does not isolate network traffic by default; a Pod in one namespace can reach a Pod in any other namespace unless a NetworkPolicy explicitly restricts it.

**Q: Why is landing everything in the `default` namespace a real production risk?**
A: Any `kubectl` command without an explicit `-n` targets `default`, so teams that never set up dedicated namespaces end up with every team's and every environment's objects mixed together in one namespace with no natural RBAC or quota boundary between them — a `kubectl delete` typo or an overly broad Role grant has a much larger blast radius. It also makes object names a constant collision risk between unrelated teams or services.

**Q: How does DNS-based service discovery change when calling a Service in a different namespace?**
A: Within the same namespace, a bare Service name resolves because the Pod's default DNS search path auto-appends its own namespace. Across namespaces, you need the namespace-qualified name (`service-name.namespace`) or the fully qualified `service-name.namespace.svc.cluster.local`, since the search path doesn't include other namespaces automatically.

**Q: How would you prevent one team's workloads from starving another team's workloads on a shared cluster?**
A: Put each team in its own namespace and attach a ResourceQuota capping total CPU/memory requests/limits and object counts for that namespace, combined with LimitRanges to enforce sane per-Pod defaults/maximums within it. Without a quota, namespaces provide no resource ceiling at all — the scheduler will happily let one namespace's workloads consume the entire cluster's capacity since nodes are shared regardless of namespace.

**Q: Give an example of an object that is cluster-scoped rather than namespace-scoped, and explain why.**
A: Nodes are cluster-scoped — a physical or virtual machine isn't a per-team or per-environment concept, it's shared cluster-wide infrastructure, so it wouldn't make sense to duplicate or namespace it. The same logic applies to PersistentVolumes (the underlying disk is cluster infrastructure, though the PVC that claims it is namespaced), ClusterRoles, and StorageClasses — anything that represents infrastructure or a capability meant to be referenced from any namespace is deliberately kept outside the namespace boundary.

## Related Topics

- [kubernetes-overview.md](./kubernetes-overview.md)
- [services.md](./services.md)
- [persistent-volumes.md](./persistent-volumes.md)
- [troubleshooting.md](./troubleshooting.md)
