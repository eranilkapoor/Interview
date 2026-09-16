# Type Inference

Type inference is TypeScript's ability to figure out a value's type automatically from context, without you writing an explicit annotation. When you write `let count = 5;`, TypeScript doesn't need `: number` — it looks at the initializer and infers `count: number` on its own. Inference isn't a fallback for lazy typing; it's the primary way most TypeScript code gets its types, and idiomatic TypeScript leans on it heavily, reserving explicit annotations for function signatures, ambiguous cases, and places where the inferred type would be wrong or too wide for your intent.

Inference goes well beyond simple variable initializers. Function return types are inferred from the `return` statements inside the function body. Generic type parameters are inferred from the arguments passed at a call site (`identity(5)` infers `T = number` without you writing `identity<number>(5)`). Contextual typing infers a callback parameter's type from the function it's being passed to — e.g., inside `array.map(x => ...)`, `x`'s type is inferred from the array's element type, not from `x` in isolation. Control-flow-based narrowing (see [type-guards-and-narrowing.md](./type-guards-and-narrowing.md)) is really inference too — the compiler infers a *more specific* type for a variable within a conditional branch based on a preceding `typeof`/`instanceof`/truthiness check.

The `infer` keyword takes this further inside conditional types, letting you *extract* a type from within a larger type structure during a type-level computation — this is how utility types like `ReturnType<T>` and `Parameters<T>` work internally: they pattern-match against a function type and use `infer` to pull out the piece they want (see [conditional-types.md](./conditional-types.md)).

Knowing when to trust inference versus when to add an explicit annotation is itself an important skill: over-annotating adds noise and can accidentally *widen* a type (e.g. annotating a variable as `string` when inference would have kept a narrower literal type); under-annotating on public function signatures makes it harder for callers and for the compiler itself to catch mismatches early, since a change in the function body can silently change its inferred public return type.

## Examples

```ts
// Variable and return-type inference — no explicit annotations needed
let name = "Anil";        // inferred: string
let age = 30;              // inferred: number
function double(n: number) {
  return n * 2;            // return type inferred: number (no need for `: number` after the parens)
}
```

```ts
// Contextual typing: callback parameter types inferred from context
const numbers = [1, 2, 3];
numbers.map(n => n * 2); // `n` is inferred as `number` from `numbers`'s element type, with no annotation

// Generic inference from arguments — no need to write identity<number>(5)
function identity<T>(value: T): T {
  return value;
}
const result = identity(5); // T inferred as number; result: number
```

```ts
// `infer` inside a conditional type — how ReturnType<T> works under the hood
type MyReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

function getUser() {
  return { id: 1, name: "Anil" };
}
type User = MyReturnType<typeof getUser>; // { id: number; name: string }
```

## Common Pitfalls / Gotchas

- Over-relying on inference for public function return types — if the function body changes, the *inferred* return type silently changes too, potentially breaking callers without any explicit signal at the function's declaration site; annotate return types on exported/public functions for stability.
- Being surprised that an empty array literal (`let arr = [];`) infers as `any[]` in non-strict contexts, or requires an explicit type if used before being populated — always annotate empty-array declarations (`let arr: number[] = [];`) to avoid this.
- Forgetting that annotating a variable with a wider type than needed defeats literal inference — `let status: string = "active";` throws away the narrower `"active"` literal type inference would have given you.
- Assuming generic type inference always succeeds — when TypeScript can't confidently infer a generic parameter from the arguments given (e.g., an empty array with no other context), it falls back to `unknown` or `never`, often requiring an explicit type argument (`identity<string>()`).

## Interview Questions & Answers

**Q: What is contextual typing, and can you give an example?**
A: Contextual typing is when TypeScript infers a value's type not from the value itself, but from the surrounding context/position it's used in — e.g., a callback parameter inside `array.map(x => ...)` gets its type inferred from the array's element type, even though `x` has no annotation of its own.

**Q: Why would you still add explicit return type annotations to functions even though TypeScript can infer them?**
A: To lock in a stable public contract — if the return type is inferred and someone changes the function body, the inferred type can silently change and break every caller without any error at the function's own declaration; an explicit annotation makes such a change trigger an immediate, localized compile error instead.

**Q: What does the `infer` keyword do, and where is it used?**
A: `infer` is used inside conditional types to declare a new type variable that gets bound to whatever type is matched at that position in a larger type structure — it's how built-in utility types like `ReturnType<T>` and `Parameters<T>` extract a piece (the return type, the parameter tuple) out of a function type during a type-level pattern match.

**Q: How does generic type inference work when calling a generic function?**
A: TypeScript looks at the arguments passed at the call site and works backward to infer the type parameter(s) that make the call valid — e.g. calling `identity(5)` on `function identity<T>(x: T): T` infers `T = number` automatically, without needing an explicit `identity<number>(5)`.

## Related Topics
- [type-guards-and-narrowing.md](./type-guards-and-narrowing.md)
- [conditional-types.md](./conditional-types.md)
- [generics.md](./generics.md)
- [literal-types.md](./literal-types.md)
- [type-assertions.md](./type-assertions.md)
