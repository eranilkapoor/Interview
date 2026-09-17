# Persistent Volumes

Pods are ephemeral by design — anything written to a container's writable layer or an `emptyDir` volume is lost when the Pod is deleted or rescheduled. For workloads that need durable storage (databases, file uploads, anything stateful), Kubernetes separates the concern of "how storage is actually provisioned" from "how a Pod asks for storage" through two linked objects: **PersistentVolume (PV)** and **PersistentVolumeClaim (PVC)**.

A **PersistentVolume** represents an actual piece of storage in the cluster — a cloud disk (EBS, Persistent Disk, Azure Disk), an NFS share, or any other storage backend — provisioned either manually by a cluster admin (**static provisioning**) or automatically on demand (**dynamic provisioning**, described below). A **PersistentVolumeClaim** is a *request* for storage made by a user/Pod — "I need 10Gi, ReadWriteOnce, at least this fast" — without needing to know or care which specific PV, disk, or backend fulfills it. Kubernetes binds a PVC to a matching PV (one PVC to exactly one PV, a 1:1 relationship), and a Pod then references the PVC (never the PV directly) in its volume spec. This indirection is the whole point: application manifests only ever talk about PVCs, so the same Pod spec is portable across clusters with completely different underlying storage, and storage provisioning becomes an infrastructure concern decoupled from application deployment.

**Dynamic provisioning** removes the need for an admin to pre-create PVs at all: a **StorageClass** object defines a storage "flavor" (e.g., `fast-ssd` backed by AWS `gp3` volumes, or `standard` backed by `gp2`) along with a `provisioner` (a plugin, typically a CSI driver, that knows how to actually create the underlying disk). When a PVC references a StorageClass and no matching PV exists yet, the provisioner creates one on the fly, sized and configured to satisfy the claim, and binds it automatically — this is how storage requests in production clusters are almost always fulfilled today, rather than an admin manually pre-provisioning a pool of PVs.

Two more properties determine what a PV/PVC combination actually allows. **Access modes** define how many nodes can mount the volume and in what mode: `ReadWriteOnce` (RWO) — read-write by a single node at a time (the vast majority of block-storage-backed volumes, like EBS, only support this); `ReadOnlyMany` (ROX) — read-only by many nodes simultaneously; `ReadWriteMany` (RWX) — read-write by many nodes simultaneously (requires a storage backend that supports concurrent access, like NFS, EFS, or a distributed filesystem — most cloud block storage does not support RWX). Confusing RWO for RWX is a very common production incident: a Deployment with multiple replicas all trying to mount the same RWO PVC will have all but one Pod stuck `Pending` because the volume is already attached read-write to a Pod on a different node. **Reclaim policy** determines what happens to the underlying storage when its PVC is deleted: `Delete` (the default for dynamically provisioned volumes) destroys the underlying storage asset along with the PV — fast cleanup, but genuinely destructive; `Retain` keeps the underlying storage and the PV object (now in a `Released` state, requiring manual admin intervention to reuse or clean up) even after the PVC is gone — safer for data you can't afford to lose to an accidental deletion.

## Examples

```yaml
# A StorageClass enabling dynamic provisioning of fast SSD-backed volumes on AWS
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
```

```yaml
# A PVC requesting 10Gi from that StorageClass — no PV needs to pre-exist
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: fast-ssd
  resources:
    requests:
      storage: 10Gi
```

```yaml
# A Pod (inside a StatefulSet template, typically) consuming the PVC by name
apiVersion: v1
kind: Pod
metadata:
  name: postgres
spec:
  containers:
    - name: postgres
      image: postgres:16
      volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: postgres-data
```

```bash
# Check PVC binding status and which PV it's bound to
kubectl get pvc postgres-data
# NAME            STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS
# postgres-data   Bound    pvc-8f3e1a2b-...                           10Gi       RWO            fast-ssd

kubectl describe pvc postgres-data
# Events section shows provisioning failures (quota, no matching StorageClass, etc.)
```

## Common Pitfalls / Gotchas

- Scaling a Deployment (not a StatefulSet) that mounts an RWO PVC to more than one replica — only one Pod can mount it read-write at a time, so additional replicas get stuck `Pending` waiting for the volume; RWX storage or a StatefulSet with per-replica PVCs (via `volumeClaimTemplates`) is the actual fix.
- Assuming `reclaimPolicy: Delete` (the dynamic-provisioning default) is always safe — deleting a PVC on a `Delete`-policy PV permanently destroys the underlying disk and its data, with no recovery; production databases usually want `Retain` plus a deliberate cleanup process.
- Forgetting that a PV's `storageClassName`, access modes, and size must all be compatible with a PVC for binding to succeed — a PVC requesting `20Gi` will not bind to a `10Gi` PV even if everything else matches (size must be greater than or equal to the request).
- Not setting `volumeBindingMode: WaitForFirstConsumer` on a StorageClass in a multi-zone cluster — with the default `Immediate` mode, a volume can get provisioned in a zone before the scheduler knows which zone the Pod will land in, causing the Pod to become unschedulable if it ends up assigned to a different zone.
- Deleting a Pod and expecting its PVC-backed data to vanish — it doesn't; the PVC (and its underlying PV/disk) persists independently of any specific Pod until the PVC itself is explicitly deleted, which is the entire point of persistent storage.

## Interview Questions & Answers

**Q: What's the difference between a PersistentVolume and a PersistentVolumeClaim?**
A: A PersistentVolume is the actual storage resource in the cluster — a real disk or share, either pre-provisioned by an admin or dynamically created by a provisioner. A PersistentVolumeClaim is a request for storage made by a user or Pod spec, stating requirements like size and access mode without referencing a specific PV. Kubernetes binds a PVC to a satisfying PV, and Pods mount the PVC, not the PV directly — this indirection decouples application manifests from the specifics of the underlying storage backend.

**Q: How does dynamic provisioning work, and why is it preferred over static provisioning in most clusters?**
A: A StorageClass defines a storage type and references a provisioner (typically a CSI driver) that knows how to create real storage on demand. When a PVC references that StorageClass and no matching PV exists, the provisioner automatically creates one sized to the claim and binds it — no admin has to pre-create a pool of PVs ahead of time. It's preferred because it removes a manual, error-prone capacity-planning step and lets storage scale on demand alongside application deployment.

**Q: Explain ReadWriteOnce vs ReadWriteMany, and describe a real incident that comes from confusing them.**
A: RWO allows the volume to be mounted read-write by only one node at a time; RWX allows many nodes to mount it read-write concurrently, but requires a backend that actually supports concurrent access (NFS, EFS, certain distributed filesystems) — most cloud block storage (EBS, Persistent Disk) is RWO-only. A real incident: scaling a Deployment that mounts an RWO PVC to multiple replicas — the first Pod grabs the volume, and every additional replica lands on a different node and gets stuck `Pending` indefinitely because the volume can't be attached read-write to two nodes simultaneously.

**Q: What's the difference between the `Delete` and `Retain` reclaim policies, and when would you choose each?**
A: `Delete` removes the underlying storage asset (the actual disk) as soon as its PVC is deleted — convenient for ephemeral or easily-recreated data, but destructive and irreversible. `Retain` keeps both the PV object and its underlying storage after the PVC is deleted, marking the PV `Released` and requiring manual admin action to clean up or repurpose it — you'd choose `Retain` for anything you cannot afford to lose to an accidental `kubectl delete pvc`, like production database volumes, accepting the operational overhead of manual cleanup in exchange for a safety net.

**Q: A Pod using a PVC is stuck in `Pending`. How do you figure out why?**
A: Start with `kubectl describe pod` to see if it's a scheduling issue versus a volume issue, then `kubectl get pvc` to check if the PVC itself is `Bound` or still `Pending` — a `Pending` PVC means no PV could be found or dynamically provisioned to satisfy it (check `kubectl describe pvc` Events for the reason: no matching StorageClass, an RWO volume already attached elsewhere, a zone mismatch under `WaitForFirstConsumer`, or provisioner quota/permission errors). If the PVC is `Bound` but the Pod still won't schedule, check for an access-mode conflict (an RWO volume already mounted by a Pod on a different node) or a zone/topology mismatch between where the PV was provisioned and where the scheduler is trying to place the Pod.

## Related Topics

- [pods.md](./pods.md)
- [namespaces.md](./namespaces.md)
- [troubleshooting.md](./troubleshooting.md)
- [kubernetes-overview.md](./kubernetes-overview.md)
