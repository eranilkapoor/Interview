# Error Boundaries

An error boundary is a component that catches JavaScript errors thrown anywhere in its child component tree — during rendering, in lifecycle methods, and in constructors of the components below it — logs those errors, and renders a fallback UI instead of letting the error propagate up and unmount (crash) the entire application. Without an error boundary, an uncaught error thrown during render anywhere in the tree unmounts the whole React application by default, which is a famously bad user experience for what might be a small, isolated failure in one part of the UI.

As of React 18 and 19, error boundaries must be implemented as class components — there is no hook-based equivalent, and this is one of the few remaining reasons a real application still needs a class component at all. A component becomes an error boundary by implementing `static getDerivedStateFromError(error)`, which is called during the "render" phase after a descendant throws and should return a value used to update state (typically a flag to render fallback UI); and/or `componentDidCatch(error, info)`, which is called during the "commit" phase and is the right place for side effects like logging the error to a reporting service, since `info.componentStack` gives you the component stack trace of where the error occurred. `getDerivedStateFromError` handles *what to render instead*; `componentDidCatch` handles *what to do about it* (logging, reporting).

It's important to be precise about what error boundaries do *not* catch, since this is a frequent interview trap and a real source of production surprises: they don't catch errors inside event handlers (a `try`/`catch` in the handler itself, or a global error handler, is the right tool there, since event handlers aren't part of the render phase); they don't catch errors in asynchronous code (`setTimeout` callbacks, promises, `async`/`await` outside of render); they don't catch errors during server-side rendering; and they don't catch errors thrown inside the error boundary component itself (an error boundary can't catch its own errors — that requires a separate boundary further up the tree). A single error boundary can wrap the entire application for a blunt "don't fully crash" fallback, but it's generally better UX to place several boundaries around independent sections of the UI (a sidebar, a chart widget, a comments section) so that one section failing doesn't take down sections that have nothing to do with it.

Because error boundaries require class-component syntax, and most modern React code is written with function components and hooks, the community-maintained `react-error-boundary` package is very widely used in practice — it provides a function-component-friendly `<ErrorBoundary>` wrapper (implemented as a class internally, since that's still required) along with ergonomic features like a `resetErrorBoundary` callback, a `FallbackComponent`/`fallbackRender` prop, and an `onReset`/`resetKeys` API for recovering from the error state without a full page reload. Using it (or hand-rolling the same class-based boundary) is the standard way to get error-boundary behavior into an otherwise fully hooks-based codebase.

## Examples

```jsx
// A minimal error boundary — must be a class component; no hook equivalent exists
import { Component } from 'react';

class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true }; // triggers fallback UI on the next render
  }

  componentDidCatch(error, info) {
    // Side effect: log to an error reporting service
    console.error('Caught by ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return <h2>Something went wrong.</h2>;
    }
    return this.props.children;
  }
}

// Usage — wraps a section of the app so a crash there doesn't take down everything else
function App() {
  return (
    <div>
      <Header />
      <ErrorBoundary>
        <BuggyWidget />
      </ErrorBoundary>
      <Footer /> {/* Still renders fine even if BuggyWidget throws */}
    </div>
  );
}
```

```jsx
// What error boundaries do NOT catch: errors in event handlers need their own try/catch
function BuggyButton() {
  const handleClick = () => {
    try {
      throw new Error('Boom in an event handler');
    } catch (err) {
      console.error('Handled manually — an error boundary would NOT catch this:', err);
    }
  };
  return <button onClick={handleClick}>Click me</button>;
}
```

```jsx
// Using react-error-boundary for a function-component-friendly API
import { ErrorBoundary } from 'react-error-boundary';

function Fallback({ error, resetErrorBoundary }) {
  return (
    <div role="alert">
      <p>Something went wrong: {error.message}</p>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary
      FallbackComponent={Fallback}
      onReset={() => window.location.reload()}
      onError={(error, info) => logErrorToService(error, info)}
    >
      <BuggyWidget />
    </ErrorBoundary>
  );
}
```

## Common Pitfalls / Gotchas

- Expecting an error boundary to catch errors thrown inside event handlers — it won't; event handlers run outside React's render phase, so they need their own `try`/`catch` or a global `window.onerror`/`addEventListener('error', ...)` handler.
- Expecting an error boundary to catch errors from asynchronous code (`setTimeout`, a rejected promise, an `async` function running after render) — these also happen outside the render phase the boundary monitors, and need to be handled where they occur (e.g., caught and turned into state that render can then act on).
- Wrapping the entire app in exactly one giant error boundary — this technically prevents a full crash, but means any single failure anywhere blanks out the *entire* UI; scoping boundaries around independent sections gives much better failure isolation.
- Forgetting that a boundary can't catch errors thrown by itself — if `componentDidCatch` or `getDerivedStateFromError` (or the fallback render path) themselves throw, the error propagates to the *next* boundary up the tree, not back into the same one.
- Trying to build an error boundary with hooks — there is currently no hook equivalent to `getDerivedStateFromError`/`componentDidCatch`; a class component (or a library like `react-error-boundary` that wraps one) is required as of React 18/19.
- Not resetting the boundary's error state after fixing the underlying condition — once `hasError` is `true`, the fallback stays shown indefinitely unless something (a `key` change on the boundary, or an explicit reset callback) causes it to retry rendering the children.

## Interview Questions & Answers

**Q: What is an error boundary, and what does it catch?**
A: An error boundary is a component that catches JavaScript errors thrown by its child tree during rendering, in lifecycle methods, and in constructors, then renders a fallback UI instead of letting the error unmount the whole application. It's implemented via `static getDerivedStateFromError` (to compute fallback state) and/or `componentDidCatch` (to perform side effects like logging).

**Q: Why must error boundaries currently be class components?**
A: React has not introduced a hook equivalent for `getDerivedStateFromError` or `componentDidCatch` as of React 18/19 — there's no `useErrorBoundary` hook. This is one of the few cases where class-component syntax remains necessary in an otherwise fully hooks-based codebase, which is why libraries like `react-error-boundary` exist to provide a function-component-friendly wrapper around an internally class-based implementation.

**Q: Name three things error boundaries do NOT catch.**
A: Errors thrown inside event handlers (they run outside the render phase), errors in asynchronous code such as `setTimeout` callbacks or rejected promises that aren't surfaced during render, and errors during server-side rendering. A fourth: an error boundary cannot catch an error thrown by itself — that requires a separate boundary higher up the tree.

**Q: What's the difference between `getDerivedStateFromError` and `componentDidCatch`?**
A: `getDerivedStateFromError` runs during the render phase, is meant to be a pure function of the error, and its return value updates state to drive the fallback UI on the next render — it should not perform side effects. `componentDidCatch` runs during the commit phase, receives both the error and a component stack (`info.componentStack`), and is the appropriate place to perform side effects like logging the error to an external reporting service.

**Q: Would you use one error boundary for the whole app, or several? Why?**
A: Generally several, scoped around independent sections of the UI (e.g., a sidebar widget, a chart, a comments section) rather than a single boundary around everything. That way, an error in one isolated feature only degrades that feature's fallback UI, while the rest of the application continues functioning normally — a single top-level boundary technically prevents a full crash but sacrifices this failure isolation.

## Related Topics
- [component-lifecycle.md](./component-lifecycle.md)
- [lazy-loading-and-code-splitting.md](./lazy-loading-and-code-splitting.md)
- [handling-events.md](./handling-events.md)
- [react-testing-basics.md](./react-testing-basics.md)
- [refs-and-forward-ref.md](./refs-and-forward-ref.md)
