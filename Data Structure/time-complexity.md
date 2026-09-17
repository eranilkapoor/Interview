# Time Complexity

Time complexity measures how the number of *operations* an algorithm performs grows as a function of input size `n`, used as a hardware-independent proxy for running time. You analyze it by identifying the algorithm's dominant operation (a comparison, an array access, a recursive call) and counting how many times it executes relative to `n`, then expressing that count using asymptotic notation (see `big-o-notation.md` and `asymptotic-notations.md`). It is not a measurement of wall-clock seconds — the same `O(n)` algorithm runs at different absolute speeds on different machines, but its *growth curve* as `n` scales is a property of the algorithm itself.

Every algorithm can have distinct best-case, average-case, and worst-case time complexities, corresponding to different input arrangements. Best case is the input that makes the algorithm do the least work (e.g., searching for the first element in an array); worst case is the input that makes it do the most (e.g., searching for a missing element, or a reverse-sorted array fed to insertion sort); average case is the expected work over a distribution of "typical" inputs (usually assumed uniformly random unless stated otherwise). Interviews default to worst-case analysis because it's a guarantee independent of input distribution assumptions, but a strong answer states which case is being discussed rather than leaving it implicit.

Different data structures have dramatically different time complexities for the same logical operation, which is why choosing the right structure matters more than micro-optimizing code. Array *access by index* is `O(1)` (direct memory offset calculation), but array *search* is `O(n)` (no shortcut without an index or sorted order — binary search requires the array to already be sorted, giving `O(log n)`). Hash tables give `O(1)` *average*-case insert/lookup/delete (via direct bucket computation from a hash function) but degrade to `O(n)` *worst*-case if many keys collide into the same bucket. Balanced binary search trees (AVL, red-black) guarantee `O(log n)` for insert/search/delete because they maintain a height proportional to `log n`; an unbalanced BST (e.g., built by inserting already-sorted data with no rebalancing) degenerates into a linked list with `O(n)` height, making every operation `O(n)` in the worst case.

Amortized time complexity is a separate, often-confused concept: it's the *average* cost per operation across a whole sequence of operations, even when individual operations occasionally cost much more. The canonical example is a dynamic array's `push` (JavaScript's `Array.prototype.push`): most pushes are `O(1)` (there's spare capacity), but occasionally the backing array is full and must be reallocated and copied — an `O(n)` operation. Because that expensive resize happens exponentially less often as the array grows (doubling capacity each time), the *total* cost of `n` pushes is `O(n)`, making the amortized cost *per* push `O(1)` — this is different from *average* case, which describes typical input, whereas amortized describes typical cost *per operation in a sequence*, guaranteed regardless of input.

## Examples

```js
// O(1) average, O(n) worst case: hash-based lookup via a plain object / Map.
// Average case relies on a good hash function spreading keys evenly across buckets.
const cache = new Map();
cache.set('user:42', { name: 'Anil' }); // O(1) average insert
cache.get('user:42');                    // O(1) average lookup
// Worst case O(n): a pathological hash function that collides every key
// into one bucket degrades lookup to a linear scan of that bucket.
```

```js
// O(log n): binary search tree operations, IF the tree stays balanced.
// A naive BST insert with no rebalancing:
class TreeNode {
  constructor(val) { this.val = val; this.left = null; this.right = null; }
}
function insert(root, val) {
  if (!root) return new TreeNode(val);
  if (val < root.val) root.left = insert(root.left, val);
  else root.right = insert(root.right, val);
  return root;
}
// Inserting [1, 2, 3, 4, 5] in this order (already sorted) builds a tree
// that is really a linked list leaning right -> height = n -> O(n) search,
// NOT O(log n). Only a self-balancing tree (AVL, red-black) guarantees
// O(log n) height regardless of insertion order. See avl-trees.md.
```

```js
// Amortized O(1): dynamic array push, despite occasional O(n) resizes.
class DynamicArray {
  constructor() { this.data = new Array(1); this.length = 0; }
  push(value) {
    if (this.length === this.data.length) {
      // O(n) resize: happens only when doubling, so it happens
      // O(log n) times total across n pushes, not every push.
      const resized = new Array(this.data.length * 2);
      for (let i = 0; i < this.length; i++) resized[i] = this.data[i];
      this.data = resized;
    }
    this.data[this.length] = value; // O(1) typical case
    this.length++;
  }
}
// Total cost of n pushes: n (writes) + (1 + 2 + 4 + ... + n) (resizes) < 3n
// -> O(n) total -> O(1) amortized per push.
```

## Common Pitfalls / Gotchas

- Quoting a data structure's *average*-case complexity as if it were guaranteed. Hash tables are `O(1)` average but `O(n)` worst case — for latency-sensitive or adversarial-input contexts (e.g., an attacker choosing keys to force collisions), the worst case matters and should be mentioned.
- Assuming a binary search tree is automatically `O(log n)`. Complexity depends entirely on the tree staying balanced; a plain BST with no rebalancing logic degrades to `O(n)` on sorted or adversarial insertion order. Only self-balancing variants (AVL, red-black) guarantee `O(log n)` height.
- Forgetting that many built-in array methods are `O(n)`, not `O(1)`: `unshift()`/`shift()` (must re-index every remaining element), `includes()`, `indexOf()`, `splice()` in the middle of an array, and `slice()`. Calling one inside a loop silently turns linear code into quadratic code.
- Confusing "amortized" with "average case." Amortized complexity is a guarantee about the *total* cost over a specific sequence of operations on one data structure (regardless of what that sequence contains), while average case is about typical *input* to a single operation, given some distribution assumption. They answer different questions and aren't interchangeable.
- Ignoring the cost of implicit operations. String concatenation in a loop (`str += x`) can be `O(n)` per concatenation in some engines because strings are immutable and each `+=` may allocate a new string — an `n`-iteration loop doing this is `O(n²)`, not `O(n)`.

## Interview Questions & Answers

**Q: What is the time complexity of searching for an element in an unsorted array versus a sorted array?**
A: Unsorted: `O(n)` worst case — no shortcut, you may have to check every element (linear search). Sorted: `O(log n)` worst case using binary search, since each comparison eliminates half the remaining search space. Note that sorting the array first costs `O(n log n)`, so binary search only pays off if you'll search it more than once, or it's already sorted.

**Q: Why is a hash table's average-case lookup O(1) but worst-case O(n)?**
A: Average case assumes the hash function distributes keys roughly uniformly across buckets, so each bucket holds a small, roughly constant number of entries — looking one up is essentially a direct array-index computation plus a short scan. Worst case occurs when many keys collide into the same bucket (either due to a poor hash function or deliberately crafted adversarial input), degrading that bucket into a linear list that must be scanned entirely — `O(n)` if all `n` keys collide into one bucket.

**Q: Explain amortized time complexity using JavaScript's Array.push() as an example.**
A: `push()` is usually `O(1)` because the underlying array has spare capacity and the new element is just written to the next slot. Occasionally the array is full and the engine must allocate a larger backing array and copy all existing elements over — an `O(n)` operation. Because capacity typically grows geometrically (e.g., doubling), these expensive resizes become exponentially rarer as the array grows, so their total cost across `n` pushes stays `O(n)`, making the *amortized* — average per-operation — cost `O(1)`, even though any individual push can occasionally be `O(n)`.

**Q: What's the time complexity of this function, and how would you improve it?**
```js
function hasDuplicate(arr) {
  for (let i = 0; i < arr.length; i++) {
    if (arr.indexOf(arr[i], i + 1) !== -1) return true;
  }
  return false;
}
```
A: `O(n²)`. The outer loop is `O(n)`, and `Array.prototype.indexOf` is itself `O(n)` per call in the worst case, giving `O(n) * O(n) = O(n²)`. It can be improved to `O(n)` time (at the cost of `O(n)` extra space) by using a `Set` to track seen elements in a single pass: `const seen = new Set(); for (const x of arr) { if (seen.has(x)) return true; seen.add(x); } return false;` — this trades space for time, replacing repeated linear scans with `O(1)` average-case set lookups.

**Q: Between an unbalanced BST and a balanced BST (like AVL), what's the worst-case time complexity of insertion, and why does it differ?**
A: An unbalanced BST can degrade to `O(n)` insertion time in the worst case — if elements are inserted in sorted order with no rebalancing, the tree becomes a linked list with height `n`, and insertion must walk from the root to a leaf, taking time proportional to height. A balanced BST like AVL guarantees `O(log n)` insertion because it performs rotations after each insert to keep the height bounded at `O(log n)` regardless of insertion order, so the root-to-leaf walk (plus the rebalancing itself) never exceeds `O(log n)`.

## Related Topics

- [big-o-notation.md](./big-o-notation.md)
- [asymptotic-notations.md](./asymptotic-notations.md)
- [space-complexity.md](./space-complexity.md)
- [arrays.md](./arrays.md)
- [hash-tables.md](./hash-tables.md)
- [binary-search-trees.md](./binary-search-trees.md)
- [avl-trees.md](./avl-trees.md)
