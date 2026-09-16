# Interfaces vs Type Aliases

Interfaces and type aliases overlap heavily for describing plain object shapes, which is exactly why this comparison is one of the most frequently asked TypeScript interview questions — the honest answer is "for most everyday object shapes, they're functionally interchangeable," followed by a precise list of the specific situations where they genuinely diverge. Understanding *where* they diverge, rather than reciting "interfaces are for objects, types are for everything else" as a slogan, is what separates a surface-level answer from a strong one.

The concrete differences: **(1) Declaration merging** — interfaces can be declared multiple times in the same scope and TypeScript merges all their members into one; type aliases cannot be redeclared at all (a compile error). **(2) What they can describe** — interfaces are restricted to object and function shapes; type aliases can name literally any type, including unions, tuples, primitives, mapped types, and conditional types, which interfaces cannot express. **(3) Extending** — interfaces extend other interfaces (and even compatible type aliases) via `extends`; object type aliases compose via intersection (`&`) instead, which is similar in effect but produces slightly different behavior in some edge cases (an interface `extends` an incompatible parent as an immediate error at the `extends` clause; an intersection of incompatible members instead silently collapses conflicting properties down to `never`, which surfaces as an error later, at usage). **(4) Display in tooling** — hovering over an interface in an editor shows its name; hovering over some type aliases (especially mapped/conditional ones) can show the fully expanded/computed shape, which is sometimes more useful for debugging and sometimes just noisier.

In real projects and style guides (including TypeScript's own recommendation and most popular linter configs like `@typescript-eslint`), the common convention is: use `interface` for object shapes that represent a public contract — especially ones you expect consumers to extend or augment (component props, class contracts, library-exposed shapes) — and use `type` for everything else: unions, tuples, function types, utility-type compositions, and any shape that will never need merging.

## Examples

```ts
// Both express the same object shape identically for structural-typing purposes
interface UserI { name: string; age: number }
type UserT = { name: string; age: number };

function greet(u: UserI | UserT) { console.log(u.name); }
greet({ name: "Anil", age: 30 }); // works with either declaration style — structurally identical
```

```ts
// Declaration merging: only interfaces support this
interface Window {
  myCustomGlobal: string; // merges into the built-in global Window interface
}
// type Window = { myCustomGlobal: string }; // Compile error if `Window` type alias already exists elsewhere
```

```ts
// Only a type alias can name a union, tuple, or conditional type
type Status = "pending" | "approved" | "rejected"; // interface cannot express a union at all
type Pair = [string, number];                       // interface cannot express a tuple directly
type NonNullableT<T> = T extends null | undefined ? never : T; // conditional type — type-alias only
```

## Common Pitfalls / Gotchas

- Claiming interfaces and type aliases are "totally different" — for plain object shapes they behave identically under structural typing; the real differences are narrow but important to know precisely.
- Forgetting that only interfaces support declaration merging — relying on merging behavior with a `type` alias is simply a compile error, not a silent failure.
- Trying to model a union or tuple with `interface` — it's not possible; interfaces are restricted to object/function shapes, so reach for `type` immediately for those cases.
- Assuming `extends` on an interface and `&` (intersection) on a type alias behave identically in every edge case — they usually do for compatible shapes, but conflicting overlapping properties surface differently (an immediate `extends`-clause error vs. a `never`-typed property discovered later at usage).

## Interview Questions & Answers

**Q: When would you choose `interface` over `type`, and vice versa?**
A: Choose `interface` for object/class shapes that represent a public contract you or others might need to extend or augment later (declaration merging, `extends`). Choose `type` for anything an interface can't express — unions, tuples, function types, mapped/conditional types — or for object shapes that will never need merging and benefit from type-alias-only composition.

**Q: What's the single feature interfaces have that type aliases fundamentally cannot replicate?**
A: Declaration merging — redeclaring the same interface name in the same scope automatically combines all declarations' members. Type aliases throw a "duplicate identifier" compile error if redeclared, with no merging behavior at all.

**Q: What's the single feature type aliases have that interfaces fundamentally cannot replicate?**
A: The ability to name any type expression, not just object/function shapes — unions, intersections, tuples, primitives, conditional types, and mapped types can only be given a reusable name via `type`; `interface` syntax has no way to express them.

**Q: For a simple object shape with no need for merging, does it actually matter which one you pick?**
A: Practically, no — they behave identically under TypeScript's structural type system for that case. The choice becomes a team/style-guide convention (many teams default to `interface` for objects and classes, `type` for everything else) rather than a correctness concern.

## Related Topics
- [interfaces.md](./interfaces.md)
- [type-aliases.md](./type-aliases.md)
- [union-types.md](./union-types.md)
- [structural-typing.md](./structural-typing.md)
- [module-augmentation.md](./module-augmentation.md)
