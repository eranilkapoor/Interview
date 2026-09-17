# Templates

An Angular template is the HTML-based, declarative description of what a component renders, extended with Angular-specific syntax for binding data, handling events, and controlling structure — it's not plain HTML, it's a small domain-specific language that the compiler parses and turns into Ivy instructions (see ahead-of-time-compilation.md). Every `@Component` has exactly one template, supplied inline as a template literal (`template: \`...\``) or from an external file (`templateUrl`), and everything a template can express ultimately falls into a handful of categories: interpolation (rendering an expression's value as text), bindings (connecting a DOM property, attribute, class, or style to a component expression), event bindings (wiring a DOM/component event to a handler method), and structural control flow (conditionally or repeatedly rendering chunks of the template).

The binding syntaxes are distinct and easy to confuse if you haven't internalized *what* each one targets. Interpolation, `{{ expression }}`, renders a value as text content. Property binding, `[property]="expression"`, sets a DOM element *property* (not the HTML attribute) — important because some properties and their same-named attributes diverge after the initial render (`value` on an `<input>` being the classic example: the attribute reflects the initial value, the property reflects the live one). Attribute binding, `[attr.name]="expression"`, is for the rarer case where you need to set an actual HTML attribute that has no corresponding DOM property (like `aria-*` or `colspan`). Class and style bindings, `[class.foo]="expr"` and `[style.color]="expr"`, toggle individual classes or set individual style properties conditionally. Event binding, `(event)="handler($event)"`, listens for a DOM or custom component event and invokes a method.

For repeating or conditionally rendering whole chunks of template, Angular historically used *structural directives* — `*ngIf`, `*ngFor`, `*ngSwitch` — which are directives applied with the `*` microsyntax prefix that Angular desugars into an `<ng-template>` wrapping the element (e.g., `*ngIf="cond"` becomes an `<ng-template [ngIf]="cond">` around the element). Since Angular 17, the *built-in control flow* — `@if`/`@else if`/`@else`, `@for ... track`, and `@switch`/`@case`/`@default` — is the preferred syntax: it's block-based (not a directive), doesn't require importing `CommonModule`/`NgIf`/`NgFor`, compiles to more efficient instructions, and for `@for` *requires* an explicit `track` expression (Angular's equivalent of React's `key`) to identify items across re-renders, which structural `*ngFor`'s optional `trackBy` function made easy to forget. Both syntaxes are valid and coexist in real codebases; the new control flow is recommended for new code but `*ngIf`/`*ngFor` remain fully supported and pervasive in existing code.

Two other template primitives round out the picture. `<ng-template>` defines a chunk of markup that isn't rendered by default — it's a template *reference*, only materialized into the DOM when something explicitly instantiates it (a structural directive, or programmatically via `ViewContainerRef` — see views.md). `<ng-container>` is a logical, non-rendering grouping element: it lets you apply a structural directive or group siblings without introducing an actual wrapper DOM node (unlike a `<div>`, it leaves zero trace in the rendered output), which matters when an extra wrapper element would break CSS layout (flex/grid children) or semantics (inside a `<table>`). `ng-content` is different again — it's Angular's content projection mechanism, a placeholder inside a component's own template marking where a *parent's* projected content (passed between the component's opening/closing tags, like `<app-card>...this content...</app-card>`) should be rendered, enabling reusable "shell" components (cards, modals, layout wrappers) that don't know their content ahead of time. Template reference variables, `#ref`, name a DOM element or directive instance within the template so other bindings/handlers in the same template can reference it directly (e.g., `<input #nameInput>` then `(click)="save(nameInput.value)"`), without needing `@ViewChild` for purely template-local access.

## Examples

```html
<!-- Interpolation, property/attribute/class/style/event binding, template ref var -->
<h2>{{ user.name }}</h2>                               <!-- interpolation: renders text -->
<img [src]="user.avatarUrl" [alt]="user.name" />        <!-- property binding -->
<td [attr.colspan]="columnCount"></td>                  <!-- attribute binding: no DOM property exists -->
<div [class.active]="isSelected" [style.color]="isSelected ? 'blue' : null"></div>
<input #nameInput [value]="user.name" (input)="onNameChange(nameInput.value)" />
<button (click)="save()">Save</button>                  <!-- event binding -->
```

This shows all five binding categories side by side with the exact syntax that distinguishes them — note `[value]` (a live DOM property) vs `[attr.colspan]` (a real attribute that has no corresponding element property to bind to).

```html
<!-- Modern built-in control flow (Angular 17+), no directive imports needed -->
@if (user(); as u) {
  <app-user-card [user]="u" />
} @else if (isLoading()) {
  <app-spinner />
} @else {
  <p>No user found.</p>
}

@for (item of cartItems(); track item.id) {
  <app-cart-line [item]="item" />
} @empty {
  <p>Your cart is empty.</p>
}

@switch (status()) {
  @case ('pending') { <app-badge text="Pending" /> }
  @case ('shipped') { <app-badge text="Shipped" /> }
  @default { <app-badge text="Unknown" /> }
}
```

`@for` requires `track item.id` (falling back to `track $index` only when no stable identity exists) so Angular can correctly diff and reuse DOM nodes across re-renders instead of tearing down and recreating the whole list; `@if...as` captures the truthy value into a local template variable, a common pattern for async/nullable data.

```html
<!-- ng-template, ng-container, and ng-content together -->
<ng-container *ngIf="showDetails; else collapsedTpl">
  <p>Full details go here, with no extra wrapper element in the DOM.</p>
</ng-container>
<ng-template #collapsedTpl>
  <p>Click to expand.</p> <!-- not rendered until *ngIf references it -->
</ng-template>

<!-- Inside a reusable app-card component's own template: -->
<div class="card">
  <header><ng-content select="[card-title]" /></header>
  <section><ng-content /></section> <!-- default slot: anything not matched above -->
</div>
<!-- Usage: <app-card><h3 card-title>Title</h3><p>Body content</p></app-card> -->
```

`<ng-container>` groups the conditional content with zero DOM footprint, `<ng-template>` supplies the alternate branch that `*ngIf`'s `else` instantiates only when needed, and `ng-content` with a `select` attribute demonstrates named content projection slots inside a reusable shell component.

## Common Pitfalls / Gotchas

- Confusing property binding `[value]="x"` with attribute binding — for most standard DOM properties (`value`, `checked`, `disabled`, `src`), `[property]` binding is correct and keeps the *live* DOM state in sync; reaching for `[attr.value]` instead usually only sets the initial attribute and won't reflect subsequent changes the same way.
- Forgetting `track` in `@for` (or `trackBy` in `*ngFor`) when list items are objects that get replaced by new references on every data refresh — without stable tracking, Angular may destroy and recreate DOM nodes (and any component state inside them, like open dropdowns or focus) unnecessarily on every update instead of reusing them.
- Reaching for a `<div>` to group structural-directive siblings and accidentally breaking CSS Grid/Flexbox layout (an extra wrapper becomes an unintended flex/grid item) or table semantics (a `<div>` isn't a valid direct child of `<table>`) — `<ng-container>` avoids this because it never renders any element.
- Assuming `<ng-content>` re-renders/updates projected content reactively the same way a normal binding does — projected content is compiled in the *parent's* context, using the parent's bindings and change detection, not the child's; it's genuinely just relocated DOM, not re-evaluated by the child component.
- Mixing new `@if`/`@for` control flow and old `*ngIf`/`*ngFor` directives inconsistently across a codebase without a clear migration plan — both work, but standalone components using the new blocks don't need to import `NgIf`/`NgFor`/`CommonModule`, while ones still using `*ngIf`/`*ngFor` do, so half-migrated files can have surprising/missing imports.
- Using a template reference variable (`#ref`) across structural directive boundaries where it isn't actually in scope — `#ref` is only visible within the same template/embedded view, so referencing it from inside a different `*ngIf`/`@if` block or a projected `<ng-content>` region often silently fails to resolve.

## Interview Questions & Answers

**Q: What's the actual difference between property binding and attribute binding, and when do you need the latter?**
A: Property binding (`[prop]="expr"`) sets a live DOM object property, which is what the rendered element actually reflects and what most interactive behavior (an input's current value, whether a checkbox is checked) depends on after initial render. Attribute binding (`[attr.name]="expr"`) sets the actual HTML attribute in the DOM tree, which is necessary specifically when there's no corresponding DOM property to bind to — ARIA attributes (`aria-label`, `aria-expanded`), `colspan`/`rowspan` on table cells, or custom/SVG attributes. For anything that has a real DOM property (`value`, `checked`, `disabled`, `src`, `textContent`), property binding is preferred because it reflects live state, not just the initial render.

**Q: Why does the new `@for` control-flow block require a `track` expression while `*ngFor`'s `trackBy` was optional?**
A: Because omitting stable item identity was a very common and easy-to-miss performance/state-preservation bug with `*ngFor` — without `trackBy`, Angular fell back to comparing by object identity/index, which meant that swapping in a new array of otherwise-identical-looking objects (e.g., after a fresh API fetch) caused Angular to destroy and recreate every DOM node and child component instance instead of diffing and reusing them. Making `track` a required part of `@for`'s syntax forces you to make a deliberate choice (an id field, or explicitly `track $index` when no stable identity exists) rather than silently falling into worst-case behavior.

**Q: How is `<ng-container>` different from just using a `<div>` to group structural-directive content?**
A: `<ng-container>` is a purely logical grouping construct — Angular strips it from the rendered output entirely, so it leaves no DOM element behind. A `<div>` is a real element, which can break CSS layout (an unexpected extra flex/grid item), break structural HTML constraints (invalid inside `<table>`/`<select>`), or interfere with styling that assumes specific parent-child relationships. `<ng-container>` is exactly what you reach for when you need to apply `*ngIf`/`*ngFor` (or their `@if`/`@for` block equivalents don't have this problem at all, since they're not directives) to a group of sibling elements without introducing a wrapper.

**Q: Explain what `<ng-content>` does and one thing people commonly get wrong about it.**
A: `<ng-content>` is a placeholder in a component's own template marking where content the *parent* projects between that component's tags should be rendered — it enables building generic wrapper/shell components (cards, dialogs, layout containers) whose content the component itself never needs to know about. The common mistake is assuming the projected content runs in the child component's context (with access to the child's own properties/change detection scope) — it doesn't; projected content is evaluated against the *parent's* component instance and bindings, since it was authored inside the parent's template, and it's only relocated (not re-compiled) into the child's DOM position.

**Q: When would you reach for a template reference variable (`#ref`) instead of `@ViewChild`?**
A: Template reference variables are the right tool when you need to reference an element or directive *from within the same template*, for use in another binding or event handler right there — e.g., reading an `<input>`'s value in a `(click)` handler on a sibling button, without round-tripping through the component class at all. `@ViewChild` is for when the component *class* itself needs a handle to that element/directive/component instance — for imperative access in TypeScript code (calling a method on a child component, reading a native element in `ngAfterViewInit`), which a template-local `#ref` variable cannot provide since it isn't accessible outside the template.

## Related Topics

- [components.md](./components.md)
- [data-binding.md](./data-binding.md)
- [directives.md](./directives.md)
- [interpolation.md](./interpolation.md)
- [views.md](./views.md)
- [pipes.md](./pipes.md)
