# Set & Map

`Set` and `Map` (ES2015) are dedicated collection types purpose-built for two common needs that plain objects/arrays historically had to awkwardly approximate: storing a collection of **unique values** (`Set`) and storing **key-value pairs** where the key can be *any* value, not just a string/Symbol (`Map`). Both maintain insertion order when iterated, and both provide a `.size` property (unlike arrays' `.length` or having to manually count an object's keys).

`Set` automatically enforces uniqueness — adding a value that's already present via `.add()` is a no-op; checking membership with `.has(value)` is O(1) on average, dramatically faster than `array.includes(value)`'s O(n) linear scan for large collections. `Map` allows keys of *any* type — objects, functions, even `NaN` — whereas a plain object's keys are always coerced to strings (or can be Symbols), meaning you can't natively use an object or a number *as itself* as a plain-object key without stringification. `Map` also doesn't inherit from `Object.prototype`, sidestepping potential key collisions with inherited properties like `toString` or `constructor` that a plain object used as a map can accidentally trigger.

`WeakSet` and `WeakMap` (see [weak-set-weak-map.md](./weak-set-weak-map.md)) are specialized variants that hold their entries *weakly*, allowing garbage collection of keys/values no longer referenced elsewhere — trading away iterability and a `.size` property for that memory-safety property, useful for metadata that shouldn't itself keep an object alive.

## Examples

```js
// Set: uniqueness and fast membership checks
const uniqueVisitorIds = new Set();
uniqueVisitorIds.add('user1');
uniqueVisitorIds.add('user2');
uniqueVisitorIds.add('user1'); // no-op — already present
console.log(uniqueVisitorIds.size); // 2
console.log(uniqueVisitorIds.has('user1')); // true — O(1) average lookup

// A classic use: deduplicating an array
const nums = [1, 2, 2, 3, 3, 3];
console.log([...new Set(nums)]); // [1, 2, 3]
```

```js
// Map: any value as a key, ordered iteration
const cache = new Map();
const objKey = { id: 1 };
cache.set(objKey, 'cached result');   // an OBJECT as a key — impossible directly with a plain object
cache.set('stringKey', 'other value');
cache.set(NaN, 'even NaN works as a key');

console.log(cache.get(objKey));       // "cached result"
console.log(cache.size);              // 3
for (const [key, value] of cache) {
  console.log(key, '=>', value); // iterates in insertion order
}
```

```js
// Map vs plain object: no prototype-chain key collisions
const plainObjMap = {};
plainObjMap['toString'] = 'oops'; // accidentally shadows an inherited method
console.log(typeof plainObjMap.toString); // "string" — no longer the inherited function!

const safeMap = new Map();
safeMap.set('toString', 'no problem');
console.log(safeMap.get('toString'));      // "no problem"
console.log(typeof ({}).toString);          // "function" — completely unaffected
```

## Common Pitfalls / Gotchas

- Using a plain object as a makeshift map with non-string keys — object keys are always coerced to strings (`obj[5]` is really `obj['5']`), silently merging what might have been intended as distinct keys of different original types; `Map` preserves the original key type/identity exactly.
- Forgetting `Set`/`Map` are iterated with `for...of` (or `.forEach()`), not directly indexable like arrays (`set[0]` doesn't work) — convert to an array first (`[...set]`) if index-based access is needed.
- Assuming `JSON.stringify()` works on `Map`/`Set` directly — it doesn't serialize them meaningfully by default (`JSON.stringify(new Map())` gives `"{}"`); you need to convert them (e.g., via `Object.fromEntries()` or `[...set]`) before serializing.
- Comparing two objects used as `Map` keys by value instead of reference — `Map` uses `SameValueZero` for key comparison, which for objects means reference identity, not structural equality; two different object literals with identical contents are treated as different keys.

## Interview Questions & Answers

**Q: Why would you use a `Map` instead of a plain object for key-value storage?**
A: `Map` allows keys of any type (not just strings/Symbols), doesn't inherit from `Object.prototype` (avoiding accidental key collisions with inherited properties like `toString`), maintains guaranteed insertion-order iteration, and provides a direct `.size` property — all of which plain objects either lack or handle awkwardly.

**Q: How would you deduplicate an array of primitive values using `Set`?**
A: `[...new Set(array)]` — constructing a `Set` from the array automatically discards duplicates (since `Set` enforces uniqueness), and spreading it back into an array literal gives you the deduplicated result, preserving original insertion order.

**Q: Why is `set.has(value)` generally faster than `array.includes(value)` for large collections?**
A: `Set` (like `Map`) is typically implemented with a hash-table-like structure under the hood, giving average O(1) lookup time for membership checks. `array.includes()` must scan the array linearly in the worst case, giving O(n) time — a significant difference for large collections checked repeatedly.

## Related Topics
- [weak-set-weak-map.md](./weak-set-weak-map.md)
- [objects.md](./objects.md)
- [arrays.md](./arrays.md)
- [iterators.md](./iterators.md)
- [es2015.md](./es2015.md)
