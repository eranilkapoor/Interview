# Property Binding

Property binding uses `[property]="expression"` syntax to set an actual DOM element property, a directive property, or a component's `@Input()` — not an HTML attribute. This distinction is the single most important thing to understand about property binding and is a frequent interview trip-up: HTML *attributes* are what you write in markup and are used to initialize the DOM, while DOM *properties* are the live JavaScript object fields on the resulting element node. They usually start in sync (the browser reads the attribute and sets a matching initial property value) but they can diverge at runtime, and once they diverge, only the property reflects the element's actual current state. Property binding always targets the property side of that relationship.

The classic illustration is `disabled` on a button. `<button disabled>` sets the attribute, which the browser uses to initialize `button.disabled = true`. But if you later do `button.removeAttribute('disabled')`, the DOM property doesn't necessarily revert, and conversely some properties (like `value` on an `<input>`) don't reflect back to their attribute at all once the user types — `input.getAttribute('value')` stays at its initial value forever while `input.value` tracks what's actually in the box. Angular's `[disabled]="isDisabled"` binds directly to the JS property, so it always reflects the current boolean, correctly enabling/disabling the control as `isDisabled` changes — writing `disabled="{{isDisabled}}"` (attribute-style interpolation) would instead always produce a non-empty string attribute, which HTML treats as truthy regardless of whether the string is `"true"` or `"false"`, silently disabling the button permanently.

The same category of bug shows up with `<img [src]="url">` vs `<img src="{{url}}">`. Interpolating directly into `src` as a string attribute works for basic display, but if `url` is momentarily empty or `undefined` during change detection (e.g. before an async value resolves), the browser may attempt to fetch a literal empty-string or `"undefined"` URL, sometimes causing a spurious request to the page's own origin. Using `[src]="url"` binds the property directly and Angular skips setting it when the value is falsy in ways that avoid that class of extra request, which is why Angular's own style guide and linters (and `NG02100`-style runtime warnings for unsafe URL-like attributes) push you toward property binding for anything URL-like, and outright require it for security-sensitive properties.

Property binding also targets custom `@Input()`s (or `input()` signal inputs) on child components exactly the same way it targets native DOM properties — `[appMyDirective]="config"` or `<app-child [items]="list">` use identical syntax whether the target is a native DOM property or a property your own component explicitly declared as bindable. That symmetry is intentional: from the template's perspective there's no difference between "setting a native DOM property" and "setting a component's public input" — both are just "setting a property on the thing this selector refers to."

## Examples

```ts
import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-login-form',
  standalone: true,
  template: `
    <!-- Binds to the real DOM property, so it correctly reflects boolean state -->
    <button [disabled]="isSubmitting()">Log in</button>

    <!-- Binds to the img element's `src` property, not the src attribute -->
    <img [src]="avatarUrl()" [alt]="username()" />

    <!-- Property binding onto a custom component's @Input() -->
    <app-user-badge [user]="currentUser()" [highlighted]="isVip()" />
  `,
})
export class LoginFormComponent {
  isSubmitting = signal(false);
  avatarUrl = signal<string | undefined>(undefined); // safe: no request fired while undefined
  username = signal('anil');
  currentUser = signal({ id: 1, name: 'Anil' });
  isVip = signal(true);
}
```

This shows property binding used identically for a native boolean property, a native `src` property, and a custom component's `@Input()`s — all three use the same `[ ]` syntax because they're all "properties" from Angular's perspective.

```ts
// The disabled attribute-vs-property bug, made concrete
@Component({
  selector: 'app-disabled-demo',
  standalone: true,
  template: `
    <!-- WRONG: always renders a non-empty (truthy) attribute string, button stays disabled -->
    <button disabled="{{ canSubmit() }}">Submit A</button>

    <!-- RIGHT: binds the boolean property directly -->
    <button [disabled]="!canSubmit()">Submit B</button>
  `,
})
export class DisabledDemoComponent {
  canSubmit = signal(true);
}
```

Button A stays permanently disabled once `canSubmit()` becomes `false` because HTML treats any non-empty `disabled` attribute value — including the string `"false"` — as disabled; button B behaves correctly because `[disabled]` sets the underlying boolean DOM property, not a string attribute.

```ts
// Receiving a property binding on the child side via @Input() / input()
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-user-badge',
  standalone: true,
  template: `<span [class.vip]="highlighted()">{{ user().name }}</span>`,
})
export class UserBadgeComponent {
  user = input.required<{ id: number; name: string }>();
  highlighted = input(false);
}
```

This is the receiving end of `[user]="currentUser()"` and `[highlighted]="isVip()"` from the first example — the modern `input()` signal function is the equivalent of the classic `@Input()` decorator, just backed by a signal instead of a plain class field.

## Common Pitfalls / Gotchas

- Confusing attributes and properties — `[prop]` binds a live DOM/JS property, while a plain HTML attribute (or naive string interpolation into one) only sets the initial value and doesn't track subsequent state, which is exactly what causes the classic `disabled="{{cond}}"` bug.
- Using `[src]`/`[href]`/similar with a value that can be `null`/`undefined`/empty during a render cycle before an async value resolves — Angular's sanitizer will flag certain unsafe URL bindings, and unbound/empty `src` can still trigger a stray network request in some browsers if not handled carefully (e.g. via `*ngIf`/`@if` to avoid rendering the tag until the URL is ready).
- Trying to property-bind to something that has no corresponding DOM property (e.g. `[colspan]` on a `<td>`, or `[aria-label]`) — this silently fails or throws a template error like "Can't bind to 'colspan' since it isn't a known property," because `colspan` and ARIA attributes have no JS property counterpart; that's exactly the case attribute binding (`[attr.colspan]`) exists for. See [attribute-binding.md](./attribute-binding.md).
- Forgetting that binding a non-primitive object reference (`[user]="userObj"`) only triggers change detection on reference change, not on mutation of the object's internal fields — mutating `userObj.name = 'x'` in place won't be picked up the same way reassigning `userObj = {...userObj, name: 'x'}` would be flagged by `OnPush` change detection.
- Assuming property binding syntax and custom `@Input()` aliasing always match the template name — `@Input('customName') internalName` means the template must bind `[customName]`, not `[internalName]`, which trips people up when refactoring.

## Interview Questions & Answers

**Q: What's the difference between an HTML attribute and a DOM property, and why does it matter for Angular property binding?**
A: The attribute is what's written in the markup and is used only to set the element's *initial* state when the browser parses it; the property is the live field on the resulting DOM object in memory. They start in sync but can diverge — e.g. typing into an `<input>` updates `input.value` (the property) without touching `input.getAttribute('value')` (the attribute, frozen at its initial value). Angular's `[prop]="expr"` binds to the property side, so it always reflects current state, which is what you almost always want; attribute binding (`[attr.x]`) exists specifically for the minority of cases where there's no property to bind to.

**Q: Why does `<button disabled="{{isDisabled}}">` behave incorrectly, and what should you use instead?**
A: HTML treats the mere *presence* of the `disabled` attribute as meaning disabled, regardless of its string value — so `disabled="false"` is still disabled, because the attribute is present with a non-empty value. Interpolating into the attribute string always produces a non-empty string, so the button ends up permanently disabled once that code path runs. `[disabled]="isDisabled"` avoids this because it sets the actual boolean DOM property, and Angular removes/adds the reflected attribute correctly based on the boolean.

**Q: Can property binding target a custom `@Input()` on a child component the same way it targets a native DOM property?**
A: Yes, and that's by design — `[items]="list"` on `<app-child [items]="list">` uses identical `[ ]` syntax whether `items` is a native property like `disabled` or a custom `@Input()`/`input()` the child component declared. Angular resolves at compile time whether the target is a known DOM property, a directive/component input, or neither (in which case it's a template compile error).

**Q: What happens if you try to `[colspan]="n"` on a `<td>`? Why does it fail, and what's the fix?**
A: It throws a template compile-time error because `colspan` has no corresponding DOM element property — it only exists as an HTML attribute. Property binding can only target real JS properties, so the fix is attribute binding: `[attr.colspan]="n"`, which writes directly to the attribute instead of looking for a nonexistent property.

**Q: Does binding an object via property binding (`[user]="userObj"`) react to deep mutations of that object?**
A: Not automatically, and especially not under `OnPush` change detection. Angular's default change detection compares by reference (dirty-checking on each cycle re-renders regardless, but `OnPush` components specifically only re-run when an `@Input()` reference changes, a signal it reads changes, or an event fires inside the component). Mutating `userObj.name` in place doesn't create a new reference, so an `OnPush` child bound via `[user]="userObj"` may not re-render; the idiomatic fix is to treat inputs as immutable and pass a new object/array reference (or, better, use signals so dependency tracking is automatic and precise regardless of change-detection strategy).

## Related Topics

- [data-binding.md](./data-binding.md)
- [attribute-binding.md](./attribute-binding.md)
- [interpolation.md](./interpolation.md)
- [input-decorator.md](./input-decorator.md)
- [class-binding.md](./class-binding.md)
- [style-binding.md](./style-binding.md)
