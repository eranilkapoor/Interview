# @Input Decorator

`@Input()` is the mechanism for passing data from a parent component down to a child component — it marks a class property as bindable from outside, so a parent template can write `<app-child [title]="parentTitle">` and Angular copies the value of `parentTitle` into the child's `title` property whenever it changes. This is the backbone of Angular's unidirectional, top-down data flow: parents own state and pass it down as inputs; children never reach up and mutate a parent's data directly (that's what `@Output()` is for, going the other direction). Historically `@Input()` is a property decorator applied to a class field, and Angular's compiler generates the binding metadata needed to wire it up at template-compile time.

Angular 17.1 introduced a second, signal-based way to declare inputs: the `input()` function, used as a class field initializer instead of a decorator — `title = input<string>('default')`. This isn't just syntax sugar; `input()` returns a `Signal<T>`, so reading the value inside the component requires calling it as a function (`this.title()`) rather than accessing it as a plain property, and because it's a signal, it composes directly with `computed()` and `effect()` without needing `ngOnChanges` or manual change-detection plumbing to react to updates. The signal-based form is now the recommended default for new code because it integrates with Angular's broader move to signals for reactivity (replacing Zone.js-based change detection triggers with fine-grained signal dependency tracking), and it makes required-ness and transforms part of the type system rather than something checked at runtime.

Both forms support marking an input as required. With the decorator, `@Input({ required: true }) userId!: string;` tells the compiler to error if a template using this component doesn't provide a binding for `userId` — this is a compile-time template-type-checking guarantee, not a runtime check, so it only catches mistakes if strict template type checking is enabled. With signals, `userId = input.required<string>()` achieves the same compile-time enforcement, but additionally the *type* returned is `Signal<string>` rather than `Signal<string | undefined>`, so TypeScript itself understands the value can never be undefined once the component is used correctly — with the plain (non-required) `input()`, the returned signal's type includes `undefined` unless you supply a default value as the function's argument.

Both forms also support **transforms** and **aliasing**. A transform lets you convert the raw value passed from the template into a different shape before it's stored — the classic example is accepting either a boolean attribute or a string and coercing it: `@Input({ transform: booleanAttribute }) disabled = false;` (using Angular's built-in `booleanAttribute`/`numberAttribute` transform functions) or with signals, `disabled = input(false, { transform: booleanAttribute });`. This solves the long-standing problem where a plain HTML-style attribute like `<app-button disabled>` (with no value, or a string value) needs to become an actual `boolean` inside the component. Aliasing renames the public binding name without renaming the internal property: `@Input('userTitle') title: string;` lets the template bind `[userTitle]="x"` while the class refers to `this.title`; the equivalent with signals is `title = input<string>('', { alias: 'userTitle' });`.

`ngOnChanges` is a lifecycle hook specific to `@Input()`-decorated properties (the decorator-based form, not signals) — it fires once before the first `ngOnInit` and again on every subsequent change detection cycle in which one or more `@Input()`-bound values changed, receiving a `SimpleChanges` object that maps each changed input's name to its previous and current value plus a `firstChange` flag. It's the way to react to *which* input changed and what it changed *from*, which plain property access can't tell you. Signal inputs don't need `ngOnChanges` for the common case of "run something when this value changes" — you'd typically use `effect(() => { ... this.someInput() ... })` or `computed()` instead — though `ngOnChanges` still fires for signal inputs too, since it's driven by Angular's underlying change-detection input-setting mechanism regardless of which API declared the input.

## Examples

```ts
import { Component, Input, OnChanges, SimpleChanges, booleanAttribute } from '@angular/core';

// Class-based @Input(), still extremely common in real codebases.
@Component({
  selector: 'app-user-card',
  standalone: true,
  template: `<div [class.disabled]="disabled">{{ displayName }}</div>`,
})
export class UserCardComponent implements OnChanges {
  @Input({ required: true }) userId!: string;

  // Aliased: template writes [cardTitle], class refers to `title`.
  @Input('cardTitle') title = '';

  // Transform: <app-user-card disabled> or [disabled]="someBoolean" both coerce to a real boolean.
  @Input({ transform: booleanAttribute }) disabled = false;

  displayName = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['userId'] && !changes['userId'].firstChange) {
      console.log(`userId changed from ${changes['userId'].previousValue} to ${changes['userId'].currentValue}`);
    }
  }
}
```
This shows the decorator-based form: a required input that fails template type-checking if unbound, an aliased input, a boolean-coercing transform, and `ngOnChanges` inspecting exactly what changed via `SimpleChanges`.

```ts
import { Component, input, computed, effect } from '@angular/core';

// Signal-based inputs (Angular 17.1+) — the modern recommended approach.
@Component({
  selector: 'app-price-tag',
  standalone: true,
  template: `<span>{{ formattedPrice() }}</span>`,
})
export class PriceTagComponent {
  // Required signal input — type is Signal<number>, never undefined.
  amount = input.required<number>();

  // Optional signal input with a default value — type is Signal<string>.
  currency = input<string>('USD');

  // computed() derives from input signals automatically — no ngOnChanges needed.
  formattedPrice = computed(() =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currency() }).format(this.amount())
  );

  constructor() {
    // effect() re-runs whenever amount() or currency() changes, same as ngOnChanges
    // would have told you "amount changed" but without manual diffing.
    effect(() => {
      console.log(`Price updated: ${this.amount()} ${this.currency()}`);
    });
  }
}
```
This demonstrates signal inputs composing directly with `computed()` (a derived, memoized value) and `effect()` (a side effect that reruns on dependency change) with no `ngOnChanges` boilerplate — reading `this.amount()` as a function call is the key syntactic difference from the decorator form.

```ts
// Parent template using both components — the binding syntax is identical
// regardless of whether the child uses @Input() or input() internally.
```
```html
<app-user-card [userId]="currentUser.id" [cardTitle]="'Profile'" disabled></app-user-card>
<app-price-tag [amount]="product.price" currency="EUR"></app-price-tag>
```
The template consumer doesn't know or care whether the child implemented its inputs with decorators or signals — the external binding syntax `[prop]="expr"` (or a static attribute for transformed booleans) is exactly the same either way.

## Common Pitfalls / Gotchas

- Forgetting that signal inputs must be *called* to read their value (`this.amount()`), not accessed as a plain property (`this.amount`) — accessing it without calling returns the `Signal` function object itself, a very easy mistake when migrating code from `@Input()`.
- Relying on `@Input({ required: true })` as a runtime guarantee — it's a compile-time template-type-checking error only; if strict template checking is off, or the component is constructed programmatically (e.g., via `ViewContainerRef.createComponent`) rather than through a template binding, nothing prevents the input from actually being `undefined` at runtime.
- Mutating an object/array passed in via `@Input()` directly inside the child — since JS objects are passed by reference, mutating it affects the parent's original data too, which breaks the unidirectional-data-flow mental model and can cause confusing change-detection bugs, especially with `OnPush`.
- Expecting `ngOnChanges` to fire for *every* input change immediately — it only runs during Angular's change detection cycle, and with signal inputs specifically, relying on `ngOnChanges` instead of `effect()`/`computed()` forfeits the fine-grained reactivity signals are meant to provide.
- Forgetting the transform function's signature constraints — a transform can only narrow/coerce the *input* type to the *stored* type in one direction (e.g., `string | boolean → boolean`), and mismatched transform types produce confusing compiler errors.
- Assuming an aliased input's internal property name still works as a template binding name — once aliased with `@Input('cardTitle')` or `input(..., { alias: 'cardTitle' })`, the template must use `[cardTitle]`, not `[title]`; binding by the old internal name fails silently to bind (it just doesn't exist as a public binding).

## Interview Questions & Answers

**Q: What's the fundamental difference between `@Input()` and the newer `input()` function?**
A: `@Input()` is a property decorator on a plain class field — you read its current value as a normal property access, and Angular's change detection (traditionally Zone.js-triggered) updates it and can notify you of changes via `ngOnChanges`. `input()` is a function called as a field initializer that returns a `Signal<T>` — you read the value by calling it (`this.prop()`), and it integrates directly with Angular's signal-based reactivity primitives (`computed()`, `effect()`) without needing `ngOnChanges` for the common case of reacting to changes. Both achieve the same purpose — parent-to-child data binding — but `input()` is the modern, signals-oriented API introduced in Angular 17.1.

**Q: How do you make an input required, and what guarantee does that actually give you?**
A: With decorators, `@Input({ required: true }) prop!: T;`; with signals, `prop = input.required<T>();`. Both cause a *compile-time* error if a template uses the component without binding that input — it's enforced by Angular's template type checker, not by a runtime check. The signal version additionally improves the TypeScript type itself: `input.required<T>()` returns `Signal<T>` (never possibly `undefined`), whereas the non-required `input<T>()` without a default returns `Signal<T | undefined>`, so the required-ness is reflected in the type system, not just a template-compiler diagnostic.

**Q: What does an `@Input()` transform do, and when would you use one?**
A: A transform is a function specified via `@Input({ transform: fn })` (or as `input()`'s second argument's `transform` option) that converts the raw value bound in the template into the type actually stored on the property, running at binding time before the property is set. The canonical use case is coercing HTML-attribute-style boolean/number inputs — e.g., `booleanAttribute` so `<app-button disabled>` (attribute present, no value, or a string) becomes a real `boolean`, and `numberAttribute` so a string like `"5"` passed as a plain attribute becomes the number `5` — without every consumer needing to remember to bind `[disabled]="true"` explicitly.

**Q: When does `ngOnChanges` fire, and what information does it give you that a plain property read doesn't?**
A: It fires once before the first `ngOnInit` (if any input is bound) and again on every subsequent change-detection run where at least one `@Input()`-bound property changed. It receives a `SimpleChanges` object keyed by input property name, where each entry has `previousValue`, `currentValue`, and a `firstChange` boolean — letting you distinguish the initial set from a genuine change, and see exactly what changed from what, which you can't get from simply reading the current property value.

**Q: Why can't you just mutate the object passed into a child via `@Input()` and expect clean, predictable behavior?**
A: JavaScript objects and arrays are passed by reference, so an `@Input()` bound to a parent's object gives the child a reference to the *same* object the parent holds — mutating a property on it inside the child also changes the parent's data, silently, without going through any `@Output()` or explicit API, and without the parent ever "deciding" to allow that change. This breaks Angular's intended unidirectional data flow (data down via inputs, events up via outputs) and can cause particularly confusing bugs with `OnPush` change detection, which by default only checks for input *reference* changes — so a mutation that doesn't change the object reference might not even trigger the child to re-render, even though the underlying data changed.

## Related Topics

- [output-decorator.md](./output-decorator.md)
- [data-binding.md](./data-binding.md)
- [components.md](./components.md)
- [life-cycle-hooks.md](./life-cycle-hooks.md)
- [property-binding.md](./property-binding.md)
