# Observables

An Observable is a lazy, push-based stream of values over time, and it is the async primitive RxJS provides and Angular builds most of its plumbing on top of. "Lazy" means an Observable does nothing until something subscribes to it — creating an Observable with `new Observable(...)` or `http.get(...)` just describes a producer; no HTTP request fires, no timer starts, until `.subscribe()` is called. "Push-based" means the producer decides when to emit — the consumer doesn't pull values, it registers a callback (`next`/`error`/`complete`) and waits to be notified. An Observable can emit zero, one, or many values over its lifetime and can complete or error, which is a strictly richer contract than a Promise, which always resolves to exactly one value (or rejects) exactly once.

Angular leans on Observables in several core APIs. `HttpClient` methods (`get`, `post`, etc.) return cold Observables — each `subscribe()` triggers a fresh HTTP request, so subscribing twice fires the request twice, which surprises people coming from `fetch`/Promise thinking. The `Router` exposes `router.events` as an Observable of navigation lifecycle events (`NavigationStart`, `NavigationEnd`, guards, resolvers). Reactive forms expose `valueChanges` and `statusChanges` Observables on every `FormControl`/`FormGroup`. And `@Output()` properties are typically typed as `EventEmitter<T>`, which is itself a subclass of RxJS `Subject`.

Cold vs. hot is the distinction between unicast, on-demand producers and multicast, already-running producers. A cold Observable (like `http.get()` or one built from `new Observable(subscriber => ...)` that starts its work inside that callback) creates an independent producer per subscriber — two subscribers get two separate executions and, for an HTTP call, two separate network requests. A hot Observable's producer exists independently of subscribers and broadcasts the same events to everyone currently subscribed — DOM event streams (`fromEvent`) and `Subject`s are hot. `Subject` is both an Observable and an Observer: you can call `.next()` on it to push values manually, and multiple subscribers share the same execution. `BehaviorSubject` requires an initial value, always has a "current value" accessible synchronously via `.value`, and replays that current value to any new subscriber — this makes it the natural choice for state containers (e.g., a "current user" or "current theme" service). `ReplaySubject(n)` buffers and replays the last `n` emissions to new subscribers regardless of whether there's a "current" concept, useful for caching the last few results of something.

The single most important operational concern with Observables in Angular is unsubscribing. A `Subject`-backed stream, a `Router` events stream, or anything derived from `fromEvent` on a long-lived element keeps the subscription (and its closure, and anything it references) alive until explicitly torn down — if you `subscribe()` in `ngOnInit` and never unsubscribe, that subscription (and the component it references) leaks for the life of the app, even after the component is destroyed and removed from the DOM. There are three standard fixes: (1) the `async` pipe in the template, which subscribes when the component initializes and automatically unsubscribes when the component is destroyed — this is the preferred approach whenever the value is only needed in the template; (2) the `takeUntil(this.destroy$)` pattern, where a `Subject` is `.next()`-ed and `.complete()`-d in `ngOnDestroy` and piped into every manual subscription so they all complete together; (3) `takeUntilDestroyed()`, added in Angular 16, which reads the `DestroyRef` from the current injection context automatically and completes the stream when the component/directive/service is destroyed, removing the boilerplate `destroy$` subject entirely. Note that `HttpClient` Observables complete on their own after one emission, so they don't strictly need manual unsubscription for memory-leak purposes — but it's still good practice to guard against long-running requests outliving a destroyed component (e.g., updating component state after navigation away).

## Examples

```ts
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { FormControl } from '@angular/forms';

@Component({
  selector: 'app-user-search',
  standalone: true,
  template: `
    <input [formControl]="query" placeholder="Search users..." />
    @if (results(); as users) {
      <ul>
        @for (user of users; track user.id) {
          <li>{{ user.name }}</li>
        }
      </ul>
    }
  `,
})
export class UserSearchComponent {
  private http = inject(HttpClient);
  query = new FormControl('', { nonNullable: true });

  // valueChanges is hot/multicast off the FormControl; switchMap cancels the
  // previous in-flight HTTP request whenever a new keystroke arrives, which
  // is exactly what you want for a "latest search wins" typeahead.
  private results$ = this.query.valueChanges.pipe(
    debounceTime(300),           // wait for the user to pause typing
    distinctUntilChanged(),      // skip if the value didn't actually change
    switchMap((term) =>
      this.http.get<{ id: number; name: string }[]>(`/api/users?q=${term}`).pipe(
        catchError(() => of([])) // swallow errors, emit empty results instead
      )
    )
  );
  // toSignal (or the async pipe) handles subscribe/unsubscribe for us.
  results = toSignal(this.results$, { initialValue: [] as { id: number; name: string }[] });
}
```

This demonstrates the canonical Angular reactive-forms + HTTP pattern: `debounceTime`/`distinctUntilChanged` to tame input events, `switchMap` to cancel stale requests, and letting a framework primitive (`toSignal`, or the `async` pipe) own subscription lifecycle instead of manual `subscribe()`/`unsubscribe()` calls.

```ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CartService {
  // BehaviorSubject holds a "current value" and replays it to late subscribers —
  // a new component mounting later still immediately sees the current cart count.
  private itemsSubject = new BehaviorSubject<CartItem[]>([]);
  readonly items$ = this.itemsSubject.asObservable(); // expose read-only stream

  add(item: CartItem): void {
    const current = this.itemsSubject.value; // synchronous read, no subscribe needed
    this.itemsSubject.next([...current, item]);
  }
}

interface CartItem { sku: string; qty: number; }
```

`asObservable()` prevents consumers from calling `.next()` on the service's internal subject directly, enforcing a one-way data flow: only the service can push new state, everyone else just observes it.

```ts
import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';

@Directive({ selector: '[appClickLogger]', standalone: true })
export class ClickLoggerDirective {
  private el = inject(ElementRef);

  constructor() {
    // fromEvent is hot — the DOM element fires events whether or not we're
    // listening. takeUntilDestroyed automatically completes this subscription
    // when the directive's host is destroyed, no manual destroy$ Subject needed.
    fromEvent(this.el.nativeElement, 'click')
      .pipe(takeUntilDestroyed())
      .subscribe(() => console.log('clicked', this.el.nativeElement));
  }
}
```

This shows the modern (Angular 16+) replacement for the `Subject`-based `takeUntil(this.destroy$)` boilerplate, using `takeUntilDestroyed()` which reads `DestroyRef` from the injection context automatically when called in a constructor or field initializer.

## Common Pitfalls / Gotchas

- Subscribing to `http.get()` twice (e.g., once to display data and again in a different handler) fires two separate HTTP requests, because `HttpClient` Observables are cold — share the result with `shareReplay(1)` if multiple consumers need the same response.
- Forgetting `takeUntil`/`takeUntilDestroyed`/`async` pipe on a `Subject`-backed or `fromEvent`-backed subscription inside a component leaks the subscription (and the whole component instance it closes over) after the component is destroyed.
- Nesting subscriptions (`obs1$.subscribe(v => obs2$.subscribe(...))`) instead of using `switchMap`/`mergeMap`/`concatMap` — this is a classic "callback pyramid" anti-pattern that also makes cancellation and error handling much harder to reason about.
- Confusing `switchMap` (cancels the previous inner Observable — right for typeaheads/latest-wins) with `mergeMap` (runs all inner Observables concurrently, no cancellation — right for independent parallel work) and `concatMap` (queues inner Observables strictly in order — right when order matters, like sequential save operations).
- Putting the `async` pipe on the same Observable more than once in a template (e.g., `{{ (data$ | async)?.name }}` and `{{ (data$ | async)?.age }}`) — each `| async` creates its own subscription, so a cold source fires multiple times; alias it once with `@if (data$ | async; as data)` instead.
- Treating `EventEmitter`/`@Output()` as a general-purpose Subject to subscribe to from within the same component or to call `.pipe()` on outside Angular's template binding — it's designed for parent-to-child template event binding, not as a general pub/sub bus.

## Interview Questions & Answers

**Q: What's the practical difference between a Promise and an Observable?**
A: A Promise is eager (the executor runs immediately on creation) and resolves exactly once with a single value; it has no built-in cancellation. An Observable is lazy (nothing happens until `subscribe()`), can emit zero, one, or many values over time, can be cancelled by unsubscribing, and comes with a huge library of composition operators (`map`, `switchMap`, `debounceTime`, etc.) for transforming and combining streams declaratively. In Angular specifically, `HttpClient` returns Observables partly because of cancellation — navigating away mid-request can cleanly unsubscribe and abort, which a Promise-based API can't express as naturally.

**Q: Why does `HttpClient` return an Observable that completes after one value instead of a Promise?**
A: It gives you cancellation (unsubscribing before the response arrives aborts the underlying XHR/fetch), composability with RxJS operators like `retry`, `timeout`, `switchMap` for cancel-and-restart semantics, and consistency with the rest of Angular's Observable-based APIs (Router, forms) so you can combine them with `combineLatest`/`switchMap` without mixing async paradigms. It still completes after emitting once, so you can convert it to a Promise trivially with `firstValueFrom()` when you genuinely only need a one-shot value.

**Q: Explain `switchMap` vs `mergeMap` vs `concatMap` with a concrete example of when each is correct.**
A: All three flatten a "stream of Observables" into a single stream, but differ in how they handle overlapping inner subscriptions. `switchMap` cancels the previous inner Observable when a new outer value arrives — correct for a search-as-you-type box where only the latest query's result matters. `mergeMap` subscribes to every inner Observable concurrently and merges their emissions as they arrive, with no cancellation — correct for firing off several independent uploads that can complete in any order. `concatMap` waits for the current inner Observable to complete before subscribing to the next, preserving strict order — correct for a sequence of dependent save operations that must not interleave.

**Q: How do you prevent memory leaks from Observable subscriptions in a component?**
A: Prefer the `async` pipe wherever the value is only consumed in the template, since Angular handles subscribe/unsubscribe automatically tied to the component's lifecycle. For subscriptions that must happen in the class (side effects, imperative logic), use `takeUntilDestroyed()` (Angular 16+, reads `DestroyRef` automatically) or the older `takeUntil(this.destroy$)` pattern where `destroy$` is a `Subject` that's `.next()`-ed and `.complete()`-d in `ngOnDestroy`. Both ensure the subscription completes when the component is torn down rather than persisting indefinitely.

**Q: What's the difference between `Subject`, `BehaviorSubject`, and `ReplaySubject`?**
A: A plain `Subject` has no memory — a late subscriber only receives values emitted after it subscribes. `BehaviorSubject` requires an initial value, always exposes the current value synchronously via `.value`, and replays that one current value to new subscribers — ideal for "current state" (logged-in user, selected tab). `ReplaySubject(n)` buffers the last `n` emissions (not just one) and replays them to new subscribers, useful when late subscribers need some history, not just the latest value, such as caching the last few log entries or search results.

## Related Topics

- [pipes.md](./pipes.md)
- [client-server-interaction.md](./client-server-interaction.md)
- [reactive-forms.md](./reactive-forms.md)
- [routing.md](./routing.md)
- [components.md](./components.md)
- [services.md](./services.md)
