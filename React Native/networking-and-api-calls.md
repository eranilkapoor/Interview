# Networking and API Calls

React Native ships the standard `fetch` API — the same `fetch(url, options)` signature and `Response` object shape as the web — implemented natively rather than via a browser's networking stack, so it avoids some of the historical XMLHttpRequest quirks and inconsistencies you'd worry about across web browsers. Functionally it behaves like web `fetch`: it returns a Promise resolving to a `Response`, `response.ok`/`response.status` need to be checked manually (fetch does **not** reject on HTTP error statuses like 404 or 500 — it only rejects on network failure, so a `try/catch` around `fetch` will not catch a 500 response), and the body needs an explicit `.json()`/`.text()` call, itself async. One genuine platform difference: there is no browser origin, so the same-origin policy and CORS as web developers know it don't apply the same way to a native `fetch` call from an iOS or Android app — a native app isn't "a page from origin X asking for origin Y," so classic browser CORS preflight/blocking doesn't happen the way it does in a web app. That said, CORS can still be relevant indirectly — e.g., inside Expo's web target, inside a WebView, or if a backend enforces its own allow-list logic based on headers it expects a browser to send — so it's not accurate to say CORS is entirely irrelevant to RN development, just that the browser-enforced mechanism itself doesn't gate native requests.

Two things `fetch` conspicuously lacks that show up constantly in interviews and real code: a built-in timeout, and — natively — clean cancellation. `fetch` will hang indefinitely waiting for a server that never responds unless you build a timeout yourself, typically by racing the fetch against a `setTimeout`-driven rejection or, more correctly, by wiring an `AbortController` and calling `abort()` after a timer fires. `AbortController` is also the mechanism for cancellation in general — passing `controller.signal` as `fetch`'s `signal` option lets you cancel an in-flight request (e.g., a component unmounting mid-request, or a new search query superseding a stale one), and the aborted fetch rejects with an `AbortError` that needs to be distinguished from a real network failure in your `catch` block.

Because mobile networks are unreliable in ways typical web deployments aren't — subway tunnels, elevators, airplane mode, spotty cell coverage — production RN apps need explicit offline handling, which `fetch` alone doesn't provide. `@react-native-community/netinfo` is the standard library for this: `NetInfo.fetch()` gives a one-shot read of current connectivity (`isConnected`, `isInternetReachable`, `type` — wifi/cellular/none/etc.), and `NetInfo.addEventListener(callback)` subscribes to connectivity changes so the app can react in real time — queue writes, show an offline banner, pause polling. Retry logic on top of that (exponential backoff for transient failures, distinguishing retryable errors like timeouts/5xx from non-retryable ones like 401/404) is typically hand-rolled or comes from a data-fetching library's built-in retry behavior (React Query and SWR both have configurable retry/backoff out of the box), since neither `fetch` nor `axios` implement retry themselves.

`axios` is the most common `fetch` alternative in RN codebases, and its appeal for React Native specifically is less about the web-facing conveniences (automatic JSON parsing/stringifying, request/response interceptors) and more about ergonomics that `fetch` makes you build by hand: axios rejects on non-2xx status automatically, has first-class request cancellation (historically via `CancelToken`, now also via the same `AbortController` signal), supports a `timeout` option directly, and has interceptors that are a natural place to attach auth headers globally or handle 401s with a token-refresh flow. Neither is objectively "correct" — `fetch` is zero-dependency and sufficient for simple apps, `axios` earns its bundle-size cost once an app has enough endpoints that request/response interceptors, automatic error rejection, and a built-in timeout save meaningfully more code than they cost.

## Examples

```js
// fetch with a manual timeout + AbortController, and the classic "fetch doesn't
// reject on HTTP errors" gotcha handled explicitly
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      // fetch only rejects on network failure — a 404/500 resolves normally,
      // so HTTP errors must be checked and thrown explicitly
      throw new Error(`Request failed with status ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}
```

This wraps `fetch` with both a timeout (via `AbortController.abort()` fired from a `setTimeout`) and the `response.ok` check that `fetch` requires you to do manually, since a 500 response resolves the Promise rather than rejecting it.

```jsx
// NetInfo: react to connectivity changes and gate network calls on real reachability
import { useEffect, useState, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';

function useOfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // One-shot check on mount
    NetInfo.fetch().then((state) => {
      setIsOffline(!(state.isConnected && state.isInternetReachable));
    });

    // Ongoing subscription — isInternetReachable can be false even on wifi
    // (e.g., connected to a router with no actual internet)
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!(state.isConnected && state.isInternetReachable));
    });

    return unsubscribe;
  }, []);

  return isOffline;
}

async function submitFormIfOnline(payload) {
  const state = await NetInfo.fetch();
  if (!state.isConnected) {
    throw new Error('No network connection — request was not sent');
  }
  return fetchWithTimeout('https://api.example.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
```

`NetInfo.fetch()` gives a one-time connectivity snapshot while `addEventListener` keeps a component in sync with changes over time; note the check uses both `isConnected` (device has a network interface up) and `isInternetReachable` (that interface actually reaches the internet), since a device can be "connected" to Wi-Fi with no real internet access.

```js
// Retry with exponential backoff, cancellable via AbortController, distinguishing
// retryable vs. non-retryable failures
async function fetchWithRetry(url, options = {}, { retries = 3, baseDelayMs = 500 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status >= 500 && attempt < retries) {
        throw new Error(`Server error ${response.status}, retrying`);
      }
      return response; // includes non-retryable 4xx — caller decides how to handle those
    } catch (err) {
      if (err.name === 'AbortError' || attempt === retries) {
        throw err; // don't retry a deliberate cancellation, or if attempts are exhausted
      }
      const delay = baseDelayMs * 2 ** attempt; // 500ms, 1000ms, 2000ms, ...
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Usage with cancellation, e.g. from a search-as-you-type input
function search(query) {
  const controller = new AbortController();
  const promise = fetchWithRetry(
    `https://api.example.com/search?q=${encodeURIComponent(query)}`,
    { signal: controller.signal }
  );
  return { promise, cancel: () => controller.abort() };
}
```

Exponential backoff spaces retries progressively further apart to avoid hammering a struggling server, retries only on server errors (5xx) rather than client errors (4xx, which won't succeed on retry), and respects an `AbortError` as a deliberate cancellation that should propagate immediately rather than be retried.

## Common Pitfalls / Gotchas

- Assuming `fetch` rejects on a 404 or 500 response — it only rejects on genuine network failure (DNS failure, no connection, aborted request); HTTP error statuses resolve normally and must be checked via `response.ok`/`response.status`.
- Not setting a timeout — `fetch` has no built-in timeout option, so a hung server or dead connection leaves the request pending indefinitely unless you wire up `AbortController` with a `setTimeout` yourself.
- Forgetting to cancel in-flight requests on unmount or on a superseding request (e.g., fast typing in a search box firing overlapping requests) — without `AbortController`, a slow, stale response can resolve after a newer one and incorrectly overwrite fresher state.
- Treating `isConnected` from NetInfo as sufficient for "the internet works" — a device can be connected to a Wi-Fi network with no actual internet access; `isInternetReachable` is the more accurate signal, though it can lag slightly behind reality.
- Retrying non-idempotent requests (like a POST that creates a resource) blindly on failure — a naive retry loop can create duplicate records if the original request actually succeeded server-side but the response was lost; retries need idempotency keys or to be limited to safe (GET) methods.
- Expecting web-style CORS errors/behavior in native RN network code — the browser origin/CORS enforcement model doesn't apply the same way outside a browser context, so a request that would be blocked by CORS on web can succeed unexpectedly (or fail for unrelated reasons) when run from a native app.

## Interview Questions & Answers

**Q: Does `fetch` throw an error for a 404 or 500 response?**
A: No — `fetch`'s Promise only rejects for actual network-level failures like a lost connection, DNS failure, or an aborted request. An HTTP error status like 404 or 500 still resolves the Promise successfully with a `Response` object; you have to check `response.ok` (or `response.status`) yourself and explicitly throw if it indicates failure, which is a common source of bugs when a `try/catch` around a raw `fetch` call is assumed to catch HTTP errors and doesn't.

**Q: How do you implement a request timeout with `fetch`, since it doesn't support one natively?**
A: You create an `AbortController`, pass its `signal` into the `fetch` options, and start a `setTimeout` that calls `controller.abort()` after the desired duration; if the timer fires before the response arrives, the fetch rejects with an `AbortError`, which you distinguish from a genuine network error in your `catch` block. This same `AbortController` mechanism is also how you implement manual cancellation, e.g., aborting a request when a component unmounts or when a newer request supersedes an older one.

**Q: How would you handle a user going offline mid-session in a React Native app?**
A: Use `@react-native-community/netinfo`'s `addEventListener` to subscribe to connectivity changes and drive UI state (an offline banner, disabling submit buttons, pausing polling) in real time, and use `NetInfo.fetch()` for one-off checks before firing a request that shouldn't be attempted offline. For a more resilient app, you'd also queue mutations locally (e.g., in AsyncStorage or a local database) while offline and flush the queue once connectivity returns, rather than just failing the request outright.

**Q: What does axios give you over raw `fetch`, and when is it worth the dependency?**
A: Axios automatically rejects on non-2xx responses, supports a `timeout` option directly, has request/response interceptors (a natural place to attach auth headers or implement a token-refresh flow on 401), and has had built-in cancellation support longer than `fetch`'s ecosystem-standard `AbortController` pattern matured. It's worth adding once an app has enough API surface that these conveniences meaningfully reduce boilerplate; for a small app with a couple of endpoints, `fetch` alone is often sufficient and avoids an extra dependency.

**Q: How would you implement retry-with-backoff for a flaky network call, and what would you be careful about?**
A: Wrap the request in a loop that retries on retryable failures (network errors, 5xx server errors, timeouts) up to a max attempt count, with each retry delayed by an exponentially increasing interval (e.g., 500ms, 1s, 2s) to avoid hammering a struggling server. You'd avoid retrying non-idempotent requests (like a POST creating a resource) without an idempotency key, since retrying after a response was lost — even though the original request succeeded server-side — can create duplicate data; you'd also make sure a deliberate cancellation (`AbortError`) short-circuits the retry loop instead of being retried.

## Related Topics
- [async-storage.md](./async-storage.md)
- [app-state-and-lifecycle.md](./app-state-and-lifecycle.md)
- [security-in-react-native.md](./security-in-react-native.md)
- [performance-optimization-in-react-native.md](./performance-optimization-in-react-native.md)
- [push-notifications.md](./push-notifications.md)
- [../React/use-effect.md](../React/use-effect.md)
