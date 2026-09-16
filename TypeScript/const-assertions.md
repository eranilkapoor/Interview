# Const Assertions (`as const`)

`as const` is a special type assertion that tells TypeScript to infer the **narrowest possible, immutable** type for an expression, instead of the normal widened type it would otherwise infer. Applied to a string, number, or boolean literal, it locks in the literal type rather than the general primitive (`"active" as const` is type `"active"`, not `string`). Applied to an array literal, it infers a `readonly` tuple with each element at its literal type, instead of a mutable, widened array type. Applied to an object literal, it recursively marks every property `readonly` and infers each property's value at its narrowest literal type, all the way down through nested objects and arrays.

This matters because of literal widening: by default, TypeScript deliberately widens literal types in most contexts (a `let` variable, an object property, an array element) because it assumes you might reassign or mutate them later, and a wide type is more useful for that. `as const` overrides this assumption, telling the compiler "I don't intend to mutate this — keep the exact literal values and lock them as `readonly`." This is precisely what makes `as const` the standard mechanism for deriving a union type from a list of literal values, and for getting `useState`-style tuple returns to type correctly.

A very common modern pattern combines `as const` with `keyof typeof` or indexed access types to derive a union type directly from a runtime object's keys or values, entirely replacing the need for an `enum` in many cases — you get one runtime array/object serving as the single source of truth, and its matching type is *derived* from it rather than duplicated by hand.

It's worth being precise that `as const` doesn't provide any runtime immutability guarantee beyond what a normal `readonly` type annotation gives — like all TypeScript types, it's fully erased at compile time. `Object.freeze()` is the runtime equivalent if you also need actual runtime immutability enforcement; the two are often used together (`Object.freeze({...} as const)`).

## Examples

```ts
// Literal widening vs as const
let a = "hello";          // type: string
let b = "hello" as const; // type: "hello"

const arr = [1, 2, 3];           // type: number[] (mutable array)
const tuple = [1, 2, 3] as const; // type: readonly [1, 2, 3] (immutable tuple of exact literals)
```

```ts
// Deriving a union type from a const array — a common enum alternative
const roles = ["admin", "editor", "viewer"] as const;
type Role = (typeof roles)[number]; // "admin" | "editor" | "viewer"

function setRole(role: Role) { /* ... */ }
setRole("admin"); // OK
// setRole("owner"); // Compile error: not one of the derived literal union members
```

```ts
// as const on an object — recursively readonly, every property narrowed to its literal type
const config = {
  env: "production",
  retries: 3,
  featureFlags: { darkMode: true },
} as const;

// config.env = "staging"; // Compile error: readonly property
type Config = typeof config;
// { readonly env: "production"; readonly retries: 3; readonly featureFlags: { readonly darkMode: true } }
```

## Common Pitfalls / Gotchas

- Forgetting `as const` only affects the *type* the compiler infers — it does not freeze the object at runtime; use `Object.freeze()` alongside it if you need actual runtime immutability, not just compile-time protection.
- Applying `as const` and then trying to mutate the value anyway with a type assertion or by casting away `readonly` — this defeats the entire purpose and can hide real bugs.
- Not realizing `as const` on an object recursively narrows *every* nested literal, which can sometimes be too aggressive — e.g., a numeric config value you actually intend to vary might get locked to one specific literal number unexpectedly if you didn't want that.
- Confusing `as const` with the `const` keyword — `const x = ...` is a JavaScript-level guarantee about *variable reassignment* only; `as const` is a TypeScript-level type assertion about *value shape/literal-ness*, and they solve related but distinct problems (you can have `let x = "a" as const;`, though it's unusual).

## Interview Questions & Answers

**Q: What does `as const` do, and how does it differ from a normal `const` declaration?**
A: `const` (the JavaScript keyword) only prevents reassigning the *variable binding* — the value itself can still be mutated. `as const` (a TypeScript-only construct) is a type assertion that tells the compiler to infer the narrowest possible literal type for the expression and mark object/array structures `readonly` — it's about the inferred *type*, not runtime enforcement.

**Q: How would you derive a union type from an array of allowed string values without duplicating them in a separate type declaration?**
A: Declare the array with `as const` (e.g. `const roles = ["admin", "editor"] as const;`), then derive the union via indexed access on the array's type: `type Role = (typeof roles)[number];`. This keeps one runtime source of truth and one derived type, instead of maintaining a literal union and an array in sync by hand.

**Q: Does `as const` provide any runtime immutability?**
A: No — like all TypeScript type-level constructs, it's completely erased at compile time. If you need actual runtime immutability (e.g., to prevent mutation via a bug or a malicious caller), pair it with `Object.freeze()`, which is a real JavaScript runtime mechanism.

**Q: What type does `as const` infer for an array literal, and how does that differ from the default inference?**
A: By default, an array literal like `[1, 2, 3]` infers as the mutable, widened `number[]`. With `as const`, it infers as `readonly [1, 2, 3]` — a fixed-length, immutable tuple where each position keeps its exact literal type rather than being widened to `number`.

## Related Topics
- [literal-types.md](./literal-types.md)
- [readonly-properties.md](./readonly-properties.md)
- [arrays-and-tuples.md](./arrays-and-tuples.md)
- [enums.md](./enums.md)
- [type-inference.md](./type-inference.md)
