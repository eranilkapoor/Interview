# Rendering Lists and Keys

React doesn't have a special looping directive built into JSX — since JSX is just JavaScript expressions, rendering a list of elements from an array is done with ordinary array methods, almost always `.map()`. You transform an array of data into an array of JSX elements (`items.map(item => <li key={item.id}>{item.name}</li>)`), embed that resulting array directly inside JSX, and React renders each element in order. This is a direct consequence of JSX compiling to plain function calls (`React.createElement(...)`) — an array of those calls is just as valid a child as a single one.

Every element produced inside a `.map()` call needs a `key` prop — a string or number that's unique among its siblings in that specific list (it doesn't need to be globally unique across the whole app, just unique among the elements it's rendered alongside). React uses keys to match elements between renders: when a list re-renders, React compares the new list of keyed elements to the previous one, and uses matching keys to figure out which elements are the *same* logical item (so it can update it in place, preserving state) versus which are new or removed (so it can mount or unmount them). Without a stable, correct key, React falls back to matching purely by position/index, which works for lists that never reorder, get items inserted in the middle, or get items removed from anywhere but the end — but silently breaks in every other case.

This is exactly why using the array index as a key (`items.map((item, index) => <li key={index}>...)`) is a common but risky shortcut: it works fine visually for a static list that's only ever appended to, but the moment the list is reordered, filtered, or has an item removed from the middle, the *index* stays associated with a given position rather than the underlying data — so React can end up matching the wrong DOM node (and, critically, the wrong internal component state, like an input's typed value or a checkbox's checked state) to the wrong data item after the reorder. The correct key is something intrinsic and stable to the *data itself*, most commonly a database ID (`item.id`) — something that travels with a specific logical item regardless of where it currently sits in the array.

The practical fallout of a bad key shows up as bugs that are surprisingly hard to trace back to their cause: form inputs inside a list item unexpectedly showing another row's typed value after a reorder, animations firing on the wrong item, or component-local state (from `useState` inside a list item's component) "jumping" to a different row's rendered position. Because these bugs only manifest on reorder/insert/delete — not on a component's very first render — they're easy to miss in a quick manual test and are a genuinely common source of production bugs, which is also why React logs a console warning whenever a list is rendered without keys (or with `key={index}` triggering an ESLint warning under some configurations) to nudge developers toward getting this right up front.

## Examples

```jsx
// Basic list rendering with a stable, data-derived key
function TodoList({ todos }) {
  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>
          {todo.text} {todo.done && '✓'}
        </li>
      ))}
    </ul>
  );
}
// todos = [{ id: 'a1', text: 'Buy milk', done: false }, { id: 'b2', text: 'Walk dog', done: true }]
```

```jsx
// Why index-as-key breaks: state gets attached to the wrong row after removing an item
function EditableList({ initialItems }) {
  const [items, setItems] = useState(initialItems);

  const removeFirst = () => setItems((prev) => prev.slice(1));

  return (
    <div>
      <button onClick={removeFirst}>Remove first item</button>
      <ul>
        {items.map((item, index) => (
          // BAD: key={index} — after removeFirst, every remaining row shifts up one
          // index, so React reuses each row's *component instance* (and its internal
          // <input> state) for what is now a DIFFERENT underlying item.
          <li key={index}>
            <input defaultValue={item.label} />
          </li>
        ))}
      </ul>
    </div>
  );
}
// Correct fix: <li key={item.id}> instead of <li key={index}>
```

```jsx
// Rendering a list of components, passing each item's data down as props
function ProductGrid({ products }) {
  return (
    <div className="grid">
      {products.map((product) => (
        <ProductCard key={product.sku} product={product} />
      ))}
    </div>
  );
}

function ProductCard({ product }) {
  return (
    <div className="card">
      <h3>{product.name}</h3>
      <p>${product.price}</p>
    </div>
  );
}
```

## Common Pitfalls / Gotchas

- Using the array index as `key` for a list that can be reordered, filtered, or have items inserted/removed anywhere but the very end — this causes React to misattribute component state (like uncontrolled input values) to the wrong row after such a change.
- Omitting `key` entirely — React logs a "each child in a list should have a unique key prop" warning and falls back to index-based matching, inheriting all the same risks.
- Putting the `key` on the wrong element — it must go on the outermost element actually returned from inside the `.map()` callback (or on a `<Fragment key={...}>` if you need to return multiple elements without a wrapper `<div>`), not on some inner child.
- Generating a new key on every render (e.g., `key={Math.random()}` or `key={crypto.randomUUID()}` computed inside the render) — this defeats the entire purpose, since a "unique-every-time" key never matches its previous render's key, forcing React to unmount and remount every item on every render.
- Assuming `key` is accessible as a regular prop inside the component — it's a special, React-internal attribute used purely for reconciliation and is never passed down as `props.key`; if you need the same value inside the component, pass it again under a different prop name.

## Interview Questions & Answers

**Q: Why does React require a `key` prop when rendering a list, and what does React actually use it for?**
A: The `key` lets React's reconciliation algorithm match elements in a new render against the elements from the previous render, so it can tell which elements are the *same* logical item (and should be updated in place, preserving their state) versus which are newly added or removed. Without keys, React can only fall back to matching by position, which breaks down as soon as the list's order or membership changes.

**Q: Why is using the array index as a key considered risky, and when is it actually acceptable?**
A: An index identifies a *position* in the array, not the underlying data item at that position. If the list is ever reordered, filtered, or has items removed from the middle, the index-to-data mapping shifts, and React ends up reusing a component instance (and its internal state, like a text input's value) for what is now logically a different item. It's acceptable only for lists that are always static or strictly append-only and never reordered or have items removed from the middle.

**Q: What's a concrete bug you'd see from using the wrong key, and why does it happen?**
A: A classic example: a list of `<li>` rows each containing an uncontrolled `<input>`. If you remove the first item using `key={index}`, every remaining row's index shifts down by one, so React matches each row's component instance to the *new* item now occupying that index rather than unmounting the removed row — the result is that the DOM nodes (and any typed-but-uncommitted input values) appear to "stay in place" while the underlying data shifts underneath them, producing input values that no longer match their labels.

**Q: Does the `key` prop need to be globally unique across the entire application?**
A: No — it only needs to be unique among the siblings being rendered in that specific list/`.map()` call. The same key value can be reused in a completely different list elsewhere in the app without any conflict, since React's matching is scoped to siblings under the same parent.

**Q: Can you access `props.key` inside the component you're rendering in a list?**
A: No. `key` (like `ref`) is a special prop that React intercepts for its own internal reconciliation bookkeeping — it's never forwarded to the component as a regular prop. If the component needs that same value for its own logic, you must pass it again explicitly under a different prop name, e.g. `<Row key={item.id} itemId={item.id} />`.

## Related Topics
- [keys-and-reconciliation.md](./keys-and-reconciliation.md)
- [virtual-dom-and-reconciliation.md](./virtual-dom-and-reconciliation.md)
- [conditional-rendering.md](./conditional-rendering.md)
- [controlled-vs-uncontrolled-components.md](./controlled-vs-uncontrolled-components.md)
- [component-lifecycle.md](./component-lifecycle.md)
