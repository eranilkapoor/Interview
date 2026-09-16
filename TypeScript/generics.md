# Generics

Generics let you write functions, interfaces, type aliases, and classes that work over *a variety of types* while still preserving the specific type information from one usage to the next, instead of either duplicating code per type or collapsing everything to `any` (which loses type safety) or `unknown` (which is safe but requires re-narrowing every time). A generic type parameter, conventionally named `T` (or `K`/`V`/`U` for additional ones), acts as a placeholder that gets filled in with a concrete type at each call/usage site: `function identity<T>(value: T): T` says "whatever type you give me, I'll give the same type back," and TypeScript tracks that specific type through the function.

The key benefit over `any` is that the *relationship* between input and output types is preserved and checked: `identity(5)` returns something TypeScript knows is `number`, not just "anything." This matters enormously for utility functions, data structures, and API clients that need to work generically across many shapes (an array wrapper, a `fetch` helper, a cache) without sacrificing the caller's specific type information at every usage site. Generic type parameters can usually be **inferred** from the arguments passed (see [type-inference.md](./type-inference.md)), so callers rarely need to write the explicit `<Type>` syntax themselves — it's mostly needed when there's no argument for TypeScript to infer from (e.g., an empty array, or a function with no parameters at all).

Generics extend beyond functions: a generic interface or type alias (`interface Box<T> { value: T }`) parameterizes an object shape, and a generic class (`class Stack<T> { push(item: T): void }`) parameterizes an entire class's instance members around one or more types supplied when the class is instantiated (`new Stack<number>()`). Multiple type parameters (`function pair<A, B>(a: A, b: B): [A, B]`), default type parameters (`interface Options<T = string>`), and constraints (restricting what a type parameter is allowed to be — see [generic-constraints.md](./generic-constraints.md)) round out the full generics toolkit.

Generics are the mechanism underneath nearly every built-in utility type (`Partial<T>`, `Pick<T, K>`, `ReturnType<T>`), Promise typing (`Promise<T>`), and array typing (`Array<T>`) — understanding generics deeply is a prerequisite for understanding almost every "advanced types" TypeScript feature, since mapped types, conditional types, and utility types are all generics applied at the type level rather than the value level.

## Examples

```ts
// A generic function — T is inferred from the argument, no explicit <Type> needed
function identity<T>(value: T): T {
  return value;
}
const num = identity(5);       // T inferred as number; num: number
const str = identity("hello"); // T inferred as string; str: string
```

```ts
// A generic interface and a generic class
interface Box<T> {
  value: T;
}
const numberBox: Box<number> = { value: 42 };

class Stack<T> {
  private items: T[] = [];
  push(item: T): void { this.items.push(item); }
  pop(): T | undefined { return this.items.pop(); }
}
const stack = new Stack<string>();
stack.push("a");
// stack.push(1); // Compile error: number is not assignable to string
```

```ts
// Multiple type parameters and a default type parameter
function pair<A, B>(a: A, b: B): [A, B] {
  return [a, b];
}
const p = pair("id", 42); // [string, number]

interface ApiResponse<T = unknown> {
  data: T;
  status: number;
}
const raw: ApiResponse = { data: "anything", status: 200 }; // T defaults to unknown
const typed: ApiResponse<{ id: number }> = { data: { id: 1 }, status: 200 };
```

## Common Pitfalls / Gotchas

- Reaching for `any` instead of a generic when a function genuinely needs to work across multiple types while preserving the relationship between input and output — `any` silently loses that relationship entirely, while a generic keeps it type-checked.
- Forgetting that TypeScript can't always infer a generic type parameter — e.g., calling a generic function with no arguments that reference `T` (`const box = makeBox()`) forces you to supply the type argument explicitly (`makeBox<number>()`) or accept a defaulted/inferred-as-`unknown` result.
- Over-parameterizing with generics where a plain union type would be simpler and clearer — generics are for preserving a type relationship across multiple positions (input to output, or across multiple parameters); if there's no such relationship to preserve, a union may be the more appropriate, simpler tool (see [generics.md](./generics.md) vs unions comparison in the README's curated Q&A).
- Not constraining a generic type parameter when the function body needs to rely on some property/method existing on it — an unconstrained `T` only allows operations valid on *every* possible type (effectively none beyond basic assignment), producing confusing errors until a constraint like `T extends { length: number }` is added.

## Interview Questions & Answers

**Q: What problem do generics solve that `any` doesn't?**
A: Generics preserve the specific relationship between a function's input and output types across a call, so the compiler still knows and checks the concrete type at each usage site. `any` disables checking entirely and loses that relationship — a function typed to accept and return `any` gives no guarantee the output relates to the input at all, and offers zero autocomplete or safety for consumers.

**Q: Can TypeScript always infer a generic type parameter automatically? When would you need to supply it explicitly?**
A: No — inference relies on the type parameter appearing in the function's actual arguments. If there's no argument to infer from (e.g., a zero-argument factory function, or an empty array literal with no other context), you typically need to supply the type argument explicitly, e.g. `createBox<number>()`.

**Q: How do generic constraints change what you can do inside a generic function's body?**
A: Without a constraint, `T` could be absolutely anything, so the compiler only permits operations valid for every conceivable type (essentially none beyond identity operations). A constraint like `T extends { length: number }` narrows the possibilities enough that the compiler will allow operations known to be valid for anything matching that constraint, like accessing `.length`.

**Q: What's the difference between a generic function and function overloads for handling multiple input types?**
A: A generic function has one implementation whose types adapt to whatever type argument is supplied, preserving a single consistent relationship between input and output types (e.g., "return the same type you were given"). Overloads let you declare genuinely *different* return types for specific, distinct input type combinations that don't follow one uniform generic relationship.

## Related Topics
- [generic-constraints.md](./generic-constraints.md)
- [generics-with-react.md](./generics-with-react.md)
- [utility-types.md](./utility-types.md)
- [type-inference.md](./type-inference.md)
- [functions-in-typescript.md](./functions-in-typescript.md)
