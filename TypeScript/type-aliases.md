# Type Aliases

A type alias creates a new name for any type expression using the `type` keyword: `type ID = string | number;`. Unlike an interface (which can only describe object/function shapes), a type alias can name *anything* — a primitive, a union, an intersection, a tuple, a function signature, a mapped type, a conditional type, or an object shape. This flexibility is the main reason type aliases exist alongside interfaces: for a huge portion of TypeScript's more advanced type-level features (unions, conditional types, mapped types, template literal types), a type alias is the *only* way to give the resulting type a reusable name — interfaces simply can't express them.

For plain object shapes, a type alias and an interface look and behave almost identically day to day: `type User = { name: string }` and `interface User { name: string }` both describe the same structural contract, and a value satisfying one satisfies the other, since structural typing doesn't care how a shape was declared. The meaningful differences are: type aliases cannot be reopened/merged by re-declaring them (attempting to declare `type User = {...}` twice in the same scope is a compile error, unlike an interface), and object type aliases don't support `extends` — you compose them with intersections (`type Admin = User & { permissions: string[] }`) instead, which achieves a similar end result with slightly different display/error-message behavior in the compiler.

Type aliases are also how you name generic type utilities: `type Nullable<T> = T | null;` creates a reusable generic alias, just like a generic interface would, and both syntaxes support default type parameters, constraints, and all the same generic mechanics.

As a practical rule of thumb: use an `interface` for object/class shapes that might need to be extended or augmented by others (public API surfaces, class contracts), and use a `type` alias for unions, tuples, function types, mapped/conditional types, and any type-level construct that isn't a plain object shape — see [interfaces-vs-type-aliases.md](./interfaces-vs-type-aliases.md) for the full comparison.

## Examples

```ts
// Type aliases can name absolutely any type — not just object shapes
type ID = string | number;
type Point = { x: number; y: number };
type Handler = (event: string) => void;
type Coordinates = [number, number];
```

```ts
// Generic type alias — reusable, parameterized type
type ApiResponse<T> = {
  data: T;
  error: string | null;
  loading: boolean;
};
const userResponse: ApiResponse<{ id: number; name: string }> = {
  data: { id: 1, name: "Anil" },
  error: null,
  loading: false,
};
```

```ts
// Composing object type aliases with intersections (the type-alias equivalent of `extends`)
type Person = { name: string; age: number };
type Employee = Person & { employeeId: string };

const emp: Employee = { name: "Anil", age: 30, employeeId: "E-102" };

// type User = { name: string };
// type User = { age: number }; // Compile error: Duplicate identifier 'User' — no merging like interfaces
```

## Common Pitfalls / Gotchas

- Trying to declare the same type alias name twice expecting it to merge like an interface — this is a compile error; only interfaces support declaration merging.
- Using `extends` syntax on a type alias for an object shape — plain object type aliases don't support `extends`; use an intersection (`&`) to compose them instead.
- Believing type aliases and interfaces are fundamentally different at the type level for simple object shapes — for those specific cases they're functionally equivalent; the real differences (merging, `extends`, and the ability to alias non-object types) only matter in specific scenarios.
- Overusing deeply nested, unnamed inline object types instead of extracting a type alias — this hurts readability and makes error messages harder to parse; naming reusable shapes with a `type` (or `interface`) keeps signatures legible.

## Interview Questions & Answers

**Q: What can a type alias describe that an interface cannot?**
A: Anything that isn't a plain object/function shape — unions, intersections, tuples, primitives, mapped types, conditional types, and template literal types. Interfaces are restricted to describing object and function shapes only.

**Q: Can you declare the same type alias twice in the same scope, the way you can with an interface?**
A: No — redeclaring a `type` alias with the same name in the same scope is a compile error ("Duplicate identifier"). Only interfaces support declaration merging across multiple declarations.

**Q: How do you compose two object type aliases together, since type aliases don't support `extends`?**
A: With an intersection type: `type Admin = User & { permissions: string[] }` combines every member of `User` with the additional `permissions` member, achieving a similar practical result to interface `extends`.

**Q: Are generic type aliases and generic interfaces functionally different?**
A: For plain generic object shapes, no — both support type parameters, constraints, and defaults the same way. The difference only matters once you need something a type alias uniquely supports (unions, conditional/mapped types) or something an interface uniquely supports (declaration merging).

## Related Topics
- [interfaces.md](./interfaces.md)
- [interfaces-vs-type-aliases.md](./interfaces-vs-type-aliases.md)
- [union-types.md](./union-types.md)
- [intersection-types.md](./intersection-types.md)
- [generics.md](./generics.md)
