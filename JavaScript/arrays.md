# Arrays

An array is JavaScript's built-in, ordered list data structure — a specialized object (`typeof [] === 'object'`) that uses numeric indices (starting at `0`) to store and access a sequence of values of any type, including mixed types within the same array. Arrays can be created via array literal syntax (`[1, 2, 3]`, the standard, fast, idiomatic way) or the `Array` constructor (`new Array(1, 2, 3)`, rarely used directly — and notably, `new Array(3)` creates a *sparse* array with `length: 3` and no actual elements, a well-known footgun distinct from `[3]`, an array containing the single value `3`).

Because arrays are objects, `Array.isArray(value)` is the reliable way to check if something is genuinely an array — `typeof` only reports `"object"` for both arrays and plain objects, and `instanceof Array` can fail across different realms (iframes, workers). Arrays have a `.length` property that auto-updates as elements are added/removed, and — unlike most languages' fixed-size arrays — JavaScript arrays are dynamically resizable and can even have "holes" (sparse arrays, e.g., from `new Array(5)` or `delete arr[2]`), which many array methods (like `forEach`) actually skip over.

JavaScript does not natively support "associative arrays" (string-keyed arrays, as some other languages call them) — attempting to assign a non-numeric-index property to an array (`arr.name = 'x'`) is legal (arrays are objects, after all) but doesn't affect `.length` or array-iteration behavior; for key-value data, a plain object or `Map` is the correct tool instead (see [set-map.md](./set-map.md)).

## Examples

```js
// Array literal (fast, idiomatic) vs new Array() constructor (has a footgun)
const literal = [1, 2, 3];
const viaConstructor = new Array(1, 2, 3); // same result here
console.log(literal, viaConstructor); // [1, 2, 3] [1, 2, 3]

const sparse = new Array(3); // DANGER: creates a sparse array of length 3, no actual elements
console.log(sparse.length);  // 3
console.log(sparse);          // [ <3 empty items> ] — NOT [undefined, undefined, undefined] conceptually
```

```js
// Arrays are objects with numeric indices; typeof doesn't distinguish them from plain objects
const arr = ['a', 'b', 'c'];
console.log(typeof arr);        // "object"
console.log(Array.isArray(arr)); // true — the reliable check
console.log(arr.length);         // 3

arr.extra = 'not a real array index'; // legal, but doesn't affect .length or iteration
console.log(arr.length); // 3 — unaffected by the non-numeric property
```

```js
// Mixed types, and manually computing length without built-ins (a common interview exercise)
const mixed = [1, 'two', { three: 3 }, [4, 4], () => 5];
console.log(mixed.length); // 5

function manualLength(str) {
  let length = 0;
  while (str[length] !== undefined) length++;
  return length;
}
console.log(manualLength('Hello')); // 5
```

## Common Pitfalls / Gotchas

- Using `new Array(n)` expecting an array of `n` `undefined` values ready for mapping — it actually creates a *sparse* array with holes, which many methods (`forEach`, `map`) skip over entirely; use `Array.from({ length: n })` or `Array(n).fill(undefined)` to get genuinely populated elements.
- Using `typeof` to detect arrays — always returns `"object"`; use `Array.isArray()` instead.
- Assigning a non-numeric property to an array (`arr.label = 'x'`) and expecting it to be treated as an array element — it's just a regular object property, invisible to `.length` and array iteration methods.
- Forgetting arrays retain object semantics for equality/copying — `[1,2] === [1,2]` is `false` (different references), and assigning an array to a new variable copies the reference, not the contents (see [pass-by-reference.md](./pass-by-reference.md)).

## Interview Questions & Answers

**Q: Why is `typeof` insufficient for checking whether a value is an array, and what should you use instead?**
A: `typeof` returns `"object"` for both arrays and plain objects (and several other reference types), providing no way to distinguish them. `Array.isArray(value)` is the reliable, spec-recommended check, and it correctly works even across different realms (iframes/workers), unlike `instanceof Array`.

**Q: What's the difference between `new Array(3)` and `[3]`?**
A: `new Array(3)` (a single numeric argument) creates a sparse array with `length: 3` and no actual elements (three "holes"). `[3]` creates an array containing one actual element, the number `3`, with `length: 1`. This single-argument special case in the `Array` constructor is a well-known JavaScript footgun.

**Q: Can you use a string as a key on an array, like an associative array in other languages?**
A: You can assign a property with a non-numeric key to an array (since arrays are objects), but it won't be treated as an array element — it won't affect `.length`, and array iteration methods (`forEach`, `map`, `for...of`) will ignore it. For true key-value data, use a plain object or a `Map` instead.

## Related Topics
- [array-methods.md](./array-methods.md)
- [objects.md](./objects.md)
- [set-map.md](./set-map.md)
- [destructuring-assignment.md](./destructuring-assignment.md)
- [pass-by-reference.md](./pass-by-reference.md)
