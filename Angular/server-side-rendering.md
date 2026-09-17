# Server Side Rendering

Server-side rendering (SSR) in Angular means running the application on a Node.js server to produce fully-formed HTML for the initial request, rather than sending the browser an empty `<app-root></app-root>` shell and letting it bootstrap and render everything client-side. This addresses two long-standing weaknesses of pure client-side-rendered SPAs: slow first contentful paint on low-power devices/networks (the user stares at a blank page until the JS bundle downloads, parses, and executes), and poor SEO/link-preview support (crawlers and social-media scrapers that don't execute JavaScript see nothing meaningful in a CSR-only page). With SSR, the server renders the component tree to a string of real HTML using the same component definitions as the client, sends that down immediately, and the browser can paint it before any JavaScript has even loaded.

Angular's SSR story is packaged today as `@angular/ssr`, built on `@angular/platform-server`, and scaffolded with `ng add @angular/ssr` (or included by default when creating a new app with the Angular CLI's SSR prompt from Angular 17 onward). This lineage traces back to "Angular Universal," the original community/first-party project for server rendering Angular apps; `@angular/ssr` is its modern, first-class-supported successor, tightly integrated into the CLI build and dev-server pipeline rather than a bolted-on separate package. The build produces both a browser bundle and a server bundle; a Node Express server (generated for you) uses the server bundle to render each request's HTML on demand (or you can prerender routes at build time for fully static output, sometimes called SSG in Angular's docs).

After the server-rendered HTML reaches the browser, Angular has to take over and make the page interactive — this process used to mean "destroy the server-rendered DOM and re-render everything from scratch client-side," which caused a visible flicker and wasted the work the server already did. Angular 16 introduced **non-destructive hydration**, enabled via `provideClientHydration()` in the app config, which instead reuses the existing server-rendered DOM nodes, attaches event listeners, and reconciles Angular's internal state to match what's already on the page — no re-render, no flicker, no layout shift. Hydration also validates the DOM structure it finds against what Angular expects, and will warn (or fall back to non-hydrated rendering with a full re-render) if there's a mismatch, which is why direct, uncontrolled DOM manipulation outside Angular's rendering (e.g., a third-party jQuery-style widget mutating the DOM before hydration runs) is dangerous in an SSR+hydration app.

`TransferState` is the mechanism for avoiding duplicate data fetching between server and client renders. Without it, a component that calls `http.get('/api/products')` in `ngOnInit` would fetch the data once during the server render to produce the HTML, and then fetch it *again* on the client after bootstrap, wasting a network round-trip and potentially showing a flash of different/stale data if the response changed between the two calls. `TransferState` lets the server render stash the fetched data into a JSON blob embedded in the HTML response (as a `<script>` tag); the client-side app reads that blob on startup and reuses it instead of re-fetching. Angular's `HttpClient` actually does this automatically for you today when SSR is set up via the CLI, through `provideClientHydration(withHttpTransferCacheOptions(...))` / the built-in HTTP transfer cache — but understanding the manual `TransferState` API (`makeStateKey`, `TransferState.set`/`.get`) is still relevant for custom data that doesn't go through `HttpClient`.

The most common practical gotcha with SSR is that the server environment is Node, not a browser — there is no `window`, `document`, `localStorage`, `navigator`, or any browser global available during server rendering, so any code that touches those directly throws at render time (a server-side `ReferenceError: window is not defined` crash, or a silent failure depending on how it's guarded). The fix is to branch behavior using `isPlatformBrowser(platformId)` / `isPlatformServer(platformId)` (from `@angular/common`, with `PLATFORM_ID` injected), or — for the common case of "run this after the view is in the DOM" — use the newer `afterNextRender()` / `afterRender()` lifecycle hooks, which by design only execute in the browser and never during server rendering, making them the simplest safe home for DOM-touching logic like initializing a third-party charting library.

## Examples

```ts
// app.config.ts — enabling SSR + non-destructive hydration for a standalone app
import { ApplicationConfig } from '@angular/core';
import { provideClientHydration, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withFetch()), // fetch-based HttpClient works on both server and browser
    // Reuses server-rendered DOM instead of destroying and re-rendering it,
    // and transfers HttpClient responses from server to client automatically
    // so the same request isn't made twice.
    provideClientHydration(withHttpTransferCacheOptions({ includePostRequests: true })),
  ],
};
```

This is the modern Angular 17+ setup: hydration and the HTTP transfer cache are both opt-in providers wired once in `app.config.ts`, with no separate `AppServerModule` boilerplate required for a standalone app.

```ts
import { Component, PLATFORM_ID, inject, afterNextRender } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-chart',
  standalone: true,
  template: `<canvas #canvasRef></canvas>`,
})
export class ChartComponent {
  private platformId = inject(PLATFORM_ID);

  constructor() {
    // afterNextRender only ever runs in the browser, after the view has been
    // inserted into the DOM — the safest place for code that touches `window`,
    // a canvas element, or a third-party DOM-dependent library.
    afterNextRender(() => {
      const ChartLib = (window as any).ChartLib; // safe: never executes on the server
      new ChartLib(document.querySelector('canvas'));
    });
  }

  readCookieSafely(): string | null {
    // Manual platform check for code that must run in either lifecycle phase
    // but only makes sense in the browser.
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('theme');
    }
    return null; // no localStorage on the server — return a safe default
  }
}
```

Two ways to guard browser-only APIs: `afterNextRender` for DOM/rendering-dependent one-off work, and `isPlatformBrowser`/`PLATFORM_ID` for conditional logic that needs to run (or be skipped) in either environment.

```ts
// Manual TransferState for data that doesn't go through HttpClient,
// e.g. a value computed during server rendering from request headers.
import { makeStateKey, TransferState } from '@angular/core';

const REGION_KEY = makeStateKey<string>('detectedRegion');

// In a server-only resolver/interceptor:
transferState.set(REGION_KEY, 'us-east');

// In the component, on both server and client:
const region = transferState.hasKey(REGION_KEY)
  ? transferState.get(REGION_KEY, 'default') // client reads what the server already computed
  : computeRegionSomehow();                  // fallback if not present (e.g. CSR-only mode)
```

This shows the underlying primitive that Angular's automatic HTTP transfer cache is built on — useful for stashing any server-computed value so the client doesn't redundantly recompute or re-fetch it.

## Common Pitfalls / Gotchas

- Code that directly references `window`, `document`, `localStorage`, or `navigator` outside a browser-only guard crashes during server rendering because none of those globals exist in Node — wrap such code in `isPlatformBrowser()` or move it into `afterNextRender()`.
- Assuming hydration always succeeds silently — a hydration mismatch (server-rendered DOM structure doesn't match what the client-side render would produce, often from non-deterministic content like `Math.random()` or `Date.now()` used directly in a template) triggers a full destructive re-render fallback, defeating the performance benefit and sometimes causing a visible flash.
- Fetching the same data twice — once during SSR to build the HTML, again on the client after bootstrap — because `TransferState`/the HTTP transfer cache wasn't enabled; this wastes a round trip and can show a flash of different content if the underlying data changed between calls.
- Third-party libraries that assume a browser environment (chart libraries, rich text editors, anything touching `document` at import/module-init time rather than only when instantiated) breaking the server build even if you never call their browser-dependent methods during SSR.
- Using `setTimeout`/`setInterval`-based logic or subscriptions that never complete during server rendering — the server render has a finite lifecycle and hanging async work can delay or hang the response.
- Forgetting that server-rendered pages are rendered per-request (unless prerendered/SSG), so anything expensive done during render (heavy computation, slow API calls) directly adds to server response latency and server CPU/memory cost, unlike a purely static CSR bundle.

## Interview Questions & Answers

**Q: What problem does SSR solve that a purely client-side-rendered Angular app doesn't?**
A: It solves slow perceived load time and poor crawlability. A CSR-only app sends a nearly empty HTML shell, so the user sees a blank page until the JS bundle downloads, parses, and bootstraps the app — this hurts metrics like First Contentful Paint, especially on slow connections or low-power devices. It also hurts SEO and link-preview generation, since many crawlers and social-media scrapers don't execute JavaScript and see no meaningful content. SSR renders real HTML on the server so the browser can paint immediately, and crawlers see fully-formed content.

**Q: What is hydration, and how does Angular's non-destructive hydration (16+) differ from the old behavior?**
A: Hydration is the process of making server-rendered HTML interactive on the client — attaching event listeners, wiring up Angular's internal component tree state to the existing DOM. Historically Angular would discard the server-rendered DOM entirely and re-render the whole page client-side, which caused a visible flicker/flash and wasted the server's rendering work. Non-destructive hydration, enabled via `provideClientHydration()`, instead reuses the existing DOM nodes the server produced and reconciles Angular's state against them without tearing anything down, eliminating the flicker and the redundant render work.

**Q: How does `TransferState` avoid duplicate API calls between server and client renders?**
A: During the server render, data fetched (e.g., via `HttpClient`) is captured and serialized into the initial HTML response as an embedded JSON payload. When the client-side app bootstraps, it reads that payload before making any of its own requests, and — since Angular's built-in HTTP transfer cache integrates with `HttpClient` automatically when SSR is configured through the CLI — a request the server already made is served from that cached payload instead of hitting the network again. For data outside `HttpClient`, you can use the `TransferState` API directly with `makeStateKey`/`.set()`/`.get()` to stash and retrieve arbitrary server-computed values.

**Q: Why does code using `window` or `localStorage` break in an SSR app, and what are the standard fixes?**
A: SSR executes the app inside Node.js on the server, which has no DOM and no browser globals — `window`, `document`, `localStorage`, and similar objects simply don't exist there, so referencing them directly throws a runtime error during server rendering. The standard fixes are: inject `PLATFORM_ID` and branch with `isPlatformBrowser()`/`isPlatformServer()` from `@angular/common` for conditional logic that must run differently per environment, or use `afterNextRender()`/`afterRender()`, which Angular guarantees only ever execute in the browser after the view is attached to the DOM, making them the simplest home for DOM- or browser-API-dependent side effects.

**Q: What's the practical tradeoff of enabling SSR for an Angular app?**
A: You gain faster perceived load and better SEO, but you now need a Node server (or prerendering) to actually render pages, which adds infrastructure complexity and per-request server cost compared to serving static files from a CDN. Any code that assumes a browser environment needs auditing and guarding, hydration mismatches become a new class of bug to watch for, and server response time now directly includes whatever data-fetching/rendering work your components do, so slow API calls during SSR directly slow down the user's initial response instead of happening invisibly after an already-painted shell.

## Related Topics

- [client-server-interaction.md](./client-server-interaction.md)
- [ahead-of-time-compilation.md](./ahead-of-time-compilation.md)
- [service-workers.md](./service-workers.md)
- [angular-cli.md](./angular-cli.md)
- [observables.md](./observables.md)
