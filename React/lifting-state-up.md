# Lifting State Up

State in React is naturally local to whichever component declares it, which works perfectly well until two or more components need to stay in sync with the *same* underlying data. Consider two sibling components — a search input and a results list — where the list needs to know what the input currently contains. Neither component can simply reach into the other's local state; React's data flow only moves one direction, from parent to child via props, and there is no built-in mechanism for one sibling to directly read or write another sibling's internal state. Trying to keep two independent copies of the "same" state in sync across siblings by other means inevitably drifts out of sync and becomes a bug farm.

The standard solution is "lifting state up": move the state out of whichever individual component currently owns it, and place it instead in their nearest common ancestor — the lowest component in the tree that is a parent (direct or indirect) of every component that needs access to that data. That ancestor becomes the single source of truth for the value, and it passes the current value down to each component that needs to *read* it, and passes an updater function down to each component that needs to *change* it, as ordinary props. When a child calls that updater function (typically from an event handler), the ancestor's own state updates, triggering a re-render that flows the new value back down to every component that depends on it — keeping everything perfectly in sync, because there's only ever one real copy of the data.

This pattern embodies a broader principle worth internalizing on its own: **single source of truth**. Rather than letting the same logical piece of data be duplicated and independently tracked in multiple places (which requires manually keeping the copies synchronized, and is a recipe for subtle bugs when they drift), React's architecture pushes you toward having exactly one place that owns a given piece of state, with every other component that needs it either reading it via props or, for widely shared state, via Context rather than maintaining its own separate copy. Lifting state up is simply the mechanical way you apply that principle when two related components turn out to need the same data — you don't duplicate the state, you relocate it to wherever it can be shared, and thread it back down.

Lifting state up does have a natural limit: if a single ancestor ends up holding state needed by many deeply nested, widely-spread descendants, passing it all the way down as props degenerates into prop drilling (see [passing-data-through-props.md](./passing-data-through-props.md)). At that point, Context or a dedicated state-management library becomes the better tool — but for the common case of "two or a few closely related components need to share one piece of state," lifting it to their nearest common parent is the simplest, most idiomatic fix, and is usually the first refactor to reach for before adding any heavier machinery.

## Examples

```jsx
// BEFORE: two siblings each try to track "temperature" independently — they can't sync
function CelsiusInput() {
  const [value, setValue] = useState('');
  return <input value={value} onChange={(e) => setValue(e.target.value)} />;
}

function FahrenheitInput() {
  const [value, setValue] = useState(''); // a totally separate, unsynced value
  return <input value={value} onChange={(e) => setValue(e.target.value)} />;
}
// Typing in one input has no effect on the other — they're unrelated state.
```

```jsx
// AFTER: lifting the shared state up to the nearest common parent
function TemperatureConverter() {
  const [celsius, setCelsius] = useState('');

  const fahrenheit = celsius === '' ? '' : (Number(celsius) * 9) / 5 + 32;

  return (
    <div>
      <CelsiusInput value={celsius} onChange={setCelsius} />
      <FahrenheitInput value={fahrenheit} />
    </div>
  );
}

function CelsiusInput({ value, onChange }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} />;
}

function FahrenheitInput({ value }) {
  return <input value={value} readOnly />;
}
// Now there's one source of truth (celsius) in the parent — both children stay in sync.
```

```jsx
// A common real-world case: a parent owns "selected item" state so a list
// and a detail panel (siblings) can both reflect the same selection
function ProductPage({ products }) {
  const [selectedId, setSelectedId] = useState(products[0].id);
  const selected = products.find((p) => p.id === selectedId);

  return (
    <div className="layout">
      <ProductList
        products={products}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <ProductDetail product={selected} />
    </div>
  );
}

function ProductList({ products, selectedId, onSelect }) {
  return (
    <ul>
      {products.map((p) => (
        <li
          key={p.id}
          style={{ fontWeight: p.id === selectedId ? 'bold' : 'normal' }}
          onClick={() => onSelect(p.id)}
        >
          {p.name}
        </li>
      ))}
    </ul>
  );
}

function ProductDetail({ product }) {
  return <div>{product ? product.name : 'No product selected'}</div>;
}
```

## Common Pitfalls / Gotchas

- Keeping duplicate, independently-tracked copies of "the same" data in multiple sibling components instead of lifting it — the copies inevitably drift out of sync as soon as one updates and the other doesn't.
- Lifting state too far up "just in case" — moving state to a distant ancestor that doesn't actually need it forces that ancestor (and everything between it and the components that do need it) to re-render more than necessary, and can reintroduce prop drilling; lift only as far as the nearest common ancestor that genuinely needs to coordinate the shared value.
- Forgetting to pass both the value *and* an updater function down — a child that needs to change the lifted state needs a callback prop from the parent; without it, the child can only read the value, not affect it.
- Reaching for Context or a global store immediately instead of first trying a simple lift — for two or a few closely related components, lifting state to their common parent is usually simpler and easier to follow than the added indirection of Context.

## Interview Questions & Answers

**Q: What does "lifting state up" mean, and why is it necessary?**
A: It means moving a piece of state out of the individual component(s) that currently hold it and placing it instead in their nearest common ancestor, so that ancestor becomes the single owner of that data. It's necessary because React has no mechanism for sibling components to directly read or write each other's local state — the only way for multiple components to share and stay in sync on the same value is for a shared ancestor to own it and pass it down.

**Q: How does a lifted state value actually get back down to, and updated by, the components that need it?**
A: The ancestor passes the current state value down as a prop to each component that needs to read it, and passes a callback function (often the state setter itself, or a wrapper around it) down as a prop to whichever component needs to change it. When a child calls that callback, the ancestor's state updates, which re-renders the ancestor and flows the new value back down to every dependent component.

**Q: What is the "single source of truth" principle, and how does lifting state up relate to it?**
A: It's the principle that a given piece of data should be owned and stored in exactly one place, rather than duplicated and independently maintained in multiple components. Lifting state up is the practical technique for upholding this principle whenever you discover that two or more components need the same data — instead of each keeping its own copy, you relocate the state to a shared ancestor so there's only ever one real, authoritative copy.

**Q: At what point does lifting state up stop being a good solution, and what would you reach for instead?**
A: When the components needing the shared state are numerous, deeply nested, or spread far across the tree, lifting it to a common ancestor and threading it back down through every intermediate level degenerates into prop drilling — cluttering unrelated components' signatures just to relay the value. At that point, the Context API (for moderate, mostly-read-oriented sharing) or a dedicated state management library like Redux (for larger, more complex shared state with more elaborate update logic) tend to be better fits.

## Related Topics
- [state.md](./state.md)
- [sharing-data-between-components.md](./sharing-data-between-components.md)
- [passing-data-through-props.md](./passing-data-through-props.md)
- [props.md](./props.md)
- [use-context.md](./use-context.md)
- [controlled-vs-uncontrolled-components.md](./controlled-vs-uncontrolled-components.md)
