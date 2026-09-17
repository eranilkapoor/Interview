# Helm

Helm is the de facto package manager for Kubernetes — the conceptual equivalent of `apt`/`npm` but for bundles of Kubernetes manifests. Its reason for existing is that real applications are rarely one YAML file; a typical service might need a Deployment, a Service, a ConfigMap, an Ingress, an HPA, and RBAC objects, and that whole bundle needs to be templated (different image tags/replica counts/domains per environment), versioned, installable as one unit, and upgradeable/rollback-able as one unit. Plain `kubectl apply -f` on a directory of static YAML gives you none of that — Helm's entire value proposition is templating plus release lifecycle management on top of raw manifests.

A **chart** is a Helm package: a directory (or packaged `.tgz`) containing `Chart.yaml` (metadata — name, version, dependencies), a `templates/` directory of Kubernetes manifests written with Go template syntax, and a `values.yaml` file providing the default values those templates reference. The templating is the core mechanic — instead of a static `replicas: 3` in a Deployment, a chart's template has `replicas: {{ .Values.replicaCount }}`, and `values.yaml` supplies the default. This is what makes one chart deployable across dev/staging/prod, or by different teams entirely, by overriding values (`helm install --set replicaCount=10` or a separate `values-prod.yaml`) rather than maintaining parallel copies of near-identical YAML. Charts can also declare dependencies on other charts (subcharts) — a chart for your application might depend on the community `postgresql` or `redis` chart, pulling in a full, production-tuned database deployment as a reusable dependency instead of hand-rolling one.

Installing a chart into a cluster creates a **release** — a named, versioned instance of that chart's rendered manifests actually running in a specific namespace. Critically, "release" is the unit Helm actually tracks and operates on: you can install the same chart multiple times into the same cluster under different release names (e.g., `helm install app-blue mychart` and `helm install app-green mychart`), and Helm records each release's history as a series of revisions, storing the exact rendered manifest for each revision (as a Secret in the release's namespace, in Helm 3). That revision history is what makes rollback possible: `helm rollback <release> <revision>` doesn't recompute anything, it just re-applies the exact previously-rendered manifest set from that stored revision — conceptually parallel to how a Deployment keeps old ReplicaSets around for `kubectl rollout undo`, but at the level of an entire multi-object application bundle instead of one Pod template.

The three core lifecycle commands map directly onto this model: `helm install` renders a chart's templates with a given set of values and applies the result, creating revision 1 of a new release; `helm upgrade` re-renders the same (or a newer) chart with new values and applies the diff, creating a new revision of an existing release — this is how you change image tags, scale counts, or config without recreating the release from scratch; `helm rollback` reverts a release to an earlier stored revision. It's worth knowing that Helm 3 (the current major version) removed **Tiller**, the in-cluster server-side component Helm 2 required — Helm 3 is a pure client that talks directly to the Kubernetes API server using your existing kubeconfig credentials and RBAC, which removed a significant, frequently over-privileged attack surface from earlier Helm deployments.

## Examples

```
# Typical chart directory layout
mychart/
├── Chart.yaml            # name, version, appVersion, dependencies
├── values.yaml            # default values referenced by templates
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   └── _helpers.tpl       # reusable named template snippets
└── charts/                 # vendored subchart dependencies
```

```yaml
# templates/deployment.yaml — templated with Go template syntax against values.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-web
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ .Release.Name }}
  template:
    metadata:
      labels:
        app: {{ .Release.Name }}
    spec:
      containers:
        - name: web
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
```

```yaml
# values.yaml — defaults, overridden per environment at install/upgrade time
replicaCount: 2
image:
  repository: myregistry/web-app
  tag: "1.4.0"
resources:
  requests:
    cpu: 100m
    memory: 128Mi
```

```bash
# Core release lifecycle
helm install web-app ./mychart -f values-prod.yaml --namespace prod
helm upgrade web-app ./mychart --set image.tag=1.5.0 --namespace prod
helm rollback web-app 2 --namespace prod   # revert to revision 2

# Inspect what a chart would actually render before applying it
helm template ./mychart -f values-prod.yaml
helm install web-app ./mychart --dry-run --debug

# Release introspection
helm list --namespace prod
helm history web-app --namespace prod
```

## Common Pitfalls / Gotchas

- Confusing `helm upgrade` semantics — it computes a diff against the currently deployed manifest, not against `values.yaml` alone, so a value you removed from `values.yaml` without an explicit override can silently persist if it was previously set via `--set`; `helm upgrade --install` combined with explicit, complete values files avoids drift between what you think is deployed and what actually is.
- Treating `helm template`/`--dry-run` as optional — templating errors (bad indentation from `nindent`, missing `.Values` keys) are only caught at render time, and rendering client-side before applying is the cheapest way to catch a broken chart before it reaches the cluster.
- Vendoring subchart dependencies (like a community `postgresql` chart) without pinning exact versions in `Chart.yaml` — an unpinned or loosely pinned dependency can pull in breaking changes on the next `helm dependency update`.
- Forgetting that `helm uninstall` deletes all resources in the release by default, including any PersistentVolumeClaims a chart's templates created — unless the chart's PVC templates carry a `helm.sh/resource-policy: keep` annotation, uninstalling a database release can delete its data volume along with everything else.
- Managing raw `--set` flags across many environments instead of layered `values-<env>.yaml` files — `--set` values aren't version-controlled or easily diffable, making it hard to know exactly what was deployed where without checking `helm get values` after the fact.

## Interview Questions & Answers

**Q: What problem does Helm solve that plain `kubectl apply -f` doesn't?**
A: Real applications are bundles of many related manifests (Deployment, Service, ConfigMap, Ingress, RBAC), and those bundles need to be templated for different environments, installed/upgraded/rolled back as one atomic unit, and versioned with history. `kubectl apply -f` on static YAML has no templating and no concept of a release or revision history — Helm adds a templating layer (charts + values) and a release-tracking layer (revisions, rollback) on top of the same underlying manifests.

**Q: What's the difference between a chart, a release, and a revision?**
A: A chart is the packaged template — the reusable definition of an application (`Chart.yaml`, `templates/`, `values.yaml`). A release is a specific named, running instance of a chart installed into a cluster/namespace — the same chart can be installed multiple times as different releases. A revision is one version in a release's history — every `helm upgrade` (or `install`/`rollback`) creates a new revision, and Helm stores the fully rendered manifest for each one, which is what `helm rollback` reverts to.

**Q: How does `helm rollback` actually work under the hood?**
A: Helm doesn't recompute or re-render anything at rollback time — for every revision, Helm already stored the exact rendered manifest set that was applied (as a Secret in the release's namespace, in Helm 3). `helm rollback <release> <revision>` simply re-applies that previously stored, already-rendered manifest, the same way `kubectl rollout undo` re-activates a previously retained ReplicaSet rather than reconstructing a Pod template from scratch.

**Q: What was Tiller, and why was it removed in Helm 3?**
A: Tiller was an in-cluster server-side component in Helm 2 that actually executed install/upgrade operations on behalf of the client, typically running with broad, often cluster-admin-level RBAC permissions shared by every user of the cluster — a significant and frequently over-privileged attack surface, and a component separate from normal Kubernetes RBAC. Helm 3 removed it entirely; the `helm` CLI is a pure client that talks directly to the Kubernetes API server using the invoking user's own kubeconfig credentials and RBAC permissions, which is both simpler and considerably more secure.

**Q: How would you safely test what a chart change will actually deploy before running it against a real cluster?**
A: `helm template ./mychart -f values-prod.yaml` renders the chart's templates locally with the given values and prints the resulting Kubernetes manifests without contacting the cluster at all — useful for diffing against the previous render or catching template syntax errors. `helm upgrade --dry-run --debug` goes a step further and validates against the live cluster (including checking against the API server) without actually applying anything, catching issues like invalid API versions or admission-webhook rejections that a pure local render wouldn't catch.

## Related Topics

- [deployments.md](./deployments.md)
- [configmaps-and-secrets.md](./configmaps-and-secrets.md)
- [namespaces.md](./namespaces.md)
- [troubleshooting.md](./troubleshooting.md)
