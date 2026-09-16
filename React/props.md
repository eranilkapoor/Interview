# Props

Props (short for "properties") are how a React component receives input from whatever renders it — typically its parent component. Mechanically, when you write `<Greeting name="Anil" />`, React packages `{ name: "Anil" }` into a single object and passes it as the first (and, for function components, only) argument to the `Greeting` function. This makes a component behave conceptually like a pure function of its inputs: given the same props, a well-written component should render the same output, which is exactly what makes components easy to reason about, test, and reuse in different places with different data.

The most common way to work with props inside a component is to destructure them directly in the function's parameter list, rather than referencing a `props` object and reading off it repeatedly (`props.name`, `props.age`, etc.). Destructuring (`function Greeting({ name, age }) {...}`) is more concise, makes a component's expected inputs immediately visible at the function signature, and plays nicely with default values via standard JavaScript default-parameter syntax (`function Greeting({ name, age = 18 }) {...}`), which supplies a fallback whenever the caller omits that particular prop (or passes `undefined` for it explicitly — `null` is not treated as "missing" for this purpose).

A core rule of props is that they are read-only from the perspective of the component receiving them: a component must never reassign or mutate a prop it was given. This isn't just a style guideline — React's whole rendering model depends on data flowing in one direction, from parent to child, and if a child could silently mutate a prop object handed to it, the parent (and any other component sharing a reference to that same object) would see its own data change out from under it, unpredictably and outside of React's normal render/update cycle. If a component needs a value that changes over time in response to something happening *inside* that component, that's exactly what local state (`useState`) is for, not prop mutation — props represent an external input owned by the parent, while state represents data a component owns and manages itself (see [state.md](./state.md)).

For validating the *shape* of props a component expects, plain JavaScript React offers no built-in enforcement — props are just a regular object, and passing the wrong type (a string where a number was expected) won't error at all by default; it'll simply behave incorrectly or throw somewhere downstream when that value is used. Historically, the `prop-types` library provided runtime prop validation with development-mode console warnings for mismatched types. In modern codebases, this role is far more commonly filled by TypeScript, which validates prop shapes at compile time via a typed `props` interface/type, catching mismatches before the code ever runs rather than via runtime warnings.

## Examples

```jsx
// Basic props: passed as attributes, received as an object argument
function Greeting(props) {
  return <p>Hello, {props.name}!</p>;
}

// Usage:
// <Greeting name="Anil" />
```

```jsx
// Destructuring props directly in the parameter list, with a default value
function UserCard({ name, role = 'Member', isOnline }) {
  return (
    <div>
      <strong>{name}</strong> — {role}
      {isOnline && <span> (online)</span>}
    </div>
  );
}

// <UserCard name="Priya" isOnline /> renders "Priya — Member (online)"
// <UserCard name="Sam" role="Admin" isOnline={false} /> renders "Sam — Admin"
```

```jsx
// Props are read-only — attempting to mutate them is a bug, not a pattern
function Cart({ items }) {
  // items.push({ id: 4, name: 'Extra item' }); // WRONG — mutates the parent's array

  // If new local behavior is needed, derive or copy instead of mutating the prop:
  const itemCount = items.length; // fine — reading, not mutating
  const sortedItems = [...items].sort((a, b) => a.name.localeCompare(b.name)); // safe copy

  return (
    <ul>
      {sortedItems.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
```

## Common Pitfalls / Gotchas

- Mutating a prop directly (pushing to a prop array, reassigning a prop object's field) — this silently corrupts the parent's data outside of React's normal update flow and can cause bugs that are very hard to trace back to their source.
- Assuming a default parameter value applies to an explicitly passed `null` — default values only kick in for `undefined` (a genuinely omitted or explicitly-`undefined` prop), not for `null`, which is treated as an intentional value.
- Forgetting that passing a new object/array/function literal as a prop on every render (`<Child data={{ x: 1 }} />`) creates a new reference each time, which can defeat `React.memo`'s shallow prop comparison and cause unnecessary re-renders even though the "shape" of the data hasn't changed.
- Over-relying on prop drilling to move data down many unrelated intermediate components instead of considering composition (`children`) or Context for deeply shared data (see [passing-data-through-props.md](./passing-data-through-props.md)).
- Expecting React to validate prop types at runtime by default — plain JavaScript React does no such validation; you need `prop-types` or, far more commonly today, TypeScript for that safety net.

## Interview Questions & Answers

**Q: What are props, and how do they get passed to a component?**
A: Props are the inputs a component receives from whatever renders it, analogous to arguments to a function. When you write `<Component foo="bar" />`, React collects all the JSX attributes into a single object (`{ foo: "bar" }`) and passes that object as the argument to the component function.

**Q: Why are props considered read-only, and what happens if you mutate one anyway?**
A: React's data flow is unidirectional — data flows from parent to child via props, and a component is expected to treat what it receives as an external input it doesn't own. Mutating a prop (especially an object or array) would change the parent's actual data out from under it, bypassing React's render cycle entirely and potentially affecting other components that share a reference to that same object — leading to inconsistent, hard-to-debug UI state.

**Q: What's the difference between props and state?**
A: Props are external inputs passed down from a parent — the receiving component doesn't own or change them. State is internal data a component owns and manages itself, typically via `useState`, and changing it (via its setter) triggers that component to re-render. A common pattern is a parent holding state and passing both the value and an updater function down as props to a child.

**Q: How do you supply a default value for a prop that might not be passed?**
A: With standard JavaScript default parameter syntax during destructuring: `function Component({ size = 'medium' }) {...}`. This substitutes the default only when the prop is `undefined` (omitted entirely, or explicitly passed as `undefined`) — it does not substitute for an explicitly passed `null`.

**Q: How would you validate the shape/type of props a component expects?**
A: In a plain JavaScript codebase, the `prop-types` library lets you declare expected prop types and gives development-mode console warnings on mismatches, though it performs no compile-time checking and adds no safety in production. In modern React codebases, this is much more commonly handled by TypeScript, which type-checks props against a declared interface/type at compile time, catching mismatches before the code runs at all.

## Related Topics
- [passing-data-through-props.md](./passing-data-through-props.md)
- [children-prop.md](./children-prop.md)
- [state.md](./state.md)
- [components.md](./components.md)
- [controlled-vs-uncontrolled-components.md](./controlled-vs-uncontrolled-components.md)
