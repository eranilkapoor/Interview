# State & useState

State is data that a component owns and manages itself, which can change over time — typically in response to user interaction, a network response, or the passage of time — and whose changes React needs to know about so it can re-render the component to reflect the new value. This is the key distinction between state and props: props are an external input handed down from a parent, which the receiving component treats as read-only, while state is internal, mutable-over-time data that a component is responsible for updating and that belongs to that specific component instance. A search input's current text, whether a dropdown is open, or the list of items fetched from an API are all naturally state — they change while the component is mounted, and the UI needs to visually reflect whatever the current value is at any moment.

In function components, state is declared using the `useState` hook, one of React's built-in hooks. Calling `useState(initialValue)` returns a pair — conventionally destructured as `[value, setValue]` — where the first element is the current state value for this render, and the second is a setter function used to update it. Calling the setter doesn't mutate the state variable in place; it tells React "this component's state should now be this new value," which schedules a re-render of the component (and its descendants, as needed) using the new value. The `initialValue` argument is only used on the component's very first render — on every subsequent re-render, `useState` returns whatever the current state is, ignoring the initial value argument entirely, since React is now tracking that state internally, tied to this specific component instance.

For cases where computing the initial state value is itself expensive (say, reading from `localStorage`, or running a non-trivial calculation), `useState` supports **lazy initialization**: instead of passing a value directly, you pass a function, `useState(() => computeExpensiveInitialValue())`. React calls that function only once, on the very first render, to derive the initial state — on every later re-render, the function is not called again, avoiding the wasted work of recomputing (and immediately discarding) an expensive initial value on every single render. This is a subtly different thing from passing the *result* of calling a function directly (`useState(computeExpensiveInitialValue())`), which would actually invoke that function on every render, even though only the very first call's result is ever used.

Two properties of state are essential to internalize. First, state is local and encapsulated to the component instance that declared it — two separate renders of the same component (e.g., the same `Counter` component used twice on a page) each get their own completely independent state, with no way for one instance's state to leak into or affect the other's unless it's explicitly lifted up and shared via props (see [lifting-state-up.md](./lifting-state-up.md)). Second, state updates are asynchronous and often batched: calling a state setter doesn't update the variable immediately in the currently-running function — the current render's `value` variable stays the same for the rest of that function call, and React applies the update (and re-renders with the new value) on a subsequent render pass. React batches multiple state updates that happen within the same event handler (and, since React 18, in most other contexts too) into a single re-render for efficiency, rather than re-rendering once per individual `setValue` call — which is why reading a state variable immediately after calling its setter still shows the old value, and why patterns like `setCount(count + 1); setCount(count + 1);` in the same handler don't add 2, since both calls close over the same stale `count` from that render (the fix is the updater-function form, `setCount(c => c + 1)`, which always receives the latest pending value). This file covers state conceptually; for the deeper mechanics of `useState` itself (updater functions, functional updates, common patterns), see [use-state.md](./use-state.md).

## Examples

```jsx
// Basic useState: declaring and updating local state
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0); // 0 is only used on the first render

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
```

```jsx
// State is local per component instance — each Counter below is fully independent
function App() {
  return (
    <div>
      <Counter /> {/* has its own count */}
      <Counter /> {/* completely separate count, starts at 0 too */}
    </div>
  );
}
```

```jsx
// Lazy initialization: the function only runs once, on the first render
function SettingsPanel() {
  const [settings, setSettings] = useState(() => {
    // Expensive work (e.g. JSON.parse on localStorage) — only ever runs once
    const stored = localStorage.getItem('settings');
    return stored ? JSON.parse(stored) : { theme: 'light' };
  });

  return (
    <button onClick={() => setSettings((s) => ({ ...s, theme: 'dark' }))}>
      Current theme: {settings.theme}
    </button>
  );
}
```

## Common Pitfalls / Gotchas

- Expecting a state variable to reflect its new value immediately after calling its setter, within the same function — state updates are applied on the next render; the current render's variable is unaffected by a setter call made later in that same function body.
- Calling `useState(expensiveComputation())` instead of `useState(() => expensiveComputation())` — the former re-invokes the expensive function on every single render (even though only the first call's result is ever used), while the lazy-initializer function form runs only once.
- Directly mutating state (e.g., `state.push(item)` on an array, or `state.field = x` on an object) instead of calling the setter with a new value/object — React compares state by reference to decide whether to re-render, so mutating in place often fails to trigger a re-render at all, and it also breaks predictability if React briefly holds onto the old reference internally.
- Assuming multiple state variables are stored together in one object automatically — each `useState()` call creates an independent piece of state; there's no automatic merging across separate `useState` calls the way `this.setState()` merged updates in class components.
- Relying on stale closures when updating state based on its previous value inside an async callback or multiple rapid calls — use the updater-function form (`setCount(c => c + 1)`) instead of referencing the outer `count` variable directly, since that form always operates on the latest pending state.

## Interview Questions & Answers

**Q: What is state, and how is it different from props?**
A: State is data a component owns internally and can update itself, typically in response to user interaction or other events, and updating it causes the component to re-render. Props are external data passed down from a parent that the receiving component treats as read-only. State is "who owns and can change this data," while props are "what was handed to me from outside."

**Q: What does `useState` return, and what does the second element do?**
A: It returns a two-element array: the current state value for this render, and a setter function. Calling the setter with a new value tells React to update this component's state and schedule a re-render using that new value on the next render pass — it doesn't mutate the existing variable in place.

**Q: What is lazy initialization in `useState`, and when would you use it?**
A: Passing a function (rather than a value) as `useState`'s argument, so React calls that function only once, on the component's very first render, to compute the initial state. It's useful when computing the initial value is expensive (parsing stored data, heavy calculations) — passing the computed value directly would re-run that expensive computation on every render, even though only the first render's result is ever actually used.

**Q: Why doesn't reading a state variable immediately after calling its setter show the updated value?**
A: Because state updates aren't applied synchronously within the currently executing function — calling the setter schedules a re-render, and the new value is only available starting with that next render (as a new value for the state variable in that render's scope). The variable captured in the current function's closure still refers to the value from the render currently in progress.

**Q: Is each component's state shared across multiple uses of that component, or is it independent?**
A: Independent. Each rendered instance of a component gets its own separate state, fully encapsulated to that instance. Rendering the same component twice on a page produces two components with completely unrelated state, even though they share the same function definition — there's no built-in mechanism for one instance's state to implicitly affect another's.

## Related Topics
- [use-state.md](./use-state.md)
- [props.md](./props.md)
- [lifting-state-up.md](./lifting-state-up.md)
- [react-hooks-overview.md](./react-hooks-overview.md)
- [use-reducer.md](./use-reducer.md)
- [controlled-vs-uncontrolled-components.md](./controlled-vs-uncontrolled-components.md)
