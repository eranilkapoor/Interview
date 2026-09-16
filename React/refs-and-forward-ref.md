# Refs and forwardRef

A ref is a mutable handle React gives you to reach outside the normal declarative props/state flow and interact with something imperatively — most commonly, an actual DOM node. `useRef()` (in function components) or `createRef()` (occasionally still seen in class components) creates a ref object with a `current` property; attaching it to a host element's `ref` attribute (`<input ref={inputRef} />`) makes React set `.current` to that element's real DOM node once it's mounted. From there you can call imperative browser APIs — `.focus()`, `.select()`, `.scrollIntoView()`, measuring `.getBoundingClientRect()` — none of which have a purely declarative equivalent in React's props/JSX model.

Refs work naturally on host elements (`<div>`, `<input>`, etc.), but they don't automatically work on your own custom components — by default, `<MyInput ref={someRef} />` won't populate `someRef.current` with anything, because a custom function component has no single underlying DOM node for React to attach to, and function components don't accept `ref` as a regular prop. `forwardRef` solves exactly this problem: wrapping a component definition in `forwardRef((props, ref) => ...)` gives that component a second, special `ref` argument (separate from `props`) that it can then manually attach to whichever inner DOM node (or class instance) it wants to expose to its parent — effectively "forwarding" the parent's ref down through a layer of your own abstraction to the real node underneath.

Sometimes you don't want to expose the raw DOM node at all — you want the parent to be able to call a custom, curated set of imperative methods instead (like `videoPlayerRef.current.play()` rather than reaching for the raw `<video>` element and calling its native API directly). `useImperativeHandle`, used together with `forwardRef`, lets a component customize exactly what value gets attached to the ref its parent receives — instead of the DOM node itself, the parent gets back whatever object (methods, computed values) the child chooses to expose. This is the mechanism behind reusable component libraries that expose a clean imperative API (open/close a modal, play/pause a player) without leaking their internal DOM structure to consumers.

The important discipline around refs is knowing when *not* to reach for them. Refs are an escape hatch for genuinely imperative needs — DOM measurement, focus management, integrating with non-React libraries, triggering imperative animations — not a general-purpose way to read or derive UI state. If a value can be computed from props/state and rendered declaratively, or if a change should cause the UI to update, it belongs in state (or as a plain derived value), not a ref; using a ref there just makes the component's behavior harder to reason about, since ref changes are invisible to React's rendering and re-rendering logic entirely.

## Examples

```jsx
// A basic ref on a host element for imperative focus management
import { useRef } from 'react';

function SearchBox() {
  const inputRef = useRef(null);
  return (
    <div>
      <input ref={inputRef} />
      <button onClick={() => inputRef.current.focus()}>Focus input</button>
    </div>
  );
}
```

```jsx
// forwardRef: passing a parent's ref through a custom component to the inner DOM node
import { forwardRef, useRef } from 'react';

const FancyInput = forwardRef(function FancyInput(props, ref) {
  return <input ref={ref} className="fancy-input" {...props} />;
});

function Form() {
  const inputRef = useRef(null);
  return (
    <div>
      <FancyInput ref={inputRef} placeholder="Type here" />
      <button onClick={() => inputRef.current.focus()}>Focus</button>
    </div>
  );
}
```

```jsx
// useImperativeHandle: expose a curated API instead of the raw DOM node
import { forwardRef, useRef, useImperativeHandle } from 'react';

const VideoPlayer = forwardRef(function VideoPlayer({ src }, ref) {
  const videoRef = useRef(null);

  useImperativeHandle(ref, () => ({
    play: () => videoRef.current.play(),
    pause: () => videoRef.current.pause(),
    seekTo: (seconds) => { videoRef.current.currentTime = seconds; },
  }), []);

  return <video ref={videoRef} src={src} />;
});

function App() {
  const playerRef = useRef(null);
  return (
    <div>
      <VideoPlayer ref={playerRef} src="/clip.mp4" />
      {/* Parent only sees play/pause/seekTo — not the raw <video> element */}
      <button onClick={() => playerRef.current.play()}>Play</button>
      <button onClick={() => playerRef.current.pause()}>Pause</button>
    </div>
  );
}
```

## Common Pitfalls / Gotchas

- Attaching `ref` to a custom function component without wrapping it in `forwardRef` — React will not populate the ref (and, depending on version, may log a warning), since function components don't receive `ref` as a normal prop by default.
- Reading `ref.current` during render instead of inside an effect or event handler — a DOM ref is `null` until after the component has mounted and committed, and reading it during render doesn't respect React's render/commit sequencing.
- Reaching for refs and imperative DOM manipulation to solve problems that declarative state already solves well — e.g., manually setting `element.style.display` via a ref instead of conditionally rendering based on state; this fights React's model instead of working with it and gets out of sync easily.
- Overusing `useImperativeHandle` to expose broad, DOM-shaped APIs instead of a small, intentional set of methods — the whole point of the pattern is to hide implementation details behind a curated imperative surface, not to just proxy the raw node with extra steps.
- Forgetting the dependency array on `useImperativeHandle` — like `useEffect`, it accepts a dependency array, and omitting it (or getting it wrong) means the exposed handle object is recreated more or on different triggers than intended.

## Interview Questions & Answers

**Q: Why doesn't `<MyComponent ref={ref} />` work out of the box for a custom function component?**
A: `ref` is handled specially by React and isn't passed through as a regular prop to function components — a plain function component has no fixed underlying DOM node for React to automatically attach the ref to, since it might render zero, one, or many elements. `forwardRef` exists specifically to let a component opt in to receiving the parent's ref as an explicit second argument and decide what to do with it.

**Q: What does `forwardRef` actually do, mechanically?**
A: It wraps a component-rendering function so that, in addition to the normal `props` argument, it also receives a `ref` argument passed down from whatever ref the parent attached to that component. The component's implementation then decides where that ref goes — typically by attaching it to a specific inner DOM node via that node's own `ref` attribute, but it can also be handed to `useImperativeHandle` to expose a custom API instead.

**Q: What problem does `useImperativeHandle` solve that plain `forwardRef` doesn't?**
A: Plain `forwardRef` exposes the raw underlying DOM node (or whatever the ref is attached to) directly to the parent. `useImperativeHandle` lets the child override that and hand the parent a custom object instead — a curated set of methods or values — so the parent gets a clean, intentional imperative API (like `.play()`/`.pause()`) without needing to know or depend on the component's actual internal DOM structure.

**Q: When should you NOT use a ref?**
A: Whenever the value in question can and should be derived from, or drive, the rendered UI — anything that affects what's on screen belongs in state or as a computed value from props/state, not a ref, because ref changes are invisible to React's render cycle and won't cause a re-render. Refs are appropriate specifically for imperative escape hatches: direct DOM access, integrating imperative third-party libraries, or storing mutable values that genuinely have no bearing on what gets rendered.

**Q: Does updating a ref's value cause the component to re-render?**
A: No — mutating `ref.current` is a plain, synchronous JavaScript assignment that React does not observe or react to in any way. This is true whether the ref holds a DOM node, an imperative handle object, or any other mutable value; if you need the screen to update in response to a change, that value needs to live in state instead.

## Related Topics
- [use-ref.md](./use-ref.md)
- [portals.md](./portals.md)
- [component-lifecycle.md](./component-lifecycle.md)
- [pure-components.md](./pure-components.md)
