# Services

A service in Angular is nothing framework-magic at its core — it's a plain TypeScript class, conventionally decorated with `@Injectable()`, whose job is to hold logic, state, or data access that doesn't belong to any one component's view. The entire point of separating services from components is the single-responsibility split Angular encourages architecturally: components should be "dumb" in the sense of focusing on presenting data and handling user interaction, while services own business logic, HTTP calls, caching, cross-component state, and anything else that would otherwise get duplicated or tangled into template-adjacent code if left inside a component class. A component that fetches its own data with a raw `HttpClient` call in `ngOnInit`, transforms it inline, and also happens to be the only place that data exists is a common anti-pattern — it works until a second component needs the same data or the same fetching logic, at which point without a service you're stuck copy-pasting or awkwardly reaching into a sibling component's internals.

The `@Injectable()` decorator itself doesn't do much beyond marking the class as available for DI and, when given `providedIn: 'root'`, registering it as a tree-shakable application-wide singleton — see the dependency-injection and providers topics for the full mechanics of *how* that resolution works. What matters for understanding services conceptually is what that singleton-via-DI pattern buys you: because Angular's root injector hands out the *same instance* of a `providedIn: 'root'` service to every component, directive, or other service that injects it, a service becomes a natural place for state that needs to be shared and stay in sync across otherwise-unrelated parts of the component tree — a shopping cart, the currently logged-in user, a WebSocket connection, feature flags — without prop-drilling `@Input()`s down through layers of components that don't otherwise care about that data.

Services very commonly wrap `HttpClient` to centralize an app's data-access layer: instead of every component that needs "the list of orders" independently constructing the right URL, headers, and response-mapping logic, one `OrderService` exposes a method like `getOrders(): Observable<Order[]>` that every consumer calls identically, and if the API contract changes, there's exactly one place to fix it. Beyond simple request/response wrapping, services are also the standard home for **shared reactive state** using RxJS's `Subject` or `BehaviorSubject`: a service exposes a `BehaviorSubject` privately, exposes its read-only `Observable` view publicly (via `.asObservable()`), and provides methods that push new values into it — this lets multiple components subscribe to the same evolving piece of state (like "is the sidebar collapsed" or "the current user's notification count") and receive updates reactively whenever any other part of the app calls the service's update method, all without those components knowing about each other directly. `BehaviorSubject` specifically is preferred over a plain `Subject` for this when late subscribers need the *current* value immediately upon subscribing (since it requires and replays an initial value), whereas a plain `Subject` only emits to subscribers active at the moment of emission.

The contrast with putting logic directly in components is really a contrast in testability, reusability, and lifetime. Logic inside a component's class is torn down with that component instance and is awkward to unit test in isolation from rendering; logic inside a service can be unit tested with plain class instantiation (or via `TestBed.inject()`), reused by any number of components without duplication, and — if registered as a root singleton — persists independently of any one component's lifecycle, which is exactly what you want for things like an authenticated session or an in-memory cache that should survive a component being destroyed and recreated during navigation.

## Examples

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Order {
  id: string;
  total: number;
  status: 'pending' | 'shipped' | 'delivered';
}

// A straightforward data-access service: centralizes the API contract for orders
// so no component constructs URLs or maps responses itself.
@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/orders';

  getOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(this.baseUrl);
  }

  getOrder(id: string): Observable<Order> {
    return this.http.get<Order>(`${this.baseUrl}/${id}`);
  }

  cancelOrder(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/cancel`, {});
  }
}
```
This is the typical "thin service wraps HttpClient" pattern — any component needing order data injects `OrderService` rather than talking to `HttpClient` directly, so the API shape is defined once.

```ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

// Shared reactive state service: multiple unrelated components can react to
// cart changes without knowing about each other.
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly itemsSubject = new BehaviorSubject<CartItem[]>([]);

  // Expose a read-only Observable; consumers can't call .next() on this directly.
  readonly items$: Observable<CartItem[]> = this.itemsSubject.asObservable();

  get itemCount(): number {
    return this.itemsSubject.value.length;
  }

  addItem(item: CartItem): void {
    const current = this.itemsSubject.value;
    this.itemsSubject.next([...current, item]); // push a new array so subscribers see the change
  }

  removeItem(id: string): void {
    this.itemsSubject.next(this.itemsSubject.value.filter(i => i.id !== id));
  }
}

// In a header component's template, subscribed via the async pipe:
// Cart ({{ (cartService.items$ | async)?.length ?? 0 }})
//
// In a totally separate product-list component, calling cartService.addItem(...)
// immediately updates the header's count, with no direct relationship between the two.
```
This is the standard "service as shared reactive state" pattern: a `BehaviorSubject` holds the current value so any component that subscribes later (like a header badge mounted after the cart already has items) immediately receives the current state, not just future changes.

```ts
// Contrast: the anti-pattern of logic living directly in a component.
@Component({ selector: 'app-order-list-bad', template: `...` })
export class OrderListBadComponent implements OnInit {
  orders: Order[] = [];
  private readonly http = inject(HttpClient);

  ngOnInit() {
    // Fetching AND mapping logic duplicated here — a second component needing
    // orders would have to copy this exact block, and it can't be unit tested
    // without instantiating the whole component and its change detection.
    this.http.get<any[]>('/api/orders').subscribe(raw => {
      this.orders = raw.map(o => ({ id: o.id, total: o.total_amount, status: o.status }));
    });
  }
}
```
This is the pattern services exist to avoid — data-fetching and mapping logic embedded directly in a component, which can't be reused, is harder to test in isolation, and ties the API's response shape to a specific view.

## Common Pitfalls / Gotchas

- Exposing a `Subject`/`BehaviorSubject` itself as public (`itemsSubject` instead of `itemsSubject.asObservable()`), letting any consumer call `.next()` on it from outside the service and bypass the service's own update methods — always expose the read-only `Observable` view.
- Choosing a plain `Subject` when late subscribers need the current value immediately — a component that mounts and subscribes *after* the state has already changed will miss all prior emissions with a `Subject`, whereas `BehaviorSubject` replays the current value on subscription.
- Forgetting that mutating an array/object in place and calling `.next(sameReference)` won't reliably trigger change detection or `OnPush` component updates the way emitting a new array/object reference does — always push a new reference, not a mutated one.
- Registering a service in a component's local `providers` array when it was meant to be a single app-wide shared-state singleton — this silently creates a separate instance per component subtree, so state "shared" via that service stops actually being shared.
- Putting HTTP calls directly in components "temporarily" and letting it become permanent — it works for one component but blocks reuse and makes the component impossible to unit test without mocking `HttpClient` at the component level instead of cleanly at the service boundary.
- Not unsubscribing from a service's long-lived `Observable` in a component (or not using the `async` pipe / `takeUntilDestroyed()`), causing the component's callback to keep firing — and the component itself to leak — after it's destroyed, because the *service* (and its subject) outlives the component.

## Interview Questions & Answers

**Q: What is a service, conceptually, and why does Angular push you toward putting logic there instead of in components?**
A: A service is a plain class — usually `@Injectable`-decorated for DI — that owns logic, data access, or state that isn't specific to one component's view. Angular encourages this split because components are meant to focus on presentation and user interaction; putting business logic and API calls into services keeps components thin, makes that logic reusable across multiple components without duplication, and makes it independently unit-testable without needing to render a component or drive change detection.

**Q: How does DI turn a service into a shared singleton, and why does that matter for state management?**
A: When a service is registered with `providedIn: 'root'` (or otherwise provided once at a shared ancestor injector), Angular's injector hands out the exact same instance to every class that injects it. That means any state held inside the service — a `BehaviorSubject`, a plain property — is genuinely shared: one component updating it and another component reading it are looking at the same object in memory, not separate copies. This is why services are the natural place for cross-component shared state, avoiding the need to pass data down through `@Input()` chains or up through `@Output()` chains between components that aren't directly related in the template.

**Q: Why use a `BehaviorSubject` instead of a plain `Subject` for shared state inside a service?**
A: `BehaviorSubject` requires an initial value and always holds a "current" value, which it immediately replays to any new subscriber at the moment they subscribe. A plain `Subject` has no notion of a current value — it only pushes emissions to subscribers that are already listening at the moment `.next()` is called, so a component that mounts and subscribes after the state already changed would miss it entirely with a `Subject` but get the current value right away with a `BehaviorSubject`. For UI state like "is the user logged in" or "current cart contents," that late-subscriber behavior is almost always what you want.

**Q: How would you unit test a service that injects `HttpClient`?**
A: Use `TestBed.configureTestingModule` with `provideHttpClientTesting()` (or the older `HttpClientTestingModule`), inject the service and `HttpTestingController` from `TestBed`, call the service method, then use `httpTestingController.expectOne(url)` to assert the request was made and `.flush(mockResponse)` to simulate the server's response, finally calling `httpTestingController.verify()` to ensure no unexpected requests were made. This tests the service's request-building and response-mapping logic without hitting a real network.

**Q: What's a concrete downside of putting data-fetching logic directly inside a component instead of a service?**
A: It can't be reused — a second component that needs the same data has to duplicate the exact HTTP call and any response-mapping logic, and if the API contract changes, every copy needs updating. It's also harder to test in isolation, since exercising that logic requires instantiating the component (and often triggering change detection / `ngOnInit`) rather than just instantiating a plain injectable class, and the logic's lifetime is tied to the component instance rather than being able to persist as shared state across navigation.

## Related Topics

- [dependency-injection.md](./dependency-injection.md)
- [providers.md](./providers.md)
- [observables.md](./observables.md)
- [components.md](./components.md)
- [client-server-interaction.md](./client-server-interaction.md)
