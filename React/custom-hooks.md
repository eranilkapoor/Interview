# Custom Hooks

A custom hook is simply a JavaScript function whose name starts with `use` and that calls one or more built-in (or other custom) hooks inside it. There's no special syntax or registration step — it's a normal function that follows React's naming convention so both React and the linter (`eslint-plugin-react-hooks`) can identify it as a hook and enforce the Rules of Hooks on it (only call hooks at the top level, only call them from React function components or other hooks). Custom hooks exist purely to let you extract and reuse *stateful logic* — the pattern of hook calls, effects, and derived values — between components, in situations where that logic can't be reused simply by extracting a plain function or component.

The critical thing to understand is that a custom hook shares logic, not state. Every component that calls the same custom hook gets its own, completely independent instance of that hook's internal state — calling `useLocalStorage('theme')` in two different components does not link them together; each call creates its own separate `useState`/`useEffect` internally, tied to that particular component's fiber. This is a common point of confusion for developers coming from other patterns (like singletons or global stores) — a custom hook is a reusable *recipe* for state and effects, not a shared instance of state itself. If you actually want state shared across components, you need lifting state up, Context, or an external store, not just a custom hook.

Custom hooks are built by composing existing hooks together and returning whatever values or functions the consuming component needs — commonly an array (mirroring `useState`'s `[value, setValue]` convention) or an object (when there are more than two or three return values, for clarity at the call site). Internally, a custom hook is free to call `useState`, `useEffect`, `useRef`, `useContext`, or even other custom hooks, and all of the Rules of Hooks still apply within it exactly as they would in a component.

The practical value of custom hooks is enormous: they let you pull duplicated `useEffect`/`useState` combinations (data fetching with loading/error state, subscribing to a browser API, debouncing a value, syncing with `localStorage`) out of multiple components into one well-tested, well-named function, dramatically improving readability and reducing bugs from copy-pasted effect logic. They're also largely why the higher-order-component and render-props patterns fell out of favor for new code — custom hooks solve the same "share logic across components" problem far more directly, without extra wrapper components, prop-name collisions, or the "wrapper hell" that comes from stacking multiple HOCs.

## Examples

```jsx
// useFetch: a reusable data-fetching hook with loading/error/data state
import { useState, useEffect } from 'react';

function useFetch(url) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(url)
      .then((res) => res.json())
      .then((json) => { if (!cancelled) setData(json); })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; }; // avoid setting state after unmount
  }, [url]);

  return { data, error, loading };
}

// Usage — each call gets its own independent loading/error/data state
function UserProfile({ userId }) {
  const { data: user, loading, error } = useFetch(`/api/users/${userId}`);
  if (loading) return <p>Loading...</p>;
  if (error) return <p>Failed to load user.</p>;
  return <h2>{user.name}</h2>;
}
```

```jsx
// useLocalStorage: syncing a piece of state with localStorage
import { useState, useEffect } from 'react';

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue]; // mirrors useState's return shape
}

function ThemeToggle() {
  const [theme, setTheme] = useLocalStorage('theme', 'light');
  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      Current theme: {theme}
    </button>
  );
}
```

```jsx
// Composing multiple built-in hooks inside a custom hook: useDebouncedValue
import { useState, useEffect } from 'react';

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeoutId); // cancel the pending update if value changes again
  }, [value, delayMs]);

  return debounced;
}

function SearchInput() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    if (debouncedQuery) console.log('Searching for:', debouncedQuery);
  }, [debouncedQuery]);

  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```

## Common Pitfalls / Gotchas

- Forgetting that each call to a custom hook creates independent state — expecting `useCounter()` called in two sibling components to share a count is a common misconception; use Context or a shared store if the state itself (not just the logic) needs to be shared.
- Naming a function `useSomething` when it doesn't actually call any hooks internally — this misleads both readers and the hooks linter into applying Rules-of-Hooks assumptions that don't apply; conversely, naming a hook-calling function without the `use` prefix disables the linter's ability to check it.
- Violating the Rules of Hooks inside the custom hook itself — calling hooks conditionally, in loops, or after an early return inside the custom hook is just as invalid as doing it directly in a component, since the custom hook's calls execute in the same fiber's hook list.
- Returning a new object or array literal from a custom hook on every call without memoizing it — if that return value is passed as a prop to a `React.memo`-wrapped child, the new reference on every render defeats the memoization even though the underlying data hasn't changed.
- Overusing custom hooks to "hide" side effects that would be clearer as plain, explicit code in the component — extracting logic into a hook is worthwhile when it's reused or when it meaningfully simplifies the component, not merely for the sake of indirection.

## Interview Questions & Answers

**Q: What makes a function a "custom hook," and why does the naming convention matter?**
A: Structurally, a custom hook is just a plain function that calls other hooks internally — there's no special React API for defining one. The `use` naming prefix is a convention that lets both React's linting tools and other developers recognize that this function follows the Rules of Hooks and may contain state, effects, or other hook calls, enabling static checks (like verifying it isn't called conditionally) that wouldn't otherwise be possible.

**Q: Do two components that call the same custom hook share state?**
A: No. Each call site gets its own completely independent instance of whatever state and effects the custom hook sets up internally — React tracks hook state per component instance (per fiber), so `useToggle()` in `ComponentA` and `useToggle()` in `ComponentB` are entirely separate pieces of state that happen to be initialized by the same code. To actually share state between components, you need to lift it to a common ancestor, use Context, or use an external store.

**Q: How do custom hooks compare to higher-order components and render props for sharing logic?**
A: All three solve the same underlying problem — reusing stateful logic across components — but custom hooks do it without introducing any extra component in the tree. HOCs wrap a component in another component (risking prop name collisions and "wrapper hell" when several are composed), and render props require a function-as-child/prop and an extra layer of nesting in the JSX. A custom hook is just called directly inside the consuming component's body, composing flatly with no wrapper elements or nesting, which is why hooks have largely replaced both patterns for new code.

**Q: Can a custom hook call another custom hook?**
A: Yes — composition is exactly how nontrivial custom hooks are typically built. For example, a `useAuthenticatedFetch` hook might internally call both `useFetch` and a `useAuth` hook to inject an auth token into the request, as long as every hook call still happens unconditionally at the top level of each function involved.

**Q: What return shape should a custom hook use — an array or an object?**
A: Either is valid; the choice is about ergonomics. An array (like `useState`'s `[value, setValue]`) lets consumers freely rename the destructured values, which is convenient when a component might use the same hook more than once with different names. An object is generally clearer once there are more than two or three returned values, since object destructuring lets callers pick only the fields they need by name rather than tracking positional order.

## Related Topics
- [react-hooks-overview.md](./react-hooks-overview.md)
- [use-state.md](./use-state.md)
- [use-effect.md](./use-effect.md)
- [higher-order-components.md](./higher-order-components.md)
- [render-props.md](./render-props.md)
- [use-ref.md](./use-ref.md)
