# useMemo

`useMemo` is a Hook for caching (memoizing) the *result* of an expensive computation between renders, recomputing it only when its listed dependencies actually change. The call shape is `const memoizedValue = useMemo(() => computeSomething(a, b), [a, b])`: on the first render, React calls the function and stores both the returned value and the dependency array; on every subsequent render, React compares the new dependency array against the previous one (each entry via `Object.is`, the same check `useState` uses), and if every dependency is unchanged, it skips calling the function entirely and simply hands back the previously cached value — if any dependency has changed, it re-runs the function and caches the new result along with the new dependencies.

The specific problem `useMemo` solves is re-computation cost: without it, a function component re-runs its *entire* body — every calculation, every derived value — on every single render, regardless of whether the inputs to some particular expensive calculation actually changed. For a genuinely expensive operation (sorting or filtering a large array, running a heavy transformation, doing non-trivial math) that doesn't need to change just because some *unrelated* piece of the component's state changed (e.g., a hover state elsewhere in the same component triggering a re-render), recomputing it every time is wasted work. `useMemo` lets that specific computation opt out of re-running on renders where its own inputs are unchanged.

It's important to be precise about what `useMemo` does *not* do: memoization itself is not free — React still has to store the cached value, store the dependency array, and run the comparison on every render — so wrapping a genuinely cheap computation (basic arithmetic, a simple string concatenation, a short array `.map()`) in `useMemo` typically costs *more* than just recomputing it directly, because the bookkeeping overhead exceeds the savings. `useMemo` is a performance tool that should be reached for when profiling (or straightforward reasoning about the cost of the computation and how often the component re-renders) shows it actually helps — not applied reflexively to every computed value "just in case," which is itself a common form of premature optimization that makes code harder to read for no measurable benefit.

The other major use of `useMemo` — beyond raw computation cost — is producing a **stable reference** for an object or array that's passed down to a child wrapped in `React.memo`, or listed as a dependency of another Hook (like `useEffect` or `useCallback`). Since `React.memo` does a shallow prop comparison, passing a brand-new object literal (`{ a, b }`) as a prop on every render defeats the memoization entirely, even if `a` and `b` themselves haven't changed — `useMemo` around that object keeps the same reference across renders where `a` and `b` are unchanged, letting `React.memo` correctly skip re-rendering the child. It's worth being explicit, though, that `useMemo` by itself guarantees nothing about skipping renders — it only produces a stable *value*; actually skipping a child's re-render additionally requires that child to be wrapped in `React.memo` (or otherwise compared) — `useMemo` alone, used on a value that isn't consumed by memoization elsewhere, provides no rendering-skip benefit at all, only compute-skip benefit.

## Examples

```jsx
// Memoizing a genuinely expensive computation so it only reruns when its inputs change
function ProductList({ products, searchTerm }) {
  const [selectedId, setSelectedId] = useState(null); // unrelated state; changing it re-renders this component

  const filteredProducts = useMemo(() => {
    console.log('Filtering large product list...'); // only logs when products/searchTerm change
    return products.filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [products, searchTerm]);

  return (
    <ul>
      {filteredProducts.map((p) => (
        <li key={p.id} onClick={() => setSelectedId(p.id)}>
          {p.name}
        </li>
      ))}
    </ul>
  );
}
```

```jsx
// Stabilizing an object reference so a React.memo child doesn't re-render needlessly
const ChildChart = React.memo(function ChildChart({ options }) {
  console.log('ChildChart rendered'); // only logs when `options` reference actually changes
  return <Chart options={options} />;
});

function Dashboard({ min, max }) {
  const [tick, setTick] = useState(0); // unrelated local state

  // Without useMemo, this object is a new reference on every Dashboard render,
  // defeating ChildChart's React.memo even though min/max haven't changed.
  const chartOptions = useMemo(() => ({ min, max, animate: true }), [min, max]);

  return (
    <div>
      <button onClick={() => setTick((t) => t + 1)}>Re-render Dashboard ({tick})</button>
      <ChildChart options={chartOptions} />
    </div>
  );
}
```

```jsx
// Premature optimization: memoizing a computation cheap enough that useMemo isn't worth it
function Greeting({ firstName, lastName }) {
  // Unnecessary — string concatenation is far cheaper than useMemo's own bookkeeping.
  // const fullName = useMemo(() => `${firstName} ${lastName}`, [firstName, lastName]);

  const fullName = `${firstName} ${lastName}`; // just compute it directly
  return <h1>Hello, {fullName}</h1>;
}
```

## Common Pitfalls / Gotchas

- Wrapping cheap computations (basic arithmetic, string concatenation, small array operations) in `useMemo` — the memoization bookkeeping itself typically costs more than just recomputing the value directly, making this a net loss disguised as an optimization.
- Assuming `useMemo` alone prevents a child component from re-rendering — it only stabilizes a *value's* reference; actually skipping the child's re-render additionally requires the child to be wrapped in `React.memo` (or otherwise short-circuit its own re-render).
- Omitting a dependency the memoized function actually uses — exactly like `useEffect`, this creates a stale-closure bug where the cached value keeps reflecting an outdated input even after the real value has changed.
- Treating `useMemo`'s cache as guaranteed/permanent — React is explicitly allowed to discard a previously memoized value and recompute it under memory pressure or other internal reasons (this is documented, intentional behavior), so `useMemo` should never be used for something that must only run once with side effects (that's what `useEffect`, or `useRef` for a one-time flag, is for) — it's purely a performance hint, not a correctness guarantee.
- Reaching for `useMemo` reflexively on every object/array literal "just to be safe" without measuring whether it's actually needed — this adds cognitive overhead and boilerplate throughout a codebase for savings that, in most cases, are never realized.

## Interview Questions & Answers

**Q: What does `useMemo` actually do, and what problem does it solve?**
A: It caches the return value of a function between renders, only re-running that function when one of the listed dependencies has changed since the last render. It solves the problem of a component's entire body re-executing on every render regardless of relevance — letting a genuinely expensive computation skip re-running on renders triggered by unrelated state changes elsewhere in the same component.

**Q: Does `useMemo` guarantee a child component won't re-render?**
A: Not by itself. `useMemo` only guarantees the *value* it returns keeps the same reference across renders where its dependencies are unchanged. To actually skip a child's re-render based on that stable reference, the child additionally needs to be wrapped in `React.memo` (which does the shallow prop comparison that benefits from a stable reference) — `useMemo` alone provides compute-skipping, not automatically render-skipping.

**Q: When would using `useMemo` actually hurt rather than help?**
A: When the wrapped computation is cheap — simple arithmetic, short string operations, small non-nested array transformations. `useMemo`'s own bookkeeping (storing the previous dependency array and value, comparing dependencies on every render) has a real cost, and for a sufficiently cheap computation that cost exceeds whatever's saved by skipping the recomputation, making the "optimization" a net negative in both runtime performance and code readability.

**Q: Is a value returned by `useMemo` guaranteed to persist and never be recomputed unnecessarily?**
A: No — `useMemo` is documented as a performance optimization hint, not a correctness guarantee. React is explicitly permitted to discard a memoized value and recompute it later even if the dependencies haven't changed (for example, to free memory). Code should never rely on `useMemo` to run its function exactly once or to guarantee a side effect only happens once — that's the job of `useEffect` (for synchronization with external systems) or a ref-based one-time flag, not `useMemo`.

**Q: Give an example of a legitimate use case for `useMemo` versus a case where it would be premature optimization.**
A: Legitimate: memoizing the result of filtering/sorting a several-thousand-item array so it doesn't re-run every time an unrelated piece of local state (like a hover flag) changes and re-renders the component. Premature: wrapping `const total = useMemo(() => price * quantity, [price, quantity])` — multiplying two numbers is so cheap that the memoization overhead very likely costs more than just recalculating it on every render.

## Related Topics
- [use-callback.md](./use-callback.md)
- [react-memo.md](./react-memo.md)
- [react-performance-optimization.md](./react-performance-optimization.md)
- [use-context.md](./use-context.md)
- [virtual-dom-and-reconciliation.md](./virtual-dom-and-reconciliation.md)
