# React Hooks Overview

Hooks are functions — always starting with `use` — that let a function component "hook into" React features like state and lifecycle that, before React 16.8, were only available inside class components. Before Hooks existed, any component that needed local state or lifecycle behavior (running code on mount, on update, or on unmount) had to be written as a class, extending `React.Component` and using `this.state`/`this.setState()` plus lifecycle methods like `componentDidMount`, `componentDidUpdate`, and `componentWillUnmount`. Hooks were introduced specifically to let plain function components do all of the same things, using a small set of composable functions instead of a class's `this`-bound API — `useState` for local state, `useEffect` for lifecycle/side-effect concerns, and so on.

The deeper motivation behind Hooks wasn't just stylistic preference for functions over classes — it was solving a real reuse problem. Before Hooks, sharing *stateful logic* (not just UI) between components required patterns like Higher-Order Components (HOCs) or render props, both of which work by wrapping a component in another component, and both of which tend to produce deeply nested component trees ("wrapper hell") that are hard to trace in DevTools and hard to compose cleanly when you need several pieces of reusable logic at once. Custom Hooks solve this directly: any stateful logic can be extracted into a plain function (conventionally named `useSomething`) that internally calls other Hooks, and any component can reuse that logic just by calling the function — no extra wrapper component, no extra nesting, no prop-name collisions. See [custom-hooks.md](./custom-hooks.md).

Hooks come with two non-negotiable rules, and they exist for a concrete, mechanical reason rather than being an arbitrary style guideline. **Rule 1: only call Hooks at the top level** — never inside loops, conditions, or nested functions. **Rule 2: only call Hooks from React function components, or from other custom Hooks** — never from regular JavaScript functions. The reason both rules exist is how React actually tracks each Hook's state internally: for a given component instance (fiber), React keeps an ordered list of "hook state" entries, and it identifies which entry belongs to which `useState`/`useEffect`/etc. call purely by the *order* those calls happen in during render — not by any name or identifier. On every render, React walks through this list in the same fixed order and matches the Nth Hook call in your function to the Nth entry in its internal list. If a Hook call is conditionally skipped on some renders (`if (x) { useState(...) }`), the call order shifts, and every subsequent Hook in that render now gets matched to the *wrong* stored state — silently corrupting state or throwing an outright error, since React detects the mismatch in the number/order of Hooks between renders and errors loudly ("Rendered more hooks than during the previous render").

React ships a family of built-in Hooks covering the core needs of a function component: `useState` and `useReducer` for local state, `useEffect` (and `useLayoutEffect`) for synchronizing with external systems, `useContext` for reading shared values without prop drilling, `useMemo` and `useCallback` for memoization, and `useRef` for mutable values and direct DOM access that don't trigger re-renders when changed. Each of these has its own dedicated file with full depth — this overview exists to establish the shared mental model (why Hooks exist, and the ordering rule that governs all of them) before diving into any one Hook individually.

## Examples

```jsx
// Before Hooks: a class component needed for local state + lifecycle
class TimerClass extends React.Component {
  state = { seconds: 0 };
  componentDidMount() {
    this.interval = setInterval(() => {
      this.setState((s) => ({ seconds: s.seconds + 1 }));
    }, 1000);
  }
  componentWillUnmount() {
    clearInterval(this.interval);
  }
  render() {
    return <p>{this.state.seconds}s elapsed</p>;
  }
}

// After Hooks: the same behavior in a plain function component
function TimerFunction() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval); // cleanup replaces componentWillUnmount
  }, []);
  return <p>{seconds}s elapsed</p>;
}
```

```jsx
// A custom Hook: reusable stateful logic extracted without a wrapper component
function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

function ResponsiveBanner() {
  const width = useWindowWidth(); // reused freely in any component, no extra nesting
  return <div>{width < 600 ? 'Mobile layout' : 'Desktop layout'}</div>;
}
```

```jsx
// Violating Rule 1: a conditional Hook call breaks React's fixed call order
function BrokenComponent({ showExtra }) {
  const [a, setA] = useState(0);

  if (showExtra) {
    // BAD: this Hook call only happens on SOME renders, shifting every
    // subsequent Hook's position in React's internal per-fiber Hook list.
    const [b, setB] = useState(0);
  }

  const [c, setC] = useState(0); // its "slot" now shifts depending on showExtra
  // Fix: always call every Hook unconditionally; put the condition INSIDE the Hook/effect body instead.
  return <div>{a}</div>;
}
```

## Common Pitfalls / Gotchas

- Calling a Hook inside `if`, a loop, or a nested helper function — this changes how many Hooks run (or their order) between renders, corrupting React's positional matching of Hook calls to stored state.
- Calling a Hook from a regular (non-component, non-custom-Hook) JavaScript function, or from a class component method — Hooks only work inside the render of a function component or inside another Hook.
- Naming a helper function `useSomething` when it doesn't actually call any Hooks internally — this is harmless technically but misleading, since the `use` prefix is a convention that signals "this may call Hooks and is therefore itself subject to the Rules of Hooks."
- Assuming Hooks Rules are just a style preference enforced by lint — they're enforced by an actual runtime mechanism (positional Hook-state matching per fiber); breaking them produces real bugs or runtime errors, not just lint warnings, even if the `eslint-plugin-react-hooks` rule is disabled.
- Forgetting that early returns *before* all Hook calls have the same conditional-call problem — if a component can `return` early (e.g., a loading guard) above some of its `useState`/`useEffect` calls, those calls become conditional on later renders that take a different path.

## Interview Questions & Answers

**Q: Why were Hooks introduced, given that class components already supported state and lifecycle methods?**
A: Hooks let function components use state and lifecycle features without needing classes, but more importantly they solved a real reuse problem: sharing *stateful logic* across components previously required Higher-Order Components or render props, both of which wrap components in extra layers and tend to produce deeply nested "wrapper hell" trees. Custom Hooks let you extract and reuse stateful logic as plain functions with no extra component nesting at all.

**Q: What are the two Rules of Hooks?**
A: (1) Only call Hooks at the top level of a function — never inside loops, conditions, or nested functions. (2) Only call Hooks from React function components, or from other custom Hooks — never from regular JavaScript functions or class components.

**Q: Why do the Rules of Hooks exist — what actually breaks if you violate them?**
A: React tracks each Hook's associated state per component instance (fiber) as an ordered list, and it identifies which stored state belongs to which Hook call purely by the *order* the calls occur in during render — not by name. If a Hook call is conditionally skipped on some renders, every subsequent Hook call's position shifts, so React matches it against the wrong stored entry — corrupting state silently or, if the total number of Hook calls differs between renders, throwing an explicit "Rendered more hooks than during the previous render" error.

**Q: What is a custom Hook, and how is it different from a regular utility function?**
A: A custom Hook is a plain JavaScript function, conventionally named starting with `use`, that calls one or more built-in (or other custom) Hooks internally to encapsulate reusable stateful logic. It's different from an ordinary utility function in that it's still subject to the Rules of Hooks (it must itself be called unconditionally at the top level of a component or another Hook) precisely because it delegates to real Hooks underneath.

**Q: How did HOCs and render props solve the "reusable stateful logic" problem before Hooks, and what was the downside?**
A: A Higher-Order Component wraps a component and injects extra props/behavior; a render-prop component takes a function as a child/prop and calls it with some shared state/logic. Both approaches work, but composing several of them (needing multiple pieces of shared logic on one component) results in deeply nested wrapper components in the tree, obscures the actual component hierarchy in DevTools, and can create prop naming collisions between the injected props of different wrappers.

## Related Topics
- [use-state.md](./use-state.md)
- [use-effect.md](./use-effect.md)
- [custom-hooks.md](./custom-hooks.md)
- [higher-order-components.md](./higher-order-components.md)
- [render-props.md](./render-props.md)
- [component-lifecycle.md](./component-lifecycle.md)
