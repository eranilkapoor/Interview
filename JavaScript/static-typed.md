# Statically Typed (Languages)

A statically typed language checks variable and expression types at **compile time**, before the program ever runs. Examples include Java, C, C++, Go, Rust, and — as an optional overlay on top of JavaScript — TypeScript. In a statically typed language, you typically must declare (or the compiler must be able to infer) a variable's type up front, and the compiler rejects the program if types don't line up (e.g., assigning a string where a number is expected), catching a whole category of bugs before the code ever executes.

JavaScript itself is **not** statically typed — it's dynamically typed (see [dynamic-typed.md](./dynamic-typed.md)) — but understanding static typing is essential for JS developers because of TypeScript's dominance in professional codebases. TypeScript adds a static type layer on top of JavaScript syntax, checked by the `tsc` compiler (or via editor tooling) during development, and then **erases all types** when compiling down to plain JavaScript — so the runtime behavior is identical to hand-written JS; only the development-time safety differs.

The trade-off senior engineers discuss in interviews: static typing catches certain bugs earlier and improves tooling (autocomplete, refactoring, self-documenting signatures) at the cost of more upfront verbosity and, in TypeScript's case, does not provide *runtime* guarantees (a malformed API response can still violate a declared type silently, since the check only happened at compile time).

## Examples

```ts
// TypeScript: a statically-typed overlay on JavaScript
function add(a: number, b: number): number {
  return a + b;
}
add(2, 3);       // OK
// add('2', 3);  // Compile-time error: Argument of type 'string' is not assignable to type 'number'
```

```js
// The same function compiled to plain JavaScript — all type info is gone
function add(a, b) {
  return a + b;
}
add('2', 3); // Runs fine at runtime: "23" (string concatenation) — no error, because JS is dynamic
```

```ts
// Static typing catches this mistake before the code ever runs
interface User { name: string; age: number; }
const u: User = { name: 'Anil', age: '30' };
// Compile-time error: Type 'string' is not assignable to type 'number' for property 'age'
```

## Common Pitfalls / Gotchas

- Believing TypeScript's compile-time checks provide runtime safety — they don't; unchecked external data (API responses, `JSON.parse` results) can still violate declared types at runtime with zero warning unless you add runtime validation (e.g., Zod, io-ts).
- Assuming "statically typed" means "type declarations are always mandatory" — many statically typed languages (including TypeScript, Go, Rust to a degree) support type inference, reducing explicit annotations.
- Conflating "static typing" with "strong typing" — they're different axes; a language can be statically and weakly typed (implicit coercions still allowed) or dynamically and strongly typed.
- Forgetting that `any` in TypeScript opts a value out of static checking entirely, effectively creating an escape hatch back to dynamic-typing behavior for that value.

## Interview Questions & Answers

**Q: Is JavaScript statically typed? Where does TypeScript fit in?**
A: No, JavaScript is dynamically typed — types are determined and checked at runtime. TypeScript is a separate language that adds an optional static type system on top of JavaScript syntax; the TypeScript compiler checks types during development and then strips them away entirely, emitting plain, dynamically-typed JavaScript.

**Q: What's the main practical benefit of static typing in large codebases?**
A: Catching a class of bugs (wrong argument types, typo'd property names, incompatible function signatures) at compile time rather than in production, plus significantly better editor tooling — autocomplete, inline documentation, safe refactoring/renaming across a whole codebase.

**Q: Can a TypeScript program still fail with a "type error" at runtime?**
A: Yes — TypeScript's checks vanish after compilation, so if runtime data doesn't match its declared type (e.g., an API returns `age: "30"` as a string when the type says `number`), no error is thrown; the code will just behave unexpectedly (e.g., string concatenation instead of numeric addition) unless you add explicit runtime validation.

## Related Topics
- [dynamic-typed.md](./dynamic-typed.md)
- [types-in-javascript.md](./types-in-javascript.md)
- [type-coercion.md](./type-coercion.md)
