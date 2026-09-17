# Dependency Injection

Angular's dependency injection (DI) system is a hierarchical tree of injectors that resolves and hands out instances of services, so that classes declare *what* they need in their constructor (or via `inject()`) without knowing *how* to construct it. This inverts control of object creation: a component doesn't `new UserService()` itself — it asks the injector for a `UserService`, and the injector decides whether to create a new instance, return an existing one, or return a substitute (like a mock in tests), based on where that injector sits in the tree and how the service was registered.

The injector hierarchy has multiple levels. At the top is the **root environment injector**, created when the application bootstraps (`bootstrapApplication` for standalone apps, or the root `NgModule` in older module-based apps) — this is where `@Injectable({ providedIn: 'root' })` services live, and there's exactly one instance app-wide. Below that, **module-level injectors** exist for each lazily-loaded feature module (each gets its own child injector, so `providedIn: 'root'` services registered lazily create a *separate* instance scoped to that lazy module, an easy interview trap). Separately, there's a parallel **element/component injector tree** that mirrors the component tree in the DOM — every component (and directive) gets its own injector if it lists providers in its `providers: []` array, and that injector is visible to itself and all its descendants in the view. When a component or directive asks for a dependency, Angular first walks up the element injector tree (component → parent component → ... → root) before falling back to the environment/module injector tree.

`@Injectable({ providedIn: 'root' })` is the modern, tree-shakable way to register a singleton service: instead of listing the service in an `NgModule`'s `providers` array (which forces it into the bundle even if unused), `providedIn: 'root'` lets the bundler exclude the service entirely if nothing ever injects it, because the provider registration lives on the service class itself rather than in a separate module declaration. `providedIn` can also take a specific standalone module/route or the string `'platform'`/`'any'` for more specialized scoping — `'any'` in particular gives every lazily-loaded module its own instance while eagerly-loaded parts of the app share one, which is a subtle and commonly misunderstood option.

For getting a dependency into a class, the traditional mechanism is **constructor injection** — declaring `constructor(private http: HttpClient) {}` and letting Angular supply the argument by inspecting the constructor's parameter types (this relies on TypeScript's `emitDecoratorMetadata` and the `@Injectable`/`@Component` decorator having run). The newer alternative, introduced in Angular 14, is the **`inject()` function**, callable within an injection context (a constructor, a field initializer, or inside `runInInjectionContext`): `private http = inject(HttpClient);`. `inject()` is now idiomatic in modern Angular because it works in more places — including free functions used as route guards or resolvers, and lets you inject conditionally or inside helper functions without needing a full constructor, which constructor injection cannot do.

Not every dependency is a class — sometimes you want to inject a configuration object, a primitive, or an interface (which doesn't exist at runtime and so can't be used as a DI token). For these, Angular provides `InjectionToken<T>`, a unique, type-safe token you create once (`new InjectionToken<AppConfig>('app.config')`) and provide a value for (`{ provide: APP_CONFIG, useValue: { apiUrl: '...' } }`), then inject with `inject(APP_CONFIG)`. The resolution algorithm always walks the injector tree upward from where the request originates, checking each injector for a matching provider until it finds one or reaches the root, at which point it throws `NullInjectorError` if nothing is found (or returns `null` if the dependency was requested with `@Optional()`).

Multi-providers (`{ provide: TOKEN, useClass: X, multi: true }`) let multiple providers register against the *same* token, and injecting that token returns an array of all of them — this is how Angular itself implements `HTTP_INTERCEPTORS` and `NG_VALIDATORS`, where many independent pieces of code can each contribute one interceptor/validator without knowing about each other. Finally, four parameter decorators fine-tune exactly *how* the tree is walked for a given dependency: `@Optional()` (don't throw if not found, return `null` instead), `@Self()` (only check the requesting element's own injector, not its ancestors), `@SkipSelf()` (skip the requesting element's own injector and start from the parent — commonly used so a child can get its *parent's* instance of a service rather than its own local override), and `@Host()` (stop searching at the host component boundary, useful for directives that should only see providers within their own component's view).

## Examples

```ts
import { InjectionToken, Injectable, inject } from '@angular/core';

// Injection token for a plain config object — there's no class to use as a token.
export interface AppConfig {
  apiUrl: string;
  retryCount: number;
}
export const APP_CONFIG = new InjectionToken<AppConfig>('app.config');

// Registered in bootstrapApplication's providers array:
// providers: [{ provide: APP_CONFIG, useValue: { apiUrl: 'https://api.example.com', retryCount: 3 } }]

@Injectable({ providedIn: 'root' })
export class ApiService {
  // Modern inject() usage instead of constructor injection — works in a field initializer.
  private readonly config = inject(APP_CONFIG);
  private readonly http = inject(HttpClient);

  getUsers() {
    return this.http.get(`${this.config.apiUrl}/users`);
  }
}
```
This shows the standard pattern for injecting non-class configuration via `InjectionToken`, and the `inject()` function replacing constructor injection in a tree-shakable root service.

```ts
import { Component, Optional, Self, SkipSelf } from '@angular/core';

@Injectable()
export class LoggerService {
  constructor(@Optional() @SkipSelf() private parentLogger: LoggerService | null) {}

  log(msg: string) {
    // Delegate to the parent's logger if one exists further up the tree,
    // otherwise this is the root-most logger instance.
    console.log(this.parentLogger ? `[nested] ${msg}` : msg);
  }
}

@Component({
  selector: 'app-panel',
  standalone: true,
  providers: [LoggerService], // creates a NEW LoggerService instance scoped to this component subtree
  template: `<ng-content />`,
})
export class PanelComponent {
  constructor(@Self() private logger: LoggerService) {
    // @Self() forces Angular to use THIS component's own provided instance,
    // never an ancestor's — fails with NullInjectorError if providers[] were removed.
    this.logger.log('Panel created');
  }
}
```
This demonstrates `@SkipSelf()` (used inside the service to look past its own injector for a parent instance — a common pattern for building nested/scoped services like a form group hierarchy) and `@Self()` (used by the consuming component to require its own locally provided instance rather than one from an ancestor).

```ts
import { HTTP_INTERCEPTORS } from '@angular/common/http';

// Two independent interceptors registered against the SAME multi-provider token.
export const appProviders = [
  { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  { provide: HTTP_INTERCEPTORS, useClass: LoggingInterceptor, multi: true },
];
// inject(HTTP_INTERCEPTORS) anywhere resolves to [AuthInterceptor, LoggingInterceptor] instances,
// and HttpClient chains them in registration order.
```
This shows a multi-provider: rather than one provider overwriting another, `multi: true` accumulates every matching registration into a single injected array, which is exactly how Angular's own HTTP interceptor chain and form validators work internally.

## Common Pitfalls / Gotchas

- Assuming `providedIn: 'root'` always means exactly one instance for the whole app — if the service is only ever injected from within a *lazily loaded* route/module, that lazy module gets its own child injector and its own separate instance, distinct from anything provided eagerly.
- Re-declaring a `providedIn: 'root'` service in a component's local `providers: []` array "just to be safe" — this silently creates a brand-new instance scoped to that component subtree, shadowing the root singleton, which breaks any shared-state assumptions (e.g., a shared `BehaviorSubject` inside that service).
- Forgetting that `@Optional()` returns `null`, not `undefined`, when no provider is found — code that checks `if (dep === undefined)` will not catch it.
- Using `@Host()` and being confused when it stops resolution at unexpected boundaries — it stops at the *host* element of the current view, which trips people up most often inside content projected via `<ng-content>`, where the projected content's "host" isn't where they expect.
- Hitting `NullInjectorError: No provider for X` and not realizing the fix might be as simple as an interface/type being used as a DI token — interfaces don't exist at runtime, so you can't `inject(SomeInterface)`; you need an `InjectionToken` or a concrete class/abstract class instead.
- Forgetting `inject()` must run inside an "injection context" — calling it inside a `setTimeout` callback or after an `await` in an `async` function (outside the synchronous constructor/field-initializer flow) throws, unless wrapped in `runInInjectionContext()`.

## Interview Questions & Answers

**Q: Explain Angular's injector hierarchy and how a dependency lookup is resolved.**
A: There are two parallel trees: the element injector tree, which mirrors the component tree and is populated by each component/directive's local `providers` array, and the environment injector tree, rooted at the application root injector with a child injector per lazily-loaded module. When something requests a dependency, Angular first walks up the element injector tree from the requesting component to the root component, and if no provider is found there, it falls through to the environment injector tree starting from the nearest module injector up to the root. The first matching provider found wins; if none is found anywhere, it throws `NullInjectorError` (or returns `null` if `@Optional()` was used).

**Q: What's the practical difference between registering a service with `providedIn: 'root'` versus listing it in a component's `providers` array?**
A: `providedIn: 'root'` registers the service on the root environment injector, so the whole application shares one instance, and it's tree-shakable — if nothing injects the service, it's excluded from the production bundle. Listing it in a component's `providers` array creates a new element injector at that component, so a fresh instance is created for that component and shared only by that component and its descendants; each separate instance of that component in the DOM gets its own instance of the service too. This is the standard way to scope state to a specific feature or a repeated component instance, like a wizard step or a dynamically created form.

**Q: What's the difference between constructor injection and the `inject()` function, and why would you prefer one over the other?**
A: Constructor injection declares dependencies as typed constructor parameters and relies on Angular reading that parameter list via decorator metadata; it only works in classes with an actual constructor. `inject()` is a function you call directly, valid anywhere inside a synchronous "injection context" — a constructor, a field initializer, or a function explicitly run via `runInInjectionContext()`. It's preferred in modern Angular because it works in more places (free-standing functional route guards/resolvers/interceptors, base classes without needing `super()` boilerplate, conditional injection logic) and reads more naturally with signal-based field initialization like `private http = inject(HttpClient)`.

**Q: When would you use an `InjectionToken` instead of a class as a DI token?**
A: Whenever the thing you're injecting isn't a class — a plain configuration object, a primitive value, a function, or a TypeScript interface/type, none of which exist as runtime values that DI can key off of. You create an `InjectionToken<T>` once as a unique, typed symbol, register a provider against it (`useValue`, `useFactory`, etc.), and inject it with `inject(TOKEN)`. It's also useful even for class-shaped things when you want to allow multiple distinct implementations behind the same conceptual role, or want a stable app-wide constant like an API base URL.

**Q: What do `@Self()` and `@SkipSelf()` do, and can you give a real use case for each?**
A: `@Self()` restricts resolution to only the requesting element's own injector — it will not walk up to ancestors, so it throws (or returns `null` with `@Optional()`) if that exact component didn't register its own provider; it's used to assert "I must have my own instance, not one inherited from a parent." `@SkipSelf()` does the opposite: it skips the requesting element's own injector and starts the walk from the parent, commonly used inside a service that wants to find a parent instance of *itself*, like Angular's own `ControlContainer`/nested `FormGroup` mechanism, or a nested logger/breadcrumb service that should chain to its ancestor rather than always being the root of the chain.

## Related Topics

- [providers.md](./providers.md)
- [services.md](./services.md)
- [components.md](./components.md)
- [modules.md](./modules.md)
- [lazy-loading.md](./lazy-loading.md)
