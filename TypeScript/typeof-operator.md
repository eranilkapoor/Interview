# typeof Operator (Type Context)

TypeScript overloads the familiar JavaScript `typeof` operator with a second, completely distinct meaning when used in a **type position** (anywhere a type is expected, like after a colon, inside angle brackets, or on the right side of a `type` alias). In an ordinary JavaScript/TypeScript *expression* position, `typeof value` is the runtime operator you already know, returning a string like `"string"` or `"object"`. In a *type* position, `typeof someVariable` instead asks the compiler "give me the static type TypeScript has already inferred for this variable" — it extracts an existing value's type and lets you reuse it as a type annotation elsewhere, without writing that type out by hand a second time.

This is most valuable for keeping a derived type automatically in sync with a value that already fully expresses the shape you want — instead of duplicating an object literal's shape as a separate `interface`/`type` declaration (which can drift out of sync if the literal changes later), you derive the type directly from the value with `typeof`: `const config = { env: "prod", retries: 3 }; type Config = typeof config;`. It's equally common combined with `ReturnType<typeof someFunction>` to get a function's return type without a separate manual declaration, and with `Parameters<typeof someFunction>` for its parameter tuple — since `ReturnType`/`Parameters` operate on *function types*, and `typeof someFunction` is exactly how you get a function's type from the function value itself.

`typeof` in type position pairs naturally with `keyof` for deriving a union type directly from an object's keys or values at runtime, without writing that union by hand: `const roles = { admin: 1, editor: 2 } as const; type Role = keyof typeof roles;` gives `"admin" | "editor"`, staying automatically correct if `roles` is ever extended.

It's worth being precise in interviews that this is not two different features colliding by coincidence — TypeScript deliberately reuses the `typeof` keyword because the *concept* is analogous (both ask "what is this thing's type/kind"), just applied at two different phases (runtime value inspection vs. compile-time static type extraction), and the compiler always knows which meaning applies based on whether it's parsing an expression or a type.

## Examples

```ts
// typeof in type position: derive a type directly from an existing value
const point = { x: 10, y: 20 };
type Point = typeof point; // { x: number; y: number } — derived, not hand-written

function move(p: Point) { /* ... */ }
move({ x: 1, y: 2 }); // matches the derived shape
```

```ts
// typeof + ReturnType / Parameters — deriving function-related types without duplication
function createUser(name: string, age: number) {
  return { id: Date.now(), name, age };
}
type User = ReturnType<typeof createUser>;      // { id: number; name: string; age: number }
type CreateUserArgs = Parameters<typeof createUser>; // [name: string, age: number]
```

```ts
// typeof + keyof — deriving a union type from a runtime object's keys, kept in sync automatically
const roles = { admin: "ADMIN", editor: "EDITOR", viewer: "VIEWER" } as const;
type RoleKey = keyof typeof roles;      // "admin" | "editor" | "viewer"
type RoleValue = (typeof roles)[RoleKey]; // "ADMIN" | "EDITOR" | "VIEWER"

// Contrast with the runtime typeof operator, used in an ordinary expression position:
console.log(typeof roles); // "object" — the familiar JS runtime operator, a totally separate usage
```

## Common Pitfalls / Gotchas

- Confusing type-position `typeof` (compile-time type extraction) with expression-position `typeof` (runtime string-returning operator) — they share a keyword but do completely different things depending on where they're written; the compiler disambiguates by parsing context, not by any different syntax you need to remember.
- Using `typeof someValue` on a `let`-declared variable and expecting a narrow literal type — `typeof` extracts whatever type TypeScript has already inferred for that binding, so a `let`-declared value that's already widened to a general primitive type (per literal widening) stays widened; use `as const` on the source value first if you need the narrower type preserved.
- Forgetting `typeof` must reference an actual value/variable already in scope — you can't use `typeof SomeType` where `SomeType` is itself only a type (not a value/variable), since there's nothing at runtime to extract a static type *from*.
- Overusing hand-written interfaces that duplicate a config/constant object's shape instead of deriving it with `typeof` — this creates two sources of truth that can silently drift apart if one is updated without the other.

## Interview Questions & Answers

**Q: What does `typeof` mean when used in a type position versus an expression position?**
A: In an expression position (ordinary JS code), `typeof value` is the runtime operator returning a string describing the value's runtime type (`"string"`, `"object"`, etc.). In a type position (anywhere TypeScript expects a type), `typeof someVariable` instead extracts the compiler's already-inferred static type for that variable, letting you reuse it as a type elsewhere.

**Q: How would you get the return type of a function without writing a separate type declaration by hand?**
A: `type Result = ReturnType<typeof myFunction>;` — `typeof myFunction` gives the function's full type (parameters and return type together), and the built-in `ReturnType<T>` utility type extracts just the return type portion from that function type.

**Q: Why would you derive a type from a value with `typeof` instead of writing a separate `interface`/`type` by hand?**
A: To keep a single source of truth — if the original value's shape changes later, the `typeof`-derived type automatically updates to match, whereas a manually duplicated interface/type declaration can silently drift out of sync with the actual value it was meant to describe.

**Q: Can you use `typeof` on anything other than a variable, like a type name itself?**
A: No — `typeof` in type position requires an actual value/variable that exists at runtime (or at least is a real declared binding, like a function or a `const`/`let`), since it's extracting the compiler's already-computed static type for that specific binding. It can't be applied to something that's only ever a type (like an `interface` name) since there's no value there to extract a type from.

## Related Topics
- [keyof-operator.md](./keyof-operator.md)
- [type-inference.md](./type-inference.md)
- [utility-types.md](./utility-types.md)
- [const-assertions.md](./const-assertions.md)
- [enums.md](./enums.md)
