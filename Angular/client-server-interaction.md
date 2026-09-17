# Client Server Interaction

An Angular application is a client-side (or SSR-hybrid) program that talks to one or more backend services almost exclusively through HTTP, and `HttpClient` (from `@angular/common/http`) is the framework's built-in abstraction for that. `HttpClient` is provided via `provideHttpClient()` in a standalone app's bootstrap config (`app.config.ts`), or historically via importing `HttpClientModule` into an `NgModule`-based app. Every method on it — `get`, `post`, `put`, `patch`, `delete` — returns a cold RxJS Observable: no request is actually sent until something subscribes (directly, or via the `async` pipe, or via `toSignal`), and each new subscription triggers an independent HTTP call. `HttpClient` is also generic-typed, so `http.get<User[]>('/api/users')` gives you a typed `Observable<User[]>` back, letting TypeScript catch shape mismatches at compile time (assuming the backend actually returns what you declared — Angular doesn't validate the response against the type at runtime).

Interceptors are the mechanism for cross-cutting concerns on every outgoing request/incoming response — attaching an auth token, logging, retry logic, transforming errors into a consistent shape, showing/hiding a global loading spinner. Since Angular 15, the recommended style is **functional interceptors**: a plain function matching the `HttpInterceptorFn` type, `(req, next) => ...`, registered via `provideHttpClient(withInterceptors([authInterceptor, loggingInterceptor]))`. This replaced the older class-based `HttpInterceptor` interface (`intercept(req, next): Observable<HttpEvent<any>>`, provided via the multi-provider `HTTP_INTERCEPTORS` token), which still works and remains common in existing codebases but is no longer the default CLI-recommended pattern. Interceptors form a chain: each one receives the request, can clone-and-modify it (requests are immutable — you call `req.clone({...})` rather than mutating), and calls `next(req)` to pass it along; the response flows back through the same chain in reverse, so an interceptor can also transform or react to the response/error on the way back.

Error handling typically combines `catchError` (an RxJS operator) at the interceptor or call-site level with Angular's typed `HttpErrorResponse`, which distinguishes client-side/network errors (`error.error instanceof ErrorEvent` in older code, though modern guidance checks `error.status === 0` for network-level failures) from server-returned error statuses (`error.status`, `error.statusText`, `error.error` containing whatever body the server sent). A common pattern is a global error interceptor that catches all failures, logs/reports them, and re-throws a normalized error shape so components don't each need bespoke error-parsing logic. `HttpParams` and `HttpHeaders` are immutable builder-style classes for constructing query strings and headers respectively — immutable in the same sense as `HttpRequest`: `.set()`/`.append()` return a *new* instance rather than mutating in place, which trips up people used to mutable APIs (`params.set(...)` alone does nothing; you must use the returned value).

CORS (Cross-Origin Resource Sharing) is worth being precise about in an interview because it's frequently misunderstood as something the frontend controls or can "fix." CORS is a *browser-enforced* security policy: when JavaScript running on origin A (e.g., `https://app.example.com`) tries to `fetch`/XHR a different origin B (e.g., `https://api.example.com`), the browser requires origin B's server to respond with headers (`Access-Control-Allow-Origin`, etc.) explicitly permitting origin A to read the response — otherwise the browser blocks the frontend JavaScript from accessing the response body, even though the HTTP request itself may have actually reached the server and executed. No amount of Angular configuration, interceptor cleverness, or `HttpClient` options can bypass this, because it's enforced by the browser after the response arrives, not something the client can opt out of — the fix must happen on the server (adding the appropriate CORS headers) or via a proxy that makes the request same-origin from the browser's perspective (e.g., Angular CLI's `proxy.config.json` for local dev, or a reverse proxy in production).

## Examples

```ts
// app.config.ts — providing HttpClient with functional interceptors
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './interceptors/auth.interceptor';
import { errorInterceptor } from './interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
  ],
};
```

```ts
// auth.interceptor.ts — a functional interceptor attaching a bearer token
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getToken();
  if (!token) return next(req); // no token yet (e.g., not logged in) — pass through unchanged

  // Requests are immutable; clone() returns a new HttpRequest with the added header
  // rather than mutating the original.
  const authedReq = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
  return next(authedReq);
};
```

```ts
// error.interceptor.ts — normalizing and logging failures for every request
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { NotificationService } from '../notification.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifier = inject(NotificationService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 0) {
        // status 0 typically means the request never got a response at all —
        // network failure, DNS issue, or (very commonly) a CORS rejection by
        // the browser, which never reveals the real underlying cause to JS.
        notifier.show('Network error — check your connection.');
      } else if (err.status === 401) {
        notifier.show('Session expired, please log in again.');
      } else {
        notifier.show(`Request failed: ${err.status} ${err.statusText}`);
      }
      return throwError(() => err); // re-throw so callers can still react if needed
    })
  );
};
```

```ts
// products.service.ts — typed responses, HttpParams, and component-level error handling
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

interface Product { id: number; name: string; price: number; }

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private http = inject(HttpClient);

  search(term: string, inStockOnly: boolean): Observable<Product[]> {
    // HttpParams is immutable: .set() returns a NEW instance, it doesn't mutate `params`.
    const params = new HttpParams()
      .set('q', term)
      .set('inStock', inStockOnly ? 'true' : 'false');

    return this.http.get<Product[]>('/api/products', { params }).pipe(
      catchError(() => of([])) // component-level fallback on top of the global interceptor
    );
  }
}
```

Together these show the layered approach real apps use: a functional interceptor chain for cross-cutting auth/error concerns, and typed, `HttpParams`-driven calls at the service level with their own local error fallback where it matters.

## Common Pitfalls / Gotchas

- Calling `params.set('q', term)` and expecting `params` itself to be updated — `HttpParams` (like `HttpRequest`) is immutable; `.set()`/`.append()` return a new instance, so you must chain or reassign: `params = params.set(...)`.
- Believing a CORS error can be fixed from the Angular/client side — it's a browser-enforced policy requiring the *server* to send the right `Access-Control-Allow-*` headers; no interceptor, `HttpClient` option, or frontend code can work around it (though a dev-time proxy or a same-origin production reverse proxy sidesteps it by making the request appear same-origin).
- Assuming a failed request with `status: 0` in the catch block means "server returned nothing" in a diagnosable way — it's the generic signature for the browser never getting a readable response at all, which covers network failures, DNS errors, and CORS rejections indistinguishably from JavaScript's point of view.
- Forgetting that `HttpClient` responses are Observables, not Promises — subscribing twice to the same `http.get()` call fires two separate HTTP requests; use `shareReplay(1)` (or cache the resulting Promise via `firstValueFrom`) if multiple parts of the app need the same response without re-fetching.
- Registering a class-based `HttpInterceptor` via `HTTP_INTERCEPTORS` in a standalone app without realizing `provideHttpClient(withInterceptorsFromDi())` is required to bridge DI-based interceptors into the standalone provider setup — functional interceptors via `withInterceptors()` don't need this bridge.
- Not handling the interceptor chain's ordering carefully — interceptors run in the array order given to `withInterceptors([...])` on the way out, and in reverse order on the way back for the response, so an auth interceptor that must run before a logging interceptor needs to be listed first.

## Interview Questions & Answers

**Q: Why does `HttpClient` return an Observable instead of a Promise, and what practical difference does that make?**
A: Because it gives you cancellation, retry, and composition for free through RxJS — unsubscribing before a response arrives aborts the request, and operators like `retry`, `timeout`, `switchMap` (to cancel a stale request when a new one starts), and `catchError` compose naturally. The practical difference that trips people up: nothing happens until you subscribe (it's cold), and subscribing twice fires the request twice, unlike a Promise which represents a single already-in-flight (or already-settled) operation shared by anyone holding a reference to it.

**Q: What are functional interceptors and how do they differ from the older class-based `HttpInterceptor`?**
A: A functional interceptor is a plain function matching `HttpInterceptorFn`, `(req, next) => Observable<HttpEvent<unknown>>`, registered via `provideHttpClient(withInterceptors([...]))`; it's the default recommended approach since Angular 15 and fits naturally into the standalone, function-based provider model, using `inject()` for any dependencies instead of constructor injection. The older class-based approach implements the `HttpInterceptor` interface's `intercept(req, next)` method and is registered as a multi-provider on the `HTTP_INTERCEPTORS` token; it still works (and needs `withInterceptorsFromDi()` to participate in a standalone app's `provideHttpClient()` setup) but is no longer the CLI-generated default.

**Q: Explain what CORS actually is and who is responsible for fixing a CORS error.**
A: CORS is a browser security mechanism that restricts JavaScript on one origin from reading responses from a different origin unless that origin's server explicitly allows it via `Access-Control-Allow-Origin` (and related) response headers. The request may well reach the server and even execute (for simple requests) — the browser is blocking the *frontend script's access to the response*, not necessarily the request itself. Because it's enforced by the browser based on the server's response headers, only the server (or something acting as the server from the browser's perspective, like a reverse proxy) can fix it; there is no Angular-side configuration that legitimately bypasses it.

**Q: How would you attach an auth token to every outgoing HTTP request in an Angular app?**
A: Write a functional interceptor that reads the current token (from an injected `AuthService` or token storage), and if present, clones the incoming request with an added `Authorization` header via `req.clone({ setHeaders: { Authorization: 'Bearer ' + token } })`, then passes the cloned request to `next()`. Requests are immutable, so you can't just set a header on `req` directly — you have to clone. Register the interceptor globally via `provideHttpClient(withInterceptors([authInterceptor]))` so it applies to every request without each service needing to remember to attach the header itself.

**Q: How do you handle an error response globally versus locally in an Angular app?**
A: Globally, an error interceptor wraps every request in `catchError`, inspecting `HttpErrorResponse.status` to branch behavior — e.g., redirecting to login on 401, showing a generic toast on 5xx, treating `status === 0` as a network/CORS-level failure — and then re-throws so the error still propagates. Locally, an individual service or component can add its own `catchError` after the interceptor's, either to provide a component-specific fallback value (like an empty list instead of letting the UI show an error state) or to run logic specific to that one call, layering on top of rather than replacing the global handling.

## Related Topics

- [observables.md](./observables.md)
- [dependency-injection.md](./dependency-injection.md)
- [services.md](./services.md)
- [server-side-rendering.md](./server-side-rendering.md)
- [reactive-forms.md](./reactive-forms.md)
