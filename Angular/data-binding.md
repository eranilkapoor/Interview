# Data Binding

Data binding is the mechanism Angular uses to synchronize data between a component's TypeScript class (the model) and its HTML template (the view), without you manually reading from or writing to the DOM. Instead of calling `document.getElementById(...).textContent = ...` the way you would in vanilla JS, you declare the relationship once in the template — `{{ value }}`, `[prop]="value"`, `(event)="handler()"` — and Angular's change detection keeps the view in sync as the underlying data changes (and, for the one exception below, keeps the data in sync as the view changes).

Angular groups binding into four forms, distinguished by *direction* and *what side of the template syntax the data flows through*:

- **Interpolation** — `{{ expression }}` — one-way, component → view. Renders a value as text inside element content or as a plain-text attribute value. See [interpolation.md](./interpolation.md).
- **Property binding** — `[property]="expression"` — one-way, component → view. Sets an actual DOM element property (not an HTML attribute), or a directive/component `@Input()`. See [property-binding.md](./property-binding.md). A close sibling, attribute binding (`[attr.name]="expression"`), covers the cases where no DOM property exists to bind to — see [attribute-binding.md](./attribute-binding.md). Two further specializations, [class-binding.md](./class-binding.md) and [style-binding.md](./style-binding.md), handle CSS classes and inline styles specifically.
- **Event binding** — `(event)="statement($event)"` — one-way, view → component. Listens for a DOM event or a custom component `@Output()`/`output()` emission and runs a method or statement in the component class. See [event-binding.md](./event-binding.md).
- **Two-way binding** — `[(ngModel)]="expression"` — combines property binding and event binding into one syntax, so data flows in both directions simultaneously. It's syntactic sugar: `[(x)]="y"` desugars to `[x]="y" (xChange)="y = $event"`. For `ngModel` specifically this requires importing `FormsModule` (or `FormsModule`'s standalone-compatible export) because `NgModel` is the directive that exposes both the `[ngModel]` input and the `(ngModelChange)` output that the banana-in-a-box syntax stitches together.

Angular's default philosophy is **unidirectional data flow**: data flows down from parent to child via property bindings, and events flow up from child to parent via event bindings (or `@Output()`). This is deliberate — it makes change detection predictable (a single pass down the component tree is enough to settle the view) and makes debugging tractable (you can reason about where a value came from by following bindings downward). Two-way binding with `[(ngModel)]` is the one built-in exception, and it exists purely as ergonomic sugar for the extremely common case of "a form control's value should mirror a component property and vice versa" — under the hood it is still just a property binding plus an event binding, not a different underlying mechanism, so it doesn't actually violate the unidirectional model at the framework level; it's just two one-way bindings wired together in the template. You can build the same two-way pattern yourself on any custom component by pairing an `@Input() value` with an `@Output() valueChange = new EventEmitter<T>()` (or `input()`/`model()` signals in modern Angular, where `model()` is purpose-built for exactly this two-way pattern).

All of these bindings are processed at compile time, not runtime string interpolation — Angular's template compiler (via Ivy) turns `{{ }}`, `[ ]`, and `( )` syntax into instructions that directly call DOM APIs (`setProperty`, `addEventListener`, etc.), which is part of why Angular templates need to be known ahead of time (or JIT-compiled) rather than being arbitrary runtime strings — see [ahead-of-time-compilation.md](./ahead-of-time-compilation.md).

## Examples

```ts
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-profile-card',
  standalone: true,
  imports: [FormsModule],
  template: `
    <!-- Interpolation: one-way, component -> view -->
    <h2>{{ username() }}</h2>

    <!-- Property binding: one-way, component -> view -->
    <img [src]="avatarUrl" [alt]="username()" />

    <!-- Event binding: one-way, view -> component -->
    <button (click)="logOut()">Log out</button>

    <!-- Two-way binding: sugar for [ngModel] + (ngModelChange) -->
    <input [(ngModel)]="draftName" (ngModelChange)="onDraftChange($event)" />
  `,
})
export class ProfileCardComponent {
  username = signal('anil');
  avatarUrl = '/assets/avatar.png';
  draftName = '';

  logOut() {
    console.log('logging out');
  }

  onDraftChange(value: string) {
    console.log('draft is now', value);
  }
}
```

This shows all four binding categories side by side on one component: interpolation for text, property binding for a DOM property, event binding for a click handler, and `[(ngModel)]` demonstrating that it still fires the underlying `(ngModelChange)` event you could bind manually.

```ts
// Building your own two-way binding on a custom component without ngModel,
// using the modern `model()` signal API (Angular 17.3+)
import { Component, model } from '@angular/core';

@Component({
  selector: 'app-rating',
  standalone: true,
  template: `
    <button (click)="stars.set(stars() - 1)">-</button>
    {{ stars() }}
    <button (click)="stars.set(stars() + 1)">+</button>
  `,
})
export class RatingComponent {
  // model() generates both the input `stars` and the output `starsChange`
  // automatically, so a parent can write [(stars)]="value" for free.
  stars = model(0);
}
```

```html
<!-- Parent template using the custom two-way binding -->
<app-rating [(stars)]="productRating" />
```

`model()` is the signals-era replacement for hand-rolling an `@Input()` + `@Output()` pair just to support `[(x)]` syntax — it generates the paired input/output automatically, and the parent's `[(stars)]="productRating"` desugars the exact same way `[(ngModel)]` does.

## Common Pitfalls / Gotchas

- Reaching for `[(ngModel)]` on a custom component without realizing it requires `FormsModule` to be imported (it isn't available by default in a standalone component) — a common "why doesn't two-way binding work" bug.
- Believing two-way binding is a separate binding mechanism rather than syntactic sugar — it helps to mentally expand `[(x)]="y"` to `[x]="y" (xChange)="y = $event"` when debugging why a value isn't updating.
- Mixing interpolation and property binding for the same purpose inconsistently, e.g. `src="{{ url }}"` instead of `[src]="url"` — string interpolation on an attribute still works for many cases but is the wrong tool for anything that needs a real DOM property (see [property-binding.md](./property-binding.md) for the `<img src>` gotcha specifically).
- Overusing two-way binding for values that should really flow one direction only, which reintroduces the exact unpredictability unidirectional flow is designed to avoid — prefer `@Input()`/`@Output()` (or `input()`/`output()`) unless you specifically need the paired get/set ergonomics.
- Forgetting that all of these bindings only update on Angular's change detection cycle; a value mutated outside Angular's zone (e.g. inside a raw `setTimeout` when using zoneless change detection, or a third-party callback) may not immediately reflect in the view without `NgZone.run()` or triggering detection manually.

## Interview Questions & Answers

**Q: What are the four types of data binding in Angular, and what direction does data flow in each?**
A: Interpolation (`{{ }}`) and property binding (`[ ]`) are one-way, component-to-view. Event binding (`( )`) is one-way, view-to-component. Two-way binding (`[( )]`) combines a property binding and an event binding so data flows both directions at once. All four are really built from just two primitives — property binding and event binding — interpolation is sugar for a property binding to `textContent`, and two-way binding is sugar for a property binding plus an event binding wired together.

**Q: Is `[(ngModel)]` really "two-way binding" at the framework level, or is something else going on?**
A: It's sugar. `[(ngModel)]="x"` is expanded by the template compiler into `[ngModel]="x" (ngModelChange)="x = $event"`. `NgModel` is a directive that exposes an `@Input() ngModel` and an `@Output() ngModelChange`, so nothing in Angular's underlying change-detection model actually supports bidirectional flow as a primitive — it's built entirely out of the same one-way property/event bindings everything else uses.

**Q: Why does Angular default to unidirectional data flow instead of two-way binding everywhere, like older frameworks (e.g. AngularJS's `$scope` two-way digest)?**
A: Unidirectional flow makes change propagation predictable and bounded: data flows down through property bindings in a single pass over the component tree, and Angular's change detection can run top-down without worrying about a child mutating a value that then needs to re-propagate back up and potentially re-trigger detection higher in the tree. AngularJS's pervasive two-way binding via `$watch`/digest cycles could require multiple digest passes to stabilize and made performance and debugging harder to reason about at scale. Modern Angular keeps two-way binding available only as an explicit, opt-in pattern (`[(x)]`, or `model()`) rather than the default.

**Q: How would you implement `[(x)]` two-way binding on your own custom component?**
A: Two ways. Classic: define `@Input() x: T` and `@Output() xChange = new EventEmitter<T>()` — the naming convention `xChange` is what lets Angular's template compiler recognize the pair and allow `[(x)]` syntax. Modern (Angular 17.3+): use `x = model<T>(initialValue)`, which generates both the input and the `xChange` output signal-backed automatically, and update it with `x.set(...)` or `x.update(...)`.

**Q: What's the difference between interpolation and property binding — when would you use `{{ }}` vs `[ ]`?**
A: Interpolation only ever produces a string and is really sugar for a property binding to an element's text content (or, when used inside an attribute-position string like `src="{{url}}"`, to that attribute's underlying property via string coercion). Property binding lets you bind to any DOM property with its native type — booleans, objects, arrays — not just strings, which matters for things like `[disabled]="isDisabled"` (a boolean) where interpolating `disabled="{{isDisabled}}"` would produce a truthy string attribute regardless of the boolean's value.

## Related Topics

- [interpolation.md](./interpolation.md)
- [property-binding.md](./property-binding.md)
- [attribute-binding.md](./attribute-binding.md)
- [class-binding.md](./class-binding.md)
- [style-binding.md](./style-binding.md)
- [event-binding.md](./event-binding.md)
