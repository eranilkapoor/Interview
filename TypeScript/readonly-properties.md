# Readonly Properties

The `readonly` modifier marks a property so it can only be assigned once — either at its declaration or inside the constructor of the class/object it belongs to — and is flagged as a compile error if reassigned anywhere afterward. It applies to interface members, type alias object properties, and class fields, and (as covered in [arrays-and-tuples.md](./arrays-and-tuples.md)) can also modify entire array/tuple types (`readonly number[]`) to forbid mutating methods like `push`/`pop`/`splice` and direct index assignment.

`readonly` is, like nearly every TypeScript-specific feature, a **compile-time-only** guarantee — it does not translate to any runtime immutability mechanism. The emitted JavaScript field or object is just an ordinary mutable property; nothing stops external, untyped, or type-checker-bypassing code from reassigning it at runtime. For genuine runtime immutability, you need `Object.freeze()` (a real JavaScript mechanism), and the two are frequently combined: `readonly` catches accidental reassignment attempts during development, while `Object.freeze()` guards against any that slip through at runtime, including from third-party code.

It's important to distinguish `readonly` (shallow) from deep immutability: marking a property `readonly` prevents reassigning *that property itself*, but if the property's value is an object or array, `readonly` says nothing about the mutability of *that nested value's own* properties — `readonly` is not automatically recursive. TypeScript's built-in `Readonly<T>` utility type has the same shallow-only limitation; achieving true deep immutability at the type level requires a custom recursive mapped type (or a well-tested third-party utility) that applies `readonly` at every nesting level.

`readonly` combines naturally with parameter properties on class constructors (`constructor(readonly id: string)`) for immutable identity fields, and with `as const` for object/array literals, which recursively infers every property as `readonly` and each value at its narrowest literal type — see [const-assertions.md](./const-assertions.md) for how the two relate.

## Examples

```ts
// readonly on interface and class properties
interface Point {
  readonly x: number;
  readonly y: number;
}
const p: Point = { x: 1, y: 2 };
// p.x = 5; // Compile error: cannot assign to 'x' because it is a read-only property

class Config {
  readonly apiKey: string;
  constructor(apiKey: string) {
    this.apiKey = apiKey; // OK — assignment inside the constructor is allowed
  }
}
const cfg = new Config("secret");
// cfg.apiKey = "new-secret"; // Compile error
```

```ts
// readonly is shallow — the property binding is locked, not the nested object's own contents
interface Settings {
  readonly theme: { color: string };
}
const settings: Settings = { theme: { color: "dark" } };
// settings.theme = { color: "light" }; // Compile error — can't reassign `theme` itself
settings.theme.color = "light"; // Allowed! `readonly` didn't reach into the nested object
```

```ts
// readonly (compile-time) vs Object.freeze() (runtime) — often used together
const frozen = Object.freeze({ id: 1, name: "Anil" } as const);
// frozen.name = "Priya"; // Compile error (as const → readonly) AND a silent no-op at runtime (frozen)

// Built-in Readonly<T> utility — same shallow limitation as a hand-written readonly property
type ReadonlyPoint = Readonly<{ x: number; y: number }>; // { readonly x: number; readonly y: number }
```

## Common Pitfalls / Gotchas

- Assuming `readonly` protects nested object properties automatically — it only locks the *top-level property binding itself*; the referenced object's own properties remain fully mutable unless they're independently marked `readonly` (or deeply frozen).
- Believing `readonly` provides real runtime immutability — like all TypeScript annotations, it's erased at compile time; pair it with `Object.freeze()` for genuine runtime enforcement.
- Trying to assign a `readonly` property outside its declaring class's constructor — even a single reassignment attempt anywhere else (another method, external code) is a compile error, by design.
- Forgetting that `Readonly<T>` (the built-in utility type) is also shallow — wrapping a deeply nested object type in `Readonly<T>` does not recursively protect nested objects; a custom recursive mapped type is needed for true deep type-level immutability.

## Interview Questions & Answers

**Q: What does the `readonly` modifier guarantee, and what does it not guarantee?**
A: It guarantees a property can only be assigned once (at declaration or within the declaring class's constructor) — any later reassignment is a compile-time error. It does not guarantee runtime immutability (the underlying JS property is still a normal mutable one unless separately frozen), and it does not make nested object/array values immutable — only the property binding itself.

**Q: Is `readonly` deep or shallow? What does that mean in practice?**
A: Shallow. Marking `theme: { color: string }` as `readonly` prevents reassigning `theme` to a different object entirely, but does not prevent mutating `theme.color` directly, since `readonly` only applies to the one property it's attached to, not recursively to everything inside it.

**Q: How do `readonly` and `Object.freeze()` differ, and why might you use both together?**
A: `readonly` is a compile-time-only TypeScript check with zero runtime effect — it's erased entirely when compiled. `Object.freeze()` is a real JavaScript runtime mechanism that actually prevents mutation of an object's own top-level properties. Using both gives you compile-time errors during development (catching mistakes early, with a clear message) plus a genuine runtime backstop against any mutation attempt that slips past the type checker (e.g., from untyped or third-party code).

**Q: How would you achieve genuinely deep, recursive readonly-ness at the type level, since `Readonly<T>` is shallow?**
A: By writing a custom recursive mapped type — typically a conditional type that checks if each property's value is itself an object, and if so, recursively applies the same deep-readonly mapping to it, rather than stopping at the first level the way the built-in `Readonly<T>` does.

## Related Topics
- [const-assertions.md](./const-assertions.md)
- [access-modifiers.md](./access-modifiers.md)
- [arrays-and-tuples.md](./arrays-and-tuples.md)
- [utility-types.md](./utility-types.md)
- [classes-in-typescript.md](./classes-in-typescript.md)
