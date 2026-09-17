# Output Decorator

`@Output()` is how a component declares events it emits outward, giving a parent a way to react to something that happened inside a child without the child needing any knowledge of who's listening or what they'll do. Paired with `@Input()`, it forms Angular's core component communication contract: data flows down into a component through `@Input()`s, and notable events flow back up through `@Output()`s — a deliberate, explicit, unidirectional pattern that keeps components decoupled and testable, since a component's entire public API is visible just by reading its `@Input`/`@Output` declarations.

Mechanically, `@Output()` marks a class property — conventionally typed `EventEmitter<T>` — as externally bindable; the parent then listens for it with ordinary event-binding syntax, `(eventName)="handler($event)"`, exactly as if it were a native DOM event. `EventEmitter<T>` extends RxJS's `Subject<T>`, so it technically supports `.subscribe()` for programmatic use, but in idiomatic Angular code you almost never subscribe to it directly from TypeScript — you consume it declaratively via the template's event binding, letting Angular manage the subscription lifecycle for you. Calling `.emit(value)` synchronously notifies whatever the parent bound the event to.

Angular 17.3 introduced `output()`, a function-based alternative intended as a lighter-weight, more explicit-by-signature replacement for `@Output() x = new EventEmitter<T>()`. `output<T>()` returns an `OutputEmitterRef<T>` with an `.emit(value)` method — the template-consumption side is identical (`(eventName)="handler($event)"`), but internally it isn't itself a full RxJS `Subject`, and it's explicitly documented as intended for simple emit-and-forget events rather than a general-purpose Observable stream; you can still bridge it into RxJS-land with the `outputToObservable()` interop helper when you genuinely need Observable operators over it. Both styles coexist in the current framework, and most production code today is still `@Output()`/`EventEmitter`-based, so interview fluency in both is expected.

Two-way binding syntax, `[(value)]`, only works when an `@Output()` follows a strict naming convention: for an input named `value`, the corresponding output must be named `valueChange` (the input name plus the literal suffix `Change`). This convention — not any special framework magic — is what lets Angular desugar `[(value)]="x"` into `[value]="x" (valueChange)="x = $event"` automatically for both built-in directives like `ngModel` and your own custom components.

## Examples

```ts
import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    <button (click)="confirm.emit()">Confirm</button>
    <button (click)="cancel.emit('user-dismissed')">Cancel</button>
  `,
})
export class ConfirmDialogComponent {
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<string>();
}
```
```html
<!-- Parent: -->
<app-confirm-dialog (confirm)="handleConfirm()" (cancel)="handleCancel($event)"></app-confirm-dialog>
```
Two independent `@Output()`s with different emitted types (`void` vs `string`) — the parent consumes both with ordinary event-binding syntax, and `$event` in `handleCancel($event)` is the string passed to `.emit()`.

```ts
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-quantity-picker',
  standalone: true,
  template: `
    <button (click)="setValue(value - 1)">-</button>
    <span>{{ value }}</span>
    <button (click)="setValue(value + 1)">+</button>
  `,
})
export class QuantityPickerComponent {
  @Input() value = 1;
  @Output() valueChange = new EventEmitter<number>(); // "valueChange" naming enables [(value)]

  setValue(next: number): void {
    if (next < 0) return;
    this.value = next;
    this.valueChange.emit(this.value);
  }
}
```
```html
<!-- Parent, using two-way binding sugar because the output is named valueChange: -->
<app-quantity-picker [(value)]="cartQuantity"></app-quantity-picker>
```
This demonstrates the `<name>` + `<name>Change` naming convention required to unlock `[(value)]` two-way binding for a custom component.

```ts
import { Component, output } from '@angular/core';

@Component({
  selector: 'app-file-upload',
  standalone: true,
  template: `<input type="file" (change)="onFileSelected($event)" />`,
})
export class FileUploadComponent {
  // Signal-based output() — same template consumption, lighter-weight API.
  fileSelected = output<File>();

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.fileSelected.emit(file);
    }
  }
}
```
```html
<!-- Parent, unchanged consumption syntax regardless of @Output()/EventEmitter vs output(): -->
<app-file-upload (fileSelected)="onFile($event)"></app-file-upload>
```
The modern `output()` function — the parent's template binding is identical either way, which is deliberate: consumers of a component shouldn't need to know or care which style the author chose internally.

## Common Pitfalls / Gotchas

- Subscribing to an `@Output()` manually with `.subscribe()` from a parent's TypeScript code instead of using the template's `(eventName)` binding — it technically works since `EventEmitter` extends `Subject`, but it bypasses Angular's automatic lifecycle management, requiring you to manually unsubscribe in `ngOnDestroy` to avoid a leak; idiomatic Angular avoids this entirely by using declarative template bindings.
- Naming an output anything other than `<inputName>Change` and then being confused why `[(inputName)]` two-way syntax doesn't work — the two-way sugar is purely a naming convention Angular's compiler checks for, not something inferred from types or intent.
- Emitting complex mutable objects from an `@Output()` and having the parent mutate them in place — since JS objects are passed by reference, the emitted object and the child's own copy (if it kept one) are now the same object, which can cause confusing bugs if the child assumed it retained an independent copy.
- Forgetting that `@Output()` properties must be initialized (`= new EventEmitter<T>()`) — declaring the property without instantiating it makes `.emit()` throw at runtime, since there's no emitter object to call it on.
- Overusing `output()`'s `outputToObservable()` interop just to get RxJS operators, when the underlying scenario would have been simpler expressed as a plain `@Output() x = new EventEmitter<T>()` from the start — reach for the signal-based `output()` for its cleaner API and explicit typing, not because it magically composes better with RxJS.

## Interview Questions & Answers

**Q: What's the naming rule that enables `[(value)]` two-way binding on a custom component, and why does Angular require it?**
A: The component must expose an `@Input()` (say, `value`) and an `@Output()` named exactly `valueChange` — the input name with the literal suffix `Change` appended. Angular's compiler statically checks for this pattern to desugar `[(value)]="x"` into `[value]="x" (valueChange)="x = $event"`. It's a naming convention enforced at compile time, not something inferred from types, which is why a mismatched name (e.g. `changed` instead of `valueChange`) silently breaks only the two-way shorthand while the two separate one-way bindings would still work fine if written explicitly.

**Q: Why is `EventEmitter<T>` built on top of RxJS's `Subject`, and does that mean you should treat it like a general Observable?**
A: `EventEmitter` extends `Subject` so it can push multiple values over time to whoever is listening, and so it plugs naturally into the same event-binding machinery used for native DOM events. But idiomatically, you should treat it purely as an emit-and-forget notification channel consumed via the template's `(event)` syntax — not as a general-purpose Observable you compose with operators like `debounceTime` or `switchMap` from inside the emitting component. If you need genuine stream composition, that logic belongs in a service exposing its own `Observable`, with the component's `@Output()` staying a thin, simple notification.

**Q: What's the practical difference between `@Output() x = new EventEmitter<T>()` and the newer `x = output<T>()`?**
A: Functionally, both let a parent listen via `(x)="handler($event)"` in the template. `@Output()`/`EventEmitter` is the long-standing, decorator-based, RxJS-`Subject`-backed approach. `output()` (Angular 17.3+) is a function-based API that returns an `OutputEmitterRef`, intentionally lighter-weight and not a full `Subject` — it's meant for simple emit-only events and is part of Angular's broader move toward signal-based, function-first component APIs (paired with `input()` for props). Both remain fully supported; most existing production code still uses the decorator form.

**Q: Can a parent component call `.emit()` directly on a child's `@Output()` property from outside?**
A: Technically yes if it obtains a reference to the child instance (e.g. via `@ViewChild`) — `emit()` is just a public method — but doing so defeats the entire purpose of `@Output()`, which exists to model events flowing *up* from child to parent. If a parent needs to trigger behavior in a child, that belongs on an `@Input()` or a directly-called public method instead; using `@Output()` in the wrong direction is a code-review red flag.

## Related Topics

- [input-decorator.md](./input-decorator.md)
- [event-binding.md](./event-binding.md)
- [observables.md](./observables.md)
- [components.md](./components.md)
- [data-binding.md](./data-binding.md)
