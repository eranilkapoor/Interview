# Pure Components

React expects components to behave like pure functions with respect to their props and state: given the same inputs, a component should always produce the same JSX output, and rendering itself should be free of observable side effects. "Purity" here means a component's render logic shouldn't mutate any variables or objects that existed before rendering started, shouldn't perform I/O (network calls, timers, DOM writes, logging that affects behavior) directly in the render body, and shouldn't read or write anything mutable outside its own local scope during render — it should compute and return JSX and nothing more. Side effects like data fetching, subscriptions, or manually touching the DOM belong in `useEffect` (or an event handler), which runs *after* render, deliberately outside of this pure calculation.

This constraint isn't just a style preference — it's load-bearing for how React actually works. React reserves the right to call a component function more than once per commit, call it and then throw the result away, or render it without ever committing the result to the screen, particularly under Strict Mode and concurrent features like transitions and Suspense. If a component mutates external state during render (for example, pushing to an array declared outside the component, or incrementing a module-level counter), calling it twice would corrupt that state, and discarding an in-progress render would leave the mutation applied anyway with no corresponding UI change. Purity is what makes it *safe* for React to do this extra or speculative work.

React Strict Mode (development-only, no effect in production builds) deliberately renders components an extra time and double-invokes certain functions (component bodies, plus mount/cleanup of `useEffect` in newer versions) specifically to surface impurities that would otherwise go unnoticed until they cause a subtle bug in production — for instance under concurrent rendering. If double-invoking a component's render produces different output, or double-running an effect's setup/cleanup breaks something, that's Strict Mode doing its job: it's flagging code that silently depended on running exactly once.

The payoff for keeping components pure is that React can safely apply optimizations that would otherwise be unsound. `React.memo` can skip re-rendering a component entirely when its props are shallowly equal to the last render — a guarantee that only holds if the component's output really is a pure function of its props (and state), since memoization means the previous output is reused *instead of* recomputing it. More broadly, concurrent rendering features rely on React being able to start, pause, abandon, or restart rendering work without observable consequences — none of which is safe if rendering has side effects that can't simply be thrown away. Purity is the contract that unlocks that whole class of performance techniques, not just an abstract best practice.

## Examples

```jsx
// Impure: mutates a variable declared outside the component during render
let renderCount = 0; // module-level mutable state — dangerous to touch during render

function Impure({ name }) {
  renderCount++; // side effect during render — breaks under double-invocation/Strict Mode
  return <p>Hello {name}, render #{renderCount}</p>;
}
```

```jsx
// Pure equivalent: no external mutation, same props always produce the same output
function Pure({ name }) {
  return <p>Hello {name}</p>; // deterministic — safe to call any number of times
}

// If you genuinely need a render counter, track it as state/ref, scoped to the instance
import { useRef } from 'react';

function RenderCounter({ name }) {
  const renderCount = useRef(0);
  renderCount.current += 1; // mutating a ref during render is a well-known, accepted exception
  return <p>Hello {name}, render #{renderCount.current}</p>;
}
```

```jsx
// Pure components + React.memo: safe memoization because output is a pure function of props
import { memo } from 'react';

const ExpensiveRow = memo(function ExpensiveRow({ item }) {
  console.log('Rendering row for', item.id); // only logs when item actually changes
  return <li>{item.label}</li>;
});

function List({ items }) {
  return (
    <ul>
      {items.map((item) => (
        <ExpensiveRow key={item.id} item={item} />
      ))}
    </ul>
  );
}
```

## Common Pitfalls / Gotchas

- Mutating props or state directly instead of treating them as read-only — e.g. `props.items.push(newItem)` or `state.user.name = 'X'` — this can appear to "work" by accident but breaks change detection (including `React.memo`'s shallow comparison) and violates the immutability assumption React relies on.
- Doing data fetching, subscriptions, or `console.log`-as-tracking directly in the component body instead of inside `useEffect` — this runs on every render (including throwaway/speculative ones) rather than only when it should, and can fire twice under Strict Mode in development, surprising anyone who didn't expect it.
- Relying on module-level or global mutable variables to track render-related state — this is exactly the class of bug Strict Mode's double-invocation is designed to catch, since two "logical" renders sharing one mutable counter produces wrong, inconsistent values.
- Assuming Strict Mode's double-rendering/double-effect behavior is itself a bug — it's intentional development-only tooling to catch impurities before they cause real problems in production under concurrent features.
- Generating random values or reading `Date.now()` directly during render to compute output — this makes the component's output nondeterministic for the same props, which breaks memoization and can cause visibly inconsistent output between a discarded speculative render and the one that actually commits.

## Interview Questions & Answers

**Q: What does it mean for a React component to be "pure," and why does React care?**
A: A pure component always renders the same output for the same props and state, and performs no side effects (mutation, I/O, external state changes) during the render itself. React cares because it may call a component's render function more than once, discard a render without committing it, or pause and resume rendering work — none of which is safe unless rendering has no observable side effects that would corrupt shared state or fire unintentionally.

**Q: What does Strict Mode's double-invocation behavior actually do, and does it run in production?**
A: In development only, Strict Mode intentionally renders components (and mounts/unmounts effects) an extra time to help surface impure code — for example, code that mutates external state during render, or an effect whose cleanup doesn't properly undo its setup. It has no effect on production builds; it's purely a development-time diagnostic tool, not a runtime behavior change users will ever see.

**Q: How does component purity relate to `React.memo` actually working correctly?**
A: `React.memo` skips re-rendering a component when its props are shallowly unchanged, reusing the previously computed output instead of recalculating it. That's only correct if the component's output really is a deterministic function of its props — if the component secretly depends on some external mutable value that changed, `React.memo` would incorrectly show stale output, since it has no way to know that dependency existed.

**Q: Give an example of an impure pattern that looks harmless but can break under React's concurrent rendering.**
A: Directly mutating a prop or state object instead of creating a new one — e.g., `state.list.push(item)` followed by calling the setter with the same reference. React may compare object references to detect changes; since the reference didn't change, React can conclude nothing changed and skip an update, even though the underlying array was mutated. Concurrent rendering compounds this because an in-progress render might read the object at one point in time, then have it mutated again before the render is actually committed.

**Q: Are all side effects forbidden in a component, or just during render?**
A: Just during render — side effects are a normal, necessary part of most real applications; they just don't belong in the pure render calculation. React gives you `useEffect` (running after commit) and event handlers (running in response to user interaction) as the sanctioned places to perform side effects, precisely so the render function itself can stay pure and safely re-runnable.

## Related Topics
- [react-memo.md](./react-memo.md)
- [use-effect.md](./use-effect.md)
- [virtual-dom-and-reconciliation.md](./virtual-dom-and-reconciliation.md)
- [state.md](./state.md)
- [react-performance-optimization.md](./react-performance-optimization.md)
