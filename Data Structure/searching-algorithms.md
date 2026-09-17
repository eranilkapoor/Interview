# Searching Algorithms

Searching is the problem of determining whether a target value exists in a collection and, if so, where. The two fundamental approaches are **linear search**, which checks every element in sequence until it finds a match or exhausts the collection, and **binary search**, which exploits a *sorted* collection by repeatedly halving the search space — comparing the target to the middle element and discarding the half that can't possibly contain it. Linear search works on any collection (sorted or not) in O(n) time; binary search requires sorted input but achieves O(log n), a dramatic improvement — for a billion elements, linear search might need up to a billion comparisons, while binary search needs at most about 30.

Binary search's correctness hinges entirely on the sortedness invariant: at every step, comparing the target to the middle element tells you unambiguously which half could contain it, because everything to the left of a smaller middle element is *also* smaller than the target (by the sorted-order guarantee), and everything to the right is also larger. Break that invariant (search an unsorted array, or a "sorted" array that was mutated after sorting) and binary search silently returns wrong answers rather than erroring — it has no way to detect that its core assumption has been violated.

Binary search can be written iteratively (constant O(1) extra space, tracking `lo`/`hi` bounds in a loop) or recursively (O(log n) extra space for the call stack, one frame per halving) — both run in O(log n) time, but the iterative version avoids the (minor, in JS) overhead and stack-depth risk of recursive calls. Beyond simple existence search, binary search generalizes to a large family of "search on a monotonic condition" problems — finding the first/last occurrence of a value, finding an insertion point, or searching a rotated sorted array — all built on the same halving idea applied to a different predicate.

## Examples

```js
// Linear search: works on any array, sorted or not. O(n) time, O(1) space.
function linearSearch(arr, target) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === target) return i; // found — return its index
  }
  return -1; // not found
}

linearSearch([4, 2, 7, 1, 9], 7); // 2
linearSearch([4, 2, 7, 1, 9], 5); // -1
```

```js
// Binary search, iterative — O(log n) time, O(1) space. Requires a SORTED array.
function binarySearchIterative(sortedArr, target) {
  let lo = 0, hi = sortedArr.length - 1;

  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2); // avoids overflow in languages with fixed-width ints
    if (sortedArr[mid] === target) return mid;
    if (sortedArr[mid] < target) lo = mid + 1;  // target is in the right half
    else hi = mid - 1;                           // target is in the left half
  }
  return -1; // search space exhausted — not found
}

binarySearchIterative([1, 3, 5, 7, 9, 11, 13], 9); // 4
```

```js
// Binary search, recursive — same O(log n) time, but O(log n) space for the call stack
// (one frame per halving) instead of O(1).
function binarySearchRecursive(sortedArr, target, lo = 0, hi = sortedArr.length - 1) {
  if (lo > hi) return -1; // base case: search space exhausted

  const mid = lo + Math.floor((hi - lo) / 2);
  if (sortedArr[mid] === target) return mid;
  return sortedArr[mid] < target
    ? binarySearchRecursive(sortedArr, target, mid + 1, hi)
    : binarySearchRecursive(sortedArr, target, lo, mid - 1);
}

binarySearchRecursive([1, 3, 5, 7, 9, 11, 13], 1); // 0
```

## Common Pitfalls / Gotchas

- Running binary search on unsorted data — it doesn't throw or error, it just silently returns a wrong (or missed) result, because the halving logic assumes sortedness that no longer holds.
- Off-by-one errors in the loop/recursion bounds — using `lo < hi` instead of `lo <= hi` (or forgetting `+1`/`-1` when narrowing bounds) can cause an infinite loop or skip the last candidate element.
- Computing `mid` as `(lo + hi) / 2` instead of `lo + (hi - lo) / 2` — in languages with fixed-width integers this can overflow for very large arrays; not a practical JS issue (numbers are floating point), but a well-known interview detail worth knowing.
- Defaulting to linear search out of habit on data that's already sorted (or cheap to sort once and query many times) — if you'll search the same sorted collection repeatedly, binary search's O(log n) per query easily pays for a one-time O(n log n) sort.
- Forgetting that binary search variants (first/last occurrence, insertion point) need a modified comparison — naively adapting plain binary search to "find the first occurrence of a duplicate value" without adjusting the halving logic returns *an* occurrence, not necessarily the first.

## Interview Questions & Answers

**Q: What is binary search's time complexity, and why?**
A: O(log n). Each comparison discards half of the remaining search space, so the number of comparisons needed to narrow n elements down to 0 or 1 is the number of times you can halve n, which is log₂(n).

**Q: Why does binary search require sorted input, and what happens if you run it on unsorted data?**
A: Its correctness depends entirely on being able to infer, from one comparison against the middle element, which entire half can be safely discarded — that inference is only valid if everything to one side is guaranteed smaller (or larger) than the middle, which is exactly what sortedness guarantees. On unsorted data that guarantee is gone, so the algorithm still runs and returns *some* index or -1, but the answer is not reliable — it can miss a target that's actually present.

**Q: When would linear search actually be the better choice over binary search?**
A: When the data is unsorted and will only be searched once or a few times (sorting first, at O(n log n), costs more than just doing one or a few O(n) linear scans), when the collection is a data structure without random access (like a singly linked list, where "jumping to the middle" isn't O(1)), or when the collection is small enough that the constant-factor simplicity of a linear scan beats binary search's overhead in practice.

**Q: What's the space complexity difference between iterative and recursive binary search?**
A: Iterative binary search uses O(1) extra space — just a couple of index variables updated in a loop. Recursive binary search uses O(log n) extra space, because each recursive call adds a new stack frame, and there are O(log n) calls before hitting the base case. For very large inputs, the iterative version is generally preferred to avoid that stack growth (and JS's lack of guaranteed tail-call optimization — see [recursion.md](./recursion.md) — means the recursive version can't be assumed to run in constant space even though each call is a tail call).

**Q: How would you find the first occurrence of a target value in a sorted array containing duplicates?**
A: Modify standard binary search: when `sortedArr[mid] === target`, don't return immediately — record `mid` as a candidate answer, then keep searching the *left* half (`hi = mid - 1`) to see if an earlier occurrence exists. Continue until the search space is exhausted; the last recorded candidate is the first occurrence. This is still O(log n) since it's the same halving structure, just with an extra bookkeeping variable.

## Related Topics

- [sorting-algorithms.md](./sorting-algorithms.md)
- [divide-and-conquer.md](./divide-and-conquer.md)
- [big-o-notation.md](./big-o-notation.md)
- [arrays.md](./arrays.md)
- [binary-search-trees.md](./binary-search-trees.md)
</content>
</invoke>
