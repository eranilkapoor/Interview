# Context API vs Redux

React's Context API and Redux both solve a version of the same underlying problem — sharing state across components without manually threading it down through props at every level ("prop drilling") — but they were built for different scales and shapes of that problem, and reach for meaningfully different tradeoffs. Context is a feature built directly into React itself: `createContext` defines a context, a `<Context.Provider value={...}>` makes a value available to every descendant, and `useContext(Context)` reads it from anywhere below the provider, no external library required. Redux, by contrast, is a standalone state-management library (paired with `react-redux` for its React bindings) built around a single global store, a strict unidirectional data flow (action → reducer → new state), and a substantial ecosystem of tooling (DevTools, middleware) built on top of that constrained model.

The most important practical difference is *how updates propagate*. When a Context provider's `value` changes, **every** component consuming that context re-renders, regardless of which specific part of the value it actually uses — Context has no built-in mechanism for selecting just a slice of the value and only re-rendering when that specific slice changes (you'd have to hand-roll that yourself, e.g., by splitting one context into several narrower ones, or memoizing consumers). Redux's `react-redux` bindings, via `useSelector`, do exactly this kind of fine-grained selection out of the box: a component using `useSelector(state => state.todos)` only re-renders when the *todos* slice changes, not when unrelated parts of the store (like `state.user`) change — which is what lets Redux scale comfortably to state trees with frequent, high-volume updates (a real-time todo list, a chat app, a data grid) in a way that Context, by itself, does not.

Redux also brings substantial tooling that Context has no built-in equivalent for: the Redux DevTools extension gives you a full log of every dispatched action alongside the resulting state, replayable step by step (time-travel debugging), which is invaluable for tracing down exactly which action caused a specific bug in a specific state change. Its middleware system (see [redux-middleware.md](./redux-middleware.md)) gives you a standard, well-understood place to hook in logging, analytics, and async orchestration (thunks/sagas). Context provides none of this on its own — it's a plumbing mechanism for passing a value down a tree, not a state-management system with actions, reducers, or observability built in (though you can combine `useContext` with `useReducer` to get a small, homegrown version of the action/reducer pattern for a specific piece of state).

The practical rule of thumb: reach for Context for state that changes infrequently and is read broadly — theme, authenticated user, locale/i18n settings, feature flags — where the "every consumer re-renders on any change" cost is negligible because changes are rare and consumers are typically small or already cheap to re-render. Reach for Redux (ideally via Redux Toolkit, to minimize its historical boilerplate downside) when you have complex, frequently-updating state shared across many parts of a large application, where fine-grained selective re-rendering, middleware-driven async logic, and DevTools-based debugging genuinely earn their keep. Many real applications use both simultaneously — Context for a handful of low-frequency global concerns, Redux for the app's actual data-heavy state — rather than treating the choice as all-or-nothing.

## Examples

```jsx
// Context API: fine for low-frequency, broadly-read values like theme.
// Every consumer re-renders whenever the Provider's value changes — acceptable
// here because theme changes are rare (a user toggling a setting, not per-keystroke).
const ThemeContext = createContext('light');

function App() {
  const [theme, setTheme] = useState('light');
  return (
    <ThemeContext.Provider value={theme}>
      <Toolbar />
      <button onClick={() => setTheme(t => (t === 'light' ? 'dark' : 'light'))}>
        Toggle theme
      </button>
    </ThemeContext.Provider>
  );
}
function Toolbar() {
  const theme = useContext(ThemeContext); // re-renders on every theme change
  return <div className={theme}>...</div>;
}
```

```jsx
// Redux + react-redux: fine-grained re-renders via useSelector, even with
// frequent, unrelated updates elsewhere in a large shared state tree.
function TodoList() {
  // Only re-renders when state.todos changes — unaffected by state.user or
  // state.notifications updates dispatched elsewhere in the app.
  const todos = useSelector((state) => state.todos);
  const dispatch = useDispatch();
  return (
    <ul>
      {todos.map((t) => (
        <li key={t.id} onClick={() => dispatch(toggleTodo(t.id))}>
          {t.text}
        </li>
      ))}
    </ul>
  );
}
```

```jsx
// A common middle ground: useContext + useReducer for a homegrown, Redux-like
// pattern scoped to ONE feature, without pulling in the full Redux library.
const TodosContext = createContext(null);

function todosReducer(state, action) {
  switch (action.type) {
    case 'ADD_TODO':
      return [...state, action.payload];
    default:
      return state;
  }
}

function TodosProvider({ children }) {
  const [todos, dispatch] = useReducer(todosReducer, []);
  return (
    <TodosContext.Provider value={{ todos, dispatch }}>
      {children}
    </TodosContext.Provider>
  );
}
// Note: this still re-renders every consumer on any change, same as plain Context —
// useReducer only replaces how the next value is COMPUTED, not how it's propagated.
```

## Common Pitfalls / Gotchas

- Using a single large Context for frequently-changing, high-traffic state (e.g., a real-time counter, live form state shared across many components) and being surprised the whole consuming subtree re-renders on every change — Context always re-renders every consumer on a value change; it has no selector mechanism to opt out, unlike `useSelector` in Redux.
- Reaching for full Redux (with all its setup) for a small app or a handful of rarely-changing global values — the tooling and structure Redux provides (DevTools, middleware, strict unidirectional flow) is overkill when Context plus `useState`/`useReducer` would do the job with far less code.
- Assuming `useContext` + `useReducer` gives you Redux's fine-grained re-render behavior — it doesn't; it only replaces *how* the next value is computed (a reducer instead of ad hoc `setState` calls), not *how* it propagates to consumers, which is still plain Context's "re-render everyone" behavior.
- Forgetting that Context has no middleware concept — logging every state change, or handling complex async orchestration, needs to be hand-built around Context, whereas Redux has a standard, well-understood extension point (middleware) for exactly this.
- Splitting one large Context's value into many separate, narrower contexts to work around the "everyone re-renders" limitation, then finding the codebase now has ten providers wrapping the tree — a legitimate technique, but at a certain point of complexity, that's a signal the problem might be better solved by Redux's built-in selector-based fine-grained updates instead.

## Interview Questions & Answers

**Q: What's the core difference in how updates propagate between Context and Redux (via react-redux)?**
A: Context re-renders every component consuming that context whenever the provider's `value` changes, with no built-in way to subscribe to only part of it. Redux's `useSelector` lets each component subscribe to a specific derived slice of the store and only re-renders that component when the value returned by its selector actually changes (by reference), leaving components reading unrelated slices untouched — a meaningfully more fine-grained and scalable update model for frequently-changing, complex state.

**Q: When would you choose Context over Redux for a given piece of state?**
A: For state that changes infrequently and is read broadly across the tree — theme, authenticated user info, locale/i18n, feature flags. Since these change rarely, the cost of Context's "re-render every consumer" behavior is negligible, and pulling in Redux's store/actions/reducers/middleware machinery for something this simple would be unnecessary overhead.

**Q: What does Redux give you that Context doesn't provide out of the box?**
A: Fine-grained, selector-based re-rendering (via `useSelector`); a standard middleware pipeline for side effects and async logic (thunks, sagas, logging); and the Redux DevTools extension, which records every dispatched action alongside the resulting state and lets you step backward and forward through them (time-travel debugging) — none of which Context provides natively, since it's purely a value-propagation mechanism.

**Q: Does Redux Toolkit change this comparison at all?**
A: It significantly reduces Redux's historical downside — boilerplate — via `configureStore` and `createSlice` (which auto-generates action creators/types and uses Immer for "mutating" immutable updates), making Redux far less verbose to set up and use than it was with classic `createStore`/hand-written reducers/action creators. It doesn't change the fundamental architectural tradeoff versus Context, though — the choice between fine-grained, tooling-rich Redux and simple, built-in Context still comes down to how complex and update-frequent the shared state actually is.

**Q: Can you use Context and Redux together in the same application?**
A: Yes, and it's common in practice — Redux for the app's core, frequently-updating, complex shared data (where selector-based re-rendering and DevTools matter), and Context for a small number of low-frequency, broadly-needed values like theme or auth status, where introducing a Redux slice would be unnecessary ceremony for something that barely ever changes.

## Related Topics
- [redux-store.md](./redux-store.md)
- [use-context.md](./use-context.md)
- [use-reducer.md](./use-reducer.md)
- [redux-subscribe.md](./redux-subscribe.md)
- [redux-middleware.md](./redux-middleware.md)
- [sharing-data-between-components.md](./sharing-data-between-components.md)
