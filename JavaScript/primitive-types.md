# Primitive Types

A primitive is a value that is not an object and has no methods of its own — `string`, `number`, `boolean`, `undefined`, `null`, `symbol`, and `bigint`. Primitives are **immutable**: you cannot change a primitive value in place; any operation that looks like mutation (e.g., `str.toUpperCase()`) actually produces a *new* primitive value rather than modifying the original in memory. They are also compared and copied by value — two primitives with identical content are always `===` equal, and assigning one to a new variable creates an independent copy.

When you call a method on a primitive, like `'hello'.toUpperCase()`, JavaScript temporarily wraps the primitive in its corresponding wrapper object (`String`, `Number`, `Boolean`) to give it access to prototype methods, then discards the wrapper — this is called "auto-boxing." This is why `typeof 'hello' === 'string'` even though you can call methods on it as if it were an object.

`Symbol` (ES2015) creates unique, unforgeable identifiers often used as non-colliding object property keys (e.g., for defining well-known protocol hooks like `Symbol.iterator`). `BigInt` (ES2020) represents arbitrarily large integers beyond `Number.MAX_SAFE_INTEGER` (2^53 - 1), suffixed with `n` (e.g., `10n`), and cannot be mixed with regular numbers in arithmetic without explicit conversion.

## Examples

```js
// Primitives are immutable — string methods return new values
let s = 'hello';
let upper = s.toUpperCase();
console.log(s, upper); // "hello" "HELLO" — original untouched
```

```js
// Auto-boxing: primitives temporarily wrapped to access methods
console.log(typeof 'hi');           // "string"
console.log(typeof new String('hi')); // "object" — explicit wrapper is different!
console.log('hi' === new String('hi')); // false — primitive vs wrapper object
```

```js
// Symbol and BigInt in practice
const id1 = Symbol('id');
const id2 = Symbol('id');
console.log(id1 === id2); // false — every Symbol is unique, even with the same description

const big = 9007199254740993n; // beyond Number.MAX_SAFE_INTEGER, precise with BigInt
console.log(big + 1n); // 9007199254740994n
// console.log(big + 1); // TypeError: Cannot mix BigInt and other types
```

## Common Pitfalls / Gotchas

- Using `new String()`, `new Number()`, or `new Boolean()` to create values — these produce objects, not primitives, and cause surprising `typeof`/comparison results; always use literal syntax instead.
- Mixing `BigInt` and `Number` in arithmetic expressions (`10n + 5`) — this throws a `TypeError`; you must explicitly convert one side (`10n + BigInt(5)` or `Number(10n) + 5`).
- Assuming string mutation methods (`.trim()`, `.slice()`, `.replace()`) modify the original string — they always return a new string because primitives are immutable.
- Forgetting `Symbol()` values are never equal to each other, even with identical descriptions — the description is just a debugging label, not an identity.

## Interview Questions & Answers

**Q: Why are primitives considered immutable, and what does that mean in practice?**
A: A primitive value's underlying bits never change once created; any "modification" (like `.toUpperCase()`) produces and returns a brand-new value. The original variable keeps pointing to the old value unless you explicitly reassign it — this contrasts with objects, whose properties can be mutated in place.

**Q: What is auto-boxing?**
A: The JS engine's behavior of temporarily wrapping a primitive value in its corresponding object wrapper (`String`, `Number`, `Boolean`) whenever you access a property or method on it, so that `'abc'.length` works even though strings are primitives with no methods of their own. The wrapper is discarded immediately after the operation.

**Q: What problem does BigInt solve, and what's a constraint on using it?**
A: `Number` in JS is a double-precision float and loses precision above `2^53 - 1`. `BigInt` represents arbitrary-precision integers exactly, useful for things like cryptography or very large IDs. The constraint: you cannot mix `BigInt` and `Number` directly in arithmetic — you must explicitly convert one to match the other's type.

**Q: What's the difference between `Symbol('id')` created twice — are they equal?**
A: No. Every call to `Symbol()` produces a completely unique value, even if given the same description string; the description is purely for debugging/logging, not for equality or lookup.

## Related Topics
- [datatypes-in-javascript.md](./datatypes-in-javascript.md)
- [bigint.md](./bigint.md)
- [immutability.md](./immutability.md)
- [type-coercion.md](./type-coercion.md)
