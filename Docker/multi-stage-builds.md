# Multi-Stage Builds

A single-stage Dockerfile builds everything in one image: the compiler or bundler, every `devDependencies` package, the source tree, intermediate build artifacts, and finally the compiled output all end up in the same filesystem layers. That image is what you ship and run in production, even though a running Node service or compiled Go binary only needs its runtime and a handful of files to actually execute. The result is images that are hundreds of megabytes larger than necessary, carry a bigger attack surface (a C compiler, package manager, and shell you never touch at runtime), and take longer to pull and push through a registry.

Multi-stage builds solve this by letting a single Dockerfile declare multiple `FROM` instructions, each starting a new build stage with its own base image and its own filesystem. You name a stage with `AS <name>` (e.g. `FROM node:22 AS builder`), do all the heavy lifting there — installing full dependency trees, compiling, bundling, running the TypeScript compiler — and then start a fresh, minimal final stage (`FROM node:22-alpine` or `FROM scratch`) that copies over only the specific files it needs using `COPY --from=builder /app/dist ./dist`. Everything else from the builder stage — the compiler toolchain, source `.ts` files, `node_modules` dev dependencies, build caches — is simply discarded because it was never part of the final stage's layers.

`COPY --from` isn't limited to referencing earlier stages by name; it can also pull files out of an arbitrary external image that was never otherwise part of the build, which is a common trick for grabbing a single static binary. For example, `COPY --from=nginx:alpine /etc/nginx/nginx.conf /etc/nginx/nginx.conf` lets you lift a reference config out of the official nginx image without adding nginx as a build dependency, and pulling `COPY --from=golang:1.22 /usr/local/go/bin/gofmt /usr/local/bin/gofmt` grabs one tool binary from a much larger toolchain image.

Docker builds each stage independently and, by default, only stages that are referenced (directly built with `--target`, or copied from) contribute to the final image, but every stage still gets built and cached unless you use `--target` to stop early. Naming stages also makes it possible to build and inspect an intermediate stage in isolation for debugging — `docker build --target builder -t debug-image .` — without touching the final production Dockerfile.

## Examples

```dockerfile
# --- Stage 1: builder — full Node toolchain, ~1.1GB with node_modules & TS ---
FROM node:22 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build          # tsc/webpack/vite emits compiled JS to ./dist
RUN npm ci --omit=dev      # prune devDependencies before copying, still in builder

# --- Stage 2: final — slim runtime, ends up ~180MB ---
FROM node:22-alpine AS final
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
```
The builder stage carries the TypeScript compiler, source `.ts` files, and every transitive dev dependency; none of that exists in the final image — only compiled JS, pruned `node_modules`, and `package.json` are copied across.

```dockerfile
# Go: compiled to a static binary, so the final stage needs no runtime at all
FROM golang:1.22 AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/server ./cmd/server

# scratch has no shell, no libc, no package manager — just the binary
FROM scratch AS final
COPY --from=builder /bin/server /server
COPY --from=builder /src/configs/prod.yaml /configs/prod.yaml
ENTRYPOINT ["/server"]
```
`golang:1.22` is roughly 800MB with the full toolchain; because `CGO_ENABLED=0` produces a statically linked binary with no libc dependency, the final `scratch` image can be as small as 10-20MB — just the binary and any config it reads, with literally nothing else in the filesystem (no shell, so you can't `docker exec` into it for debugging).

```dockerfile
# Building and copying a frontend bundle to be served by nginx
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build           # emits static assets to /app/build

FROM nginx:alpine AS final
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```
The final image is based on `nginx:alpine` (~40MB) rather than a Node image at all — Node is only ever needed to produce the static bundle, not to serve it.

## Common Pitfalls / Gotchas

- Forgetting `AS <name>` on the builder stage and then trying to reference it by name in `COPY --from` — unnamed stages can still be referenced by index (`COPY --from=0 ...`), but that's fragile if you reorder stages later.
- Copying more than needed from the builder stage (e.g. `COPY --from=builder /app .` instead of specific paths), which silently re-introduces source files, test fixtures, or `.git` history into the "slim" final image.
- Not pruning dev dependencies before copying `node_modules` across — if you run `npm ci` once and never `npm ci --omit=dev` or `npm prune --production`, the final stage inherits the same bloated `node_modules` you were trying to avoid.
- Using `scratch` for anything that isn't a fully static binary — a dynamically linked binary (or one built with `CGO_ENABLED=1`) will fail at runtime in `scratch` because there's no libc to resolve against; `distroless` or `alpine` are safer defaults when you need any shared libraries.
- Assuming BuildKit's cache skips unused stages automatically in every Docker setup — with the classic (non-BuildKit) builder, all stages are built even if unreferenced by the final `COPY --from`; enabling BuildKit (`DOCKER_BUILDKIT=1`, default in modern Docker) skips stages that don't contribute to the requested target.

## Interview Questions & Answers

**Q: Why would you use a multi-stage build instead of just cleaning up (deleting build tools) at the end of a single-stage Dockerfile?**
A: Deleting files in a later `RUN` layer doesn't actually shrink the image — Docker images are a stack of read-only layers, and a file deleted in a later layer still physically exists in the earlier layer beneath it, so the image size doesn't decrease even though the file is invisible in the final filesystem. Multi-stage builds avoid this entirely because the final stage starts from a fresh base image and only pulls in the specific files you explicitly `COPY --from` a previous stage; anything not copied genuinely never exists in the final image's layers.

**Q: What's the difference between `COPY --from=builder` and `COPY --from=nginx:alpine`?**
A: `builder` refers to a named stage defined earlier in the same Dockerfile with `FROM ... AS builder`. `nginx:alpine` refers to an entirely separate, externally published image that Docker pulls just to copy files out of — it doesn't need to be declared as a `FROM` stage in this Dockerfile at all. Both use identical `COPY --from` syntax, but the source is a build-local stage in one case and an arbitrary external image in the other.

**Q: When would you pick `distroless` or `alpine` over `scratch` for a final stage?**
A: `scratch` is the empty base image — no shell, no libc, no package manager, nothing. It only works for fully static binaries (like a `CGO_ENABLED=0` Go build). If your binary is dynamically linked, needs CA certificates for outbound HTTPS, or you need any shell access for debugging (`docker exec sh`), `alpine` gives you a minimal but real userland (~5MB), and `distroless` gives you just language runtime dependencies (like libc) without a shell or package manager, as a middle ground between `scratch` and `alpine`.

**Q: Does every `FROM` stage in a multi-stage Dockerfile get built even if it's never copied from?**
A: With BuildKit (the default builder since Docker 23), no — Docker analyzes the dependency graph and only builds stages that the final target actually depends on. With the legacy builder, all stages are built sequentially regardless of whether they're referenced, which wastes build time on stages that never contribute to the output.

**Q: How would you debug why a file is missing in your final stage?**
A: Build and run the intermediate stage directly with `docker build --target builder -t debug .` followed by `docker run -it debug sh`, then inspect the filesystem at the path you're trying to `COPY --from`. This confirms whether the file exists in the source stage before spending time debugging the `COPY` instruction itself.

## Related Topics
- [dockerfile.md](./dockerfile.md)
- [docker-file.md](./docker-file.md)
- [images-and-containers.md](./images-and-containers.md)
- [dockerizing-applications.md](./dockerizing-applications.md)
- [docker-in-production.md](./docker-in-production.md)
- [container-security.md](./container-security.md)
