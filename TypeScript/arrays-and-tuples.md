# Arrays and Tuples

TypeScript describes arrays with the element type followed by `[]` (e.g., `number[]`) or, equivalently, the generic form `Array<number>` — both are identical; `[]` syntax is more common for simple element types, while `Array<T>` reads better with more complex element types. An array type only tells you *what kind of elements it contains*, not how many — `number[]` could have zero, one, or a thousand elements, and every element is guaranteed (as far as the type system is concerned) to be a `number`.

Tuples are TypeScript's answer to fixed-length, fixed-type-per-position arrays — something JavaScript arrays don't distinguish at all, but many APIs conceptually rely on (a `[key, value]` pair, an `[x, y]` coordinate, a `useState()` return value in React). A tuple type like `[string, number]` says "exactly two elements: the first is a `string`, the second is a `number`" — accessing index `0` gives you a `string`, index `1` gives you a `number`, and TypeScript flags an error if you try to add a third element or access an out-of-bounds index (under most configurations).

Tuples support optional elements (`[string, number?]`), rest elements (`[string, ...number[]]` for a fixed prefix plus a variable-length tail of one type), and named/labeled tuple elements purely for readability (`[x: number, y: number]`, which doesn't change the underlying type, just how it displays in tooling). `readonly` can be applied to both arrays (`readonly number[]`) and tuples (`readonly [string, number]`) to prevent mutation.

The key conceptual distinction to keep in mind: arrays model "a homogeneous, arbitrary-length collection," while tuples model "a heterogeneous, known-length, positionally-meaningful structure." Reach for a tuple when the position of each element carries distinct meaning (like `useState`'s `[value, setValue]`), and an array when you're modeling a genuine list of interchangeable items.

## Examples

```ts
// Arrays: homogeneous, arbitrary length
let scores: number[] = [10, 20, 30];
let names: Array<string> = ["Anil", "Priya"];
scores.push(40); // fine — same element type
// scores.push("oops"); // Compile error: string not assignable to number
```

```ts
// Tuples: fixed length, positional types
let point: [number, number] = [10, 20];
let entry: [string, number] = ["age", 30];

// entry = [30, "age"]; // Compile error: types in wrong positions
// entry.push("extra"); // allowed at compile time in some configs (a known tuple quirk) — avoid relying on it

// Labeled tuples improve readability without changing the type:
type Coordinate = [x: number, y: number];
function distance(a: Coordinate, b: Coordinate): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}
```

```ts
// Optional and rest elements in tuples; readonly tuples/arrays
type RGB = [red: number, green: number, blue: number, alpha?: number];
const color: RGB = [255, 0, 0]; // alpha omitted — fine

type StringsThenNumbers = [string, ...number[]];
const mixed: StringsThenNumbers = ["total", 1, 2, 3];

function useState<T>(initial: T): readonly [T, (next: T) => void] {
  let value = initial;
  return [value, (next: T) => { value = next; }] as const;
}
const [count, setCount] = useState(0); // familiar React-style tuple destructuring
```

## Common Pitfalls / Gotchas

- Relying on `array.push()` to bypass tuple length enforcement — historically, TypeScript's tuple types didn't fully prevent `.push()` from adding extra elements at runtime even though direct assignment/index access is checked; treat tuples as fixed-length by convention and avoid mutating methods on them.
- Forgetting that a plain array literal without an annotation is inferred as a widened array type (`(string | number)[]`), not a tuple, even when it "looks like" one positionally — you must explicitly annotate or use `as const` to get tuple inference.
- Using `any[]` when you actually know the element type — this silently disables checking on every element and defeats most of the value of typing the collection at all.
- Assuming `readonly number[]` and `ReadonlyArray<number>` behave differently — they're the same type, just two spellings; both forbid mutating methods (`push`, `pop`, `splice`, index assignment) at compile time.
- Confusing a tuple's fixed *known* length with actual runtime enforcement — TypeScript's tuple checks are compile-time only; nothing stops a `JSON.parse()`-derived array of the wrong length from being force-assigned to a tuple type via a type assertion.

## Interview Questions & Answers

**Q: What's the difference between an array type and a tuple type in TypeScript?**
A: An array type (`T[]`) describes a homogeneous collection of arbitrary length — every element is the same type. A tuple type (`[T, U, ...]`) describes a fixed-length collection where each position has its own, potentially different, type — order and count both matter.

**Q: How would you type a function that returns a pair like `[value, setValue]`, similar to React's `useState`?**
A: With a tuple return type, e.g. `function useState<T>(initial: T): [T, (next: T) => void]`. A plain array return type like `(T | ((next: T) => void))[]` would lose the positional guarantee that index `0` is always the value and index `1` is always the setter.

**Q: How do you make an array or tuple immutable at the type level?**
A: Prefix it with `readonly` (`readonly number[]` or `readonly [string, number]`), or use the generic `ReadonlyArray<T>` form. This disallows mutating methods like `push`/`pop`/`splice` and direct index assignment at compile time — though it's a compile-time-only guarantee, not a runtime freeze.

**Q: Does TypeScript prevent you from pushing extra elements onto a tuple at runtime?**
A: Not reliably — this is a known historical gap: direct index assignment and length are checked, but calling `.push()` on a tuple has in some TypeScript versions been allowed to silently add elements beyond the declared length. Treat tuples as fixed-length by convention rather than relying on the compiler to fully police mutating array methods.

## Related Topics
- [basic-types.md](./basic-types.md)
- [const-assertions.md](./const-assertions.md)
- [readonly-properties.md](./readonly-properties.md)
- [generics.md](./generics.md)
- [union-types.md](./union-types.md)
