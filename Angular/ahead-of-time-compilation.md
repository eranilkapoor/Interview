# Ahead-of-Time (AOT) Compilation

Ahead-of-Time compilation is the process by which the Angular compiler (`@angular/compiler-cli`, invoked internally by the CLI's build pipeline) converts your components' TypeScript classes and HTML templates into efficient, low-level JavaScript instructions *during the build*, before the app is ever sent to a browser. Concretely, for every `@Component`, the AOT compiler parses the template, resolves every binding expression, and emits Ivy "instructions" — calls like `ɵɵelementStart`, `ɵɵproperty`, `ɵɵlistener` — directly into the component's compiled `.js` output as a `ɵcmp` definition. The browser never sees your HTML template string or does any template parsing; it just executes plain, already-optimized JavaScript functions that create and update DOM nodes.

This matters because Angular templates are not just markup — they're a declarative language with their own binding syntax, pipes, structural directives, and type-checked expressions, and something has to turn that into real DOM operations. There are exactly two ways to do that: compile it once ahead of time (AOT) and ship the result, or ship the compiler itself and compile templates in the user's browser at runtime (JIT, the historical default in development). Since Ivy became Angular's default renderer (Angular 9), AOT is not just the production default — it's effectively the *only* supported mode; `ng build` and `ng serve` both compile ahead of time by default, and the JIT compiler is now a legacy/edge-case path (see just-in-time-compilation.md).

AOT compilation gives you four concrete wins. First, bundle size: because the compiler itself (`@angular/compiler`, which is a sizeable chunk of code capable of parsing template strings) doesn't need to ship to the browser, only the compiled instructions do. Second, startup performance: there's no template-parsing pass happening on the user's device before the first render — the compiled instruction functions run immediately. Third, earlier error detection: AOT performs full template type-checking at build time (configurable via `strictTemplates` in `tsconfig.json`'s `angularCompilerOptions`), so binding a property that doesn't exist on a component, or passing the wrong type into an `@Input()`, fails the build instead of silently breaking (or throwing) in a user's browser. Fourth, security: because templates are compiled to code rather than evaluated as strings against a live DOM at runtime, AOT closes off a class of injection-style attacks that string-based template evaluation could otherwise expose.

The tradeoff is compile time — AOT does real, non-trivial work (template parsing, type-checking, code generation) as part of every build, which is slower than simply serving raw templates unparsed. Ivy made incremental AOT compilation fast enough that `ng serve` uses it in development too, with a fast rebuild pipeline, so in practice this cost is mostly felt only in cold builds and CI. AOT also cannot support certain fully dynamic template patterns — for example, compiling a template string that only exists at runtime — because there's no template source left to compile against once the app is running; that specific, rare need is the one legitimate remaining reason to reach for JIT.

## Examples

```ts
// A component as you author it — this template string is parsed and
// type-checked entirely at BUILD time under AOT, not in the browser.
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-user-badge',
  standalone: true,
  template: `
    <span class="badge" [class.vip]="isVip">
      {{ displayName }} <!-- resolved & type-checked against the class below -->
    </span>
  `,
})
export class UserBadgeComponent {
  @Input({ required: true }) displayName!: string;
  @Input() isVip = false;
}

// If you typo'd `displayNam` above, AOT's strict template type-checking
// fails the `ng build`/`ng serve` compile step — it never reaches the browser.
```

This shows the exact surface AOT operates on: template expressions are checked against the component class's actual members at compile time, which is only possible because the compiler runs before shipping, with full type information available.

```json
// tsconfig.json — the angularCompilerOptions block controls AOT's behavior
{
  "compilerOptions": { "target": "ES2022", "strict": true },
  "angularCompilerOptions": {
    "strictTemplates": true,   // enables full type-checking of template bindings
    "strictInjectionParameters": true,
    "fullTemplateTypeCheck": true
  }
}
```

`strictTemplates` is what makes AOT genuinely catch template bugs at build time (wrong binding types, misspelled properties, invalid pipe arguments) instead of only compiling syntactically valid-but-wrong templates.

```bash
# ng build defaults to AOT + production optimizations (tree-shaking, minification)
ng build --configuration production

# Inspect the compiled output: component templates are now function bodies
# emitting ɵɵelementStart/ɵɵtext/ɵɵproperty calls, not HTML strings.
```

Running a production build and looking at the emitted `main.js` is the most direct way to see AOT's output: there is no template string anywhere in it, only compiled instruction calls.

## Common Pitfalls / Gotchas

- Assuming you can dynamically construct and compile a template string at runtime the same way you write one in `@Component({ template })` — under AOT there's no compiler shipped to the browser to do that; you'd need the legacy JIT compiler, which is not part of a standard Ivy production build.
- Forgetting to enable `strictTemplates` and then being surprised that obviously wrong template bindings (wrong types, nonexistent properties) don't fail the build — without it, AOT still compiles but type-checking is much looser.
- Blaming "AOT" for a bug that only reproduces in `ng build --configuration production` but not `ng serve` — often the real culprit is a *different* optimization (tree-shaking removing something reachable only via reflection, or differing environment files), not compilation mode itself, since both dev and prod use AOT/Ivy today.
- Expecting AOT compile errors to point at runtime call stacks — they instead point at template line/column locations in your `.html`/inline template, which is a different debugging mental model than a runtime `TypeError`.
- Not realizing that AOT increases build time noticeably on large apps; teams sometimes disable `strictTemplates` to speed up CI without realizing they've traded away the framework's strongest source of early bug detection.

## Interview Questions & Answers

**Q: What exactly does "ahead-of-time" mean in AOT compilation — ahead of what?**
A: Ahead of the browser executing the app. The Angular compiler runs as part of the build pipeline (triggered by `ng build`/`ng serve`), parsing every component's template and generating Ivy instruction code before the JavaScript bundle is ever produced or shipped. The browser downloads and executes only the already-compiled output; it does zero template parsing itself.

**Q: Why is AOT the default and effectively required for production Angular apps today?**
A: Since Ivy (Angular 9+), templates compile to instruction-calling functions rather than to a runtime-interpreted format, and the tooling and CLI are built around compiling ahead of time both in dev and prod. AOT ships smaller bundles (no compiler in the payload), renders faster on first load (no in-browser compile pass), surfaces template errors at build time via `strictTemplates`, and avoids evaluating template-like strings at runtime, which is a better security posture. There's no remaining scenario where a standard app benefits from shipping the compiler to the browser instead.

**Q: What's a concrete tradeoff of AOT you'd mention to show you understand it's not a free win?**
A: Build time. Real compilation work — parsing, type-checking against your TypeScript types, and code generation — happens on every build, which is slower than treating templates as opaque strings. Ivy's incremental compilation made this fast enough for iterative `ng serve` use, but it's still a real cost, especially in CI on large codebases, and it's why some teams tune `strictTemplates` or use incremental build caching.

**Q: How does AOT change how you catch bugs compared to templates being evaluated at runtime?**
A: With `strictTemplates` enabled, a binding like `{{ user.nmae }}` or passing a `string` into an `@Input()` typed as `number` fails the build immediately, at the exact template location, before any code ships. Without AOT's type-checking, the same mistake might not surface until a user actually hits that code path in production and gets `undefined` or a runtime exception, which is strictly worse for both reliability and debugging cost.

**Q: Is there any legitimate use case left for compiling templates at runtime instead of AOT?**
A: Rarely, but yes — scenarios where the template content genuinely doesn't exist until runtime, such as a plugin system rendering user-authored template strings, or certain very dynamic component-generation tools. That's the domain of JIT compilation, which is no longer the default and requires deliberately opting back into the JIT compiler; for the vast majority of apps, where every template is known at build time, there's no reason to use it.

## Related Topics

- [just-in-time-compilation.md](./just-in-time-compilation.md)
- [angular-cli.md](./angular-cli.md)
- [components.md](./components.md)
- [templates.md](./templates.md)
- [server-side-rendering.md](./server-side-rendering.md)
