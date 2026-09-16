# Render Props

The render props pattern is a technique for sharing logic between components by giving a component a prop whose value is a function, which that component calls during its own render — passing that function whatever internal state or data it wants to share — and uses the function's return value (JSX) as (part of) its own output. The prop doesn't literally have to be named `render`; the same pattern is very commonly implemented using the special `children` prop as the function instead of a dedicated named prop, which reads a bit more naturally as JSX (`<Mouse>{(pos) => <Cursor position={pos} />}</Mouse>`).

The motivating problem is the same one HOCs and custom hooks both address: some piece of stateful logic (tracking mouse position, subscribing to a data source, managing a toggle) needs to be reused across multiple components that render completely different UI around that shared logic. A component implementing the render props pattern owns and manages the *logic* (the state, the subscriptions, the effects), but delegates the *rendering* entirely to a function passed in as a prop — so the logic-owning component never needs to know or care what its consumer actually wants to display.

For example, a `<Mouse>` component might track the current mouse position in its own state via a `mousemove` listener, and instead of rendering any UI of its own, call `this.props.render(this.state)` (or `this.props.children(this.state)`) and return whatever JSX that function produces. Different consumers can reuse `<Mouse>`'s tracking logic while rendering completely different things — a custom cursor icon in one place, coordinates as text in another — without `<Mouse>` needing any awareness of either.

Render props solved logic-sharing effectively, but at a real ergonomic cost: they tend to produce deeply nested JSX ("callback hell" rendered as markup) once more than one piece of shared logic is composed together, and they're harder to type well and to read than a flat sequence of hook calls. Custom hooks solve the identical underlying problem — reusable stateful logic — without requiring any extra component in the tree or nested function-as-child syntax at all; a component that needs mouse-position logic can simply call `useMousePosition()` and use the returned value directly in its own JSX. As a result, render props are now mostly encountered in older codebases or in the internals of a handful of specific libraries, and are rarely the right choice for new code when a custom hook is available.

## Examples

```jsx
// The render props pattern: <Mouse> owns the logic, the render prop owns the output
import { useState, useEffect } from 'react';

function Mouse({ render }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e) => setPosition({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  return render(position); // delegate all rendering to the caller
}

// Usage — two totally different UIs reusing the same tracking logic
function App() {
  return (
    <Mouse render={({ x, y }) => <p>Mouse is at ({x}, {y})</p>} />
  );
}
```

```jsx
// The same pattern using `children` as the function — reads more naturally as JSX
function Mouse({ children }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e) => setPosition({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  return children(position);
}

function App() {
  return (
    <Mouse>
      {({ x, y }) => <Cursor style={{ left: x, top: y }} />}
    </Mouse>
  );
}
```

```jsx
// The modern equivalent as a custom hook — no wrapper component, no nested function-as-child
function useMousePosition() {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e) => setPosition({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  return position;
}

function App() {
  const { x, y } = useMousePosition();
  return <p>Mouse is at ({x}, {y})</p>;
}
```

## Common Pitfalls / Gotchas

- Composing multiple render-props components inside each other's `children` function creates deeply nested JSX ("pyramid of doom") that's hard to read and hard to type correctly — this is the pattern's signature ergonomic problem, and it only worsens as more shared logic is layered in.
- Passing a new inline arrow function as the render prop on every render (`<Mouse>{(pos) => ...}</Mouse>`) means the function reference changes every time the parent re-renders — this defeats `React.memo` on the render-props component if it's wrapped in one, since the "children" prop never stays referentially equal.
- Forgetting that, unlike a custom hook, a render-props component still adds a real component to the tree, with its own reconciliation and (if mismanaged) its own potential to remount unexpectedly if its type or key changes between renders.
- Reaching for render props in new code where a custom hook would achieve the same reuse with a flatter, more readable call site — render props are rarely the right first choice today outside of maintaining existing code that already uses the pattern.

## Interview Questions & Answers

**Q: What is the render props pattern, and what problem does it solve?**
A: A component that owns some reusable stateful logic accepts a function as a prop (often named `render`, or implemented via `children`), calls that function during its own render with whatever data it wants to expose, and renders the function's return value. It solves the same problem as HOCs and custom hooks: sharing logic between components that need different UI output built on top of that shared logic.

**Q: How is using `children` as a function different from a dedicated `render` prop?**
A: Functionally they're identical — both pass a function that the logic-owning component calls with its internal state. Using `children` just takes advantage of the fact that any valid JSX expression, including a function, can be passed between a component's opening and closing tags, which many people find reads more naturally as JSX than an explicitly named `render` prop.

**Q: What's the main drawback of the render props pattern compared to custom hooks?**
A: Composing several render-props components nests function-as-child callbacks inside each other, producing deeply indented, harder-to-read JSX as more shared logic gets layered in — informally called "callback hell in JSX form." A custom hook achieves the identical logic reuse with a flat function call (`const data = useSomething()`) and no additional component or nesting in the tree at all, which is why hooks are now generally preferred.

**Q: Can render props and custom hooks be used together, or is it one or the other?**
A: They can coexist, and in practice a render-props component is often reimplemented internally using a custom hook — the hook holds the actual state/effect logic, and a thin render-props (or children-as-function) wrapper around it exists only for backward compatibility with existing consumers that were written before hooks existed, or for cases (like class components) that can't call hooks directly.

**Q: Is there ever a good reason to reach for render props in new code today?**
A: It's uncommon, but it can still make sense in a component library that must support class-component consumers (which can't call hooks), or in libraries whose public API predates hooks and needs to preserve backward compatibility. For internal application code with full control over the component tree, a custom hook is almost always simpler and preferred.

## Related Topics
- [higher-order-components.md](./higher-order-components.md)
- [custom-hooks.md](./custom-hooks.md)
- [children-prop.md](./children-prop.md)
- [react-hooks-overview.md](./react-hooks-overview.md)
- [component-lifecycle.md](./component-lifecycle.md)
