# React.memo

`React.memo` is a higher-order component that memoizes a function component's rendered output: it wraps a component so that, on each re-render triggered by its parent, React first shallowly compares the new props to the props from the previous render, and if every prop is shallowly equal (`Object.is` per prop, essentially — same primitive values, or same object/array/function references), React skips re-rendering that component entirely and reuses its previously rendered output. If any prop differs, the component re-renders normally. This is conceptually the function-component sibling of the older `PureComponent` class, but implemented as a wrapping function (`const Memoized = React.memo(MyComponent)`) rather than a base class to extend.

The comparison `React.memo` performs is strictly shallow, and this is the single most important and most frequently misunderstood detail about it. For primitive props (strings, numbers, booleans) shallow comparison is exactly what you'd want. But for object, array, or function props, shallow comparison checks reference equality, not deep/structural equality — so passing a brand-new object literal, array literal, or inline arrow function as a prop on every parent render (`<Child config={{ theme: 'dark' }} onClick={() => doThing()} />`) creates a *new reference* every single time, even though the "logical" value looks identical. `React.memo`'s shallow comparison will see these as different props every render and re-render the child anyway — completely defeating the memoization, silently, with no warning. This is precisely why `React.memo` is almost always discussed together with `useMemo` (to keep an object/array prop's reference stable across renders when its actual contents haven't changed) and `useCallback` (to do the same for function props) in the parent component — memoizing the child alone does nothing if the parent keeps recreating its props from scratch.

It's also worth being clear about when `React.memo` actually helps versus when it's dead weight. It only pays off for components that (a) re-render relatively often with (b) the same props on many of those re-renders, and where (c) the component's own render work is non-trivial enough that skipping it is worth the (small but nonzero) cost of the props comparison itself. Wrapping every component in `React.memo` reflexively is a common performance-cargo-cult mistake — for a cheap-to-render component, or one whose props genuinely change on almost every render anyway, the comparison overhead can net out to a wash or even a slight regression, while adding a layer of indirection that makes the component tree marginally harder to reason about.

`React.memo` also accepts an optional second argument, a custom comparison function `(prevProps, nextProps) => boolean`, for cases where the default shallow comparison isn't the right fit — for example, deliberately ignoring a prop known to be irrelevant to rendering, or doing a deeper comparison for a specific known-shape object prop instead of relying on reference equality. Returning `true` from this function means "props are equivalent, skip the re-render" (the inverse of how `shouldComponentUpdate` in class components works, which returns `true` to *allow* the update — a common source of confusion when translating between the two).

## Examples

```jsx
// React.memo skips re-rendering when props are shallowly equal
import { memo, useState } from 'react';

const ExpensiveRow = memo(function ExpensiveRow({ label, value }) {
  console.log('Rendering row:', label); // only logs when label/value actually change
  return <li>{label}: {value}</li>;
});

function Dashboard() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button onClick={() => setCount((c) => c + 1)}>Unrelated re-render: {count}</button>
      {/* label/value never change, so ExpensiveRow skips re-rendering on every click above */}
      <ul><ExpensiveRow label="Total Users" value={1024} /></ul>
    </div>
  );
}
```

```jsx
// The classic gotcha: a new object/function prop every render defeats React.memo entirely
function Parent() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <button onClick={() => setCount((c) => c + 1)}>Count: {count}</button>
      {/* BROKEN: new object + new function literal every render — MemoChild re-renders every time */}
      <MemoChild config={{ theme: 'dark' }} onClick={() => console.log('clicked')} />
    </div>
  );
}

const MemoChild = memo(function MemoChild({ config, onClick }) {
  console.log('MemoChild rendered'); // fires on EVERY Parent re-render despite memo()
  return <button onClick={onClick}>{config.theme}</button>;
});
```

```jsx
// Fixed: useMemo/useCallback keep the object/function references stable across renders
import { memo, useState, useMemo, useCallback } from 'react';

function Parent() {
  const [count, setCount] = useState(0);

  const config = useMemo(() => ({ theme: 'dark' }), []); // same reference every render
  const handleClick = useCallback(() => console.log('clicked'), []); // same reference every render

  return (
    <div>
      <button onClick={() => setCount((c) => c + 1)}>Count: {count}</button>
      {/* Now MemoChild's props are shallowly equal across re-renders — memo actually works */}
      <MemoChild config={config} onClick={handleClick} />
    </div>
  );
}
```

## Common Pitfalls / Gotchas

- Passing new object/array/function literals as props to a memoized component — this is by far the most common way `React.memo` silently fails to do anything, since shallow comparison treats a new reference as a changed prop even if its contents are identical.
- Wrapping every component in `React.memo` "just in case" — for cheap-to-render components, or ones whose props change on nearly every render anyway, the comparison overhead isn't worth it and adds unnecessary indirection; profile before reaching for it broadly.
- Forgetting that `React.memo` only affects re-renders caused by a *parent* re-rendering with the same props — it does nothing to prevent the component from re-rendering due to its own internal state or context changes, since those aren't props-based at all.
- Confusing the custom comparator's return value convention — returning `true` from a custom comparison function means "treat as equal, skip re-render," which is the opposite of `shouldComponentUpdate`'s convention (`true` means "please do update") in class components.
- Using `React.memo` as a substitute for fixing an actually unnecessary re-render higher up the tree, rather than addressing why the parent re-renders so often in the first place (e.g., state that's scoped too high, or a Context value that changes too frequently).

## Interview Questions & Answers

**Q: What does `React.memo` actually do?**
A: It wraps a component so that React shallowly compares its new props to its previous props before re-rendering; if every prop is shallowly equal, React skips calling that component's render function again and reuses the last rendered output. If any prop differs by reference (for objects/arrays/functions) or value (for primitives), the component re-renders as normal.

**Q: Why might `React.memo` fail to prevent re-renders even though the "same" data is being passed down?**
A: Because its comparison is shallow and reference-based for non-primitive props. If the parent creates a new object, array, or function literal on every render — which is extremely easy to do accidentally with inline props like `style={{ color: 'red' }}` or `onClick={() => ...}` — that prop has a new reference every time even though its contents look unchanged, so `React.memo` correctly (by its own rules) concludes the props changed and re-renders.

**Q: How do `useMemo` and `useCallback` relate to `React.memo`?**
A: They're the fix for the reference-identity problem described above. `useMemo` memoizes an object/array/computed value so the parent hands the memoized child the *same reference* across renders when the underlying dependencies haven't changed; `useCallback` does the same for function props. Without stabilizing those references in the parent, wrapping the child in `React.memo` alone accomplishes nothing for object/array/function props.

**Q: When is `React.memo` actually worth using, versus unnecessary overhead?**
A: It's worth it for components that re-render often, frequently with unchanged props, and whose own render work is nontrivial enough that skipping it is a meaningful savings — e.g., a row in a large list, or a component with expensive internal computation/JSX. For cheap, simple components, or ones whose props realistically change on almost every render anyway, the shallow-comparison overhead can outweigh the benefit, so it shouldn't be applied reflexively to every component.

**Q: How does the optional custom comparison function change `React.memo`'s behavior, and what's the gotcha with its return value?**
A: Passing `React.memo(Component, areEqual)` replaces the default shallow-props comparison with your own `(prevProps, nextProps) => boolean` function, useful for deliberately ignoring irrelevant props or doing a smarter comparison for a specific prop shape. The gotcha is the return-value convention: returning `true` means props are considered equal and the re-render should be skipped — the inverse of `shouldComponentUpdate`'s `true`-means-update convention in class components, which trips people up when translating between the two mental models.

## Related Topics
- [use-memo.md](./use-memo.md)
- [use-callback.md](./use-callback.md)
- [pure-components.md](./pure-components.md)
- [react-performance-optimization.md](./react-performance-optimization.md)
- [virtual-dom-and-reconciliation.md](./virtual-dom-and-reconciliation.md)
