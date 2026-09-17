# Service Workers

`@angular/service-worker` is Angular's first-party package for turning an Angular application into a Progressive Web App (PWA) — an app that can cache its own assets and data, keep working (at least partially) when the network is offline or flaky, and prompt the user when a new version has been deployed. It's important to separate two layers here: the raw browser **Service Worker API** is a low-level, framework-agnostic JavaScript worker that intercepts network requests via the `fetch` event and can serve cached responses instead of hitting the network — writing one by hand means manually managing cache versions, cache invalidation, and request-matching logic. `@angular/service-worker` is a much higher-level Angular-specific abstraction on top of that: it generates the actual service-worker script (`ngsw-worker.js`) and a manifest for you at build time, driven entirely by a declarative JSON config file, so you describe *what* should be cached and *how*, and Angular's tooling handles the low-level `fetch`-interception and cache-management code.

Setup is `ng add @angular/service-worker`, which installs the package, registers `provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode() })` (or the equivalent `ServiceWorkerModule.register(...)` in an NgModule app) in the app's bootstrap config, and generates a starter `ngsw-config.json`. Critically, the service worker only activates in a production build (`ng build`) served over HTTPS (or `localhost` for testing) — it's disabled by default in `ng serve`/dev mode, which is why `enabled: !isDevMode()` is the generated default; testing it locally requires building and serving the `dist/` output with a static file server, not the dev server.

`ngsw-config.json` is where the actual caching strategy is defined, via two kinds of groups. **Asset groups** describe static build output — JS/CSS bundles, `index.html`, images, fonts — and specify an `installMode` (`prefetch`, meaning cache everything immediately when the service worker installs, versus `lazy`, meaning cache on first request) and an `updateMode` (`prefetch` or `lazy` again, controlling how updated versions of these files are fetched when a new app version is detected). **Data groups** describe runtime API calls (things not known at build time) and specify a `strategy` of either `performance` (serve from cache first, only hit network if not cached — good for data that rarely changes) or `freshness` (try network first with a configurable timeout, fall back to cache if the network is slow/unavailable — good for data that should be as current as possible but degrade gracefully offline), along with cache size limits and max age.

The `SwUpdate` service is the programmatic API for reacting to new deployed versions. Because the service worker serves cached assets by default, a user who has the app open when you deploy a new version won't automatically get it — the new service worker installs in the background but only activates on a specific trigger. `SwUpdate` exposes `versionUpdates` as an Observable you subscribe to, filtering for `VersionReadyEvent` to detect "a new version has been downloaded and is ready," at which point a typical app shows a toast/banner ("A new version is available, refresh to update") and calls `SwUpdate.activateUpdate()` followed by a page reload when the user confirms, or does it automatically. `SwUpdate.isEnabled` tells you whether a service worker is actually registered and active (it won't be in dev mode or unsupported browsers), and `SwUpdate.unrecoverable` fires if the service worker detects it's in a broken state that requires a full reload to fix.

## Examples

```ts
// app.config.ts — registering the Angular service worker for a standalone app
import { ApplicationConfig, isDevMode } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),       // never register during `ng serve`
      registrationStrategy: 'registerWhenStable:30000', // don't compete with initial load
    }),
  ],
};
```

`registerWhenStable:30000` delays registering the service worker until the app has been stable for up to 30 seconds (or immediately once stable), so the service-worker registration doesn't steal bandwidth/CPU from the initial page load.

```json
{
  "$schema": "./node_modules/@angular/service-worker/config/schema.json",
  "index": "/index.html",
  "assetGroups": [
    {
      "name": "app",
      "installMode": "prefetch",
      "resources": { "files": ["/favicon.ico", "/index.html", "/*.css", "/*.js"] }
    },
    {
      "name": "assets",
      "installMode": "lazy",
      "updateMode": "prefetch",
      "resources": { "files": ["/assets/**", "/*.(svg|png|jpg|webp)"] }
    }
  ],
  "dataGroups": [
    {
      "name": "api-freshness",
      "urls": ["/api/products/**"],
      "cacheConfig": {
        "strategy": "freshness",
        "maxSize": 50,
        "maxAge": "1h",
        "timeout": "3s"
      }
    }
  ]
}
```

Core app shell files are `prefetch`-ed (cached immediately on install, so the app works offline from the first visit), decorative assets are cached `lazy` (only once actually requested), and the product API uses a `freshness` strategy that tries the network for up to 3 seconds before falling back to a cached response up to an hour old.

```ts
import { Injectable, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UpdateNotifierService {
  private swUpdate = inject(SwUpdate);

  constructor() {
    if (!this.swUpdate.isEnabled) return; // no service worker active (e.g. dev mode)

    this.swUpdate.versionUpdates
      .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
      .subscribe(() => {
        if (confirm('A new version is available. Reload now?')) {
          // Activates the already-downloaded new version, then reloads to run it.
          this.swUpdate.activateUpdate().then(() => document.location.reload());
        }
      });
  }
}
```

This is the standard pattern for prompting users about a new deployed version: the service worker downloads the update silently in the background, and the app only switches to it after explicit activation, avoiding an unexpected mid-session app swap.

## Common Pitfalls / Gotchas

- Testing service-worker behavior with `ng serve` and being confused when nothing caches — the service worker is disabled in dev mode by default (`enabled: !isDevMode()`); you must run `ng build` and serve the `dist/` folder with a static server (or `http-server`) to see real caching behavior.
- Deploying a new version and expecting already-open tabs to pick it up automatically — by default they keep serving the cached old version until `SwUpdate.activateUpdate()` is called (typically after user confirmation) and the page reloads; without wiring up `SwUpdate`, users can be stuck on a stale version indefinitely.
- Forgetting that the service worker requires HTTPS in production (`localhost` is exempted for local testing) — it silently won't register over plain HTTP.
- Using `performance` strategy for a data group whose backing data changes frequently — users will see stale cached API responses well past when the data actually updated, since `performance` only hits the network when nothing is cached yet.
- Not accounting for the service worker's own update cycle — the service worker checks for updates on navigation, but very rarely on a fixed interval unless you explicitly trigger `SwUpdate.checkForUpdate()` (e.g., on a timer or app-focus event) for apps that stay open a long time.
- Confusing the raw Web Service Worker API (manual `self.addEventListener('fetch', ...)`) with `@angular/service-worker`'s declarative config — you don't write `fetch` handlers yourself in the Angular abstraction; all caching behavior is described in `ngsw-config.json` and the generated `ngsw-worker.js` implements it.

## Interview Questions & Answers

**Q: What's the difference between the browser's native Service Worker API and `@angular/service-worker`?**
A: The native Service Worker API is a low-level browser primitive — a background script that can intercept `fetch` events and serve cached responses, but you write all the caching logic, versioning, and invalidation yourself. `@angular/service-worker` is a higher-level, Angular-specific package that generates a complete, correct service-worker script (`ngsw-worker.js`) for you at build time based on a declarative `ngsw-config.json`, plus the `SwUpdate` service for the app to react to new versions — you describe caching policy instead of implementing `fetch` interception by hand.

**Q: What's the difference between an asset group and a data group in `ngsw-config.json`?**
A: Asset groups describe static build-time files (JS/CSS bundles, `index.html`, images) with an `installMode` (`prefetch` caches immediately on service-worker install, `lazy` caches on first request) and `updateMode` for how updates to those files are fetched. Data groups describe runtime API endpoints not known at build time, with a `strategy` of either `performance` (cache-first, minimizing latency for rarely-changing data) or `freshness` (network-first with a timeout, falling back to cache — better for data that should be current but should still degrade gracefully offline).

**Q: Why doesn't a user automatically get a newly deployed version of the app just by having it open?**
A: The service worker's whole purpose is to serve cached assets so the app loads fast and works offline; when you deploy a new build, the new service worker installs and downloads updated assets in the background, but the currently active service worker keeps serving the old cached version until the new one is explicitly activated — this prevents an app from silently swapping code out from under a user mid-session, which could break in-progress state. You use the `SwUpdate` service's `versionUpdates` Observable to detect a ready update and call `activateUpdate()` (usually after prompting the user) followed by a reload.

**Q: How would you test that your service-worker caching config actually works?**
A: Run a production build (`ng build`), serve the `dist/` output with a static file server (not `ng serve`, since the service worker is disabled in dev mode), load the app in a browser over `localhost` or HTTPS, then use DevTools' Application/Service Worker panel to confirm registration and inspect the Cache Storage entries. You can then simulate offline mode in DevTools' Network panel and reload to verify cached asset groups still serve the app and cached data groups still return the expected fallback responses.

**Q: What happens if a request doesn't match any configured asset or data group?**
A: It's not intercepted by the Angular service worker's caching logic at all — it passes through to the network normally, exactly as if no service worker were installed. This is why you need to be deliberate about `ngsw-config.json`'s `files`/`urls` glob patterns: anything outside those patterns gets no offline support or caching benefit from `@angular/service-worker`.

## Related Topics

- [web-workers.md](./web-workers.md)
- [server-side-rendering.md](./server-side-rendering.md)
- [client-server-interaction.md](./client-server-interaction.md)
- [angular-cli.md](./angular-cli.md)
- [observables.md](./observables.md)
