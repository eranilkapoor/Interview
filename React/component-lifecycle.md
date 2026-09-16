# Component Lifecycle

Every React component goes through a predictable sequence of phases from the moment it's first rendered to the moment it's removed from the page: mounting (first creation and insertion into the DOM), updating (re-rendering in response to new props, state, or context), and unmounting (removal and cleanup). Class components exposed this sequence directly as named methods you could override — `constructor`, `render`, `componentDidMount`, `componentDidUpdate`, `componentWillUnmount`, and error-handling hooks like `static getDerivedStateFromError`/`componentDidCatch` — which made the lifecycle explicit and easy to reason about, but also encouraged splitting logically related code (e.g., "set up and tear down a subscription") across two unrelated-looking methods (`componentDidMount` and `componentWillUnmount`).

Function components with Hooks replaced this named-method model with a single, unified `useEffect` hook whose behavior is controlled by its dependency array rather than by which lifecycle method it's written in. This is a conceptual shift, not just a syntax change: instead of thinking "what should happen when this component mounts, and separately what should happen when it updates, and separately what should happen when it unmounts," you think "this effect needs to run whenever these specific values change" — and React figures out mount/update/unmount timing from the dependency array automatically. This is why `useEffect` is usually a better mental model of "synchronizing with an external system" than "lifecycle methods translated to hooks," even though the mapping below is the practical, interview-relevant translation.

Some class lifecycle methods have no direct hook equivalent because the two models solve the underlying problem differently. There's no hook that maps to `constructor` — instead, initial state is set via the `useState` initializer (optionally a lazy initializer function, `useState(() => expensiveInit())`, for expensive one-time setup, mirroring what you'd otherwise do in a constructor). `shouldComponentUpdate`, once used to manually bail out of a re-render for performance, is replaced by wrapping a function component in `React.memo` (see [react-memo.md](./react-memo.md)) rather than any hook. And a few legacy lifecycle methods — `componentWillMount`, `componentWillReceiveProps`, `componentWillUpdate` — are deprecated (renamed with an `UNSAFE_` prefix) because they ran during React's "render phase," where work could be interrupted, retried, or run more than once under concurrent rendering, making them unsafe for side effects.

Understanding the class lifecycle is still commonly asked about in interviews, both because a large amount of legacy React code still uses class components and because it's a clean way to test whether a candidate understands *when*, precisely, React runs a given piece of code relative to the DOM being updated — knowledge that transfers directly to reasoning correctly about `useEffect` timing and dependency arrays in modern function components.

## Examples

```jsx
// A class component exercising the full mount -> update -> unmount lifecycle
class Timer extends React.Component {
  constructor(props) {
    super(props);
    this.state = { seconds: 0 }; // no hook equivalent — this IS the initializer
  }

  componentDidMount() {
    // Runs once, after the initial render is committed to the DOM.
    this.intervalId = setInterval(() => {
      this.setState((prev) => ({ seconds: prev.seconds + 1 }));
    }, 1000);
  }

  componentDidUpdate(prevProps, prevState) {
    // Runs after every re-render (except the first), with access to previous props/state.
    if (prevState.seconds !== this.state.seconds && this.state.seconds % 60 === 0) {
      console.log('A minute has passed');
    }
  }

  componentWillUnmount() {
    // Runs right before the component is removed from the DOM — cleanup goes here.
    clearInterval(this.intervalId);
  }

  render() {
    return <p>Seconds: {this.state.seconds}</p>;
  }
}
```

```jsx
// The equivalent function component: useState replaces the constructor,
// and a single useEffect with cleanup covers mount + update + unmount.
function TimerHooks() {
  const [seconds, setSeconds] = useState(0); // replaces constructor's this.state

  useEffect(() => {
    // Runs after mount (componentDidMount equivalent)
    const intervalId = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(intervalId); // componentWillUnmount equivalent
  }, []); // empty deps => run once on mount, cleanup once on unmount

  return <p>Seconds: {seconds}</p>;
}
```

```jsx
// componentDidUpdate for a SPECIFIC prop/state change maps to useEffect
// with that value in the dependency array.
class UserProfileClass extends React.Component {
  componentDidUpdate(prevProps) {
    if (prevProps.userId !== this.props.userId) {
      this.fetchUser(this.props.userId); // re-fetch only when userId changes
    }
  }
  // ...
}

function UserProfileHooks({ userId }) {
  useEffect(() => {
    fetchUser(userId); // runs on mount AND whenever userId changes — same intent
  }, [userId]);
  // ...
}
```

## Common Pitfalls / Gotchas

- Assuming `useEffect(fn, [])` is *exactly* `componentDidMount` — it's close in timing, but conceptually it's "run this effect once because it has no dependencies," and forgetting a dependency it actually uses (a stale-closure bug) is a very common mistake that class lifecycle methods didn't have, since class methods always read `this.props`/`this.state` fresh.
- Forgetting the cleanup function in `useEffect` entirely, then wondering why intervals/subscriptions/listeners pile up on every re-mount — the returned function is the direct equivalent of `componentWillUnmount` (and also runs before every re-run of the effect, not just on unmount).
- Using the deprecated `UNSAFE_componentWillReceiveProps`/`UNSAFE_componentWillMount` in new code — they run during the interruptible render phase and can execute multiple times or out of order under concurrent features, and are officially deprecated in favor of `componentDidUpdate` or, in function components, `useEffect`.
- Doing side effects (data fetching, subscriptions, manual DOM mutation) directly in `render()` or in the function component body instead of in `componentDidMount`/`componentDidUpdate` or `useEffect` — render (and the function component body) must stay pure and free of side effects, since React may call it multiple times without committing.
- Thinking there's a hook equivalent for `shouldComponentUpdate` — there isn't one; the replacement is wrapping the component in `React.memo`, which is a component-level opt-in to shallow prop comparison, not a hook you call inside the component.

## Interview Questions & Answers

**Q: Walk through what happens, in order, when a class component first mounts.**
A: `constructor` runs first to initialize state, then `render()` produces the element tree, React commits that tree to the DOM, and finally `componentDidMount` runs — at which point `this.props`/`this.state` are set and the actual DOM nodes exist, making it the right place for side effects like data fetching, subscriptions, or manual DOM measurement.

**Q: How does `useEffect(fn, [])` differ from `componentDidMount`, and where can that difference cause bugs?**
A: They both run once, after the initial render is committed, but `useEffect` also captures the specific props/state values that existed on that render inside its closure — if the effect references a prop or piece of state without including it in the dependency array, it will keep using the *original* (now possibly stale) value on every subsequent render, since the effect itself never re-runs. `componentDidMount` doesn't have this issue because `this.props`/`this.state` are always read fresh at call time; the ESLint `react-hooks/exhaustive-deps` rule exists specifically to catch this class of bug.

**Q: Which hook (and dependency array) is the equivalent of `componentDidUpdate`, and how would you replicate `componentDidUpdate`'s access to the previous props?**
A: `useEffect(fn, [dep])` runs whenever `dep` changes, which is the functional equivalent of checking `prevProps.dep !== this.props.dep` inside `componentDidUpdate`. There's no built-in access to the previous value inside the effect itself, though — you'd manually track it with a `useRef` that you update at the end of the effect, since hooks don't hand you a "previous props" object the way `componentDidUpdate(prevProps, prevState)` does.

**Q: Is there a hook equivalent for the constructor? How do you handle expensive one-time initialization in a function component?**
A: No hook maps directly to the constructor. Initial state is set through the argument (or lazy initializer function) passed to `useState`; for genuinely expensive computation that should only run once, you pass a function to `useState` (`useState(() => expensiveCompute())`) rather than calling the expensive function directly in the render body, since a plain value argument would otherwise be recomputed on every render even though only the first call's result is ever used.

**Q: Why were `componentWillMount` and `componentWillReceiveProps` deprecated?**
A: Both ran during React's render phase, which under concurrent/async rendering can be paused, thrown away, or replayed multiple times before a render actually commits. Methods that ran there and triggered side effects or relied on running exactly once could behave unpredictably or run redundantly. They were renamed with an `UNSAFE_` prefix and effectively replaced — `componentDidMount`/`componentDidUpdate` (post-commit, guaranteed to run once per actual commit) for side effects, and `static getDerivedStateFromProps` for the narrow case of deriving state from incoming props.

## Related Topics
- [use-effect.md](./use-effect.md)
- [use-state.md](./use-state.md)
- [react-memo.md](./react-memo.md)
- [error-boundaries.md](./error-boundaries.md)
- [pure-components.md](./pure-components.md)
- [react-hooks-overview.md](./react-hooks-overview.md)
