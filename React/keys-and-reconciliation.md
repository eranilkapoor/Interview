# Keys and Reconciliation

The `key` prop is a special, React-reserved prop (not accessible via `props.key` inside the component) that you attach to elements in a list so React can identify each one individually across renders, independent of its position in the array. When React reconciles a list, it needs to answer the question "which element in the new list corresponds to which element in the old list?" so it can decide, per item, whether to update an existing DOM node/component instance in place, insert a new one, or remove one that's gone — `key` is the piece of information that makes that matching possible and reliable, rather than React having to guess based on position alone.

Without explicit keys (or with keys that don't actually identify the underlying data), React's fallback behavior is to match elements by their index in the array. This works fine as long as the list's order and membership never change — but the moment an item is inserted at the beginning or middle, removed from the middle, or the list is reordered, index-based matching silently misattributes each position's *identity* to whatever item now happens to sit at that index, even though the actual underlying data item has moved. Concretely: if item at index 2 gets deleted, every item that used to be at index 3, 4, 5... shifts down to become index 2, 3, 4..., and React — matching purely by index — concludes that "the element at index 2" was merely *updated* with new props, not that a different underlying item now occupies that slot. Any component-local state that lived in that position (an open/closed toggle, an in-progress text input, a checked checkbox, a CSS transition/animation in flight) stays attached to the position, not the data, and so it appears to "jump" onto the wrong item after the list changes — a subtle, often confusing class of bug because the visible list *content* (text, labels) usually still looks correct at first glance, while the *state* has silently attached itself to the wrong row.

A frequently cited concrete failure mode: a list of form inputs, each with local component state for its current value, rendered with array index as key. Deleting the first item causes every subsequent input's value to shift up by one position visually — but because index-based keys mean React treats "the input at index 0" as merely updated rather than as a new/removed item, the actual typed values end up misaligned with their labels, since each input's internal DOM state (or component state) stayed pinned to its index rather than following its corresponding data item.

The correct fix is a key that is stable (doesn't change across re-renders for the same logical item) and unique (no two siblings in the same list share a key) — almost always a genuine identifier from the data itself, like a database ID (`user.id`), a UUID, or another field guaranteed unique and constant for that record — never `Math.random()` (which changes on every render, defeating the entire purpose by making React think every item is brand new on every render, forcing full remounts) and, except in the specific case of a list that is truly static and will never be reordered, filtered, or have items inserted/removed from anywhere but the end, not the array index either. With a proper stable key, React can correctly recognize "this is the same logical item as before, just possibly in a different position," update it in place, preserve its internal state, and correctly animate or transition it if it moved — versus incorrectly recognizing "the item that's now in this position is the same as whatever used to be in this position."

## Examples

```jsx
// BROKEN: index as key — inserting/removing/reordering misattributes state to the wrong row
function TodoList({ todos }) {
  return (
    <ul>
      {todos.map((todo, index) => (
        <li key={index}>
          <input type="checkbox" /> {todo.text}
          {/* Each checkbox's checked/unchecked state is tracked by React per key.
              Deleting the first todo shifts every remaining todo up one index,
              so each checkbox's PREVIOUS checked state now appears on the WRONG todo. */}
        </li>
      ))}
    </ul>
  );
}
```

```jsx
// FIXED: a stable, unique id from the data as the key
function TodoList({ todos }) {
  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>
          <input type="checkbox" /> {todo.text}
          {/* Now each <li>/checkbox is matched to its actual todo by id, regardless
              of where that todo currently sits in the array — state follows the data. */}
        </li>
      ))}
    </ul>
  );
}
```

```jsx
// Demonstrating the bug directly with per-item local state
import { useState } from 'react';

function Row({ label }) {
  const [checked, setChecked] = useState(false);
  return (
    <label>
      <input type="checkbox" checked={checked} onChange={() => setChecked((c) => !c)} />
      {label}
    </label>
  );
}

function BadList({ items }) {
  // Check the first row, then delete items[0] from the parent's state — with index keys,
  // the checkmark appears to "move" onto the new first row instead of disappearing with it,
  // because React reused the Row component instance that lived at key={0}.
  return items.map((item, i) => <Row key={i} label={item.label} />);
}

function GoodList({ items }) {
  // With stable ids, deleting items[0] correctly unmounts THAT row (and its checked state)
  // rather than reusing it for whatever item now happens to be first.
  return items.map((item) => <Row key={item.id} label={item.label} />);
}
```

## Common Pitfalls / Gotchas

- Using the array index as `key` for any list that can be reordered, filtered, or have items inserted/removed anywhere but the very end — this is the single most common `key`-related bug, and it's especially dangerous because the visible text/labels often still look correct while local state and animations quietly attach to the wrong item.
- Using `Math.random()` (or any value generated fresh on every render) as a key — this guarantees every item looks "new" to React on every single render, since the key never matches the previous render's key, forcing complete unmount/remount of every list item every time, destroying performance and any local state.
- Assuming `key` is just for React's internal bookkeeping and has no bearing on component behavior — it directly determines whether React treats a re-rendered element as "the same instance, just updated" (preserving state) or "a different instance" (fully remounting, losing state), which is very much an observable behavioral difference, not just an optimization detail.
- Putting the key on the wrong element — the `key` needs to be on the actual element returned directly from `.map()` (the outermost element of each iteration), not on some nested child inside it, or React can't use it for matching at the list level.
- Forgetting that `key` only needs to be unique among *siblings* in that specific list, not globally unique across the whole app — reusing the same id value in two unrelated lists is completely fine.

## Interview Questions & Answers

**Q: What is the purpose of the `key` prop in a list of React elements?**
A: It gives React a stable identity for each element in a list, independent of the element's position, so that during reconciliation React can correctly determine which new-render element corresponds to which previous-render element — deciding whether to update an existing instance in place (preserving its state and DOM node) or treat it as a genuinely new/removed item.

**Q: Why is using the array index as a key problematic?**
A: Index-based keys tie an element's identity to its *position*, not to the underlying data item it represents. As soon as the list's order or membership changes — an item inserted, removed, or the list reordered — every subsequent item shifts to a different index, and React (matching by index) incorrectly concludes those are the same elements merely updated with new props, rather than different logical items. This causes local component state, focused/typed input values, and in-flight CSS animations to visibly attach to the wrong row.

**Q: Give a concrete example of a bug caused by using index as key.**
A: A list of checkboxes, each with local component state tracking whether it's checked, keyed by index. If the user checks the second checkbox and then the first item in the underlying list is deleted, every item shifts up by one index — React, matching by index, treats "the checkbox now at index 0" (which used to be at index 1, and was checked) as an update to what used to occupy index 0 (which was unchecked). The checked state visually "jumps" to the wrong row instead of being removed along with the item the user actually deleted.

**Q: What makes a good key, concretely?**
A: A value that is both stable across re-renders (the same logical item always has the same key, even if its position changes) and unique among its siblings in that list — almost always a genuine identifier already present in the data, like a database primary key or a UUID assigned when the record was created. It should not be generated fresh on each render (like `Math.random()`), and should generally not be the array index unless the list is provably static and will never be reordered, filtered, or spliced anywhere but its end.

**Q: Is it ever acceptable to use array index as a key?**
A: Yes, but only for lists that are guaranteed to stay in the same order, never have items inserted or removed except possibly appended at the very end, and don't contain elements with meaningful internal state that could be affected if this assumption is ever violated later. In practice this is a narrower case than it's often assumed to be, so reaching for a genuine stable id whenever one is available is the safer default.

## Related Topics
- [virtual-dom-and-reconciliation.md](./virtual-dom-and-reconciliation.md)
- [rendering-lists-and-keys.md](./rendering-lists-and-keys.md)
- [state.md](./state.md)
- [component-lifecycle.md](./component-lifecycle.md)
- [conditional-rendering.md](./conditional-rendering.md)
