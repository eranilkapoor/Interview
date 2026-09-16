# Virtual DOM and Reconciliation

The virtual DOM is a lightweight, plain JavaScript representation of the UI — a tree of objects describing what elements should exist, their type, props, and children — that React builds and keeps in memory as an intermediate step between your component code and the real, browser-native DOM. When a component renders, it doesn't directly manipulate DOM nodes; it returns JSX, which compiles to `React.createElement(...)` calls (or the newer JSX transform's equivalent) that produce these plain-object element descriptions. React's job is to take this description of "what the UI should look like now," compare it against "what the UI looked like last time," and figure out the minimal set of actual DOM operations needed to reconcile the difference.

This comparison process — reconciliation — happens in two conceptual phases React refers to as render and commit. During the render phase, React calls your components (or re-calls the ones affected by a state/props change) to build the new virtual DOM tree, and diffs it against the previous tree entirely in memory, without touching the real DOM at all; this phase can, under React's concurrent features, be paused, aborted, or restarted, which is only safe because nothing observable (no real DOM mutation) has happened yet. During the commit phase, React takes the minimal set of changes it computed and applies them to the actual DOM in one synchronous pass — this is the only point where real DOM nodes are actually touched.

The diffing algorithm itself relies on a small set of heuristics that make it fast (roughly O(n) rather than the theoretically much more expensive general tree-diff problem) at the cost of being a deliberate approximation rather than a perfectly optimal diff. The core rule is: when comparing two elements at the same position in the tree, if they're of different types (a `<div>` becoming a `<span>`, or one component type becoming another), React tears down the old subtree entirely — including unmounting all its state — and builds a brand-new one from scratch, rather than trying to figure out how to morph one into the other. If the elements are of the *same* type, React keeps the underlying DOM node and just updates its changed attributes/props in place, then recurses into the children to diff them the same way. For lists of children specifically, React uses the `key` prop to match elements across renders regardless of their position in the array — without stable keys, React falls back to matching purely by index, which can misattribute state and DOM nodes to the wrong logical item when a list is reordered, has items inserted/removed from the middle, or filtered (see keys-and-reconciliation.md for the details of exactly how this goes wrong).

Underpinning all of this in modern React is the Fiber architecture (introduced in React 16), which restructured reconciliation from a single, synchronous, uninterruptible recursive walk of the tree into an incremental process built out of "fiber" units of work — plain JS objects mirroring the component tree — that React can process a chunk at a time, yielding back to the browser between chunks to keep the app responsive, and that it can pause, abandon, or prioritize (rendering an urgent update ahead of a less urgent one already in progress). This is the low-level machinery that makes concurrent features like transitions and Suspense possible, and it's why the render phase specifically must stay side-effect-free (pure) — React might call a component's render function, discard the result because higher-priority work preempted it, and try again later.

Finally, it's worth directly correcting a common misconception: the virtual DOM is not "faster than the real DOM" in some absolute sense, and it's not magic that makes every update free — a hand-written, perfectly targeted imperative DOM update for a specific known change can always be faster than going through a full diffing process. What the virtual DOM actually buys you is a declarative programming model (you describe *what* the UI should look like for a given state, not the step-by-step *how* to mutate it there) combined with a reasonably efficient, predictable, general-purpose way to compute the necessary DOM updates automatically — trading a small amount of raw performance in the average case for a dramatically simpler, more maintainable mental model and fewer entire classes of bugs (manual DOM synchronization drift) that plague hand-rolled imperative UI code at scale.

## Examples

```jsx
// Same element type at the same position: React updates the existing DOM node in place
function Greeting({ name, highlighted }) {
  // Re-rendering with a new `name` or `highlighted` value updates the SAME <p> DOM node —
  // React doesn't recreate it, it just patches the changed attributes/text.
  return <p className={highlighted ? 'highlighted' : ''}>Hello, {name}</p>;
}
```

```jsx
// Different element type at the same position: React tears down and rebuilds the subtree
function StatusMessage({ isError }) {
  // Switching between these two branches changes the element TYPE at this position
  // (p vs div), so React unmounts the old node/subtree entirely and mounts a new one —
  // any local state inside whichever branch was previously mounted is lost.
  return isError ? <div className="error">Failed</div> : <p className="ok">Success</p>;
}
```

```jsx
// Keys drive list reconciliation: React matches elements by key, not by array position
function TodoList({ todos }) {
  return (
    <ul>
      {todos.map((todo) => (
        // A stable, unique key lets React correctly track each <li> (and any state inside it)
        // across reorders/insertions/removals, instead of matching by index alone.
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  );
}
```

## Common Pitfalls / Gotchas

- Believing the virtual DOM is "always faster than direct DOM manipulation" — it isn't inherently faster in an absolute sense; its real value is a declarative, predictable programming model with reasonably efficient general-purpose diffing, not a guarantee of beating hand-optimized imperative code.
- Not realizing that changing an element's *type* at a given tree position (e.g. conditionally rendering `<div>` vs `<span>`, or `<ComponentA>` vs `<ComponentB>`) forces a full unmount/remount of that subtree, discarding any state it held — this is a common source of unexpectedly lost component state after what looks like a small conditional-rendering change.
- Assuming reconciliation performs a mathematically optimal minimal-diff — it deliberately uses fast heuristics (same-type-updates-in-place, different-type-tears-down) rather than a general tree-diff algorithm, trading some diff optimality for O(n) performance.
- Confusing "render phase" with "commit phase" — state updates and diffing happen in the (potentially interruptible, pure) render phase; actual DOM mutations only happen in the commit phase, and side effects triggered by `useEffect` run even later, after the commit.
- Forgetting that Fiber's interruptibility is exactly why component render functions must stay pure — React may call, pause, or discard a render pass under concurrent rendering, which is unsafe if that render performed observable side effects.

## Interview Questions & Answers

**Q: What is the virtual DOM, in your own words?**
A: A lightweight, in-memory tree of plain JavaScript objects describing the desired UI — element types, props, and children — that React builds from your components' JSX/`createElement` output. It's an intermediate representation React diffs against the previous version to compute the minimal real DOM operations needed, rather than a direct copy or subset of the actual browser DOM.

**Q: Walk through what happens, at a high level, when a component's state changes.**
A: React schedules a re-render, calls the affected component function(s) to produce a new virtual DOM tree (the render phase — pure, and potentially interruptible under Fiber), diffs that new tree against the previous one using its reconciliation heuristics, then applies the computed minimal set of changes to the real DOM in the commit phase. Effects (`useEffect`) run after the commit completes.

**Q: What happens during reconciliation when an element changes type versus when it stays the same type?**
A: If an element at a given position changes type between renders (e.g., `<div>` to `<span>`, or one component to a different one), React tears down the old subtree completely — unmounting it and discarding its state — and mounts a fresh subtree from scratch. If the type stays the same, React keeps the existing underlying DOM node/component instance and just updates its changed props/attributes in place, then recurses into its children.

**Q: What is the Fiber architecture, and why was it introduced?**
A: Fiber (React 16+) is the reimplementation of React's reconciliation engine as an incremental, unit-of-work-based process instead of one uninterruptible recursive tree walk. Each fiber is a plain JS object mirroring a piece of the component tree, letting React process work in chunks, yield back to the browser between chunks to stay responsive, and pause, abandon, or reprioritize in-progress rendering work. It's the foundational mechanism that makes concurrent features like transitions and Suspense possible.

**Q: Is the virtual DOM always faster than direct DOM manipulation? Why or why not?**
A: No — a specific, hand-optimized imperative DOM update targeting exactly the right node can outperform going through React's diffing process, since the virtual DOM approach necessarily does some extra bookkeeping (building a new tree, diffing it) that a perfectly targeted manual mutation skips entirely. The actual value proposition of the virtual DOM isn't raw speed — it's a declarative programming model plus a reasonably efficient, general-purpose, predictable way to compute correct DOM updates automatically, which scales far better for complex UIs than hand-synchronized imperative DOM code, even if it isn't winning every individual micro-benchmark.

## Related Topics
- [keys-and-reconciliation.md](./keys-and-reconciliation.md)
- [pure-components.md](./pure-components.md)
- [react-performance-optimization.md](./react-performance-optimization.md)
- [component-lifecycle.md](./component-lifecycle.md)
- [rendering-lists-and-keys.md](./rendering-lists-and-keys.md)
