# any, unknown, never, void

These four special types sit outside the normal primitive/object type hierarchy and each answer a distinct question. `any` means "opt this value out of type checking entirely" — it's assignable to and from anything, and every operation on it is allowed without complaint, effectively turning off TypeScript's safety net for that value. `unknown` is `any`'s safe sibling: it can hold any value too, but you cannot *use* an `unknown` value (call a method on it, access a property, pass it somewhere) until you've narrowed it to a more specific type first — it forces you to prove what the value is before touching it.

`void` describes the absence of a meaningful return value — it's the inferred/declared return type of a function that doesn't `return` anything (or only returns `undefined`). It's a signal to callers "don't use this function's return value," distinct from actually returning `undefined` as a real value. `never` represents a type that has **no possible values at all** — it's the type of a function that never returns normally, either because it always throws, always loops infinitely, or (most usefully in practice) because it represents an unreachable code path, such as the `default` branch of an exhaustively-handled discriminated union switch.

The practical hierarchy to remember: `unknown` is the type-safe top type (anything is assignable to it, but it's assignable to nothing without narrowing), while `any` bypasses the type system in both directions and should be avoided whenever `unknown` would do. `never` is the bottom type (assignable to everything, since a `never` value can never actually occur, so assigning it anywhere is always trivially safe) and is most valuable as a compiler-enforced exhaustiveness check. `void` is really just "the return type nobody should rely on" and only meaningfully applies to function return positions.

Using `unknown` instead of `any` at the boundaries of your application — parsing JSON, reading `catch` block errors (which are typed `unknown` by default under modern TypeScript), handling third-party data — is one of the highest-leverage habits for writing type-safe TypeScript, because it forces explicit validation/narrowing at exactly the places where invalid data is most likely to sneak in.

## Examples

```ts
// any: opts out of type checking entirely — avoid except as a last resort
let anything: any = 42;
anything.toUpperCase(); // No compile error — but this WILL crash at runtime (42 has no toUpperCase)

// unknown: safe — forces narrowing before use
let value: unknown = 42;
// value.toUpperCase(); // Compile error: Object is of type 'unknown'
if (typeof value === "string") {
  value.toUpperCase(); // OK — narrowed to string within this block
}
```

```ts
// void: function that returns nothing meaningful
function logMessage(msg: string): void {
  console.log(msg);
  // no return, or `return;` with no value — both fine for void
}

// never: exhaustiveness checking with a discriminated union
type Shape = { kind: "circle"; radius: number } | { kind: "square"; side: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle": return Math.PI * shape.radius ** 2;
    case "square": return shape.side ** 2;
    default:
      const _exhaustive: never = shape; // compile error if a Shape variant is ever added and unhandled
      throw new Error("Unhandled shape");
  }
}
```

```ts
// never: a function that always throws or never returns
function fail(message: string): never {
  throw new Error(message);
}

function infiniteLoop(): never {
  while (true) { /* ... */ }
}
```

## Common Pitfalls / Gotchas

- Reaching for `any` "just to make the error go away" — this silently disables checking for that value and everything derived from it; use `unknown` plus explicit narrowing (or a proper type) instead.
- Forgetting that `unknown` requires narrowing before *any* operation, including property access — code that compiled fine with `any` will suddenly show errors when switched to `unknown`, which is the point, not a bug.
- Confusing `void` with `undefined` — a function typed to return `void` can still technically return a value at the call site in some contexts (notably when assigned to a callback type), but relying on this is misleading; treat `void` as "ignore the return value."
- Assuming `never` and `void` are interchangeable — `void` means "returns nothing useful," `never` means "never returns at all" (throws or loops forever); a function returning `never` cannot fall through to its end.
- Not using `never` for exhaustiveness checks in `switch` statements over discriminated unions — without it, adding a new union variant later can silently fall through unhandled instead of causing a compile error.

## Interview Questions & Answers

**Q: What's the difference between `any` and `unknown`?**
A: Both can hold any value, but `any` disables type checking entirely — you can call any method or access any property on it with no compile-time error, at the cost of losing all safety. `unknown` is type-safe: the compiler forces you to narrow it (via `typeof`, `instanceof`, a type guard, etc.) to a more specific type before you're allowed to use it in any way.

**Q: Why is `unknown` generally preferred over `any` for values of uncertain type, like a JSON API response or a `catch` block error?**
A: Because `unknown` keeps the compiler's safety net active — you're forced to validate/narrow the value before using it, which catches shape mismatches at the point of use instead of letting bad data flow silently through your program the way `any` would allow.

**Q: What is the `never` type, and where does it commonly show up?**
A: `never` represents a type with no possible values — the return type of a function that always throws or never terminates, and the type TypeScript infers for an unreachable branch, such as the `default` case of a `switch` over a discriminated union where every variant has already been handled. It's commonly used deliberately to get a compile-time error if a new union variant is added without updating every switch that should handle it.

**Q: How does `void` differ from `never` as a function return type?**
A: `void` means the function completes normally but doesn't return a meaningful value (it may return `undefined` or nothing at all). `never` means the function does not complete normally at all — it always throws an exception or never returns (e.g., an infinite loop), so code after calling it is considered unreachable.

**Q: Is `any` assignable to `unknown`, and is `unknown` assignable to `any`?**
A: `any` is assignable to `unknown` (and to everything else). `unknown` is only assignable to `any` and to `unknown` itself — it is *not* assignable to any other specific type without an explicit type assertion or narrowing, which is exactly what makes it safe.

## Related Topics
- [basic-types.md](./basic-types.md)
- [type-guards-and-narrowing.md](./type-guards-and-narrowing.md)
- [discriminated-unions.md](./discriminated-unions.md)
- [type-assertions.md](./type-assertions.md)
- [strict-mode.md](./strict-mode.md)
