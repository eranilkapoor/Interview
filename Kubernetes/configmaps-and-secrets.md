# ConfigMaps and Secrets

ConfigMaps and Secrets both solve the same underlying problem — decoupling configuration from a container image, so the same image can run in dev, staging, and production with different settings without being rebuilt — but they exist as two separate object kinds because of the different sensitivity of what they hold. A **ConfigMap** stores non-sensitive configuration: key-value pairs, whole config files, feature flags, URLs. A **Secret** stores sensitive data: passwords, API keys, TLS certificates, tokens. Structurally they're nearly identical (both are just maps of keys to values), and that structural similarity is exactly what causes the most common interview trap.

**Secrets are base64-encoded, not encrypted.** Base64 is an encoding, not an encryption scheme — it has no key, and anyone with read access to the Secret object (or its representation in etcd, if etcd itself isn't encrypted at rest) can trivially decode it with `base64 -d`. `kubectl get secret <name> -o yaml` returns the base64 string directly. This means RBAC controlling who can `get`/`list` Secret objects is the *actual* security boundary, not the encoding — and by default, anyone who can `exec` into a Pod that mounts a Secret can read the decoded value on disk or in the environment. For real secret protection you need etcd encryption at rest (encrypting the Secret data before it's persisted), tightly scoped RBAC, and often an external secrets manager (AWS Secrets Manager, HashiCorp Vault) integrated via a tool like External Secrets Operator, rather than relying on the Secret object's encoding alone.

Both ConfigMaps and Secrets can be consumed by Pods in two different ways, and the choice has real operational consequences: as **environment variables** (via `envFrom` or individual `valueFrom.configMapKeyRef`/`secretKeyRef` entries), or as **mounted volumes**, where each key becomes a file in a mounted directory. Environment variables are simpler but are captured once at container start — if the underlying ConfigMap/Secret changes, a container using env vars will **not** see the update until it's restarted. Volume-mounted ConfigMaps/Secrets, by contrast, are updated on the filesystem automatically by the kubelet (via a symlink-swap mechanism) after a propagation delay — typically up to the kubelet's sync period, roughly one minute by default, though the exact interval is not guaranteed. Even with volume mounts, most applications don't watch their config files for changes and reload automatically — so a rolling restart of the Deployment is still the common, reliable way to actually apply a ConfigMap/Secret change, regardless of which consumption method you used.

An additional edge case worth knowing: `subPath` volume mounts (used to mount a single key as a file inside an existing directory without replacing everything else in that directory) break the automatic update propagation entirely — a `subPath`-mounted ConfigMap/Secret key will never update on disk without a Pod restart, because the kubelet's update mechanism relies on swapping a directory symlink, which `subPath` mounts bypass.

## Examples

```yaml
# ConfigMap with plain key-value config and a full config file
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  LOG_LEVEL: "info"
  FEATURE_NEW_CHECKOUT: "true"
  app.properties: |
    max.connections=100
    timeout.seconds=30
```

```yaml
# Secret — note: data values here are base64, not encrypted
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: Opaque
data:
  username: cG9zdGdyZXM=        # echo -n 'postgres' | base64
  password: c3VwZXJzZWNyZXQxMjM=  # echo -n 'supersecret123' | base64
```

```yaml
# Consuming both: env vars from ConfigMap, mounted volume from Secret
apiVersion: v1
kind: Pod
metadata:
  name: app-pod
spec:
  containers:
    - name: app
      image: myregistry/web-app:1.4.0
      envFrom:
        - configMapRef:
            name: app-config
      env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
      volumeMounts:
        - name: db-creds-vol
          mountPath: /etc/secrets/db
          readOnly: true
  volumes:
    - name: db-creds-vol
      secret:
        secretName: db-credentials
```

```bash
# Create a Secret imperatively from literal values (kubectl handles base64 encoding)
kubectl create secret generic db-credentials \
  --from-literal=username=postgres \
  --from-literal=password=supersecret123

# Decode a Secret's value manually — proving base64 is not encryption
kubectl get secret db-credentials -o jsonpath='{.data.password}' | base64 -d
```

## Common Pitfalls / Gotchas

- Treating base64 encoding as encryption — anyone who can read the Secret object or exec into a Pod mounting it can trivially decode the value; the real security controls are RBAC, etcd encryption at rest, and least-privilege access, not the encoding.
- Assuming a container automatically picks up a ConfigMap/Secret change — env-var consumption never updates without a restart, and even volume-mounted updates require the application to actively watch and reload its config files, which most apps don't do by default.
- Using `subPath` to mount a single ConfigMap/Secret key and then being confused why updates never propagate — `subPath` mounts bypass the kubelet's symlink-swap update mechanism entirely.
- Committing raw Secret manifests (with base64 data, which is trivially reversible) into git — use sealed-secrets, SOPS, or an external secrets operator instead of plaintext-adjacent Secret YAML in version control.
- Hitting the ~1MiB size limit on ConfigMaps/Secrets (backed by etcd's per-object size limit) by trying to store large files or datasets in them — they're meant for configuration, not bulk data; use a volume/object storage for that.

## Interview Questions & Answers

**Q: What's the actual difference between a ConfigMap and a Secret, given that they're structurally almost identical?**
A: The difference is intent and default handling, not the storage mechanism — both hold key-value data, but a Secret's values are base64-encoded (versus stored as plain strings in a ConfigMap) and Kubernetes treats Secrets slightly more carefully by default: they're excluded from `kubectl describe` output values, can be encrypted at rest in etcd (opt-in), and are usually subject to tighter RBAC in a well-configured cluster. Structurally you could put a password in a ConfigMap and it would technically work — the distinction is entirely about signaling sensitivity and enabling the additional protections that only apply to the Secret kind.

**Q: Is base64 encoding in a Secret a form of encryption? Why does this matter?**
A: No — base64 is a reversible encoding with no key, so anyone with read access to the Secret object (via the API, `kubectl get -o yaml`, or by exec-ing into a Pod that mounts it) can decode it in one command. It matters because teams sometimes treat Secrets as "safe" storage based on the name alone; the actual security boundary is RBAC (who can `get`/`list` Secrets), etcd encryption at rest, and — for stronger guarantees — integrating an external secrets manager rather than relying on the object type itself.

**Q: If you update a ConfigMap that a running Pod already consumes, does the Pod see the change?**
A: It depends entirely on how it's consumed. If the ConfigMap is injected as environment variables, no — env vars are resolved once at container start and never refresh; the Pod needs to be restarted. If it's mounted as a volume, the kubelet does update the files on disk automatically, but only after a propagation delay (roughly up to its sync period, about a minute by default) and only if `subPath` isn't used — and even then, the application itself has to be watching that file and reloading, which most applications don't do without being written specifically for it.

**Q: Why would `subPath` volume mounts prevent a Secret update from ever reaching a running Pod?**
A: The kubelet's update mechanism for mounted ConfigMaps/Secrets works by atomically swapping a symlink to a new versioned directory — the whole directory gets replaced at once. `subPath` mounts a specific file directly by bind-mounting into an existing directory structure rather than through that symlinked directory, which sidesteps the swap mechanism entirely — so a `subPath`-mounted key is effectively frozen at Pod-start value until the Pod is recreated.

**Q: How would you manage secrets more securely than plain Kubernetes Secret objects in a production cluster?**
A: Enable etcd encryption at rest so Secret data isn't stored in plaintext-equivalent form in the datastore, enforce tight RBAC so only the specific ServiceAccounts/users that need a given Secret can read it, and avoid committing raw Secret manifests to git — use something like Sealed Secrets or SOPS for GitOps-safe encrypted-at-rest-in-git secrets, or better, an external secrets manager (Vault, AWS Secrets Manager) synced into the cluster via an operator like External Secrets Operator, so the actual secret material never lives in your manifests at all.

## Related Topics

- [pods.md](./pods.md)
- [deployments.md](./deployments.md)
- [ingress.md](./ingress.md)
- [helm.md](./helm.md)
