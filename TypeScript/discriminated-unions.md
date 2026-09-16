# Discriminated Unions

A discriminated union (also called a "tagged union" or "algebraic data type") is a union of object types that all share one common property — the **discriminant** or **tag** — where each member gives that property a distinct literal type value. For example: `{ status: "loading" } | { status: "success"; data: string } | { status: "error"; error: string }` — the `status` property is the discriminant, and its literal value (`"loading"`, `"success"`, or `"error"`) uniquely identifies which shape you're dealing with.

The payoff is automatic, precise narrowing: once you check the discriminant property (typically in an `if` or `switch`), TypeScript narrows the *entire object's* type to just the matching union member — including every other property specific to that branch — without needing separate `in`/`typeof`/`instanceof` checks on each individual field. Checking `if (result.status === "success")` doesn't just tell TypeScript that `status` equals `"success"`; it tells TypeScript the whole `result` object is now the `{ status: "success"; data: string }` variant, so `result.data` becomes safely accessible within that branch, and `result.error` correctly becomes inaccessible (a compile error, since that property doesn't exist on the narrowed variant).

This pattern directly models real-world states that JavaScript itself has no native way of enforcing — an async request that's loading, succeeded, or failed; a shape that's a circle, square, or triangle, each with different measurement properties; a Redux-style action with a `type` field and payload that varies per action. Discriminated unions replace error-prone patterns like a single object with many optional properties (where nothing stops you from accidentally reading a property that doesn't apply to the current state) with a structure the compiler actively enforces.

Discriminated unions pair naturally with exhaustiveness checking: handling every possible discriminant value in a `switch`, with a `default` branch that assigns the (by-then-narrowed-to-`never`) remaining value to a `never`-typed variable — if a new variant is ever added to the union later without updating every relevant switch, that assignment becomes an immediate compile error, rather than a variant silently falling through unhandled.

## Examples

```ts
// The canonical async-state discriminated union
type RequestState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: string };

function render(state: RequestState<string>): string {
  switch (state.status) {
    case "idle": return "Not started";
    case "loading": return "Loading...";
    case "success": return `Data: ${state.data}`;   // `data` only exists here — safely narrowed
    case "error": return `Error: ${state.error}`;     // `error` only exists here — safely narrowed
  }
}
```

```ts
// Shape hierarchy with per-variant measurement properties
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rectangle"; width: number; height: number }
  | { kind: "triangle"; base: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle": return Math.PI * shape.radius ** 2;
    case "rectangle": return shape.width * shape.height;
    case "triangle": return (shape.base * shape.height) / 2;
  }
}
```

```ts
// Exhaustiveness checking — catches a missing case at compile time
function assertNever(x: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(x)}`);
}

function describe(shape: Shape): string {
  switch (shape.kind) {
    case "circle": return "round";
    case "rectangle": return "boxy";
    // case "triangle" intentionally omitted for illustration
    default:
      return assertNever(shape); // Compile error here: 'triangle' variant is not assignable to `never`
  }
}
```

## Common Pitfalls / Gotchas

- Using a non-unique or non-literal discriminant property (e.g., a `boolean` shared meaningfully across more than two variants, or a property whose type isn't a distinct literal per variant) — narrowing only works cleanly when each variant's discriminant value is a unique literal type.
- Forgetting to add an exhaustiveness check — without one, adding a new union variant later can silently leave a `switch` branch unhandled, with no compile error to catch the omission.
- Accessing a variant-specific property before narrowing the discriminant — TypeScript correctly refuses this, since the property doesn't exist on every union member; narrow first, one property check at a time.
- Structuring state as one object with many optional properties instead of a proper discriminated union — this allows logically invalid combinations (e.g., `status: "loading"` with a populated `error` field) that a discriminated union would make structurally impossible.

## Interview Questions & Answers

**Q: What is a discriminated union, and what makes a property qualify as a good "discriminant"?**
A: A union of object types that all share one common property (the discriminant) where each variant assigns that property a distinct literal type value. A good discriminant is a literal-typed property (string, number, or boolean literal) that's unique per variant, so checking its value lets TypeScript unambiguously narrow the whole object's type.

**Q: How does checking the discriminant property narrow more than just that one property?**
A: TypeScript's control-flow analysis narrows the *entire* union type down to the specific member(s) whose discriminant value matches the check — so every other property unique to that variant also becomes safely accessible (and properties from other variants become inaccessible) within that branch, all from one check.

**Q: How would you get a compile-time error if someone adds a new variant to a discriminated union but forgets to handle it in an existing `switch`?**
A: Add a `default` case that assigns the switch's discriminant (or the whole narrowed value) to a variable typed `never`. If every existing variant is handled, the value remaining in `default` is `never`, and the assignment compiles. If a new, unhandled variant is added later, that variant's type is no longer `never` in the default branch, and the assignment becomes a compile error.

**Q: Why is a discriminated union usually better than one object with several optional properties for modeling states like loading/success/error?**
A: A discriminated union makes invalid combinations structurally impossible to construct (you can't have `status: "loading"` with a populated `data` and `error` at the same time), whereas an object with all-optional properties allows any combination at the type level, pushing the burden of avoiding invalid states onto runtime discipline instead of the compiler.

## Related Topics
- [union-types.md](./union-types.md)
- [literal-types.md](./literal-types.md)
- [type-guards-and-narrowing.md](./type-guards-and-narrowing.md)
- [any-unknown-never-void.md](./any-unknown-never-void.md)
- [interfaces.md](./interfaces.md)
