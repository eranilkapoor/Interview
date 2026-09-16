# Sharing Data Between Components

React components form a tree, and by default each component only knows about its own local state — there's no built-in global variable that every component can read and write. As an application grows past a single component, you constantly run into the question "component A has some data, component B needs it — how do they talk to each other?" The answer depends entirely on the *shape* of the relationship between the two components: are they parent/child, siblings under a common parent, or distant relatives many levels apart in the tree? React (and the ecosystem around it) offers a different tool for each shape, and picking the right one is as much about avoiding unnecessary complexity as it is about making the data flow work at all.

The simplest and most idiomatic case is **lifting state up**: when two sibling components need to share or stay in sync with the same piece of state, you move that state to their nearest common parent, then pass it down as props — the value down, and a callback up (since props are read-only and only flow one direction, a child that needs to *change* shared state does so by calling a function its parent handed it). This works well for a handful of components that are close together in the tree, but it starts to hurt once the data needs to pass through many layers of components that don't themselves care about it — a problem commonly called "prop drilling." See [lifting-state-up.md](./lifting-state-up.md) for the mechanics of this pattern.

When data needs to reach many components scattered at different depths — a logged-in user, a UI theme, a locale/language setting — prop drilling every intermediate layer becomes unmanageable. React's built-in **Context API** (`createContext` + `Context.Provider` + `useContext`) solves this by letting any descendant read a value directly from the nearest matching `Provider` above it, skipping every layer in between. Context is ideal for data that's genuinely "ambient" to a whole subtree rather than something only two specific components care about — see [use-context.md](./use-context.md).

For larger applications with lots of interconnected state, complex update logic, or a need for predictable, centralized, debuggable state transitions across many unrelated parts of the UI, an external state management library like **Redux** is often a better fit than Context alone. Redux centralizes all application state in a single store, updates it only through pure reducer functions responding to dispatched actions, and lets any connected component read from or dispatch to that store regardless of where it sits in the tree — trading some setup overhead for very predictable, testable, and traceable state changes. See [redux-store.md](./redux-store.md), [redux-actions.md](./redux-reducers.md), and [context-api-vs-redux.md](./context-api-vs-redux.md) for when Redux earns its extra complexity over plain Context.

As a rule of thumb: reach for lifting state up first (it's the simplest, most "just React" option), reach for Context when the same value is needed broadly across a subtree and prop drilling gets painful, and reach for Redux (or a similar library) when you have substantial, complex, cross-cutting application state that benefits from centralized, structured updates and strong debugging tools. Each of these techniques is covered in depth in its own file — this one exists purely as the map between the problem ("two components need the same data") and the right tool for the specific shape of that problem.

## Examples

```jsx
// Lifting state up: two siblings (Input and Display) share state via their parent
function TemperatureConverter() {
  const [celsius, setCelsius] = useState(0);

  return (
    <div>
      <TemperatureInput celsius={celsius} onChange={setCelsius} />
      <TemperatureDisplay celsius={celsius} />
    </div>
  );
}

function TemperatureInput({ celsius, onChange }) {
  return (
    <input
      type="number"
      value={celsius}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

function TemperatureDisplay({ celsius }) {
  return <p>{celsius}°C is {(celsius * 9) / 5 + 32}°F</p>;
}
```

```jsx
// Context: sharing a theme across a deep subtree without prop drilling
const ThemeContext = createContext('light');

function App() {
  const [theme, setTheme] = useState('dark');
  return (
    <ThemeContext.Provider value={theme}>
      <Toolbar />
      <button onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}>
        Toggle theme
      </button>
    </ThemeContext.Provider>
  );
}

function Toolbar() {
  return <ThemedButton />; // doesn't need to receive or pass `theme` at all
}

function ThemedButton() {
  const theme = useContext(ThemeContext); // reads directly from the nearest Provider
  return <button className={theme}>I am styled by theme context</button>;
}
```

```jsx
// Redux (react-redux): reading and updating global state from any connected component
import { useSelector, useDispatch } from 'react-redux';
import { increment } from './counterSlice';

function CounterDisplay() {
  // any component, anywhere in the tree, can read from the store
  const count = useSelector((state) => state.counter.value);
  const dispatch = useDispatch();

  return (
    <button onClick={() => dispatch(increment())}>
      Count: {count}
    </button>
  );
}
```

## Common Pitfalls / Gotchas

- Reaching for Context or Redux immediately instead of first trying to lift state up — most "sharing data" problems in small-to-medium apps are just a parent/child relationship away from being solved simply.
- Putting *everything* into one giant Context value or one global Redux store "just in case," which causes far more components to re-render than necessary and makes the data flow harder to trace, not easier.
- Prop drilling through 5+ layers of components that don't use the prop themselves, purely to relay it — a strong signal it's time to switch to Context for that particular piece of data.
- Forgetting that Context re-renders every consumer when its value changes (even if a consumer only cares about part of the value) — see [use-context.md](./use-context.md) for the memoization fix.
- Using Redux for state that's genuinely local to one component (form input values, a toggle) — not everything needs to be global; local `useState` is simpler and there's no need to centralize it.

## Interview Questions & Answers

**Q: What is "prop drilling," and what are your options for avoiding it?**
A: Prop drilling is passing a prop down through several layers of components that don't themselves use it, purely so a deeply nested descendant can receive it. Options include lifting state to a closer-but-still-shared parent, restructuring components (passing JSX as `children` to skip intermediate layers), using the Context API for broadly-needed values, or adopting a state management library like Redux for larger, more complex sharing needs.

**Q: When would you choose Context API over Redux, or vice versa?**
A: Context is built into React, requires no extra dependency, and is well suited to moderately-sized, relatively static values (theme, locale, authenticated user) that many components need to read. Redux adds more structure and tooling (a single store, pure reducers, middleware, time-travel debugging via DevTools) that pays off when an app has large amounts of interrelated state, frequent complex updates, or a need for strict predictability and testability across many features — the tradeoff is more boilerplate and a steeper learning curve.

**Q: Why is "lift state up" usually recommended before reaching for Context or Redux?**
A: It's the simplest option that requires no additional API or library — you're just moving a `useState` call to a shared ancestor and passing props down. It keeps data flow explicit and easy to trace directly in the component tree, whereas Context and Redux both introduce a layer of indirection (a value read from "somewhere above" or "the global store") that's worth the tradeoff only once prop drilling or genuinely global state make the simple approach unwieldy.

**Q: If two components need the same data but aren't siblings — say, cousins in different branches of the tree — how do you share state between them?**
A: You lift the state up to their nearest common ancestor (even if that ancestor is several levels up and passes it down through multiple layers), or, if that ancestor is too far removed and the intermediate props would have to drill through many uninvolved components, use Context (or a global store) instead so both cousins can read the value directly without every component in between needing to know about it.

## Related Topics
- [lifting-state-up.md](./lifting-state-up.md)
- [use-context.md](./use-context.md)
- [props.md](./props.md)
- [redux-store.md](./redux-store.md)
- [context-api-vs-redux.md](./context-api-vs-redux.md)
- [state.md](./state.md)
