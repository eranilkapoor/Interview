# useRef

`useRef` is a hook that returns a mutable, plain JavaScript object with a single property, `current`, that persists for the entire lifetime of the component instance across re-renders. Unlike state, updating a ref's `.current` value does not trigger a re-render — React has no idea the value changed and won't schedule any work in response. This makes refs the escape hatch for holding onto a piece of mutable data that the component needs to remember, but that shouldn't participate in the render output at all.

The most common use of `useRef` is to get direct, imperative access to a DOM node. When you pass a ref object to a host element's `ref` attribute (e.g. `<input ref={inputRef} />`), React sets `inputRef.current` to the actual DOM node after it's been committed to the page, letting you call imperative APIs like `.focus()`, `.scrollIntoView()`, or read layout measurements that have no declarative equivalent. This is intentionally the exception rather than the rule — most UI should be expressed declaratively through props and state, and refs are reserved for the cases React's declarative model doesn't cover.

The second major use is storing any mutable value that needs to survive across renders but whose changes shouldn't cause a re-render — for example, a `setInterval`/`setTimeout` ID you need to clear later, a flag tracking whether a component is still mounted, a reference to the previous value of a prop for comparison, or an instance of some external non-React object (like a WebSocket connection or a third-party library instance). In every one of these cases, the value genuinely doesn't belong in the rendered UI, so state would be the wrong tool — it would cause unnecessary re-renders every time the value changes.

It's worth being precise about the contrast with `useState`: state changes are the mechanism by which React knows the UI needs to update, and state updates are (conceptually) asynchronous/batched and trigger a re-render with the new value reflected in that render's props/state snapshot. Ref changes are synchronous, immediate, and mutate the *same* object in place — reading `ref.current` right after setting it gives you the new value instantly, but a component reading a ref during render is reading a value that isn't guaranteed to be consistent with what's on screen, since ref writes don't get flushed through the render cycle. As a rule of thumb: if a value affects what should be rendered, it belongs in state; if it doesn't, and you just need a stable, mutable box to stash it in, it belongs in a ref.

## Examples

```jsx
// Direct DOM access: focus an input imperatively on mount
import { useRef, useEffect } from 'react';

function SearchBox() {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current.focus(); // imperative — no declarative prop does this
  }, []);

  return <input ref={inputRef} placeholder="Search..." />;
}
```

```jsx
// Storing a mutable value that shouldn't trigger re-renders: an interval ID
import { useRef, useState, useEffect } from 'react';

function Stopwatch() {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef(null);

  const start = () => {
    if (intervalRef.current !== null) return; // already running
    intervalRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
  };

  const stop = () => {
    clearInterval(intervalRef.current);
    intervalRef.current = null; // mutating .current does NOT re-render
  };

  useEffect(() => () => clearInterval(intervalRef.current), []); // cleanup on unmount

  return (
    <div>
      <p>{seconds}s</p>
      <button onClick={start}>Start</button>
      <button onClick={stop}>Stop</button>
    </div>
  );
}
```

```jsx
// Tracking the previous value of a prop across renders
import { useRef, useEffect } from 'react';

function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value; // runs after render, so this holds the PREVIOUS value during render
  });
  return ref.current;
}

function PriceTag({ price }) {
  const previousPrice = usePrevious(price);
  const trend = previousPrice === undefined ? '' : price > previousPrice ? '▲' : '▼';
  return <span>${price} {trend}</span>;
}
```

## Common Pitfalls / Gotchas

- Reading or writing `ref.current` during render (outside an event handler or effect) — this makes the component's output depend on a value React doesn't track, which is a common source of hard-to-debug inconsistencies and breaks with concurrent rendering features.
- Expecting a UI update after mutating `ref.current` — refs are deliberately invisible to React's render cycle, so if you need the screen to reflect a change, it must be state, not a ref.
- Using `useRef(null)` for a value and forgetting the initial render happens before refs attached to DOM nodes are populated — `inputRef.current` is `null` during the first render and is only set after the DOM has committed, so DOM-dependent ref logic belongs in `useEffect`, not directly in the render body.
- Creating a new ref object on every render by mistake (e.g. via a non-memoized custom hook) — `useRef` is safe here since React guarantees the same object identity across re-renders for a given `useRef` call, but wrapping it incorrectly in your own logic can accidentally lose that persistence.
- Overusing refs as a substitute for state to "avoid re-renders" — this often leads to stale or inconsistent UI, since the screen won't reflect ref changes until something else happens to trigger a re-render anyway.

## Interview Questions & Answers

**Q: What's the fundamental difference between `useRef` and `useState`?**
A: Both persist a value across re-renders, but updating state schedules a re-render so the new value is reflected in the UI, while updating a ref's `.current` property is a plain, synchronous mutation that React does not observe or react to — no re-render happens. State is for values that affect what should be rendered; refs are for mutable values the component needs to remember that shouldn't affect rendering.

**Q: How do you get a reference to an actual DOM node in a function component?**
A: Create a ref with `useRef(null)`, pass it to the `ref` attribute of the host element you want (`<div ref={myRef}>`), and React populates `myRef.current` with the underlying DOM node once it commits to the page. Since the DOM node isn't available during the render phase, it should only be accessed inside effects or event handlers, not directly in the render body.

**Q: Why doesn't updating `ref.current` cause a re-render, and when is that actually useful?**
A: Refs are intentionally kept outside React's reactivity system — they're a plain mutable object, not tracked state. This is useful for values like interval/timeout IDs, previous-prop tracking, or instances of imperative objects (a WebSocket, a third-party widget) that the component needs to hang onto across renders but that have no bearing on what gets rendered, so triggering a re-render on every change would be wasteful and unnecessary.

**Q: Can you use `useRef` for something other than DOM access?**
A: Yes — `useRef` is really just "a mutable box that survives re-renders," and DOM access is only its most common use. It's equally used to store timer/interval IDs, flags like `isMountedRef`, memoized instances of expensive objects, and previous values of props or state for comparison across renders.

**Q: What does it mean that ref updates are "synchronous" compared to state updates?**
A: Assigning `ref.current = newValue` takes effect immediately — the very next line of code sees the new value. State updates, by contrast, are enqueued and applied according to React's batching/scheduling rules, meaning a state variable read immediately after calling its setter within the same render still reflects the *old* value; the new value only appears in the next render.

## Related Topics
- [refs-and-forward-ref.md](./refs-and-forward-ref.md)
- [use-state.md](./use-state.md)
- [use-effect.md](./use-effect.md)
- [component-lifecycle.md](./component-lifecycle.md)
