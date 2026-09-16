# Higher-Order Components

A higher-order component (HOC) is a function that takes a component as an argument and returns a new component that wraps it with additional behavior — the naming deliberately parallels "higher-order function" (a function that takes or returns a function), since an HOC is the same idea applied to components: `const EnhancedComponent = withSubscription(WrappedComponent)`. The HOC itself isn't a component; it's a factory that produces one, typically by rendering the original component and injecting extra props, wrapping it in additional markup or context, or conditionally rendering something else entirely (a loading state, a redirect) before the wrapped component ever renders.

Historically, before hooks existed, HOCs (along with render props) were the primary pattern for sharing cross-cutting, stateful logic between components that don't share a natural parent-child relationship — the exact same problem custom hooks solve today. Classic use cases included `connect()` from React Redux (injecting store state and `dispatch` as props), injecting authentication/authorization checks (`withAuth(Component)` redirecting or blocking render if the user isn't logged in), and injecting subscription data from an external source. The pattern let you write the shared logic once and apply it to any component by wrapping it, without needing to duplicate lifecycle methods or state management in every component that needed the behavior.

A few conventions grew up around HOCs to keep them usable: prefixing the factory function with `with` (`withRouter`, `withStyles`, `withSubscription`) to signal at a glance that a component is being enhanced, and setting `displayName` on the returned component (commonly `WrappedComponent.displayName = \`withSubscription(${getDisplayName(Component)})\``) so that React DevTools shows something meaningful instead of a generic `Anonymous` or `_class` entry in the component tree. Forgetting `displayName` is one of the most common HOC-specific complaints, since it makes an already indirect pattern even harder to debug.

HOCs come with real, well-documented downsides that motivated their decline once hooks arrived. Composing several HOCs around one component creates "wrapper hell" — a deeply nested tree of wrapper components in DevTools that obscures the actual component hierarchy and makes debugging harder. HOCs also risk prop name collisions (two different HOCs injecting a prop with the same name, silently overwriting one), and they require careful, manual work to correctly forward refs (`React.forwardRef`) and hoist static methods from the wrapped component onto the wrapper. Custom hooks solve the same underlying problem — sharing reusable stateful logic — without introducing any extra component in the tree at all, which is why HOCs are now mostly seen in legacy codebases and a handful of libraries (like some routing or CSS-in-JS integrations) that predate widespread hooks adoption, rather than in new code.

## Examples

```jsx
// A classic HOC: injects loading/data state from a subscription-like source
import { useState, useEffect } from 'react';

function withSubscription(WrappedComponent, selectData) {
  function WithSubscription(props) {
    const [data, setData] = useState(() => selectData(DataSource, props));

    useEffect(() => {
      const handleChange = () => setData(selectData(DataSource, props));
      DataSource.addListener(handleChange);
      return () => DataSource.removeListener(handleChange);
    }, [props]);

    return <WrappedComponent {...props} data={data} />;
  }

  // Convention: name the wrapper for DevTools clarity
  WithSubscription.displayName = `WithSubscription(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  return WithSubscription;
}

function CommentList({ data }) {
  return <ul>{data.map((c) => <li key={c.id}>{c.text}</li>)}</ul>;
}

const CommentListWithSubscription = withSubscription(CommentList, (source) => source.getComments());
```

```jsx
// A simpler, common HOC use case: an auth guard
function withAuth(WrappedComponent) {
  function WithAuth(props) {
    const isAuthenticated = useAuth(); // some custom hook checking auth state
    if (!isAuthenticated) return <p>Please log in.</p>;
    return <WrappedComponent {...props} />;
  }
  WithAuth.displayName = `WithAuth(${WrappedComponent.displayName || WrappedComponent.name})`;
  return WithAuth;
}

function Dashboard() {
  return <h1>Private Dashboard</h1>;
}
const ProtectedDashboard = withAuth(Dashboard);
```

```jsx
// The modern equivalent of the above, using a custom hook instead of an HOC —
// no extra wrapper component, no displayName bookkeeping, no prop-collision risk
function Dashboard() {
  const isAuthenticated = useAuth();
  if (!isAuthenticated) return <p>Please log in.</p>;
  return <h1>Private Dashboard</h1>;
}
```

## Common Pitfalls / Gotchas

- Stacking multiple HOCs around one component (`withAuth(withSubscription(withRouter(Component)))`) — this creates "wrapper hell," a deeply nested chain of components in the tree and in DevTools that obscures what's actually happening and makes debugging significantly harder.
- Two HOCs injecting props with the same name — since HOCs compose by spreading/overriding props, a naming collision between two independently-written HOCs can silently clobber one of the values with no warning.
- Forgetting to set `displayName` on the returned wrapper component — without it, React DevTools shows a generic or minified name, making the component tree much harder to navigate, especially with multiple HOCs applied.
- Not forwarding refs through the HOC — by default, a `ref` attached to the HOC-wrapped component attaches to the wrapper, not the inner component, so accessing the inner component's DOM node or instance requires explicitly using `React.forwardRef` inside the HOC.
- Recreating the HOC-wrapped component inside another component's render (`function Parent() { const Enhanced = withAuth(Child); return <Enhanced />; }`) — this creates a brand-new component type on every render, causing the wrapped subtree to fully unmount and remount instead of updating in place; HOCs should be applied once, outside of render (typically at module scope).
- Reaching for an HOC in new code where a custom hook would solve the same problem more simply — for logic-sharing (not truly needing to inject markup or intercept rendering), a hook avoids the wrapper-component overhead entirely.

## Interview Questions & Answers

**Q: What is a higher-order component, and what problem was it originally designed to solve?**
A: An HOC is a function that takes a component and returns a new component wrapping it with additional props, behavior, or conditional rendering. It was the primary pre-hooks pattern for sharing reusable, cross-cutting stateful logic (like injecting subscription data, auth checks, or store state) between components that don't share a natural parent-child relationship, without duplicating that logic in every component that needed it.

**Q: What are the main downsides of the HOC pattern?**
A: Composing multiple HOCs creates deeply nested "wrapper hell" in the component tree that's hard to read and debug; HOCs risk silently colliding on injected prop names; refs don't pass through a wrapping HOC automatically and need explicit `forwardRef` handling; and static methods on the wrapped component need to be manually hoisted onto the wrapper. All of this adds indirection that makes an already non-obvious pattern harder to trace.

**Q: How do custom hooks relate to, and largely replace, HOCs?**
A: Both patterns exist to share reusable stateful logic across components. A custom hook accomplishes the same goal by being called directly inside a component's body — no wrapper component is created, so there's no wrapper hell, no prop collisions, and no ref-forwarding workaround needed. For nearly all new code where the goal is purely logic reuse (not literally needing to intercept rendering or inject markup around a component), a custom hook is simpler and is now the preferred approach.

**Q: Why is `displayName` conventionally set on an HOC's returned component?**
A: Without it, React DevTools shows the wrapper component under a generic or minified function name, which becomes especially confusing once multiple HOCs are composed together. Setting `displayName` to something like `withSubscription(CommentList)` makes the enhanced component's origin and purpose immediately visible in the DevTools tree.

**Q: What happens if you call an HOC inside another component's render method instead of at module scope?**
A: It creates a brand-new component type on every single render of the parent, since the HOC returns a new function reference each time it's called. React treats a changed component type as a completely different element, so it will unmount the old wrapped subtree and mount a fresh one on every render — losing state and causing unnecessary DOM churn. HOCs should always be applied once, outside of any component's render function.

## Related Topics
- [render-props.md](./render-props.md)
- [custom-hooks.md](./custom-hooks.md)
- [refs-and-forward-ref.md](./refs-and-forward-ref.md)
- [react-memo.md](./react-memo.md)
- [component-lifecycle.md](./component-lifecycle.md)
