# Passing Data Through Props

Data in a React application typically flows one direction: down the component tree, from parent to child, via props. A parent component that owns some piece of data — fetched from an API, held in state, or simply computed — hands that data to whichever child components need it by passing it as a prop, and that child can, in turn, pass some or all of it further down to its own children. This unidirectional flow is what makes it possible to reason about where a given value "comes from" in a React app: you can trace any prop's origin by walking straight up the tree, rather than hunting through arbitrary two-way bindings scattered across the codebase.

The trouble starts when data needs to travel through several layers of components to reach a deeply nested consumer, but the intermediate components in between have no actual use for that data themselves — they're just passing it along because it's the only mechanism available. This pattern is called "prop drilling," and it's a well-known maintenance pain point: every intermediate component's prop signature gets cluttered with props it doesn't use, adding a component in the middle of that chain means remembering to thread the prop through it too, and refactoring or reordering the tree risks breaking the chain of props being passed down correctly. The deeper the nesting and the more pieces of data being drilled, the worse this scales — a component five layers deep needing three unrelated pieces of shared data can turn every intermediate component's signature into unreadable plumbing.

Prop drilling isn't inherently wrong for shallow trees — passing a prop through one or two intermediate levels is often perfectly reasonable, and reaching for a heavier solution prematurely adds its own complexity. But once the drilling gets deep or widespread enough to hurt readability and maintainability, React offers a few better-suited tools. Composition — passing already-built JSX down through the `children` prop instead of raw data — sidesteps drilling entirely for cases where an intermediate component just needs to render "whatever it's given" without caring what that content actually is (see [children-prop.md](./children-prop.md)). For genuinely shared, cross-cutting data that many components at different depths need — a logged-in user, a theme, a locale — the Context API lets a component subscribe directly to a value provided higher up the tree, without every intermediate component needing to know that value exists or pass it along (see [use-context.md](./use-context.md)). For more complex, app-wide state with more elaborate update logic, a dedicated state-management library like Redux centralizes state outside the component tree entirely, letting any connected component read or dispatch updates to it directly (see [redux-store.md](./redux-store.md) and [context-api-vs-redux.md](./context-api-vs-redux.md) for how these approaches compare).

## Examples

```jsx
// Straightforward prop passing down one level — perfectly fine
function App() {
  const user = { name: 'Anil', avatarUrl: '/avatar.png' };
  return <Header user={user} />;
}

function Header({ user }) {
  return <img src={user.avatarUrl} alt={user.name} />;
}
```

```jsx
// Prop drilling: `theme` has to pass through Layout and Sidebar,
// neither of which actually uses it — they just relay it onward
function App() {
  const theme = 'dark';
  return <Layout theme={theme} />;
}

function Layout({ theme }) {
  return <Sidebar theme={theme} />; // Layout doesn't use theme itself
}

function Sidebar({ theme }) {
  return <ThemedIcon theme={theme} />; // Sidebar doesn't use theme itself either
}

function ThemedIcon({ theme }) {
  return <span className={`icon icon-${theme}`} />; // finally consumed here
}
```

```jsx
// Fixing it with Context: no intermediate component needs to know about `theme`
const ThemeContext = React.createContext('light');

function App() {
  return (
    <ThemeContext.Provider value="dark">
      <Layout />
    </ThemeContext.Provider>
  );
}

function Layout() {
  return <Sidebar />; // no theme prop needed at all
}

function Sidebar() {
  return <ThemedIcon />; // no theme prop needed at all
}

function ThemedIcon() {
  const theme = React.useContext(ThemeContext); // reads directly from the Provider
  return <span className={`icon icon-${theme}`} />;
}
```

## Common Pitfalls / Gotchas

- Reaching for Context or a global store the moment any drilling appears — one or two levels of prop passing is often simpler and easier to trace than the added indirection of Context, which hides where a value actually comes from unless you know to look for the Provider.
- Threading a prop through a component that doesn't use it and forgetting to update that pass-through when refactoring, silently breaking data flow further down the tree.
- Passing an entire object down when only one field is needed by a deeply nested child — this couples the child to the whole shape of the parent's data and hides which specific field is actually being used.
- Assuming props can flow upward (child to parent) — they can't; the standard way to let a child communicate back up is for the parent to pass a callback function down as a prop, which the child then calls (see [lifting-state-up.md](./lifting-state-up.md)).

## Interview Questions & Answers

**Q: What is "prop drilling," and why is it considered a problem?**
A: Prop drilling is passing a piece of data down through multiple layers of components via props, purely so it can reach a deeply nested component that actually needs it — even though the intermediate components don't use that data themselves. It becomes a maintenance problem because every intermediate component's signature gets cluttered with props it only relays, and restructuring the tree risks breaking that chain.

**Q: Is prop drilling always something to avoid?**
A: No — passing a prop through one or two levels is normal, simple, and easy to trace, and is often clearer than the indirection Context introduces. Prop drilling becomes worth solving specifically when it's deep or widespread enough to genuinely hurt readability and maintainability, not merely because it exists at all.

**Q: What are the main alternatives to deep prop drilling, and when would you reach for each?**
A: Composition via the `children` prop works well when an intermediate component doesn't need the data itself but just needs to render whatever content it's given. The Context API fits genuinely cross-cutting data needed by many components at varying depths (theme, locale, authenticated user). A dedicated state library like Redux fits larger applications with more complex, frequently-updated shared state and more elaborate update/derivation logic than Context alone comfortably handles.

**Q: Can data flow from a child component back up to a parent via props?**
A: Not directly — props only flow one direction, parent to child. The standard pattern for a child to communicate information upward is for the parent to define a function (often an event handler) and pass it down to the child as a prop; the child then calls that function (optionally with data as arguments), and the parent's own state updates in response, triggering a re-render with the new data flowing back down as needed.

## Related Topics
- [props.md](./props.md)
- [children-prop.md](./children-prop.md)
- [use-context.md](./use-context.md)
- [lifting-state-up.md](./lifting-state-up.md)
- [redux-store.md](./redux-store.md)
- [context-api-vs-redux.md](./context-api-vs-redux.md)
