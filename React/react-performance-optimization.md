# React Performance Optimization

React re-renders a component whenever its state changes, its parent re-renders, or the context it consumes changes — and by default it re-renders the entire subtree under that point rather than figuring out on its own which parts "actually need" to update. Most of the time this is fast enough that you should not think about it at all; React's reconciliation (see [virtual-dom-and-reconciliation.md](./virtual-dom-and-reconciliation.md)) is cheap for small-to-medium trees, and premature optimization tends to add complexity (memoization, extra `useCallback`/`useMemo` wrapping) without measurable benefit. Performance work should start with *measuring*, not guessing — the React DevTools Profiler lets you record a render pass, see which components rendered, how long each took, and *why* each one rendered (props changed, state changed, parent re-rendered, context changed), which turns "this feels slow" into a concrete, fixable target.

The single biggest lever for avoiding unnecessary re-renders is architecture, not memoization APIs: keeping state as close as possible to where it's used (state colocation) so that a state update only re-renders the small subtree that actually depends on it, rather than a large ancestor that re-renders everything beneath it. Splitting a large component into smaller ones along state boundaries, and passing `children` down instead of rendering it inline inside a component that re-renders often, are both ways of structurally limiting the blast radius of a re-render — a component receiving `children` as a prop doesn't need to re-render its children just because its own local state changed, since the `children` element was already created by the parent above it. A closely related trap is creating new object, array, or function literals inline as props on every render (`<Child options={{ sort: true }} />`, `<Child onClick={() => doThing()} />`) — even if `Child` is wrapped in `React.memo`, memo's shallow prop comparison will see a "new" object/function reference every time and re-render anyway, defeating the memoization.

Once you've identified an actual hot path via profiling, `React.memo` (for components), `useMemo` (for expensive computed values), and `useCallback` (for stable function references passed to memoized children) are the standard tools — each is covered in depth in [react-memo.md](./react-memo.md), [use-memo.md](./use-memo.md), and [use-callback.md](./use-callback.md) respectively, since correctly using them requires understanding referential equality and dependency arrays. For rendering very long lists (thousands of rows), even an efficiently reconciled list is expensive simply because of how many DOM nodes exist — list virtualization libraries like `react-window` or `react-virtualized` solve this by only mounting the rows currently visible in the viewport (plus a small overscan buffer), recycling DOM nodes as the user scrolls instead of keeping every row mounted. And for reducing what has to load and run up front rather than what re-renders, code splitting with `React.lazy`/`Suspense` (see [lazy-loading-and-code-splitting.md](./lazy-loading-and-code-splitting.md)) defers loading rarely-needed code (a modal, a settings page, an admin panel) until it's actually needed.

Finally, watch for expensive synchronous work happening directly inside a render function — render should be treated as a pure, fast function of props and state. Sorting or filtering large arrays, doing heavy date formatting, or running non-trivial computations on every render (instead of memoizing them or moving them outside the component) blocks the main thread and makes typing, scrolling, or any other interaction feel laggy, independent of how many components re-rendered.

## Examples

```jsx
// Bad: a new `options` object and a new `onSelect` function are created every render,
// so React.memo on Child never actually prevents a re-render.
function Parent({ items }) {
  const [query, setQuery] = useState('');
  return (
    <Child
      options={{ sort: true }}          // new object identity every render
      onSelect={(id) => console.log(id)} // new function identity every render
      items={items}
    />
  );
}

// Fixed: stabilize the object and function references across renders.
function ParentFixed({ items }) {
  const [query, setQuery] = useState('');
  const options = useMemo(() => ({ sort: true }), []); // stable reference
  const handleSelect = useCallback((id) => console.log(id), []); // stable reference
  return <Child options={options} onSelect={handleSelect} items={items} />;
}
const Child = React.memo(function Child({ options, onSelect, items }) {
  /* only re-renders when items/options/onSelect actually change */
});
```

```jsx
// State colocation: moving frequently-changing state DOWN into the component
// that actually needs it, instead of at the top of a large tree.

// Before: every keystroke re-renders the entire <Dashboard>, including <ExpensiveChart>.
function Dashboard() {
  const [search, setSearch] = useState('');
  return (
    <div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} />
      <ExpensiveChart />
    </div>
  );
}

// After: the input's state is colocated in its own component, so typing
// only re-renders <SearchBox> — <ExpensiveChart> is unaffected.
function DashboardFixed() {
  return (
    <div>
      <SearchBox />
      <ExpensiveChart />
    </div>
  );
}
function SearchBox() {
  const [search, setSearch] = useState('');
  return <input value={search} onChange={(e) => setSearch(e.target.value)} />;
}
```

```jsx
// List virtualization with react-window: only visible rows are mounted,
// no matter how large `items` is.
import { FixedSizeList } from 'react-window';

function BigList({ items }) {
  const Row = ({ index, style }) => <div style={style}>{items[index].label}</div>;
  return (
    <FixedSizeList height={400} width={300} itemCount={items.length} itemSize={35}>
      {Row}
    </FixedSizeList>
  );
}
```

## Common Pitfalls / Gotchas

- Wrapping every component in `React.memo` "just in case" — memo itself has a cost (a shallow prop comparison on every render), and it's actively counterproductive if the props passed in are new object/array/function literals every render, since the comparison will always fail anyway.
- Reaching for `useMemo`/`useCallback` before profiling — they add code complexity and a small overhead of their own, and are only a net win when the wrapped computation/function is genuinely expensive or is passed to a memoized child/effect dependency array.
- Optimizing renders (memoization) when the actual bottleneck is expensive synchronous work inside render (sorting, filtering, formatting) — no amount of `React.memo` fixes a component that's slow every time it *does* render.
- Rendering a huge list without virtualization and then trying to "fix" the slowness purely with memoization — thousands of mounted DOM nodes are expensive regardless of whether their React component re-rendered.
- Not using the React DevTools Profiler's "why did this render" feature before making changes — it's easy to guess wrong about which component or prop is actually causing the slow re-render.

## Interview Questions & Answers

**Q: Why doesn't wrapping a component in `React.memo` always prevent it from re-rendering when its parent re-renders?**
A: `React.memo` skips a re-render only if a shallow comparison of the new props against the previous props finds them equal. If the parent passes a new object, array, or inline function literal as a prop on every render, that prop's reference changes every time even if its contents are logically the same, so the shallow comparison fails and the memoized component re-renders anyway. Fixing this requires stabilizing those references with `useMemo`/`useCallback`, or restructuring so the prop isn't recreated on every render.

**Q: What's state colocation, and why does it help performance?**
A: State colocation means keeping a piece of state in the component closest to where it's actually used, rather than lifting it higher than necessary. Since a state update re-renders the component that owns the state plus everything below it, keeping frequently-changing state (like a text input's value) scoped to a small leaf component limits the re-render to that small subtree instead of cascading through a large parent tree that doesn't actually depend on that state.

**Q: When would you reach for list virtualization instead of just optimizing renders with memoization?**
A: When rendering a genuinely long list (hundreds to thousands of items) where the cost isn't re-rendering unnecessarily but simply having that many DOM nodes mounted at once. Memoization can't help here because even a perfectly memoized list still mounts every row on first render and keeps them all in the DOM; virtualization (`react-window`/`react-virtualized`) solves the actual bottleneck by only mounting the rows currently in (or near) the viewport.

**Q: How would you diagnose why a specific component is re-rendering too often, before reaching for any fix?**
A: Open the React DevTools Profiler, record an interaction, and inspect the flagged component's render — it reports the render duration and, if "Record why each component rendered" is enabled, whether it was due to changed props, changed state, a re-rendering parent, or a changed context value. That tells you precisely what to target (a specific prop's identity, an unnecessary context re-render, etc.) instead of guessing and applying `React.memo` everywhere speculatively.

## Related Topics
- [react-memo.md](./react-memo.md)
- [use-memo.md](./use-memo.md)
- [use-callback.md](./use-callback.md)
- [virtual-dom-and-reconciliation.md](./virtual-dom-and-reconciliation.md)
- [lazy-loading-and-code-splitting.md](./lazy-loading-and-code-splitting.md)
- [keys-and-reconciliation.md](./keys-and-reconciliation.md)
