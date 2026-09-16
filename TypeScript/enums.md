# Enums

An enum ("enumerated type") lets you define a named set of related constants under one type — a fixed list of possibilities like `Direction.Up`/`Direction.Down`/`Direction.Left`/`Direction.Right`, instead of scattering raw string or number literals throughout your code. TypeScript supports **numeric enums** (members auto-increment from `0` by default, or from a specified starting value), **string enums** (each member is explicitly assigned a string value), and **const enums** (a variant that gets fully inlined at compile time, leaving no runtime object behind at all).

Numeric enums are TypeScript's original enum style and are bidirectional at runtime — you can go from the member name to its numeric value, and also from the numeric value back to the member name via reverse mapping (`Direction[0] === "Up"`). This reverse mapping is convenient for debugging (logging an enum value shows a name, not a bare number) but also a common source of confusion, since it means the compiled JS object has roughly double the expected number of keys. String enums don't get this reverse mapping, but their values are self-descriptive at runtime (useful for logging, serialization, and debugging) and each member must be explicitly initialized rather than relying on auto-increment.

Enums are a genuine TypeScript-only *runtime* construct — unlike interfaces or type aliases, which are fully erased, a regular `enum` compiles to an actual JavaScript object that exists at runtime (typically an IIFE-wrapped object with the forward and, for numeric enums, reverse mappings). This is different from every other type-only TypeScript feature and is precisely why enums have runtime cost (however small) and appear in your compiled bundle size, and it's also why `const enum` exists — it's fully inlined at every usage site during compilation, producing zero runtime object, at the cost of some tooling/interop limitations (it can't be used across certain module boundaries, e.g. with `isolatedModules`).

Because of these trade-offs, a large and growing portion of the TypeScript community favors an alternative pattern: a `const` object combined with `keyof typeof` (sometimes called a "union of literals" or "as const object" pattern), which achieves a similar developer experience — named, autocompletable constants with a matching type — while remaining plain JavaScript with fully predictable, erasable typing and no separate enum runtime semantics to learn.

## Examples

```ts
// Numeric enum — auto-incrementing values, with reverse mapping
enum Direction {
  Up,    // 0
  Down,  // 1
  Left,  // 2
  Right, // 3
}
let move: Direction = Direction.Up;
console.log(Direction[0]); // "Up" — reverse mapping only works for numeric enums
```

```ts
// String enum — explicit, self-describing values; no reverse mapping
enum Status {
  Pending = "PENDING",
  Approved = "APPROVED",
  Rejected = "REJECTED",
}
function handle(status: Status) {
  if (status === Status.Approved) console.log("Go ahead");
}
handle(Status.Approved); // must use the enum member, not the raw string "APPROVED", unless cast
```

```ts
// const enum — fully inlined at compile time, zero runtime object emitted
const enum LogLevel {
  Info,
  Warn,
  Error,
}
console.log(LogLevel.Warn); // compiles down to `console.log(1);` — no LogLevel object exists at runtime

// The common modern alternative: a const object + derived union type
const Color = {
  Red: "RED",
  Green: "GREEN",
  Blue: "BLUE",
} as const;
type Color = (typeof Color)[keyof typeof Color]; // "RED" | "GREEN" | "BLUE"
function paint(c: Color) { /* ... */ }
paint(Color.Red); // same ergonomics as a string enum, but plain JS underneath
```

## Common Pitfalls / Gotchas

- Forgetting that numeric enums allow *any* number to be assigned to the enum type without error (`let d: Direction = 999;` compiles fine) — this is a known type-safety hole unique to numeric enums; string enums don't have this problem.
- Using `const enum` in a project that also uses `isolatedModules` (common with Babel/esbuild/swc-based toolchains, or Vite) — `const enum` requires full type-checker knowledge across files and is incompatible with per-file transpilation, causing build errors.
- Assuming string enum members can be assigned raw string literals interchangeably — they can't without an explicit assertion; `Status.Approved` and `"APPROVED"` are not the same type even though they share a runtime value, which is a deliberate safety feature, not a bug.
- Not realizing regular (non-const) enums generate real runtime code (an object, sometimes an IIFE) — this adds to bundle size and means enums are one of the few TypeScript constructs that isn't fully "free" at runtime, unlike interfaces/types.
- Overusing enums where a simpler union of string literals (`"pending" | "approved" | "rejected"`) would be lighter-weight, more interoperable with plain JS/JSON, and avoid the reverse-mapping/bundle-size quirks entirely.

## Interview Questions & Answers

**Q: What's the difference between a numeric enum and a string enum in TypeScript?**
A: A numeric enum auto-assigns incrementing numbers starting at 0 (unless overridden) and gets a bidirectional runtime mapping (name → value and value → name). A string enum requires every member to have an explicit string value and has no reverse mapping — but its runtime values are self-describing, which is friendlier for logging, debugging, and serialization.

**Q: What does `const enum` do differently from a regular `enum`?**
A: A regular `enum` compiles into an actual JavaScript object that exists at runtime. A `const enum` is fully inlined by the compiler at every usage site, so no enum object is ever emitted — smaller output, zero runtime cost, but it requires whole-program type information, making it incompatible with isolated/per-file transpilers (`isolatedModules`).

**Q: Why do some teams avoid enums entirely in favor of a `const` object with `as const`?**
A: Because a `const`-object-plus-derived-union pattern gives similar ergonomics (named constants, autocomplete, a matching type via `keyof typeof`) while remaining ordinary erasable JavaScript with no separate runtime semantics, no numeric-enum type-safety hole, and full compatibility with isolated-module transpilers.

**Q: What's a known type-safety issue with numeric enums specifically?**
A: Any arbitrary number is assignable to a numeric enum's type without a compile error (e.g. `let d: Direction = 42;` even if `Direction` only has values 0-3) — TypeScript doesn't restrict numeric enum variables to just the declared members the way it does for string enums or literal unions.

## Related Topics
- [literal-types.md](./literal-types.md)
- [union-types.md](./union-types.md)
- [const-assertions.md](./const-assertions.md)
- [basic-types.md](./basic-types.md)
- [strict-mode.md](./strict-mode.md)
