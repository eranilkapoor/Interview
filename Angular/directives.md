# Directives

A directive is a class that attaches behavior to an element in the DOM. Angular has three categories, and the distinction matters because it's a common interview trap: **components** are technically directives with an attached template (they're the only kind that can have a view, and internally `@Component` is a superset of the `@Directive` decorator's metadata); **structural directives** change the DOM's layout by adding, removing, or repeating elements (`*ngIf`, `*ngFor`, `*ngSwitch`, and the newer `@if`/`@for`/`@switch` block syntax); and **attribute directives** change the appearance or behavior of an existing element without adding or removing it from the DOM (`ngClass`, `ngStyle`, `ngModel`, or a custom directive like a tooltip or a permission-based `disabled` toggle).

The `*` prefix on structural directives (`*ngIf`, `*ngFor`) is syntactic sugar — "microsyntax" — that the Angular compiler desugars into an `<ng-template>` element before compilation. `<div *ngIf="isVisible">Hello</div>` becomes `<ng-template [ngIf]="isVisible"><div>Hello</div></ng-template>`. The directive itself never touches the DOM directly; it receives a `TemplateRef` (a handle to the uninstantiated template) and a `ViewContainerRef` (the location in the DOM tree where views can be inserted), and it decides when to call `viewContainerRef.createEmbeddedView(templateRef)` or `viewContainerRef.clear()`. This is why only one structural directive can be applied per host element with the `*` syntax — two structural directives would both try to wrap the same element in a template and the desugaring becomes ambiguous — whereas you can compose multiple attribute directives freely on the same element.

Since Angular 17, the built-in control-flow blocks `@if`, `@for`, and `@switch` are the recommended replacement for `*ngIf`/`*ngFor`/`*ngSwitch` in new code. They aren't directives at all — they're compiled directly into instructions in the template's rendering function, which avoids the overhead of directive instantiation, structural-directive host bindings, and the `<ng-template>` indirection. Practically this means better runtime performance (Angular's own benchmarks show meaningfully faster list rendering) and better type narrowing — inside `@if (user(); as u)`, TypeScript knows `u` is non-null in a way `*ngIf="user as u"` didn't always guarantee. `@for` also *requires* a `track` expression (`@for (item of items; track item.id)`), which forces the identity-tracking discipline that `*ngFor`'s `trackBy` function only offered optionally — a frequent source of unnecessary DOM churn in older code.

Attribute directives extend a host element using `@HostBinding` (to bind a DOM property or CSS class/style of the host element to a directive property) and `@HostListener` (to listen for DOM events on the host element, like `click` or `mouseenter`). They are the mechanism behind `ngClass`, `ngStyle`, and any custom directive you'd write for things like a reusable highlight-on-hover behavior, a role-based `appHasPermission` structural directive, or an auto-focus directive. Angular also has non-directive-based alternatives for some of these same jobs now — class and style bindings (`[class.active]`, `[style.color]`) are often preferred over `ngClass`/`ngStyle` for a single conditional class/style because they're more direct and slightly cheaper, reserving `ngClass`/`ngStyle` for cases where you genuinely need to bind a whole object/map of classes or styles at once.

## Examples

```ts
import { Directive, ElementRef, HostBinding, HostListener, inject, input } from '@angular/core';

// A custom attribute directive: highlights its host element on hover,
// and lets the caller override the highlight color via an input.
@Directive({
  selector: '[appHighlight]',
  standalone: true,
})
export class HighlightDirective {
  private readonly el = inject(ElementRef<HTMLElement>);

  // Signal-based input; usage: <div appHighlight="lightblue">
  appHighlight = input<string>('yellow');

  @HostBinding('style.backgroundColor') backgroundColor = '';

  @HostListener('mouseenter')
  onMouseEnter() {
    this.backgroundColor = this.appHighlight();
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    this.backgroundColor = '';
  }
}
```
This shows the canonical attribute-directive shape: `@HostListener` reacts to native DOM events on the host, `@HostBinding` writes back to a host DOM property, and it never touches or replaces the element itself.

```ts
import { Directive, TemplateRef, ViewContainerRef, inject, input, effect } from '@angular/core';

// A custom structural directive: renders its template only if the
// current user has the given permission. Usage: <div *appHasPermission="'admin'">
@Directive({
  selector: '[appHasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly auth = inject(AuthService);

  appHasPermission = input.required<string>();

  private hasView = false;

  constructor() {
    effect(() => {
      const allowed = this.auth.hasPermission(this.appHasPermission());
      if (allowed && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!allowed && this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    });
  }
}
```
This demonstrates the actual mechanism behind every structural directive: it holds a reference to the uninstantiated `<ng-template>` content and imperatively inserts or removes it from the `ViewContainerRef`, rather than manipulating DOM nodes directly. Note `input.required<string>()` maps to the `appHasPermission` binding because Angular's microsyntax convention aliases the structural directive's main input to the directive's selector name.

```html
<!-- Modern block syntax (Angular 17+) — preferred for new code -->
@if (user(); as u) {
  <p>Welcome, {{ u.name }}</p>
} @else {
  <p>Please log in</p>
}

@for (item of items(); track item.id) {
  <li>{{ item.label }}</li>
} @empty {
  <li>No items found</li>
}

<!-- Equivalent legacy structural directive syntax, for comparison -->
<p *ngIf="user() as u; else loggedOut">Welcome, {{ u.name }}</p>
<ng-template #loggedOut><p>Please log in</p></ng-template>

<ul>
  <li *ngFor="let item of items(); trackBy: trackById">{{ item.label }}</li>
</ul>
```
This contrasts the two syntaxes side by side: `@for` mandates `track` (there's no way to opt out, unlike `*ngFor`'s optional `trackBy`), and `@if`/`@else`/`@empty` read linearly instead of requiring a separate `<ng-template>` for the else branch.

## Common Pitfalls / Gotchas

- Trying to put two `*`-prefixed structural directives on the same host element (`<div *ngIf="x" *ngFor="let i of items">`) — this is a compile error; you must nest them, typically by wrapping one in `<ng-container>` which renders no extra DOM node.
- Forgetting `track` in `@for` — it's mandatory (unlike `*ngFor`'s `trackBy`), and using `track $index` defeats the purpose when items have a stable identity, causing Angular to destroy/recreate DOM nodes on every reorder instead of moving them.
- Mixing `ngClass`/`ngStyle` with individual `[class.x]`/`[style.y]` bindings on the same element and being surprised by precedence — Angular merges them, but it's easy to introduce conflicting sources of truth for the same class.
- Forgetting that a custom structural directive's main `@Input()` must be named exactly after the selector (e.g. selector `appHasPermission` needs an input property literally named `appHasPermission`) for the `*appHasPermission="'admin'"` microsyntax to bind correctly — a mismatched name silently fails to bind.
- Not calling `viewContainer.clear()` before `createEmbeddedView()` again in a custom structural directive, leading to duplicated embedded views stacking up instead of being replaced.
- Assuming `@if`/`@for`/`@switch` are directives you can import — they're compiler-level syntax built into every template, not something added to a component's `imports` array, whereas `NgIf`/`NgFor`/`NgSwitch` must be explicitly imported into a standalone component.

## Interview Questions & Answers

**Q: What are the three types of Angular directives, and how does a component relate to them?**
A: Components, structural directives, and attribute directives. A component is technically a directive with a template attached — `@Component` metadata is a superset of `@Directive` metadata (selector, inputs, outputs, host bindings, etc.) plus template/style configuration. Structural directives change the DOM layout by adding/removing elements (`*ngIf`, `*ngFor`); attribute directives change appearance or behavior of an element already in the DOM without adding or removing it (`ngClass`, a custom tooltip directive).

**Q: What does `*ngIf="condition"` actually desugar to, and why does that matter for writing a custom structural directive?**
A: It desugars to `<ng-template [ngIf]="condition"><div>...</div></ng-template>`. The directive never manipulates the DOM element itself — it receives a `TemplateRef` pointing at the wrapped, uninstantiated template and a `ViewContainerRef` marking where to insert views, and calls `viewContainerRef.createEmbeddedView(templateRef)` to render it or `.clear()` to remove it. Writing a custom structural directive means injecting exactly those two tokens and implementing that create/clear logic yourself, usually behind some condition in a setter or an `effect()`.

**Q: Why can't you put two structural directives on the same element with the `*` syntax?**
A: Each `*`-prefixed structural directive desugars to wrapping the host element in its own `<ng-template>`. Two structural directives on one element would require two nested templates, and the compiler has no unambiguous way to decide which one wraps which, so it's a compile-time error. The fix is to nest them explicitly, usually with an `<ng-container>` for the outer one since `<ng-container>` renders no actual DOM element.

**Q: What's the practical difference between the new `@for` block and `*ngFor`, beyond syntax?**
A: `@for` is compiled directly into the component's render instructions rather than being implemented as a directive, which removes directive-instantiation and `<ng-template>` overhead and measurably improves rendering performance for large lists. Functionally, `@for` makes the `track` expression mandatory — there's no way to render a list without specifying identity — which prevents the common bug of `*ngFor` silently defaulting to identity-by-reference (or unspecified) tracking and tearing down/rebuilding DOM nodes unnecessarily on data updates.

**Q: When would you reach for `ngClass` over `[class.foo]="condition"`?**
A: `[class.foo]="condition"` is best for a single, independently toggled class — it's simpler and slightly cheaper since Angular just binds one boolean. `ngClass` is worth it when you need to apply a whole set of classes at once from an object (`{active: isActive, disabled: isDisabled}`) or a dynamically computed string/array, since expressing that with individual `[class.x]` bindings for every possible class gets unwieldy.

## Related Topics

- [components.md](./components.md)
- [templates.md](./templates.md)
- [data-binding.md](./data-binding.md)
- [class-binding.md](./class-binding.md)
- [style-binding.md](./style-binding.md)
- [views.md](./views.md)
