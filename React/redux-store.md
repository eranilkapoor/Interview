# Redux Store

The store is the single object at the center of every Redux application — it holds the entire application state tree in one place, and it's the only thing components are ever allowed to read state from or dispatch actions to. Rather than each component or feature owning its own private, scattered pieces of state, Redux consolidates everything into one plain JavaScript object managed by the store, made accessible through a small, fixed API: `getState()` to read the current state, `dispatch(action)` to request a state change, and `subscribe(listener)` to be notified whenever the state changes. This centralization is the whole point of Redux — it makes state changes traceable, predictable, and inspectable (via tools like the Redux DevTools) in a way that state scattered across dozens of components never can be.

In classic Redux, you create the store with `createStore(rootReducer, preloadedState)`, handing it a single root reducer function (typically composed from smaller reducers via `combineReducers` — see [redux-reducers.md](./redux-reducers.md)) that knows how to compute the next state given the current state and a dispatched action. The store itself doesn't contain any logic for *how* state should change — it delegates that entirely to the reducer; the store's own job is bookkeeping: holding the current state reference, running the reducer whenever `dispatch` is called, swapping in the returned new state, and notifying subscribers. `createStore` is technically still exported by the `redux` package but is considered legacy — modern Redux code uses `configureStore` from Redux Toolkit instead, which wraps `createStore` and adds sensible defaults out of the box (the Redux DevTools extension wired up automatically, `redux-thunk` middleware included by default, and development-mode checks that catch accidental state mutations) with far less setup boilerplate.

A Redux application has exactly one store, by design — this is different from React's Context API, where you can freely create as many separate contexts as you want, each scoped to whatever part of the tree needs it. Redux deliberately uses a single store holding a single state tree because that's what makes the entire state of the app inspectable and serializable as one snapshot at any point in time — this is the foundation that makes Redux DevTools' time-travel debugging possible (every dispatched action is recorded alongside the resulting state snapshot, and you can step backward and forward through them) and makes state persistence/rehydration (saving the whole state tree to `localStorage` and restoring it) straightforward. Structure within that single tree is instead achieved by splitting the root reducer into independent slice reducers via `combineReducers`, each owning one key of the overall state object, rather than by creating multiple stores.

## Examples

```js
// Classic Redux: creating a store with createStore and a root reducer
import { createStore, combineReducers } from 'redux';

function todosReducer(state = [], action) {
  switch (action.type) {
    case 'ADD_TODO':
      return [...state, action.payload];
    default:
      return state;
  }
}

function visibilityReducer(state = 'ALL', action) {
  switch (action.type) {
    case 'SET_VISIBILITY':
      return action.payload;
    default:
      return state;
  }
}

const rootReducer = combineReducers({
  todos: todosReducer,
  visibility: visibilityReducer,
});

const store = createStore(rootReducer);
console.log(store.getState()); // { todos: [], visibility: 'ALL' }
```

```js
// The store's core API: getState, dispatch, subscribe
store.subscribe(() => console.log('State changed:', store.getState()));

store.dispatch({ type: 'ADD_TODO', payload: { id: 1, text: 'Learn Redux' } });
// logs: State changed: { todos: [{ id: 1, text: 'Learn Redux' }], visibility: 'ALL' }

console.log(store.getState().todos.length); // 1
```

```js
// Modern Redux Toolkit: configureStore replaces createStore with better defaults
import { configureStore } from '@reduxjs/toolkit';
import todosReducer from './todosSlice';   // created via createSlice
import visibilityReducer from './visibilitySlice';

const store = configureStore({
  reducer: {
    todos: todosReducer,
    visibility: visibilityReducer,
  },
}); // Redux DevTools + redux-thunk are wired up automatically, no extra config
```

## Common Pitfalls / Gotchas

- Creating more than one store — this defeats the entire purpose of Redux's centralized, inspectable state model and breaks DevTools time-travel debugging, which assumes a single state tree over time; if you need isolated state, that's usually a sign to use component/context state instead of a second Redux store.
- Mutating `store.getState()`'s return value directly — the object returned is the live current state, and mutating it bypasses the reducer entirely, doesn't notify subscribers, and can corrupt state in ways that are very hard to debug since nothing dispatched or logged it.
- Forgetting that `store.getState()` returns a snapshot at the moment it's called, not a live-updating reference — code that reads it once and holds onto that value won't see later updates unless it re-reads via `getState()` again or subscribes.
- Manually wiring up `createStore` + middleware + DevTools in a new project instead of using `configureStore` — it's significantly more boilerplate for no benefit in new code, though understanding what `createStore` does underneath is still expected knowledge for interviews.
- Confusing the Redux store with React Context — Context is a built-in React mechanism for passing a value down a tree without prop drilling, with no built-in concept of actions, reducers, middleware, or time-travel debugging; the two solve different problems (see [context-api-vs-redux.md](./context-api-vs-redux.md)).

## Interview Questions & Answers

**Q: What is the Redux store, and what three things is it responsible for?**
A: The store is the single object holding the entire application's state tree. It's responsible for (1) holding the current state and exposing it via `getState()`, (2) accepting requests to change state via `dispatch(action)`, which it runs through the root reducer to compute and store the next state, and (3) letting code register listeners via `subscribe(listener)` that get called after every state change.

**Q: Why does a Redux app use exactly one store, instead of one store per feature?**
A: A single store means the entire application's state is one serializable object at any point in time, which is what makes tooling like Redux DevTools' time-travel debugging (recording every action and the resulting whole-state snapshot) and state persistence (dumping/restoring the whole tree) possible. Structure is instead achieved inside that one tree — by splitting the root reducer into independent slice reducers with `combineReducers`, each owning one key — rather than by spinning up multiple independent stores.

**Q: What's the difference between `createStore` and `configureStore`?**
A: `createStore` (from the classic `redux` package) is the low-level function that creates a store from a reducer, with no defaults — you'd have to manually add middleware (like `redux-thunk`) and wire up the Redux DevTools extension yourself. `configureStore` (from Redux Toolkit) wraps `createStore` and adds good defaults automatically — `redux-thunk` middleware, DevTools integration, and development-only checks for accidental mutations — which is why it's the recommended way to create a store today; `createStore` is still useful to know because it explains what `configureStore` is doing underneath.

**Q: If you call `store.getState()` and save the result in a variable, will that variable update automatically when the store's state changes later?**
A: No — `getState()` returns the current state snapshot at the moment it's called, not a live binding. To be notified of later changes you need to call `subscribe(listener)` (or, in a React app, use `useSelector` from `react-redux`, which subscribes internally and re-renders your component with the fresh state automatically).

## Related Topics
- [redux-actions.md](./redux-actions.md)
- [redux-reducers.md](./redux-reducers.md)
- [redux-dispatch.md](./redux-dispatch.md)
- [redux-subscribe.md](./redux-subscribe.md)
- [redux-middleware.md](./redux-middleware.md)
- [context-api-vs-redux.md](./context-api-vs-redux.md)
