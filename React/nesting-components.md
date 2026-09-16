# Nesting Components (Composition)

React applications are built by composing components — nesting simple components inside progressively larger ones until you arrive at a full application tree. This is the same idea as composing small functions to build up more complex behavior, applied to UI: a `Button` nests inside a `Toolbar`, which nests inside a `Page`, which nests inside the application's root. Each level only needs to understand the public interface (props) of the components it renders, not their internal implementation, which is what makes large React codebases tractable — you can reason about, test, and modify one component largely in isolation.

Composition in React is deliberately preferred over deep inheritance hierarchies. Rather than building a `SpecialButton` that *extends* `Button` (class inheritance), the idiomatic React approach is to build small, focused components and combine them via nesting and the `children` prop — a `Button` component might accept arbitrary content as `children`, and a `Card` component might wrap arbitrary content the same way, letting you build a `Card` containing a `Button` containing an icon, all without any component needing to know about the others' internals. This composition-over-inheritance approach is flexible enough to replace nearly every use case that would otherwise reach for class inheritance in an OOP language.

There's a subtle but important trap in how components get declared: a component must be defined at the module's top level (or otherwise outside the render path of another component), never *inside* another component's function body. Declaring `function Inner() {...}` inside `function Outer() {...}` means a brand-new `Inner` function is created every single time `Outer` renders. React identifies component instances partly by their function/type identity, so on every re-render of `Outer`, React sees what looks like a completely different component type where `Inner` used to be — it will unmount the old instance (discarding any state, refs, and running cleanup effects) and mount a fresh one, even though from the developer's intent nothing conceptually changed. This bug is subtle because the component still visually renders correctly; the failure shows up as inexplicably lost input focus, reset form fields, or state that mysteriously reverts on every parent re-render.

A related distinction sometimes discussed alongside composition is the older "container/presentational component" pattern — separating components that fetch/manage data ("containers") from components that purely render UI given props ("presentational"). This pattern predates hooks and is less rigidly followed today, since custom hooks now let you extract stateful logic without needing a wrapping container component, but the underlying principle — keeping data-fetching/state-management concerns separate from purely visual rendering concerns — is still valuable in how you decide to split components when composing a tree.

## Examples

```jsx
// Building a UI tree by nesting small, focused components
function Icon({ name }) {
  return <span className={`icon icon-${name}`} />;
}

function Button({ children, onClick }) {
  return <button onClick={onClick}>{children}</button>;
}

function Toolbar() {
  return (
    <div className="toolbar">
      <Button onClick={() => console.log('save')}>
        <Icon name="save" /> Save
      </Button>
      <Button onClick={() => console.log('delete')}>
        <Icon name="trash" /> Delete
      </Button>
    </div>
  );
}
```

```jsx
// WRONG: defining a component inside another component's body
function SearchPage() {
  const [query, setQuery] = useState('');

  // Recreated on every SearchPage render — a "new" component type each time!
  function ResultsList() {
    const [expanded, setExpanded] = useState(false); // this state resets constantly
    return <div>{expanded ? 'Expanded results' : 'Collapsed results'}</div>;
  }

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ResultsList />
    </div>
  );
}
```

```jsx
// RIGHT: define components at module scope, pass data down via props instead
function ResultsList({ query }) {
  const [expanded, setExpanded] = useState(false); // state now persists correctly
  return <div>{expanded ? `Expanded results for ${query}` : 'Collapsed results'}</div>;
}

function SearchPage() {
  const [query, setQuery] = useState('');
  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ResultsList query={query} />
    </div>
  );
}
```

## Common Pitfalls / Gotchas

- Defining a component function inside another component's body — causes a fresh component identity every render, silently resetting nested state, refs, and effects on each parent re-render.
- Reaching for deep component inheritance instead of composition — React's ecosystem and APIs (props, `children`, hooks) are built around composition; inheritance hierarchies fight against the grain of the library and are rarely seen in idiomatic React code.
- Over-nesting purely for the sake of "small components" without a real reason — excessive fragmentation can hurt readability as much as one giant component; the goal is a meaningful, reusable unit of UI/logic, not an arbitrary line-count limit.
- Passing too many unrelated props down through several nesting levels just to reach a deeply nested child — a sign that composition via `children` or `Context` may fit better than prop drilling (see [passing-data-through-props.md](./passing-data-through-props.md)).

## Interview Questions & Answers

**Q: Why is defining a component inside another component's render function considered a bug, not just a style issue?**
A: Because the inner function's identity is recreated on every render of the outer component. React uses component type identity to decide whether an existing component instance should be preserved (and its state/effects kept) or torn down and remounted. A "new" inner component type each render forces React to unmount and remount it every time, resetting all of its internal state — a real, hard-to-diagnose bug, not just messier code.

**Q: How does React favor composition over inheritance?**
A: Instead of extending a base component class to specialize behavior, React encourages building small, focused components and combining them by nesting — passing content and behavior down via props and the special `children` prop. A `Card` component, for instance, doesn't need subclasses for every kind of content it might wrap; it just renders whatever `children` it's given, letting callers compose arbitrary content into it.

**Q: What is the container/presentational component pattern, and is it still relevant with hooks?**
A: It's a pattern of separating components that manage data/state ("containers") from components that purely render UI from props ("presentational"), keeping visual and logic concerns apart. It's less commonly used as a rigid architecture today because custom hooks let you extract and reuse stateful logic without a wrapping container component — but the underlying principle of separating data concerns from rendering concerns remains a useful way to think about splitting components.

**Q: If you need a component defined dynamically based on some condition, how should you structure that without breaking the "no components defined inside components" rule?**
A: Define all the possible component variants at the module's top level (outside any other component), and then choose *which one* to render conditionally inside the parent's render logic — e.g., `const ListItem = isCompact ? CompactItem : FullItem; return <ListItem />;`. This keeps every component's identity stable across renders while still allowing conditional rendering.

## Related Topics
- [components.md](./components.md)
- [children-prop.md](./children-prop.md)
- [props.md](./props.md)
- [higher-order-components.md](./higher-order-components.md)
- [render-props.md](./render-props.md)
- [passing-data-through-props.md](./passing-data-through-props.md)
