# useEffect

`useEffect` is React's Hook for **synchronizing a component with something outside of React's own rendering system** — a subscription, a timer, a manual DOM measurement/mutation, a WebSocket connection, or a network request. The mental model worth internalizing is that `useEffect` is not primarily a "run this after render" or "lifecycle" hook in the class-component sense (though it can be used that way); it's specifically for keeping some external system in sync with your component's current props/state. Every render, React first fully commits the new UI to the screen, and only *after* the browser has painted does it run any effects whose dependencies changed since the last render — this "runs after paint" timing is what makes `useEffect` non-blocking and is the key difference from its rarer sibling `useLayoutEffect`, which runs synchronously *before* the browser paints, for the narrow set of cases (like measuring layout to avoid visual flicker) where you genuinely can't wait.

The second argument to `useEffect` — the dependency array — controls exactly when the effect re-runs, and getting this right is the single most important (and most frequently misunderstood) part of using the Hook correctly. Omitting the array entirely (`useEffect(() => {...})`) runs the effect after *every* render, which is rarely what you want. Passing an empty array (`useEffect(() => {...}, [])`) runs the effect exactly once, after the initial mount, and never again — commonly (if imprecisely) described as "componentDidMount." Passing an array with values (`useEffect(() => {...}, [userId])`) runs the effect after the initial mount, and again after any render where at least one listed dependency's value has changed compared to the previous render (compared via `Object.is`, the same reference-equality check `useState` uses) — so the effect stays synchronized specifically with the values it depends on.

Effects can optionally `return` a cleanup function, and the precise timing of when that cleanup runs is a frequent source of subtle bugs if misunderstood: the cleanup function from the *previous* run of the effect is called immediately **before** the effect runs again (for that same effect, when its dependencies changed) — not immediately after the effect ran, and not batched up at the very end. It's also called on unmount, when the component leaves the screen for good. This ordering matters enormously for anything that subscribes to something external: if you `useEffect` to open a WebSocket connection for a given `roomId` and clean up by closing it, when `roomId` changes React first calls the cleanup for the *old* `roomId`'s connection (closing it) and only then runs the effect again for the *new* `roomId` (opening a fresh connection) — guaranteeing you're never accidentally subscribed to two rooms at once, and never leak the old connection. When a component has multiple effects, their cleanup functions run in the reverse order their effects originally ran in, mirroring how stack-based cleanup typically works.

The single most common real-world `useEffect` bug is a mismatched dependency array — most often, a "missing dependency": referencing a prop, state variable, or function inside the effect body without listing it in the dependency array. Because the effect closure captures whatever those values were *at the time that render's effect was created*, omitting a dependency means the effect keeps using a stale, outdated value from an earlier render even after the real value has since changed — a classic stale-closure bug. The `react-hooks/exhaustive-deps` ESLint rule (part of `eslint-plugin-react-hooks`) exists specifically to catch this automatically by flagging any value used inside the effect that isn't listed in the dependency array; while it's technically possible to silence it with a comment, doing so without deeply understanding *why* the rule is flagging that case is one of the most reliable ways to introduce a stale-closure bug into a codebase.

## Examples

```jsx
// Dependency array variants: mount-only, every render, and value-tracking
function Example({ userId }) {
  useEffect(() => {
    console.log('Runs after every render'); // no array
  });

  useEffect(() => {
    console.log('Runs once, after initial mount only'); // empty array
  }, []);

  useEffect(() => {
    console.log('Runs on mount, and again whenever userId changes');
    fetchUser(userId).then(/* ... */);
  }, [userId]); // dependency array

  return null;
}
```

```jsx
// Cleanup timing: runs before the NEXT effect execution, and on unmount
function ChatRoom({ roomId }) {
  useEffect(() => {
    const connection = createConnection(roomId);
    connection.connect();
    console.log(`Connected to room ${roomId}`);

    return () => {
      // Runs BEFORE the effect re-runs for a new roomId, and on unmount.
      // Guarantees the old connection is always closed before a new one opens.
      connection.disconnect();
      console.log(`Disconnected from room ${roomId}`);
    };
  }, [roomId]);

  return <p>Connected to: {roomId}</p>;
}
// Switching roomId from "lobby" to "general" logs, in order:
// "Disconnected from room lobby" then "Connected to room general"
```

```jsx
// A classic stale-closure bug from a missing dependency, and the fix
function SearchResults({ query }) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    let cancelled = false;
    searchApi(query).then((data) => {
      if (!cancelled) setResults(data); // guard against a stale, out-of-order response
    });
    return () => {
      cancelled = true; // cleanup marks this specific request's result as stale
    };
  }, [query]); // exhaustive-deps: query IS listed, so no stale closure here

  return <ResultsList items={results} />;
}
```

## Common Pitfalls / Gotchas

- Missing a dependency that the effect actually reads (a prop, state variable, or function from render) — the effect's closure keeps using the value from whenever it was created, silently going stale as real values change; the `exhaustive-deps` ESLint rule catches this.
- Passing an empty dependency array `[]` purely to "make the effect run only once," while the effect body still references props/state that can change — this guarantees exactly the stale-closure bug above, since the effect never re-runs to pick up new values.
- Forgetting a cleanup function for anything that subscribes/connects/schedules (intervals, event listeners, subscriptions, in-flight requests) — without cleanup, mounting/unmounting/re-running the effect repeatedly leaks timers, listeners, or connections.
- Assuming effect cleanup runs *after* the component fully unmounts rather than *before* the next run of that same effect (when dependencies change) — the cleanup-then-rerun ordering, per effect, is what prevents double-subscriptions when a dependency changes.
- Using `useEffect` for something that isn't actually synchronizing with an external system — e.g., recomputing a derived value from props/state that could just be computed directly during render (or memoized with `useMemo`) doesn't need an effect at all, and adding one introduces an extra unnecessary render.
- Reaching for `useLayoutEffect` "just in case" — it runs synchronously before the browser paints and can block visual updates, so it should be reserved for the narrow cases where reading/writing layout before paint is genuinely required (e.g., measuring an element to reposition a tooltip without a visible flicker).

## Interview Questions & Answers

**Q: What is `useEffect` actually for, conceptually?**
A: Synchronizing a component with a system outside of React's rendering — subscriptions, timers, manual DOM work, network requests, or any other "external system" whose state needs to stay consistent with the component's current props/state. It's not a general-purpose "run some code after render" hook so much as a "keep this external thing in sync" hook.

**Q: Explain the difference between no dependency array, an empty array, and an array with values.**
A: No array means the effect runs after every single render. An empty array (`[]`) means the effect runs exactly once, after the initial mount, and never again (no dependency ever "changes" because none are being tracked). An array with one or more values means the effect runs after the initial mount, and again after any render in which at least one of the listed values differs (by `Object.is`) from its value on the previous render.

**Q: When exactly does an effect's cleanup function run?**
A: Immediately before that same effect runs again (when its dependencies have changed on a subsequent render), and also when the component unmounts. It is not deferred to unmount only — for an effect with `[roomId]` as its dependency, changing `roomId` triggers the previous run's cleanup first (e.g., closing the old connection), and only then runs the effect body again for the new value (e.g., opening the new connection).

**Q: What causes a "stale closure" bug in `useEffect`, and how do you fix it?**
A: The effect function is a closure created fresh on each render, capturing whatever values were in scope on that render. If the dependency array omits a prop/state value the effect body actually reads, the effect only re-runs when the *listed* dependencies change — so it keeps executing with the captured-at-creation-time value of the omitted one, even after the real value has since changed elsewhere in the component. The fix is including every reactive value the effect reads in the dependency array (which the `exhaustive-deps` lint rule helps enforce), or restructuring the effect so it doesn't need to reference that value directly.

**Q: What's the difference between `useEffect` and `useLayoutEffect`?**
A: `useEffect` runs asynchronously, after the browser has painted the updated DOM to the screen — its execution doesn't block the browser from showing the new frame, so it's non-blocking and preferred by default. `useLayoutEffect` runs synchronously, after DOM mutations but before the browser paints — it blocks the paint until it finishes, which is only worth the cost when you need to read layout (e.g., measure an element's size/position) and possibly make a DOM change in response before the user ever sees the unadjusted frame, avoiding visual flicker.

## Related Topics
- [react-hooks-overview.md](./react-hooks-overview.md)
- [use-state.md](./use-state.md)
- [component-lifecycle.md](./component-lifecycle.md)
- [custom-hooks.md](./custom-hooks.md)
- [use-ref.md](./use-ref.md)
