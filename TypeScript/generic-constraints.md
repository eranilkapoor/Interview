# Generic Constraints

A generic constraint restricts what types are allowed to be substituted for a type parameter, using the `extends` keyword: `function getLength<T extends { length: number }>(item: T): number` says "`T` can be anything, as long as it has a `length: number` property." Without a constraint, TypeScript has to assume `T` could be *any* type whatsoever, which means the function body can't safely use any member on a value of type `T` — even something as common as `.length` — since not every conceivable type has one. A constraint narrows the universe of allowed types down to exactly what the function body actually needs.

Constraints commonly use an object shape (`extends { id: number }`), a union of allowed primitives (`extends string | number`), another generic type parameter (`function pluck<T, K extends keyof T>(obj: T, key: K)`, ensuring `K` can only be one of `T`'s actual property names), or a class (`extends SomeBaseClass`). The `K extends keyof T` pattern is especially common and powerful: it lets a function accept "any valid property key of this specific object," with TypeScript checking at the call site that the key you pass truly exists on that object, and correctly inferring the precise return type for that specific key.

Multiple type parameters can constrain each other (as in the `pluck` example above), and a constraint can also supply a **default** (`function wrap<T = string>(value: T)`), used when no type argument is given and none can be inferred. Constraints and defaults compose freely, and together they're how generic utility functions and generic components stay both flexible (accepting a wide variety of types) and safe (only permitting operations that are actually valid for every type that satisfies the constraint).

A subtlety experienced developers know: `extends` in a generic constraint context means "is assignable to" / "matches the shape of," the same structural relationship used everywhere else in TypeScript's type system — it does **not** imply class inheritance the way `extends` does in a `class` declaration, even though the keyword is shared.

## Examples

```ts
// Constraining T to require a `.length` property
function getLength<T extends { length: number }>(item: T): number {
  return item.length;
}
getLength("hello");      // OK — strings have .length
getLength([1, 2, 3]);    // OK — arrays have .length
// getLength(42);         // Compile error: number has no .length property
```

```ts
// K extends keyof T — restrict a key parameter to the object's actual property names
function pluck<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
const user = { id: 1, name: "Anil" };
const name = pluck(user, "name"); // inferred return type: string
// pluck(user, "email"); // Compile error: "email" is not a key of `user`
```

```ts
// Constraining to a union of primitive types, plus a default type parameter
function toArray<T extends string | number = string>(value: T): T[] {
  return [value];
}
toArray(5);          // number[]
toArray<string>("x"); // string[] — explicit type argument overrides the default
// toArray(true);     // Compile error: boolean doesn't satisfy string | number
```

## Common Pitfalls / Gotchas

- Forgetting a constraint entirely and then being confused why the function body can't call any methods on a value of type `T` — an unconstrained `T` can be any type at all, so the compiler only permits operations valid for literally every type.
- Confusing `extends` in a generic constraint (a structural "is assignable to" relationship) with `extends` in a class declaration (actual class inheritance) — they share a keyword but mean different things in these two contexts.
- Over-constraining a generic type parameter more tightly than actually needed, which unnecessarily limits what callers can pass — constrain to exactly the shape the function body requires, no more.
- Not realizing `K extends keyof T` needs `T` declared as an earlier type parameter in the same generic function/type before `K` can reference it — the parameters are evaluated in the order they're declared.

## Interview Questions & Answers

**Q: What does `<T extends SomeType>` mean in a generic function signature?**
A: It restricts `T` to only types that are assignable to (structurally compatible with) `SomeType` — the type parameter can be any type as long as it satisfies that shape/constraint, and the function body is then permitted to use any member guaranteed to exist by that constraint.

**Q: What is the `K extends keyof T` pattern used for, and can you give an example?**
A: It restricts a second type parameter `K` to only the actual property key names of another type parameter `T`, which is how a generic "get a property by key" function (like `pluck(obj, key)`) can validate at compile time that the given key genuinely exists on the object, and correctly infer the precise return type for that key via `T[K]`.

**Q: Without a constraint, why can't a generic function access any properties on a value of type `T`?**
A: Because an unconstrained `T` could be substituted with literally any type — `string`, `number`, a custom class, `null` — and the compiler only allows operations it can verify are valid for every possible substitution. Since there's no property guaranteed to exist across all types, none are accessible until a constraint narrows the possibilities.

**Q: Does `extends` mean the same thing in a generic constraint as it does in a class declaration?**
A: No — in a class declaration, `extends` means actual class inheritance (one class subclassing another). In a generic constraint, `extends` means "is assignable to" / "structurally compatible with" a given type or shape — the same relationship checked everywhere else in TypeScript's structural type system, unrelated to runtime inheritance.

## Related Topics
- [generics.md](./generics.md)
- [keyof-operator.md](./keyof-operator.md)
- [structural-typing.md](./structural-typing.md)
- [utility-types.md](./utility-types.md)
- [conditional-types.md](./conditional-types.md)
