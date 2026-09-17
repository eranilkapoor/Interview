# Components

A component is Angular's fundamental building block: a TypeScript class annotated with `@Component`, pairing a chunk of UI (a template) with the logic and state that drive it (the class itself, sometimes called the "view model"). The decorator's metadata tells Angular how to find and render it — `selector` is the CSS-style tag Angular matches against the DOM (`app-user-card` for a custom element, or an attribute/class selector), and `template`/`templateUrl` plus `styles`/`styleUrls` supply the markup and styling, either inline or as separate files. Every rendered piece of an Angular UI is, ultimately, a tree of component instances — a root component (bootstrapped directly) containing child components, each with its own template, its own local state, and its own change-detection unit.

A component's `@Input()`s and `@Output()`s (or their signal-based equivalents, `input()` and `output()`) form its public API — the only sanctioned way parent and child components communicate directly. Inputs flow data down into a component; outputs (backed by `EventEmitter`, or `output()`'s emit function) flow events up out of it. This one-directional-per-channel design is deliberate: it keeps data flow traceable, in contrast to two-way binding (`[(ngModel)]` or a custom `[(value)]` banana-in-a-box pattern) which is convenient but easier to lose track of in a larger component tree. Components compose by nesting — a parent's template includes a child's selector as a tag, passes data via property bindings on inputs, and listens for events via event bindings on outputs — and this composition, not inheritance, is Angular's primary mechanism for building complex UIs out of simple pieces.

Since Angular 14 (default since 17), components can be `standalone: true`, meaning they declare their own dependencies — other components, directives, pipes they use in their template — directly in an `imports` array on the decorator, with no NgModule required to "declare" them (see modules.md). Before that, every component had to belong to exactly one NgModule's `declarations` array to be usable at all. Both forms remain valid Angular today; a modern codebase is more likely to default to standalone, but plenty of production code, and anything targeting broad library compatibility, still uses module-declared components.

View encapsulation controls how a component's `styles` interact with the rest of the page. The default, `ViewEncapsulation.Emulated`, rewrites your CSS selectors and adds unique attributes to your component's DOM elements so its styles only apply within that component's own template (and don't leak out, and outside styles don't leak in) — without relying on real Shadow DOM, which keeps things simpler and more broadly compatible but is still just emulation, not true isolation (global styles with sufficiently specific selectors, or `::ng-deep`, can still pierce it). `ViewEncapsulation.None` disables scoping entirely, so a component's styles become global. `ViewEncapsulation.ShadowDom` uses the browser's real Shadow DOM API for genuine style and DOM isolation, at the cost of some interop quirks (global styles genuinely cannot reach in, which is sometimes surprising, and certain CSS features behave differently inside a shadow root).

## Examples

```ts
// A standalone component demonstrating inputs, outputs, and composition
import { Component, input, output, computed } from '@angular/core';

@Component({
  selector: 'app-quantity-picker',
  standalone: true,
  template: `
    <button (click)="decrement()" [disabled]="value() <= min()">-</button>
    <span>{{ value() }}</span>
    <button (click)="increment()" [disabled]="value() >= max()">+</button>
  `,
})
export class QuantityPickerComponent {
  value = input(1);          // signal-based input: parent binds [value]="..."
  min = input(0);
  max = input(99);
  changed = output<number>(); // signal-based output: parent listens (changed)="..."

  increment() {
    const next = this.value() + 1;
    if (next <= this.max()) this.changed.emit(next);
  }
  decrement() {
    const next = this.value() - 1;
    if (next >= this.min()) this.changed.emit(next);
  }
}
```

This shows the modern signal-based input/output API: `input()` creates a readonly reactive signal the parent sets via property binding, and `output()` creates an emitter — the component's entire public contract is these two declarations, nothing else is reachable from outside.

```ts
// The classic decorator-based equivalent, still extremely common in real code
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-star-rating',
  standalone: true,
  template: `
    @for (star of stars; track star) {
      <span (click)="rate(star)" [class.filled]="star <= rating">★</span>
    }
  `,
})
export class StarRatingComponent {
  @Input() rating = 0;
  @Output() ratingChange = new EventEmitter<number>();
  stars = [1, 2, 3, 4, 5];

  rate(value: number) {
    this.rating = value;
    this.ratingChange.emit(value); // "ratingChange" naming enables [(rating)] two-way binding sugar
  }
}
```

This uses the `@Input`/`@Output` decorator style that predates and still coexists with signal inputs, and shows the naming convention (`x` + `xChange`) that lets a parent use Angular's `[(rating)]` two-way binding shorthand for free, plus the new `@for` control-flow block instead of `*ngFor`.

```ts
// Composition: a parent nests the child and wires its public API
import { Component } from '@angular/core';
import { QuantityPickerComponent } from './quantity-picker.component';

@Component({
  selector: 'app-cart-line',
  standalone: true,
  imports: [QuantityPickerComponent], // component declares its own template dependency
  template: `
    <app-quantity-picker
      [value]="quantity"
      [max]="stock"
      (changed)="onQuantityChanged($event)" />
  `,
})
export class CartLineComponent {
  quantity = 1;
  stock = 12;
  onQuantityChanged(next: number) { this.quantity = next; }
}
```

This is the composition pattern in practice: the parent never reaches into the child's internals — it only binds to the child's declared inputs and listens to its declared outputs, keeping the data flow explicit and one-directional per channel.

## Common Pitfalls / Gotchas

- Mutating an `@Input()`-bound object/array in place inside the child instead of treating inputs as owned-by-the-parent — this can cause change detection to miss the update (since the reference didn't change) or cause confusing bugs where the parent's own copy appears to change unexpectedly because it's literally the same object reference.
- Forgetting that `ViewEncapsulation.Emulated` is *not* real isolation — global stylesheets with high-specificity selectors, or `::ng-deep` (deprecated but still functional), can still leak styles into an emulated component, unlike true `ShadowDom` encapsulation.
- Naming an `@Output()` without the `xChange` convention when you actually want to support `[(x)]` two-way binding syntax on a custom property — Angular's two-way binding sugar for a custom property `x` specifically requires a paired `@Input() x` and `@Output() xChange`.
- Overusing `@Input()`/`@Output()` chains for data that's really shared app state — passing the same value down through four levels of components ("prop drilling") that don't otherwise need it, instead of reaching for a shared service or signal-based store.
- Forgetting that a standalone component must explicitly `import` every directive/pipe/component it uses in its template (including `NgIf`/`NgFor` if not using the newer `@if`/`@for` control flow, or `CommonModule` as a whole) — unlike NgModule-declared components, there's no ambient availability from a shared module's `declarations`.

## Interview Questions & Answers

**Q: What's the actual difference between a component's `@Input()`s and its constructor-injected services?**
A: Inputs are how a *parent component* passes data down through the template, set via property binding (`[value]="..."`) and scoped to that one instance's relationship with its parent — they're part of the component's public template-facing API. Constructor-injected services come from the dependency injection hierarchy, not from a parent template, and represent shared logic/state the component consumes regardless of who's rendering it or where in the tree it sits. A component can (and usually does) have both: inputs for what its specific parent hands it, and injected services for app-wide capabilities like HTTP or shared state.

**Q: Explain Angular's default view encapsulation and one real way it can be defeated.**
A: `ViewEncapsulation.Emulated` (the default) scopes a component's styles by rewriting selectors and tagging the component's DOM elements and stylesheet rules with a unique generated attribute, so styles apply only within that component's own template without using real Shadow DOM. It can be defeated by global stylesheets whose selectors are specific enough to match the component's actual DOM regardless of the scoping attribute, or deliberately via the deprecated `::ng-deep` combinator, which explicitly punches through the emulation to style descendant components' internals — useful sometimes for overriding a third-party component's styles, but a maintenance hazard.

**Q: How does composition (nesting components) replace the need for inheritance in typical Angular UI code?**
A: Instead of extending a base component class to share behavior, you build complex UI by nesting smaller, focused components and wiring them together via inputs (data down) and outputs (events up) in the parent's template. Each child component owns its own template, state, and change detection, and the parent orchestrates them without needing to know their internals — this keeps components independently testable and reusable in different parent contexts, which class inheritance (sharing a base component class) tends to undermine by coupling behavior tightly to a specific hierarchy.

**Q: What changed about how components declare their dependencies with standalone components?**
A: A module-declared component relied on belonging to an NgModule whose `declarations` and `imports` arrays implicitly made a set of directives/pipes/components available to its template — the component itself listed no dependencies. A standalone component (`standalone: true`) instead lists exactly what its own template needs in its own `imports` array on `@Component`, making the dependency explicit and local to the component rather than inherited from wherever it happened to be declared.

**Q: Why might you choose `@Input()`/`EventEmitter` over signal-based `input()`/`output()`, or vice versa, in a real codebase today?**
A: Signal-based inputs/outputs integrate directly with Angular's signal reactivity model — `input()` produces a read-only signal you can feed into `computed()` or `effect()` without extra glue, and Angular can skip parts of change detection more efficiently around signal-driven components. Decorator-based `@Input()`/`@Output()` remain fully supported and are what most existing (and much current) code uses, are marginally less ceremony for a simple mutable field, and are necessary knowledge for maintaining the vast amount of pre-signals Angular code; a team on a fully modern (v17+) codebase adopting signals throughout would generally prefer the signal-based forms for new components for consistency with their reactive model.

## Related Topics

- [templates.md](./templates.md)
- [input-decorator.md](./input-decorator.md)
- [output-decorator.md](./output-decorator.md)
- [views.md](./views.md)
- [modules.md](./modules.md)
- [life-cycle-hooks.md](./life-cycle-hooks.md)
