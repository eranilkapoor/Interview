# Nullish Coalescing (??)

The nullish coalescing operator (`??`, ES2020) returns its right-hand operand only when the left-hand operand is `null` or `undefined` — and *only* those two values (collectively called "nullish"). It fixes the most common misuse of `||` for default values, where `||` incorrectly overrides every falsy value (`0`, `''`, `false`, `NaN`), not just genuinely "missing" ones.

`??` pairs naturally with optional chaining (`?.`) to provide a safe default when a deeply nested property might not exist: `obj?.a?.b ?? 'default'`. ES2021 added the logical assignment operator `??=`, which assigns the right-hand value to a variable *only if* the variable is currently nullish — a shorthand for `x = x ?? value;` — mirroring how `||=` and `&&=` shorthand their respective logical assignments.

As with `?.`, the spec disallows directly combining `??` with `&&`/`||` in the same expression without parentheses (`a ?? b || c` is a `SyntaxError`), specifically to prevent ambiguous-looking code where a reader might misjudge precedence — you must write `(a ?? b) || c` or similar to make intent explicit.

## Examples

```js
// The core difference from ||
function getCount(count) {
  return count ?? 0;
}
console.log(getCount(5));         // 5
console.log(getCount(0));         // 0   — correctly preserves a real 0
console.log(getCount(undefined)); // 0   — falls back only for nullish
console.log(getCount(null));      // 0

function getCountWithOr(count) {
  return count || 0;
}
console.log(getCountWithOr(0));   // 0 — but this "0" came from the fallback, not preserved!
```

```js
// Nullish coalescing assignment (??=, ES2021)
const config = { retries: 0, timeout: undefined };
config.retries ??= 3;  // retries stays 0 — it's not nullish
config.timeout ??= 5000; // timeout becomes 5000 — it WAS undefined
console.log(config); // { retries: 0, timeout: 5000 }
```

```js
// Combined with optional chaining for safe, correct defaults
const user = { settings: { volume: 0 } };
const volume = user.settings?.volume ?? 50;
console.log(volume); // 0 — correctly respects an intentional 0, unlike `|| 50` which would give 50
```

## Common Pitfalls / Gotchas

- Continuing to use `||` for defaults where `0`, `''`, or `false` are legitimate, meaningful values — this silently overrides them; `??` is almost always the more correct choice for "was this actually provided?" logic.
- Mixing `??` directly with `&&`/`||` without parentheses — this is a `SyntaxError` by spec design, not a runtime bug, so it fails fast during development at least.
- Assuming `??=` behaves like `||=` — they differ specifically on `0`, `''`, `false`, and `NaN`: `??=` leaves those untouched, `||=` would overwrite them.
- Forgetting `??` only checks for `null`/`undefined`, not "empty-ish" values in general — an empty string or empty array still passes through `??` unchanged.

## Interview Questions & Answers

**Q: What's the precise difference between `??` and `||`?**
A: `||` returns the right operand if the left is *falsy* (`0`, `''`, `false`, `null`, `undefined`, `NaN`). `??` returns the right operand only if the left is *nullish* (`null` or `undefined`). Use `??` when you want to preserve legitimate falsy values like `0` or `''` and only supply a fallback for genuinely missing data.

**Q: Why is `a ?? b || c` a syntax error?**
A: TC39 deliberately disallowed directly chaining `??` with `&&`/`||` without explicit parentheses, because their relative precedence would be non-obvious and error-prone to read; you must write `(a ?? b) || c` to clarify intent.

**Q: What does `x ??= value` do, and how is it different from `x ||= value`?**
A: `x ??= value` assigns `value` to `x` only if `x` is currently `null` or `undefined`. `x ||= value` assigns whenever `x` is falsy — so it would incorrectly override `x = 0` or `x = ''`, whereas `??=` correctly leaves those alone.

## Related Topics
- [optional-chaining.md](./optional-chaining.md)
- [operators-in-javascript.md](./operators-in-javascript.md)
- [es2020.md](./es2020.md)
- [type-coercion.md](./type-coercion.md)
