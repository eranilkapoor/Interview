# Testing Angular Applications

Angular applications are typically tested at three levels: unit tests for individual components/services/pipes in isolation, integration tests that check how a few pieces work together (a component with its real child components or a service it depends on), and end-to-end (E2E) tests that drive the actual running application through a real browser the way a user would. The Angular CLI historically scaffolded Karma + Jasmine for unit tests by default; as of recent Angular versions, Jest is officially supported as a first-class alternative test runner, and many teams now prefer it for faster execution and a more modern developer experience — the testing *patterns* (TestBed, component harnesses, spies) stay largely the same regardless of which runner executes them.

`TestBed` is Angular's core testing utility: it creates an isolated Angular testing module (similar to a real `NgModule`/standalone component's dependency graph) so a component or service can be instantiated with real or mocked dependencies, without bootstrapping the entire application. For a component test, `TestBed.createComponent()` returns a `ComponentFixture`, which gives access to the component instance, its rendered `DebugElement`/native DOM, and a `detectChanges()` method to manually trigger change detection (tests don't run inside Angular's normal zone-driven change-detection loop by default, so you call this explicitly after changing state you want reflected in the DOM).

A well-tested Angular component isolates the unit under test by mocking its dependencies — injected services are replaced with spy objects or lightweight fakes via `TestBed.configureTestingModule({ providers: [{ provide: RealService, useValue: fakeService }] })` rather than letting a component test accidentally also test a real HTTP service or a real database call. For asynchronous code (observables, promises, `setTimeout`), Angular's testing utilities provide `fakeAsync`/`tick()` to deterministically advance simulated time without actually waiting, and `waitForAsync()`/`async` for genuinely async operations that need to resolve naturally — using real `setTimeout`s or unhandled promises in tests leads to flaky, slow test suites.

## Examples

```typescript
// Testing a component with a mocked service dependency
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { UserProfileComponent } from './user-profile.component';
import { UserService } from './user.service';
import { of } from 'rxjs';

describe('UserProfileComponent', () => {
  let fixture: ComponentFixture<UserProfileComponent>;
  let mockUserService: jasmine.SpyObj<UserService>;

  beforeEach(() => {
    mockUserService = jasmine.createSpyObj('UserService', ['getUser']);
    mockUserService.getUser.and.returnValue(of({ id: 1, name: 'Ada Lovelace' }));

    TestBed.configureTestingModule({
      imports: [UserProfileComponent], // standalone component
      providers: [{ provide: UserService, useValue: mockUserService }],
    });

    fixture = TestBed.createComponent(UserProfileComponent);
  });

  it('renders the fetched user name', () => {
    fixture.detectChanges(); // triggers ngOnInit + template rendering
    const nameEl = fixture.nativeElement.querySelector('.user-name');
    expect(nameEl.textContent).toContain('Ada Lovelace');
    expect(mockUserService.getUser).toHaveBeenCalledTimes(1);
  });
});
```

```typescript
// Testing a service that uses HttpClient, without hitting a real network
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ProductService } from './product.service';

describe('ProductService', () => {
  let service: ProductService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ProductService],
    });
    service = TestBed.inject(ProductService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify()); // fails the test if any request wasn't expected/flushed

  it('fetches products from the correct endpoint', () => {
    service.getProducts().subscribe(products => {
      expect(products.length).toBe(2);
    });

    const req = httpMock.expectOne('/api/products');
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1 }, { id: 2 }]); // simulate the server response
  });
});
```

```typescript
// fakeAsync + tick(): deterministically testing debounced/delayed logic
import { fakeAsync, tick } from '@angular/core/testing';

it('debounces search input by 300ms', fakeAsync(() => {
  let callCount = 0;
  const search$ = searchSubject.pipe(debounceTime(300));
  search$.subscribe(() => callCount++);

  searchSubject.next('a');
  searchSubject.next('an');
  searchSubject.next('ang');

  tick(299);
  expect(callCount).toBe(0); // debounce hasn't fired yet

  tick(1);
  expect(callCount).toBe(1); // only the last emission triggers the callback
}));
```

## Common Pitfalls / Gotchas

- Forgetting to call `fixture.detectChanges()` after `TestBed.createComponent()` and then wondering why the template/DOM appears empty — Angular doesn't run change detection automatically the first time in a test the way it does in a running app.
- Letting a component test also exercise a real service's real HTTP calls or real dependencies instead of mocking them — this turns a fast, isolated unit test into a slow, flaky integration test, and a failure no longer tells you *which* piece broke.
- Using real `setTimeout`/`setInterval` and real waiting in tests instead of `fakeAsync`/`tick()` — this makes the test suite slow and can introduce flakiness under CI load; `fakeAsync` lets you advance simulated time instantly and deterministically.
- Not calling `httpMock.verify()` (or the equivalent for whatever HTTP testing utility is in use) — without it, a test can pass even though an expected HTTP request was never actually made, silently hiding a real bug.
- Testing implementation details (spying on a private method, checking exact internal call counts that aren't behaviorally meaningful) instead of observable behavior (what's rendered, what the public API returns) — this makes tests brittle to harmless refactors.
- Sharing mutable mock state across tests without resetting it in `beforeEach`, causing test order-dependent failures that are hard to reproduce.

## Interview Questions & Answers

**Q: What is `TestBed`, and why is it needed instead of just instantiating a component class directly with `new`?**
A: `TestBed` builds an isolated Angular testing module that replicates the dependency-injection and compilation environment a component or service actually needs to run — resolving `@Input`/`@Output` bindings, injecting dependencies (real or mocked), and compiling the component's template. Instantiating a component class directly with `new` would skip Angular's DI entirely and wouldn't render or process the template at all, so it can't validate anything about how the component actually behaves inside Angular.

**Q: Why do you have to call `fixture.detectChanges()` manually in a test?**
A: In a running application, Zone.js-driven change detection runs automatically after async events. Angular's testing utilities deliberately don't run change detection automatically after `TestBed.createComponent()`, so the test has full control over exactly when the DOM should be updated to reflect the component's state — this makes tests deterministic and lets you assert on the "before update" state if needed before calling `detectChanges()` yourself.

**Q: How do you test a component that depends on a service making an HTTP call, without hitting a real backend?**
A: Import `HttpClientTestingModule` (or provide `HttpClientTestingModule`'s modern equivalent) in the `TestBed` configuration, inject `HttpTestingController`, and use `httpMock.expectOne(url)` to assert a specific request was made and `req.flush(mockData)` to simulate the server's response synchronously, entirely in-memory. Calling `httpMock.verify()` in `afterEach` ensures no unexpected or unflushed requests slip through unnoticed.

**Q: What's the difference between `fakeAsync`/`tick()` and `waitForAsync()`?**
A: `fakeAsync` runs the test in a special zone where asynchronous operations like `setTimeout`, `setInterval`, and promise resolution can be controlled synchronously via `tick(milliseconds)`, advancing virtual time instantly without actually waiting — ideal for debounce/throttle/timer-based logic. `waitForAsync()` (formerly `async()`) instead lets genuinely asynchronous operations (like a real promise) resolve naturally within the test zone, and the test waits for them for real — used when you can't or don't want to fake the passage of time, such as when testing against real microtask timing.

**Q: How would you unit test a component versus writing an E2E test for the same feature — when do you need both?**
A: A unit/component test (via `TestBed`) verifies the component's logic and rendering in isolation, fast and deterministic, and is where most test coverage should live. An E2E test (Cypress, Playwright, or historically Protractor) drives the real, fully-built application in a real browser, verifying that multiple pieces (routing, real HTTP calls, real styling/visibility, third-party integrations) work together the way a user actually experiences them — slower and more expensive to run and maintain, so E2E coverage is typically reserved for critical user journeys (login, checkout) rather than exhaustive feature coverage.

## Related Topics
- [components.md](./components.md)
- [dependency-injection.md](./dependency-injection.md)
- [client-server-interaction.md](./client-server-interaction.md)
- [observables.md](./observables.md)
