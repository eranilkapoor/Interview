# useCallback

`useCallback` memoizes a **function reference** across renders, returning the same function instance as long as its listed dependencies haven't changed, instead of creating a brand-new function object on every render the way a plain function definition inside a component body normally would. The call shape is `const memoizedFn = useCallback(fn, [dep1, dep2])`: on the first render React stores `fn` alongside the dependency array; on subsequent renders, if every dependency is unchanged (compared via `Object.is`), React returns the *original* function reference from before rather than the newly-created one — even though a new `fn` closure is technically created fresh on every render call, `useCallback` discards it and hands back the old one when nothing relevant has changed.

It's worth being precise that `useCallback(fn, deps)` is not a fundamentally different mechanism from `useMemo` — it is, in fact, exactly equivalent to `useMemo(() => fn, deps)`. `useMemo` memoizes the *value returned by* a function you give it; `useCallback` is sugar for the specific, extremely common case where the value you want to memoize is itself a function — `useCallback(fn, deps)` and `useMemo(() => fn, deps)` produce identical results, and `useCallback` exists purely to make that particular pattern more readable and to avoid the slightly awkward "a function that returns a function" shape.

Why does a fresh function reference on every render ever matter, given that JavaScript functions are cheap to create? The reference itself only matters in two situations. First, when a function is passed as a prop to a child wrapped in `React.memo` — `React.memo`'s shallow prop comparison sees a new function reference as "this prop changed," forcing the child to re-render even if the function's actual logic and closed-over values are functionally identical to the previous render's; wrapping the function passed down in `useCallback` keeps that reference stable so `React.memo` can correctly conclude nothing relevant changed and skip re-rendering the child. Second, when a function is listed as a dependency of another Hook — most commonly `useEffect` — an unstabilized function recreated on every render will appear "changed" on every dependency comparison, causing that effect to needlessly re-run (and re-fire its cleanup) on every single render regardless of whether the function's actual behavior changed; wrapping it in `useCallback` with the correct dependencies lets the effect's dependency array correctly detect "nothing relevant changed" and skip re-running.

As with `useMemo`, `useCallback` is not free — it has its own bookkeeping cost (storing the previous function and dependency array, comparing dependencies every render) — so wrapping every single function defined inside a component in `useCallback` "by default" or "just in case" is a common overuse pattern that adds boilerplate and a small constant overhead everywhere without any real payoff for functions that are never passed to a memoized child and never used as another Hook's dependency. The right heuristic is the same as for `useMemo`: reach for `useCallback` when there's a concrete, identifiable consumer of the stable reference (a `React.memo` child, or an effect's dependency array) — not reflexively on every handler defined in a component.

## Examples

```jsx
// useCallback stabilizing a handler passed to a React.memo child
const ExpensiveButton = React.memo(function ExpensiveButton({ onClick, label }) {
  console.log(`Rendering ${label}`); // only logs when props actually change by reference
  return <button onClick={onClick}>{label}</button>;
});

function Toolbar({ onSave }) {
  const [count, setCount] = useState(0); // unrelated local state

  // Without useCallback, handleSave is a NEW function reference every render,
  // defeating ExpensiveButton's React.memo every time Toolbar re-renders for any reason.
  const handleSave = useCallback(() => {
    onSave();
  }, [onSave]);

  return (
    <div>
      <button onClick={() => setCount((c) => c + 1)}>Unrelated re-render trigger: {count}</button>
      <ExpensiveButton onClick={handleSave} label="Save" />
    </div>
  );
}
```

```jsx
// useCallback === useMemo(() => fn, deps) — they're the same mechanism
function search(query, page) {
  return fetch(`/api/search?q=${query}&page=${page}`);
}

function useSearchHandler(query, page) {
  // These two lines are exactly equivalent:
  const handlerA = useCallback(() => search(query, page), [query, page]);
  const handlerB = useMemo(() => () => search(query, page), [query, page]);
  return handlerA;
}
```

```jsx
// A function as a dependency of useEffect — useCallback prevents the effect from re-firing every render
function AutoSaveEditor({ documentId, onSave }) {
  const saveDocument = useCallback(
    (content) => onSave(documentId, content),
    [documentId, onSave]
  );

  useEffect(() => {
    const interval = setInterval(() => saveDocument(getCurrentContent()), 30000);
    return () => clearInterval(interval);
    // Without useCallback on saveDocument, this effect would tear down and
    // recreate the interval on every single render, since `saveDocument`
    // would be a new reference each time and appear "changed" every render.
  }, [saveDocument]);

  return <Editor documentId={documentId} />;
}
```

## Common Pitfalls / Gotchas

- Wrapping every function defined in a component in `useCallback` by default, with no `React.memo` child or Hook dependency actually consuming the stable reference — this adds bookkeeping overhead everywhere for zero real benefit, since nothing downstream cares whether the reference is stable.
- Forgetting that `useCallback` only stabilizes the function *reference* — the function still closes over the same render's props/state as always; if a dependency it should reference is omitted from the array, it produces the exact same stale-closure bug `useEffect` and `useMemo` are prone to.
- Using `useCallback` on a handler passed to a plain (non-memoized) child component or a regular DOM element (`<button onClick={handler}>`) — without `React.memo` on the receiving side, there's no shallow-comparison consumer to benefit from the stable reference, so the memoization accomplishes nothing observable.
- Assuming `useCallback` prevents the *component itself* from re-rendering — it doesn't; it only stabilizes one function's reference so things that specifically compare references (`React.memo`, a Hook's dependency array) can correctly detect "no relevant change."
- Confusing `useCallback(fn, deps)` with `useMemo(fn, deps)` — the latter calls `fn` and memoizes its *return value*; `useCallback(fn, deps)` memoizes `fn` itself, without ever calling it. Passing a function you intend to memoize (not call) to `useMemo` requires wrapping it in an extra arrow function (`useMemo(() => fn, deps)`), which is exactly what `useCallback(fn, deps)` does for you.

## Interview Questions & Answers

**Q: What does `useCallback` do, and how does it relate to `useMemo`?**
A: `useCallback(fn, deps)` returns a memoized reference to `fn`, giving back the same function instance across renders where the listed dependencies haven't changed, rather than the fresh closure that would otherwise be created every render. It's exactly equivalent to `useMemo(() => fn, deps)` — `useCallback` is purely syntactic sugar for the common case of memoizing a function value specifically, rather than some other computed value.

**Q: Why would you ever need a stable function reference — doesn't creating a new function every render just work fine?**
A: Functionally, yes — a newly created function every render behaves identically at call time. The reference only matters in two situations: when the function is passed as a prop to a child wrapped in `React.memo` (whose shallow comparison treats a new reference as "this prop changed," forcing an unnecessary re-render), and when the function is listed in another Hook's dependency array, like `useEffect`'s (where a new reference every render makes the effect think its dependency changed, causing it to needlessly re-run and re-fire cleanup on every render).

**Q: Does `useCallback` by itself prevent a component from re-rendering?**
A: No — it only stabilizes the *reference* of one function value. Whether that stability actually translates into skipped re-renders depends entirely on how the function is consumed: passed to a `React.memo`-wrapped child (which compares props by reference) or used as a dependency somewhere that does reference comparison. Used on a function with no such consumer, `useCallback` changes nothing observable about rendering behavior.

**Q: What's a common mistake people make when overusing `useCallback`?**
A: Wrapping every event handler and function inside a component in `useCallback` reflexively, regardless of whether it's ever passed to a memoized child or used in another Hook's dependency array. Since `useCallback` has its own (small but nonzero) bookkeeping cost — storing the previous function and comparing dependencies every render — doing this everywhere without a concrete consumer of the stable reference adds overhead and boilerplate without any actual performance benefit.

**Q: If `fn` inside `useCallback(fn, deps)` still closes over the same render's variables, what exactly does memoizing its reference change?**
A: Nothing about what the function *does* when called — it still reads whatever values were in scope in the render where that particular cached version was created (which is why the dependency array must correctly list everything the function reads, to avoid stale-closure bugs, just as with `useEffect` and `useMemo`). What changes is only whether calling `useCallback` again on a later render returns that exact same function object or a different one — and it's that object identity, not the function's behavior, that `React.memo` and dependency-array comparisons key off of.

## Related Topics
- [use-memo.md](./use-memo.md)
- [react-memo.md](./react-memo.md)
- [handling-events.md](./handling-events.md)
- [use-effect.md](./use-effect.md)
- [react-performance-optimization.md](./react-performance-optimization.md)
