# Providers

A provider is a recipe that tells an Angular injector how to create the value for a given DI token. When you write `@Injectable({ providedIn: 'root' })`, you're implicitly writing the simplest possible provider — "when asked for `MyService`, `new` it up." But the full provider syntax — `{ provide: Token, useClass/useValue/useExisting/useFactory: ... }` — exists because not every dependency should be constructed by directly instantiating the requested class: sometimes you want to substitute a different implementation, hand back a static value, alias one token to another, or run custom construction logic that itself needs other injected dependencies.

`useClass` tells the injector to instantiate a *different* class than the one named by the token: `{ provide: LoggerService, useClass: MockLoggerService }` means anywhere code injects `LoggerService`, it actually receives a `MockLoggerService` instance — the injector still runs that class through DI (its own constructor dependencies get resolved normally). This is the standard mechanism for swapping implementations, most commonly in tests. `useValue` skips instantiation entirely and returns a fixed value you already have — used for constants, configuration objects, or mock objects in tests where you don't need (or want) DI to construct anything: `{ provide: APP_CONFIG, useValue: { apiUrl: 'https://api.example.com' } }`. `useExisting` creates an *alias* — it says "resolve this token by resolving that other, already-registered token," returning the same instance rather than creating a second one: `{ provide: NewLoggerService, useExisting: LoggerService }` makes both tokens resolve to one shared `LoggerService` instance, useful when renaming/deprecating a service while keeping backward compatibility, or exposing a specific interface implementation of a broader service (this is exactly how Angular implements `ControlValueAccessor` aliasing for custom form controls). `useFactory` runs an arbitrary function to produce the value, which is the escape hatch for construction logic that depends on runtime conditions or on other injected values — it takes a `deps` array listing the tokens to inject as arguments to the factory function, since a plain function has no constructor for Angular to inspect.

Where a provider is registered determines its **scope** — how long the created instance lives and who can see it — which is a distinct axis from *how* it's created. `providedIn: 'root'` on `@Injectable` registers the provider on the application's root environment injector: one instance, shared app-wide, tree-shakable if unused. Registering the exact same service in a component's `providers: []` array instead creates a new provider on that component's *element injector*, which means a fresh instance is created scoped to that component and its view descendants — every separate instance of that component in the DOM gets its own instance of the service, and that instance is destroyed when the component is destroyed. This is the mechanism for state that should be scoped to one feature or one repeated widget (a wizard's per-instance form state, a modal's local service) rather than shared globally. The same `useClass`/`useValue`/`useFactory` syntax works identically whether it's registered at the root (via `bootstrapApplication`'s `providers` array or `providedIn`), at the route level (a route's `providers` array, scoping to that route and its children), or at the component level.

Provider overriding is central to testing: `TestBed.configureTestingModule({ providers: [{ provide: RealService, useClass: MockService }] })` (or `useValue` with a stub object, or `jasmine.createSpyObj`) swaps out a real dependency — typically one that hits the network, reads `localStorage`, or has other side effects — for a fake one, without touching the component or service under test at all, because the component only ever asked the injector for `RealService` by token; it never knew or cared which concrete implementation it would get. This is DI's core testing payoff: code that depends on abstractions (or at least on injectable tokens) rather than directly instantiating its own dependencies can be tested in isolation by substituting what the injector hands back.

## Examples

```ts
import { InjectionToken } from '@angular/core';

// useValue: register a plain constant/config object as a provider.
export const API_BASE_URL = new InjectionToken<string>('api.base.url');

export const appConfig = {
  providers: [
    { provide: API_BASE_URL, useValue: 'https://api.example.com' },
  ],
};

// useClass: swap in an alternate implementation behind the same token.
abstract class PaymentGateway {
  abstract charge(amount: number): Promise<void>;
}
class StripeGateway extends PaymentGateway {
  async charge(amount: number) { /* real Stripe call */ }
}
class SandboxGateway extends PaymentGateway {
  async charge(amount: number) { console.log(`sandbox charge: ${amount}`); }
}

// In a dev/staging environment config, swap the implementation without touching consumers:
{ provide: PaymentGateway, useClass: environment.production ? StripeGateway : SandboxGateway }
```
This shows `useValue` for a plain constant and `useClass` for swapping an implementation based on environment — consumers only ever inject `PaymentGateway` and never know which concrete class they got.

```ts
import { HttpClient } from '@angular/common/http';

// useFactory: construction logic that itself needs other injected dependencies,
// via the `deps` array (factory functions have no constructor for DI to inspect).
export function loggerFactory(http: HttpClient, config: AppConfig) {
  return config.remoteLogging
    ? new RemoteLoggerService(http, config.loggingEndpoint)
    : new ConsoleLoggerService();
}

export const loggerProvider = {
  provide: LoggerService,
  useFactory: loggerFactory,
  deps: [HttpClient, APP_CONFIG],
};

// useExisting: alias one token to another WITHOUT creating a second instance.
export const providers = [
  LoggerService,
  { provide: LegacyLoggerToken, useExisting: LoggerService }, // same instance, old token name
];
```
This demonstrates `useFactory` with `deps` for conditional runtime construction, and `useExisting` for aliasing — `inject(LegacyLoggerToken)` and `inject(LoggerService)` return the exact same object, not two separate instances.

```ts
import { TestBed } from '@angular/core/testing';

describe('OrderComponent', () => {
  let mockPaymentGateway: jasmine.SpyObj<PaymentGateway>;

  beforeEach(() => {
    mockPaymentGateway = jasmine.createSpyObj('PaymentGateway', ['charge']);

    TestBed.configureTestingModule({
      imports: [OrderComponent], // standalone component
      providers: [
        // Override the real gateway with a spy for this test module only.
        { provide: PaymentGateway, useValue: mockPaymentGateway },
      ],
    });
  });

  it('calls charge with the order total', () => {
    mockPaymentGateway.charge.and.returnValue(Promise.resolve());
    const fixture = TestBed.createComponent(OrderComponent);
    fixture.componentInstance.submitOrder(42);
    expect(mockPaymentGateway.charge).toHaveBeenCalledWith(42);
  });
});
```
This is the standard testing pattern: `TestBed.configureTestingModule`'s `providers` array overrides `PaymentGateway`'s real provider with a Jasmine spy object via `useValue`, so `OrderComponent` is tested without ever hitting a real payment API.

## Common Pitfalls / Gotchas

- Using `useClass` when you meant `useExisting` (or vice versa) — `useClass` always constructs a *new* instance of the class, so aliasing two tokens with `useClass` gives you two separate instances with independent state, silently breaking any code that assumed they were the same object.
- Forgetting the `deps` array on `useFactory` — without it, the factory function is called with no arguments, and any parameters silently end up `undefined` instead of erroring loudly.
- Re-registering a `providedIn: 'root'` service in a component's local `providers` array by accident (e.g., copy-pasting boilerplate) — this creates a second, component-scoped instance that shadows the root singleton for that subtree, breaking shared state without any obvious error.
- Assuming provider order in the `providers` array doesn't matter — for multi-providers it determines invocation order (e.g., HTTP interceptor chain order), and for `useFactory`'s `deps`, order must exactly match the factory function's parameter order.
- Overriding a provider in `TestBed` after the module has already been compiled (e.g., calling `configureTestingModule` again after `createComponent`) — this throws, since `TestBed` freezes configuration once a component has been created from it.
- Forgetting that a component-level provider override only affects that component and its descendants — a sibling component elsewhere in the tree that injects the same token still gets whatever the ancestor/root provided, which surprises people expecting a single override to apply app-wide.

## Interview Questions & Answers

**Q: What's the difference between `useClass`, `useValue`, `useExisting`, and `useFactory`?**
A: `useClass` instantiates a specified class (which can differ from the token itself) and runs it through DI normally, so its own constructor dependencies get resolved. `useValue` returns a fixed, already-constructed value with no instantiation at all — good for constants and simple mocks. `useExisting` aliases the token to another already-registered token, returning the *same* instance rather than creating a new one. `useFactory` calls an arbitrary function to produce the value, paired with a `deps` array so Angular knows what to inject as arguments, which is needed for construction logic that depends on runtime conditions or other services.

**Q: How does registering a service via `providedIn: 'root'` differ in scope from providing it in a component's `providers` array, given the exact same provider syntax works in both places?**
A: `providedIn: 'root'` registers on the application's root environment injector, giving one app-wide singleton that's also tree-shakable if unused. Registering the same provider in a component's `providers: []` array instead creates it on that component's element injector, so a new instance is created for that specific component subtree — every separate instance of the component gets its own instance, and it's destroyed along with the component. The provider configuration syntax (`useClass`, etc.) is identical; only the registration location changes the lifetime and visibility.

**Q: How would you swap a real service for a mock in a unit test, and why does DI make this straightforward?**
A: In `TestBed.configureTestingModule`, pass a `providers` array entry that overrides the token, e.g. `{ provide: RealService, useValue: mockObject }` or `useClass: MockService`. It's straightforward because the component or service under test never constructs `RealService` itself — it only ever asks the injector for whatever's registered against that token — so substituting the provider is invisible to the consumer and requires no changes to its code.

**Q: When would you reach for `useFactory` over `useClass`?**
A: When construction needs logic beyond "call `new`" — for example, picking between two implementations based on an environment flag or a config value, doing async-adjacent setup, or needing to inject something a plain constructor can't express because it depends on multiple other providers combined conditionally. `useClass` is for a straight swap of one class for another with normal constructor-based DI; `useFactory` is for anything that needs custom construction logic in between.

**Q: What does `useExisting` actually give you that `useClass` doesn't?**
A: A true alias to the same instance. If two tokens both need to resolve to one shared object — for example, deprecating an old token name while keeping backward compatibility, or exposing a service under a more specific interface-like token — `useExisting` guarantees `inject(TokenA) === inject(TokenB)`. `useClass` would instantiate the class fresh for each token, giving you two independent objects that happen to be the same type but don't share state.

## Related Topics

- [dependency-injection.md](./dependency-injection.md)
- [services.md](./services.md)
- [components.md](./components.md)
- [modules.md](./modules.md)
