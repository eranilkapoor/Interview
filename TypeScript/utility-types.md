# Utility Types

TypeScript ships a standard library of generic **utility types** that transform an existing type into a new, related one, covering common shape-manipulation needs so you don't have to hand-write the same mapped/conditional type logic repeatedly across a codebase. They're ordinary generic types defined using the same mapped-type and conditional-type mechanisms covered in [mapped-types.md](./mapped-types.md) and [conditional-types.md](./conditional-types.md) — there's no special compiler magic; you could write every one of them yourself, and knowing their actual definitions (not just their behavior) is exactly what separates a surface-level answer from a strong one in interviews.

The most commonly used ones: **`Partial<T>`** makes every property of `T` optional (`{ [K in keyof T]?: T[K] }`) — useful for "patch"-style update objects. **`Required<T>`** does the opposite, stripping optionality from every property (`{ [K in keyof T]-?: T[K] }`). **`Readonly<T>`** marks every property `readonly` (`{ readonly [K in keyof T]: T[K] }`). **`Pick<T, K>`** selects a subset of `T`'s properties by key (`{ [P in K]: T[P] }` where `K extends keyof T`). **`Omit<T, K>`** is the inverse — everything *except* the given keys (implemented as `Pick<T, Exclude<keyof T, K>>`, combining `Pick` with the set-difference conditional type `Exclude`). **`Record<K, V>`** builds an object type with keys from `K` all mapped to value type `V` (`{ [P in K]: V }`) — the standard way to type dictionaries with a known, finite key set.

The **function/value-introspection** utilities work on function and constructor types specifically: **`ReturnType<T>`** extracts a function type's return type via `infer` (`T extends (...args: any[]) => infer R ? R : never`); **`Parameters<T>`** extracts its parameter list as a tuple (`T extends (...args: infer P) => any ? P : never`); **`ConstructorParameters<T>`** and **`InstanceType<T>`** do the analogous extraction for class constructor types. The **union-manipulation** utilities **`Exclude<T, U>`** and **`Extract<T, U>`** use distributive conditional types to compute a set-difference or set-intersection over a union, respectively, and **`NonNullable<T>`** is really just `Exclude<T, null | undefined>` under the hood.

Reaching for the right built-in utility type instead of hand-rolling an equivalent mapped/conditional type keeps code shorter and more idiomatic, but understanding *how each one is actually implemented* is what lets you confidently compose new, custom utility types when the built-in library doesn't have exactly what a situation calls for — which happens often enough in real, non-trivial TypeScript codebases.

## Examples

```ts
// Object-shape utility types
interface User { id: number; name: string; email: string; }

type UserPatch = Partial<User>;            // { id?: number; name?: string; email?: string }
type ReadonlyUser = Readonly<User>;         // { readonly id: number; readonly name: string; ... }
type UserPreview = Pick<User, "id" | "name">; // { id: number; name: string }
type UserWithoutEmail = Omit<User, "email">;  // { id: number; name: string }
type RolesMap = Record<"admin" | "editor", boolean>; // { admin: boolean; editor: boolean }
```

```ts
// Function-introspection utility types
function createUser(name: string, age: number): User {
  return { id: Date.now(), name, email: "" };
}
type CreateUserReturn = ReturnType<typeof createUser>;   // User
type CreateUserArgs = Parameters<typeof createUser>;     // [name: string, age: number]

class Repo { constructor(public dbUrl: string) {} }
type RepoCtorArgs = ConstructorParameters<typeof Repo>; // [dbUrl: string]
type RepoInstance = InstanceType<typeof Repo>;           // Repo
```

```ts
// Union-manipulation utility types
type Status = "idle" | "loading" | "success" | "error" | null | undefined;
type ActiveStatus = Exclude<Status, "idle" | null | undefined>; // "loading" | "success" | "error"
type ErrorStatus = Extract<Status, "error" | "success">;         // "error" | "success"
type DefiniteStatus = NonNullable<Status>;                        // "idle" | "loading" | "success" | "error"
```

## Common Pitfalls / Gotchas

- Forgetting that `Partial<T>`, `Required<T>`, and `Readonly<T>` are all shallow — they only transform `T`'s top-level properties, not the properties of any nested object types within it.
- Passing a key to `Pick<T, K>` or `Omit<T, K>` that doesn't actually exist on `T` — TypeScript's built-in `Pick` constrains `K extends keyof T`, so an invalid key is a compile error; `Omit`, however, is defined more loosely (its `K` parameter isn't constrained to `keyof T`) specifically so it can remove keys from a union of object types even when a given key isn't present on every member — a subtle, easy-to-forget asymmetry between the two.
- Using `Record<string, V>` when a small, specific, finite set of literal keys was actually intended — this silently accepts any string key at all, losing the compile-time typo protection a literal-union key type (`Record<"a" | "b", V>`) would have given.
- Reaching for `ReturnType<myFunction>` (passing the function value directly) instead of `ReturnType<typeof myFunction>` — `ReturnType` operates on a function *type*, not a function *value*, so `typeof` is required to convert the value into its type first.

## Interview Questions & Answers

**Q: How is `Partial<T>` actually implemented, and can you describe it as a mapped type?**
A: `type Partial<T> = { [K in keyof T]?: T[K] };` — it iterates over every key of `T` and adds the `?` optional modifier to each property's value type, leaving the value types themselves unchanged.

**Q: How does `Omit<T, K>` work internally, and how does it relate to `Pick` and `Exclude`?**
A: `Omit<T, K>` is defined as `Pick<T, Exclude<keyof T, K>>` — it first computes the set of `T`'s keys minus the keys in `K` (via the distributive conditional type `Exclude`), then uses `Pick` to build an object type containing only those remaining keys.

**Q: What's the difference between `Exclude<T, U>` and `Extract<T, U>`?**
A: Both are distributive conditional types operating over a union `T`. `Exclude<T, U>` keeps the members of `T` that do *not* match `U` (a set difference). `Extract<T, U>` keeps only the members of `T` that *do* match `U` (a set intersection) — they're complementary operations over the same union.

**Q: Why does `ReturnType<T>` require `typeof` when applied to a function value, like `ReturnType<typeof myFunc>`?**
A: Because `ReturnType<T>` is a generic type that operates on a function *type*, and `myFunc` on its own (without `typeof`) is a value, not a type — you can't pass a value directly as a type argument. `typeof myFunc` converts the value into its corresponding static function type, which `ReturnType` can then extract the return type from via `infer`.

## Related Topics
- [mapped-types.md](./mapped-types.md)
- [conditional-types.md](./conditional-types.md)
- [keyof-operator.md](./keyof-operator.md)
- [typeof-operator.md](./typeof-operator.md)
- [generics.md](./generics.md)
