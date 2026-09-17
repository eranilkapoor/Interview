# Docker Swarm vs Kubernetes

Both Swarm and Kubernetes solve the same underlying problem — given a fleet of containers and a cluster of machines, decide which container runs where, keep the declared number of replicas running, route traffic to healthy instances, and roll out updates without downtime — but they solve it at very different levels of sophistication, and the industry has decisively picked one of them as the default. Swarm is Docker's own built-in orchestrator: it ships inside the Docker Engine, so `docker swarm init` on a machine with Docker already installed turns it into a cluster manager with no separate installation, no new CLI, and no new YAML dialect — you deploy a `docker-compose.yml` file almost unmodified via `docker stack deploy`. Kubernetes is a separate, much larger system with its own API server, etcd data store, scheduler, controller manager, and kubelet agent on every node; getting a production-grade cluster running (or paying a cloud provider to run one for you via EKS/GKE/AKS) is a project in itself, and the concept count is much higher — Pods, ReplicaSets, Deployments, Services, Ingress, ConfigMaps, Secrets, PersistentVolumeClaims, Namespaces, RBAC — before you've deployed anything.

That complexity buys real capability. Kubernetes' scheduler considers node affinity/anti-affinity, taints and tolerations, resource requests/limits, pod topology spread, and priority/preemption when placing workloads; Swarm's scheduler is comparatively basic (spread, binpack, or random strategy, plus simple placement constraints). Kubernetes has a built-in Horizontal Pod Autoscaler that scales replica counts off CPU/memory or custom metrics, a Vertical Pod Autoscaler that resizes containers, and cluster autoscalers that add/remove nodes based on demand; Swarm has no native autoscaling at all — replica counts are set manually or via external scripts polling `docker service scale`. Both self-heal (restart failed containers, reschedule off dead nodes), but Kubernetes' health-checking, readiness/liveness probe model, and rolling-update/rollback controls are considerably more granular.

The ecosystem gap is the part that actually decides most real-world choices today. Kubernetes is the de facto standard: virtually every cloud provider offers managed Kubernetes, the CNCF ecosystem around it is enormous (Helm for packaging, operators for automating stateful services like databases, service meshes like Istio/Linkerd for traffic management and mTLS, Prometheus/Grafana as the default observability stack, ArgoCD/Flux for GitOps), and it's what most job postings, tutorials, and hiring pipelines assume you know. Swarm's community and mindshare have shrunk substantially since roughly 2018 onward — Docker Inc. itself has clearly deprioritized it in favor of supporting Kubernetes integration (Docker Desktop ships a one-click local Kubernetes, not just Swarm), and most new orchestration tooling targets Kubernetes' API rather than Swarm's. Kubernetes is also far more extensible: Custom Resource Definitions (CRDs) let you extend the API with your own resource types, and the operator pattern lets you encode operational knowledge (e.g., "how to safely fail over this Postgres cluster") as code that reconciles against the cluster's declared state. Swarm has no equivalent extension mechanism — what the Docker CLI exposes is roughly what you get.

None of this means Swarm is a bad choice in every case. For a small team already fluent in Docker and Compose, running a handful of services on a handful of machines, with no near-term need for advanced scheduling, autoscaling, or a service mesh, Swarm can genuinely be the pragmatic choice — it's operationally simple, has almost no learning curve on top of Docker itself, and "just works" for straightforward stateless services. Kubernetes becomes the right call once you need sophisticated scheduling or autoscaling, multi-cloud or hybrid portability, integration with the broader cloud-native ecosystem, or you're building for a scale (and a hiring pool) where Kubernetes fluency is simply assumed. Being honest about this in an interview — Swarm is simpler but has lost the industry's mindshare, Kubernetes is complex but is where the ecosystem and jobs actually are — reads as more credible than pretending it's a close call.

## Examples

```bash
# Docker Swarm: turn a single Docker host into a one-node cluster and deploy a stack
docker swarm init
docker stack deploy -c docker-compose.yml myapp
docker service scale myapp_web=5
docker service ls
```
`docker swarm init` promotes the local Engine to a Swarm manager. `docker stack deploy` reuses an existing Compose file almost as-is (Swarm reads the `deploy:` key for replicas, resource limits, and update strategy). Scaling is one imperative command — there's no separate autoscaler watching metrics.

```yaml
# Same intent, expressed as Kubernetes objects (deployment.yaml)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 5
  selector:
    matchLabels: { app: web }
  template:
    metadata:
      labels: { app: web }
    spec:
      containers:
        - name: web
          image: myapp:1.0
          resources:
            requests: { cpu: "250m", memory: "256Mi" }
            limits: { cpu: "500m", memory: "512Mi" }
---
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector: { app: web }
  ports:
    - port: 80
      targetPort: 3000
```
The same "run 5 replicas behind a stable network endpoint" requirement now needs two separate object kinds — a Deployment (desired state for the pods) and a Service (stable virtual IP/DNS name that load-balances across whichever pods currently match the label selector) — applied with `kubectl apply -f deployment.yaml`. This is more verbose than Swarm for the same outcome, but the resource `requests`/`limits` split feeds directly into the scheduler and the Horizontal Pod Autoscaler in a way Swarm has no equivalent for.

```bash
# Kubernetes autoscaling: no equivalent exists natively in Swarm
kubectl autoscale deployment web --cpu-percent=70 --min=3 --max=20
kubectl get hpa
```
This creates a HorizontalPodAutoscaler that watches CPU utilization across the `web` Deployment's pods and adjusts the replica count between 3 and 20 automatically. Achieving the same behavior in Swarm requires an external script polling metrics and calling `docker service scale` yourself.

## Common Pitfalls / Gotchas

- Assuming a Compose file "just works" unmodified as a Kubernetes manifest — Swarm consumes Compose files nearly as-is via `docker stack deploy`, but Kubernetes needs its own YAML (Deployments, Services, etc.); tools like Kompose can convert, imperfectly, but it's not a drop-in.
- Picking Swarm for a greenfield project mainly because it's "already there" with Docker, without weighing that hiring, tutorials, and third-party tooling now assume Kubernetes almost by default.
- Underestimating Kubernetes' operational overhead for a small team — running your own control plane (etcd, API server, scheduler) is real work; managed offerings (EKS/GKE/AKS) offload it but still leave you learning the full object model.
- Expecting Swarm's rolling updates and health checks to be as configurable as Kubernetes' — Swarm supports basic rolling updates and restart policies, but lacks Kubernetes' readiness/liveness probe granularity and fine-grained rollout controls (max surge/unavailable, progress deadlines).
- Forgetting that Kubernetes doesn't run containers directly through `dockerd` — it talks to a container runtime via the CRI (typically containerd), so "Docker" as a daemon is not actually in the loop on a Kubernetes node, even though the images are still OCI/Docker-format images.

## Interview Questions & Answers

**Q: If you were starting a new project today, when would you actually choose Swarm over Kubernetes?**
A: When the team is small, already deeply familiar with Docker and Compose, the deployment is a handful of relatively simple stateless services on a handful of machines, and there's no near-term need for advanced autoscaling, multi-cloud portability, or a large plugin ecosystem. Swarm's operational simplicity — no separate control plane to run, Compose files work almost unmodified — is a genuine advantage at that scale. The tradeoff is accepting a shrinking ecosystem and community.

**Q: What can Kubernetes' scheduler do that Swarm's can't?**
A: Kubernetes considers resource requests/limits, node affinity/anti-affinity rules, taints and tolerations, pod topology spread constraints, and priority-based preemption when deciding placement. Swarm offers only basic strategies (spread/binpack/random) plus simple placement constraints — it has no concept of preemption or fine-grained topology-aware scheduling.

**Q: How does autoscaling differ between the two?**
A: Kubernetes has a built-in Horizontal Pod Autoscaler that adjusts replica counts based on CPU/memory or custom metrics, a Vertical Pod Autoscaler that resizes container resource requests, and cluster autoscalers that add or remove nodes based on pending/unschedulable pods. Swarm has no native autoscaling — you either scale manually with `docker service scale` or bolt on external tooling that watches metrics and calls the Swarm API for you.

**Q: Why has Kubernetes become the industry default over Swarm despite being more complex?**
A: Ecosystem gravity. Every major cloud provider offers managed Kubernetes, the CNCF ecosystem around it (Helm, operators, service meshes, GitOps tools, observability stacks) is enormous and mature, and it's extensible via CRDs and the operator pattern in a way Swarm never developed an equivalent for. Docker Inc. itself de-emphasized Swarm's development after roughly 2018-2019, which reinforced the shift — new tooling and job postings increasingly assume Kubernetes rather than Swarm.

**Q: Can you use a Compose file with Kubernetes?**
A: Not directly — Kubernetes doesn't natively understand Compose's YAML schema. You'd either hand-translate it into Kubernetes objects (Deployment, Service, ConfigMap, etc.) or use a conversion tool like Kompose, which produces a reasonable starting point but usually needs manual cleanup, especially around networking, volumes, and health checks.

## Related Topics
- [docker-swarm.md](./docker-swarm.md)
- [docker-compose.md](./docker-compose.md)
- [docker-compose-file.md](./docker-compose-file.md)
- [docker-in-production.md](./docker-in-production.md)
- [microservice-architecture.md](./microservice-architecture.md)
- [features-of-docker.md](./features-of-docker.md)
