# Operators in JavaScript

Operators are special symbols or keywords that perform operations on one, two, or three operands (unary, binary, and the single ternary operator, respectively). JavaScript groups them into categories: arithmetic (`+ - * / % **`), assignment (`= += -= *= /= **= &&= ||= ??=`), comparison (`== === != !== > < >= <=`), logical (`&& || !`), bitwise (`& | ^ ~ << >> >>>`), string (`+` for concatenation), conditional/ternary (`? :`), and special operators like `typeof`, `instanceof`, `in`, `delete`, `void`, `,` (comma), spread/rest (`...`), optional chaining (`?.`), and nullish coalescing (`??`).

Operator precedence and associativity determine evaluation order when multiple operators appear in one expression (e.g., `*`/`/` bind tighter than `+`/`-`, and most binary operators are left-associative while assignment and exponentiation are right-associative). Logical operators `&&` and `||` are also frequently used for control flow beyond boolean logic — thanks to short-circuit evaluation, `a && b` returns `a` if it's falsy (never evaluating `b`), and `a || b` returns `a` if it's truthy — a pattern historically used for default values before `??` existed.

Modern additions like logical assignment operators (`&&=`, `||=`, `??=`, ES2021) and the nullish coalescing operator (`??`, ES2020) refine these older idioms by making intent more precise — particularly `??`, which only falls back on `null`/`undefined` rather than every falsy value, fixing a long-standing footgun with `||` defaults (see [nullish-coalescing.md](./nullish-coalescing.md)).

## Examples

```js
// Short-circuit evaluation with && and ||
function greet(name) {
  const displayName = name || 'Guest'; // falls back for any falsy name, including ''
  console.log(`Hello, ${displayName}`);
}
greet('');       // "Hello, Guest" (possibly not intended — '' is falsy)
greet('Anil');   // "Hello, Anil"
```

```js
// Nullish coalescing assignment vs || default (ES2021 logical assignment)
let count = 0;
let a = count || 10;   // 10 — 0 is falsy, so || overrides it (likely a bug)
let b = count ?? 10;   // 0  — ?? only falls back for null/undefined
console.log(a, b);     // 10 0
```

```js
// Bitwise & comparison operators
console.log(5 & 3);      // 1  (bitwise AND: 0101 & 0011 = 0001)
console.log(5 | 2);      // 7  (bitwise OR)
console.log(typeof 'x'); // "string"
console.log('a' in { a: 1 }); // true — checks for property existence
```

## Common Pitfalls / Gotchas

- Using `||` for default values when `0`, `''`, or `false` are legitimate values you want to keep — use `??` instead, which only triggers for `null`/`undefined`.
- Confusing bitwise operators (`&`, `|`) with logical operators (`&&`, `||`) — bitwise operators operate on the binary representation of numbers, not boolean logic, and are rarely what you want in everyday application code.
- Forgetting operator precedence and relying on it implicitly instead of parentheses — e.g., `a ?? b || c` throws a `SyntaxError` because mixing `??` directly with `||`/`&&` without parentheses is disallowed by the spec.
- Misusing the comma operator (`a, b`) accidentally in complex expressions, evaluating both but only returning the last value — rarely intentional outside of `for` loop headers.

## Interview Questions & Answers

**Q: What's the difference between `||` and `??` for providing default values?**
A: `||` returns its right operand whenever the left operand is *falsy* (`0`, `''`, `false`, `null`, `undefined`, `NaN`). `??` returns its right operand only when the left operand is *nullish* (`null` or `undefined` specifically). `??` is safer for defaults when `0`, `''`, or `false` are valid values you don't want overridden.

**Q: Why can't you write `a ?? b || c` without parentheses?**
A: The spec explicitly disallows directly mixing `??` with `&&`/`||` without parentheses because their relative precedence would be ambiguous/surprising; you must write `(a ?? b) || c` or `a ?? (b || c)` to disambiguate.

**Q: Explain short-circuit evaluation and a practical use for it.**
A: `&&` and `||` don't evaluate their right operand unless necessary: `a && b` skips `b` if `a` is falsy; `a || b` skips `b` if `a` is truthy. This is used for conditional execution (`isLoggedIn && renderDashboard()`) and for default value fallbacks (though `??` is often more correct for the latter).

**Q: What does the `in` operator do, and how is it different from `hasOwnProperty`?**
A: `in` checks whether a property exists anywhere on the object *or its prototype chain* (`'toString' in {}` is `true`). `Object.prototype.hasOwnProperty()` checks only the object's own properties, ignoring inherited ones.

## Related Topics
- [type-coercion.md](./type-coercion.md)
- [nullish-coalescing.md](./nullish-coalescing.md)
- [optional-chaining.md](./optional-chaining.md)
- [es2020.md](./es2020.md)
