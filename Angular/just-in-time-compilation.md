# Just-in-Time (JIT) Compilation

Just-in-Time compilation is the alternative to AOT: instead of the Angular compiler turning templates into executable instructions during the build, it ships to the browser as part of the app bundle and does that same parsing/code-generation work *at runtime*, in the user's browser, immediately before a component is first rendered. Historically — before Ivy (pre-Angular 9) — this was Angular's default mode for `ng serve`: development builds used JIT so that rebuilds during `ng serve` were fast (skip the heavier AOT compile step), while `ng build --prod` switched to AOT for the deployed bundle. That meant your dev and prod builds were, in a meaningful sense, running through two different compilation pipelines, which occasionally caused "works in dev, breaks in prod" bugs traceable specifically to AOT-only template errors surfacing for the first time in a production build.

Ivy changed this calculus. Ivy's compiler is fast enough, and its incremental compilation good enough, that AOT became viable for `ng serve` as well — so starting with Angular 9, `ng serve` also compiles ahead-of-time by default, and the historical dev/prod pipeline split mostly disappeared. JIT compilation still exists in `@angular/core`/`@angular/platform-browser-dynamic` as the underlying mechanism, but it's no longer something you reach for by default; it survives as a deliberate opt-in path for a narrow set of legacy or highly dynamic use cases, most notably compiling a component whose template is only known at runtime (e.g., certain plugin architectures, low-code/no-code builders rendering user-authored templates) via APIs like the now-largely-superseded `JitCompilerFactory`, or `platformBrowserDynamic()` bootstrapping instead of `platformBrowser()`.

The accurate way to contrast the two for an interview is along three axes, not just "old vs new": *when* compilation happens (build time vs runtime), *what ships* (compiled instructions only vs the compiler plus templates, since JIT needs the actual compiler code in the bundle to do its work in-browser, meaningfully increasing bundle size), and *when errors surface* (build-time failure vs a runtime exception potentially hit only by some users on some code paths, in production). AOT strictly dominates JIT on all three axes for the case Angular optimizes for — templates that are fully known at build time — which is the overwhelming majority of real applications, and is why JIT is no longer something modern Angular projects configure or think about day to day.

## Examples

```ts
// Legacy/pre-Ivy mental model: JIT bootstrap used the "dynamic" platform,
// which bundles the compiler and compiles templates in the browser at startup.
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

platformBrowserDynamic().bootstrapModule(AppModule);
// vs. AOT's platformBrowser(), which bootstraps an already-compiled
// module factory produced during the build — no compiler needed at runtime.
```

This contrasts the two bootstrap entry points directly: `platformBrowserDynamic` pulls in the JIT compiler, while `platformBrowser` (the AOT path) expects pre-compiled output and never loads the compiler into the browser bundle at all.

```ts
// The narrow legitimate JIT use case: compiling a component whose template
// text is not known until runtime (e.g. a CMS-driven layout builder).
import { Compiler, Injector, NgModule, Component } from '@angular/core';

function createDynamicComponent(templateHtml: string) {
  @Component({ selector: 'app-dynamic', template: templateHtml })
  class RuntimeComponent {}

  @NgModule({ declarations: [RuntimeComponent] })
  class RuntimeModule {}

  return RuntimeModule; // still requires the JIT compiler to be present/enabled
}
```

This is the one honest scenario where JIT-style runtime compilation earns its keep — the template string literally doesn't exist until the app is already running, so there is nothing for AOT to compile ahead of time.

```bash
# Pre-Ivy era workflow (for historical/interview context only):
ng serve                       # used JIT by default — fast rebuilds, compiler shipped to browser
ng build --prod                # used AOT — compiler-free, optimized output

# Modern Angular (Ivy, v9+):
ng serve                       # AOT by default too — Ivy made this fast enough
ng build --configuration production   # AOT, same compilation model as dev
```

This is the concrete "what changed" a senior candidate should be able to state precisely: it's not that JIT was deleted, it's that Ivy removed the reason to default to it anywhere.

## Common Pitfalls / Gotchas

- Saying "Angular uses JIT in development" as if it's still true today — that was accurate pre-Ivy (pre-Angular 9); since Ivy, `ng serve` also uses AOT by default, and this is a common outdated-knowledge trap in interviews.
- Forgetting that JIT requires shipping the Angular *compiler* itself to the browser, not just your app code — this is a meaningful, often-overlooked bundle-size cost that AOT eliminates entirely.
- Assuming JIT and AOT produce identically-checked output — pre-Ivy JIT historically had looser/deferred error surfacing than AOT's build-time `strictTemplates` checking, so bugs could lurk through development and only appear once an AOT prod build ran.
- Confusing JIT compilation (compiling Angular templates in-browser) with unrelated "JIT" concepts like a JavaScript engine's JIT compiler (e.g., V8) — they're different layers entirely; Angular's JIT/AOT distinction is about *template* compilation, not general JS execution.
- Reaching for JIT-style dynamic compilation as a shortcut for "dynamic components" when `NgComponentOutlet` or signal-based conditional rendering with statically known components would solve the same problem without needing the compiler at runtime at all.

## Interview Questions & Answers

**Q: What's the difference between JIT and AOT compilation in Angular?**
A: Both take component templates and turn them into executable rendering instructions — the difference is *when*. AOT does this during the build, so the browser only ever downloads and runs already-compiled code. JIT does this in the browser, at runtime, immediately before a component first renders, which means the compiler itself has to ship as part of the bundle and the compile work happens on the user's device on every page load.

**Q: Is JIT still the default anywhere in modern Angular?**
A: No. Before Ivy (pre-Angular 9), `ng serve` defaulted to JIT for faster dev rebuilds while `ng build --prod` used AOT, creating two different compilation pipelines for dev vs prod. Since Ivy, AOT compiles fast enough that `ng serve` also uses it by default, so JIT is no longer the default anywhere in a standard project — it survives only as an explicit opt-in for niche runtime-compilation needs.

**Q: When would you actually still reach for JIT-style compilation today?**
A: Almost exclusively when a template's content is genuinely not known until the app is running — for example, a CMS or low-code platform where end users author layout templates that get compiled and rendered dynamically. In that narrow case there's no template source available at build time for AOT to act on, so runtime compilation (or increasingly, non-compiler alternatives like `NgComponentOutlet` with statically-compiled variant components) is the only option.

**Q: What's the downside of JIT that made teams want to move away from it even before Ivy made AOT-everywhere practical?**
A: Bundle size and startup cost — the compiler is real code that has to be downloaded and executed before a single component renders, and error detection is pushed to runtime rather than build time, so template mistakes could ship to production and only fail for specific users hitting specific code paths, instead of failing the build outright.

**Q: How does JIT relate to a browser's JavaScript engine JIT (like V8's)?**
A: They're unrelated despite the shared name. Angular's JIT/AOT distinction is about compiling Angular *templates* into instruction-calling JavaScript functions. A JS engine's JIT compiler is a completely separate, lower-level mechanism that compiles/optimizes the resulting JavaScript bytecode itself at execution time — Angular's compiled output is just ordinary JavaScript to V8, regardless of whether Angular produced it via AOT or JIT.

## Related Topics

- [ahead-of-time-compilation.md](./ahead-of-time-compilation.md)
- [angular-cli.md](./angular-cli.md)
- [components.md](./components.md)
- [modules.md](./modules.md)
