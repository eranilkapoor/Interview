# Optional Chaining (?.)

Optional chaining (`?.`, ES2020) lets you safely access deeply nested object properties, call methods, or index into arrays without manually checking that each intermediate reference exists. If any part of the chain before a `?.` evaluates to `null` or `undefined`, the entire expression **short-circuits** and evaluates to `undefined` immediately, instead of throwing a `TypeError: Cannot read properties of undefined (or null)`.

Before optional chaining existed, safely accessing a nested value like `user.address.city` required verbose guard chains (`user && user.address && user.address.city`) or helper libraries like Lodash's `_.get()`. Optional chaining works for property access (`obj?.prop`), computed/bracket access (`obj?.[key]`), and function/method calls (`obj.method?.()`), the last of which is specifically useful for optionally calling a function only if it exists.

It's important to understand what optional chaining does *not* do: it doesn't suppress errors from accessing properties on values that are neither nullish nor an object (e.g., calling `?.` on a string still works fine since strings have properties, but it won't rescue you from genuinely wrong assumptions about a value's *shape* beyond nullishness) — and it doesn't replace validation for business-logic correctness, only for the specific "might be missing" case.

## Examples

```js
// Basic optional chaining avoids manual guard chains
const user = { profile: { name: 'Anil' } };
console.log(user.profile?.name);        // "Anil"
console.log(user.address?.city);        // undefined — no error, short-circuits safely
// console.log(user.address.city);      // TypeError without optional chaining
```

```js
// Optional method calls — useful for optional callbacks/hooks
const api = {
  onSuccess: null,
  fetchData() {
    // ... imagine data fetched here
    this.onSuccess?.('data loaded'); // only calls onSuccess if it's actually a function
  }
};
api.fetchData(); // no error even though onSuccess is null
```

```js
// Combining with computed access and nullish coalescing for defaults
const settings = { theme: { colors: null } };
const primaryColor = settings.theme?.colors?.['primary'] ?? 'blue';
console.log(primaryColor); // "blue" — chain short-circuits at colors (null), then ?? supplies default
```

## Common Pitfalls / Gotchas

- Assuming `?.` prevents *all* errors from bad property access — it only guards against `null`/`undefined` at that specific link in the chain; accessing a property on a number or other unexpected-but-non-nullish type still behaves per normal JS semantics (which may still be wrong for your use case).
- Overusing `?.` everywhere as a substitute for proper validation — it can silently mask bugs where a value should never actually be missing, turning a loud error into a quiet `undefined` that surfaces confusingly later.
- Forgetting that short-circuiting stops the *entire* chain, not just the next property — `a?.b.c.d` stops at `undefined` if `a` is nullish, without attempting `.c` or `.d` at all.
- Trying to use `?.` on the left-hand side of an assignment (`obj?.prop = value`) — this is a `SyntaxError`; optional chaining is read-only, not usable for assignment targets.

## Interview Questions & Answers

**Q: What does optional chaining do, and what problem did it solve?**
A: `?.` short-circuits property/method access to `undefined` when the preceding reference is `null` or `undefined`, instead of throwing. It replaced verbose manual guard chains (`a && a.b && a.b.c`) that were previously needed to safely read deeply nested, potentially-missing data.

**Q: How do you optionally call a function that might not exist, using `?.`?**
A: `obj.callback?.()` — this calls `callback` only if it's not `null`/`undefined`; if `callback` is missing, the whole expression short-circuits to `undefined` without throwing.

**Q: Does `a?.b.c` stop only at `b`, or can it protect `c` too if `b` is nullish?**
A: If `a` is nullish, the entire chain short-circuits at that point and evaluates to `undefined` — `.c` is never even attempted. But if `a` is fine and `b` turns out to be `null`/`undefined`, then `.c` (which has no `?.` before it) *will* throw, because optional chaining only protects the specific link where `?.` is written, not automatically every link after it.

**Q: Can optional chaining be used for assignment, like `obj?.prop = 5`?**
A: No — that's a `SyntaxError`. Optional chaining is only valid for reading/calling, not as an assignment target.

## Related Topics
- [nullish-coalescing.md](./nullish-coalescing.md)
- [es2020.md](./es2020.md)
- [error-handling.md](./error-handling.md)
