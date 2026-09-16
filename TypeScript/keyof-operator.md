# keyof Operator

The `keyof` operator takes an object type and produces a **union of its property names as literal types**. Given `interface User { id: number; name: string; }`, `keyof User` evaluates to `"id" | "name"` — a type-level extraction of just the keys, discarding the value types entirely. It's the type-system equivalent of `Object.keys()`, except it works purely on the *type*, at compile time, and produces a precise, checked union rather than a runtime `string[]`.

`keyof` is most commonly combined with generics to write functions that operate safely on "any key of a given object type" — the canonical example is a generic `getProperty<T, K extends keyof T>(obj: T, key: K): T[K]` function, where the constraint `K extends keyof T` restricts `key` to only the object's actual property names, and the indexed access type `T[K]` (see below) gives back the precise value type for whichever key was passed. This pattern is how many built-in utility types and most real-world "safe property access" helper functions are implemented.

Closely related is the **indexed access type**, `T[K]`, which looks up the type of a specific property (or union of properties) on `T` — `User["name"]` is `string`; `User["id" | "name"]` is `string | number` (the union of both property types). Combined, `keyof` and indexed access let you derive new types directly from an existing type's structure instead of hand-duplicating it, which is exactly the mechanism mapped types use internally (`{ [K in keyof T]: ... }`) to transform one object type into another while staying in sync with the original automatically.

`keyof` also works on types with index signatures (`keyof { [key: string]: number }` is `string | number`, since JavaScript also allows numeric-looking string keys), and on `keyof any`, which resolves to `string | number | symbol` — the full set of possible object property key types in JavaScript.

## Examples

```ts
// Basic keyof — union of an object type's property names
interface User {
  id: number;
  name: string;
  email: string;
}
type UserKeys = keyof User; // "id" | "name" | "email"
```

```ts
// keyof + generic constraint + indexed access — a type-safe generic property getter
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
const user: User = { id: 1, name: "Anil", email: "a@x.com" };
const name = getProperty(user, "name"); // inferred: string
// getProperty(user, "phone"); // Compile error: "phone" is not a key of User
```

```ts
// Indexed access types for deriving value types directly from a structure
type UserId = User["id"];             // number
type NameOrEmail = User["name" | "email"]; // string
type AllValues = User[keyof User];     // number | string — every possible property value type
```

## Common Pitfalls / Gotchas

- Forgetting that `keyof` on a type with an index signature includes `number` in the result if the index signature's key is `string` — since JavaScript coerces numeric object keys to strings internally, `keyof { [key: string]: number }` is `string | number`, not just `string`.
- Confusing `keyof T` (a type-level operation on a type, producing a union of its key names) with `Object.keys(obj)` (a runtime operation on a value, producing a `string[]`) — they're related in spirit but operate at entirely different phases (compile time vs. runtime) and `Object.keys()`'s return type is only ever `string[]`, regardless of what `keyof` on the same shape would say.
- Using `keyof T` without a generic constraint context and being surprised the result is a union type, not something you can iterate at runtime directly — `keyof` produces a type, not a value; you still need `Object.keys()` (typically asserted or narrowed) to get runtime key strings.
- Not using `K extends keyof T` when a function parameter is meant to be "any valid key of this object" — without the constraint, TypeScript can't verify the key argument actually exists on the object, losing both the safety check and the precise return-type inference via `T[K]`.

## Interview Questions & Answers

**Q: What does `keyof` do, and what's an example?**
A: It takes an object type and produces a union of its property names as string (or symbol/number) literal types. For `interface User { id: number; name: string }`, `keyof User` is `"id" | "name"`.

**Q: How would you write a generic function that safely gets a property from any object, given a key?**
A: `function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] { return obj[key]; }` — the `K extends keyof T` constraint ensures only valid keys of `T` can be passed, and the `T[K]` indexed access return type gives back the exact type of whichever property was requested.

**Q: What's the difference between `keyof T` and `Object.keys(obj)`?**
A: `keyof T` is a compile-time type operation on a *type*, producing a union of literal key types with no runtime existence. `Object.keys(obj)` is a runtime operation on an actual *value*, returning a real `string[]` array of the object's own enumerable keys — and its TypeScript return type is always `string[]`, not the more precise `keyof`-derived union, since TypeScript can't guarantee at runtime that the object has exactly the keys its static type claims.

**Q: What does `T[K]` (indexed access) do, combined with `keyof`?**
A: It looks up the type of a specific property (or union of properties) on `T` — e.g., `User["name"]` evaluates to `string`. Combined with `keyof`, `T[keyof T]` gives the union of *every* property's value type on `T`, useful for expressing "any value this object could hold."

## Related Topics
- [typeof-operator.md](./typeof-operator.md)
- [mapped-types.md](./mapped-types.md)
- [generic-constraints.md](./generic-constraints.md)
- [utility-types.md](./utility-types.md)
- [index-signatures.md](./index-signatures.md)
