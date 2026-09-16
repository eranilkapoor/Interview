# Basic Types

TypeScript's type system starts from the same primitive types JavaScript already has at runtime — `string`, `number`, `boolean`, `null`, `undefined`, `symbol`, and `bigint` — and gives each one a matching *static* type annotation you can attach to variables, function parameters, return values, and object properties. Unlike some other typed languages, TypeScript doesn't distinguish `int` vs `float` vs `double`: there's just one `number` type, mirroring JavaScript's single numeric type (IEEE-754 double), with `bigint` as a separate type for arbitrary-precision integers.

Type annotations are written after a colon: `let age: number = 30;`. In practice, you rarely need to annotate simple variable declarations — TypeScript's inference (see [type-inference.md](./type-inference.md)) figures out `age`'s type from its initializer automatically. Annotations earn their value most on function signatures (parameters and return types) and on variables whose initial value doesn't fully convey intent (e.g., `let id: string | number;` declared before assignment).

`null` and `undefined` deserve special mention: under `strictNullChecks` (part of `strict` mode), they are **not** automatically assignable to every other type — a `string` variable cannot hold `null` unless its type is explicitly widened to `string | null`. This is one of TypeScript's highest-value strict checks, since "unexpected `null`/`undefined`" is one of the most common bug categories in real JavaScript. Without `strictNullChecks`, TypeScript reverts to JavaScript's loose behavior where `null`/`undefined` are assignable to anything, which defeats much of the safety net.

Finally, these primitive types compose into everything else: arrays of them (`string[]`), unions of them (`string | number`), literal narrowings of them (`"pending" | "done"`), and object shapes built from them via interfaces and type aliases — basic types are the alphabet the rest of the type system is written in.

## Examples

```ts
let username: string = "anil";
let age: number = 28;
let isActive: boolean = true;
let bigNumber: bigint = 9007199254740993n;
let uniqueKey: symbol = Symbol("id");
let notAssigned: undefined = undefined;
let empty: null = null;
```

```ts
// Under strictNullChecks, null/undefined must be explicitly part of the type union
function getLength(value: string | null): number {
  if (value === null) return 0;
  return value.length; // TypeScript knows `value` is narrowed to `string` here
}
```

```ts
// number covers integers and floats alike; bigint is a genuinely distinct type
function double(n: number): number {
  return n * 2;
}
double(21); // 42

const big: bigint = 100n;
// double(big); // Compile error: bigint is not assignable to number — they never mix implicitly
```

## Common Pitfalls / Gotchas

- Mixing `number` and `bigint` in arithmetic (`1n + 1`) — TypeScript (and JavaScript) forbids this; you must explicitly convert one side (`Number(1n)` or `BigInt(1)`).
- Forgetting that without `strictNullChecks` enabled, `null`/`undefined` are silently assignable to every type, hiding a large class of real bugs — always enable `strict` (which includes `strictNullChecks`) on new projects.
- Annotating obvious variable initializations redundantly (`let x: number = 5;`) — harmless, but noisy; let inference handle it and reserve explicit annotations for function signatures and ambiguous cases.
- Confusing the TypeScript type `Number`/`String`/`Boolean` (capitalized wrapper-object types) with the lowercase primitive types `number`/`string`/`boolean` — always use the lowercase primitives; the capitalized versions refer to the boxed object wrappers and almost never what you want.

## Interview Questions & Answers

**Q: What primitive types does TypeScript support, and how do they map to JavaScript's runtime types?**
A: `string`, `number`, `boolean`, `null`, `undefined`, `symbol`, and `bigint` — these are exactly JavaScript's runtime primitive types, with TypeScript adding compile-time annotations for each. There's no split between integer and floating-point types; `number` covers both.

**Q: What's the difference between the types `number` and `Number`?**
A: `number` (lowercase) is the primitive type and should almost always be used. `Number` (capitalized) refers to the `Number` wrapper object type; using it as a type annotation is a common mistake since it accepts boxed `Number` objects, not primitive numbers, and offers no real benefit.

**Q: What does `strictNullChecks` change about how `null` and `undefined` behave?**
A: Without it, `null` and `undefined` are valid values for every type, matching JavaScript's loose runtime behavior. With it enabled (as part of `strict`), they become distinct types that must be explicitly included in a union (e.g., `string | null`) to be assignable — this is one of the most valuable checks TypeScript offers for catching real bugs.

**Q: Can you assign a `bigint` to a `number` variable, or mix them in arithmetic?**
A: No to both — `bigint` and `number` are treated as distinct, non-interchangeable types in TypeScript (mirroring a runtime restriction in JavaScript itself). You must explicitly convert with `Number(bigintValue)` or `BigInt(numberValue)` before mixing them.

## Related Topics
- [any-unknown-never-void.md](./any-unknown-never-void.md)
- [type-inference.md](./type-inference.md)
- [literal-types.md](./literal-types.md)
- [strict-mode.md](./strict-mode.md)
- [arrays-and-tuples.md](./arrays-and-tuples.md)
