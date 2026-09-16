# Conditional Types

A conditional type expresses type-level branching logic using syntax that mirrors a JavaScript ternary: `T extends U ? X : Y` — "if type `T` is assignable to type `U`, resolve to type `X`; otherwise, resolve to type `Y`." Unlike a runtime `if`/ternary, this check happens entirely at compile time, over types rather than values, and is TypeScript's core mechanism for expressing "the resulting type depends on what type was passed in" — exactly what powers utility types like `NonNullable<T>`, `Exclude<T, U>`, and `ReturnType<T>` internally.

Conditional types become dramatically more powerful combined with the `infer` keyword, which lets you introduce a new type variable *inside* the `extends` clause, bound to whatever type is matched at that position — this is how you pattern-match into a larger type structure and pull a piece out of it. `type ElementType<T> = T extends (infer U)[] ? U : never;` says "if `T` is an array of something, extract that 'something' as `U` and return it; otherwise, return `never`." This same pattern (`extends (...args: any[]) => infer R ? R : never`) is literally how the built-in `ReturnType<T>` utility type is implemented.

When a conditional type's checked type (`T`) is itself a **union**, and `T` is a *naked* type parameter (used directly, not wrapped in something else like `T[]`), the conditional **distributes** over each union member individually and combines the results back into a union — this is called a distributive conditional type. `Exclude<T, U>`, defined as `T extends U ? never : T`, relies entirely on this distributive behavior: applied to a union, it checks each member separately, keeps the ones that don't match `U` (mapping the excluded ones to `never`, which then vanishes from the resulting union), producing exactly "the union minus whatever matches `U`." Wrapping `T` in something (`[T] extends [U] ? ... : ...`) deliberately suppresses this distribution when you specifically need to check the whole union as one unit instead.

Conditional types can also be chained, effectively giving type-level `switch`/`else-if` behavior, and combined with mapped types (see [mapped-types.md](./mapped-types.md)) to selectively transform only some properties of an object type based on a per-property condition — this combination is the foundation of most "advanced" real-world utility types found in mature TypeScript codebases and libraries.

## Examples

```ts
// Basic conditional type
type IsString<T> = T extends string ? true : false;
type A = IsString<"hello">; // true
type B = IsString<42>;      // false
```

```ts
// `infer` to extract a piece of a matched type structure
type ElementType<T> = T extends (infer U)[] ? U : never;
type Item = ElementType<string[]>; // string
type NotArray = ElementType<number>; // never — number doesn't match the array pattern

// This is literally how the built-in ReturnType<T> works internally:
type MyReturnType<T> = T extends (...args: any[]) => infer R ? R : never;
function getUser() { return { id: 1 }; }
type User = MyReturnType<typeof getUser>; // { id: number }
```

```ts
// Distributive conditional types — how Exclude<T, U> really works
type MyExclude<T, U> = T extends U ? never : T;
type Status = "idle" | "loading" | "success" | "error";
type ActiveStatus = MyExclude<Status, "idle" | "error">; // "loading" | "success"
// Distribution: each member of Status is checked individually against "idle" | "error",
// matching members resolve to `never` and vanish from the resulting union.
```

## Common Pitfalls / Gotchas

- Expecting a conditional type over a union to check the whole union "as one thing" by default — a naked type parameter in a conditional type distributes automatically, checking each union member separately; wrap it in a tuple (`[T] extends [U] ? ... : ...`) if you specifically need non-distributive, whole-union behavior instead.
- Forgetting `infer` can only be used inside the `extends` clause of a conditional type — it's not a standalone keyword usable elsewhere; it exists specifically to bind a type variable during that pattern-match.
- Writing deeply nested/chained conditional types without breaking them into smaller, named intermediate type aliases — this quickly becomes unreadable and produces hard-to-parse compiler error messages when something doesn't match.
- Assuming a conditional type check (`T extends U`) behaves like a runtime `instanceof`/equality check — it's actually an "is assignable to" (structural subtype) check, the same relationship used throughout TypeScript's type system, not a strict equality test.

## Interview Questions & Answers

**Q: What is a conditional type, and what does `T extends U ? X : Y` mean?**
A: It's type-level branching: if type `T` is assignable to (a subtype of) type `U`, the conditional type resolves to `X`; otherwise it resolves to `Y`. It's the mechanism behind many built-in utility types, like `NonNullable<T>` and `Exclude<T, U>`, whose resulting type genuinely depends on what type was passed in.

**Q: What does the `infer` keyword do inside a conditional type, and can you give an example?**
A: It introduces a new type variable bound to whatever type is matched at that specific position within the `extends` clause's pattern, letting you extract a piece of a larger type structure. Example: `T extends (infer U)[] ? U : never` extracts the element type `U` out of an array type `T`, resolving to `never` if `T` isn't an array at all.

**Q: What is a distributive conditional type, and why does it matter for something like `Exclude<T, U>`?**
A: When a conditional type's checked type is a *naked* type parameter and you pass it a union, the conditional automatically applies separately to each union member and combines the results back into a union, rather than treating the whole union as one unit. `Exclude<T, U>` (defined as `T extends U ? never : T`) relies on exactly this — applied to a union, each member is checked individually, and members matching `U` become `never` and disappear from the resulting union, leaving only the non-matching members.

**Q: How would you suppress distribution if you needed a conditional type to treat a union as one single unit instead?**
A: Wrap both sides of the `extends` check in a tuple: `[T] extends [U] ? X : Y`. Wrapping the naked type parameter prevents TypeScript from distributing over each union member individually, forcing a single, whole-union comparison instead.

## Related Topics
- [mapped-types.md](./mapped-types.md)
- [utility-types.md](./utility-types.md)
- [type-inference.md](./type-inference.md)
- [union-types.md](./union-types.md)
- [generic-constraints.md](./generic-constraints.md)
