# React Interview Prep

This folder is a personal knowledge base for studying and teaching React, built for interview preparation and for explaining these topics to others. Each file covers one topic in depth — a conceptual explanation, runnable code examples, common pitfalls, and interview-style Q&A — so you can both refresh your own understanding quickly and use the material to walk someone else through the same concept from scratch. The material targets modern React (18/19 era: function components, Hooks, concurrent-friendly patterns) while still covering the class-component/legacy lifecycle knowledge interviewers routinely ask about, and it covers the classic Redux API in depth since that's what most interview questions are actually about, while consistently noting that Redux Toolkit is the modern recommended way to write Redux day to day.

## Table of Contents

### Fundamentals & JSX
- [Introduction to React](./introduction-to-react.md)
- [JSX](./jsx.md)
- [Components (Function Components)](./components.md)
- [Nesting Components & Composition](./nesting-components.md)
- [Fragments](./fragments.md)
- [Displaying Data / Expressions in JSX](./displaying-data-in-jsx.md)
- [Adding Styles in React](./adding-styles-in-react.md)

### Props & State
- [Props](./props.md)
- [Passing Data Through Props / Prop Drilling](./passing-data-through-props.md)
- [The `children` Prop](./children-prop.md)
- [State & useState](./state.md)
- [Lifting State Up](./lifting-state-up.md)
- [Sharing Data Between Components](./sharing-data-between-components.md)
- [Controlled vs Uncontrolled Components](./controlled-vs-uncontrolled-components.md)

### Rendering & Events
- [Conditional Rendering](./conditional-rendering.md)
- [Rendering Lists & Keys](./rendering-lists-and-keys.md)
- [Handling Events](./handling-events.md)

### Hooks
- [React Hooks Overview & Rules of Hooks](./react-hooks-overview.md)
- [useState (Deep Dive)](./use-state.md)
- [useEffect](./use-effect.md)
- [useContext & createContext](./use-context.md)
- [useReducer](./use-reducer.md)
- [useMemo](./use-memo.md)
- [useCallback](./use-callback.md)
- [useRef](./use-ref.md)
- [Custom Hooks](./custom-hooks.md)

### Component Patterns & Composition
- [Pure Components / Pure Functions in React](./pure-components.md)
- [Higher-Order Components (HOC)](./higher-order-components.md)
- [Render Props Pattern](./render-props.md)
- [Refs & forwardRef](./refs-and-forward-ref.md)
- [Portals](./portals.md)
- [Error Boundaries](./error-boundaries.md)

### Performance & Optimization
- [React.memo](./react-memo.md)
- [Lazy Loading & Code Splitting (React.lazy, Suspense)](./lazy-loading-and-code-splitting.md)
- [React Performance Optimization Techniques](./react-performance-optimization.md)
- [Virtual DOM & Reconciliation](./virtual-dom-and-reconciliation.md)
- [Keys & Reconciliation](./keys-and-reconciliation.md)

### Lifecycle & Legacy Class Components
- [Component Lifecycle (Class Components & Hooks Mapping)](./component-lifecycle.md)

### Redux & State Management
- [Redux: Store](./redux-store.md)
- [Redux: Actions](./redux-actions.md)
- [Redux: Reducers](./redux-reducers.md)
- [Redux: Dispatch Function](./redux-dispatch.md)
- [Redux: Subscribe Function](./redux-subscribe.md)
- [Redux Middleware (Thunk/Saga)](./redux-middleware.md)
- [Context API vs Redux](./context-api-vs-redux.md)

### Routing & SSR
- [React Router Basics](./react-router-basics.md)
- [Server-Side Rendering with React](./server-side-rendering.md)

### Testing
- [React Testing Basics](./react-testing-basics.md)

## Interview Questions & Answers — Curated

**1. What is the virtual DOM, and what does "reconciliation" actually mean? (Beginner/Intermediate)**
The virtual DOM is a lightweight JavaScript object tree that describes what the UI should look like. On every render, React builds a new virtual DOM tree and diffs it against the previous one (reconciliation), then applies only the minimal set of real DOM mutations needed to make the actual DOM match. Same-type elements are updated in place; different-type elements tear down and rebuild the subtree. It's not that the virtual DOM is "always faster" than direct DOM manipulation — it's that it makes UI updates predictable and batched without you having to hand-write imperative DOM diffing yourself. See [virtual-dom-and-reconciliation.md](./virtual-dom-and-reconciliation.md).

**2. Why do keys matter in lists, and what breaks if you use the array index as a key? (Intermediate)**
Keys let React match elements between renders by identity, independent of position. With a stable, unique key, React can tell "this is the same logical item, just moved" versus "this is a new item." Using the array index as a key ties identity to position — if items are inserted, removed, or reordered, React misattributes state (and uncontrolled input values) to the wrong DOM node, since the item that used to be at index 2 is now compared against whatever new item is now at index 2. See [keys-and-reconciliation.md](./keys-and-reconciliation.md) and [rendering-lists-and-keys.md](./rendering-lists-and-keys.md).

**3. `useEffect` vs `useLayoutEffect` — what's the actual difference? (Advanced)**
`useEffect` runs asynchronously after the browser has painted, so it never blocks the visible update. `useLayoutEffect` runs synchronously after DOM mutations but before the paint, blocking the browser until it finishes — reserved for cases where you must read layout (measure an element) and possibly adjust it before the user ever sees a flicker. Default to `useEffect`; reach for `useLayoutEffect` only when you have a concrete flicker/measurement problem. See [use-effect.md](./use-effect.md).

**4. How does the Rules of Hooks work internally — why can't hooks be called conditionally? (Advanced)**
React tracks each component's hooks by *call order*, in a fixed-size linked list attached to that component's fiber — there's no name-based lookup. On every render, React walks that list and matches the Nth `useState`/`useEffect`/etc. call to the Nth hook entry from the previous render. If a hook call is skipped or added conditionally, every hook call after that point shifts by one position and gets matched to the wrong stored entry, silently corrupting state. This is why hooks must only be called at the top level (never in loops/conditions/nested functions) and only from React function components or custom hooks. See [react-hooks-overview.md](./react-hooks-overview.md).

**5. Controlled vs uncontrolled components — what's the difference, and when would you choose each? (Beginner/Intermediate)**
A controlled input's value is driven entirely by React state (`value` + `onChange`), so React is the single source of truth and every keystroke is available to validate/transform immediately. An uncontrolled input keeps its own internal DOM state, read out on demand via a `ref` (with `defaultValue` for an initial value). Controlled is the default recommendation for most forms (immediate validation, conditional disabling, derived fields); uncontrolled is simpler for quick/one-off forms, file inputs (which can't be controlled), or integrating with non-React code. See [controlled-vs-uncontrolled-components.md](./controlled-vs-uncontrolled-components.md).

**6. Context API vs Redux — when do you reach for which? (Intermediate/Advanced)**
Context (built into React) is well-suited to low-frequency-update, broadly-needed values like theme, authenticated user, or locale — but every consumer of a context re-renders whenever its value changes, with no built-in selector-based fine-grained subscriptions, middleware, or time-travel debugging. Redux centralizes state in one store with a strict unidirectional data flow (action → reducer → new state), `react-redux`'s `useSelector` re-renders only components whose selected slice actually changed, and it has a mature middleware/DevTools ecosystem — better suited to large apps with complex, frequently-changing, cross-cutting state. See [context-api-vs-redux.md](./context-api-vs-redux.md).

**7. What's the difference between props and state? (Beginner)**
Props are inputs passed down from a parent — read-only from the receiving component's perspective, and owned/controlled by whoever renders that component. State is data a component owns and manages itself, local to that component instance, that can change over time (typically via `useState`/`useReducer`) and triggers a re-render when it does. See [props.md](./props.md) and [state.md](./state.md).

**8. Explain React's Hooks rule about only calling hooks from React functions, and why custom hooks are still allowed to call other hooks. (Intermediate)**
Hooks may only be called from React function components or from other custom hooks (functions whose name starts with `use` by convention) — never from regular JS functions, event handlers, or outside the component tree, because hook state is tied to a specific fiber's position-ordered hook list, which only exists during a component's render. A custom hook is allowed to call other hooks because, when invoked, it's still executing *within* the calling component's render, contributing entries to that same fiber's hook list in the same fixed order. See [react-hooks-overview.md](./react-hooks-overview.md) and [custom-hooks.md](./custom-hooks.md).

**9. What are error boundaries, and what do they NOT catch? (Intermediate/Advanced)**
Error boundaries are components (currently must be class components, via `static getDerivedStateFromError` and/or `componentDidCatch`) that catch JavaScript errors thrown during rendering, in lifecycle methods, or in constructors anywhere in their child tree, and render a fallback UI instead of crashing the whole app. They do not catch errors inside event handlers, errors in asynchronous code (`setTimeout`, promises), errors during server-side rendering, or errors thrown in the boundary's own code. See [error-boundaries.md](./error-boundaries.md).

**10. How does `React.memo` interact with `useMemo`/`useCallback`, and why does wrapping a component in `React.memo` sometimes do nothing? (Advanced)**
`React.memo` skips re-rendering a component if its props are shallowly equal to the previous render's props. If the parent passes a new inline object, array, or function literal as a prop on every render (a fresh reference each time, even with identical contents), the shallow comparison always sees "different props" and the memoization never kicks in. Wrapping those specific prop values in `useMemo` (for objects/arrays) or `useCallback` (for functions) in the parent gives them stable references across renders, which is what actually lets `React.memo` skip work. See [react-memo.md](./react-memo.md), [use-memo.md](./use-memo.md), and [use-callback.md](./use-callback.md).

**11. What's the difference between `useMemo` and `useCallback`? (Intermediate)**
`useMemo(fn, deps)` memoizes the *return value* of calling `fn`. `useCallback(fn, deps)` memoizes the *function reference itself* — it's equivalent to `useMemo(() => fn, deps)`. Use `useMemo` to avoid recomputing an expensive derived value; use `useCallback` to avoid creating a new function identity on every render (typically so a memoized child or an effect's dependency array doesn't see a "change" that isn't real). See [use-memo.md](./use-memo.md) and [use-callback.md](./use-callback.md).

**12. Why should reducers (in `useReducer` or Redux) be pure functions? (Intermediate)**
A reducer's entire contract is `(state, action) => newState`, called by the framework whenever it decides to, potentially multiple times (React's Strict Mode intentionally double-invokes reducers/state-initializers in development to surface impurities; Redux DevTools time-travel replays actions through the reducer to recompute state at any point). If a reducer mutates its input or has side effects, replaying/double-invoking it produces different or corrupted results, and time-travel debugging becomes unreliable. See [redux-reducers.md](./redux-reducers.md) and [use-reducer.md](./use-reducer.md).

**13. What actually causes a component to re-render in React? (Intermediate)**
A component re-renders when its own state changes (`useState`/`useReducer` setter called with a new value), when its parent re-renders and doesn't skip it (no `React.memo`, or `React.memo` sees changed props), or when a context it consumes via `useContext` changes value. Re-rendering a parent does not automatically mean every prop passed down is "new" in value — but object/array/function props recreated inline are new by reference every time, which is a common source of unnecessary child re-renders.

**14. What is prop drilling, and what are the main ways to avoid it? (Beginner/Intermediate)**
Prop drilling is passing a value down through several layers of components that don't themselves use it, purely so a deeply nested descendant can access it. It's avoided via composition (passing already-built JSX as `children`/props instead of drilling raw data), the Context API for values many components across the tree need, or a dedicated state-management library (Redux) for larger apps. See [passing-data-through-props.md](./passing-data-through-props.md) and [children-prop.md](./children-prop.md).

**15. How does React 18's automatic batching change state update behavior? (Advanced)**
Before React 18, multiple `setState` calls were only automatically batched into a single re-render inside React event handlers — calls inside promises, `setTimeout`, or native event handlers each triggered a separate synchronous re-render. React 18's automatic batching extends batching to those cases too, so multiple state updates anywhere in a tick are grouped into one re-render by default, improving performance; `flushSync` is the escape hatch when you deliberately need a synchronous, unbatched update. See [use-state.md](./use-state.md).

**16. Why can't you call hooks inside `if` statements or loops? Walk through a concrete failure. (Advanced)**
Suppose a component calls `useState` then conditionally calls `useEffect` only when a prop is true, then calls another `useState`. On a render where the condition is true, the hook list is `[state1, effect1, state2]`; on a render where it's false, it becomes `[state1, state2]` — but React still matches by position, so the second `useState` call now gets matched against the stored `effect1` entry instead of its own, corrupting both. Always calling every hook unconditionally (and moving the condition *inside* the hook body instead) keeps the list's length and order identical on every render. See [react-hooks-overview.md](./react-hooks-overview.md).

**17. What's the difference between a Redux "action," an "action creator," and "dispatching"? (Beginner/Intermediate)**
An action is a plain JS object describing what happened (`{ type: 'ADD_TODO', payload: {...} }`). An action creator is a function that builds and returns such an object, so callers don't hand-construct it every time. Dispatching is calling `store.dispatch(action)`, which sends that action object through the root reducer to compute and apply the next state. See [redux-actions.md](./redux-actions.md) and [redux-dispatch.md](./redux-dispatch.md).

**18. Why can't reducers perform async work (like an API call) directly, and how is that solved? (Intermediate/Advanced)**
Reducers must be pure and synchronous — `dispatch` only accepts plain action objects (in classic Redux) and reducers are expected to return a new state immediately given the current state and action. Async logic (API calls, delays) is handled by middleware sitting between `dispatch` and the reducer: `redux-thunk` lets you dispatch a function instead of a plain object, which receives `dispatch`/`getState` and can perform async work before dispatching real actions; `redux-saga` uses generator functions for more complex async orchestration (cancellation, race conditions, sequencing). See [redux-middleware.md](./redux-middleware.md).

**19. What does React's Strict Mode do, and why does it double-invoke some functions in development? (Advanced)**
Strict Mode intentionally double-invokes certain functions in development only (component function bodies, state updater functions, and — since React 18 — effect setup/cleanup pairs on mount) specifically to surface impurities that would otherwise hide until they caused a real bug — e.g., an effect that isn't idempotent, or a render that has a side effect. It doesn't run in production and doesn't itself change behavior; it's a diagnostic tool for keeping components and reducers genuinely pure. See [pure-components.md](./pure-components.md).

**20. How would you decide between `useState` and `useReducer` for a given piece of state? (Intermediate)**
`useState` is simplest for independent, simple values with straightforward updates. `useReducer` is a better fit once you have several related pieces of state that update together, many distinct ways state can change (many action types), or update logic complex enough that centralizing it in one reducer function (versus scattering it across several `setX` calls) makes the component easier to follow and test. See [use-state.md](./use-state.md) and [use-reducer.md](./use-reducer.md).

## How to Use This Folder

Work through the sections roughly in the order listed above:

1. **Fundamentals & JSX** and **Props & State** first — components, JSX, props, and state are the vocabulary every other topic assumes.
2. **Rendering & Events** next — conditional rendering, lists/keys, and event handling are used constantly once you understand components/props/state.
3. **Hooks** after that — start with [React Hooks Overview & Rules of Hooks](./react-hooks-overview.md), then `useState`/`useEffect` in depth, then the more situational hooks (`useContext`, `useReducer`, `useMemo`, `useCallback`, `useRef`, custom hooks).
4. **Component Patterns & Composition** and **Performance & Optimization** next — these build directly on a solid grasp of hooks and reconciliation, and are where mid/senior interviews tend to go deeper.
5. **Lifecycle & Legacy Class Components** — worth reading once hooks feel solid, specifically because interviewers still ask you to map hook behavior back onto the class lifecycle methods it replaced.
6. **Redux & State Management** — read after Context/`useReducer`, since Redux's mental model (actions, reducers, a single store) directly builds on those same ideas at app scale.
7. **Routing & SSR** and **Testing** last — these assume you're already comfortable with components, hooks, and state management, and round out the practical, whole-application side of React interview prep.

For interview prep specifically: skim each topic file's "Interview Questions & Answers" section first for a quick per-topic refresher, then use the "Curated" list above as a cross-cutting mock-interview pass once the individual topics feel solid.
