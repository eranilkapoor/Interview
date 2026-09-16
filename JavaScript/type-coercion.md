# Type Coercion

Type coercion is JavaScript's automatic (implicit) or manual (explicit) conversion of a value from one type to another. Implicit coercion happens behind the scenes when operators or contexts expect a particular type — for example, the `+` operator coerces operands to strings if either side is a string, while `-`, `*`, `/` coerce operands to numbers. Explicit coercion is when you deliberately convert a value using functions like `String(x)`, `Number(x)`, `Boolean(x)`, or shorthand idioms like `+x` (to number) and `!!x` (to boolean).

The `==` (loose equality) operator is the most infamous source of coercion-related confusion: it converts operands to a common type before comparing, following a specific, documented algorithm (the Abstract Equality Comparison). `===` (strict equality) skips coercion entirely and compares both type and value directly, which is why senior engineers overwhelmingly recommend `===` by default — it makes comparisons predictable and removes an entire class of "wait, why is that true?" bugs.

Understanding coercion rules well enough to predict outputs like `[] + []` (`""`), `[] + {}` (`"[object Object]"`), `1 + '1'` (`"11"`), and `'5' - 1` (`4`) is a classic interview signal — not because anyone should write code that relies on these conversions, but because it demonstrates a real understanding of how JS's abstract operations (`ToPrimitive`, `ToString`, `ToNumber`) work under the hood.

## Examples

```js
// + coerces to string if either operand is a string; otherwise numeric addition
console.log(1 + '1');   // "11" (string concatenation)
console.log(1 + 1);     // 2   (numeric addition)
console.log('5' - 1);   // 4   (- always coerces to number)
console.log('5' * '2'); // 10  (* coerces both to number)
```

```js
// == vs === : loose equality coerces, strict equality does not
console.log(0 == '0');    // true  (string coerced to number)
console.log(0 === '0');   // false (different types)
console.log(null == undefined);  // true  (special-cased in the spec)
console.log(null === undefined); // false
console.log([] == false); // true  ([] -> "" -> 0, false -> 0)
```

```js
// Explicit coercion is safer and self-documenting
console.log(Number('42'));   // 42
console.log(String(42));     // "42"
console.log(Boolean(''));    // false
console.log(!!'hello');      // true — shorthand boolean coercion
console.log(+'3.14');        // 3.14 — shorthand numeric coercion
```

## Common Pitfalls / Gotchas

- Using `==` instead of `===` and getting surprising `true` results (`[] == false`, `'' == 0`) — always prefer `===`/`!==` unless you have a specific, well-understood reason to coerce.
- Forgetting that `NaN === NaN` is `false` — use `Number.isNaN()` or `Object.is()` to check for `NaN` correctly.
- Assuming `+` between two arrays concatenates them like `Array.prototype.concat` — it actually stringifies both and concatenates strings: `[1,2] + [3,4]` is `"1,23,4"`, not `[1,2,3,4]`.
- Relying on implicit truthy/falsy coercion for validation without considering edge cases — `if (count)` is falsy for both `0` (a valid, meaningful value) and `undefined` (missing), which can hide bugs.

## Interview Questions & Answers

**Q: What's the difference between `==` and `===`, and which should you default to?**
A: `==` performs type coercion before comparing (converting operands to a common type per the Abstract Equality Comparison algorithm); `===` compares both type and value with no coercion. Default to `===` — it's predictable and avoids a well-known category of bugs; reserve `==` only for the rare, deliberate case of checking `x == null` (which matches both `null` and `undefined`).

**Q: Why does `[] + []` produce `""` and `[] + {}` produce `"[object Object]"`?**
A: The `+` operator first calls `ToPrimitive` on both operands. Arrays/objects convert to primitives via their `toString()` (absent a numeric hint) — `[].toString()` is `""`, and `{}.toString()` is `"[object Object]"`. Since at least one operand becomes a non-numeric string-like primitive, `+` performs string concatenation, giving `""+"" = ""` and `""+"[object Object]" = "[object Object]"`.

**Q: What is `NaN`, and why does `NaN === NaN` evaluate to `false`?**
A: `NaN` ("Not a Number") represents an invalid numeric result (e.g., `0/0`, `parseInt('abc')`). Per the IEEE 754 floating-point standard (which JS numbers follow), `NaN` is defined to never equal anything, including itself — this is a mathematical convention, not a JS-specific quirk. Use `Number.isNaN(x)` or `Object.is(x, NaN)` to test for it reliably.

**Q: Give an example of explicit coercion you'd prefer over implicit coercion, and why.**
A: `Number(input)` or `parseInt(input, 10)` instead of relying on `input * 1` or `+input` inside a larger expression — explicit conversion functions make the intent obvious to a reader and avoid the ambiguity of unary `+`/`*` blending into surrounding arithmetic.

## Related Topics
- [datatypes-in-javascript.md](./datatypes-in-javascript.md)
- [types-in-javascript.md](./types-in-javascript.md)
- [operators-in-javascript.md](./operators-in-javascript.md)
