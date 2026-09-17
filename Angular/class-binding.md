# Class Binding

Class binding is Angular's dedicated syntax for controlling which CSS classes are applied to an element, and it comes in two flavors depending on whether you're toggling a single class or driving a whole set of classes at once. `[class.foo]="expression"` toggles exactly one class — `foo` is added when the expression is truthy and removed when it's falsy. `[class]="expression"` (or the older `[ngClass]="expression"` directive, which is functionally equivalent and still extremely common in existing codebases) binds a *set* of classes at once, and accepts the expression in several shapes: a space-separated string (`'active highlighted'`), an array of class names (`['active', 'highlighted']`), or — the most commonly used form in real code — an object map where keys are class names and values are booleans (`{ active: isActive, disabled: isDisabled, 'is-vip': user.isVip }`), so each key's class is present exactly when its boolean expression is true.

The object-map form is the idiomatic pattern for conditional styling driven by multiple independent boolean conditions, because it reads declaratively: you can see every class the element might get and exactly what condition controls each one, in one place, without a chain of ternaries concatenated into a string. It's also efficient — Angular diffs the map between change-detection runs and only adds/removes the classes whose boolean actually flipped, rather than tearing down and rebuilding the whole `class` attribute.

A key distinction from attribute binding (see [attribute-binding.md](./attribute-binding.md)) is that `[class.x]` and `[class]`/`[ngClass]` are specifically designed to *merge* with statically-declared classes and with each other, rather than overwrite the whole attribute the way a raw `[attr.class]="expr"` would. Historically this merging had rough edges — in older Angular versions, combining a static `class="card"` attribute with an `[ngClass]` binding usually worked, but combining two different *binding* sources (e.g. a component's own static class alongside a parent passing a class via host binding) could get confusing about which source won. Angular 17+ specifically improved this: bindings passed to a component's host element from a directive's `host` metadata or from a parent's static `class` attribute now merge with the component's own internal class bindings by default rather than the last-applied binding fully replacing earlier ones, which used to be a common source of "why did my class disappear" bugs when composing directives that each wanted to contribute classes to the same host element.

## Examples

```ts
import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `
    <!-- Single class toggle: 'is-online' present only when online() is true -->
    <span class="badge" [class.is-online]="online()">
      {{ online() ? 'Online' : 'Offline' }}
    </span>

    <!-- Object-map form: each key's class tracks its own boolean independently -->
    <div [class]="{ card: true, 'card--selected': selected(), 'card--disabled': disabled() }">
      Card content
    </div>
  `,
})
export class StatusBadgeComponent {
  online = signal(true);
  selected = signal(false);
  disabled = signal(false);
}
```

The first binding toggles exactly one class based on a single condition; the second uses the object-map form to drive three classes from three independent conditions, including an unconditional `card: true` entry, which is a common pattern for always-present classes that still need to live alongside conditional ones in the same map.

```ts
// Older but still very common: ngClass directive, functionally equivalent to [class]
import { Component, signal } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-nav-item',
  standalone: true,
  imports: [NgClass],
  template: `
    <a [ngClass]="{ active: isActive(), 'nav-link': true }" [routerLink]="path">
      {{ label }}
    </a>
  `,
})
export class NavItemComponent {
  isActive = signal(false);
  label = 'Dashboard';
  path = '/dashboard';
}
```

`NgClass` requires an explicit import in a standalone component (it isn't a built-in template feature the way `[class.x]` is — it's a structural directive from `CommonModule`/`@angular/common`), and behaves the same as `[class]="{...}"` for object-map input; most new code prefers `[class]` directly since it needs no import and no directive instance.

```html
<!-- Static class + binding merge (Angular 17+ host binding merge behavior) -->
<!-- template of a parent using a component that itself sets host classes internally -->
<app-card class="highlighted" [class.compact]="isCompact"></app-card>
```

```ts
@Component({
  selector: 'app-card',
  standalone: true,
  host: { class: 'card' }, // the component's own base class
  template: `...`,
})
export class CardComponent {}
```

The rendered element ends up with all three classes — `card` (from the component's own host metadata), `highlighted` (static, from the parent's template), and conditionally `compact` (from the parent's `[class.compact]` binding) — merged together rather than the parent's usage overwriting the component's internal `card` class, which is the Angular 17+ merge behavior in action.

## Common Pitfalls / Gotchas

- Using `[attr.class]="expr"` instead of `[class]="expr"` — `[attr.class]` overwrites the whole class attribute string on every change, clobbering static classes and any other class bindings, whereas `[class]` merges.
- Forgetting `NgClass` needs to be explicitly imported into a standalone component's `imports` array (`import { NgClass } from '@angular/common'`) — omitting it produces a template compile error about an unknown directive, easy to miss since it "used to just work" under NgModules where `CommonModule` was often already imported app-wide.
- Passing a class name with characters that aren't valid in property-binding-style syntax (e.g. `[class.is-active]` works fine with a dash because it's inside a string-like binding target, but people sometimes assume they need bracket-notation or quotes and reach for the object-map form unnecessarily for a single class).
- Relying on object-map identity for change detection under `OnPush` — passing a freshly-created object literal `{ active: x }` inline in the template every render is fine for `[class]`/`[ngClass]` specifically because Angular deep-diffs the map's keys each cycle rather than reference-comparing the whole object, but it's still a common (incorrect) worry that trips people up when reasoning about `OnPush` elsewhere.
- Combining multiple sources of `class` (a component's own `host: { class: '...' }`, a parent's static `class="..."` attribute, and a parent's `[class.x]` binding) and assuming pre-v17 "last one wins" semantics still apply — on modern Angular these merge, so code written defensively around the old overwrite behavior may be solving a problem that no longer exists.

## Interview Questions & Answers

**Q: What's the difference between `[class.active]="isActive"` and `[class]="{ active: isActive }"`?**
A: `[class.active]` toggles exactly one named class based on one boolean expression — it's the simplest and most direct form when you only care about a single class. `[class]="{...}"` (or `[ngClass]`) binds a whole set of classes at once via an object map, string, or array, which is better when several classes need independent conditions, since you get them all declared together in one place instead of a separate `[class.x]` binding per class.

**Q: What input shapes does `[ngClass]`/`[class]` accept?**
A: A space-separated string of class names, an array of class name strings, or an object map where each key is a class name and its boolean value determines whether that class is applied. The object-map form is the most commonly used in practice because it cleanly expresses several independent conditional classes at once.

**Q: Does `[class]="expr"` overwrite static classes declared in the same element's `class` attribute, or merge with them?**
A: It merges. `<div class="card" [class]="{ selected: isSelected }">` keeps the static `card` class and adds/removes `selected` based on the binding — Angular doesn't let the binding wipe out the statically-declared class. This is distinct from `[attr.class]="expr"`, which does overwrite the whole attribute string since it bypasses Angular's class-specific merging logic entirely.

**Q: How does class binding merging behave differently in Angular 17+ compared to earlier versions, especially with component host classes?**
A: Earlier Angular versions could have "last binding wins" behavior when multiple sources — a component's own `host: { class: ... }` metadata, a parent's static class attribute, a parent's class binding — all targeted the same host element, which sometimes silently dropped classes depending on binding order. Angular 17+ improved this so that host bindings and template-level class bindings/static classes merge together by default rather than one overwriting another, which removed a class of subtle bugs when composing directives or components that each contribute classes to the same host element.

**Q: Why would you prefer `[class]="{...}"` over string-concatenating class names manually in the component class?**
A: Declaring class logic in the template as an object map keeps the condition for each class visible right next to the markup it affects, and lets Angular diff only the keys that changed between renders rather than reconstructing and re-parsing an entire class string every cycle. Building a class string manually in the component (`get classes() { return this.a ? 'x' : '' + ... }`) works but scatters the logic, is easy to get wrong with spacing, and loses Angular's built-in per-key diffing.

## Related Topics

- [style-binding.md](./style-binding.md)
- [attribute-binding.md](./attribute-binding.md)
- [property-binding.md](./property-binding.md)
- [data-binding.md](./data-binding.md)
- [directives.md](./directives.md)
