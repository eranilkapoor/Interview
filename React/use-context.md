# useContext

`useContext` is the Hook that lets a component read a value from the nearest matching `Context.Provider` above it in the tree, regardless of how many layers of components sit in between — it's React's built-in answer to the prop-drilling problem for data that genuinely needs to be available broadly across a subtree. Using Context is a two-part process: first, `createContext(defaultValue)` creates a Context object (typically outside any component, at module scope); then, some ancestor component renders `<MyContext.Provider value={someValue}>` around the part of the tree that should have access to it. Any descendant, at any depth, can then call `useContext(MyContext)` to read the current value directly — no props passed through any of the components in between need to know or care that the value even exists.

The `defaultValue` passed to `createContext` is only used as a fallback when a component calls `useContext` and there is *no* matching `Provider` anywhere above it in the tree — it does not, and cannot, override an actual `Provider`'s `value` if one exists higher up. This makes it useful mainly for standalone testing of a component in isolation, or as a sensible fallback (a default theme, for instance) for cases where wrapping in a `Provider` was genuinely optional.

A behavior worth understanding precisely for both correctness and performance: **every** component that calls `useContext(MyContext)` re-renders whenever that Provider's `value` prop changes (compared by reference), regardless of which specific field of that value the component actually uses. If `value` is an object created fresh on every render of the Provider's parent (e.g., `<MyContext.Provider value={{ user, theme }}>` written inline), every single consumer re-renders on every render of that parent, even if neither `user` nor `theme` actually changed — because the object reference itself is new every time. The standard fix is memoizing the value object with `useMemo` (`const value = useMemo(() => ({ user, theme }), [user, theme])`) so the reference stays stable across renders where the underlying data hasn't actually changed — and, for cases with many infrequently-related consumers, splitting a single large Context into multiple smaller, more narrowly-scoped Contexts so a change to one piece of data doesn't force-rerender components that only care about another piece.

Context is best suited to data that's reasonably described as "ambient" or "global-ish" to a subtree rather than being passed between two specific, closely-related components — the canonical examples are the current theme, the authenticated user/session, the active locale/language, or a router's current location. It is not, by itself, a full state-management solution for large, frequently-changing, highly interconnected application state — for that scale of need, a dedicated library like Redux (see [redux-store.md](./redux-store.md)) offers more structure, tooling, and finer-grained update control; see [context-api-vs-redux.md](./context-api-vs-redux.md) for a deeper comparison of when each is the better fit.

## Examples

```jsx
// Basic setup: createContext, a Provider, and useContext in a deeply nested consumer
const AuthContext = createContext(null); // default value used only if no Provider is found

function App() {
  const [user, setUser] = useState({ name: 'Anil', role: 'admin' });
  return (
    <AuthContext.Provider value={user}>
      <Dashboard />
    </AuthContext.Provider>
  );
}

function Dashboard() {
  return <Sidebar />; // doesn't need to know about `user` at all
}

function Sidebar() {
  const user = useContext(AuthContext); // reads directly, skipping Dashboard entirely
  return <p>Welcome, {user.name}</p>;
}
```

```jsx
// Memoizing the Provider's value to avoid re-rendering every consumer unnecessarily
function ThemeProvider({ children }) {
  const [mode, setMode] = useState('dark');

  // Without useMemo, this object is a NEW reference every render of ThemeProvider,
  // forcing every consumer to re-render even when `mode` hasn't actually changed.
  const value = useMemo(
    () => ({ mode, toggle: () => setMode((m) => (m === 'dark' ? 'light' : 'dark')) }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

const ThemeContext = createContext({ mode: 'light', toggle: () => {} });
```

```jsx
// A custom Hook wrapping useContext — a common, ergonomic convention
function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider'); // guards against a missing Provider
  }
  return context;
}

function ThemedButton() {
  const { mode, toggle } = useTheme();
  return <button className={mode} onClick={toggle}>Current: {mode}</button>;
}
```

## Common Pitfalls / Gotchas

- Creating the `value` object passed to a `Provider` inline, fresh on every render (`value={{ user, theme }}`), without `useMemo` — this forces every consumer to re-render on every Provider parent render, even when nothing they actually use changed.
- Assuming `useContext`'s fallback `defaultValue` (from `createContext(defaultValue)`) applies whenever a field is missing from the actual Provider's value — it only applies when there's no matching `Provider` above the consumer at all, never as a per-field fallback within an existing Provider's value.
- Putting too much unrelated data into one giant Context — any change to any part of that combined value re-renders every consumer of the whole Context, even ones that only cared about an unrelated field; splitting into multiple, more targeted Contexts avoids this.
- Forgetting that `useContext` subscribes the *entire* component to that Context's value — there's no built-in way to select just one field and skip re-rendering on changes to other fields (unlike, say, a Redux `useSelector`), without manually splitting Contexts or reaching for a third-party selector-based Context library.
- Using Context as a wholesale replacement for a proper state management library in a large app with frequent, complex, cross-cutting updates — Context is a simple "value broadcast" mechanism, not a full store with actions, reducers, middleware, or fine-grained subscription optimization.

## Interview Questions & Answers

**Q: What problem does `useContext` solve, and how do you set it up?**
A: It solves prop drilling — passing data down through many layers of components that don't use it themselves, purely to relay it to a deeply nested descendant. You create a Context with `createContext(defaultValue)`, wrap the relevant part of the tree in `<MyContext.Provider value={...}>` from some ancestor, and any descendant at any depth reads the current value directly with `useContext(MyContext)`, without any of the components in between needing to know it exists.

**Q: When does a component using `useContext` re-render?**
A: Whenever the nearest matching Provider's `value` prop changes, by reference — regardless of which specific part of that value the component actually reads. This means every consumer of a Context re-renders together whenever the value reference changes, which is why memoizing the value (with `useMemo`) and/or splitting large Contexts into smaller, more targeted ones matters for performance.

**Q: What is the `defaultValue` passed to `createContext` actually used for?**
A: It's the value returned by `useContext` only when there is no matching `Provider` anywhere above that component in the tree. It does not act as a fallback for missing fields within an actual Provider's value, and it's mainly useful for rendering/testing a component in isolation without wrapping it in a real Provider, or as a genuinely optional Provider's sensible default.

**Q: How would you avoid unnecessary re-renders when using Context with an object value?**
A: Wrap the value object passed to the Provider in `useMemo`, keyed on its actual dependencies, so its reference only changes when the underlying data genuinely changes rather than on every render of the Provider's parent component. For cases with many consumers caring about different, independently-changing pieces of data, splitting one large Context into several smaller, more narrowly-scoped Contexts limits which consumers re-render on any given change.

**Q: Is Context a replacement for a state management library like Redux?**
A: Not generally, for large or complex applications. Context is a simple mechanism for broadcasting a value down a subtree — it has no built-in concept of actions, reducers, middleware, or fine-grained per-field subscriptions, and every consumer re-renders together on any value change. Redux (or similar) adds that structure and finer-grained update/debugging tooling, which becomes worthwhile once an app has substantial, complex, frequently-changing, cross-cutting state; Context remains a great fit for simpler, more static "ambient" data like theme, locale, or the authenticated user.

## Related Topics
- [sharing-data-between-components.md](./sharing-data-between-components.md)
- [use-memo.md](./use-memo.md)
- [context-api-vs-redux.md](./context-api-vs-redux.md)
- [redux-store.md](./redux-store.md)
- [custom-hooks.md](./custom-hooks.md)
