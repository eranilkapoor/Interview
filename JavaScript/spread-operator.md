# Spread Operator

The spread operator (`...`, ES2015 for arrays/function calls, ES2018 for object literals) expands an iterable (array, string, Set, Map, or any iterable) or an object's own enumerable properties into individual elements in a new context — an array literal, a function call's argument list, or an object literal. It is, syntactically, the mirror image of the rest parameter (`...`), which *collects* elements instead of expanding them; both share the same token but are distinguished by context.

Spread is the idiomatic way to shallow-copy arrays and objects (`[...arr]`, `{...obj}`), merge multiple arrays/objects (`[...a, ...b]`, `{...a, ...b}`), and pass an array's elements as individual arguments to a function (`Math.max(...numbers)`) without resorting to `.apply()`. For objects, later spreads override earlier ones for duplicate keys, which is the basis for common patterns like providing defaults (`{...defaults, ...overrides}`).

Crucially, spread performs a **shallow** copy: top-level properties/elements are copied, but nested objects/arrays are still shared by reference between the original and the copy. This is one of the most common sources of "why did mutating my copy also change the original?" bugs, and understanding it well distinguishes a solid intermediate developer from a beginner.

## Examples

```js
// Spreading into arrays: copying, merging, passing as arguments
const a = [1, 2, 3];
const copy = [...a];        // shallow copy
const merged = [...a, 4, 5, ...[6, 7]]; // [1,2,3,4,5,6,7]
console.log(Math.max(...a)); // 3 — spreads array elements as individual arguments
```

```js
// Spreading into objects: shallow copy, merge, override order matters
const defaults = { theme: 'light', retries: 3 };
const overrides = { theme: 'dark' };
const config = { ...defaults, ...overrides };
console.log(config); // { theme: 'dark', retries: 3 } — later spread wins on conflicts
```

```js
// The shallow-copy gotcha: nested objects are still shared by reference
const original = { user: { name: 'Anil' } };
const shallowCopy = { ...original };
shallowCopy.user.name = 'Kapoor';
console.log(original.user.name); // "Kapoor" — mutated through the shared nested reference!
```

## Common Pitfalls / Gotchas

- Assuming `{...obj}` or `[...arr]` produces a *deep* copy — it doesn't; nested objects/arrays remain shared references, so mutating a nested value affects both the original and the "copy."
- Spreading a non-iterable value into an array context (`[...42]`) — throws `TypeError: 42 is not iterable`; spread in array/call position requires an iterable, unlike object spread, which works on any object.
- Forgetting override order in object spread — `{...a, ...b}` lets `b`'s properties win on key conflicts; putting spreads in the wrong order silently reverses the intended precedence.
- Using spread to "merge" large arrays/objects repeatedly in a hot loop — each spread allocates a brand-new array/object, which can create real performance/memory overhead if overused in performance-critical code.

## Interview Questions & Answers

**Q: What's the difference between spread and rest, given they use the same `...` syntax?**
A: Spread *expands* an iterable/object into individual elements/properties in an array literal, function call, or object literal. Rest *collects* multiple individual arguments/elements into a single array. Which one you get depends entirely on the syntactic position: destructuring/parameter position = rest; array/object literal or call-argument position = spread.

**Q: Does `{...obj}` create a deep or shallow copy? Give an example of the difference mattering.**
A: Shallow. Top-level keys are copied, but if a value is itself an object/array, both the original and the copy point to the *same* nested object — mutating `copy.nested.x` also changes `original.nested.x`. For a true deep copy, use `structuredClone(obj)`, a deep-clone utility, or `JSON.parse(JSON.stringify(obj))` (with its own limitations around functions, `undefined`, dates, etc.).

**Q: How would you merge two objects, with the second object's properties taking precedence on conflicts?**
A: `const merged = { ...objA, ...objB };` — object spread applies properties left to right, so later spreads overwrite earlier ones for matching keys.

**Q: Why does `Math.max(...numbers)` work but `Math.max(numbers)` doesn't do what you'd expect?**
A: `Math.max` expects individual numeric arguments, not an array. `Math.max(numbers)` passes the whole array as a single argument, which coerces to `NaN`. `Math.max(...numbers)` spreads the array's elements into separate arguments, exactly matching what `Math.max` expects.

## Related Topics
- [rest-parameter.md](./rest-parameter.md)
- [destructuring-assignment.md](./destructuring-assignment.md)
- [immutability.md](./immutability.md)
- [pass-by-reference.md](./pass-by-reference.md)
