# Handling Events

React lets you respond to user interaction — clicks, keystrokes, form submissions, mouse movement — using event handler props written directly in JSX, and the mental model is close to native DOM event handling but with a few deliberate differences. Instead of lowercase, string-based attributes like HTML's `onclick="..."`, React uses camelCase prop names (`onClick`, `onChange`, `onSubmit`, `onKeyDown`) and expects an actual function reference as the value, not a string of code to be evaluated. Under the hood, React doesn't attach a separate native listener to every single DOM element with a handler; instead (since React 17) it attaches one listener per event type at the root of your rendered tree and uses event bubbling to figure out which component's handler(s) should fire — an internal optimization that doesn't change how you write handlers, but does explain some of React's more advanced event behavior.

A critical, extremely common beginner mistake is the difference between passing a function *reference* versus *calling* the function directly in the JSX: `onClick={handleClick}` passes the function itself, to be invoked later by React when the click actually happens, while `onClick={handleClick()}` calls `handleClick` immediately during rendering and passes whatever it *returns* as the handler (usually `undefined`, silently breaking the click entirely and instead running your logic once, immediately, on every render). When a handler needs arguments, you can't pass `onClick={handleClick(id)}` for the same reason — instead you wrap it in an inline arrow function, `onClick={() => handleClick(id)}`, which itself is a function reference (the arrow function), deferring the actual call to when the click happens.

The object your handler receives isn't the raw native DOM event — it's a `SyntheticEvent`, a cross-browser wrapper React creates around the native event that normalizes property names and behavior consistently across browsers, so `event.target.value`, `event.preventDefault()`, and similar APIs behave the same way in every supported browser regardless of underlying native inconsistencies. If you ever need the actual native event, it's available as `event.nativeEvent`. `event.preventDefault()` works exactly as expected for stopping default browser behavior — most commonly, preventing a `<form>`'s `onSubmit` from triggering a full page reload/navigation, which is the standard first line in virtually every form submit handler in a React app.

One historical wrinkle worth knowing for interviews: in older React versions (pre-17), `SyntheticEvent` objects were *pooled* — reused and nulled out immediately after the handler finished, for performance reasons — which meant that accessing event properties asynchronously (e.g., inside a `setTimeout` or after an `await`) after the handler had already returned would get `null` values unless you explicitly called `event.persist()` first. React 17 removed event pooling entirely, so this gotcha and `event.persist()` (now a no-op) are no longer a practical concern in modern React, though it still occasionally comes up as an interview question about React's history and internals.

## Examples

```jsx
// Correct vs incorrect handler wiring — the classic "calling vs referencing" mistake
function ClickCounter() {
  const [count, setCount] = useState(0);

  const handleClick = () => setCount((c) => c + 1);

  return (
    <div>
      {/* Correct: passes the function reference; React calls it on click */}
      <button onClick={handleClick}>Correct: {count}</button>

      {/* WRONG: calls handleClick() immediately during render, runs once per
          render, and passes its return value (undefined) as the handler */}
      {/* <button onClick={handleClick()}>Broken</button> */}
    </div>
  );
}
```

```jsx
// Passing arguments to a handler via an inline arrow function
function TodoList({ todos, onRemove }) {
  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>
          {todo.text}
          <button onClick={() => onRemove(todo.id)}>Remove</button>
        </li>
      ))}
    </ul>
  );
}
```

```jsx
// preventDefault on form submit, and reading values off the SyntheticEvent
function LoginForm() {
  const [email, setEmail] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault(); // stops the browser's default full-page-reload navigation
    console.log('Submitting:', email);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)} // SyntheticEvent, normalized across browsers
      />
      <button type="submit">Log in</button>
    </form>
  );
}
```

## Common Pitfalls / Gotchas

- Writing `onClick={handleClick()}` instead of `onClick={handleClick}` — this invokes the handler immediately during render rather than on click, and passes its return value (usually `undefined`) as the actual handler.
- Needing to pass arguments and forgetting to wrap the call in an arrow function — `onClick={handleClick(id)}` has the same "calls immediately" bug; use `onClick={() => handleClick(id)}` instead.
- Creating a brand-new inline arrow function on every render for handlers passed to memoized children (`React.memo`) — this defeats the memoization, since the child receives a new function reference every render regardless of whether the underlying logic changed; `useCallback` addresses this when it's actually measured to matter.
- Forgetting `event.preventDefault()` in a form's `onSubmit` handler — without it, the browser performs its native full-page form submission/reload, discarding all React state.
- Assuming `event` in a handler is the raw native browser event — it's a `SyntheticEvent` wrapper; the native event is available separately as `event.nativeEvent` if truly needed.
- Relying on accessing event properties *asynchronously* after the handler returns, without realizing this was only ever unsafe pre-React-17 event pooling — modern React (17+) no longer pools/nulls events, so this specific historical gotcha doesn't apply to current codebases.

## Interview Questions & Answers

**Q: What's the difference between `onClick={handleClick}` and `onClick={handleClick()}`?**
A: `onClick={handleClick}` passes a reference to the function itself, which React stores and calls later, exactly once, whenever the click actually occurs. `onClick={handleClick()}` calls `handleClick` immediately, synchronously, during rendering, and assigns whatever it *returns* (commonly `undefined`) as the actual `onClick` value — so the intended logic runs once per render instead of once per click, and the click itself typically does nothing.

**Q: How do you pass an argument to an event handler in React?**
A: Wrap the call in an inline arrow function: `onClick={() => handleClick(itemId)}`. The arrow function itself is what gets passed as the handler reference; it isn't invoked until the click happens, at which point it calls `handleClick(itemId)` with the argument you closed over.

**Q: What is a SyntheticEvent, and why does React wrap native events with it?**
A: `SyntheticEvent` is React's cross-browser wrapper around the native DOM event, normalizing property names and behavior (like `event.target`, `event.preventDefault()`, `event.stopPropagation()`) so handlers behave consistently regardless of underlying browser differences in the native Event APIs. The actual native event object is still accessible via `event.nativeEvent` if you need something SyntheticEvent doesn't expose.

**Q: How do you prevent a form's default submission behavior in React, and why is that usually necessary?**
A: Call `event.preventDefault()` at the start of the `onSubmit` handler. Without it, submitting an HTML `<form>` triggers the browser's native behavior of navigating/reloading the page, which would discard all in-memory React state — calling `preventDefault()` lets you handle the submission entirely in JavaScript (e.g., calling an API, updating state) instead.

**Q: What was SyntheticEvent pooling, and does it still apply in current React?**
A: Prior to React 17, React reused (pooled) `SyntheticEvent` objects for performance, nulling out their fields immediately after the handler synchronously finished — so accessing event properties asynchronously (e.g., inside a `setTimeout`) after the handler returned would read `null` unless you'd called `event.persist()` to opt that particular event out of pooling. React 17 removed event pooling entirely, so modern React code no longer needs `persist()` and doesn't hit this gotcha, though it remains a common "do you know React's history" interview question.

## Related Topics
- [controlled-vs-uncontrolled-components.md](./controlled-vs-uncontrolled-components.md)
- [use-callback.md](./use-callback.md)
- [react-memo.md](./react-memo.md)
- [jsx.md](./jsx.md)
- [state.md](./state.md)
