# Type Guards & Narrowing

Narrowing is TypeScript's process of refining a variable's static type to something more specific within a particular block of code, based on a runtime check the compiler can statically follow — this is what lets you safely go from a wide type like `string | number` to a specific branch-local type like `string`, without an unsafe assertion. A **type guard** is any expression the compiler specifically recognizes as capable of triggering this narrowing: `typeof x === "string"`, `x instanceof SomeClass`, `"prop" in obj`, a truthiness check (`if (x)`), an equality check against a literal, or a call to a custom **user-defined type guard** function.

Built-in guards each suit a different situation: `typeof` works for narrowing between JavaScript's primitive types (`string`, `number`, `boolean`, `symbol`, `bigint`, `undefined`, `function`, `object`); `instanceof` narrows based on prototype chain membership, appropriate for class instances; the `in` operator narrows a union of object types based on whether a given property name exists on the value, useful when the types involved aren't classes and so `instanceof` doesn't apply. TypeScript's control-flow analysis also narrows automatically through plain equality/truthiness checks, `&&`/`||` short-circuiting, early `return`s, and `throw` statements — the compiler traces every code path and keeps a distinct narrowed type per branch.

A **user-defined type guard** is a function whose return type is a special *type predicate* (`param is SomeType` instead of a plain `boolean`) — it looks like a normal boolean-returning function at the call site, but its signature tells the compiler "if this returns `true`, treat the argument as `SomeType` from this point on." This is essential when the check needed is too custom for any built-in guard to express — validating an unknown value against an expected object shape, for instance. Since TypeScript 5.5, the compiler can also *infer* type predicates automatically for certain simple guard functions (like `array.filter(x => x !== null)`), without you needing to write the `is` annotation explicitly, though writing it remains necessary for anything beyond the simplest cases.

Discriminated unions (see [discriminated-unions.md](./discriminated-unions.md)) are really narrowing's most powerful and most heavily interview-tested application: checking one literal-typed "tag" property narrows the compiler's understanding of the *entire* surrounding object, not just that one property, letting every other branch-specific member become safely accessible without any additional guard.

## Examples

```ts
// Built-in guards: typeof, instanceof, in
function describe(value: string | number) {
  if (typeof value === "string") return value.toUpperCase(); // narrowed to string
  return value.toFixed(2); // narrowed to number
}

class Dog { bark() { return "Woof"; } }
class Cat { meow() { return "Meow"; } }
function speak(pet: Dog | Cat) {
  if (pet instanceof Dog) return pet.bark(); // narrowed to Dog
  return pet.meow(); // narrowed to Cat
}

interface Circle { kind: "circle"; radius: number; }
interface Square { kind: "square"; side: number; }
function area(shape: Circle | Square) {
  if ("radius" in shape) return Math.PI * shape.radius ** 2; // narrowed to Circle
  return shape.side ** 2; // narrowed to Square
}
```

```ts
// User-defined type guard with an `is` type predicate
interface ApiError { error: string; }
interface ApiSuccess { data: unknown; }

function isApiError(response: ApiError | ApiSuccess): response is ApiError {
  return "error" in response;
}

function handle(response: ApiError | ApiSuccess) {
  if (isApiError(response)) {
    console.log(response.error); // narrowed to ApiError
  } else {
    console.log(response.data); // narrowed to ApiSuccess
  }
}
```

```ts
// Control-flow narrowing through early returns, truthiness, and inferred predicates (TS 5.5+)
function processName(name: string | null | undefined) {
  if (!name) return; // early return narrows the rest of the function's `name` to `string`
  console.log(name.toUpperCase());
}

const values = [1, null, 2, null, 3];
const nums = values.filter((v) => v !== null); // TS 5.5+ infers `number[]`, not `(number | null)[]`
```

## Common Pitfalls / Gotchas

- Writing a user-defined type guard whose `is` predicate lies about what was actually checked — since a type predicate is essentially an unchecked assertion from the compiler's point of view (the function body's correctness isn't verified against the predicate), a buggy guard can narrow to the wrong type with no compile error, only a later runtime surprise.
- Assuming narrowing "sticks" across an intervening function call — if a narrowed variable is captured in a closure and reassigned or mutated between the check and the usage (e.g., inside a callback invoked later), TypeScript may widen it back, since it can no longer guarantee the narrowing still holds at that later point.
- Using `instanceof` for narrowing on plain object literals or interfaces — `instanceof` checks the prototype chain, which only meaningfully applies to actual class instances; plain object types need `in`, a discriminant property check, or a custom type guard instead.
- Forgetting to explicitly write an `is` predicate on a custom guard function before TypeScript 5.5's inference applies — without it (and outside what 5.5+ can auto-infer), the function just returns a plain `boolean`, and calling it will not narrow anything at the call site, even if its logic is functionally identical to a proper guard.

## Interview Questions & Answers

**Q: What is narrowing, and what are some examples of type guards that trigger it?**
A: Narrowing is the compiler refining a variable's type to something more specific within a code branch, based on a runtime check it can statically follow. Common type guards: `typeof x === "..."` for primitives, `x instanceof Class` for class instances, `"prop" in obj` for distinguishing object shapes, truthiness/equality checks, and custom user-defined type guard functions.

**Q: What is a user-defined type guard, and what makes its function signature special?**
A: A function whose return type is a type predicate — `param is SomeType` instead of a plain `boolean` — e.g. `function isApiError(r: ApiError | ApiSuccess): r is ApiError`. Calling it in an `if` condition narrows the checked argument's type in each branch, just like a built-in guard, even though the logic inside can be arbitrarily custom.

**Q: Is a user-defined type guard's correctness actually verified by the compiler?**
A: No — TypeScript trusts the type predicate's claim without checking that the function body genuinely, correctly verifies it. A poorly written guard that returns `true` incorrectly will still narrow the type (wrongly), compiling cleanly but risking a runtime error later when the mistaken assumption is acted on.

**Q: How does `in` narrowing differ from `instanceof` narrowing, and when would you use each?**
A: `instanceof` checks whether a value's prototype chain includes a given class, so it's appropriate for narrowing between actual class instances. `in` checks whether a given property name exists on an object at all, which works for narrowing between plain object/interface shapes (including discriminated unions) that aren't necessarily class instances at all.

## Related Topics
- [discriminated-unions.md](./discriminated-unions.md)
- [union-types.md](./union-types.md)
- [any-unknown-never-void.md](./any-unknown-never-void.md)
- [type-assertions.md](./type-assertions.md)
- [non-null-assertion-operator.md](./non-null-assertion-operator.md)
