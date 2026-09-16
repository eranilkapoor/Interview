# Generics with React

React components, hooks, and utilities lean heavily on generics because a huge amount of React's API surface is intentionally shape-agnostic — a `useState` hook doesn't know in advance what type of state you'll store, a list component doesn't know what type of item it will render, and a context doesn't know what value it will hold. Generics let these APIs stay fully type-safe *per usage* without React's own type definitions needing a separate declaration for every possible state/prop shape a consuming application might use.

`useState<T>` is the most common entry point: `useState<number>(0)` types both the returned value and its setter function as `number`, and `useState(0)` (without an explicit type argument) works identically via inference from the initial value. This matters most when the initial value doesn't fully convey the eventual type — e.g., `useState<User | null>(null)` is necessary because inferring purely from `null` would type the state as `null` forever, unable to ever hold a real `User` later; the explicit type argument widens it correctly upfront.

Generic function components let you write a single reusable component whose prop types (and therefore its rendering logic) adapt to whatever item type is passed in — a `<List<T>>` component that takes `items: T[]` and a `renderItem: (item: T) => ReactNode` prop stays fully type-checked for whatever concrete item type each usage passes, without needing a separate list component per data shape. `useRef<T>`, `useContext<T>`, `useReducer<S, A>`, and `forwardRef<Ref, Props>` all follow the same pattern — a generic hook/utility parameterized by the specific value/ref/state shape relevant to that call site.

A common friction point: generic *arrow function* components in `.tsx` files can be ambiguous with JSX syntax (`<T>(props: Props<T>) => ...` looks like it opens a JSX tag), so a trailing comma (`<T,>`) or an explicit `extends unknown` constraint (`<T extends unknown>`) is used as a disambiguation workaround, or the component is written as a regular named `function` declaration instead, which doesn't have this ambiguity.

## Examples

```tsx
// useState with an explicit type argument, needed because the initial value alone
// (null) wouldn't correctly widen the state's eventual type
import { useState } from "react";

interface User { id: number; name: string; }

function Profile() {
  const [user, setUser] = useState<User | null>(null);
  // setUser({ id: 1, name: "Anil" }); // valid later, once data loads
  return user ? <p>{user.name}</p> : <p>Loading...</p>;
}
```

```tsx
// A generic function component reusable across any item type
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}
function List<T>({ items, renderItem }: ListProps<T>) {
  return <ul>{items.map((item, i) => <li key={i}>{renderItem(item)}</li>)}</ul>;
}

// Usage — T is inferred per call site, fully type-checked each time
<List items={["a", "b"]} renderItem={(s) => s.toUpperCase()} />;
<List items={[{ id: 1, name: "Anil" }]} renderItem={(u) => u.name} />;
```

```tsx
// A generic arrow-function component, disambiguated from JSX with a trailing comma
const Box = <T,>({ value }: { value: T }) => <div>{JSON.stringify(value)}</div>;

// useReducer with generic state and action types
type State = { count: number };
type Action = { type: "increment" } | { type: "reset" };
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "increment": return { count: state.count + 1 };
    case "reset": return { count: 0 };
  }
}
// const [state, dispatch] = useReducer(reducer, { count: 0 }); // State, Action inferred from `reducer`
```

## Common Pitfalls / Gotchas

- Omitting the type argument on `useState` when the initial value doesn't fully represent the eventual type (e.g., `useState(null)` for state that will later hold an object) — this locks the state's type to just `null` forever; supply it explicitly, e.g. `useState<User | null>(null)`.
- Writing a generic arrow-function component in a `.tsx` file without disambiguating the type parameter from JSX (`<T>(props) => ...`) — the parser can misread it as an opening JSX tag; use a trailing comma (`<T,>`) or switch to a named `function` component.
- Losing type inference across a generic component boundary by over-annotating props with a wider type than needed (e.g., typing `items: unknown[]` instead of `items: T[]`) — this defeats the purpose of the generic and forces consumers to re-narrow inside `renderItem`.
- Forgetting that `forwardRef` requires explicit generic type arguments (`forwardRef<HTMLButtonElement, Props>`) since TypeScript can't reliably infer them from `forwardRef`'s own call signature the way it can for most other generic calls.

## Interview Questions & Answers

**Q: Why would you explicitly write `useState<User | null>(null)` instead of letting TypeScript infer the type from `null`?**
A: Because inferring purely from an initial value of `null` would type the state as `null` permanently — there'd be no way to later set it to an actual `User` without a type error. The explicit type argument tells TypeScript upfront that the state's true type is the wider union, even though its initial value is just one member of that union.

**Q: How would you write a single reusable list component that stays type-safe for any item type?**
A: As a generic function component: `function List<T>({ items, renderItem }: { items: T[]; renderItem: (item: T) => ReactNode }) { ... }`. Each usage infers its own `T` from the `items` array passed in, so `renderItem` is fully type-checked against the actual item shape at every call site.

**Q: Why can generic arrow-function components be problematic in `.tsx` files, and how do you work around it?**
A: The TypeScript/JSX parser can interpret `<T>(props) => ...` as the start of a JSX element rather than a generic type parameter list, causing a parse error. Common workarounds are adding a trailing comma (`<T,>(props) => ...`) to disambiguate it, adding a constraint (`<T extends unknown>`), or simply using a named `function` component instead, which has no such ambiguity.

**Q: Does `useReducer` require you to manually specify its generic state and action types?**
A: Usually not — TypeScript infers both the state type and the action type from the reducer function you pass in, since the reducer's own parameter and return types already fully describe them. Explicit generic type arguments are typically only needed for more unusual or ambiguous reducer signatures.

## Related Topics
- [generics.md](./generics.md)
- [generic-constraints.md](./generic-constraints.md)
- [discriminated-unions.md](./discriminated-unions.md)
- [type-inference.md](./type-inference.md)
- [interfaces.md](./interfaces.md)
