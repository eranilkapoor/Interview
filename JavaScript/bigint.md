# BigInt

`BigInt` (ES2020) is JavaScript's eighth primitive type, designed to represent integers of arbitrary precision — beyond the safe range of the `Number` type, which is a double-precision (64-bit) IEEE 754 float and can only represent integers exactly up to `Number.MAX_SAFE_INTEGER` (2^53 - 1 = 9,007,199,254,740,991). Beyond that limit, regular numbers start silently losing precision, which is dangerous for use cases like large IDs, cryptography, or precise financial/scientific computation.

A `BigInt` literal is written with an `n` suffix (`123n`), or created via the `BigInt()` function (`BigInt(123)` or `BigInt('123')`). `BigInt` values support the usual arithmetic operators (`+ - * / % **`), but division truncates toward zero (no fractional results — `BigInt` is integers only) and `BigInt` **cannot be mixed with `Number` in arithmetic** without explicit conversion, since that could silently produce misleading, imprecise results otherwise.

`BigInt` also has behavioral differences worth knowing: `typeof 10n` is `"bigint"` (a distinct type from `"number"`), it can't be used with `Math` object methods (which operate on `Number`), and it can't be serialized by `JSON.stringify()` directly (throws a `TypeError` unless you provide a custom `toJSON`/replacer).

## Examples

```js
// Precision loss with Number vs exactness with BigInt
console.log(Number.MAX_SAFE_INTEGER);       // 9007199254740991
console.log(Number.MAX_SAFE_INTEGER + 1);   // 9007199254740992 (correct, on the edge)
console.log(Number.MAX_SAFE_INTEGER + 2);   // 9007199254740992 (WRONG — precision lost!)

console.log(BigInt(Number.MAX_SAFE_INTEGER) + 2n); // 9007199254740993n (exact)
```

```js
// Mixing BigInt and Number requires explicit conversion
const big = 10n;
const num = 5;
// console.log(big + num); // TypeError: Cannot mix BigInt and other types
console.log(big + BigInt(num)); // 15n
console.log(Number(big) + num); // 15 (loses BigInt precision guarantees once converted)
```

```js
// BigInt division truncates; typeof and JSON limitations
console.log(7n / 2n);   // 3n — integer division, no remainder/fraction
console.log(typeof 10n); // "bigint"
try {
  JSON.stringify({ id: 10n });
} catch (e) {
  console.log(e.message); // "Do not know how to serialize a BigInt"
}
```

## Common Pitfalls / Gotchas

- Mixing `BigInt` and `Number` directly in arithmetic (`10n + 5`) — throws `TypeError`; always explicitly convert one side.
- Assuming `BigInt` supports decimals — it's integer-only; `7n / 2n` truncates to `3n`, it does not produce `3.5n`.
- Trying to `JSON.stringify` an object containing a `BigInt` — throws by default; you need a custom replacer function that converts `BigInt`s to strings first.
- Using `BigInt` for everyday numeric values "just to be safe" — it has real performance overhead compared to `Number` and should be reserved for cases that genuinely need arbitrary precision beyond `Number.MAX_SAFE_INTEGER`.

## Interview Questions & Answers

**Q: Why was `BigInt` introduced when JavaScript already had `Number`?**
A: `Number` is a 64-bit float that can only represent integers exactly up to 2^53 - 1. Beyond that, precision silently degrades, which is unacceptable for use cases like large unique IDs, cryptographic computations, or exact large-integer math. `BigInt` provides arbitrary-precision integer arithmetic to fill that gap.

**Q: Can you add a `BigInt` and a `Number` together directly?**
A: No — doing so throws a `TypeError: Cannot mix BigInt and other types, use explicit conversions`. You must convert one operand explicitly, either `BigInt(numberValue)` (to gain precision) or `Number(bigintValue)` (which reintroduces the precision-loss risk `BigInt` was meant to avoid).

**Q: How does division work with BigInt values?**
A: It performs integer division, truncating toward zero — there is no fractional/decimal result. `7n / 2n` is `3n`, not `3.5n`, because `BigInt` only represents whole numbers.

## Related Topics
- [primitive-types.md](./primitive-types.md)
- [datatypes-in-javascript.md](./datatypes-in-javascript.md)
- [es2020.md](./es2020.md)
