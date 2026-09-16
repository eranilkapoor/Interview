# Optional Chaining & Nullish Coalescing (TS-Specific Behavior/Config)

Optional chaining (`?.`) and nullish coalescing (`??`) are actually native JavaScript (ES2020) operators, not TypeScript inventions — but TypeScript shipped support for them *before* they landed in most JavaScript engines (introducing them in TypeScript 3.7, compiling them down to equivalent older-JS-compatible code for older targets), and more importantly, TypeScript's **static type checker** understands and narrows through them in ways plain runtime JavaScript has no equivalent for, which is what makes them worth covering specifically in a TypeScript context rather than a general JS one.

`?.` short-circuits a property access, method call, or index access to `undefined` the instant it encounters a `null`/`undefined` value anywhere along the chain, instead of throwing — `user?.address?.city` returns `undefined` immediately if `user` or `user.address` is nullish, without ever attempting to read `.city` off of `null`. TypeScript's type checker reflects this precisely in the resulting type: the expression's static type becomes `T | undefined` (where `T` is whatever the final property's type would otherwise be), forcing you to handle the possibly-`undefined` result downstream — this is exactly the kind of static guarantee `strictNullChecks` is designed to give you, and `?.` is its most common practical companion.

`??` provides a default value specifically for `null`/`undefined` (and only those two), unlike the older `||` pattern, which falls back for *any* falsy value (`0`, `""`, `false`, `NaN`, `null`, `undefined`). This distinction is a frequent, genuine source of bugs: `count || 10` incorrectly substitutes `10` when `count` is legitimately `0`, while `count ?? 10` correctly preserves `0` and only substitutes when `count` is actually `null`/`undefined`. TypeScript's type checker also correctly narrows the *type* of a `??` expression — `(value: string | null) ?? "default"` has the static type `string` (not `string | null`), since the compiler knows the `null` branch is fully handled by the fallback.

The two combine especially well as `?.` followed by `??` (`user?.address?.city ?? "Unknown"`), and TypeScript also supports **optional chaining with function calls** (`callback?.()`) and **optional element access** (`array?.[0]`), both benefiting from the same static `| undefined` typing and narrowing behavior.

## Examples

```ts
// Optional chaining — short-circuits to undefined, TypeScript types the result as T | undefined
interface Address { city: string; }
interface User { name: string; address?: Address; }

function getCity(user: User): string | undefined {
  return user.address?.city; // no error even though `address` might be missing
}
```

```ts
// Nullish coalescing vs || — the classic 0/"" bug
function getCount(count: number | null): number {
  return count ?? 10; // correctly returns 0 if count is 0, only falls back on null/undefined
}
function getCountBuggy(count: number | null): number {
  return count || 10; // BUG: incorrectly returns 10 even when count is legitimately 0
}
console.log(getCount(0));      // 0 — correct
console.log(getCountBuggy(0)); // 10 — wrong!
```

```ts
// Optional call and optional element access, combined with ??
interface Options {
  onSave?: () => void;
  items?: string[];
}
function run(options: Options) {
  options.onSave?.(); // calls onSave only if it's defined; no "not a function" crash
  const first = options.items?.[0] ?? "none"; // safely reads index 0, falls back if missing
}
```

## Common Pitfalls / Gotchas

- Using `||` instead of `??` for a default value when `0`, `""`, or `false` are legitimate, meaningful values — `||` incorrectly overrides those falsy-but-valid values, while `??` only triggers on actual `null`/`undefined`.
- Assuming `?.` protects against *any* invalid access, not just `null`/`undefined` — it only short-circuits specifically for nullish values; accessing a property that doesn't exist on a non-nullish object still behaves like a normal (type-checked) property access, and calling `?.()` on something that isn't nullish but also isn't callable still throws at runtime.
- Mixing `??` directly with `||` or `&&` in the same expression without parentheses — TypeScript (matching the JS spec) disallows this ambiguous combination as a syntax error, requiring explicit parentheses to clarify precedence.
- Forgetting that without `strictNullChecks` enabled, the whole motivation for `?.`/`??` weakens considerably, since `null`/`undefined` are silently assignable everywhere anyway, and the type checker won't flag a missing chain/fallback as clearly.

## Interview Questions & Answers

**Q: What's the difference between `??` and `||` for providing a default value?**
A: `??` (nullish coalescing) only falls back to the right-hand side when the left-hand side is specifically `null` or `undefined`. `||` falls back for *any* falsy value, including `0`, `""`, `false`, and `NaN` — which is usually not the intended behavior when those are legitimate values you want to preserve.

**Q: What type does TypeScript infer for `user?.address?.city` if `address` is optional and `city` is a `string`?**
A: `string | undefined` — since the chain can short-circuit to `undefined` at any nullish link, the compiler reflects that possibility in the static type of the whole expression, forcing callers to handle the possibly-missing result.

**Q: Are optional chaining and nullish coalescing TypeScript-only features?**
A: No — they're standard JavaScript (ES2020) operators. TypeScript added support for them ahead of broad runtime availability (compiling them down for older targets) and, more distinctively, its static type checker understands and narrows through them precisely, which is the main TypeScript-specific value-add beyond what plain JavaScript provides at runtime.

**Q: How would you safely call an optional callback function prop without risking a "not a function" error?**
A: `options.onSave?.();` — optional call syntax invokes `onSave` only if it's not `null`/`undefined`, evaluating to `undefined` and skipping the call entirely otherwise, avoiding a runtime error from trying to invoke something that isn't there.

## Related Topics
- [type-guards-and-narrowing.md](./type-guards-and-narrowing.md)
- [non-null-assertion-operator.md](./non-null-assertion-operator.md)
- [strict-mode.md](./strict-mode.md)
- [basic-types.md](./basic-types.md)
- [union-types.md](./union-types.md)
