# Event Binding

Event binding is Angular's mechanism for reacting to things that happen in the view — a click, a keystroke, a form submission, or a custom event a child component emits — and running component-class logic in response. The syntax is `(eventName)="statement"`, parentheses signaling that data flows from the view to the component, the opposite direction of property binding's `[ ]`. This is the one-way, view-to-component half of Angular's binding system, and it's what makes `[(ngModel)]`'s two-way syntax possible under the hood: `[(ngModel)]="value"` is literally sugar for `[ngModel]="value" (ngModelChange)="value = $event"`, a property binding and an event binding fused together.

Inside the event-binding expression, the special `$event` variable gives access to the event payload. For a native DOM event (`(click)`, `(input)`, `(keydown)`), `$event` is the browser's native `Event`/`KeyboardEvent`/`MouseEvent` object. For a custom component `@Output()`/`output()` event, `$event` is whatever value was passed to `.emit(value)` — Angular treats native DOM events and custom component outputs through the identical `(eventName)="handler($event)"` syntax, which is precisely what lets components expose event-driven APIs that feel native. Angular also supports binding to global targets with a target prefix — `(document:click)`, `(window:resize)`, `(window:scroll)` — routing the listener to `document`/`window` instead of the host element, and key-modifier filtering on keyboard events, e.g. `(keydown.enter)`, `(keydown.escape)`, `(keydown.control.s)`, which lets you skip manually checking `event.key` in the handler.

A subtlety worth internalizing: unlike raw `addEventListener` callbacks in vanilla JS — where `this` inside the callback is often *not* the class instance unless you explicitly `.bind(this)` or use an arrow function — Angular's template compiler generates the event-handling code itself and always calls your handler with the correct component instance as context, so `this` inside a method invoked from an event binding behaves as expected without any manual binding. Angular also, by default, wraps event-handler execution so it runs inside Angular's zone (via Zone.js), which is what lets Angular know a change may have occurred and triggers change detection afterward — this is also the underlying reason `(click)="doSomethingExpensive()"` handlers can indirectly trigger app-wide change-detection checks.

## Examples

```ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-counter',
  standalone: true,
  template: `
    <button (click)="increment()">+</button>
    <span>{{ count }}</span>
    <button (click)="decrement()">-</button>
  `,
})
export class CounterComponent {
  count = 0;
  increment(): void { this.count++; }
  decrement(): void { this.count--; }
}
```
The simplest form: `(click)` binds a native DOM event directly to a component method, no `$event` needed since the handler doesn't care about the click details.

```ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-search-box',
  standalone: true,
  template: `<input (input)="onInput($event)" (keydown.escape)="clear()" placeholder="Search..." />`,
})
export class SearchBoxComponent {
  query = '';

  onInput(event: Event): void {
    // $event is the native InputEvent; the actual typed value lives on event.target.
    const target = event.target as HTMLInputElement;
    this.query = target.value;
  }

  clear(): void {
    this.query = '';
  }
}
```
`(input)` captures every keystroke with `$event` as the native `Event`, requiring a manual cast to read `.value`; `(keydown.escape)` shows Angular's key-modifier syntax filtering the handler to fire only on the Escape key, with no manual `event.key === 'Escape'` check needed.

```ts
import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-rating',
  standalone: true,
  template: `
    @for (star of [1,2,3,4,5]; track star) {
      <span (click)="rate(star)">{{ star <= value ? '★' : '☆' }}</span>
    }
  `,
})
export class RatingComponent {
  value = 0;
  @Output() rated = new EventEmitter<number>();

  rate(star: number): void {
    this.value = star;
    this.rated.emit(star); // consumed by a parent exactly like a native event
  }
}
```
```html
<!-- Parent template: -->
<app-rating (rated)="onRated($event)"></app-rating>
```
This shows a custom component `@Output()` consumed with the exact same `(eventName)="handler($event)"` syntax as a native DOM event — `$event` here is the number passed to `.emit()`, not a DOM `Event` object.

## Common Pitfalls / Gotchas

- Forgetting that `$event` for a native DOM event is the raw browser event object, not the value — you must read `($event.target as HTMLInputElement).value`, a common source of `any`-typed or subtly-broken handlers when the cast is skipped.
- Calling expensive logic directly inline in the template (`(click)="items = items.filter(x => expensiveCheck(x))"`) instead of delegating to a component method — inline template expressions are harder to test, harder to debug, and easy to accidentally make impure.
- Using `(input)` when `(change)` was intended, or vice versa — `(input)` fires on every keystroke/edit, `(change)` fires only when the element loses focus after its value changed; picking the wrong one causes either excessive re-renders or missed real-time updates.
- Binding `(window:scroll)`/`(document:click)` style global listeners without realizing Angular attaches and removes them automatically with the component's lifecycle — but doing the equivalent manually with `window.addEventListener` in `ngOnInit` requires manually removing it in `ngOnDestroy`, or it leaks.
- Assuming an `@Output()` name and its corresponding `@Input()` name must differ — `[(ngModel)]`-style two-way binding sugar specifically requires the output to be named `<inputName>Change` (e.g. `value` input + `valueChange` output) for `[(value)]` shorthand to work; mismatched naming silently breaks the two-way sugar (though the two separate bindings still work individually).

## Interview Questions & Answers

**Q: What's the difference between `$event` when binding to a native DOM event versus a custom component `@Output()`?**
A: For a native DOM event like `(click)` or `(input)`, `$event` is the browser's native event object (`MouseEvent`, `KeyboardEvent`, `Event`), and you typically need to read a property off it (`$event.target.value`, `$event.key`). For a custom `@Output()`/`output()`, `$event` is whatever value the child component passed to `.emit(value)` — it can be any type the emitter is declared with (`EventEmitter<number>`, `EventEmitter<{id: string}>`, etc.), not a DOM event at all. Angular's template syntax treats both identically, which is intentional — it's what makes custom components feel like native elements.

**Q: How does `[(ngModel)]` relate to event binding?**
A: `[(ngModel)]="value"` is syntactic sugar that combines a property binding and an event binding: it desugars to `[ngModel]="value" (ngModelChange)="value = $event"`. The `NgModel` directive both sets the DOM element's value from `value` (property binding, component→view) and emits an `ngModelChange` event whenever the user edits it (event binding, view→component), and the "banana in a box" syntax is just shorthand for writing both halves.

**Q: Why doesn't Angular require you to manually `.bind(this)` inside an event-binding handler, unlike some vanilla JS event listener patterns?**
A: Angular's template compiler generates the code that invokes your handler; it isn't a raw `addEventListener(this.handler)` call where `this` would depend on how the function reference was passed around. The compiler-generated listener code always calls the method as `component.handler($event)`, so `this` inside the method is reliably the component instance, with no arrow-function or manual `.bind()` workaround needed.

**Q: What are key-modifier event bindings, and why use them instead of checking `$event.key`?**
A: Syntax like `(keydown.enter)`, `(keydown.escape)`, or `(keydown.control.s)` lets Angular filter which keyboard events actually invoke the handler, based on the key (and optional modifier keys) in the binding name itself. It's purely a readability/conciseness win — `(keydown.escape)="close()"` reads as intent directly in the template, versus a handler body that starts with `if ($event.key !== 'Escape') return;`, though both approaches are functionally equivalent.

**Q: How would you listen for a `window` resize event from inside a component, and why is `(window:resize)` template syntax often preferable to `ngOnInit`/`ngOnDestroy` with manual `addEventListener`?**
A: `<div (window:resize)="onResize($event)">` binds directly to the `window` object's `resize` event from the template, and Angular automatically manages the listener's lifecycle — attaching it when the component is created and removing it when destroyed. The manual alternative (`window.addEventListener('resize', this.handler)` in `ngOnInit`) requires you to remember the matching `window.removeEventListener` call in `ngOnDestroy` yourself, and forgetting it is a common source of leaked listeners referencing destroyed components.

## Related Topics

- [data-binding.md](./data-binding.md)
- [property-binding.md](./property-binding.md)
- [output-decorator.md](./output-decorator.md)
- [templates.md](./templates.md)
- [life-cycle-hooks.md](./life-cycle-hooks.md)
