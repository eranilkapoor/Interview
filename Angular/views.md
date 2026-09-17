# Views

In Angular's internal model, a *view* is the fundamental unit of rendering — a tree of DOM nodes created from a template, along with the data structures Angular uses to track and update it. Every component instance has an associated *host view* (the rendering of its own template), and every `<ng-template>` that gets instantiated produces an *embedded view* (a detached fragment of DOM created from that template, which must be explicitly inserted somewhere to appear on the page). This is a more granular concept than "component" — a single component's template can, through structural directives or control-flow blocks (`@if`, `@for`), produce and destroy many embedded views over its lifetime, each independently trackable, insertable, and destroyable, without necessarily involving a new component instance at all.

`TemplateRef` is the handle to a template's *blueprint* — it represents an `<ng-template>` (or the implicit template behind a structural directive/control-flow block) without having instantiated anything yet; you can hold a `TemplateRef` and choose never to render it. `ViewContainerRef` is the handle to a location in the DOM tree where views can be inserted — it represents the *anchor point*, and its methods (`createEmbeddedView(templateRef)`, `createComponent(componentType)`, `clear()`, `insert()`, `remove()`) are how you imperatively instantiate a `TemplateRef` into an actual embedded view, or dynamically create an entirely new component instance and mount it, at runtime, from TypeScript code rather than declarative template syntax. This pairing — a blueprint (`TemplateRef`) plus a place to put it (`ViewContainerRef`) — is literally what `*ngIf`/`*ngFor` and `@if`/`@for` compile down to internally: they're syntactic sugar over exactly this `ViewContainerRef.createEmbeddedView(TemplateRef)` mechanism.

`@ViewChild`/`@ViewChildren` (and their signal-based counterparts, `viewChild()`/`viewChildren()`) are how a component class gets a handle to something living inside its *own* template — a child component instance, a directive instance, a native DOM element (via a template reference variable target), or a `TemplateRef`. This is fundamentally different from `@Input()`: inputs are data flowing declaratively into a component from its parent's template, while `@ViewChild` is the component reaching *into its own rendered view* imperatively, from TypeScript, typically to call a method directly on a child (e.g., `this.modal().open()`) or read something off a native element that has no clean declarative binding equivalent (measuring an element's size, focusing an input). A hard constraint worth knowing precisely: `@ViewChild` references are not populated until *after* the view has been checked (available reliably starting in `ngAfterViewInit`, not `ngOnInit`), because the child view genuinely doesn't exist yet when `ngOnInit` runs.

Views also matter for change detection: every component has its own change detector, tied to its view, and Angular's default change-detection strategy walks the component tree view by view, checking each one's bindings for changes after any DOM event, timer, or HTTP response fires (via zone.js, historically) or, with signals and `OnPush`, more precisely only where a signal actually changed. `ChangeDetectorRef`, injectable into any component, gives you a handle to a view's own change detector — `detectChanges()` forces a synchronous check of that view (and its children) right now, `markForCheck()` flags a view (and its ancestors, in `OnPush` mode) as needing to be checked on the next detection pass without forcing it immediately, and `detach()`/`reattach()` remove a view from/return it to the normal change-detection tree walk entirely — useful for views you update via a wholly separate mechanism (a canvas redraw loop, a third-party widget) where Angular's own dirty-checking would be pure overhead.

## Examples

```ts
// TemplateRef + ViewContainerRef: implementing a minimal *ngIf-like directive
// from scratch, showing exactly what the structural-directive sugar compiles toward.
import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';

@Directive({ selector: '[appUnless]', standalone: true })
export class UnlessDirective {
  private hasView = false;
  constructor(
    private templateRef: TemplateRef<unknown>,   // the un-instantiated blueprint
    private viewContainer: ViewContainerRef,      // the DOM anchor point to insert into
  ) {}

  @Input() set appUnless(condition: boolean) {
    if (!condition && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef); // instantiate + insert
      this.hasView = true;
    } else if (condition && this.hasView) {
      this.viewContainer.clear(); // destroy the embedded view
      this.hasView = false;
    }
  }
}
// Usage: <p *appUnless="isLoggedIn">You are not logged in.</p>
```

This is the actual mechanism `*ngIf`/`@if` are built on: a `TemplateRef` capturing the template as an uninstantiated blueprint, and a `ViewContainerRef` whose `createEmbeddedView`/`clear` calls are what physically add or remove the DOM.

```ts
// @ViewChild for imperative access to a child component after the view renders
import { Component, ViewChild, AfterViewInit, ElementRef } from '@angular/core';
import { ModalComponent } from './modal.component';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [ModalComponent],
  template: `
    <app-modal #confirmModal />
    <input #emailInput type="email" />
    <button (click)="confirmModal.open()">Delete account</button>
  `,
})
export class SettingsPageComponent implements AfterViewInit {
  @ViewChild(ModalComponent) modal!: ModalComponent;      // by component type
  @ViewChild('emailInput') emailInput!: ElementRef<HTMLInputElement>; // by template ref var

  ngAfterViewInit() {
    // Safe here — the view (and thus its children) has finished its first render.
    // In ngOnInit, `this.modal` would still be undefined.
    this.emailInput.nativeElement.focus();
  }
}
```

This shows both `@ViewChild` lookup styles (by component type, and by template reference variable string) and the critical timing rule: child view references are reliably available only from `ngAfterViewInit` onward, never from `ngOnInit`.

```ts
// Dynamically creating a component at runtime via ViewContainerRef —
// the imperative equivalent of writing <app-alert> in a template.
import { Component, ViewChild, ViewContainerRef } from '@angular/core';
import { AlertComponent } from './alert.component';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  template: `<ng-container #anchor></ng-container>`,
})
export class ToastHostComponent {
  @ViewChild('anchor', { read: ViewContainerRef }) anchor!: ViewContainerRef;

  showAlert(message: string) {
    const ref = this.anchor.createComponent(AlertComponent); // new component instance, mounted here
    ref.instance.message = message;                          // set its inputs imperatively
    setTimeout(() => ref.destroy(), 3000);                    // tear the view down when done
  }
}
```

This is `ViewContainerRef.createComponent()` — the fully dynamic case, used for things like toast/notification systems or modal hosts where the component to render isn't known declaratively in the template ahead of time; the returned `ComponentRef` gives direct access to the new instance's inputs and a `destroy()` method to remove its view.

## Common Pitfalls / Gotchas

- Reading `@ViewChild` results inside `ngOnInit` and getting `undefined` — child views aren't guaranteed to exist until after Angular finishes the first change-detection pass over the view, which is exactly what `ngAfterViewInit` signals; this is one of the most common lifecycle-ordering bugs in real Angular code.
- Forgetting that `*ngIf="false"` (or `@if` being false) doesn't just hide an element with CSS — it destroys the embedded view entirely, so any `@ViewChild` reference into that conditionally-rendered content becomes `undefined` when the condition is false, and any component state inside it is lost (unlike `[hidden]`/`display: none`, which keep the view and its state alive).
- Leaking dynamically created components (`createComponent()`) by never calling `destroy()` on the returned `ComponentRef` — unlike DOM elements removed with plain JS, an Angular component's view (and its subscriptions, timers, injected services if scoped to it) won't be properly torn down unless `destroy()` is called explicitly or the containing view is destroyed.
- Confusing `ViewContainerRef` scoping when it's injected in different places — injecting it in a *structural directive* gives you the anchor point *replacing* the host element in the DOM, while injecting it in a regular component gives you the anchor for content inside that component's own template; mixing up which anchor you're inserting relative to produces views in the wrong DOM position.
- Assuming `@ViewChild` can see into content projected via `<ng-content>` — it can't by default; `@ViewChild` only sees the component's *own* template, not content a parent projected in, which requires `@ContentChild`/`@ContentChildren` instead.
- Calling `detectChanges()` on a `ChangeDetectorRef` from inside a lifecycle hook that Angular is already mid-way through processing for that same view — this can trigger the "Expression has changed after it was checked" (`ExpressionChangedAfterItHasBeenCheckedError`) development-mode error, because you're forcing a second check whose results differ from what was already rendered in this pass.

## Interview Questions & Answers

**Q: What's the difference between a `TemplateRef` and a `ViewContainerRef`, and how do they relate to `*ngIf`?**
A: `TemplateRef` is an uninstantiated blueprint — it represents an `<ng-template>`'s content without having created any DOM for it yet. `ViewContainerRef` is a handle to a specific location in the DOM tree where views can be inserted, exposing methods like `createEmbeddedView()` to actually instantiate a `TemplateRef` there. `*ngIf` (and `@if` under the hood) is implemented on exactly this pairing: the directive receives both via constructor injection, and toggles between calling `viewContainer.createEmbeddedView(templateRef)` when the condition becomes true and `viewContainer.clear()` when it becomes false.

**Q: Why is `@ViewChild` `undefined` in `ngOnInit` but available in `ngAfterViewInit`?**
A: `ngOnInit` runs after Angular has set the component's own input-bound properties but before it has necessarily finished rendering (checking) the component's view and all of its children's views for the first time — a child referenced by `@ViewChild` may not have completed its own initialization yet. `ngAfterViewInit` fires specifically after Angular has finished the first full check of the component's view and all its child views, which is the first point at which `@ViewChild`/`@ViewChildren` references are guaranteed to be populated and safe to use.

**Q: How would you dynamically render a component whose type isn't known until runtime — say, rendering different "widget" components based on data from an API?**
A: Inject a `ViewContainerRef` (typically anchored to an `<ng-container #anchor>` in the template, read via `@ViewChild('anchor', { read: ViewContainerRef })`), then call `viewContainerRef.createComponent(WidgetComponentType)` with whatever component class corresponds to the current data. The returned `ComponentRef` lets you set the new instance's inputs (`ref.instance.someInput = value` or `ref.setInput('someInput', value)`) and gives you a `destroy()` method to clean it up later. For simpler cases where the set of possible components is small and known, `NgComponentOutlet` provides a more declarative shorthand over the same underlying mechanism.

**Q: What actually happens to a component's state when its containing `*ngIf`/`@if` becomes false?**
A: The embedded/host view is destroyed, not just hidden — Angular calls `ngOnDestroy` on any components inside it, tears down the DOM nodes, and any local component state (form values typed in, scroll position, open/closed toggles) is gone. This is different from CSS-based hiding (`[hidden]` or `display: none` via a style/class binding), which keeps the full view and all its state alive in the DOM, just visually hidden — the right choice depends on whether you want state preserved across toggles or whether tearing down (freeing memory, resetting to initial state) is actually desirable.

**Q: When would you use `ChangeDetectorRef.detach()` and why would that ever be a good idea?**
A: When a view is updated through some mechanism entirely outside Angular's normal binding/event flow — for example, a component wrapping a canvas-based visualization that redraws itself on a `requestAnimationFrame` loop, or a component receiving extremely high-frequency data (like live sensor updates) where you only want to render at a throttled rate you control. `detach()` removes that view from Angular's regular change-detection tree walk so it's no longer checked on every application-wide detection cycle, and you call `detectChanges()` manually, on your own schedule, which can meaningfully cut wasted work in default (non-`OnPush`) change-detection apps with expensive or frequently-invalidated views.

## Related Topics

- [components.md](./components.md)
- [templates.md](./templates.md)
- [directives.md](./directives.md)
- [life-cycle-hooks.md](./life-cycle-hooks.md)
- [data-binding.md](./data-binding.md)
