# Modules (NgModules)

An NgModule, declared with the `@NgModule` decorator, was Angular's original unit of compilation and organization: a class annotated with metadata describing which components/directives/pipes belong to it (`declarations`), which other modules it depends on (`imports`), which of its own declarations it makes available to modules that import it (`exports`), and which services it registers with the dependency injector (`providers`). Every classic Angular app had exactly one root module, conventionally `AppModule`, marked with a `bootstrap: [AppComponent]` array telling Angular which component to instantiate and attach to the DOM when the app starts, via `platformBrowserDynamic().bootstrapModule(AppModule)` (JIT era) or the equivalent AOT-compiled bootstrap.

Beyond the root module, real applications were organized into *feature modules* (e.g. `UsersModule`, `OrdersModule`) that group related components/services for a specific area of functionality, and *shared modules* that bundle commonly reused declarables (a shared `ButtonComponent`, `HighlightDirective`, etc.) so multiple feature modules can import one thing instead of each redeclaring them. A recurring, genuinely tricky pattern here is `forRoot()`/`forChild()`: when a module provides a singleton service (like Angular's own `RouterModule`), simply importing that module from multiple lazy-loaded feature modules would, without care, create multiple separate instances of that service (once per injector where the module is imported), which is rarely what you want for something like router state. `forRoot()` is a static method convention that returns a `ModuleWithProviders` object registering the service's providers *once*, intended for the root/eagerly-loaded import; `forChild()` returns a version without re-providing those root-level services, intended for lazy-loaded feature modules that need the module's declarables but must not re-instantiate its singleton services.

Angular 14 introduced *standalone components* — components, directives, and pipes that carry `standalone: true` and declare their own dependencies directly in an `imports` array on the `@Component`/`@Directive`/`@Pipe` decorator itself, without needing to belong to any NgModule at all. Angular 17 went further and made standalone the *default* for CLI-generated projects: `ng new` no longer scaffolds an `AppModule`, and `ng generate component` produces components that are standalone by default, importing exactly what their own template needs (`CommonModule` directives individually, other standalone components, pipes) rather than inheriting a module's aggregate import list. Bootstrapping shifts correspondingly to `bootstrapApplication(AppComponent, appConfig)`, where `appConfig` (an `ApplicationConfig` object using `providers: [provideRouter(routes), provideHttpClient(), ...]`) replaces what a root NgModule's `providers` array and `imports` of things like `RouterModule.forRoot()` used to do.

Critically, NgModules were *not* removed or deprecated — they remain fully supported, and most existing production Angular codebases (anything built before ~2023–2024, and plenty since, since migration is opt-in) are still module-based. Standalone components can be mixed into a module-based app incrementally (a module can declare-free `imports: [SomeStandaloneComponent]` directly in another component, or you can gradually migrate a module tree using the CLI's `ng generate @angular/core:standalone` schematic), which is exactly why interviewers still expect you to know `@NgModule`'s mechanics cold even in a "modern Angular" conversation — you need to both recognize legacy code and know how/why teams migrate away from it.

## Examples

```ts
// Classic NgModule-based feature module (pre-standalone-default style)
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UserListComponent } from './user-list.component';
import { UserDetailComponent } from './user-detail.component';

@NgModule({
  declarations: [UserListComponent, UserDetailComponent], // classes that belong to this module
  imports: [CommonModule, RouterModule.forChild([         // dependencies this module needs
    { path: '', component: UserListComponent },
    { path: ':id', component: UserDetailComponent },
  ])],
  exports: [UserListComponent],                            // make usable by modules that import this one
})
export class UsersModule {}
```

This is the canonical shape: `declarations` owns the components, `imports` pulls in other modules' exported declarables plus `RouterModule.forChild()` for lazy-loaded child routes, and `exports` selectively re-shares `UserListComponent` with consumers.

```ts
// The forRoot()/forChild() pattern, illustrated by writing your own
import { NgModule, ModuleWithProviders } from '@angular/core';
import { AnalyticsService } from './analytics.service';

@NgModule({})
export class AnalyticsModule {
  // Called once, from AppModule: registers AnalyticsService as a true singleton.
  static forRoot(apiKey: string): ModuleWithProviders<AnalyticsModule> {
    return {
      ngModule: AnalyticsModule,
      providers: [{ provide: 'ANALYTICS_KEY', useValue: apiKey }, AnalyticsService],
    };
  }
  // Called from lazy feature modules: no providers re-registered,
  // so they get the SAME AnalyticsService instance from the root injector.
  static forChild(): ModuleWithProviders<AnalyticsModule> {
    return { ngModule: AnalyticsModule, providers: [] };
  }
}
```

This demonstrates precisely why `forRoot()`/`forChild()` exists: without it, a naive `imports: [AnalyticsModule]` in every lazy feature module would instantiate a fresh `AnalyticsService` per lazy-loaded injector, silently breaking any app-wide singleton assumption (e.g., a shared event queue or auth session).

```ts
// Modern standalone equivalent — no NgModule at all
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes), provideHttpClient()], // replaces AppModule's imports/providers
});

// A standalone component pulls in exactly what it needs, no module required:
import { Component } from '@angular/core';
import { NgFor } from '@angular/common';
import { UserCardComponent } from './user-card.component';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [NgFor, UserCardComponent], // component-local dependency list
  template: `<app-user-card *ngFor="let u of users" [user]="u" />`,
})
export class UserListComponent {
  users = [];
}
```

This is the direct standalone replacement for the earlier examples: `provideRouter`/`provideHttpClient` functions replace what `RouterModule.forRoot()`/`HttpClientModule` used to configure via a root NgModule, and the component's own `imports` array is now the single source of truth for its template dependencies.

## Common Pitfalls / Gotchas

- Importing a `forRoot()`-style module (or any module registering global singleton providers) from a lazy-loaded feature module instead of the root — this silently creates a second instance of the "singleton" service scoped to that lazy module's injector, causing state (like auth tokens or shared caches) to mysteriously diverge between eagerly- and lazily-loaded parts of the app.
- Forgetting that a component/directive/pipe can only be declared in exactly *one* NgModule's `declarations` array — trying to declare the same component in two modules throws a compiler error; the fix is to declare it once and `exports` it, then `imports` that module elsewhere.
- Mixing up `imports` and `providers` — `imports` brings in other modules' exported *declarables* (and re-runs their own `providers` registration if not already provided), while `providers` in your own module registers services with the injector; a common mistake is putting a service in `imports` expecting DI registration, or expecting `providers` to make a component template-usable.
- Assuming standalone components eliminate the need to understand `@NgModule` — most production codebases are still module-based or mid-migration, and even standalone apps commonly need to bridge to module-based third-party libraries via `importProvidersFrom(SomeModule)`.
- Circular imports between feature modules (Module A imports Module B which imports Module A) — Angular's compiler will surface confusing errors here; the fix is usually extracting the shared pieces into a separate shared/common module both can depend on unidirectionally.

## Interview Questions & Answers

**Q: What are the four key metadata properties of `@NgModule`, and what does each control?**
A: `declarations` lists the components/directives/pipes that belong to (are compiled as part of) this module — each one can only belong to one module. `imports` brings in other NgModules so this module's declarables can use *their* exported declarables. `exports` selects which of this module's own declarations (or re-exported imports) become usable by any module that imports this one. `providers` registers services with the dependency injector at this module's scope (though `providedIn: 'root'` on an `@Injectable` is now the more common way to register app-wide singletons, independent of any module).

**Q: Explain the `forRoot()`/`forChild()` pattern and why it exists.**
A: It solves the problem of a module needing to register a genuinely singleton service while also being importable from multiple places, including lazy-loaded feature modules that each get their own child injector. `forRoot()` is a conventional static method (returning `ModuleWithProviders`) that registers the service's providers, and is called exactly once, typically from the root module (or historically `RouterModule.forRoot()` in `AppModule`). `forChild()` returns the module's declarables/config without re-registering those providers, so feature modules that lazy-load it still get access to the module's directives/components but share the single root-level service instance rather than each spinning up their own.

**Q: How do standalone components change or replace what NgModules used to do?**
A: A standalone component declares `standalone: true` and lists its own template dependencies (other components, directives, pipes) directly in an `imports` array on `@Component`, removing the need to belong to any NgModule's `declarations`. App-wide configuration that used to live in a root `AppModule`'s `imports`/`providers` (router setup, HttpClient, etc.) moves to provider functions (`provideRouter()`, `provideHttpClient()`) passed to `bootstrapApplication()`. NgModules aren't removed — they're now optional, and the two models can coexist in the same app during migration.

**Q: If NgModules are optional now, why do you still need to know them well?**
A: Because most existing production Angular applications predate the standalone default (Angular 17, released late 2023) and either remain fully module-based or are mid-migration, so reading, debugging, and extending real codebases requires understanding `@NgModule` mechanics. Additionally, some third-party libraries still ship module-based APIs, which standalone apps bridge into via `importProvidersFrom()`, so even a "pure standalone" app can't fully avoid NgModule concepts.

**Q: What's a concrete bug you'd expect from misusing shared/singleton services across lazy-loaded NgModules, and how would you diagnose it?**
A: The classic symptom is a service that's supposed to be app-wide (e.g., a cart total, an auth session) appearing to "reset" or diverge when navigating into a lazy-loaded feature — because that feature module re-imported a module that re-registers the service's providers instead of using `forChild()` or relying on `providedIn: 'root'`, so the lazy route gets its own separate instance from a child injector. Diagnosing it typically means checking whether the service is provided at the root (`providedIn: 'root'` or root module `providers`) versus re-provided anywhere in the lazy module's provider chain, and inspecting whether two logically-should-be-equal service instances are actually distinct objects (e.g., via a debug log of the instance in its constructor).

## Related Topics

- [components.md](./components.md)
- [dependency-injection.md](./dependency-injection.md)
- [lazy-loading.md](./lazy-loading.md)
- [providers.md](./providers.md)
- [routing.md](./routing.md)
- [services.md](./services.md)
