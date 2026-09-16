# Intersection Types

An intersection type, written with `&`, combines multiple types into one that must satisfy **all** of them simultaneously: `A & B` means a value that has every member of `A` *and* every member of `B` at once. Where a union (`A | B`) narrows down which single type a value could be, an intersection widens the *requirements* on a value, merging distinct shapes into a single, combined shape — it's the type-level equivalent of "mixing in" multiple sets of properties.

Intersections are the standard way to compose object type aliases, since (unlike interfaces) type aliases don't support `extends`: `type Employee = Person & { employeeId: string }` requires an `Employee` value to have every property from `Person` plus `employeeId`. They're also used to add capability to an existing type without modifying its original declaration — extending a third-party type, combining several small, focused "mixin" shapes into one larger interface, or building up a props type in React from a base type plus additional variant-specific fields.

Intersecting two object types with genuinely conflicting property types (e.g., one requires `id: string` and the other requires `id: number`) doesn't produce a compile error at the intersection declaration itself — instead, the conflicting property's type resolves to `never` (since no value can simultaneously be both a `string` and a `number`), and the error only appears later, wherever you try to actually construct or assign a value of that type. This differs from an interface `extends` clause with an incompatible parent, which raises the error immediately at the `extends` declaration — a subtle but real difference between the two composition mechanisms worth knowing for interviews.

Intersections aren't limited to object types — you can intersect primitive types too (though `string & number` reduces to `never`, since no value can be both), and intersecting a primitive with an object-like "brand" type is exactly the mechanism used to emulate nominal typing (see [structural-typing.md](./structural-typing.md)).

## Examples

```ts
// Combining two object shapes into one required shape
type Person = { name: string; age: number };
type Employee = Person & { employeeId: string };

const emp: Employee = { name: "Anil", age: 30, employeeId: "E-1" }; // must satisfy BOTH shapes
```

```ts
// Mixin-style composition — building a larger shape from small, focused pieces
type Timestamped = { createdAt: Date; updatedAt: Date };
type Named = { name: string };
type Auditable = { createdBy: string };

type Record_ = Timestamped & Named & Auditable;
const rec: Record_ = {
  name: "Invoice #1",
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: "system",
};
```

```ts
// Conflicting properties resolve to `never`, discovered at usage, not declaration
type A = { id: string };
type B = { id: number };
type AB = A & B; // AB.id has type `string & number`, which collapses to `never`

// const value: AB = { id: "x" }; // Compile error — `never` accepts no assignable value at all
```

## Common Pitfalls / Gotchas

- Confusing intersections with unions — `A & B` requires satisfying *both* shapes at once (more restrictive, combined requirements), while `A | B` means satisfying *either one* (a choice between shapes); this mix-up is a very common beginner mistake.
- Not noticing a conflicting-property intersection until much later — the intersection type itself compiles fine even when a shared property has incompatible types across the two sides; the error only surfaces when you actually try to use/construct a value of that type, since the property silently becomes `never`.
- Intersecting two primitive types expecting a meaningful result — `string & number` is `never` (no value can be both), which is only useful deliberately, as with branded types, not by accident.
- Overusing large intersection chains for what's really meant to be inheritance — for object/class hierarchies meant to be `extends`-composed and possibly re-augmented later, an interface hierarchy is often clearer than a long intersection chain.

## Interview Questions & Answers

**Q: What does an intersection type (`A & B`) mean, and how is it different from a union (`A | B`)?**
A: An intersection requires a value to satisfy *both* `A` and `B` simultaneously — all members of both combined into one required shape. A union requires a value to satisfy just *one* of `A` or `B`. They express opposite ideas: "and" versus "or."

**Q: Since type aliases don't support `extends`, how do you compose them the way you'd extend an interface?**
A: Via intersection: `type Admin = User & { permissions: string[] }` requires every property of `User` plus the additional `permissions` property — achieving a similar practical outcome to interface `extends`, though with slightly different error behavior on conflicts.

**Q: What happens if you intersect two types that both declare the same property with incompatible types?**
A: The intersected property's type collapses to `never` (since no value can simultaneously satisfy both incompatible types), but this doesn't raise an error at the intersection's own declaration — it only surfaces later, when you actually try to construct or assign a value that would need a real value for that now-`never` property.

**Q: Can you intersect two primitive types like `string` and `number`? What would the result be?**
A: Syntactically yes, but the resulting type is `never`, since no runtime value can be both a string and a number at once. Intersecting a primitive with an object type (rather than another primitive) is more common in practice — e.g., for branded/nominal-typing patterns.

## Related Topics
- [union-types.md](./union-types.md)
- [type-aliases.md](./type-aliases.md)
- [interfaces.md](./interfaces.md)
- [structural-typing.md](./structural-typing.md)
- [any-unknown-never-void.md](./any-unknown-never-void.md)
