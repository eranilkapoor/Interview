# Scaling and Autoscaling

Kubernetes gives you three independent, composable scaling mechanisms, and knowing which layer each one operates on is the core of this topic. The simplest is **manual scaling** — `kubectl scale deployment/x --replicas=N` — which directly sets the desired replica count on a Deployment/ReplicaSet/StatefulSet; it's an immediate, one-time change with no ongoing decision-making. Above that sits the **Horizontal Pod Autoscaler (HPA)**, which continuously adjusts a workload's replica count automatically based on observed metrics. Orthogonal to both is the **Vertical Pod Autoscaler (VPA)**, which doesn't change replica count at all but instead adjusts the CPU/memory `requests`/`limits` of individual Pods. And underneath all of them, the **Cluster Autoscaler** operates one level below the workload entirely — it adds or removes actual *nodes* from the cluster based on whether existing Pods can be scheduled.

**HPA** works as its own reconciliation loop, running roughly every 15 seconds by default: it queries the metrics pipeline (`metrics-server` for CPU/memory, or a custom/external metrics adapter for anything else — request rate, queue depth) for the current value of the target metric across all Pods matching the workload, compares it to the target you configured, and computes a new desired replica count using (roughly) `desiredReplicas = ceil(currentReplicas * (currentMetricValue / targetMetricValue))`. Critically, HPA does not talk to Pods directly — it just edits the `replicas` field on the target Deployment/StatefulSet, and the existing ReplicaSet mechanism does the actual Pod creation/deletion from there, meaning HPA is really just an automated caller of the same scaling primitive `kubectl scale` uses manually. HPA supports scaling on CPU/memory utilization (the default, and simplest to reason about), and on **custom metrics** (an application-specific metric like requests-per-second exposed via the custom metrics API) or **external metrics** (something outside the cluster entirely, like an SQS queue depth), which is what lets HPA scale workloads that aren't CPU-bound at all — a worker pool consuming a queue is the classic example, where CPU usage is a poor proxy for actual load.

**VPA** takes the opposite axis: instead of adding more Pods, it right-sizes each Pod's resource requests/limits based on observed historical usage, which matters because under- or over-provisioned `requests` directly affects both scheduling (the scheduler places Pods based on requested, not actual, resources) and cost (over-requesting wastes cluster capacity you're paying for). VPA has a meaningful operational catch: in its default `Auto`/`Recreate` update mode, applying a new recommendation requires *evicting and recreating* the Pod with the new resource values, since resource requests are largely immutable on a running Pod — this causes a brief disruption, which is why VPA and HPA scaling on the same metric (e.g., both reacting to CPU) can fight each other and is generally not recommended for the same workload; VPA is more commonly paired with CPU/memory-agnostic HPA metrics, or used in `Off`/recommendation-only mode to inform manual `requests` tuning.

The **Cluster Autoscaler** watches for Pods that are `Pending` because no existing node has enough allocatable capacity to schedule them, and if so, provisions new nodes (through a cloud provider's node group/autoscaling group API) to fit them — and conversely, scales nodes back down when they're significantly underutilized and their Pods could be safely rescheduled elsewhere (respecting PodDisruptionBudgets). It's the layer that makes HPA's replica increases actually land somewhere when the current nodes are already full — without it, HPA can raise `replicas` all it wants, but the new Pods just sit `Pending` if there's no room.

## Examples

```yaml
# HPA scaling a Deployment on CPU utilization, between 2 and 10 replicas
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300   # wait 5 min before scaling down, avoids flapping
```

```yaml
# VPA in recommendation-only mode — computes suggestions without auto-applying them
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: web-app-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  updatePolicy:
    updateMode: "Off"   # "Auto" would evict/recreate Pods to apply recommendations
```

```bash
# Manual scaling — a one-time, immediate change to desired replica count
kubectl scale deployment web-app --replicas=6

# Watch HPA's live decision-making: current metric value vs target, and the replica count it's driving toward
kubectl get hpa web-app-hpa -w
# NAME          REFERENCE            TARGETS   MINPODS   MAXPODS   REPLICAS
# web-app-hpa   Deployment/web-app   78%/70%   2         10        7

# Check whether Pods are Pending due to insufficient node capacity
# (this is what triggers the Cluster Autoscaler to add nodes)
kubectl get pods --field-selector=status.phase=Pending
kubectl describe pod <pending-pod>   # Events: "Insufficient cpu" triggers CA scale-out
```

## Common Pitfalls / Gotchas

- Setting HPA to target CPU utilization without setting resource `requests` on the container — HPA's percentage target is relative to the requested value, so a Pod with no CPU request has nothing to calculate utilization against and HPA simply won't work.
- Running VPA in `Auto` mode on the same workload an HPA also scales on CPU — both controllers react to the same signal from different angles (VPA changes requests, which changes the utilization percentage HPA sees) and can oscillate against each other.
- Expecting HPA to scale instantly — it polls metrics on an interval (default ~15s) and applies stabilization windows/cooldowns specifically to avoid flapping, so there's an inherent lag between a load spike and replicas actually increasing; for latency-sensitive spiky traffic, over-provisioning `minReplicas` is often more realistic than relying on HPA reaction time alone.
- Assuming Cluster Autoscaler will always find room — it can be blocked by PodDisruptionBudgets, Pods with local storage, anti-affinity rules that can't be satisfied on remaining nodes, or a cloud-side quota/instance-type limit, leaving Pods `Pending` even with CA active.
- Confusing what each autoscaler actually changes — HPA changes replica *count*, VPA changes per-Pod resource *requests/limits*, Cluster Autoscaler changes *node count*; none of the three substitute for the others, and a scaling problem is often solved by identifying which layer is actually the bottleneck.

## Interview Questions & Answers

**Q: How does HPA decide when and how much to scale?**
A: It runs a periodic control loop (roughly every 15 seconds by default) that fetches the current value of the target metric (CPU/memory from metrics-server, or a custom/external metric) across the workload's Pods, compares it to the configured target, and computes a new desired replica count proportionally — roughly `desiredReplicas = ceil(currentReplicas * currentMetric / targetMetric)`. It then simply updates the `replicas` field on the Deployment/StatefulSet it targets; the actual Pod creation is handled by the normal ReplicaSet reconciliation, not by HPA itself.

**Q: What's the difference between HPA, VPA, and Cluster Autoscaler?**
A: HPA changes how many Pod replicas a workload runs, in response to a metric like CPU or a custom application metric. VPA changes how much CPU/memory each individual Pod is allowed to request, based on observed historical usage, without changing replica count. Cluster Autoscaler changes the number of actual nodes in the cluster, adding nodes when Pods are unschedulable due to insufficient capacity and removing underutilized nodes when safe. They operate on three different axes — Pod count, per-Pod resources, and node count — and are typically used together, not as alternatives to each other.

**Q: Why can VPA and HPA conflict if applied to the same metric on the same workload?**
A: If VPA is in `Auto` mode and adjusts a Pod's CPU request upward, that changes the denominator HPA uses to compute utilization percentage for the exact same underlying CPU usage — so both controllers can end up reacting to each other's changes rather than to real load, causing oscillation. The safer combination is VPA managing requests (often in recommendation-only `Off` mode) while HPA scales on a different signal, such as a custom application metric like requests-per-second, or restricting VPA to workloads that don't also have CPU/memory-based HPA.

**Q: HPA is showing `REPLICAS: 10/10` (at `maxReplicas`) but the application is still overloaded and new Pods are stuck `Pending`. What's happening and what do you check?**
A: HPA has hit its configured ceiling (`maxReplicas`), so it won't request more Pods even if the metric says it should — check whether `maxReplicas` is simply set too low for actual peak load. Separately, `Pending` Pods indicate the cluster doesn't have room to schedule them regardless of what HPA requests — check `kubectl describe pod` for scheduling failure reasons and confirm Cluster Autoscaler is enabled and not blocked (by PDBs, quota limits, or an exhausted cloud instance type) — HPA raising the desired count is necessary but not sufficient if nothing is adding capacity for the new Pods to land on.

**Q: Why isn't CPU utilization always a good metric for HPA to scale on?**
A: Plenty of workloads aren't CPU-bound in a way that correlates with actual load — a worker consuming a message queue might sit at low CPU while a large backlog builds up, or a request handler might be I/O-bound waiting on a slow downstream dependency while CPU stays flat. In those cases, scaling on a custom metric (queue depth, requests-per-second, active connections) that's exposed through the custom/external metrics API and actually reflects the thing you care about produces far more accurate scaling decisions than CPU utilization alone.

## Related Topics

- [deployments.md](./deployments.md)
- [services.md](./services.md)
- [troubleshooting.md](./troubleshooting.md)
- [kubernetes-overview.md](./kubernetes-overview.md)
