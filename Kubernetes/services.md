# Services

Pods are inherently unstable network endpoints — they get recreated with a new IP any time a Deployment rolls out, a node fails, or the scheduler reschedules them. A Service solves this by giving a stable virtual IP and DNS name to a *set* of Pods, selected by a label selector, so that consumers never need to track individual Pod IPs. The Service continuously watches which Pods currently match its selector and are Ready, and maintains that list as an `Endpoints` (or `EndpointSlice`) object that traffic actually gets routed to — a Service is a load-balancing abstraction over a live, constantly-changing set of Pods.

There are four Service types, and choosing between them is one of the most common interview questions. **ClusterIP** (the default) allocates a virtual IP reachable only from inside the cluster — it's the right choice for internal service-to-service traffic, like a backend calling a database's Service. **NodePort** builds on ClusterIP and additionally opens a static port (30000–32767 by default) on *every* node's IP, so the Service becomes reachable from outside the cluster via `<any-node-ip>:<node-port>` — it's a blunt tool, mostly used for development/testing or as a building block underneath something else, since it ties you to knowing node IPs and doesn't do real load balancing across nodes on its own. **LoadBalancer** builds on NodePort and additionally asks the cloud provider (AWS, GCP, Azure) to provision an actual external load balancer (an ELB/NLB, for example) that forwards traffic to the NodePort on each node — this is the standard way to expose a service directly to the internet in a cloud-managed cluster, and it's the most expensive/heavyweight option since each LoadBalancer Service typically provisions its own cloud load balancer. **ExternalName** is different in kind from the other three — it doesn't proxy traffic or select Pods at all; it's a pure DNS-level CNAME redirect, mapping a Service name inside the cluster to an external DNS name (like a managed database's hostname), so in-cluster code can address an external dependency using the same internal-DNS pattern it uses for everything else.

**Service discovery** works through cluster DNS (CoreDNS in most distributions): every Service automatically gets a DNS record of the form `<service-name>.<namespace>.svc.cluster.local`, and Pods within the same namespace can reach it with just `<service-name>` thanks to the namespace being appended by the Pod's default DNS search path. This is why a Pod in the `default` namespace can call `http://my-api` and it resolves, while reaching a Service in another namespace requires either the namespace-qualified name (`my-api.other-namespace`) or the fully qualified one.

Mechanically, routing is handled by **kube-proxy**, running as a DaemonSet-like agent on every node. It watches the API server for Service and Endpoints/EndpointSlice changes and programs the node's packet-handling rules — historically iptables DNAT rules, more efficiently IPVS in newer/larger clusters — so that any packet destined for a Service's ClusterIP gets rewritten to one of the backing Pod IPs and forwarded, all in kernel space without a proxy process actually sitting in the request path (despite the name "kube-proxy," modern modes don't userspace-proxy traffic at all). This is also why Services provide load balancing "for free" — kube-proxy's rules distribute across all Ready backend Pod IPs, typically at random or round-robin depending on mode, with no separate load balancer process needed for internal (ClusterIP) traffic.

## Examples

```yaml
# ClusterIP Service (default) — internal-only, selects Pods by label
apiVersion: v1
kind: Service
metadata:
  name: backend-api
spec:
  selector:
    app: backend-api
  ports:
    - port: 80          # port the Service exposes
      targetPort: 8080  # port the container actually listens on
  type: ClusterIP
```

```yaml
# LoadBalancer Service — provisions a cloud load balancer, reachable from the internet
apiVersion: v1
kind: Service
metadata:
  name: web-frontend
spec:
  selector:
    app: web-frontend
  ports:
    - port: 443
      targetPort: 8443
  type: LoadBalancer
```

```yaml
# ExternalName Service — DNS alias to a managed database outside the cluster
apiVersion: v1
kind: Service
metadata:
  name: prod-database
spec:
  type: ExternalName
  externalName: prod-db.abcdef123456.us-east-1.rds.amazonaws.com
```

```bash
# Inspect which Pod IPs a Service is actually routing to right now
kubectl get endpoints backend-api
kubectl get endpointslices -l kubernetes.io/service-name=backend-api

# Test DNS-based service discovery from inside the cluster
kubectl run tmp-shell --rm -it --image=busybox -- sh
# / # nslookup backend-api.default.svc.cluster.local
```

## Common Pitfalls / Gotchas

- Mismatched `selector` labels — a Service whose selector matches zero Pods creates silently, with no error, and just has an empty `Endpoints` object; `kubectl describe svc` and `kubectl get endpoints` are the first places to check when a Service "isn't working."
- Confusing `port` and `targetPort` — `port` is what clients connect to on the Service's IP, `targetPort` is the port the container actually listens on; mixing these up is a frequent source of connection-refused errors.
- Assuming a Service load-balances across nodes evenly for NodePort/LoadBalancer traffic — without `externalTrafficPolicy: Local`, traffic can hit any node and get an extra hop to a Pod on a different node, which also loses the client's real source IP (SNATed away) unless that policy is set.
- Using NodePort as a production-grade external exposure mechanism instead of LoadBalancer or Ingress — it works, but ties clients to specific, potentially-changing node IPs and a narrow port range, and provides no real edge load balancing.
- Not realizing a Pod only appears in a Service's Endpoints once it passes its readiness probe — a newly started but not-yet-ready Pod is deliberately excluded from receiving traffic even though it's `Running`.

## Interview Questions & Answers

**Q: What problem does a Service solve that Pods alone don't?**
A: Pod IPs are ephemeral — they change every time a Pod is recreated by a rollout, a crash, or rescheduling. A Service gives a stable virtual IP and DNS name backed by a label selector, so consumers address the Service instead of individual Pods, and the Service transparently tracks which Pods currently match and are ready to receive traffic.

**Q: Walk through ClusterIP vs NodePort vs LoadBalancer vs ExternalName.**
A: ClusterIP is internal-only, for Pod-to-Pod traffic within the cluster. NodePort builds on it by also opening a static port on every node's IP, allowing external access via any node's address — mostly a building block or dev tool. LoadBalancer builds on NodePort by having the cloud provider provision an actual external load balancer that targets the NodePort, giving a single stable external entry point — the standard way to expose a service to the internet on a cloud cluster. ExternalName is different in kind: it's a pure DNS CNAME to an external hostname, with no Pod selection or proxying at all, used to make an external dependency addressable the same way as an internal Service.

**Q: How does a Pod find another service just by name, like `http://payments-api`?**
A: Cluster DNS (typically CoreDNS) automatically creates a DNS record for every Service in the form `<name>.<namespace>.svc.cluster.local`. Pods get a default DNS search path that includes their own namespace, so a bare name like `payments-api` resolves correctly if the Pod and the Service are in the same namespace; reaching a Service in a different namespace requires at least `payments-api.other-namespace`.

**Q: How does kube-proxy actually route traffic sent to a Service's ClusterIP?**
A: kube-proxy runs on every node and watches the API server for Service/Endpoints changes, then programs the node's kernel-level packet rules — iptables DNAT rules or IPVS rules, depending on mode — that rewrite the destination of any packet sent to a Service's ClusterIP to one of the currently Ready backing Pod IPs. This happens entirely in-kernel; despite the name, no userspace proxy process sits in the actual data path in the common modes, which is what makes it fast enough for per-packet routing at scale.

**Q: A client says they can't reach `my-service` at all. What's your debugging order?**
A: First check `kubectl get endpoints my-service` — if it's empty, the Service's selector doesn't match any Ready Pod, so check the selector against the Pod's actual labels and the Pod's readiness probe status. If Endpoints are populated, check that `port`/`targetPort` actually match what the container listens on, then test DNS resolution and connectivity from inside the cluster with a throwaway debug Pod (`kubectl run tmp --rm -it --image=busybox -- sh`) before assuming the problem is external (LoadBalancer provisioning, security groups, DNS propagation).

## Related Topics

- [pods.md](./pods.md)
- [deployments.md](./deployments.md)
- [ingress.md](./ingress.md)
- [namespaces.md](./namespaces.md)
- [troubleshooting.md](./troubleshooting.md)
