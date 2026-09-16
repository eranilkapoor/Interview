# useReducer

`useReducer` is React's Hook for managing state through an explicit **reducer function** — `(state, action) => newState` — rather than through direct setter calls. You initialize it with `const [state, dispatch] = useReducer(reducer, initialState)`, and instead of calling a setter directly with the new value (as with `useState`), you call `dispatch(action)` with a plain object (conventionally `{ type: 'increment', payload: ... }`) describing *what happened*, and the reducer function is responsible for deciding, based on the current state and that action, exactly what the new state should become. React then re-renders with whatever the reducer returned. This is structurally identical to the reducer pattern Redux popularized — indeed, `useReducer` gives you a Redux-like local-state pattern built directly into React with zero extra dependencies, which is precisely why it's often reached for as either a stepping stone toward, or a lighter-weight alternative to, adopting Redux itself (see [redux-reducers.md](./redux-reducers.md) for how the pattern scales up to app-wide state).

The core tradeoff between `useState` and `useReducer` is about *where the update logic lives* and how it scales with complexity. `useState` is ideal when a piece of state updates independently and simply — a boolean toggle, a text input's value, a counter. `useReducer` starts to pay off once a single conceptual piece of state has several different ways it can change, especially when those transitions are related to each other or need to enforce consistency between multiple sub-values at once (for example, a form with several fields where submitting sets a `submitting` flag, succeeding clears the form and sets a `success` flag, and failing sets an `error` message and keeps the entered values) — instead of scattering that logic across several different `setState` calls in several different handlers (each of which has to independently get the interactions between those sub-values right), a reducer centralizes every possible transition into one function, with one `switch` (or if/else chain) enumerating exactly the actions that are valid and precisely what each one does to the state.

An important practical benefit follows directly from that centralization: because the reducer function itself is a plain, pure function — taking the current state and an action, returning new state, with no dependency on component props, closures, or refs — it's trivially testable in complete isolation from React (call it directly with sample state/action pairs and assert on the output) and it's easy to reason about every possible transition just by reading the one function, rather than by tracing calls scattered across a whole component. `dispatch` (unlike a `useState` setter) also has a stable identity across renders — React guarantees it doesn't change between renders of the same component instance — which is convenient for passing it down to deeply nested children or effects without needing to memoize it with `useCallback` to keep it referentially stable.

`useReducer` doesn't replace `useState` universally — for genuinely simple, independent state, `useState` remains simpler and more direct, and reaching for a reducer prematurely just adds ceremony (defining action types, writing a `switch`, dispatching objects) without a real payoff. The decision is really about *state transition complexity*, not about which Hook is "more advanced" — a good rule of thumb is: if you find yourself writing several `setX(...)` calls together in multiple different handlers to keep related pieces of state consistent with each other, that's usually the signal to consolidate them into one reducer instead.

## Examples

```jsx
// Basic useReducer: a reducer function and dispatched actions
function counterReducer(state, action) {
  switch (action.type) {
    case 'increment':
      return { count: state.count + 1 };
    case 'decrement':
      return { count: state.count - 1 };
    case 'reset':
      return { count: 0 };
    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}

function Counter() {
  const [state, dispatch] = useReducer(counterReducer, { count: 0 });

  return (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={() => dispatch({ type: 'increment' })}>+</button>
      <button onClick={() => dispatch({ type: 'decrement' })}>-</button>
      <button onClick={() => dispatch({ type: 'reset' })}>Reset</button>
    </div>
  );
}
```

```jsx
// A case where useReducer clearly beats several scattered useState calls:
// a form with related submitting/success/error/values state
const initialFormState = { values: { email: '' }, status: 'idle', error: null };

function formReducer(state, action) {
  switch (action.type) {
    case 'field_changed':
      return { ...state, values: { ...state.values, [action.field]: action.value } };
    case 'submit_started':
      return { ...state, status: 'submitting', error: null };
    case 'submit_succeeded':
      return { ...initialFormState, status: 'success' };
    case 'submit_failed':
      return { ...state, status: 'error', error: action.error };
    default:
      return state;
  }
}

function SignupForm() {
  const [state, dispatch] = useReducer(formReducer, initialFormState);

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch({ type: 'submit_started' });
    try {
      await submitSignup(state.values);
      dispatch({ type: 'submit_succeeded' });
    } catch (err) {
      dispatch({ type: 'submit_failed', error: err.message });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={state.values.email}
        onChange={(e) => dispatch({ type: 'field_changed', field: 'email', value: e.target.value })}
      />
      <button disabled={state.status === 'submitting'}>Sign up</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
```

```jsx
// Lazy initialization with useReducer's third argument (mirrors useState's lazy init)
function init(initialCount) {
  return { count: initialCount, history: [] };
}

function CounterWithHistory({ startingValue }) {
  const [state, dispatch] = useReducer(counterReducer, startingValue, init); // init(startingValue) runs once
  return <p>{state.count}</p>;
}
```

## Common Pitfalls / Gotchas

- Reaching for `useReducer` for simple, independent state (a single toggle or text field) where it adds ceremony (action types, a switch statement, dispatch calls) without any real benefit over a plain `useState`.
- Forgetting that the reducer must be a *pure* function — mutating `state` directly instead of returning a new object/array breaks React's reference-based change detection, exactly as with `useState`.
- Not handling an unrecognized `action.type` in the `default` case (or silently swallowing it) — throwing or logging on an unknown action type surfaces typos in action names immediately instead of causing silent no-op bugs.
- Assuming `dispatch` calls are synchronous updates to `state` — like `useState`'s setter, `dispatch` schedules a re-render; `state` in the current closure doesn't reflect the update until the next render.
- Overloading a single reducer with too many unrelated pieces of state "because reducers are supposed to centralize things" — a reducer should model transitions for one conceptually cohesive piece of state, not become an ad hoc global store; if state genuinely needs to be global and shared app-wide, that's a signal to consider Context (with `useReducer` inside a Provider) or a dedicated library like Redux instead.

## Interview Questions & Answers

**Q: What's the core difference between `useState` and `useReducer`?**
A: `useState` updates state directly via a setter you call with the new value (or an updater function). `useReducer` centralizes all possible state transitions into one pure reducer function, `(state, action) => newState`, and you trigger updates by dispatching descriptive action objects rather than setting values directly — the reducer decides what the new state becomes based on the current state and the action.

**Q: When would you choose `useReducer` over `useState`?**
A: When a piece of state has several distinct, related ways it can change — especially when those transitions need to keep multiple sub-values consistent with each other (like a form's values/submitting/error/success state) — a reducer centralizes that logic into one function instead of scattering related `setState` calls across multiple handlers, each of which has to independently reimplement the correct interactions between the sub-values.

**Q: How does `useReducer` relate to Redux?**
A: They share the exact same core pattern: a pure reducer function `(state, action) => newState`, and updates triggered by dispatching action objects rather than direct mutation. `useReducer` is that same pattern built into React for a single component's local state, with no extra library, no middleware, and no global store — Redux extends the pattern to app-wide state with a single centralized store, middleware for side effects, and dedicated DevTools for time-travel debugging.

**Q: Why is a reducer function easy to test in isolation?**
A: It's a pure function with no dependency on React, component props, refs, or closures — you can call `reducer(someState, someAction)` directly in a plain test and assert on the returned state, with no need to render a component, simulate a click, or otherwise involve React's rendering machinery at all.

**Q: Does `dispatch` change identity between renders the way a `useState` setter might in some patterns?**
A: No — React guarantees `dispatch` from `useReducer` (like the setter from `useState`) has a stable identity across re-renders of the same component instance, so it's safe to pass down to child components or list as a dependency in effects/`useCallback` without needing to wrap it separately to preserve referential stability.

## Related Topics
- [use-state.md](./use-state.md)
- [redux-reducers.md](./redux-reducers.md)
- [redux-actions.md](./redux-actions.md)
- [use-context.md](./use-context.md)
- [state.md](./state.md)
