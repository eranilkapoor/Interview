# Union Types

A union type, written with `|`, describes a value that can be **one of several possible types**: `string | number` means "a string, or a number — could be either." Unions are TypeScript's primary tool for modeling values with a limited, explicit set of possible shapes, rather than reaching for the loose escape hatch of `any`. They map directly onto real JavaScript patterns — a function parameter that legitimately accepts either a `string` id or a numeric id, a variable that's `T` while loading and `null` before data arrives, or an API response that's a success shape or an error shape.

The defining rule of working with a union is that you can only safely call methods or access properties that exist on **every** member of the union — until you narrow the type down to one specific member via a type guard. For `string | number`, only members common to both (like `.toString()`) are accessible without narrowing; something string-specific like `.toUpperCase()` requires first checking `typeof value === "string"` inside an `if`, after which TypeScript "narrows" the type within that block to just `string` (see [type-guards-and-narrowing.md](./type-guards-and-narrowing.md)). This is deliberate and is exactly what makes unions safe: the compiler forces you to prove which branch you're in before letting you use branch-specific members.

Unions of object types with a shared, uniquely-valued literal property form a **discriminated union** — one of the most valuable and heavily interview-tested patterns in TypeScript, covered separately in [discriminated-unions.md](./discriminated-unions.md), because it lets the compiler narrow an entire object's type from a single property check inside a `switch`.

TypeScript computes unions structurally too: `Dog | Cat` is a union of two object shapes, and a value's usable members when accessed without narrowing are the ones common across all members. Combined with literal types, unions become the standard alternative to enums for representing a fixed, closed set of allowed values (`"pending" | "approved" | "rejected"`) with zero runtime footprint.

## Examples

```ts
// Basic union — parameter can be one of several types
function formatId(id: string | number): string {
  if (typeof id === "string") {
    return id.toUpperCase(); // narrowed to string here
  }
  return id.toFixed(0); // narrowed to number here
}
```

```ts
// Union of object shapes — only common members are accessible without narrowing
interface Dog { bark(): void; }
interface Cat { meow(): void; }
function makeSound(pet: Dog | Cat) {
  // pet.bark(); // Compile error: bark doesn't exist on Cat
  if ("bark" in pet) {
    pet.bark(); // narrowed to Dog via the `in` operator
  } else {
    pet.meow();
  }
}
```

```ts
// Literal union as a lightweight, enum-like closed set of values
type RequestState = "idle" | "loading" | "success" | "error";
function render(state: RequestState) {
  switch (state) {
    case "idle": return "Waiting to start";
    case "loading": return "Loading...";
    case "success": return "Done!";
    case "error": return "Something went wrong";
  }
}
```

## Common Pitfalls / Gotchas

- Trying to access a member that only exists on *some* members of a union without narrowing first — TypeScript only allows members common to every union member until you've proven, via a type guard, which specific member you're dealing with.
- Forgetting that unions distribute in conditional types and mapped types — this is usually desired, but can produce a wider or more complex resulting type than expected if not accounted for.
- Confusing a union type (`A | B`, "either A or B") with an intersection type (`A & B`, "both A and B at once") — they are opposites and mixing them up is one of the most common beginner errors.
- Not narrowing exhaustively — forgetting a case in a `switch` over a union leaves that branch silently unhandled; pair unions with a `never`-typed exhaustiveness check in the `default` case to catch this at compile time.

## Interview Questions & Answers

**Q: What is a union type, and what members can you access on a union value without narrowing?**
A: A union type (`A | B`) means a value could be either `A` or `B`. Without narrowing, you can only access members that exist on *every* type in the union — anything specific to just one member requires first narrowing (via `typeof`, `instanceof`, `in`, or a custom type guard) to prove which member you actually have.

**Q: What's the difference between a union type and an intersection type?**
A: A union (`A | B`) means "one or the other" — the value could satisfy either type. An intersection (`A & B`) means "both at once" — the value must satisfy every member simultaneously, combining all their properties into one required shape.

**Q: How would you model a variable that's a `User` object once loaded, but `null` before that?**
A: `type LoadableUser = User | null;` — a union with `null` explicitly included. Under `strictNullChecks`, you're then forced to check for `null` before accessing any `User`-specific property, catching "used before loaded" bugs at compile time.

**Q: Why is it useful to use a `never`-typed variable in the `default` case of a `switch` over a union?**
A: It gives you an exhaustiveness check: if every member of the union is already handled by an earlier `case`, the value remaining in `default` has narrowed to `never`, and assigning it to a `never`-typed variable compiles cleanly. If someone later adds a new member to the union without updating the switch, that assignment becomes a compile error, catching the unhandled case immediately.

## Related Topics
- [intersection-types.md](./intersection-types.md)
- [discriminated-unions.md](./discriminated-unions.md)
- [type-guards-and-narrowing.md](./type-guards-and-narrowing.md)
- [literal-types.md](./literal-types.md)
- [any-unknown-never-void.md](./any-unknown-never-void.md)
