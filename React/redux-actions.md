# Redux Actions

An action in Redux is a plain JavaScript object that describes something that happened in the application — not a command telling the store how to change, but a description of an event, past tense in spirit: "the user added a todo," "the request succeeded," "the theme was toggled." Every action is required to have a `type` field, conventionally a descriptive string like `'ADD_TODO'` or `'todos/add'`, which is the piece of information the reducer switches on to decide how (or whether) to update state. Any other data the reducer needs to perform the update — the new todo's text, an ID, a fetched payload — travels alongside `type` as additional fields on the same object, commonly namespaced under a `payload` key by convention (the "Flux Standard Action" shape: `{ type, payload, error?, meta? }`), though classic Redux itself doesn't enforce any particular shape beyond requiring `type`.

Because constructing these action objects by hand every time you need to dispatch one is repetitive and error-prone (easy to typo a `type` string, easy to forget a field), Redux code almost always wraps action construction in **action creators** — plain functions that take some arguments and return a fully formed action object. `function addTodo(text) { return { type: 'ADD_TODO', payload: { id: nextId(), text } }; }` is an action creator; calling `addTodo('Learn Redux')` produces the action object, and `dispatch(addTodo('Learn Redux'))` sends it to the store. Action creators are just functions — nothing magic — which makes them easy to test in isolation (assert on the object they return) independent of the store or reducer.

The `type` field is the load-bearing part of the whole system: it's a plain string (or, in larger codebases, an action-type constant to avoid typos and get autocomplete), and by convention it's often namespaced by feature/domain (`'todos/add'`, `'auth/login'`) so that action types remain unique and readable across a large codebase with many reducers. Classic Redux left it entirely up to convention how you name types and shape payloads — different codebases adopted different conventions (some prefixed with a slice name, some used all-caps snake case, some followed the Flux Standard Action spec strictly), which was a real source of inconsistency across Redux codebases in practice.

Redux Toolkit's `createSlice` addresses this by auto-generating both the action `type` strings and the action creator functions for you from a single slice definition — you write a reducer function named `addTodo` inside a slice, and `createSlice` automatically produces a correctly namespaced action type (like `'todos/addTodo'`) and a matching `addTodo` action creator, eliminating an entire category of hand-written boilerplate and naming inconsistency. Understanding how to hand-write action objects and action creators the classic way is still important for interviews, though, since it's exactly what `createSlice` is generating for you under the hood.

## Examples

```js
// Classic Redux: hand-written action objects and action creators
const ADD_TODO = 'ADD_TODO';
const TOGGLE_TODO = 'TOGGLE_TODO';

// Action creators — plain functions returning plain action objects
function addTodo(text) {
  return {
    type: ADD_TODO,
    payload: { id: Date.now(), text, completed: false },
  };
}

function toggleTodo(id) {
  return { type: TOGGLE_TODO, payload: { id } };
}

// Dispatching them
store.dispatch(addTodo('Buy milk'));
store.dispatch(toggleTodo(1));
```

```js
// An async action pattern using plain action creators for each stage
// (dispatching the middle one requires middleware — see redux-middleware.md)
function fetchUserStart() {
  return { type: 'user/fetchStart' };
}
function fetchUserSuccess(user) {
  return { type: 'user/fetchSuccess', payload: user };
}
function fetchUserFailure(error) {
  return { type: 'user/fetchFailure', payload: error, error: true };
}
```

```js
// Redux Toolkit: createSlice auto-generates action types AND action creators
import { createSlice } from '@reduxjs/toolkit';

const todosSlice = createSlice({
  name: 'todos',
  initialState: [],
  reducers: {
    addTodo(state, action) {
      state.push({ id: Date.now(), text: action.payload, completed: false });
    },
  },
});

export const { addTodo } = todosSlice.actions; // auto-generated action creator
// addTodo('Buy milk') === { type: 'todos/addTodo', payload: 'Buy milk' }
export default todosSlice.reducer;
```

## Common Pitfalls / Gotchas

- Putting non-serializable values (functions, class instances, Promises, DOM nodes) into an action's payload — Redux state and actions are expected to be plain, serializable data, which is what makes DevTools logging/time-travel and state persistence work correctly.
- Dispatching a plain object directly for async logic (`dispatch({ type: 'FETCH_USER' })` and expecting it to "go fetch") — an action only ever describes something that already happened or is being requested; it carries no behavior itself, so the actual async work needs a thunk or another middleware-based pattern (see [redux-middleware.md](./redux-middleware.md)).
- Inconsistent action `type` naming across a large codebase (mixing `'ADD_TODO'`, `'todos/add'`, `'AddTodo'` conventions) — this was a genuine pain point of classic Redux at scale, and is a big part of why `createSlice`'s auto-generated, consistently namespaced types are preferred today.
- Forgetting that the `type` field is what reducers switch on — a typo in an action creator's `type` string (or a mismatch with what a reducer's `switch` checks for) fails silently: the action dispatches fine, but no reducer branch matches it, and state simply doesn't change with no error thrown.
- Overloading a single action with too many unrelated concerns instead of dispatching multiple, more specific actions — smaller, well-named actions are easier to trace in DevTools and reason about than a single catch-all "UPDATE" action carrying a large, ambiguous payload.

## Interview Questions & Answers

**Q: What is a Redux action, precisely, and what's the one field every action must have?**
A: An action is a plain JavaScript object describing something that happened in the app. The only field Redux itself requires is `type`, a string identifying what kind of action it is — the reducer uses this to decide whether and how to compute new state. Everything else on the object (commonly under a `payload` key) is just data the reducer might need to perform that update.

**Q: What is an action creator, and why use one instead of writing action objects inline everywhere you dispatch?**
A: An action creator is a plain function that returns an action object, parameterized by whatever arguments it needs (e.g., `addTodo(text)` returns `{ type: 'ADD_TODO', payload: { text } }`). Using action creators avoids repeating (and potentially mistyping) the action shape at every dispatch call site, centralizes the action's shape in one place, and makes actions independently testable — you can assert what an action creator returns without touching the store at all.

**Q: Can an action's `type` be anything other than a string?**
A: Technically Redux only requires `type` to be present and usually checked with strict equality, so in principle it could be any value comparable with `===` (including a Symbol), but in practice it's always a string — strings serialize cleanly for DevTools logging, persistence, and cross-tab/cross-process communication, whereas Symbols and other reference types don't.

**Q: How does Redux Toolkit's `createSlice` change how you write actions compared to classic Redux?**
A: With classic Redux you hand-write both the action type constants and the action creator functions yourself, and you're responsible for keeping their naming consistent across the codebase. `createSlice` takes a slice name plus a `reducers` object, and automatically generates a namespaced action type (e.g., `'todos/addTodo'`) and a matching action creator function for each reducer function you define — so you get both for free, correctly and consistently named, from a single definition.

## Related Topics
- [redux-store.md](./redux-store.md)
- [redux-reducers.md](./redux-reducers.md)
- [redux-dispatch.md](./redux-dispatch.md)
- [redux-middleware.md](./redux-middleware.md)
- [redux-subscribe.md](./redux-subscribe.md)
