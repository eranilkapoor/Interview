# Angular Interview Prep

This folder is a personal knowledge base for studying and teaching Angular, built for interview preparation and for explaining these topics to others. Each file covers one topic in depth — a conceptual explanation, real code examples, common pitfalls, and interview-style Q&A — so you can both refresh your own understanding quickly and use the material to walk someone else through the same concept from scratch. The material targets modern Angular (v17+ era: standalone components by default, Signals, the new `@if`/`@for`/`@switch` control-flow syntax) while still covering NgModules, class-based decorators, and RxJS in depth, since all three remain heavily used in real codebases and are still a major focus of Angular interviews.

## Table of Contents

### Fundamentals & Compilation
- [Angular CLI](./angular-cli.md)
- [Modules (NgModules)](./modules.md)
- [Components](./components.md)
- [Templates](./templates.md)
- [Views](./views.md)
- [Ahead-of-Time (AOT) Compilation](./ahead-of-time-compilation.md)
- [Just-in-Time (JIT) Compilation](./just-in-time-compilation.md)

### Templates & Data Binding
- [Data Binding](./data-binding.md)
- [Interpolation](./interpolation.md)
- [Property Binding](./property-binding.md)
- [Attribute Binding](./attribute-binding.md)
- [Class Binding](./class-binding.md)
- [Style Binding](./style-binding.md)
- [Event Binding](./event-binding.md)

### Components & Directives
- [Directives](./directives.md)
- [Input Decorator (`@Input` / `input()`)](./input-decorator.md)
- [Output Decorator (`@Output` / `output()`)](./output-decorator.md)
- [Life Cycle Hooks](./life-cycle-hooks.md)
- [Pipes](./pipes.md)

### Dependency Injection & Services
- [Dependency Injection](./dependency-injection.md)
- [Providers](./providers.md)
- [Services](./services.md)

### Forms
- [Reactive Forms](./reactive-forms.md)
- [Template-Driven Forms](./template-deriven-forms.md)

### Routing & Lazy Loading
- [Routing](./routing.md)
- [Lazy Loading](./lazy-loading.md)

### RxJS & Observables
- [Observables](./observables.md)
- [Client-Server Interaction (HttpClient)](./client-server-interaction.md)

### Rendering: SSR, Service Workers, Web Workers
- [Server-Side Rendering](./server-side-rendering.md)
- [Service Workers](./service-workers.md)
- [Web Workers](./web-workers.md)

### Testing
- [Testing Angular Applications](./testing-angular-applications.md)

## Interview Questions & Answers — Curated

**1. Explain Angular's change detection and the `OnPush` strategy. (Advanced)**
Angular's default change-detection strategy (`ChangeDetectionStrategy.Default`) checks every component in the tree on every change-detection cycle, triggered by anything Zone.js patches (DOM events, timers, XHR/fetch, Promises). `OnPush` tells Angular to skip checking a component and its subtree unless one of a specific set of triggers occurs: an `@Input`/`input()` reference changes (not a mutation — object/array mutations without a new reference are invisible to `OnPush`), an event originates from within the component's own template, an `Observable` bound via the `async` pipe emits, or `markForCheck()`/a signal read inside the template is triggered manually. `OnPush` is the standard way to meaningfully improve change-detection performance in a large app, and it pairs naturally with immutable data patterns and Signals, since Signals inherently only notify on actual value changes.

**2. Difference between reactive and template-driven forms. (Intermediate)**
Reactive forms build the form model explicitly in the component class (`FormGroup`/`FormControl`/`FormBuilder`), with validators as data, making the form synchronous, easily unit-testable without rendering the DOM, and well-suited to dynamic/complex forms (`FormArray` for repeating groups). Template-driven forms build the model implicitly from the template via `[(ngModel)]` and `FormsModule`, with Angular creating an `NgForm`/`NgModel` directive tree behind the scenes and validation declared as HTML attributes — simpler to write for small forms but harder to test, harder to make dynamic, and the source of truth lives in the template rather than the class. See [reactive-forms.md](./reactive-forms.md) and [template-deriven-forms.md](./template-deriven-forms.md).

**3. How does dependency injection resolve providers across a hierarchy? (Advanced)**
Angular DI is hierarchical: there's a root/platform injector, an injector per lazy-loaded module (historically), and an injector per component/directive instance (`ElementInjector`). When a class asks for a dependency (via constructor injection or `inject()`), Angular walks up from the requesting component's element injector, through ancestor component injectors, to the module injector, and finally the root injector, returning the first matching provider it finds — unless `@Self`, `@SkipSelf`, or `@Host` constrain that search. A provider registered in a component's own `providers: []` array creates a new instance scoped to that component and its children, shadowing any higher-level provider of the same token — this is how you get a "new instance per component subtree" instead of the app-wide singleton `providedIn: 'root'` gives you. See [dependency-injection.md](./dependency-injection.md) and [providers.md](./providers.md).

**4. AOT vs JIT compilation tradeoffs. (Intermediate)**
AOT (Ahead-of-Time) compiles templates and TypeScript to JavaScript during the build, before shipping to the browser — smaller runtime bundle (no compiler shipped), faster first render (no in-browser compile step), and template errors caught at build time. JIT (Just-in-Time) compiles in the browser at runtime — historically Angular's dev-mode default for faster rebuilds pre-Ivy, but slower initial load and later error detection. Since Ivy (Angular 9+), AOT is fast enough to be the default for both `ng build` and `ng serve`, and JIT is effectively legacy outside of niche dynamic-template scenarios. See [ahead-of-time-compilation.md](./ahead-of-time-compilation.md) and [just-in-time-compilation.md](./just-in-time-compilation.md).

**5. What are standalone components, and how do they change the NgModule model? (Intermediate)**
A standalone component (`standalone: true`, the default since Angular 17 — you no longer write the flag) declares its own dependencies directly in an `imports: []` array on the `@Component` decorator instead of relying on an enclosing `NgModule`'s `declarations`/`imports`. This removes the requirement to build an NgModule tree just to wire components together, simplifies lazy loading (`loadComponent` for a single component instead of `loadChildren` for a whole module), and is now what `ng generate component` scaffolds by default. NgModules still work and are common in existing/enterprise codebases, but new Angular apps and the official docs are standalone-first. See [modules.md](./modules.md) and [components.md](./components.md).

**6. Walk through Angular's lifecycle hook order and what each is for. (Advanced)**
`ngOnChanges` (before `ngOnInit`, and again on every subsequent `@Input` reference change) → `ngOnInit` (once, for initialization) → `ngDoCheck` (every change-detection run, for custom-diff logic) → `ngAfterContentInit`/`ngAfterContentChecked` (projected `<ng-content>` initialized/checked) → `ngAfterViewInit`/`ngAfterViewChecked` (component's own view and `@ViewChild` references ready/checked) → `ngOnDestroy` (cleanup: unsubscribe, clear timers/intervals). `ngDoCheck`, `ngAfterContentChecked`, and `ngAfterViewChecked` all re-fire on every single change-detection cycle thereafter, not just once — a common interview trip-up. See [life-cycle-hooks.md](./life-cycle-hooks.md).

**7. What's the difference between `@Input()`/`@Output()` decorators and the newer `input()`/`output()` functions? (Intermediate)**
`@Input()`/`@Output()` are class-field decorators that have existed since Angular's early versions; `EventEmitter` backs `@Output()`. `input()` and `output()` (Angular 17.1+/17.3+) are function-based, signal-oriented APIs: `input()` returns a read-only `Signal`, integrates natively with `computed()`/`effect()`, and supports `input.required<T>()` plus declarative transforms without extra lifecycle plumbing; `output()` is a lighter-weight emitter API intended to eventually reduce reliance on RxJS `EventEmitter` for simple emit-only use cases. Both styles are valid and interviewers expect familiarity with both, since most production code today is still decorator-based. See [input-decorator.md](./input-decorator.md) and [output-decorator.md](./output-decorator.md).

**8. Why must you unsubscribe from Observables in Angular, and what are the standard ways to do it? (Intermediate/Advanced)**
An Observable subscription keeps a live reference between the source and the subscriber's callback; if a component is destroyed while still subscribed (e.g. to a long-lived `Subject` in a shared service, or an interval), the callback keeps firing and the component (and anything it closes over) can't be garbage collected — a memory leak. The `async` pipe is the preferred fix for template-bound streams since it auto-subscribes and auto-unsubscribes with the component's lifecycle. For subscriptions made in the component class, the standard patterns are `takeUntil(this.destroy$)` with `this.destroy$.next()` in `ngOnDestroy`, or the newer `takeUntilDestroyed()` (Angular 16+, using `DestroyRef` to unsubscribe automatically without manual plumbing). See [observables.md](./observables.md) and [life-cycle-hooks.md](./life-cycle-hooks.md).

**9. What's the difference between a pure and an impure pipe? (Intermediate)**
A pure pipe (the default) only re-executes when Angular detects a changed *reference* to one of its input arguments — cheap, but it won't notice in-place mutation of an object/array. An impure pipe (`@Pipe({ name: '...', pure: false })`) re-executes on every single change-detection cycle regardless of whether its inputs actually changed, which can be a real performance problem if used carelessly (e.g. an impure pipe doing expensive work inside a list of hundreds of items). Prefer keeping data immutable and pipes pure; reach for impure only when you genuinely need to observe mutation Angular's reference check would miss. See [pipes.md](./pipes.md).

**10. How does Angular's Router support lazy loading, and why does it matter? (Intermediate)**
Route-level lazy loading defers downloading a feature's code until the user actually navigates to it, via dynamic `import()`: `loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES)` for a set of routes, or `loadComponent` for a single standalone component. This keeps the initial bundle small (faster first load/Time-to-Interactive) at the cost of a brief extra network fetch the first time a lazy route is visited — mitigated with preloading strategies like `PreloadAllModules` or a custom `PreloadingStrategy` that fetches lazy chunks in the background after the initial app loads. See [lazy-loading.md](./lazy-loading.md) and [routing.md](./routing.md).

**11. What is a structural directive, and how does the `*` microsyntax actually work? (Intermediate/Advanced)**
A structural directive changes the DOM's structure — adding, removing, or repeating elements — rather than just an element's properties. `*ngIf`/`*ngFor` are syntactic sugar: `*ngFor="let item of items"` desugars to `<ng-template ngFor let-item [ngForOf]="items">`, wrapping the host element in an `<ng-template>` that the directive instantiates zero or more times via `ViewContainerRef`/`TemplateRef`. Since Angular 17, the built-in `@if`/`@for`/`@switch` control-flow blocks provide the same behavior as first-class template syntax rather than directives, with better type-narrowing and (for `@for`) a mandatory `track` expression for identity. See [directives.md](./directives.md) and [templates.md](./templates.md).

**12. What's the real difference between property binding and attribute binding? (Intermediate)**
Property binding (`[prop]="expr"`) sets a property directly on the underlying DOM element/directive/component object — it does not touch the HTML attribute, and most rendering-relevant state (like `value`, `checked`, `disabled`) lives on the DOM property, not the attribute, after the page loads. Attribute binding (`[attr.name]="expr"`) sets an actual HTML attribute and is required specifically when there's no corresponding DOM property to bind to — ARIA attributes (`[attr.aria-label]`), `colspan`, or custom/SVG attributes. Confusing the two is a classic source of "why doesn't my binding work" bugs. See [property-binding.md](./property-binding.md) and [attribute-binding.md](./attribute-binding.md).

**13. How does Angular Universal / SSR handle hydration, and what commonly breaks? (Advanced)**
Angular server-side renders the initial page (via `@angular/ssr`, built on `platform-server`) to send fully-formed HTML to the browser for faster first paint and SEO, then the client-side app "hydrates" that DOM — since Angular 16, non-destructive hydration reuses the server-rendered DOM nodes and attaches event listeners/state instead of tearing everything down and re-rendering from scratch (the old, more wasteful default). The most common SSR bugs come from code that assumes a browser environment — direct `window`/`document`/`localStorage` access — which throws or silently no-ops on the server; the fix is guarding with `isPlatformBrowser()`/`isPlatformServer()` or deferring the work to `afterNextRender()`/`afterRender()`, which only run in the browser. `TransferState` avoids redundantly re-fetching the same data on the client that the server already fetched. See [server-side-rendering.md](./server-side-rendering.md).

**14. What's the difference between `providedIn: 'root'` and registering a provider in a component's `providers` array? (Intermediate)**
`providedIn: 'root'` registers the service with the application's root injector as a tree-shakable singleton — one instance for the whole app, and if nothing ever injects it, the bundler can drop it entirely. Registering the same service in a component's `providers: []` array instead creates a new, separate instance scoped to that component and its child injector subtree, shadowing any root-level provider of the same token for that branch of the tree — useful when each instance of a component (e.g. a tab, a wizard step, a modal) needs its own isolated state rather than sharing one app-wide instance. See [providers.md](./providers.md) and [dependency-injection.md](./dependency-injection.md).

**15. How do Angular Signals relate to Zone.js-based change detection, and where is Angular heading? (Advanced)**
Traditionally, Angular relies on Zone.js to monkey-patch async browser APIs (`setTimeout`, DOM events, Promises, XHR) so it knows *when* something might have changed and can run change detection across the whole tree (or `OnPush` subtree) to find out *what* changed. Signals (`signal()`, `computed()`, `effect()`, stable since Angular 17) are a fine-grained reactivity primitive that track their own dependencies and can notify Angular exactly which values changed, without needing Zone.js to trigger a broad check — this is the foundation for Angular's ongoing move toward zoneless change detection (experimental `provideExperimentalZonelessChangeDetection()`), aiming for more predictable, more performant updates than Zone-based dirty-checking. See [components.md](./components.md) and [life-cycle-hooks.md](./life-cycle-hooks.md).

**16. What causes ExpressionChangedAfterItHasBeenCheckedError, and how do you fix it? (Advanced)**
This dev-mode-only error fires when a value read by a template changes *after* Angular has already run change detection for that cycle but before the next one — commonly because a value was mutated inside `ngAfterViewInit`/`ngAfterContentInit`, or because a child component's `OnPush`-relevant input changed as a side effect of the parent's own CD pass. Angular's dev build re-checks bindings after the initial check specifically to catch this class of bug (unidirectional-data-flow violations) before it becomes a real production inconsistency. Fixes: move the mutation earlier (e.g. `ngOnInit` instead of `ngAfterViewInit`), wrap the update in a microtask/`setTimeout`, or call `ChangeDetectorRef.detectChanges()` explicitly after the mutation. See [life-cycle-hooks.md](./life-cycle-hooks.md).

**17. Why does Angular need `HttpClient` instead of the browser's native `fetch`? (Beginner/Intermediate)**
`HttpClient` (`@angular/common/http`) returns Observables instead of Promises, giving you cancellation (unsubscribe aborts the request), retry (`retry()`/`retryWhen`), and composition with other RxJS operators (`switchMap` to cancel a stale in-flight request when a new one starts, `debounceTime` for search-as-you-type) for free. It also integrates with Angular's interceptor pipeline (functional `HttpInterceptorFn` since v15+) for cross-cutting concerns like attaching auth headers or centralizing error handling, and automatically parses JSON responses with generics for typed results (`http.get<User[]>(url)`). See [client-server-interaction.md](./client-server-interaction.md) and [observables.md](./observables.md).

**18. What's the difference between a Service Worker (via `@angular/service-worker`) and a Web Worker? (Intermediate)**
They solve unrelated problems despite the similar name. A Service Worker is a network proxy the browser runs between your app and the network, used by `@angular/service-worker` for offline caching/PWA behavior (configured declaratively in `ngsw-config.json`, with `SwUpdate` to detect new versions) — it doesn't run your app's business logic. A Web Worker runs arbitrary JavaScript on a separate thread to offload CPU-heavy computation off the main UI thread, communicating with the main thread only via serialized `postMessage`/`onmessage` (no shared memory, no DOM access) — scaffolded with `ng generate web-worker`. See [service-workers.md](./service-workers.md) and [web-workers.md](./web-workers.md).

**19. When would you choose `ngDoCheck` over relying on `ngOnChanges`? (Advanced)**
`ngOnChanges` only fires when an `@Input`'s *reference* changes — if a parent mutates an array or object in place and passes the same reference down, `ngOnChanges` never fires and the child has no idea anything changed. `ngDoCheck` runs on every change-detection cycle regardless, giving you a hook to implement custom comparison logic (e.g. a manual deep-equality or dirty check against a stored previous value) for cases where mutation-in-place is unavoidable. It's a blunt, performance-sensitive tool — it fires far more often than `ngOnChanges` — so it should only be used when reference-based change detection genuinely can't do the job, and ideally the mutation-in-place pattern should be fixed at the source (immutable updates) instead. See [life-cycle-hooks.md](./life-cycle-hooks.md).

**20. What are the tradeoffs of `[(ngModel)]` two-way binding versus explicit one-way `[value]`/`(input)` bindings? (Intermediate)**
`[(ngModel)]` ("banana in a box") is sugar for `[ngModel]="expr"` plus `(ngModelChange)="expr = $event"`, requiring `FormsModule` and giving the most concise syntax for simple form fields, but it obscures the actual data flow and couples the template more tightly to the exact property name being mutated. Explicit one-way bindings (`[value]="expr"` plus a manually-written `(input)` handler, or the reactive-forms equivalent) make the data flow visible and are easier to intercept/transform/validate before updating state, which is why reactive forms avoid `[(ngModel)]` almost entirely in favor of `FormControl`. See [data-binding.md](./data-binding.md) and [template-deriven-forms.md](./template-deriven-forms.md).

## How to Use This Folder

Work through the sections roughly in the order listed above:

1. **Fundamentals & Compilation** first — the CLI, NgModules vs standalone components, components, templates, and views are the vocabulary every other topic assumes; AOT/JIT rounds out how it all gets built.
2. **Templates & Data Binding** next — interpolation and the four binding types (property, attribute, class/style, event) are used constantly once you understand components and templates.
3. **Components & Directives** after that — directives, `@Input`/`@Output` (and their signal-based equivalents), lifecycle hooks, and pipes build directly on the binding fundamentals.
4. **Dependency Injection & Services** next — DI, providers, and services are largely independent of the template-layer material and are best understood together as one system (the injector hierarchy).
5. **Forms** and **Routing & Lazy Loading** after that — both assume a solid grasp of components, binding, and DI, and are consistently deep-dive territory in mid/senior interviews.
6. **RxJS & Observables** — read alongside or just after Forms/Routing, since `valueChanges`, `HttpClient`, and Router events are all Observable-based and this is where most Angular-specific async questions concentrate.
7. **Rendering: SSR, Service Workers, Web Workers** next — these are the most specialized/systems-level topics, and understanding them well benefits from already being comfortable with components, DI, and RxJS.
8. **Testing** last — writing effective tests draws on components, DI, and HTTP/RxJS all at once, so it's easiest once those feel solid.

For interview prep specifically: skim each topic file's "Interview Questions & Answers" section first for a quick per-topic refresher, then use the "Curated" list above as a cross-cutting mock-interview pass once the individual topics feel solid.
