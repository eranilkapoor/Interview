# Conditional Rendering

Conditional rendering is simply the practice of deciding *what* JSX to render based on some condition — and because JSX is just JavaScript expressions under the hood, React doesn't need a special templating syntax (like `v-if` or `*ngIf` in other frameworks) for this. You reach for ordinary JavaScript control flow: `if` statements, ternary expressions, logical operators, and regular variables holding JSX — all of which work exactly as they do anywhere else in JavaScript, applied inside or around a component's `return`.

The most straightforward approach is a plain `if` statement (or an early `return`) *before* the component's main `return`, which is ideal when an entire branch of the component's output is fundamentally different depending on the condition — for example, returning a loading spinner, an error message, or the real content as three entirely separate `return` statements. This tends to be the clearest, most readable option once more than one or two conditions are involved, because it avoids nesting ternaries or logical expressions inside JSX.

Inside JSX itself, the ternary operator (`condition ? <A /> : <B />`) is the standard way to choose between two alternatives inline, and the logical `&&` operator (`condition && <A />`) is the standard shorthand for "render this, or render nothing." The `&&` pattern has a well-known gotcha, though: because `&&` evaluates and returns its left operand when that operand is falsy, an expression like `count && <Badge count={count} />` will render the literal number `0` (not nothing) whenever `count` is `0`, since `0` is falsy but is still a valid, non-`null`/`undefined`/`boolean` value that React will render to the screen as text. The fix is to make sure the left side is coerced to an actual boolean, e.g. `count > 0 && <Badge />` or `Boolean(count) && <Badge />`.

For more than two branches, assigning JSX to a regular variable (optionally built up with `if`/`else if` or a `switch` statement before the `return`) keeps the JSX itself flat and readable, rather than nesting several ternaries inside one expression — nested ternaries are notoriously hard to read and are generally worth avoiding once you have more than one level. A `switch` statement is a good fit when a single variable can take on several distinct, named states (e.g., a `status` of `'idle' | 'loading' | 'success' | 'error'`) and each maps to a clearly different chunk of UI — it reads more like an explicit state machine than a chain of `if`/`else if` checks.

## Examples

```jsx
// Early return: an entirely different UI per branch, decided before the main return
function UserProfile({ user, isLoading, error }) {
  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage message={error.message} />;
  if (!user) return <p>No user found.</p>;

  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}
```

```jsx
// Ternary for either/or inline JSX, and the classic && gotcha with 0
function Cart({ items }) {
  return (
    <div>
      {items.length > 0 ? (
        <p>{items.length} item(s) in your cart</p>
      ) : (
        <p>Your cart is empty</p>
      )}

      {/* BUG: if items.length is 0, this renders the literal "0", not nothing */}
      {items.length && <span className="badge">{items.length}</span>}

      {/* FIX: coerce to a real boolean first */}
      {items.length > 0 && <span className="badge">{items.length}</span>}
    </div>
  );
}
```

```jsx
// switch for a multi-branch UI keyed off a single status variable
function StatusPanel({ status }) {
  let content;
  switch (status) {
    case 'loading':
      content = <Spinner />;
      break;
    case 'error':
      content = <p role="alert">Something went wrong.</p>;
      break;
    case 'success':
      content = <p>Loaded successfully!</p>;
      break;
    default:
      content = <p>Idle.</p>;
  }

  return <div className="status-panel">{content}</div>;
}
```

## Common Pitfalls / Gotchas

- `count && <Component />` renders a stray `0` on screen when `count` is `0` — `&&` returns its left side when falsy, and `0` (unlike `false`, `null`, or `undefined`) is still rendered by React. Guard with a real boolean comparison instead (`count > 0 && ...`).
- Deeply nesting ternaries inside JSX (`a ? <X/> : b ? <Y/> : <Z/>`) — this compiles fine but is hard to read and error-prone to edit; prefer an early return, a `switch`, or a variable built up with `if`/`else if` once you have more than two branches.
- Forgetting that returning `null` from a component is valid and renders nothing — useful for "sometimes this component renders literally nothing" cases, as opposed to returning `undefined` (which is not a valid render return value and throws).
- Conditionally calling a Hook inside one of these branches (`if (x) { const [a] = useState() }`) — Hooks must always run in the same order on every render, so conditionals must wrap the *JSX*, never the Hook calls themselves.
- Using a ternary's two branches to render structurally very different DOM trees for the "same" UI element without a stable `key` — this can cause React to unexpectedly unmount/remount the whole subtree (and lose its internal state) rather than update it in place.

## Interview Questions & Answers

**Q: What are the main techniques for conditional rendering in React, and when would you use each?**
A: An early return / `if` statement before the main `return` works well when entire branches produce fundamentally different UI (loading vs. error vs. content). The ternary operator (`? :`) is for inline either/or choices within JSX. The `&&` operator is shorthand for "render this or render nothing." Variables built up via `if`/`else if` or a `switch` before the `return` keep JSX flat and readable once there are more than two branches, avoiding nested ternaries.

**Q: Why does `{count && <Badge />}` sometimes render a literal `0` on the page, and how do you fix it?**
A: `&&` evaluates its left operand and, if it's falsy, returns that operand directly rather than evaluating the right side. `0` is falsy, so `count && <Badge />` evaluates to `0` when `count` is `0` — and unlike `false`, `null`, or `undefined` (which React silently renders as nothing), the number `0` is a valid renderable value, so React prints it. The fix is ensuring the left side is an actual boolean, e.g. `count > 0 && <Badge />`.

**Q: What does it mean for a component to return `null`, and is that different from returning `undefined`?**
A: Returning `null` from a component is explicitly supported and tells React to render nothing for that component — a common pattern for components that conditionally opt out of rendering entirely. Returning `undefined` is not valid (aside from a component simply not having a `return` statement, common when someone forgets one) and React will throw an error, since `undefined` as a return value usually indicates a mistake rather than an intentional "render nothing."

**Q: Why is deeply nested ternary logic in JSX generally discouraged, and what would you do instead?**
A: Nested ternaries compile and work correctly, but they're hard to read at a glance, hard to add new branches to safely, and easy to misindent or misplace parentheses in. For more than two branches, it's clearer to compute the JSX into a variable using `if`/`else if` or a `switch` statement above the `return`, or to use early returns — both keep the branching logic explicit and the final JSX flat.

**Q: How would you conditionally render one of several possible UI states (idle, loading, success, error) cleanly?**
A: A `switch` statement (or an object/map keyed by the status string) that assigns the appropriate JSX to a variable before the `return` reads clearly as an explicit state machine, one case per status, and avoids chains of nested ternaries or long `if`/`else if` blocks directly inside the JSX.

## Related Topics
- [displaying-data-in-jsx.md](./displaying-data-in-jsx.md)
- [jsx.md](./jsx.md)
- [rendering-lists-and-keys.md](./rendering-lists-and-keys.md)
- [state.md](./state.md)
- [component-lifecycle.md](./component-lifecycle.md)
