# Routing

The Angular Router (`@angular/router`) maps URL paths to components, turning an Angular application into a client-side single-page app (SPA) that can navigate between "pages" without a full document reload while still keeping deep-linkable, bookmarkable, back/forward-button-aware URLs. At its core is a `Routes` array — a list of route definitions, each mapping a `path` string to either a `component` (rendered directly) or a lazily-loaded `loadComponent`/`loadChildren` (a dynamic `import()`), plus optional `children` for nesting, `canActivate`/`canDeactivate`/`canMatch` guards, a `resolve` map, and static/dynamic `data`. Historically this array was registered via `RouterModule.forRoot(routes)` in the root `AppModule` (and `RouterModule.forChild(routes)` in feature modules); in modern standalone Angular (v14+, the default since v17) the equivalent is `provideRouter(routes)` passed into `bootstrapApplication`'s providers, which avoids the NgModule ceremony entirely while supporting the same route configuration shape plus additional features enabled via functions like `withComponentInputBinding()` or `withPreloading()`.

Wherever a matched route's component should render, the template places a `<router-outlet>` — the Router swaps whatever component is projected into that outlet as the active route changes. Navigation is triggered declaratively with the `routerLink` directive (`<a routerLink="/products/42">`) instead of a plain `href`, which prevents a full page reload and lets the Router intercept the click; `routerLinkActive` adds a CSS class to the anchor when its route is currently active, commonly used for nav-bar highlighting. Programmatic navigation goes through the injected `Router` service's `navigate(['/products', id])` or `navigateByUrl('/products/42')` methods.

Dynamic segments in a path (`path: 'products/:id'`) are read via the injected `ActivatedRoute` service, either by snapshotting `route.snapshot.paramMap.get('id')` (a one-time read, fine when the component is destroyed/recreated on every param change) or by subscribing to the reactive `route.paramMap` Observable (necessary when the same component instance is reused across param changes, e.g. navigating from `/products/1` to `/products/2` without the component being torn down). Query parameters work the same way via `route.queryParamMap`/`route.queryParams`. As of Angular 16, you can skip `ActivatedRoute` entirely for path/query params by enabling `withComponentInputBinding()` and declaring matching `@Input()`s on the component — the Router binds route params directly to inputs.

Guards control whether navigation is allowed to proceed: `CanActivate` gates entry to a route (e.g., redirect to `/login` if unauthenticated), `CanDeactivate` gates leaving a route (e.g., "you have unsaved changes, are you sure?"), and `CanMatch` decides whether a route definition even matches, letting you pick between alternate route configs for the same path. The legacy style implemented these as injectable classes with an interface method; modern Angular (v14.2+) favors functional guards — plain functions matching `CanActivateFn`, typically calling `inject()` internally — configured directly on the route (`canActivate: [authGuard]`) without a class or DI token boilerplate. Resolvers (`ResolveFn`, or the older `Resolve` interface) pre-fetch data before a route activates, so the component never renders in a "loading" state for that data — the resolved value shows up on `route.data`. Nested/child routes (`children: [...]`) let a parent route own a sub-`<router-outlet>` for master-detail-style layouts, and lazy-loaded feature areas typically bring in their own nested route trees via `loadChildren`.

## Examples

```ts
// app.routes.ts — standalone route configuration
import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { productResolver } from './products/product.resolver';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', loadComponent: () => import('./home/home.component').then(m => m.HomeComponent) },
  {
    path: 'products',
    loadChildren: () => import('./products/products.routes').then(m => m.PRODUCTS_ROUTES),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard], // functional guard — blocks entry if not logged in
    loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  { path: '**', loadComponent: () => import('./not-found/not-found.component').then(m => m.NotFoundComponent) },
];
```

```ts
// products.routes.ts — a nested route tree with a param, a resolver, and a child route
import { Routes } from '@angular/router';
import { productResolver } from './product.resolver';

export const PRODUCTS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./product-list.component').then(m => m.ProductListComponent) },
  {
    path: ':id',
    resolve: { product: productResolver }, // pre-fetches product before the component activates
    loadComponent: () => import('./product-detail.component').then(m => m.ProductDetailComponent),
    children: [
      { path: 'reviews', loadComponent: () => import('./product-reviews.component').then(m => m.ProductReviewsComponent) },
    ],
  },
];
```

```ts
// auth.guard.ts — modern functional CanActivateFn guard
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
```

```ts
// product-detail.component.ts — reading a route param reactively and using resolved data
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { switchMap } from 'rxjs';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [AsyncPipe],
  template: `<h2>{{ (product$ | async)?.name }}</h2>`,
})
export class ProductDetailComponent {
  private route = inject(ActivatedRoute);

  // Resolved data is already available synchronously via route.data, but paramMap
  // is shown here to demonstrate reacting to param changes on a reused instance.
  product$ = this.route.paramMap.pipe(
    switchMap(() => this.route.data), // pull the resolver's result whenever params change
  );
}
```

`routerLink`/`routerLinkActive`, a functional `CanActivateFn` guard, a `resolve` map, and reactive param handling via `ActivatedRoute.paramMap` together cover the core day-to-day Router API surface.

## Common Pitfalls / Gotchas

- Route order matters — routes are matched top-to-bottom, first match wins, so a wildcard `**` route (or a broad `:id` param route) placed before more specific routes will shadow them and swallow navigation unexpectedly.
- `route.snapshot.paramMap` only captures params at the moment the component was created — navigating between two URLs that resolve to the *same* component instance (e.g., `/products/1` → `/products/2`) won't re-trigger `ngOnInit`, so a snapshot read silently goes stale; you need the `paramMap` Observable for that case.
- Forgetting `pathMatch: 'full'` on an empty-path redirect (`{ path: '', redirectTo: '/home', pathMatch: 'full' }`) causes the Router to treat it as a prefix match, which can trigger unwanted redirects on unrelated deeper routes.
- Lazy-loaded feature routes need their own guard/resolver wiring — a guard applied on the parent lazy-loading route doesn't automatically protect routes defined inside the loaded feature's own route file unless it's also applied there (or hoisted appropriately).
- `CanDeactivate` guards are easy to get wrong with async confirmation dialogs — returning a `Promise`/`Observable` is supported, but forgetting to actually resolve it (e.g., a dialog that never emits on dismiss) can silently block all navigation away from the page.
- Relative navigation (`router.navigate(['../sibling'], { relativeTo: this.route })`) is often forgotten — calling `router.navigate(['sibling'])` without `relativeTo` resolves relative to the root, not the current route, giving a confusingly wrong URL.

## Interview Questions & Answers

**Q: What's the difference between `route.snapshot.paramMap` and `route.paramMap`, and when does the distinction actually matter?**
A: `snapshot.paramMap` is a one-time, synchronous read of the params at the moment the component was instantiated. `paramMap` is an Observable that emits a new value every time the params change. They behave identically the first time a route activates, but diverge when Angular *reuses* the same component instance across a navigation — e.g. going from `/products/1` to `/products/2` on the same `ProductDetailComponent` — because the Router doesn't destroy and recreate the component for a param-only change by default. In that case a snapshot read never updates, so any code depending on the current id must subscribe to `paramMap` instead.

**Q: How does a functional `CanActivateFn` guard differ from the older class-based `CanActivate` interface, and why did Angular introduce it?**
A: A class-based guard is an injectable class implementing `CanActivate` with a `canActivate()` method, registered via DI and referenced by class reference in the route config. A functional guard is just a plain function matching the `CanActivateFn` signature `(route, state) => boolean | UrlTree | Observable<...> | Promise<...>`, typically calling `inject()` inside the function body to pull in services, and referenced directly in `canActivate: [myGuardFn]`. Angular introduced the functional style to cut DI/class boilerplate for what's usually simple logic, and it composes better with standalone APIs like `provideRouter` — but both styles are fully supported and functionally equivalent.

**Q: What's the purpose of a route resolver, and what's the downside of overusing them?**
A: A resolver (`ResolveFn`) fetches data *before* the Router finishes activating a route, so by the time the component renders, the data is already available on `route.data` — this avoids the component having to render a loading state itself. The downside is that navigation is blocked until the resolver's Observable/Promise completes, so a slow or failing resolver stalls the entire route transition (the user sees the *old* page hang, with no visual feedback) unless you build in your own loading indicator via router events like `NavigationStart`/`NavigationEnd`. For that reason, resolvers are best reserved for fast, critical data, not for anything that could be rendered progressively inside the component itself.

**Q: How do you configure routing in a standalone Angular application versus the older NgModule approach?**
A: Instead of importing `RouterModule.forRoot(routes)` into an `AppModule` and bootstrapping that module, you call `bootstrapApplication(AppComponent, { providers: [provideRouter(routes)] })`. `provideRouter` accepts the same `Routes` array and additionally takes router feature functions like `withComponentInputBinding()`, `withPreloading(PreloadAllModules)`, or `withInMemoryScrolling()` to opt into extra behavior, replacing what used to require separate module imports or `RouterModule.forRoot(routes, { ...extraOptions })`.

**Q: How do nested/child routes work, and what do they require in the template?**
A: A route can declare `children: [...]`, a sub-array of routes that only match when the parent path also matches (e.g., `products/:id/reviews` requires `products/:id` to match first). The parent route's own component must include a *second* `<router-outlet>` in its template for the matched child route's component to render into — the root `<router-outlet>` in `AppComponent` only ever renders the top-level matched route's component, not further-nested ones.

## Related Topics

- [lazy-loading.md](./lazy-loading.md)
- [dependency-injection.md](./dependency-injection.md)
- [observables.md](./observables.md)
- [modules.md](./modules.md)
- [components.md](./components.md)
