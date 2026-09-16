# Redux Subscribe

`store.subscribe(listener)` is how code outside the store finds out that state has changed. You pass it a callback, and the store adds that callback to an internal list of listeners it will call, with no arguments, every single time an action finishes being processed by the reducer and the store's state has been updated — regardless of whether the specific piece of state a given listener actually cares about changed at all. `subscribe` returns an "unsubscribe" function; calling it removes that listener from the store's list, which matters for cleanup (e.g., in a long-lived script or a manually-managed integration) so a component or module that's no longer relevant doesn't keep getting called forever.

Critically, `subscribe`'s listener callback isn't handed the new state, or told what changed — it's just a plain notification that *something* changed, and it's the listener's own responsibility to call `store.getState()` inside the callback to read whatever state it's interested in and decide whether that specific value actually changed (typically by comparing it against the value it saw last time). This "dumb notification, smart listener" design is intentional and low-level — it's the minimal primitive on top of which richer, smarter subscription systems are built, rather than a system that tries to guess what any particular piece of code cares about.

`react-redux` is exactly such a system built on top of `subscribe`. Internally, the `<Provider store={store}>` component subscribes to the store once, and each `useSelector(selectorFn)` call in a descendant component registers itself (through that shared subscription machinery) to check, after every store notification, whether `selectorFn(state)` returns a different value than it did last time — using a reference-equality check by default. Only if the selected value actually changed does that specific component re-render; components that only read unrelated slices of state, and thus whose selector output didn't change, are left alone. This is what makes `react-redux` scale well to large applications with a single big store: subscribing directly and manually comparing the whole state object yourself would re-run every listener on every action, but `useSelector`'s fine-grained comparison means a dispatch that only touches the `todos` slice doesn't cause a component that only reads `state.user` to re-render at all.

Because `subscribe`'s callback fires on *every* dispatched action regardless of relevance, doing expensive work directly inside a raw `subscribe` callback (without a comparison check first) is a common source of unnecessary work in hand-rolled Redux integrations — this is precisely the class of problem `useSelector`'s internal equality check exists to avoid, and it's a strong reason to prefer `react-redux`'s hooks over calling `store.subscribe` directly in application code, reserving direct `subscribe` calls for framework-level integration code, logging, or persistence layers.

## Examples

```js
// Raw store.subscribe: fires on every dispatch, listener re-reads getState() itself
const store = createStore(todosReducer);

let previousTodoCount = store.getState().todos.length;
const unsubscribe = store.subscribe(() => {
  const currentCount = store.getState().todos.length;
  if (currentCount !== previousTodoCount) {
    console.log(`Todo count changed: ${previousTodoCount} -> ${currentCount}`);
    previousTodoCount = currentCount;
  }
});

store.dispatch({ type: 'ADD_TODO', payload: { id: 1, text: 'Learn Redux' } });
// logs: "Todo count changed: 0 -> 1"

unsubscribe(); // stop listening — the callback will no longer be called
```

```js
// Persisting state to localStorage on every change, using subscribe directly
// (a legitimate low-level use case, outside of component rendering)
store.subscribe(() => {
  localStorage.setItem('appState', JSON.stringify(store.getState()));
});
```

```jsx
// react-redux's useSelector builds on subscribe internally, but only
// re-renders THIS component when the selected slice actually changes.
import { useSelector } from 'react-redux';

function TodoCount() {
  // Re-renders only when state.todos.length changes — not on every dispatch.
  const count = useSelector((state) => state.todos.length);
  return <p>{count} todos</p>;
}

function UserGreeting() {
  // Reads a completely different slice — unaffected by todo-related dispatches.
  const name = useSelector((state) => state.user.name);
  return <p>Hello, {name}</p>;
}
```

## Common Pitfalls / Gotchas

- Assuming the `subscribe` callback receives the new state as an argument — it doesn't; you must call `store.getState()` yourself inside the callback to read whatever you need.
- Doing expensive comparisons or work inside a raw `subscribe` callback without first checking whether the specific value you care about actually changed — since the callback fires on every dispatched action, this repeats that expensive work far more often than necessary.
- Forgetting to call the function returned by `subscribe()` to unsubscribe when a listener is no longer needed — this is a real memory/behavior leak in hand-rolled integrations (though `react-redux`'s hooks handle unsubscription automatically on unmount, so this mostly matters for manual `subscribe` usage).
- Calling `store.subscribe` directly inside React components instead of using `useSelector`/`connect` — it works, but you lose the automatic, fine-grained "only re-render if the selected value changed" comparison that `react-redux` provides, and you'd have to reimplement that logic (and manual unsubscription on unmount) yourself.
- Assuming a `useSelector` selector that returns a new object/array literal every call (`useSelector(state => ({ ...state.todos }))`) will be treated as "unchanged" — by default `useSelector` uses reference equality, so a selector returning a freshly created object every time will make the component think the value always changed, causing unnecessary re-renders (fixable with a custom equality function or `createSelector` from Reselect).

## Interview Questions & Answers

**Q: What does `store.subscribe(listener)` actually pass to the listener when it's called?**
A: Nothing — the listener is called with no arguments. It's purely a "something changed" notification; if the listener needs to know the current state, it must call `store.getState()` itself inside the callback, and typically compares that against a value it cached from the previous notification to determine whether the specific thing it cares about actually changed.

**Q: How does `react-redux`'s `useSelector` avoid re-rendering every connected component on every single dispatched action?**
A: Under the hood it uses the same `store.subscribe` mechanism, but rather than re-rendering unconditionally on every notification, each `useSelector(selectorFn)` call re-runs its selector against the new state and compares the result to the previous result (by reference, by default). Only if that comparison shows the selected value actually changed does the component holding that `useSelector` call re-render — components whose selectors return the same value are left alone.

**Q: Why would you call `store.subscribe` directly in application code instead of just using `useSelector`?**
A: `useSelector` is scoped to React components and re-renders on change. Direct `subscribe` calls are useful for logic that isn't about rendering at all — persisting the whole state tree to `localStorage` after every change, sending analytics events, or logging every state transition for debugging — code that needs to react to "the store changed" independent of any component's render cycle.

**Q: What's returned by `store.subscribe(listener)`, and why does it matter?**
A: It returns an unsubscribe function — calling it removes that specific listener from the store's internal list so it stops being called on future dispatches. This matters for cleanup: a listener registered by code that's since become irrelevant (e.g., torn down manually, or tied to a component that unmounted in a hand-rolled integration) would otherwise keep running forever and hold a reference preventing garbage collection of whatever it closes over.

## Related Topics
- [redux-store.md](./redux-store.md)
- [redux-dispatch.md](./redux-dispatch.md)
- [redux-reducers.md](./redux-reducers.md)
- [use-effect.md](./use-effect.md)
- [context-api-vs-redux.md](./context-api-vs-redux.md)
