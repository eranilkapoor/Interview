# Type Assertions / Type Casting

A type assertion tells the TypeScript compiler "trust me, I know this value's type better than you've inferred it," using the `as` syntax (`value as SomeType`) or, in non-JSX `.ts` files only, the angle-bracket syntax (`<SomeType>value`). Unlike a runtime type cast in languages like Java or C#, a TypeScript assertion does **nothing at runtime** — it's purely a compile-time instruction that changes how the type checker treats the expression going forward; no conversion, no validation, no runtime check happens at all.

Assertions are appropriate when you have information the compiler can't derive on its own — for example, `document.getElementById("app")` returns `HTMLElement | null`, but you might know from the surrounding markup that the element always exists, so you assert `as HTMLDivElement` to work with it as the more specific type you know it to be. They're also common when narrowing `unknown` values from `JSON.parse()`, or when working with third-party APIs whose types are looser than what you know to be true in your specific usage.

TypeScript only allows an assertion between types that have some overlap ("sufficiently overlapping" — one being a subtype of the other in either direction); asserting between two completely unrelated types (`"hello" as number`) is a compile error. To force an assertion through anyway, you double-cast via `unknown` first (`value as unknown as TargetType`), which is a deliberate escape hatch — and a strong signal in code review that something risky is happening, since it bypasses even TypeScript's basic sanity check on the assertion itself.

Assertions are fundamentally different from type *guards* (runtime checks like `typeof`/`instanceof` that TypeScript uses to narrow safely) — an assertion can lie to the compiler and produce a runtime crash later if you're wrong, whereas a type guard is verified at runtime before the narrower type is trusted. As a rule, prefer proper narrowing wherever a genuine runtime check is possible, and reserve assertions for cases where no runtime check could exist (e.g., you have out-of-band knowledge the type system simply cannot express).

## Examples

```ts
// `as` syntax — the standard, preferred assertion style (works in .ts and .tsx)
const input = document.getElementById("email") as HTMLInputElement;
console.log(input.value); // .value only exists on HTMLInputElement, not the wider HTMLElement | null
```

```ts
// Angle-bracket syntax — only valid in plain .ts files (conflicts with JSX in .tsx)
let someValue: unknown = "this is a string";
let strLength: number = (<string>someValue).length;
```

```ts
// Narrowing `unknown` from JSON.parse with an assertion (use with real validation in production!)
interface ApiUser {
  id: number;
  name: string;
}
const raw: unknown = JSON.parse('{"id":1,"name":"Anil"}');
const user = raw as ApiUser; // compiler trusts this — but nothing has actually verified the shape

// Double assertion via `unknown` — an explicit escape hatch for unrelated types
const value = "42" as unknown as number; // legal, but a red flag: no real conversion happens,
console.log(typeof value); // "string" — still a string at runtime! the assertion lied to the compiler
```

## Common Pitfalls / Gotchas

- Believing `as SomeType` performs an actual conversion — it does not; `"42" as unknown as number` is still the string `"42"` at runtime, `typeof` will say `"string"`, and any numeric operation on it will behave like JavaScript's usual string coercion, not real division/addition.
- Using assertions to silence a type error instead of fixing the underlying type mismatch or adding a genuine runtime check — this just delays the failure to runtime, often in a more confusing place than where the original error was caught.
- Reaching for a double assertion (`as unknown as X`) casually — TypeScript only blocks assertions between *unrelated* types as a sanity check; routing around it via `unknown` removes that last safety net entirely.
- Confusing assertions with type guards — `value as string` doesn't verify anything; `typeof value === "string"` does, and only the latter is safe to rely on for values coming from an untrusted source (API responses, user input, `JSON.parse`).
- Using the angle-bracket assertion syntax in a `.tsx` file — it's ambiguous with JSX syntax and disallowed there; always use `as` in files that may contain JSX.

## Interview Questions & Answers

**Q: What does a type assertion actually do at runtime?**
A: Nothing. `value as SomeType` is purely a compile-time instruction telling the type checker to treat `value` as `SomeType` from that point on — no conversion, validation, or runtime check occurs. If your assertion is wrong, you get no error until (and unless) the mistaken assumption causes an actual runtime failure elsewhere.

**Q: What's the difference between a type assertion and a type guard?**
A: A type assertion (`as SomeType`) is an unchecked compile-time claim you make to the compiler — it can be wrong and cause a later runtime crash. A type guard (`typeof x === "string"`, `x instanceof Foo`, a custom `is` predicate) is a real runtime check that TypeScript uses to safely narrow a type only after actually verifying it, so it can't lie.

**Q: When would you need a double assertion like `value as unknown as TargetType`?**
A: When asserting directly between two types TypeScript considers insufficiently overlapping (neither is a subtype of the other), which it normally rejects as likely a mistake. Routing through `unknown` (the universal top type) bypasses that check — it's a deliberate escape hatch that should be rare and reviewed carefully, since it also disables TypeScript's one safeguard against a nonsensical assertion.

**Q: Why might you use `document.getElementById(...) as HTMLInputElement` instead of a runtime check?**
A: Because `getElementById` returns the widened `HTMLElement | null`, and you may have external knowledge (from the surrounding markup) that guarantees both that the element exists and that it's specifically an `<input>`. If that guarantee could ever be false, a runtime check (`if (el instanceof HTMLInputElement)`) is safer, since an incorrect assertion would only fail later, and less clearly, when `.value` is accessed on the wrong element type.

## Related Topics
- [type-guards-and-narrowing.md](./type-guards-and-narrowing.md)
- [any-unknown-never-void.md](./any-unknown-never-void.md)
- [non-null-assertion-operator.md](./non-null-assertion-operator.md)
- [const-assertions.md](./const-assertions.md)
- [type-inference.md](./type-inference.md)
