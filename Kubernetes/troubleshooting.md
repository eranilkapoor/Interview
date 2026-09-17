# Troubleshooting

Kubernetes troubleshooting almost always follows the same funnel: start broad (is the object even in the state you expect?), narrow to events (what did the cluster's own controllers observe going wrong?), then narrow further into the actual container (logs, a shell, resource usage). Three commands cover the vast majority of real debugging sessions. `kubectl describe <kind> <name>` is usually the *first* command to run — it shows an object's full spec/status plus, critically, its **Events** section, a chronological log of everything the relevant controllers observed and did to that object (scheduling decisions, image pull attempts, probe failures, OOM kills). Most "why is this broken" questions are answered directly by Events before you ever need to look at logs. `kubectl logs <pod> [-c <container>] [--previous]` retrieves stdout/stderr from a container — `-c` is required for multi-container Pods, and `--previous` is essential for a crashing container, since it fetches logs from the *last terminated* instance rather than the current (possibly just-restarted, log-empty) one. `kubectl exec -it <pod> -- <command>` gets an interactive shell or runs a one-off command inside a running container, for when logs alone don't explain the problem and you need to poke at the actual filesystem, environment, or network reachability from inside.

A handful of Pod failure states recur constantly and each has a distinct, specific root cause rather than being interchangeable symptoms of "something's wrong." **`CrashLoopBackOff`** means the container starts, exits (crashes or intentionally exits), and Kubernetes restarts it, over and over, with an exponentially increasing backoff delay between attempts — the fix is always in the application itself or its config, never in Kubernetes: check `kubectl logs --previous` for why it's actually exiting (an unhandled exception, a missing required env var, a failed startup dependency check). **`ImagePullBackOff` / `ErrImagePull`** means the kubelet couldn't pull the specified container image — usually a typo'd image name/tag, a private registry the cluster lacks `imagePullSecrets` credentials for, or a genuinely nonexistent tag; `kubectl describe pod` shows the exact pull error message. **`Pending`** (a Pod that never gets scheduled) has two very different common causes that require different investigation: insufficient node resources (no node has enough allocatable CPU/memory to satisfy the Pod's `requests` — visible in Events as "Insufficient cpu/memory," fixed by adding nodes/Cluster Autoscaler or lowering requests) versus an unbound PersistentVolumeClaim (the Pod needs a PVC that can't be satisfied — no matching StorageClass, no available PV, a zone mismatch — visible by checking `kubectl get pvc` for the claim's own status rather than the Pod's).

Beyond individual failure states, **OOMKilled** (visible in `kubectl describe pod` as the last termination reason, exit code 137) means the container exceeded its memory `limit` and the kernel's OOM killer terminated it — this is a hard ceiling, unlike CPU limits which just throttle; the fix is either raising the memory limit or finding and fixing an actual memory leak, and the two require genuinely different follow-up (a workload that grows unbounded over time is a leak; one that's consistently just above a too-tight limit is a sizing problem). **Readiness probe failures** don't crash a container but do pull it out of Service Endpoints, which shows up as "some requests fail intermittently" rather than an obvious Pod-level error — checking `kubectl describe pod` for probe failure events and `kubectl get endpoints` to confirm which Pods are actually receiving traffic is the way to connect a networking symptom back to a specific unhealthy Pod.

The broader debugging discipline that ties all of this together: always check **Events** before logs (Events tell you what the *cluster* thinks happened — scheduling, pulls, probes — which is often the actual root cause; logs only tell you what the *application* thinks happened, which is useless if the container never even started). And always distinguish a **cluster-level problem** (scheduling, node capacity, networking, RBAC) from an **application-level problem** (a bug, bad config, unhandled exception) early, because they require completely different next steps and tools.

## Examples

```bash
# The default first move for almost any "why is X broken" question
kubectl describe pod my-app-7d9f8c6b9-x2k4p
# Look at Events at the bottom — most scheduling/pull/probe failures show up here directly:
#   Warning  Failed     kubelet  Failed to pull image "myapp:v2": not found
#   Warning  Unhealthy  kubelet  Readiness probe failed: HTTP probe failed with statuscode: 503
#   Warning  BackOff    kubelet  Back-off restarting failed container
```

```bash
# Diagnosing a CrashLoopBackOff — the crashed instance's own logs, not the fresh restart's
kubectl get pods
# my-app-7d9f8c6b9-x2k4p   0/1   CrashLoopBackOff   6   12m

kubectl logs my-app-7d9f8c6b9-x2k4p --previous
# Shows the stack trace / error from the instance that just crashed,
# not the empty log of the container that just restarted seconds ago

kubectl exec -it my-app-7d9f8c6b9-x2k4p -- sh
# Only works if the container is currently up long enough to attach —
# for a fast crash loop, --previous logs are usually the only real signal
```

```bash
# Diagnosing a Pending pod: is it a node-capacity problem or a storage problem?
kubectl describe pod my-db-0
# Events: "0/3 nodes are available: 3 Insufficient memory"          -> node capacity problem
# Events: "pod has unbound immediate PersistentVolumeClaims"        -> storage problem

kubectl get pvc my-db-data
# NAME         STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS
# my-db-data   Pending                                       fast-ssd
# A Pending PVC (not just a Pending Pod) confirms the storage layer is the actual blocker

kubectl top nodes   # confirm actual available capacity if Events point to resources
```

## Common Pitfalls / Gotchas

- Jumping straight to `kubectl logs` and finding nothing useful — if a container never started (ImagePullBackOff, a failed scheduling decision, a failed readiness probe before the app even logs anything), the logs are empty or irrelevant; `kubectl describe` Events almost always explain container-never-started failures that logs cannot.
- Reading logs from a freshly restarted container instead of `--previous` when debugging `CrashLoopBackOff` — the current container's logs may only contain a few seconds of startup output, while the actual crash reason is in the terminated instance's logs.
- Treating `CrashLoopBackOff` as a Kubernetes problem to fix with more resources or a different scheduling rule — it's virtually always an application-level exit, and the fix lives in application code, startup config, or a missing dependency, not in the Pod spec's infrastructure fields.
- Confusing a `Pending` Pod caused by node resource shortage with one caused by an unbound PVC — both show as `Pending`, but the fix is completely different (add capacity / lower requests, versus fix the StorageClass / PV / zone mismatch); always check both Events and, separately, `kubectl get pvc` if the Pod mounts one.
- Not distinguishing OOMKilled (exit code 137, hit a hard memory limit) from a generic crash (a different non-zero exit code, an application-level failure) — `kubectl describe pod` reports the specific `Reason` and `Exit Code` for the last termination, and conflating the two leads to fixing the wrong thing (raising a limit versus fixing application logic).

## Interview Questions & Answers

**Q: What causes `CrashLoopBackOff`, and how do you debug it?**
A: It means the container is starting and then exiting repeatedly, with Kubernetes restarting it on an exponentially increasing backoff. It is virtually always an application-level problem — an unhandled startup exception, a missing required environment variable/config, or a dependency the app fails to connect to — never something you fix by changing Kubernetes-side scheduling or resource settings. The debugging move is `kubectl logs <pod> --previous`, which retrieves logs from the last terminated instance rather than the just-restarted (and likely log-empty) current one, followed by `kubectl describe pod` to confirm the exit code and any relevant Events.

**Q: What's the difference between `ImagePullBackOff` and `CrashLoopBackOff`?**
A: `ImagePullBackOff` happens before the container ever starts — the kubelet couldn't retrieve the specified image at all, usually from a typo'd name/tag, a nonexistent tag, or missing registry credentials (`imagePullSecrets`). `CrashLoopBackOff` happens after the container successfully starts and then exits — the image pulled fine, but the process inside it is failing. They look similar in `kubectl get pods` output (both show a Pod not becoming Ready, with a backoff pattern) but point to entirely different layers of the problem, and `kubectl describe pod` distinguishes them immediately via the specific Events message.

**Q: A Pod is stuck `Pending`. Walk through how you'd determine why.**
A: Start with `kubectl describe pod`, whose Events section usually states the reason directly — most commonly either insufficient node resources ("Insufficient cpu/memory" across all nodes) or an unschedulable constraint (affinity/taint rules no node satisfies). If the Pod references a PersistentVolumeClaim, separately check `kubectl get pvc` — a `Pending` PVC (not just a `Pending` Pod) points to a storage-layer problem instead: no matching StorageClass, no available PV, or a zone/topology mismatch under `WaitForFirstConsumer`. These two root causes require entirely different fixes, so confirming which one it is before acting matters.

**Q: What does `OOMKilled` mean, and how is it different from a Pod just being slow or throttled?**
A: `OOMKilled` (visible as the termination reason with exit code 137 in `kubectl describe pod`) means the container exceeded its memory `limit` and the kernel's out-of-memory killer terminated the process — memory limits are a hard ceiling with no graceful degradation, unlike CPU limits, which only throttle a container's CPU time rather than killing it. The fix depends on which is true: consistently exceeding a limit that's simply too tight for the workload means raising the limit, while unbounded growth over the container's lifetime before hitting the limit points to an actual memory leak in the application that no amount of raising the limit permanently fixes.

**Q: Users report intermittent failures reaching a service, but all Pods show as `Running`. What do you check?**
A: `Running` only means the container process is alive — it says nothing about whether the Pod is passing its readiness probe and therefore actually receiving traffic. Check `kubectl describe pod` for readiness probe failure Events, and `kubectl get endpoints <service>` to see which Pods are currently in the Service's routable set — a Pod that's `Running` but failing readiness is silently excluded from traffic, which produces exactly this "intermittent, some requests fail" symptom rather than an obvious hard failure, since only a subset of the replica set is actually degraded.

## Related Topics

- [pods.md](./pods.md)
- [deployments.md](./deployments.md)
- [services.md](./services.md)
- [persistent-volumes.md](./persistent-volumes.md)
- [scaling-and-autoscaling.md](./scaling-and-autoscaling.md)
