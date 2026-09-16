# Mapped Types

A mapped type builds a new object type by iterating over the keys of an existing type and transforming each property in a uniform way — the syntax `{ [K in keyof T]: SomeTransformation<T[K]> }` reads almost like a `for...in` loop, but at the type level: "for every key `K` in `T`, produce a new property whose value type is derived from `T[K]`." This is precisely how nearly every built-in object-transforming utility type is implemented internally — `Partial<T>`, `Required<T>`, `Readonly<T>`, `Pick<T, K>`, and `Record<K, V>` are all just specific mapped types the TypeScript standard library ships for you.

Mapped types can add or remove modifiers during the transformation using `+`/`-` prefixes on `readonly` and `?`: `{ [K in keyof T]?: T[K] }` makes every property optional (this is literally `Partial<T>`'s definition), `{ readonly [K in keyof T]: T[K] }` makes every property readonly (`Readonly<T>`'s definition), and `{ -readonly [K in keyof T]-?: T[K] }` explicitly strips both `readonly` and optionality from every property, regardless of whether the source type had them. Since TypeScript 4.1, mapped types also support **key remapping** via an `as` clause inside the mapping (`{ [K in keyof T as NewKeyExpression]: T[K] }`), which lets you rename, filter out (by mapping a key to `never`), or transform keys themselves — not just their values — commonly combined with template literal types to programmatically generate new key names (e.g., turning `click` into `onClick`).

Mapped types are generic by nature (`T` is almost always itself a generic type parameter of an enclosing type alias) and compose naturally with conditional types inside the value position for more selective transformations — for example, a mapped type that only makes *some* properties optional based on a condition per key, rather than uniformly all of them. This combination (mapped types + conditional types + `infer`) is what powers most of TypeScript's more advanced "type-level programming" utility types found in real-world codebases and libraries like Redux Toolkit, tRPC, and Zod's inferred types.

Understanding mapped types deeply is essentially understanding how TypeScript's standard-library utility types are built — once you can read `{ [K in keyof T]?: T[K] }` and recognize it as `Partial<T>`'s actual definition, the rest of the utility-type library stops looking like magic and starts looking like a small set of composable, learnable patterns.

## Examples

```ts
// A hand-rolled Partial<T> — this is literally how the built-in Partial<T> is defined
type MyPartial<T> = {
  [K in keyof T]?: T[K];
};
interface User { id: number; name: string; }
type PartialUser = MyPartial<User>; // { id?: number; name?: string }
```

```ts
// Adding/removing modifiers explicitly with + and -
type MyRequired<T> = {
  [K in keyof T]-?: T[K]; // strips optionality from every property
};
type MyMutable<T> = {
  -readonly [K in keyof T]: T[K]; // strips readonly from every property
};
interface Config { readonly debug?: boolean; }
type FullConfig = MyRequired<MyMutable<Config>>; // { debug: boolean } — both modifiers removed
```

```ts
// Key remapping with `as` — renaming keys, combined with a template literal type
type EventHandlers<T> = {
  [K in keyof T as `on${Capitalize<string & K>}`]: (payload: T[K]) => void;
};
interface Events {
  click: MouseEvent;
  change: Event;
}
type Handlers = EventHandlers<Events>;
// { onClick: (payload: MouseEvent) => void; onChange: (payload: Event) => void }
```

## Common Pitfalls / Gotchas

- Forgetting that `Partial<T>`, `Required<T>`, `Readonly<T>`, and friends are all shallow mapped types — they only transform the top-level properties of `T`, not any nested object types within it; a nested property's own sub-properties keep their original modifiers.
- Not using the `as` key-remapping clause when you want to change/filter keys rather than just values — a mapped type without `as` can only transform each property's *value type*, keeping the original key names exactly as-is.
- Mapping a key to `never` in the value position without realizing the intent is usually to *filter it out entirely* — TypeScript actually omits a mapped property from the resulting type when its remapped key itself resolves to `never` (via the `as` clause), which is the standard pattern for conditionally excluding keys.
- Writing an overly complex, deeply nested mapped-type expression without breaking it into named intermediate type aliases — this makes both the type and any resulting compiler errors much harder to read and debug than composing a few simpler, well-named mapped types together.

## Interview Questions & Answers

**Q: What is a mapped type, and what's a simple example of one you might write by hand?**
A: A mapped type builds a new object type by iterating over another type's keys and transforming each property uniformly, using `{ [K in keyof T]: ... }` syntax. A simple hand-written example recreating `Partial<T>`: `type MyPartial<T> = { [K in keyof T]?: T[K] };` — makes every property of `T` optional.

**Q: How would you write a mapped type that removes `readonly` and makes every property required, regardless of the source type's modifiers?**
A: `type Mutable<T> = { -readonly [K in keyof T]-?: T[K] };` — the `-readonly` and `-?` modifiers explicitly strip both `readonly` and optionality from every mapped property.

**Q: What does key remapping with `as` inside a mapped type let you do that a plain mapped type can't?**
A: It lets you transform or filter the *keys themselves*, not just each property's value type — for example, renaming every key by prepending `on` and capitalizing it (`[K in keyof T as \`on${Capitalize<string & K>}\`]`), or omitting certain keys entirely by remapping their key expression to `never`, which TypeScript then drops from the resulting type.

**Q: How are TypeScript's built-in utility types like `Partial<T>` and `Readonly<T>` actually implemented?**
A: They're just mapped types shipped as part of TypeScript's standard type library — `Partial<T>` is `{ [K in keyof T]?: T[K] }`, `Readonly<T>` is `{ readonly [K in keyof T]: T[K] }`, and so on. There's no special compiler magic beyond the general mapped-type mechanism itself; they're ordinary generic mapped types you could write yourself.

## Related Topics
- [utility-types.md](./utility-types.md)
- [keyof-operator.md](./keyof-operator.md)
- [conditional-types.md](./conditional-types.md)
- [template-literal-types.md](./template-literal-types.md)
- [readonly-properties.md](./readonly-properties.md)
