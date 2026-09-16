# Fragments

Every React component must return a single root value from its render logic — this comes directly from the fact that JSX compiles to a single function call/expression, and a JavaScript function can only return one value. But UI often naturally consists of sibling elements that don't need (or shouldn't have) a shared wrapper: a component that renders a table row's `<td>` cells, or a list of items that should sit directly under a parent `<ul>`, has no semantically meaningful wrapper element to put around its output. Wrapping such content in an extra `<div>` just to satisfy the "one root" rule pollutes the actual DOM output — it can break CSS that relies on direct-child selectors, break semantic HTML structure (an extra `<div>` between a `<table>` and its `<tr>` is invalid HTML), and adds nodes with no real purpose.

Fragments solve exactly this problem: `<React.Fragment>...</React.Fragment>`, or its shorthand `<>...</>`, lets a component group multiple children under one syntactic JSX root without introducing any actual extra node into the rendered DOM tree. As far as the browser is concerned, a Fragment renders nothing — its children are inserted directly where the Fragment itself would have been, with no wrapping element left behind. This makes Fragments the standard fix whenever you find yourself adding a `<div>` (or `<>`) purely to satisfy React's single-root-return rule rather than because the design actually calls for a wrapper element there.

The shorthand `<>...</>` syntax is convenient but has one limitation: it cannot accept any props, including the special `key` prop. When rendering a list of Fragments — for instance, mapping over data where each item needs to render multiple sibling elements without a wrapper, and each of those groups needs a stable `key` for React's reconciliation — you must fall back to the explicit `<React.Fragment key={...}>` form, since the shorthand syntax has no way to attach that key.

## Examples

```jsx
// Without a Fragment, this component would need an unnecessary wrapper <div>
function UserInfo({ name, email }) {
  return (
    <>
      <dt>{name}</dt>
      <dd>{email}</dd>
    </>
  );
}

// Used inside a <dl>, the output slots in cleanly with no extra wrapping element
function UserList({ users }) {
  return (
    <dl>
      {users.map((u) => (
        <UserInfo key={u.id} name={u.name} email={u.email} />
      ))}
    </dl>
  );
}
```

```jsx
// Keyed fragments: needed when a list item itself must render multiple
// sibling elements — the shorthand <>...</> can't take a key, so use the full form
function Glossary({ terms }) {
  return (
    <dl>
      {terms.map((term) => (
        <React.Fragment key={term.id}>
          <dt>{term.word}</dt>
          <dd>{term.definition}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
```

```jsx
// Fragments avoid breaking CSS/HTML semantics that rely on direct children,
// e.g. a table row that must directly contain <td> elements
function TableRowCells({ data }) {
  return (
    <>
      <td>{data.name}</td>
      <td>{data.value}</td>
    </>
  );
}

function Row({ item }) {
  return (
    <tr>
      <TableRowCells data={item} /> {/* no invalid <div> between <tr> and <td> */}
    </tr>
  );
}
```

## Common Pitfalls / Gotchas

- Using `<>...</>` when a `key` is needed (e.g., rendering a list of grouped siblings) — the shorthand doesn't support props at all, so you must use `<React.Fragment key={...}>` explicitly instead.
- Reaching for a wrapper `<div>` out of habit to satisfy the "single root" rule, when a Fragment would avoid injecting a meaningless node into the DOM — especially risky around CSS Flexbox/Grid layouts or table markup, where an unexpected extra `<div>` can silently break layout.
- Forgetting that a Fragment renders no DOM node at all — you cannot attach a `ref`, `className`, `style`, or any styling/behavior directly to a Fragment (aside from `key`) because there's no actual element in the DOM to attach it to.
- Assuming Fragments are only relevant for JSX single-root rules — they're also useful any time you conditionally return either one element or several without wanting the shape of the wrapper to change.

## Interview Questions & Answers

**Q: Why do components need Fragments at all — why can't a component just return multiple sibling elements directly?**
A: Because a component's return value is a single JSX expression, which compiles to a single function call — JavaScript functions can only return one value. Fragments provide a way to group several sibling elements into that one required return value without introducing a real wrapper DOM node.

**Q: What's the difference between `<>...</>` and `<React.Fragment>...</React.Fragment>`?**
A: They're functionally the same — the shorthand compiles to the same Fragment type — except the shorthand cannot accept any props. If you need to pass a `key` (the only prop Fragments commonly need, typically when rendering a list of Fragments), you must use the explicit `<React.Fragment key={...}>` form.

**Q: When would using a Fragment matter for correctness, not just cleanliness?**
A: Whenever an extra wrapper element would break something depending on the DOM structure being exactly right — e.g., CSS Grid/Flexbox rules that target direct children, or valid table markup where only `<tr>`/`<td>`/`<th>` are allowed as direct children of certain table elements. An unnecessary `<div>` in either of those contexts can silently break layout or produce invalid HTML.

**Q: If you're mapping over an array and each item needs to render two sibling elements without a wrapper, how do you keep React's reconciliation working correctly?**
A: Use the explicit `<React.Fragment key={item.id}>` form (not the `<>` shorthand) around each item's sibling elements, giving each Fragment a stable, unique `key` exactly as you would for any other list item — this preserves React's ability to correctly match items across re-renders.

## Related Topics
- [jsx.md](./jsx.md)
- [components.md](./components.md)
- [rendering-lists-and-keys.md](./rendering-lists-and-keys.md)
- [keys-and-reconciliation.md](./keys-and-reconciliation.md)
- [conditional-rendering.md](./conditional-rendering.md)
