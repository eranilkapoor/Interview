# Lazy Loading

Lazy loading is the practice of splitting an Angular application's JavaScript into multiple bundles and deferring the download of a given bundle until the user actually navigates to the route (or triggers the code path) that needs it, instead of shipping every feature's code in the single initial bundle downloaded on first load. Angular's build tooling (esbuild-based since v17, Webpack before that) automatically creates a separate lazy chunk for any code reachable only through a dynamic `import()` expression — the Router's lazy-loading APIs are really just a structured, route-aware way of writing that `import()` at the right point in the route configuration.

The modern (standalone) way to lazy-load an entire feature area is `loadChildren: () => import('./feature/feature.routes').then(m => m.FEATURE_ROUTES)`, where the imported module exports a `Routes` array (rather than an `NgModule`) that gets spliced into the router configuration only once that dynamic import resolves — this is the standalone equivalent, and now the default recommendation, replacing the older NgModule-based form `loadChildren: () => import('./feature/feature.module').then(m => m.FeatureModule)`, which lazy-loaded an entire `NgModule` (itself declaring/importing a set of components and its own child routes). Both forms defer the network request and code execution for that feature until the matching route is actually navigated to; the NgModule form additionally created its own Angular injector scope for that module (relevant for module-scoped providers), while the standalone form relies on route-level `providers` arrays for equivalent scoping. For lazy-loading a *single* component rather than a whole route subtree — e.g., a route with no children, or a modal/dialog component only needed conditionally — `loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent)` does the same dynamic-import deferral for just that one standalone component.

The direct payoff is initial bundle size and thus first-load performance: everything not required to render the first screen is excluded from the main bundle, shortening the time to parse/execute/render on first paint, which matters most on slow networks and low-end devices — this is one of the highest-leverage, lowest-effort performance techniques available in an Angular app, and is why the Angular CLI's production builds warn when bundle size budgets are exceeded. The tradeoff is that navigating to a not-yet-loaded route incurs a network request (and thus latency) at that moment, which is where preloading strategies come in: `PreloadAllModules` (a built-in `PreloadingStrategy`) tells the Router to start fetching every lazy chunk in the background immediately after the initial app bootstrap finishes, trading some extra background bandwidth usage for near-instant subsequent navigations, while a custom `PreloadingStrategy` class lets you selectively preload only some routes (e.g., based on `route.data.preload`, network conditions via the Network Information API, or user role) rather than an all-or-nothing choice.

## Examples

```ts
// app.routes.ts — lazy-loading an entire standalone feature route tree
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./home/home.component').then(m => m.HomeComponent) },
  {
    // Entire "admin" feature (its own nested Routes array) is fetched only on navigation to /admin
    path: 'admin',
    loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES),
  },
  {
    // Single standalone component lazy-loaded without a whole feature module/route tree
    path: 'settings',
    loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent),
  },
];
```

```ts
// admin.routes.ts — the lazily-loaded feature's own route tree, plus feature-scoped providers
import { Routes } from '@angular/router';
import { ADMIN_API_BASE } from './admin.tokens';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    providers: [{ provide: ADMIN_API_BASE, useValue: '/api/admin' }], // route-level DI scope
    children: [
      { path: '', loadComponent: () => import('./admin-dashboard.component').then(m => m.AdminDashboardComponent) },
      { path: 'users', loadComponent: () => import('./admin-users.component').then(m => m.AdminUsersComponent) },
    ],
  },
];
```

```ts
// legacy-feature.module.ts — the older NgModule-based lazy loading form, still common in real codebases
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LegacyFeatureComponent } from './legacy-feature.component';

const routes: Routes = [{ path: '', component: LegacyFeatureComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  declarations: [LegacyFeatureComponent],
})
export class LegacyFeatureModule {}

// Referenced from the parent route config as:
// { path: 'legacy', loadChildren: () => import('./legacy-feature.module').then(m => m.LegacyFeatureModule) }
```

```ts
// app.config.ts — enabling preloading so lazy chunks fetch in the background after bootstrap
import { ApplicationConfig } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes, withPreloading(PreloadAllModules))],
};
```

```ts
// selective-preload.strategy.ts — a custom PreloadingStrategy that only preloads routes opting in
import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SelectivePreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    // Only preload routes explicitly marked with data: { preload: true }
    return route.data?.['preload'] ? load() : of(null);
  }
}
// Usage: { path: 'reports', data: { preload: true }, loadChildren: () => import('./reports.routes').then(m => m.REPORTS_ROUTES) }
```

## Common Pitfalls / Gotchas

- `loadChildren`/`loadComponent` must be arrow functions returning a dynamic `import()` — passing a static reference (e.g., importing the module/component at the top of the file and referencing the variable) defeats lazy loading entirely because the bundler can no longer identify a valid code-split boundary.
- Route-level `providers` on a lazy-loaded route only scope services to that route subtree if declared there — a common mistake is assuming a service registered with `providedIn: 'root'` inside a lazy chunk is somehow lazily scoped; `providedIn: 'root'` still creates a single app-wide singleton, it's just not instantiated until the lazy chunk loads and something injects it.
- `PreloadAllModules` preloads *every* lazy route indiscriminately in the background, which can waste bandwidth on rarely-visited admin/reporting sections for the majority of users who never go there — a custom `PreloadingStrategy` is usually the better production choice.
- Circular dependencies between a lazily-loaded feature and something imported eagerly in the root can silently pull the "lazy" code back into the main bundle — checking the actual build output (`ng build` stats or bundle analyzer) is the only reliable way to confirm a route is truly split out.
- Guards attached to a lazy route (`canActivate`) still run *before* the chunk downloads when using `canMatch`, but with `canActivate` the chunk is fetched first and the guard evaluated on the loaded route — mixing these up leads to surprising ordering when trying to prevent unauthorized users from even triggering the download.
- Lazy-loading a component with `loadComponent` doesn't lazy-load its *dependencies* unless those are also dynamically imported or declared as separate lazy routes/components — a heavy shared library imported statically inside the lazy component still ends up bundled eagerly if something else in the main bundle also imports it (bundlers deduplicate, keeping shared code in the common chunk).

## Interview Questions & Answers

**Q: What's the difference between `loadChildren` and `loadComponent`, and when would you choose one over the other?**
A: `loadChildren` lazily loads an entire route subtree — either an `NgModule` (legacy) or a `Routes` array (standalone) — appropriate when a feature area has multiple routes/components that should all be split into the same lazy chunk together. `loadComponent` lazily loads a single standalone component for one specific route, appropriate when that route has no children and doesn't warrant a whole separate route file — e.g., a settings page or a one-off modal route.

**Q: How does the standalone `loadChildren` syntax (`() => import('./feature.routes').then(m => m.FEATURE_ROUTES)`) differ from the older NgModule form, beyond just returning a `Routes` array instead of a module class?**
A: Functionally both defer the network fetch and JS execution of the feature's code until the route is navigated to, producing a separate lazy chunk. The difference is DI scoping: the NgModule form created a distinct Angular injector for that module, so providers declared in the module's `providers` array were scoped to that feature (and any lazily-loaded module's providers were invisible to the rest of the app unless explicitly re-provided). The standalone form has no implicit module injector — equivalent scoping is achieved by putting a `providers` array directly on the route config object, which applies to that route and its children.

**Q: Why does lazy loading improve initial load performance, concretely?**
A: The initial JS bundle only needs to contain the code required to render the first route (plus any framework/vendor code). Code for routes the user hasn't navigated to yet is excluded, which reduces the amount of JavaScript the browser must download, parse, and execute before it can render and become interactive — directly improving metrics like First Contentful Paint and Time to Interactive, especially on slower networks or less powerful devices where JS parsing/execution time dominates.

**Q: What does `PreloadAllModules` actually do, and what's its tradeoff versus a custom `PreloadingStrategy`?**
A: `PreloadAllModules` is a built-in strategy that, once the app finishes its initial bootstrap and becomes idle, automatically starts fetching every lazily-loaded route's chunk in the background — so by the time the user actually navigates there, the code is often already cached and the navigation feels instant, eliminating the lazy-loading latency penalty. The tradeoff is it preloads indiscriminately, downloading code for routes the user may never visit, which wastes bandwidth (a real concern on metered/slow connections). A custom `PreloadingStrategy` implements the same `preload(route, load)` interface but adds conditional logic — e.g., only preload routes flagged via `route.data`, or only on fast connections detected via the Network Information API — giving finer control over that bandwidth/latency tradeoff.

**Q: If you lazy-load a feature but it still shows up inside the main bundle after building, what would you check?**
A: First, confirm `loadChildren`/`loadComponent` uses an inline dynamic `import()` arrow function rather than a statically imported reference — any static top-level import of that module/component elsewhere in eagerly-loaded code will pull it back into the main graph. Second, check for a circular or shared dependency that something in the eager bundle also imports, since the bundler will place shared code in a common chunk rather than duplicating it into the lazy chunk alone. Finally, inspect the actual build output (`ng build` stats-json or a bundle analyzer) rather than assuming from source code alone — that's the only way to confirm what ended up where.

## Related Topics

- [routing.md](./routing.md)
- [modules.md](./modules.md)
- [ahead-of-time-compilation.md](./ahead-of-time-compilation.md)
- [angular-cli.md](./angular-cli.md)
- [components.md](./components.md)
