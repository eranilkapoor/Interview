# useState

`useState` is the fundamental Hook for giving a function component its own local, persistent, render-triggering state. Calling `const [value, setValue] = useState(initialValue)` gives you back a two-element array: the current value for this render, and a setter function that, when called, tells React "this state has changed, please re-render this component (and its descendants) with the new value." Unlike a plain local variable inside the component function (which is recreated fresh on every render and forgotten immediately afterward), state created with `useState` is preserved by React across renders, associated with that specific component instance, for as long as the component stays mounted.

A subtlety that trips up almost everyone at some point is that the setter function is **asynchronous in effect**, not literal value assignment — calling `setCount(count + 1)` doesn't immediately mutate `count` in place; it schedules a re-render in which `useState` will return the new value. Within the *same* event handler, `count` still refers to the value captured in that render's closure until the function returns and React re-renders. This becomes a real bug when you need to compute a new state value *based on the previous one* and might call the setter more than once, or when React batches multiple `setState` calls together (which it does automatically for all updates triggered inside event handlers, and — as of React 18 — for updates inside promises, `setTimeout`, and other previously-unbatched contexts too, via "automatic batching"): calling `setCount(count + 1)` twice in a row inside one handler only increments once, because both calls read the *same* stale `count` from that render's closure. The fix is the **functional updater** form, `setCount(c => c + 1)`, which receives the truly latest pending state as its argument (not the possibly-stale value from the closure) and guarantees each call builds correctly on the one before it, regardless of batching.

`useState` also accepts a function instead of a plain value for its *initial* state — this is called **lazy initialization**, and it exists purely as a performance escape hatch: `useState(computeExpensiveDefault())` would call `computeExpensiveDefault()` on *every single render*, even though the return value is only ever used on the very first render (all subsequent renders ignore the argument to `useState` entirely and just return the already-stored state). Passing a function instead, `useState(() => computeExpensiveDefault())`, tells React to call that function only once, on the initial mount, and never again.

Finally, `useState` compares new state to old state by reference (`Object.is`), not by deep value equality — so state holding an object or array must always be replaced with a *new* reference to trigger a re-render and be considered "changed." Mutating an existing array or object in place (`state.push(item)` or `state.name = 'x'`) and then calling `setState(state)` with the same reference will not trigger a re-render (React sees the same reference and bails out), and even where it did re-render for other reasons, it would violate React's assumption that state is immutable, causing subtle bugs elsewhere (e.g., in memoization comparisons). The correct pattern is always to construct a new array/object (`setState([...state, item])`, `setState({ ...state, name: 'x' })`) on every update.

## Examples

```jsx
// Functional updates fix the "stale closure, multiple setState calls" bug
function Counter() {
  const [count, setCount] = useState(0);

  const incrementTwiceWrong = () => {
    setCount(count + 1); // both reads see the SAME `count` from this render's closure
    setCount(count + 1); // net effect: +1, not +2
  };

  const incrementTwiceRight = () => {
    setCount((c) => c + 1); // always operates on the latest pending value
    setCount((c) => c + 1); // net effect: +2
  };

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={incrementTwiceRight}>+2 (correct)</button>
    </div>
  );
}
```

```jsx
// Lazy initial state — the function runs only once, on mount, not every render
function ExpensiveDefault() {
  // BAD: computeInitialTree() runs on every single render, its result thrown away
  // const [tree, setTree] = useState(computeInitialTree());

  // GOOD: React only calls this function once, for the very first render
  const [tree, setTree] = useState(() => computeInitialTree());

  return <TreeView data={tree} onChange={setTree} />;
}

function computeInitialTree() {
  console.log('Computing initial tree...'); // logs once, not on every re-render
  return buildLargeDataStructure();
}
```

```jsx
// Object/array state requires a new reference — mutation in place won't trigger a re-render
function TodoApp() {
  const [todos, setTodos] = useState([{ id: 1, text: 'Learn hooks', done: false }]);

  const addTodoWrong = (text) => {
    todos.push({ id: Date.now(), text, done: false }); // mutates in place
    setTodos(todos); // SAME reference — React sees no change, won't re-render
  };

  const addTodoRight = (text) => {
    setTodos((prev) => [...prev, { id: Date.now(), text, done: false }]); // new array reference
  };

  return (
    <ul>
      {todos.map((t) => (
        <li key={t.id}>{t.text}</li>
      ))}
    </ul>
  );
}
```

## Common Pitfalls / Gotchas

- Calling the setter multiple times in one handler using the current closed-over value (`setCount(count + 1)` twice) instead of the functional updater form (`setCount(c => c + 1)`) — both calls read the same stale value, so the net update is wrong.
- Mutating state in place (`array.push(...)`, `obj.field = x`) and then calling the setter with that same reference — React's change detection is reference-based, so this silently fails to trigger a re-render (and breaks the immutability assumption other React features rely on).
- Passing a function call result directly as the initial value (`useState(expensiveCall())`) instead of the function itself (`useState(() => expensiveCall())`) — the former re-runs the expensive computation on every render even though it's discarded after the first.
- Expecting `setState` to update the variable synchronously and reading the "new" value on the very next line — the update is only reflected starting from the *next* render; the current render's variable stays the same until then.
- Not realizing React 18 batches state updates automatically even inside `setTimeout`, promises, and native event handlers (not just React's own synthetic event handlers as in React 17 and earlier) — code relying on multiple renders happening between several `setState` calls in those contexts may behave differently than expected pre-React-18.

## Interview Questions & Answers

**Q: Why would you use `setCount(c => c + 1)` instead of `setCount(count + 1)`?**
A: `setCount(count + 1)` uses `count` as captured in that render's closure, which is fixed for the duration of that render/handler regardless of how many times you call the setter. If you need to base an update on the truly latest pending state — especially when calling the setter more than once in the same handler, or when updates might be batched — the functional form `setCount(c => c + 1)` receives the actual latest pending value as its argument, guaranteeing correct sequential updates.

**Q: Is `setState` synchronous? What actually happens when you call it?**
A: No — calling the setter doesn't immediately mutate the state variable; it schedules a re-render in which the Hook will return the new value. Inside the same function/handler, the old variable (from that render's closure) is unchanged until the component actually re-renders. React 18 additionally batches multiple `setState` calls together automatically across virtually all contexts (event handlers, promises, timeouts, native event listeners), applying them together in a single re-render rather than one re-render per call.

**Q: What is "lazy initial state" in `useState`, and why would you use it?**
A: Passing a function (instead of a value) as `useState`'s argument, e.g. `useState(() => expensiveComputation())`. React calls that function only once, on the component's initial mount, to compute the starting state — on every subsequent render, the argument is ignored entirely (the already-stored state is returned instead). This avoids re-running an expensive computation on every render just to throw its result away, which is exactly what would happen if you passed `expensiveComputation()` directly as the argument.

**Q: Why doesn't `setTodos(todos)` trigger a re-render after you `push()` a new item onto the `todos` array?**
A: React determines whether state has "changed" by comparing the new value to the old one via reference equality (`Object.is`), not a deep value comparison. `array.push()` mutates the array in place and returns the same reference, so passing that same reference back to `setTodos` looks identical to the previous state from React's perspective, and it bails out of re-rendering. The fix is to create a new array/object reference on every update, e.g. `setTodos([...todos, newItem])`.

**Q: How does React 18's automatic batching change `useState` behavior compared to earlier versions?**
A: Before React 18, React only batched multiple `setState` calls together (into a single re-render) when they occurred inside a React event handler; calls made inside a `setTimeout`, a native DOM event listener, or a Promise callback each triggered their own separate synchronous re-render. React 18 extends batching automatically to all of these contexts, so multiple state updates anywhere are grouped into one re-render by default, improving performance and consistency (opt out per-update with `flushSync` if a synchronous re-render is genuinely required).

## Related Topics
- [react-hooks-overview.md](./react-hooks-overview.md)
- [use-reducer.md](./use-reducer.md)
- [state.md](./state.md)
- [lifting-state-up.md](./lifting-state-up.md)
- [use-effect.md](./use-effect.md)
