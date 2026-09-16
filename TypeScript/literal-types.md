# Literal Types

A literal type narrows a general primitive type down to one *exact* value. Where `string` means "any string at all," the literal type `"success"` means "the string `success`, and nothing else." TypeScript supports string literal types, numeric literal types, and boolean literal types (`true`/`false` as distinct types from `boolean`), and they're most powerful when combined into a union: `"success" | "error" | "loading"` describes a small, closed set of exact permitted values — effectively a lightweight, zero-runtime-cost alternative to an enum.

Literal types show up constantly without you writing them explicitly, because of how `const` inference works: `const status = "active";` infers the literal type `"active"`, not the wider `string`, precisely because a `const` binding can never be reassigned, so TypeScript can safely commit to the narrowest possible type. A `let` binding with the same initializer, `let status = "active";`, instead infers the wider `string`, since it *could* later be reassigned to any other string. This is called literal widening, and it's a frequent source of confusion when a value assigned via `let` or passed as a plain object property doesn't narrow the way you expect.

Literal types combine naturally with function overloads and discriminated unions: a function parameter typed `"left" | "right" | "center"` gives you autocomplete for exactly those three values and a compile error for any typo or invalid string, functioning much like an enum but disappearing entirely at runtime (there's no literal-type object emitted anywhere — it's pure compile-time narrowing over the underlying primitive).

To deliberately keep a literal type instead of letting it widen — for example, when building an object literal whose properties should retain their exact literal types — you reach for `as const` (see [const-assertions.md](./const-assertions.md)), which recursively locks every property to its literal type and every array to a readonly tuple.

## Examples

```ts
// String, numeric, and boolean literal types
let direction: "left" | "right";
direction = "left";  // OK
// direction = "up"; // Compile error: not assignable to "left" | "right"

type DiceRoll = 1 | 2 | 3 | 4 | 5 | 6;
let roll: DiceRoll = 4; // OK
// roll = 7; // Compile error

type Toggle = true; // a type with exactly one possible value
```

```ts
// const vs let and literal widening
const a = "active";      // type: "active" (literal — cannot change, so TS keeps it narrow)
let b = "active";        // type: string   (literal widened — could be reassigned to anything)

function setStatus(status: "active" | "inactive") { /* ... */ }
setStatus(a); // OK — "active" satisfies the union
// setStatus(b); // Compile error: `string` is not assignable to "active" | "inactive"
```

```ts
// Literal types + discriminated unions for exhaustive, type-safe APIs
type Action =
  | { type: "increment"; amount: number }
  | { type: "reset" };

function reducer(state: number, action: Action): number {
  switch (action.type) {
    case "increment": return state + action.amount; // narrowed: amount exists here
    case "reset": return 0;
  }
}
```

## Common Pitfalls / Gotchas

- Being surprised that a `let`-declared variable widens to the general primitive type while an equivalent `const` stays narrow — this is "literal widening" and is expected behavior, not a bug; use `as const` or an explicit annotation if you need a `let`/object-property value to stay literal.
- Passing an object literal with a property meant to be a narrow literal type into a function expecting that literal — plain object properties widen too (e.g. `{ status: "active" }` infers `status: string` unless the object itself is `as const` or the property is explicitly typed), so the call can unexpectedly fail to match a literal union parameter.
- Forgetting that literal types are purely a compile-time narrowing over the same underlying primitive — `"active"` is still a `string` at runtime, with no special representation or brand.
- Overusing large literal unions where a proper enum or a runtime-validated lookup would be clearer — literal unions are great for small, stable, purely compile-time sets of values, but they carry no runtime representation to check external/untyped data against.

## Interview Questions & Answers

**Q: What is a literal type, and how does it differ from the general primitive type it's based on?**
A: A literal type narrows a primitive type to one exact value — `"success"` instead of any `string`, or `42` instead of any `number`. It's most useful combined into unions (`"success" | "error"`) to model a small, closed set of valid values with compile-time-checked exhaustiveness.

**Q: Why does `const x = "hello"` infer type `"hello"`, but `let x = "hello"` infers type `string`?**
A: Because `const` bindings can never be reassigned, so TypeScript can safely commit to the narrowest possible type without risking future assignments that wouldn't fit. `let` bindings could be reassigned to any other string later, so TypeScript widens the inferred type to the general `string` to stay sound.

**Q: How would you keep an object literal's properties narrowed to their literal types instead of widening?**
A: Apply `as const` to the object literal (a const assertion) — it recursively marks every property `readonly` and infers each one at its narrowest literal type instead of the general primitive type.

**Q: How do literal types relate to discriminated unions?**
A: A discriminated union's "tag" property is typically a literal type (e.g., `type: "circle"` vs `type: "square"`), and it's precisely because each variant's tag is a distinct literal — not the general `string` — that TypeScript can narrow the whole object's type inside a `switch`/`if` based on just that one property.

## Related Topics
- [union-types.md](./union-types.md)
- [const-assertions.md](./const-assertions.md)
- [discriminated-unions.md](./discriminated-unions.md)
- [enums.md](./enums.md)
- [type-inference.md](./type-inference.md)
