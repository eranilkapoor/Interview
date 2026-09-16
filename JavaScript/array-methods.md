# Array Methods

`Array.prototype` provides a large set of built-in methods, generally grouped into a few categories: **mutating** methods (modify the array in place — `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`), **non-mutating/transformational** methods (return a new array or value, leaving the original untouched — `map`, `filter`, `slice`, `concat`, `flat`, `flatMap`), **search/query** methods (`find`, `findIndex`, `indexOf`, `includes`, `some`, `every`), and **aggregation** methods (`reduce`, `reduceRight`, `join`, `forEach` for side effects). Knowing precisely which category a given method falls into — and specifically which ones mutate — is one of the most practically important things to internalize, since accidentally mutating an array a caller still holds a reference to is a very common source of bugs.

`map()`, `filter()`, and `reduce()` are the core higher-order array methods underpinning most functional-style JavaScript: `map(fn)` transforms each element into a new array of the same length; `filter(fn)` keeps only elements where `fn` returns truthy, producing a (possibly shorter) new array; `reduce(fn, initial)` collapses the whole array down to a single accumulated value, and is general enough to implement `map`/`filter`/`sum`/`flatten` and more, purely through choice of the reducer function and initial value.

`sort()` and `splice()` are two of the most commonly-misused mutating methods: `sort()` mutates the original array *and* returns it (so `const sorted = arr.sort()` still mutates `arr`, it just also happens to hand back the same, now-sorted reference) — and without a comparator function, it sorts elements as *strings* by default, which produces wrong results for numbers (`[10, 2, 1].sort()` gives `[1, 10, 2]`, not `[1, 2, 10]`). `splice(start, deleteCount, ...items)` both mutates the array and returns the removed elements as a new array — easily confused with the non-mutating `slice(start, end)`, which merely extracts a shallow copy of a range without touching the original.

## Examples

```js
// map, filter, reduce — the core non-mutating trio
const numbers = [1, 2, 3, 4, 5];
console.log(numbers.map(n => n * 2));            // [2, 4, 6, 8, 10]
console.log(numbers.filter(n => n % 2 === 0));   // [2, 4]
console.log(numbers.reduce((sum, n) => sum + n, 0)); // 15
console.log(numbers); // [1, 2, 3, 4, 5] — original untouched by any of the above
```

```js
// Mutating methods vs their non-mutating look-alikes
const arr = [3, 1, 2];
const sorted = arr.sort(); // MUTATES arr in place, also returns it
console.log(arr, sorted, arr === sorted); // [1,2,3] [1,2,3] true — same reference!

const original = [1, 2, 3, 4, 5];
const spliced = original.splice(1, 2);   // MUTATES original, returns removed elements
console.log(original, spliced); // [1, 4, 5] [2, 3]

const other = [1, 2, 3, 4, 5];
const sliced = other.slice(1, 3);         // does NOT mutate other; returns a new array
console.log(other, sliced); // [1, 2, 3, 4, 5] [2, 3]
```

```js
// The default sort() footgun with numbers, and the fix
const nums = [10, 2, 1, 20];
console.log(nums.sort());              // [1, 10, 2, 20] — WRONG, sorted as strings!
console.log(nums.sort((a, b) => a - b)); // [1, 2, 10, 20] — correct, numeric comparator
```

## Common Pitfalls / Gotchas

- Calling `array.sort()` (or `.reverse()`, `.splice()`) on an array you still need in its original order elsewhere — these mutate in place; use `[...array].sort(...)` or `array.slice().sort(...)` (or `Array.prototype.toSorted()` in newer engines) to sort a copy instead.
- Forgetting `sort()` defaults to lexicographic (string) comparison — always pass an explicit comparator function for numeric sorting.
- Confusing `slice(start, end)` (non-mutating, extracts a range) with `splice(start, deleteCount, ...items)` (mutating, removes/inserts elements and returns the removed ones) — their similar names are a frequent source of mix-ups.
- Using `array.forEach()` and expecting a returned array — `forEach` always returns `undefined`; it's for side effects only, unlike `map()`, which is for transformation and always returns a new array.
- Trying to `break` out of `forEach`/`map`/`filter` early — these methods don't support `break`/`continue`; use a `for...of` loop, or reach for `some()`/`every()`/`find()`, which inherently short-circuit.

## Interview Questions & Answers

**Q: Which common array methods mutate the original array, and which don't?**
A: Mutating: `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`. Non-mutating: `map`, `filter`, `slice`, `concat`, `flat`, `flatMap`, `reduce`/`reduceRight` (they don't mutate the array itself, though the reducer function could technically mutate the accumulator if written carelessly). Knowing this distinction is essential for avoiding accidental shared-reference bugs.

**Q: How would you implement `Array.prototype.map()` using `reduce()`?**
```js
function mapViaReduce(array, fn) {
  return array.reduce((acc, item, index) => {
    acc.push(fn(item, index, array));
    return acc;
  }, []);
}
```
A: `reduce` is general enough to express `map` (and `filter`) by choosing an appropriate reducer function and initial accumulator (an empty array here) — this is a common interview exercise demonstrating understanding of `reduce`'s generality.

**Q: Why does `[10, 2, 1].sort()` give `[1, 10, 2]` instead of `[1, 2, 10]`?**
A: Without a comparator function, `Array.prototype.sort()` converts elements to strings and compares them lexicographically (dictionary order), not numerically — `"10"` sorts before `"2"` as strings (since `'1'` < `'2'` character-by-character). Passing an explicit numeric comparator, `(a, b) => a - b`, fixes this by forcing genuine numeric comparison.

**Q: What's the difference between `find()` and `filter()`?**
A: `find(fn)` returns the *first* element for which `fn` returns truthy (or `undefined` if none match), and stops iterating as soon as it's found. `filter(fn)` returns a *new array* containing *every* matching element, always iterating through the whole array regardless of how many matches are found early on.

## Related Topics
- [arrays.md](./arrays.md)
- [higher-order-function.md](./higher-order-function.md)
- [loops-in-javascript.md](./loops-in-javascript.md)
- [immutability.md](./immutability.md)
