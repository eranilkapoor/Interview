# Index Signatures

An index signature describes the type of properties on an object when you don't know every property name in advance, but you do know what type the keys and values will be — for example, a dictionary/lookup object where any string key maps to a `number`. The syntax `{ [key: string]: number }` says "this object can be indexed by any string, and whatever you get back will be a `number`" — it's how TypeScript types genuinely dynamic, map-like objects, as opposed to interfaces/type aliases with a fixed, known set of named properties.

TypeScript supports `string`, `number`, `symbol`, and (since TS 4.4) template-literal-pattern keys as index signature key types. A subtlety worth knowing: a `number` index signature is really a *refinement* of a `string` index signature in TypeScript's model, because JavaScript itself converts numeric object keys to strings under the hood — if you declare both, the `number` index signature's value type must be a subtype of (assignable to) the `string` index signature's value type, mirroring this runtime reality. An object type can combine an index signature with explicitly named properties, as long as each named property's type is compatible with the index signature's value type (since accessing that named property via bracket notation would otherwise conflict with what the index signature promises).

Index signatures interact with `noUncheckedIndexedAccess` (a `strict`-adjacent flag) in an important way: by default, indexing into `{ [key: string]: number }` gives you back `number` — but nothing stops the key from simply not existing on the actual object at runtime (dictionaries commonly have gaps). With `noUncheckedIndexedAccess` enabled, indexed access instead returns `number | undefined`, correctly modeling the real possibility of a missing key and forcing you to handle that case, at the cost of an extra check almost everywhere you use bracket-notation dictionary access.

In modern TypeScript, `Record<K, V>` (a built-in utility type) is often preferred over a raw index signature for simple string/number-keyed dictionaries, since it reads more clearly and composes better with a union of literal keys (`Record<"a" | "b" | "c", number>`), though a hand-written index signature remains necessary for open-ended (non-literal) key sets or when mixing with named properties.

## Examples

```ts
// A basic string index signature — a dictionary of numbers
interface ScoresByPlayer {
  [playerName: string]: number;
}
const scores: ScoresByPlayer = { anil: 90, priya: 85 };
scores["new-player"] = 70; // fine — any string key is allowed
```

```ts
// Combining an index signature with named properties (must stay compatible)
interface Config {
  name: string;           // must be assignable to the index signature's value type below
  [key: string]: string;  // every other property must also be a string
}
const cfg: Config = { name: "app", version: "1.0" };
// interface Bad { count: number; [key: string]: string; } // Compile error: incompatible types
```

```ts
// noUncheckedIndexedAccess models the real possibility of a missing key
interface Inventory {
  [item: string]: number;
}
const stock: Inventory = { apples: 10 };
const bananas = stock["bananas"]; // without the flag: number (misleading — key doesn't exist)
// with "noUncheckedIndexedAccess": true, type is `number | undefined`, forcing a check:
if (bananas !== undefined) {
  console.log(bananas + 1);
}

// Record<K, V> as a common alternative for closed key sets
type Theme = Record<"light" | "dark", { background: string }>;
const theme: Theme = {
  light: { background: "#fff" },
  dark: { background: "#000" },
};
```

## Common Pitfalls / Gotchas

- Assuming indexed access always returns a defined value — without `noUncheckedIndexedAccess`, TypeScript optimistically types the result as the value type alone (no `| undefined`), even though a dictionary access for a nonexistent key returns `undefined` at runtime; enabling that flag closes this gap at the cost of extra checks.
- Mixing a number index signature and a string index signature with incompatible value types — TypeScript requires the number index signature's value type to be assignable to the string index signature's, mirroring how JS coerces numeric keys to strings internally.
- Adding a named property whose type isn't compatible with an existing index signature's value type on the same object type — this is a compile error, since bracket-notation access to that same property must also satisfy the index signature's promised type.
- Reaching for a raw index signature when the actual key set is a small, known, finite union of literals — `Record<"a" | "b", V>` (or a plain object type with named properties) documents the intent more precisely and catches typo'd keys that an open-ended `[key: string]: V` signature would silently allow.

## Interview Questions & Answers

**Q: What is an index signature, and when would you use one?**
A: A type like `{ [key: string]: number }` that describes objects with an open-ended, dynamic set of keys of a known key type, all mapping to a known value type. Use it for genuine dictionary/lookup-style objects where the specific property names aren't known or fixed ahead of time — as opposed to interfaces/type aliases for objects with a fixed, known set of named properties.

**Q: What does `noUncheckedIndexedAccess` change about index signatures?**
A: Without it, indexing into an object with an index signature returns the declared value type outright, even though the key might not actually exist at runtime. With it enabled, indexed access instead returns `value type | undefined`, correctly modeling that possibility and forcing an explicit check before use.

**Q: Can an object type have both named properties and an index signature at the same time?**
A: Yes, as long as every named property's type is compatible with (assignable to) the index signature's value type — since accessing that named property via bracket notation must still satisfy what the index signature promises for any key.

**Q: When would you prefer `Record<K, V>` over writing a raw index signature?**
A: When the key set is a small, known, finite set of literal string/number values (e.g., `Record<"light" | "dark", Theme>`) — `Record` documents the exact allowed keys and catches typos, whereas a raw `[key: string]: V` index signature accepts any string key with no such check.

## Related Topics
- [type-aliases.md](./type-aliases.md)
- [utility-types.md](./utility-types.md)
- [mapped-types.md](./mapped-types.md)
- [strict-mode.md](./strict-mode.md)
- [interfaces.md](./interfaces.md)
