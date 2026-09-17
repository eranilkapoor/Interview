# Lifecycle Hooks

Every Angular directive and component goes through a well-defined sequence of stages from creation to destruction, and Angular gives you a hook method for nearly every meaningful transition in that sequence. These hooks exist because a component's constructor runs before Angular has finished setting up anything useful — no `@Input()` values are bound yet, no child views exist, no projected content has been rendered — so any logic that depends on that setup being complete needs a dedicated place to run *after* the relevant part of Angular's setup has happened. Implementing a hook means implementing the corresponding TypeScript interface (`OnInit`, `OnChanges`, etc.) and defining the matching method (`ngOnInit()`, `ngOnChanges()`, etc.); the interfaces are optional at the type-checking level (Angular calls the method by name regardless), but implementing them documents intent and catches typos in the method signature.

The full, ordered sequence — and getting this order exactly right is one of the most commonly tested pieces of Angular trivia in interviews — is:

1. **`ngOnChanges(changes: SimpleChanges)`** — called before `ngOnInit`, and again every time one or more `@Input()`-bound properties receive a *new reference* (not just before the first time). It receives a `SimpleChanges` object keyed by input property name, each entry exposing `currentValue`, `previousValue`, and `firstChange`. It does **not** fire for a component with no `@Input()`s, and it does not fire on internal mutation of an object/array input (only on reassignment of the bound reference) since Angular's default change detection uses reference equality.
2. **`ngOnInit()`** — called exactly once, immediately after the *first* `ngOnChanges` (or immediately on init if there are no inputs at all). This is the conventional place for initialization logic: fetching initial data, setting up subscriptions, or any setup that depends on `@Input()` values already being bound (which the constructor cannot guarantee).
3. **`ngDoCheck()`** — called on every single change-detection run, immediately after `ngOnChanges`/`ngOnInit` on that same cycle, and on *every subsequent* CD cycle thereafter regardless of whether any input actually changed. It exists as an escape hatch for custom change-detection logic — e.g., detecting that the *contents* of an array or object input mutated in place, which `ngOnChanges` would miss since the reference didn't change. Because it runs on every CD cycle, expensive logic here is a common performance trap.
4. **`ngAfterContentInit()`** — called once, after Angular has finished projecting external content into the component via `<ng-content>` (i.e., content children queried with `@ContentChild`/`@ContentChildren` are now available).
5. **`ngAfterContentChecked()`** — called after `ngAfterContentInit`, and again after every subsequent check of projected content — i.e., on every CD cycle, not just once.
6. **`ngAfterViewInit()`** — called once, after Angular has fully initialized the component's *own* view and all of its child views. This is the first point at which `@ViewChild`/`@ViewChildren` references are guaranteed to be populated — accessing them earlier (e.g., in `ngOnInit`) yields `undefined`.
7. **`ngAfterViewChecked()`** — called after `ngAfterViewInit`, and again after every subsequent check of the component's view and child views — on every CD cycle, not just once.
8. **`ngOnDestroy()`** — called once, immediately before Angular destroys the directive/component (e.g., it's removed by `*ngIf`/`@if`, navigated away from, or the app shuts down). This is the designated place for cleanup: unsubscribing from Observables that aren't using `async`/`takeUntilDestroyed`, clearing `setInterval`/`setTimeout` timers, detaching manually-added event listeners (e.g., `window.addEventListener`), and disconnecting `IntersectionObserver`/`ResizeObserver` instances — all things that would otherwise leak past the component's lifetime.

The critical nuance interviewers probe for is that `ngDoCheck`, `ngAfterContentChecked`, and `ngAfterViewChecked` are **not** one-time hooks like `ngOnInit`/`ngAfterContentInit`/`ngAfterViewInit` — they re-fire on *every* change-detection cycle for the entire lifetime of the component, which is precisely why putting heavy computation in any of them is a classic performance mistake. With Angular Signals (v17+), much initialization/reaction logic can be expressed declaratively via `computed()` and `effect()` instead of imperative lifecycle hooks, but the hooks themselves — and their ordering — are unchanged and remain essential for DOM/view-timing-dependent logic and for any component still built with plain `@Input()`-based state.

## Examples

```ts
import { Component, Input, OnChanges, OnInit, DoCheck, OnDestroy, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-order-summary',
  standalone: true,
  template: `<p>Total: {{ total }}</p>`,
})
export class OrderSummaryComponent implements OnChanges, OnInit, DoCheck, OnDestroy {
  @Input() items: { price: number }[] = [];
  total = 0;
  private intervalId?: ReturnType<typeof setInterval>;

  ngOnChanges(changes: SimpleChanges): void {
    // Fires before ngOnInit, and again whenever `items` is reassigned to a new array reference.
    if (changes['items']) {
      console.log('items changed:', changes['items'].previousValue, '->', changes['items'].currentValue);
    }
  }

  ngOnInit(): void {
    // Runs once, after the first ngOnChanges — safe to rely on @Input()s being populated here.
    this.recalculateTotal();
    this.intervalId = setInterval(() => this.recalculateTotal(), 5000);
  }

  ngDoCheck(): void {
    // Runs on EVERY change-detection cycle — needed here because mutating array contents
    // in place (push/splice) doesn't change the array reference, so ngOnChanges won't fire.
    this.recalculateTotal();
  }

  private recalculateTotal(): void {
    this.total = this.items.reduce((sum, item) => sum + item.price, 0);
  }

  ngOnDestroy(): void {
    // Mandatory cleanup — an uncleared interval keeps running (and keeps a reference to
    // `this`) even after the component is removed from the DOM, which is a memory leak.
    clearInterval(this.intervalId);
  }
}
```

This demonstrates the `ngOnChanges` → `ngOnInit` → `ngDoCheck` ordering, why `ngDoCheck` is needed for in-place mutation detection that `ngOnChanges` misses, and why `ngOnDestroy` cleanup matters for anything started with `setInterval`.

```ts
import { Component, ViewChild, ElementRef, AfterViewInit, ContentChild, AfterContentInit } from '@angular/core';

@Component({
  selector: 'app-chart-panel',
  standalone: true,
  template: `
    <div class="content-slot"><ng-content></ng-content></div>
    <canvas #chartCanvas></canvas>
  `,
})
export class ChartPanelComponent implements AfterContentInit, AfterViewInit {
  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ContentChild('projectedHeader') headerRef?: ElementRef;

  ngAfterContentInit(): void {
    // Projected <ng-content> content is guaranteed available here — not before.
    console.log('projected header present?', !!this.headerRef);
  }

  ngAfterViewInit(): void {
    // The component's own view (including @ViewChild targets) is only guaranteed
    // ready here — reading canvasRef in ngOnInit would throw/return undefined.
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    ctx?.fillRect(0, 0, 100, 100);
  }
}
```

This shows why DOM-dependent code (canvas access via `@ViewChild`) must live in `ngAfterViewInit`, not `ngOnInit`, and why content-projection-dependent code (`@ContentChild`) must live in `ngAfterContentInit`.

```ts
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

@Component({ selector: 'app-badge', standalone: true, template: `<span>{{ label }}</span>` })
export class BadgeComponent implements OnChanges {
  @Input() count = 0;
  label = '';

  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['count'];
    if (change) {
      // firstChange lets you distinguish "initial bind" from "a later update"
      console.log(change.firstChange ? 'initial value:' : 'updated value:', change.currentValue);
      this.label = change.currentValue > 99 ? '99+' : String(change.currentValue);
    }
  }
}
```

`SimpleChanges['count'].firstChange` is the idiomatic way to branch between first-bind and subsequent-update logic inside `ngOnChanges` without needing a separate flag.

## Common Pitfalls / Gotchas

- Accessing `@ViewChild`/`@ViewChildren` references in `ngOnInit` — they are `undefined` at that point; they're only guaranteed populated by `ngAfterViewInit`.
- Assuming `ngDoCheck`, `ngAfterContentChecked`, and `ngAfterViewChecked` run only once — they re-fire on *every* change-detection cycle for the component's entire lifetime, so any non-trivial work inside them can silently tank performance across the whole app.
- Expecting `ngOnChanges` to fire when an `@Input()`-bound array/object is mutated in place (`.push()`, `.splice()`, property assignment) — it only fires on reference reassignment; in-place mutation requires `ngDoCheck` or immutable update patterns to detect.
- Forgetting `ngOnChanges` never fires at all for a component with zero `@Input()` properties — relying on it as a general "something changed" hook for a purely internal-state component is a mistake; use `ngDoCheck` instead if truly needed.
- Not unsubscribing from Observables (or clearing timers/listeners) in `ngOnDestroy` — this is the single most common source of memory leaks in Angular apps, especially with long-lived services publishing Observables that components subscribe to directly instead of via the `async` pipe or `takeUntilDestroyed()`.
- Doing expensive work in the constructor instead of `ngOnInit` — the constructor runs before Angular has bound `@Input()`s, so any input-dependent logic there operates on stale/undefined values; the constructor should be reserved for DI (injecting services) only.

## Interview Questions & Answers

**Q: What is the exact order of Angular's lifecycle hooks, and which ones repeat versus run only once?**
A: The order is `ngOnChanges` → `ngOnInit` → `ngDoCheck` → `ngAfterContentInit` → `ngAfterContentChecked` → `ngAfterViewInit` → `ngAfterViewChecked` → (component lives on, handling further change-detection cycles) → `ngOnDestroy`. `ngOnInit`, `ngAfterContentInit`, and `ngAfterViewInit` each run exactly once. `ngOnChanges` runs before the first `ngOnInit` and then again on every subsequent input-reference change. `ngDoCheck`, `ngAfterContentChecked`, and `ngAfterViewChecked` all re-run on *every* change-detection cycle for the lifetime of the component, not just once — this is the detail most candidates get wrong.

**Q: Why doesn't `ngOnChanges` fire when you push a new item into an `@Input()`-bound array?**
A: Angular's default change detection (and `ngOnChanges` specifically) compares input values by reference, not deep value. Pushing into an existing array mutates it in place — the array's reference stays exactly the same — so from Angular's perspective, nothing "changed." To trigger `ngOnChanges`, the parent must assign a *new* array reference (e.g., `this.items = [...this.items, newItem]`). If you need to react to in-place mutation without changing the reference, `ngDoCheck` is the hook designed for that, though you have to implement your own diffing (often with Angular's `IterableDiffers`/`KeyValueDiffers` utilities) since Angular won't do it for you there.

**Q: Why is `ngAfterViewInit` the correct place to access a `@ViewChild` reference, but `ngOnInit` is not?**
A: `@ViewChild` resolves elements/components from the component's *own template* (and, by default, child component views too). At the time `ngOnInit` runs, Angular has processed inputs but has not yet finished creating and initializing the child view tree, so the `@ViewChild` property is still `undefined`. `ngAfterViewInit` is specifically the hook Angular calls only after the component's view and all of its child views have been fully initialized, which is the first point where reading that reference is safe and reliable.

**Q: What kinds of cleanup belong in `ngOnDestroy`, and why does it matter?**
A: Anything the component started that would otherwise outlive it: RxJS subscriptions not managed by the `async` pipe or `takeUntilDestroyed()`, `setInterval`/`setTimeout` timers, manually attached DOM event listeners (`window.addEventListener`, `document.addEventListener`), and observers like `IntersectionObserver`/`ResizeObserver`. If these aren't torn down, they keep references alive past the component's removal from the DOM — subscriptions keep emitting into a "dead" component, timers keep firing, and the component instance itself can't be garbage collected because something external still references it, which is a classic Angular memory leak.

**Q: If a component has no `@Input()` properties at all, will `ngOnChanges` ever be called?**
A: No — `ngOnChanges` is only invoked when the component has at least one `@Input()`-bound property, and only when the parent actually sets/changes it. A component with purely internal state and no inputs will never see `ngOnChanges` fire, even once; its initialization logic belongs entirely in `ngOnInit`.

## Related Topics

- [components.md](./components.md)
- [input-decorator.md](./input-decorator.md)
- [output-decorator.md](./output-decorator.md)
- [templates.md](./templates.md)
- [views.md](./views.md)
- [observables.md](./observables.md)
