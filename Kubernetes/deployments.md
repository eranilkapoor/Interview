# Deployments

A Deployment is the standard controller for running stateless applications in Kubernetes, and it works through a three-layer ownership chain: **Deployment → ReplicaSet → Pod**. You describe a Pod template and a desired replica count in the Deployment; the Deployment controller creates a ReplicaSet to actually maintain that replica count; and the ReplicaSet controller creates and deletes individual Pods to keep the observed count matching the desired count. You essentially never manage ReplicaSets or Pods directly when using a Deployment — you edit the Deployment, and the layers below it react.

The reason for the extra ReplicaSet layer (rather than Deployment owning Pods directly) is **rolling updates and rollback**. Every time you change the Pod template inside a Deployment (a new image tag, a changed env var, a different resource limit), the Deployment controller doesn't mutate the existing ReplicaSet in place — it creates a *new* ReplicaSet with the updated template, and then gradually scales the new ReplicaSet up while scaling the old one down, governed by the `strategy.rollingUpdate` settings `maxSurge` (how many extra Pods above the desired count are allowed during the rollout) and `maxUnavailable` (how many Pods below the desired count are tolerated). The old ReplicaSet isn't deleted — it's scaled to zero and kept around (up to `revisionHistoryLimit`, default 10), which is exactly what makes rollback cheap: `kubectl rollout undo` just re-points the Deployment at a previous ReplicaSet's template and replays the same scale-up/scale-down dance in reverse.

Because readiness probes gate the rolling update — a new Pod isn't counted as "successfully rolled out" until it passes its readiness probe — a rolling update naturally pauses or fails forward slowly if the new image is broken, rather than taking down the whole service at once. This is also why a Deployment rollout can appear "stuck": if new Pods never become ready, the rollout will sit partially complete (some old Pods still running, some new Pods failing readiness) rather than either fully completing or automatically reverting — Kubernetes does not auto-rollback a bad rollout by default, you have to run `kubectl rollout undo` yourself, or configure `progressDeadlineSeconds` to have the Deployment mark itself as failed after a timeout (which still requires a manual or automated rollback action).

Deployments also handle plain **replica management** independent of updates — scaling a Deployment up or down (`kubectl scale` or editing `replicas` in the manifest) just tells the current ReplicaSet to create or delete Pods to match, with no new ReplicaSet involved since the Pod template hasn't changed. This is the mechanism that HorizontalPodAutoscaler also drives under the hood: HPA doesn't talk to Pods directly, it just adjusts the Deployment's `replicas` field and lets the existing ReplicaSet mechanism do the rest.

## Examples

```yaml
# A Deployment with an explicit rolling update strategy
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  labels:
    app: web-app
spec:
  replicas: 4
  revisionHistoryLimit: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # at most 1 extra Pod above desired count during rollout
      maxUnavailable: 0    # never drop below desired count — zero-downtime rollout
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
        - name: web-app
          image: myregistry/web-app:1.4.0
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 5
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
```

```bash
# Trigger a rolling update by changing the image, then watch it progress
kubectl set image deployment/web-app web-app=myregistry/web-app:1.5.0
kubectl rollout status deployment/web-app
# Waiting for rollout to finish: 2 out of 4 new replicas have been updated...

# Inspect rollout history and the ReplicaSets a Deployment owns
kubectl rollout history deployment/web-app
kubectl get replicasets -l app=web-app
```

```bash
# Roll back to the previous revision after a bad deploy
kubectl rollout undo deployment/web-app

# Roll back to a specific revision, or pause/resume a rollout mid-way
kubectl rollout undo deployment/web-app --to-revision=2
kubectl rollout pause deployment/web-app
kubectl rollout resume deployment/web-app

# Manual scaling (independent of any image change — no new ReplicaSet created)
kubectl scale deployment web-app --replicas=6
```

## Common Pitfalls / Gotchas

- Expecting Kubernetes to automatically roll back a broken deployment — it doesn't by default; `progressDeadlineSeconds` only marks the rollout as `Failed` in status, you still have to run `kubectl rollout undo` (or wire that into your CI/CD pipeline).
- Setting `maxUnavailable: 0` and `maxSurge: 0` simultaneously — that combination makes a rollout mathematically impossible to progress since no old Pod can be removed and no new Pod can be added.
- Editing a Pod directly that's managed by a Deployment — the ReplicaSet controller will detect the drift from the Pod template and simply delete/recreate it, silently discarding your manual change.
- Forgetting that changing only `replicas` (not the Pod template) does not create a new ReplicaSet or trigger a rollout — it's a pure scale operation, so image/config bugs already in the running Pods are not touched.
- Relying on `kubectl rollout history` without `--revision=N` to see what actually changed — the default output only shows revision numbers, not the diff; you need `kubectl rollout history deployment/web-app --revision=2` to see the actual template.

## Interview Questions & Answers

**Q: Explain the Deployment → ReplicaSet → Pod hierarchy and why Kubernetes doesn't just let Deployments manage Pods directly.**
A: A Deployment owns one or more ReplicaSets, and each ReplicaSet owns a set of Pods matching its label selector. The extra layer exists to make rolling updates and rollbacks cheap: whenever the Pod template changes, the Deployment controller creates a brand-new ReplicaSet rather than mutating the old one, then shifts replica counts between old and new. Because the old ReplicaSet is kept around (scaled to zero) instead of being deleted, rolling back is just "scale the old ReplicaSet back up, scale the new one down" — there's no need to reconstruct a previous Pod template from scratch.

**Q: How does a Deployment perform a rolling update, and what do `maxSurge` and `maxUnavailable` control?**
A: The Deployment controller creates a new ReplicaSet with the updated Pod template, then incrementally increases the new ReplicaSet's replica count while decreasing the old one's, gated by two bounds: `maxSurge` caps how many Pods above the desired total are allowed to exist at once (extra capacity during the transition), and `maxUnavailable` caps how many Pods below the desired total are tolerated (how much capacity can dip during the transition). New Pods only count toward progress once they pass their readiness probe, which is what makes the rollout self-throttling against a broken new version.

**Q: A `kubectl set image` rollout has been sitting at "2 out of 4 new replicas updated" for ten minutes. What's likely wrong, and how do you fix it?**
A: The new Pods are probably failing their readiness probe (crash, wrong port, missing config, dependency not reachable), so the rollout can't progress past `maxUnavailable`/`maxSurge` bounds. Check `kubectl describe pod <new-pod>` and `kubectl logs <new-pod>` to find the actual failure. If it's a bad image/config, the fix is `kubectl rollout undo deployment/<name>` to revert immediately, then fix and redeploy — Kubernetes will not do this automatically.

**Q: What's the difference between scaling a Deployment and updating its image?**
A: Scaling (`kubectl scale` or editing `replicas`) only changes how many Pods the *current* ReplicaSet runs — the Pod template is untouched, so no new ReplicaSet is created and no rolling-update logic runs. Updating the image (or any other field in the Pod template) creates a brand-new ReplicaSet and triggers the full rolling-update sequence between old and new ReplicaSets. HPA, for reference, only ever does the former — it adjusts `replicas`, never the template.

**Q: How would you achieve a zero-downtime deployment with a Kubernetes Deployment?**
A: Set `maxUnavailable: 0` so the desired replica count is never dropped below during the rollout, pair it with a readiness probe that accurately reflects when a Pod can actually serve traffic (so the rollout genuinely waits for new Pods to be ready before removing old ones), and make sure the Service in front of the Deployment routes only to Ready Pods (the default Service behavior). Also consider a `preStop` hook with a short sleep to avoid dropping in-flight requests during the brief window between a Pod being marked for termination and it actually being removed from Service endpoints.

## Related Topics

- [pods.md](./pods.md)
- [services.md](./services.md)
- [scaling-and-autoscaling.md](./scaling-and-autoscaling.md)
- [helm.md](./helm.md)
- [troubleshooting.md](./troubleshooting.md)
