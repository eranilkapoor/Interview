# Docker Hub

Docker Hub is Docker's own public, hosted image registry — the default place `docker pull` and `docker push` talk to when no registry host is specified in an image name. When you run `docker pull nginx`, Docker expands that to `docker.io/library/nginx:latest` behind the scenes; `library/` is the namespace reserved for **official images** — curated, Docker-sanctioned base images (nginx, postgres, node, alpine, python) that are scanned, documented, and maintained with security patches on a defined cadence. Above that tier sit **Docker Verified Publisher** images, which are published by companies (Microsoft, Bitnami, Confluent, etc.) that Docker has vetted and who commit to a maintenance SLA, but which live under the publisher's own namespace rather than `library/`. Below both are ordinary **community/user images** pushed by anyone with a free account — no vetting, no guarantee of maintenance, and a much wider variance in quality and security hygiene, so pulling a random community image into production without inspecting its Dockerfile or scanning it is a real risk.

Image names on Hub follow `[registry/]namespace/repository[:tag]`; when the registry is omitted it defaults to Docker Hub, and when the namespace is omitted (as with official images) it defaults to `library`. Tags are just mutable pointers to a specific image digest, not immutable version identifiers — pushing a new build to the same tag silently moves what that tag resolves to. This is the root of the classic `latest` pitfall: `latest` is not "the newest version," it is simply the tag applied by default when you don't specify one, and plenty of projects never update it or use it inconsistently, so pinning to `latest` in production means you have no idea what you'll actually get on the next pull, and rollbacks become guesswork. The fix is to pin to an explicit version tag (`node:22.11.0-alpine`) or, for true immutability, pin to a content digest (`node@sha256:...`), which always resolves to exactly the same bytes regardless of what happens to the tag.

Docker Hub enforces pull rate limits to control load on its free tier: anonymous (unauthenticated) pulls are capped at roughly 100 pulls per 6 hours per IP address, and authenticated free-tier accounts get a higher allowance, commonly cited around 200 pulls per 6 hours — these exact numbers have changed over time and depend on account tier, so in interviews it's more accurate to describe the shape of the policy (anonymous < free authenticated < paid) than to quote a specific figure as gospel. The practical consequence is that CI pipelines and Kubernetes clusters that pull frequently from Hub without authenticating can get rate-limited (`429 Too Many Requests`) during busy periods, which is why teams either authenticate their pulls with `docker login`, use a pull-through cache/mirror, or push their base images into a private registry they control.

The push workflow is: `docker login` (stores a token in `~/.docker/config.json` after prompting for credentials or a personal access token), `docker build -t <dockerhub-username>/<repo>:<tag> .` to tag the image with your namespace, then `docker push <dockerhub-username>/<repo>:<tag>`. Hub also supports **automated builds**, where a repository is linked to a GitHub/Bitbucket source repo and a webhook triggers a fresh `docker build` and push whenever you commit — useful for keeping an image reproducibly tied to source, though most teams today do the equivalent in CI (GitHub Actions, GitLab CI) for more control over build args, multi-arch builds, and test gating before push.

## Examples

```bash
# Authenticate to Docker Hub (prompts for username + password or PAT)
docker login
# Build and tag an image under your Hub namespace
docker build -t anilkapoor/my-api:1.4.0 .
# Push it
docker push anilkapoor/my-api:1.4.0
```

Tags are arbitrary strings you choose at build time; here `1.4.0` is an explicit semantic version rather than relying on the mutable `latest` default.

```bash
# Pull an official image by explicit version, not `latest`
docker pull postgres:16.4-alpine
# Pull by immutable digest — guarantees byte-identical content regardless of tag reuse
docker pull postgres@sha256:6f3d4b1a...c2
```

Pinning by digest is the strongest guarantee available; it survives even if someone re-pushes a different image under the same tag.

```dockerfile
# Referencing an official image explicitly from Docker Hub's default registry
FROM node:22.11-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["node", "server.js"]
```

Because no registry host is given, this resolves to `docker.io/library/node:22.11-alpine` — the official Node image maintained under Hub's `library` namespace.

## Common Pitfalls / Gotchas

- Treating `latest` as "the newest stable release" — it's just a tag name that happens to be the default, and nothing prevents an image from never updating it or from having `latest` point at something older than a numbered tag.
- Hitting anonymous pull rate limits in CI/CD or Kubernetes clusters because nodes pull unauthenticated at scale; the fix is authenticating pulls or running a pull-through cache.
- Assuming any image under a plausible-looking namespace is trustworthy — only `library/` (official) and verified-publisher images carry Docker's vetting; anything else is unaudited community content.
- Forgetting that `docker login` credentials are cached in `~/.docker/config.json`, sometimes in plaintext or a weakly protected credential store, which is a concern on shared CI runners.
- Confusing a private repository setting on Docker Hub (limits who can pull) with actual private hosting — Hub free tier historically limited how many private repos you got, pushing teams toward a self-hosted or cloud registry once they need many private images (see docker-registry.md).

## Interview Questions & Answers

**Q: What's the difference between an official image and a verified publisher image on Docker Hub?**
A: Official images live under the `library/` namespace, are curated and maintained by Docker directly (or in partnership with the upstream project), and follow a defined security update cadence — `nginx`, `redis`, `python` are examples. Verified Publisher images are maintained by companies Docker has vetted and who commit to a support SLA, but they're published under that company's own namespace (e.g., `bitnami/nginx`), not `library/`. Both are more trustworthy than arbitrary community images, which have no vetting at all.

**Q: Why is relying on the `latest` tag risky in production, and what should you do instead?**
A: `latest` is a mutable tag that simply gets applied by default when no tag is specified at push time — it doesn't guarantee you're getting the newest or most stable build, and what it points to can change out from under you between pulls, breaking reproducibility and making rollbacks unpredictable. Pin to an explicit version tag, or better, to a content digest (`image@sha256:...`), which is immutable and guarantees byte-identical pulls.

**Q: Your CI pipeline started failing with `429 Too Many Requests` pulling from Docker Hub. What's happening and how do you fix it?**
A: You're hitting Docker Hub's pull rate limit, which is lower for anonymous pulls than authenticated ones and lower still than paid tiers. Fixes include authenticating pulls with `docker login` in CI using a service account/token, running a local pull-through registry mirror to cache images, or hosting your own base images in a private/cloud registry so CI doesn't repeatedly hit Hub at all.

**Q: How does `docker push` know where to send an image?**
A: From the image's tag/name itself. A tag of the form `namespace/repo:tag` with no registry host defaults to Docker Hub (`docker.io`); a tag prefixed with a host, like `myregistry.example.com/namespace/repo:tag`, pushes to that registry instead. You must `docker login` to whichever registry the name implies, or the push (or pull, for private images) is rejected with an authentication error.

**Q: What is an automated build on Docker Hub?**
A: A Hub repository linked to a source repo (GitHub/Bitbucket) so that a webhook triggers Docker Hub to run `docker build` and publish a new tag automatically on commits or tag pushes, keeping the published image traceably tied to a specific source revision without a manual local push. Many teams now replicate this in their own CI system instead, since it gives more control over build arguments, test gating, and multi-architecture builds before anything is published.

## Related Topics

- [docker-registry.md](./docker-registry.md)
- [docker-file.md](./docker-file.md)
- [images-and-containers.md](./images-and-containers.md)
- [container-security.md](./container-security.md)
- [docker-commands.md](./docker-commands.md)
- [docker-in-production.md](./docker-in-production.md)
