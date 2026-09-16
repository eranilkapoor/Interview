# Redux Reducers

A reducer in Redux is a pure function with the signature `(state, action) => newState` — given the current state and an action describing what happened, it computes and returns the next state. "Pure" here is not a stylistic preference; it's a hard requirement: a reducer must not mutate the `state` argument it receives, must not perform side effects (API calls, `Date.now()`, `Math.random()`, reading/writing outside variables), and must return the exact same output for the exact same input every time it's called. This purity is what makes Redux's whole model work — DevTools time-travel debugging replays actions through reducers to reconstruct past states, and that only produces correct results if reducers are deterministic and side-effect-free.

Because a reducer must never mutate `state` in place, "updating" state actually means constructing and returning a brand-new object (or array) that incorporates the change, typically using the spread operator or array methods that return new arrays (`map`, `filter`, `concat`) rather than mutating ones (`push`, `splice`, direct index assignment). For a nested update — say, toggling one todo inside an array of todos — this means spreading at every level that changed: a new array containing a new object for the changed todo, with the rest of the array's references left untouched. This immutable-update discipline is exactly what Redux Toolkit's `createSlice` automates away using Immer internally: Immer lets you write code that *looks* like direct mutation (`state.todos.push(newTodo)`) inside a slice reducer, while actually producing a correctly immutable update behind the scenes by tracking your "mutations" against a draft and computing the real, structurally-shared new state from them.

Real applications have state trees with many independent pieces (a `todos` list, a `user` object, a `settings` object), and writing one giant reducer to handle all of them in a single `switch` would be unwieldy. `combineReducers({ todos: todosReducer, user: userReducer })` solves this by letting you write small, independent reducer functions, each responsible for exactly one key ("slice") of the overall state tree, and composing them into a single root reducer that the store actually uses — each slice reducer only ever sees and returns its own slice, unaware of the rest of the tree. Every reducer must also handle actions it doesn't recognize gracefully, typically via a `default: return state;` branch (or, with `createSlice`, simply not defining a case for that action) — returning the *same* state reference unchanged for unrelated actions, both because it's semantically correct (nothing about this slice changed) and because returning a new reference unnecessarily would cause consumers relying on reference equality (like `React.memo` or `useSelector`) to think something changed when it didn't.

React's own `useReducer` hook (see [use-reducer.md](./use-reducer.md)) uses the exact same `(state, action) => newState` mental model, just scoped to a single component's local state instead of a whole application's — understanding one transfers directly to the other, and the same "return a new object, don't mutate" rule applies. Redux Toolkit's `createSlice` goes a step further than plain `useReducer`, though: because it wraps every reducer function with Immer, you can write `state.value += 1` or `state.items.push(x)` directly inside a `createSlice` reducer and it will correctly produce an immutable update, which is a meaningfully different (and much less error-prone) authoring experience than either classic Redux reducers or `useReducer`, both of which require you to manage immutability by hand.

## Examples

```js
// Classic Redux: a pure reducer, no mutation, explicit default case
const initialState = { todos: [], filter: 'ALL' };

function appReducer(state = initialState, action) {
  switch (action.type) {
    case 'ADD_TODO':
      return {
        ...state,
        todos: [...state.todos, action.payload], // new array, new object
      };
    case 'TOGGLE_TODO':
      return {
        ...state,
        todos: state.todos.map((todo) =>
          todo.id === action.payload.id
            ? { ...todo, completed: !todo.completed } // new object for the changed item
            : todo // untouched items keep their original reference
        ),
      };
    default:
      return state; // unrecognized action: return the SAME reference, unchanged
  }
}
```

```js
// combineReducers: splitting one big state tree into independent slice reducers
import { combineReducers } from 'redux';

function todosReducer(state = [], action) {
  switch (action.type) {
    case 'ADD_TODO':
      return [...state, action.payload];
    default:
      return state;
  }
}

function userReducer(state = null, action) {
  switch (action.type) {
    case 'SET_USER':
      return action.payload;
    default:
      return state;
  }
}

const rootReducer = combineReducers({ todos: todosReducer, user: userReducer });
// rootReducer's output shape: { todos: [...], user: {...} }
```

```js
// Redux Toolkit's createSlice: Immer lets you write "mutating" code safely
import { createSlice } from '@reduxjs/toolkit';

const todosSlice = createSlice({
  name: 'todos',
  initialState: [],
  reducers: {
    addTodo(state, action) {
      state.push(action.payload); // looks mutating, but Immer produces an immutable update
    },
    toggleTodo(state, action) {
      const todo = state.find((t) => t.id === action.payload.id);
      if (todo) todo.completed = !todo.completed; // also safe, thanks to Immer
    },
  },
});
export const { addTodo, toggleTodo } = todosSlice.actions;
export default todosSlice.reducer;
```

## Common Pitfalls / Gotchas

- Mutating `state` directly in a classic (non-`createSlice`) reducer (`state.todos.push(x); return state;`) — this is the single most common Redux bug; it may appear to "work" in simple cases, but breaks reference-equality checks that `useSelector`/`connect` rely on to know whether to re-render, and corrupts DevTools time-travel debugging.
- Putting side effects (API calls, `setTimeout`, reading `Date.now()`/`Math.random()` for values used in the computed state) inside a reducer — reducers must be pure; side effects and async logic belong in middleware (thunks/sagas), not in the reducer itself.
- Forgetting the `default: return state;` case in a classic `switch`-based reducer — without it, the reducer returns `undefined` for any action it doesn't explicitly handle, silently corrupting that slice of state.
- Assuming `createSlice`'s Immer-powered "mutation" syntax works anywhere outside a `createSlice` reducer — writing `state.push(x)` in a plain `useReducer` reducer or a hand-written classic reducer is a real, harmful mutation, since Immer isn't wrapping those.
- Nesting deeply mutable-looking updates by hand in classic reducers without Immer (`{ ...state, a: { ...state.a, b: { ...state.b, c: newValue } } }`) — correct, but easy to get wrong under time pressure; this repetitive nested-spread pain is precisely the problem Immer (and thus `createSlice`) was built to solve.

## Interview Questions & Answers

**Q: What are the two hard requirements of a Redux reducer, and why does breaking them cause real bugs?**
A: A reducer must be pure (same input always produces the same output, no side effects) and must not mutate its `state` argument, always returning a new object/array when something changes. Breaking purity makes time-travel debugging and testing unreliable, since replaying the same actions could produce different results. Breaking immutability specifically breaks reference-equality checks that things like `useSelector`, `connect`, and `React.memo` rely on — if a mutated object keeps the same reference, code checking `prevState === nextState` (or a shallow prop comparison) will wrongly conclude nothing changed and skip a needed re-render.

**Q: What does `combineReducers` do, and why split state into slices instead of one large reducer?**
A: `combineReducers` takes an object mapping state keys to independent reducer functions and produces a single root reducer, where each slice reducer only manages its own key of the overall state object. It keeps reducers small, focused, and independently testable, and mirrors how a large application's state is naturally decomposed into unrelated domains (todos, user, settings) that don't need to know about each other.

**Q: How should a reducer handle an action type it doesn't recognize?**
A: It should return the current state completely unchanged — the same object/array reference, not a new copy of an unchanged value — typically via a `default: return state;` branch in a `switch` statement. Returning the same reference for irrelevant actions is both semantically correct (this slice truly didn't change) and necessary for reference-equality-based optimizations elsewhere in the app to work correctly.

**Q: How is `useReducer` related to Redux reducers, and how does Redux Toolkit's `createSlice` differ from both?**
A: `useReducer` uses the exact same `(state, action) => newState` pure-function model as Redux, just scoped to one component's local state rather than global app state — the same immutability rules apply, and you still update state by returning new objects/arrays by hand. `createSlice` uses that same mental model for actions/reducers but wraps its reducer functions with Immer, letting you write code that looks like direct mutation (`state.push(x)`) while Immer computes a correct, structurally-shared immutable update behind the scenes — removing the manual spread/copy boilerplate that both classic Redux reducers and `useReducer` still require.

**Q: Why can't a reducer make an API call directly when it needs to fetch data in response to an action?**
A: Reducers must be synchronous and pure — an API call is asynchronous and has side effects (network I/O), both of which are disallowed. The action a reducer receives can only carry data that's already available (e.g., a previously fetched result passed in a "success" action's payload); triggering the fetch itself is handled by middleware like `redux-thunk`, which sits between dispatch and the reducer and is explicitly allowed to perform side effects (see [redux-middleware.md](./redux-middleware.md)).

## Related Topics
- [redux-store.md](./redux-store.md)
- [redux-actions.md](./redux-actions.md)
- [redux-dispatch.md](./redux-dispatch.md)
- [use-reducer.md](./use-reducer.md)
- [redux-middleware.md](./redux-middleware.md)
- [context-api-vs-redux.md](./context-api-vs-redux.md)
