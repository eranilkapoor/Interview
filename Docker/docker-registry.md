# Docker Registry

A registry is any server implementing the Docker/OCI Distribution API for storing and serving image layers and manifests — Docker Hub is one specific, public instance of a registry, but the term itself is generic. Teams that need private image storage, tighter access control, data residency guarantees, or lower-latency pulls from their own infrastructure run or consume a **private registry** instead of (or alongside) Docker Hub. There are two broad flavors: self-hosting the open-source registry yourself, or using a managed cloud registry tied to your cloud provider's IAM.

The simplest self-hosted option is Docker's own open-source `registry:2` image (the "Docker Distribution" project) — it's literally a container you run that implements the storage and API side of a registry, backed by local disk, S3, Azure Blob, or GCS. It's fine for small teams or air-gapped environments but you own TLS termination, auth, garbage collection of unreferenced layers, and storage scaling yourself, which is why most production setups either put a proper auth proxy in front of it or move to a managed option. The three major cloud registries — AWS ECR (Elastic Container Registry), Google Artifact Registry (which superseded the older GCR), and Azure ACR (Azure Container Registry) — handle all of that for you: they scale storage automatically, integrate directly with the cloud's IAM so you authenticate with cloud credentials instead of a separate registry password, replicate across regions, and typically include built-in vulnerability scanning of pushed images.

Authentication differs meaningfully by registry type. Against a bare `registry:2` instance, you typically front it with something like `htpasswd`-based basic auth or a token server, and authenticate the normal `docker login myregistry.example.com` way with a username and password/token, which Docker stores in `~/.docker/config.json`. Cloud registries instead lean on the cloud's own identity system: for ECR you run `aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com`, which exchanges short-lived AWS credentials for a registry auth token rather than a long-lived password; ACR and Artifact Registry follow the same pattern with `az acr login` and `gcloud auth configure-docker` respectively. In Kubernetes, pulling from any private registry additionally requires an `imagePullSecret` — a Secret holding registry credentials that's referenced from the Pod spec (or a ServiceAccount) so the kubelet can authenticate its pulls; cloud-native clusters (EKS, GKE, AKS) often wire this up automatically via node IAM roles instead of a manually created secret.

Image naming for a non-Hub registry always includes the registry host as the leading path segment: `myregistry.example.com/team/app:tag`, or for ECR something like `123456789012.dkr.ecr.us-east-1.amazonaws.com/team/app:tag`. This is how Docker decides where to push or pull from — no host prefix means Docker Hub, any other prefix routes there instead. A self-hosted registry that isn't fronted by a valid TLS certificate is treated by the Docker daemon as "insecure," and by default the daemon refuses to talk to it over plain HTTP; you either terminate proper TLS in front of it or explicitly opt in via the daemon's `insecure-registries` setting in `/etc/docker/daemon.json`, which is acceptable for an isolated lab/CI network but should never be used for anything reachable outside a trusted network, since it means credentials and layers travel unencrypted and unauthenticated at the transport level.

## Examples

```bash
# Run a private registry locally, backed by a Docker volume for persistence
docker run -d -p 5000:5000 --restart=always --name registry \
  -v registry-data:/var/lib/registry \
  registry:2
```

This starts Docker's own open-source registry on port 5000; without TLS in front of it, Docker will treat `localhost:5000` as insecure by default (loopback addresses get this exception automatically).

```bash
# Tag and push an image to that private registry, and to AWS ECR
docker tag my-api:1.4.0 localhost:5000/team/my-api:1.4.0
docker push localhost:5000/team/my-api:1.4.0

aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
docker tag my-api:1.4.0 123456789012.dkr.ecr.us-east-1.amazonaws.com/team/my-api:1.4.0
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/team/my-api:1.4.0
```

Note the registry host is baked directly into the tag — that's what routes the push to the right destination, and each registry needs its own `docker login` before pushing.

```yaml
# Kubernetes: pulling from a private registry requires an imagePullSecret
apiVersion: v1
kind: Pod
metadata:
  name: my-api
spec:
  containers:
    - name: my-api
      image: myregistry.example.com/team/my-api:1.4.0
  imagePullSecrets:
    - name: myregistry-creds
```

`myregistry-creds` is a Secret of type `kubernetes.io/dockerconfigjson`, typically created with `kubectl create secret docker-registry`, containing the credentials the kubelet uses to authenticate its pull.

## Common Pitfalls / Gotchas

- Running `registry:2` in production without TLS or auth in front of it — anyone who can reach the port can pull (and often push) images unrestricted.
- Forgetting registry garbage collection: deleting a tag via the API doesn't reclaim disk space until you run the registry's `garbage-collect` maintenance command, and it typically requires the registry to be read-only or stopped during collection.
- Mixing up `insecure-registries` (an HTTP/TLS trust exception) with actual access control — an insecure registry can still require auth, and a TLS-secured one can still be wide open if auth isn't configured.
- Assuming cloud IAM-based registry auth tokens don't expire — ECR tokens, for example, are valid for only 12 hours, so long-running build agents need to re-authenticate periodically rather than caching `docker login` indefinitely.
- Pushing an image tagged for Docker Hub (no host prefix) and expecting it to land in your private registry — the host prefix in the tag is what determines the destination, not your current `docker login` session.

## Interview Questions & Answers

**Q: What's the difference between Docker Hub and "a Docker registry"?**
A: Registry is the generic term for any server implementing the Distribution API that stores and serves image layers and manifests; Docker Hub is one specific public, hosted registry. Private registries — self-hosted via the `registry:2` image, or managed cloud services like ECR, Artifact Registry, or ACR — are also registries, just not Docker Hub.

**Q: How does authentication differ between a self-hosted registry and a cloud registry like ECR?**
A: A self-hosted `registry:2` instance typically needs you to bolt on your own auth layer (basic auth via htpasswd, or a token auth server) and you log in with a registry-specific username/password. Cloud registries integrate with the provider's IAM instead — for ECR, you exchange short-lived AWS credentials for a registry token via `aws ecr get-login-password`, so access is governed by IAM policy rather than a separate credential store, and the resulting login token expires (12 hours for ECR).

**Q: Why does the Docker daemon refuse to pull from `myregistry.local:5000` even though credentials are correct?**
A: By default the daemon only speaks to registries over HTTPS; a registry without valid TLS is "insecure," and unless its host:port is explicitly listed under `insecure-registries` in the daemon's config (or it's a loopback address, which gets an automatic exception), the daemon refuses the connection outright regardless of whether authentication would otherwise succeed.

**Q: What is an `imagePullSecret` in Kubernetes and why is it needed?**
A: It's a Kubernetes Secret (type `dockerconfigjson`) holding registry credentials, referenced by a Pod or its ServiceAccount, that the kubelet uses to authenticate when pulling a private image referenced in the Pod spec. Without it, the kubelet has no credentials to present to the registry and the pull fails with an authorization error — public/Hub images without restriction don't need one, but any private registry image does, unless node-level IAM (as on EKS/GKE with workload identity) supplies the credentials instead.

**Q: When would you choose to self-host a registry instead of using a cloud-managed one?**
A: Mainly for air-gapped or on-premise environments with no outbound internet access, strict data-residency requirements that rule out a cloud vendor, or very small setups where the operational overhead of TLS, auth, and garbage collection is acceptable in exchange for not depending on (or paying for) a managed service. Most teams with any cloud footprint default to the managed option because it removes that operational burden and comes with IAM integration and often built-in scanning for free.

## Related Topics

- [docker-hub.md](./docker-hub.md)
- [container-security.md](./container-security.md)
- [docker-in-production.md](./docker-in-production.md)
- [docker-swarm.md](./docker-swarm.md)
- [images-and-containers.md](./images-and-containers.md)
- [docker-commands.md](./docker-commands.md)
