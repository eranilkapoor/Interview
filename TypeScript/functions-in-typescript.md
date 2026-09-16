# Functions in TypeScript

TypeScript lets you annotate a function's parameters and return type, turning a function's signature into an explicit, compiler-checked contract instead of something callers have to infer from documentation or usage. Parameter types go after each parameter name (`function add(a: number, b: number): number`), and the return type goes after the closing parenthesis. As with variables, return types are usually inferable and often omitted for simple internal functions, but explicitly annotating return types on exported/public functions is good practice — it locks in a stable contract and produces a clear, localized error if a later change to the function body would otherwise silently alter its inferred return type.

Parameters can be marked **optional** with `?` (`function greet(name?: string)`), which makes their type implicitly include `undefined` and requires them to come after all required parameters, or given a **default value** (`function greet(name: string = "friend")`), which makes the parameter optional at the call site while giving it a concrete fallback and inferring its type from the default if not annotated. The **rest parameter** syntax (`...args: number[]`) types a variable-length trailing argument list as an array, exactly mirroring its JavaScript counterpart. Function types themselves can be written inline (`(a: number, b: number) => number`) for use as a parameter type, variable type, or property type — this is how you type callbacks and higher-order functions.

**Function overloads** let a single function name have multiple valid call signatures with different parameter/return type combinations — useful when a function's return type genuinely depends on *which* argument types were passed, in a way a simple union can't cleanly express. You write several signature declarations (no bodies) followed by one actual implementation signature (typically wider/using unions internally) with a body; only the overload signatures are visible to callers, and the implementation signature itself is not callable directly from outside.

Functions are also first-class values in TypeScript's type system: you can type a variable to hold a specific function shape, pass functions as parameters with fully-typed callback signatures, and return functions from functions with the return type fully expressed — all of this underlies how higher-order functions, currying, and generic utilities are safely typed throughout the language.

## Examples

```ts
// Parameter types, return type, optional and default parameters
function greet(name: string, greeting: string = "Hello", suffix?: string): string {
  return `${greeting}, ${name}${suffix ?? ""}`;
}
greet("Anil");                  // "Hello, Anil"
greet("Anil", "Hi", "!");       // "Hi, Anil!"
```

```ts
// Rest parameters and function types as values
function sum(...nums: number[]): number {
  return nums.reduce((total, n) => total + n, 0);
}
sum(1, 2, 3); // 6

const multiply: (a: number, b: number) => number = (a, b) => a * b;
function applyOp(a: number, b: number, op: (x: number, y: number) => number): number {
  return op(a, b); // `op` is fully typed as a callback here
}
applyOp(3, 4, multiply); // 12
```

```ts
// Function overloads — return type depends on which argument shape was passed
function parseInput(input: string): string[];
function parseInput(input: number): number[];
function parseInput(input: string | number): string[] | number[] {
  if (typeof input === "string") return input.split(",");
  return [input];
}
const a = parseInput("a,b,c"); // typed as string[]
const b = parseInput(42);       // typed as number[]
```

## Common Pitfalls / Gotchas

- Placing an optional or default parameter before a required one — TypeScript requires optional/default parameters to come after all required parameters in the parameter list.
- Forgetting that a function overload's actual *implementation* signature is not itself part of the public call signatures — callers only see the overload declarations, so the implementation signature should be a superset (typically using unions) that safely covers every overload's parameter/return combination.
- Not annotating return types on exported/library functions — an unannounced change to the function body can silently widen or narrow the inferred return type, breaking consumers without any compile error at the function's own declaration site.
- Confusing a rest parameter's array type with a tuple — `...args: number[]` accepts any number of `number` arguments; if you need a fixed count of specific per-position types, a tuple-typed rest parameter (`...args: [string, number]`) is the correct tool instead.

## Interview Questions & Answers

**Q: What's the difference between an optional parameter (`name?: string`) and a default parameter (`name: string = "x"`)?**
A: Both make the parameter optional at the call site. An optional parameter's type implicitly includes `undefined` if omitted, and you must handle that inside the function body. A default parameter is never actually `undefined` inside the function body — if omitted, it's automatically assigned its declared default value, and its type is inferred from that default if not explicitly annotated.

**Q: Why would you use function overloads instead of a single function with union-typed parameters?**
A: When the return type should vary in a way that's directly *tied* to which specific parameter type was passed, rather than always being the same union of possible return types. Overloads let callers get back the precise, narrowed return type for the arguments they actually passed, instead of a wider union they'd need to narrow themselves afterward.

**Q: Can a rest parameter have any type other than an array or tuple?**
A: No — a rest parameter must always be typed as an array (`...args: number[]`) or a tuple (`...args: [string, number]`) since it collects a variable number of trailing arguments into a single array-like value, mirroring the underlying JavaScript rest-parameter mechanic.

**Q: Why is it good practice to explicitly annotate return types on exported functions even though TypeScript can infer them?**
A: An explicit return type is a stable, intentional contract — if a later change to the function body would produce a different return type, that mismatch is caught immediately as a compile error right at the function's own declaration, rather than silently propagating a changed inferred type to every caller.

## Related Topics
- [type-inference.md](./type-inference.md)
- [generics.md](./generics.md)
- [union-types.md](./union-types.md)
- [arrays-and-tuples.md](./arrays-and-tuples.md)
- [classes-in-typescript.md](./classes-in-typescript.md)
