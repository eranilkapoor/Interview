# Angular CLI

The Angular CLI (the `ng` command) is the official, opinionated tool for scaffolding, developing, testing, and building Angular applications. It exists because a nontrivial amount of what makes an Angular project consistent and maintainable — build configuration, TypeScript compiler options, bundler setup (esbuild/Vite for modern Angular, historically webpack), linting, testing harnesses, and folder conventions — is genuinely tedious and error-prone to hand-roll per project. The CLI encodes Angular's own best practices as defaults, so a new project, and every component/service/pipe you generate inside it, starts from a known-good, consistently structured baseline rather than an ad hoc one.

Under the hood, most `ng generate` (aliased `ng g`) commands are powered by *schematics* — code generators defined as blueprints that create and modify files programmatically (not just via static templates), which is how `ng add` can install a library *and* wire it into your project (adding imports, updating config, injecting providers) in one step, rather than leaving you to do that integration by hand. `ng generate component`, `ng generate service`, `ng generate directive`, and `ng generate pipe` are the everyday four; `ng generate module` still exists for NgModule-based work but is much less central now that standalone is the default project shape. `ng add @angular/material`, for example, doesn't just `npm install` the package — its schematic also updates `angular.json`, adds a theme, and can scaffold a starter layout.

The workspace's build/serve/test behavior is centrally defined in `angular.json` — it maps project names to their `architect` targets (`build`, `serve`, `test`, etc.), each pointing at a builder (e.g. `@angular-devkit/build-angular:application`) with its own options: source roots, asset globs, style/script includes, and per-configuration overrides (`development` vs `production`) for things like optimization, source maps, and *file replacements*. That last mechanism is how environment files work: `environment.ts` holds development defaults (e.g. `production: false`, a local API base URL) and `environment.prod.ts` holds production values; `angular.json`'s `production` configuration declares a `fileReplacements` entry that swaps the former for the latter at build time, so `ng build --configuration production` produces a bundle with prod values baked in, with zero runtime branching or environment-detection logic needed.

The everyday commands are: `ng new <name>` scaffolds a new workspace; `ng serve` runs a dev server with live reload; `ng build --configuration production` produces an optimized, AOT-compiled deployable bundle; `ng test` runs unit tests (Karma/Jasmine by default, though modern setups increasingly use `ng test` wired to Jest or Web Test Runner); `ng e2e` runs end-to-end tests (no bundled default since Protractor's deprecation — it's now a pluggable schematic, typically Cypress or Playwright); and `ng update` upgrades Angular and CLI dependencies together, running migration schematics that can automatically rewrite your code for breaking changes (this is how, e.g., projects were auto-migrated from `*ngIf`/`*ngFor` usages toward newer patterns, or had `HttpClientModule` imports adjusted). A meaningful, interview-relevant shift: since Angular 17, `ng new` scaffolds *standalone* by default — `ng generate component` no longer creates or touches an NgModule for that component, because there isn't one to declare it in; the component's own `imports` array in its `@Component` decorator carries what an NgModule's `declarations`/`imports` used to.

## Examples

```bash
# Scaffold a new standalone-by-default workspace (Angular 17+ default shape)
ng new my-app --standalone --routing --style=scss

# Generate a component — no NgModule is created or updated for it;
# the component declares its own dependencies via `imports`.
ng generate component features/user-profile

# Add a library via a schematic — installs the package AND wires it in
# (theme setup, config updates), not just a bare npm install.
ng add @angular/material

# Serve with live reload, then build an AOT, tree-shaken production bundle
ng serve
ng build --configuration production
```

This is the everyday scaffold-to-ship loop, showing that `ng add` does real integration work beyond package installation, and that component generation under the standalone default produces no module boilerplate.

```ts
// src/environments/environment.ts (used by default/dev builds)
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
};

// src/environments/environment.prod.ts (swapped in for production builds)
export const environment = {
  production: true,
  apiUrl: 'https://api.example.com',
};

// Anywhere in app code:
import { environment } from '../environments/environment';
fetch(`${environment.apiUrl}/users`); // resolves to whichever file the build swapped in
```

The import path never changes — it's `angular.json`'s `fileReplacements` config for the `production` build configuration that physically substitutes `environment.prod.ts` for `environment.ts` at build time, so there's no runtime `if (production)` branching cost or risk of leaking dev config into prod.

```json
// angular.json — abbreviated, showing where fileReplacements lives
{
  "projects": {
    "my-app": {
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:application",
          "configurations": {
            "production": {
              "fileReplacements": [
                { "replace": "src/environments/environment.ts",
                  "with": "src/environments/environment.prod.ts" }
              ],
              "optimization": true,
              "outputHashing": "all"
            },
            "development": { "optimization": false, "extractLicenses": false }
          }
        }
      }
    }
  }
}
```

This shows the actual mechanism referenced above — `fileReplacements` is a build-configuration-scoped array, so you can add as many environment variants (staging, QA) as you need, each mapped to its own `ng build --configuration <name>`.

## Common Pitfalls / Gotchas

- Assuming `ng generate component` still creates/updates an NgModule — in a standalone-default project (Angular 17+ `ng new`) it doesn't; the generated component is `standalone: true` with its own `imports` array, and there may be no `AppModule` at all, only a `bootstrapApplication()` call.
- Editing `environment.prod.ts` values and testing locally with plain `ng serve` — `ng serve` uses the default (dev) configuration unless you explicitly pass `--configuration production`, so changes to the prod file won't appear until you build/serve with that configuration.
- Running `ng update` package-by-package out of order or skipping major versions — Angular's own migration schematics assume sequential major-version upgrades; jumping versions can leave the codebase in a state the automated migrations don't handle.
- Forgetting that `ng build` defaults to AOT and production-oriented optimizations already for `ng build` without flags in modern CLI versions — teams sometimes still explicitly pass `--configuration production` out of old habit, which is harmless, but assuming a bare `ng build` is "the dev build" is often wrong depending on CLI version and `angular.json` defaults.
- Manually editing generated schematic output immediately without understanding what the schematic wired up (e.g., an `ng add`-installed library's provider registration) — this can silently break the next time `ng update` tries to re-run a migration against files it expects to be in a known shape.

## Interview Questions & Answers

**Q: What's the difference between `ng generate` and `ng add`?**
A: `ng generate` (schematics scoped to your own project) creates new project artifacts — components, services, directives, pipes — following Angular's conventions and, in older module-based projects, wiring them into an NgModule automatically. `ng add` is for third-party libraries: it installs the npm package *and* runs that library's own schematic to integrate it into your project — updating `angular.json`, adding necessary providers or imports, sometimes scaffolding starter files — so the library is immediately usable rather than just present in `node_modules`.

**Q: How do Angular CLI environment files actually work under the hood — is there runtime branching involved?**
A: No runtime branching. `environment.ts` and `environment.prod.ts` (or any other named variant) are plain TypeScript files exporting the same shape of object with different values. `angular.json`'s build configuration for a given target (e.g. `production`) declares a `fileReplacements` rule that swaps one file for the other at build time before bundling, so the deployed bundle only ever contains the values for the configuration it was built with — there's no `if (environment.production)`-style check needed to pick between them at runtime, only to branch on the already-resolved value.

**Q: What changed about generated project structure with standalone components becoming the default?**
A: Before Angular 14 (standalone introduced) and especially before 17 (standalone made the default for new projects), every `ng generate component` created a component *and* typically expected an existing NgModule to declare it in, with `AppModule` bootstrapping the whole module tree. With standalone as the default, `ng generate component` produces a component with `standalone: true` (implicit as default since v19, explicit `standalone: true` in earlier v17/18) and its own `imports` array for whatever directives/pipes/components it uses in its template; there may be no NgModule anywhere in the project, and bootstrapping happens via `bootstrapApplication(AppComponent, appConfig)` instead of `platformBrowser().bootstrapModule(AppModule)`.

**Q: What does `ng update` do that a plain `npm install <package>@latest` wouldn't?**
A: `ng update` upgrades Angular (and compatible ecosystem) packages together while also running each package's associated *migration schematics* — automated codemods that rewrite your source to accommodate breaking changes, such as updating deprecated API usages or adjusting config shapes. A bare `npm install` only bumps the dependency version; it does nothing to your code, so you'd be left manually finding and fixing every breaking change the new version introduces.

**Q: Where does `ng test` and `ng e2e` fit, and why doesn't Angular bundle a default e2e runner anymore?**
A: `ng test` runs unit tests against individual components/services/pipes in isolation (historically Karma+Jasmine by default; many teams now configure Jest or the Web Test Runner instead). `ng e2e` used to default to Protractor, which was deprecated and removed as Angular's bundled e2e tool because it was built around AngularJS-era assumptions and became unmaintained relative to modern alternatives; `ng e2e` is now schematic-driven, so `ng new` (or `ng add`) lets you pick Cypress, Playwright, or another tool, and the CLI wires up the corresponding config and script rather than shipping one opinionated e2e framework by default.

## Related Topics

- [ahead-of-time-compilation.md](./ahead-of-time-compilation.md)
- [just-in-time-compilation.md](./just-in-time-compilation.md)
- [modules.md](./modules.md)
- [components.md](./components.md)
- [service-workers.md](./service-workers.md)
