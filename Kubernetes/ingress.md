# Ingress

A Service (specifically ClusterIP/NodePort/LoadBalancer) operates at **L4** — it routes based on IP and port, with no awareness of HTTP semantics like hostnames, URL paths, or headers. That works fine for one service, but exposing many HTTP services to the internet with one LoadBalancer Service each is both expensive (every cloud load balancer costs money and IP allocation) and blind to routing patterns like "route `api.example.com` to one backend and `www.example.com` to another." **Ingress** solves this by operating at **L7**: it's an API object that declares HTTP/HTTPS routing rules — host-based and path-based — that all get served through a *single* external entry point, fanning traffic out to different internal ClusterIP Services based on the request itself, not just its destination IP.

Ingress is fundamentally a two-part system, and this is the detail interviewers probe most: the **Ingress object** is just a declarative spec of routing rules — it does nothing by itself. It requires an **Ingress controller** actually running in the cluster (nginx-ingress, AWS Load Balancer Controller, Traefik, HAProxy, and others) that watches Ingress objects and does the real work — provisioning/configuring an actual reverse proxy or cloud load balancer that implements those rules. Different controllers support different feature sets and use different annotations for controller-specific behavior, which is why Ingress manifests are frequently *not* portable across clusters without adjusting annotations even though the core `Ingress` resource is a stable, standard API.

Routing rules combine two axes: **host-based routing** matches on the `Host` header (e.g., `api.example.com` goes to the API service, `admin.example.com` goes to the admin service), and **path-based routing** matches on URL path prefix within a host (e.g., `/api` goes to one Service, `/` goes to another). A `pathType` field controls matching precision — `Exact` requires an exact path match, `Prefix` matches by path segment prefix, and `ImplementationSpecific` defers to the controller's own matching behavior. Rules can combine both axes freely across many backend Services, all funneled through the one Ingress controller's IP/load balancer.

Ingress is also the standard place to terminate TLS for HTTP traffic: a `tls` block on the Ingress references a Secret containing a certificate and private key, and the Ingress controller presents that certificate to clients and decrypts traffic before forwarding it (in plaintext, typically) to the backend Service — this is called **TLS termination at the edge**. Combined with tools like cert-manager, which watches Ingress objects and automatically provisions/renews certificates (commonly via Let's Encrypt), this is how most production HTTP services in Kubernetes get HTTPS without each backend service handling certificates itself.

## Examples

```yaml
# Host- and path-based routing through a single Ingress, with TLS termination
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.example.com
        - www.example.com
      secretName: example-com-tls
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: backend-api
                port:
                  number: 80
    - host: www.example.com
      http:
        paths:
          - path: /admin
            pathType: Prefix
            backend:
              service:
                name: admin-ui
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 80
```

```yaml
# The IngressClass an Ingress controller registers, and Ingresses reference by name
apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: nginx
spec:
  controller: k8s.io/ingress-nginx
```

```bash
# Verify the Ingress controller has picked up the rule and assigned an address
kubectl get ingress web-ingress
# NAME          CLASS   HOSTS                          ADDRESS         PORTS     AGE
# web-ingress   nginx   api.example.com,www.example.com 34.120.10.5    80, 443   2m

kubectl describe ingress web-ingress
# Shows the resolved backend for each rule and recent controller events
```

## Common Pitfalls / Gotchas

- Creating an Ingress object with no Ingress controller installed in the cluster — the object just sits there with no `ADDRESS` and does nothing; Ingress is a spec, not an implementation.
- Forgetting `ingressClassName` (or the older `kubernetes.io/ingress.class` annotation) in a cluster running multiple controllers — the Ingress can silently be picked up by the wrong controller or ignored by all of them.
- Assuming Ingress annotations are portable — annotations like rewrite rules, rate limiting, or auth are controller-specific; migrating from nginx-ingress to a different controller often means rewriting most of the annotations even though the core `rules` block stays the same.
- Pointing an Ingress at a Service of type `LoadBalancer` or `NodePort` when it should target a plain `ClusterIP` — the Ingress controller already provides the external entry point, so backend Services normally only need to be `ClusterIP`.
- Not understanding that Ingress only handles HTTP/HTTPS — for raw TCP/UDP traffic (a database, a custom protocol), you need a `LoadBalancer` Service or a Gateway API `TCPRoute`/controller-specific extension instead.

## Interview Questions & Answers

**Q: What's the difference between a Service and an Ingress, and why do you need both?**
A: A Service operates at L4 — it load-balances based on IP and port with no knowledge of HTTP content. Ingress operates at L7 — it routes based on HTTP-level information like hostname and URL path, letting many different backend Services be exposed through a single external entry point instead of one load balancer per service. You still need Services underneath an Ingress — the Ingress routes traffic *to* ClusterIP Services, which then route to the actual Pods; Ingress doesn't replace Services, it sits in front of them.

**Q: Does creating an Ingress object do anything by itself?**
A: No. An Ingress is purely a declarative routing spec — nothing processes traffic until an Ingress controller (nginx-ingress, AWS Load Balancer Controller, Traefik, etc.) is running in the cluster, watching Ingress objects, and actually implementing those rules as a real reverse proxy or cloud load balancer configuration. This is a frequent gotcha: an Ingress with no controller installed just sits inert with no assigned address.

**Q: How does TLS termination work with Ingress?**
A: The Ingress's `tls` block references a Kubernetes Secret holding a TLS certificate and private key for specific hostnames. The Ingress controller presents that certificate to clients and decrypts the HTTPS connection at the edge, then typically forwards the request to the backend Service as plain HTTP inside the cluster. Tools like cert-manager automate this further by watching Ingress objects and automatically requesting/renewing certificates (often via Let's Encrypt) and writing them into the referenced Secret.

**Q: How would you route `api.example.com` and `admin.example.com` to two completely different backend applications using one external IP?**
A: Define one Ingress with two host rules — one matching `host: api.example.com` routed to the API's ClusterIP Service, another matching `host: admin.example.com` routed to the admin UI's Service. Both are served through the same Ingress controller and the same external IP/load balancer, since the controller inspects the `Host` header to decide which backend to forward to; this is exactly the cost-saving reason Ingress exists instead of provisioning a separate LoadBalancer Service per application.

**Q: What's the difference between `pathType: Prefix` and `pathType: Exact`?**
A: `Exact` requires the request path to match the specified path exactly, character for character. `Prefix` matches based on path *segments* — `/api` with `Prefix` matches `/api`, `/api/`, and `/api/users`, but not `/apiv2` (segment boundaries matter, not just string prefix). `ImplementationSpecific` leaves the matching behavior up to the particular Ingress controller, which is useful for controller-specific regex-based routing but makes the manifest less portable.

## Related Topics

- [services.md](./services.md)
- [configmaps-and-secrets.md](./configmaps-and-secrets.md)
- [deployments.md](./deployments.md)
- [namespaces.md](./namespaces.md)
