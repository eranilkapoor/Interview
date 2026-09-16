# Redux Dispatch

`dispatch(action)` is the only mechanism Redux provides for changing state — there is no other way to update the store. Calling `store.dispatch(action)` sends that action object into the store, which passes it, along with the current state, into the root reducer; the reducer computes and returns the next state, the store replaces its internal state with that result, and finally the store notifies every registered subscriber that a change has happened. This is the entire lifecycle of a Redux update, and every single state change in a Redux app — no matter how deep in the component tree it originates — goes through exactly this same `dispatch` -> reducer -> new state -> notify subscribers pipeline, which is precisely what makes Redux state changes traceable and predictable: every change corresponds to exactly one dispatched action, and that action is visible in the Redux DevTools log.

In a React app using `react-redux`, you rarely call `store.dispatch` directly. The older class-component pattern used `connect(mapStateToProps, mapDispatchToProps)` to wire a component's props to bound dispatch calls — `mapDispatchToProps` returns an object of functions that, when called, automatically dispatch the corresponding action, so the component just calls `this.props.addTodo(text)` without ever seeing `dispatch` itself. The modern hooks-based equivalent is `useDispatch()`, which returns the store's `dispatch` function directly for use inside a function component: `const dispatch = useDispatch(); dispatch(addTodo(text));`. Both approaches ultimately do the same thing — they just differ in how the `dispatch` call gets threaded into the component.

A crucial constraint of plain `dispatch` is that it only accepts plain action objects — calling `dispatch(someFunction)` or `dispatch(somePromise)` with vanilla Redux throws an error, because the store's default dispatch has no idea what to do with anything other than a `{ type, ... }` object it can hand to a reducer. This is a deliberate design decision: reducers must stay synchronous and side-effect-free, so there's no "natural" place in the core dispatch flow for async logic like an API call. Middleware is what extends what you're allowed to `dispatch` — `redux-thunk`, the most common example, intercepts dispatched *functions* (instead of just objects) before they reach the reducer, calls them with `(dispatch, getState)`, and lets that function perform async work and dispatch further plain actions once it's done (see [redux-middleware.md](./redux-middleware.md) for the full mechanics). Without middleware installed, `dispatch` is strictly synchronous and strictly limited to plain objects — this is a common interview trap, since it's easy to assume `dispatch` "just works" with async functions out of the box.

## Examples

```js
// Plain dispatch: the only way to change store state
import { createStore } from 'redux';
const store = createStore(todosReducer);

store.dispatch({ type: 'ADD_TODO', payload: { id: 1, text: 'Learn Redux' } });
// Under the hood: reducer(currentState, action) -> newState -> subscribers notified
console.log(store.getState()); // reflects the new todo
```

```jsx
// react-redux: calling dispatch from a component with the useDispatch hook
import { useDispatch, useSelector } from 'react-redux';
import { addTodo } from './todosSlice';

function AddTodoForm() {
  const dispatch = useDispatch();
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(addTodo(text)); // dispatches the action created by the action creator
    setText('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      <button type="submit">Add</button>
    </form>
  );
}
```

```js
// Plain objects only, without middleware — this throws
store.dispatch({ type: 'ADD_TODO', payload: 'ok' }); // fine

store.dispatch(function (dispatch) {   // Error: Actions must be plain objects.
  dispatch({ type: 'ADD_TODO', payload: 'not ok without redux-thunk' });
});

// With redux-thunk middleware installed, dispatching a function is allowed:
function addTodoAsync(text) {
  return async (dispatch, getState) => {
    dispatch({ type: 'ADD_TODO_START' });
    const saved = await api.saveTodo(text);          // side effect, fine inside a thunk
    dispatch({ type: 'ADD_TODO_SUCCESS', payload: saved });
  };
}
store.dispatch(addTodoAsync('Learn thunks')); // works, because middleware intercepts it
```

## Common Pitfalls / Gotchas

- Calling `dispatch` with a function or a Promise without any middleware installed — plain Redux's `dispatch` only accepts plain objects and throws otherwise; this only works once `redux-thunk` (or similar middleware) is added to the store.
- Expecting `dispatch(action)` to be awaitable/to reflect the new state immediately after the call returns — dispatch is synchronous for plain actions (state is updated before `dispatch` returns), but components reading state via `useSelector` re-render on their own schedule; don't rely on reading `store.getState()` from unrelated code right after a `dispatch` call as if it were guaranteed to already reflect UI-visible updates everywhere.
- Dispatching too many fine-grained actions for what's conceptually one user action, making the DevTools action log noisy and harder to follow — versus dispatching one well-named action carrying all the necessary payload data.
- Forgetting that `mapDispatchToProps`/`useDispatch` are just convenience wrappers around the same underlying `store.dispatch` — there's no separate/special "React dispatch"; it's literally the store's `dispatch` function, made convenient to call from inside a component.
- Trying to dispatch an action from inside a reducer — reducers must stay pure and cannot call `dispatch` themselves; any action that needs to trigger further actions belongs in middleware (a thunk) or a `useEffect` that dispatches in response to a state change, not inside the reducer computing that state.

## Interview Questions & Answers

**Q: What exactly happens, step by step, when you call `store.dispatch(action)`?**
A: The store passes the action object, along with the current state, into the root reducer. The reducer computes and returns the next state (without mutating the old one). The store replaces its internal state reference with that new state. Finally, the store calls every function registered via `subscribe`, notifying them that a change occurred — which is how UI bindings like `react-redux`'s `useSelector` know to check whether they need to re-render.

**Q: Why does plain `dispatch` reject functions and Promises, and what's needed to dispatch one?**
A: Plain Redux's dispatch is designed to hand the action directly to a synchronous, pure reducer, so it only accepts plain objects with a `type` field — a function or Promise has no defined way to become a piece of new state on its own. Middleware like `redux-thunk` extends what `dispatch` accepts by intercepting the action before it reaches the reducer: if it's a function, the middleware calls it with `(dispatch, getState)` instead of forwarding it to the reducer, letting that function perform async work and dispatch further plain actions itself.

**Q: What's the difference between the classic `mapDispatchToProps` pattern and the `useDispatch` hook?**
A: `mapDispatchToProps`, used with the `connect()` higher-order component in class components, is a function you provide that returns an object of props, each a function which — when called — dispatches a specific action; the component never touches `dispatch` directly. `useDispatch()`, used in function components, is simpler: it just returns the store's raw `dispatch` function, and you call `dispatch(actionCreator(...))` yourself wherever you need it. Both ultimately call the exact same underlying `store.dispatch`.

**Q: Is `dispatch` synchronous or asynchronous for a plain action object?**
A: Synchronous — by the time `store.dispatch(action)` returns, the reducer has already run and the store's internal state has already been updated (and subscribers already notified). Asynchrony only enters the picture when middleware like `redux-thunk` is involved and you dispatch a function that itself performs async work (e.g., an API call) before dispatching further plain actions once that work resolves.

## Related Topics
- [redux-store.md](./redux-store.md)
- [redux-actions.md](./redux-actions.md)
- [redux-reducers.md](./redux-reducers.md)
- [redux-middleware.md](./redux-middleware.md)
- [redux-subscribe.md](./redux-subscribe.md)
