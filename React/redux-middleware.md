# Redux Middleware

Middleware in Redux is code that sits in between `dispatch` and the reducer, forming a pipeline that every dispatched action passes through before it ever reaches the reducer. Each piece of middleware has the somewhat famous triple-arrow signature `store => next => action => { ... }`: it receives the store (to read state or dispatch further actions), a `next` function (which either calls the next middleware in the chain, or, if this is the last middleware, forwards the action to the actual reducer), and finally the action being dispatched. Inside that innermost function, a piece of middleware can inspect the action, transform it, dispatch different actions instead, log it, delay it, or simply call `next(action)` to pass it along unchanged — middleware is composed, so multiple pieces of middleware chain together into a single pipeline that every action flows through in order.

Middleware exists because reducers are deliberately constrained to be pure and synchronous — no API calls, no timers, no randomness — which means there needs to be *somewhere* in the system that's explicitly allowed to do that kind of impure, asynchronous, side-effecting work: logging every action for debugging, sending analytics, and, most commonly, handling async logic like data fetching. Without middleware, `dispatch` only accepts plain objects (see [redux-dispatch.md](./redux-dispatch.md)); middleware is precisely what extends what you're allowed to pass to `dispatch` in the first place, by intercepting non-plain-object "actions" before they'd otherwise cause an error.

`redux-thunk` is the simplest and most common middleware, and it's included by default in Redux Toolkit's `configureStore`. It checks whether a dispatched "action" is actually a function rather than a plain object; if it is, instead of forwarding it to the reducer, the thunk middleware calls that function directly, passing it `(dispatch, getState)` — letting the function perform whatever async work it needs (an API call, a delay) and dispatch further plain actions whenever it's ready, entirely outside the constraints reducers operate under. This is enough for the vast majority of everyday async logic (fetch data, dispatch loading/success/failure actions) and is why it's the sensible default.

`redux-saga` takes a fundamentally different, more powerful approach for genuinely complex async flows — coordinating multiple requests, cancelling an in-flight request when a newer one starts, debouncing user input before firing a request, or orchestrating long-running background processes. Rather than plain async functions, sagas are written using ES2015 generator functions, which can pause execution at a `yield`, be resumed later, and be cancelled externally by the saga middleware's runtime — capabilities plain `async`/`await` doesn't have. This makes redux-saga considerably more expressive for complex coordination logic, at the cost of a steeper learning curve (generators, the saga effect vocabulary like `call`/`put`/`take`/`cancel`) that isn't worth adopting for simple fetch-and-dispatch use cases where a thunk is simpler and sufficient. Both are installed onto the store via `applyMiddleware(...)` in classic Redux (`createStore(reducer, applyMiddleware(thunkMiddleware))`), or simply added to the `middleware` array/callback in Redux Toolkit's `configureStore`.

## Examples

```js
// A minimal custom logger middleware, demonstrating the store => next => action shape
const loggerMiddleware = (store) => (next) => (action) => {
  console.log('dispatching', action);
  const result = next(action); // pass the action along the chain (to the next middleware, or the reducer)
  console.log('next state', store.getState());
  return result;
};
```

```js
// Classic Redux: wiring up middleware with applyMiddleware
import { createStore, applyMiddleware } from 'redux';
import thunkMiddleware from 'redux-thunk';

const store = createStore(rootReducer, applyMiddleware(thunkMiddleware, loggerMiddleware));

// Without thunk middleware, this dispatch would throw ("Actions must be plain objects").
function fetchTodos() {
  return async (dispatch, getState) => {
    dispatch({ type: 'todos/fetchStart' });
    try {
      const todos = await api.getTodos();
      dispatch({ type: 'todos/fetchSuccess', payload: todos });
    } catch (err) {
      dispatch({ type: 'todos/fetchFailure', payload: err.message });
    }
  };
}
store.dispatch(fetchTodos());
```

```js
// redux-saga: generator-based async logic, with built-in cancellation support
import { call, put, takeLatest, cancel } from 'redux-saga/effects';

function* fetchTodosSaga() {
  try {
    yield put({ type: 'todos/fetchStart' });
    const todos = yield call(api.getTodos); // pauses here until the call resolves
    yield put({ type: 'todos/fetchSuccess', payload: todos });
  } catch (err) {
    yield put({ type: 'todos/fetchFailure', payload: err.message });
  }
}

// takeLatest automatically cancels a still-running fetchTodosSaga
// if 'todos/fetchRequested' is dispatched again before the first finishes.
function* rootSaga() {
  yield takeLatest('todos/fetchRequested', fetchTodosSaga);
}
```

## Common Pitfalls / Gotchas

- Trying to dispatch a function or Promise without any middleware installed — plain Redux only accepts plain action objects; the "Actions must be plain objects" error is a strong signal that `redux-thunk` (or similar) isn't wired up.
- Forgetting to call `next(action)` inside custom middleware — if a piece of middleware never calls `next`, the action stops there and never reaches the rest of the chain or the reducer, silently breaking the app.
- Reaching for `redux-saga` for simple fetch-and-dispatch logic where a thunk would be simpler — sagas' generator syntax and effect vocabulary add real learning-curve and code overhead that only pays off for genuinely complex coordination (cancellation, debouncing, orchestrating multiple concurrent flows).
- Putting business logic that belongs in a reducer inside middleware instead — middleware is for side effects and cross-cutting concerns (logging, async orchestration), not for computing what the next state should look like; that's still the reducer's job.
- Not understanding that middleware order matters — since middleware forms a chain via `next`, a middleware placed before another can intercept/transform an action before that later middleware ever sees it, so ordering in `applyMiddleware(...)` (or the `middleware` array in `configureStore`) is significant.

## Interview Questions & Answers

**Q: Why does Redux need middleware at all — why can't a reducer just make an API call directly?**
A: Reducers are required to be pure and synchronous, with no side effects, specifically so that state transitions stay deterministic, testable, and safely replayable (which is what makes Redux DevTools' time-travel debugging trustworthy). An API call is inherently async and has side effects, so it can't live in a reducer. Middleware is the layer explicitly designed to sit between dispatch and the reducer where such impure work — logging, async requests, analytics — is allowed to happen.

**Q: Explain the `store => next => action => {}` middleware signature. What does calling `next(action)` do?**
A: It's a curried function: `store` gives the middleware access to `dispatch`/`getState`, `next` is the function to call to pass the action further along the middleware chain (to the next middleware, or to the actual reducer if this is the last one), and `action` is the action currently being dispatched. Calling `next(action)` continues the pipeline; not calling it stops the action right there, which is either a deliberate feature (e.g., swallowing a specific action) or, if accidental, a bug that silently breaks dispatch.

**Q: What problem does `redux-thunk` solve, and how does it work under the hood?**
A: It lets you dispatch functions in addition to plain action objects, enabling async logic (API calls, conditional dispatching based on `getState()`) without touching the reducer's pure/synchronous contract. Internally, the thunk middleware checks each dispatched value's type — if it's a function, instead of forwarding it to the reducer via `next`, it calls that function directly with `(dispatch, getState)` as arguments, letting the function perform async work and dispatch further plain actions on its own schedule.

**Q: When would you reach for redux-saga instead of redux-thunk?**
A: When you need capabilities plain `async`/`await` functions don't give you cleanly — cancelling an in-flight async operation (e.g., aborting a stale search request when a newer one starts), debouncing/throttling dispatched actions, or coordinating multiple concurrent async flows with complex sequencing. Sagas use generator functions, which can be paused, resumed, and externally cancelled by the saga middleware's runtime, giving fine-grained control that thunks' plain functions don't provide — at the cost of a steeper learning curve that isn't worth it for simple fetch-and-dispatch cases.

**Q: How do you register middleware with the store, in both classic Redux and Redux Toolkit?**
A: In classic Redux, you pass `applyMiddleware(thunkMiddleware, otherMiddleware)` as (part of) the second/third argument to `createStore`. In Redux Toolkit, `configureStore({ reducer, middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(otherMiddleware) })` — and notably, `redux-thunk` is already included in `getDefaultMiddleware()` by default, so you only need to add extra middleware explicitly.

## Related Topics
- [redux-dispatch.md](./redux-dispatch.md)
- [redux-store.md](./redux-store.md)
- [redux-actions.md](./redux-actions.md)
- [redux-reducers.md](./redux-reducers.md)
- [redux-subscribe.md](./redux-subscribe.md)
