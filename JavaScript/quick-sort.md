# Quick Sort

Quicksort is a classic, widely-taught divide-and-conquer sorting algorithm, frequently used in coding interviews to assess understanding of recursion, algorithmic complexity, and in-place array manipulation. It's not a JavaScript-specific language feature — it's a general computer-science algorithm — but it's a common practical exercise in JavaScript interviews specifically because implementing it well requires comfortable use of recursion, array indices, and helper functions.

The algorithm works by picking a **pivot** element from the array, then **partitioning** the remaining elements into two groups — those less than the pivot and those greater than or equal to it — such that after partitioning, the pivot sits in its final, correctly-sorted position, with all smaller elements to its left and all larger elements to its right. Quicksort then recursively applies the same process to the two partitions (the sub-array before the pivot and the sub-array after it), continuing until each partition has zero or one element (already trivially sorted), at which point the whole array is sorted.

Quicksort's average-case time complexity is **O(n log n)**, which is excellent in practice and is why it (or variants of it) is used in many real-world sorting implementations. However, its **worst-case** complexity is **O(n²)**, which occurs when the pivot selection consistently produces very unbalanced partitions (e.g., always picking the smallest or largest remaining element as the pivot on an already-sorted or reverse-sorted array with a naive pivot strategy) — this is why production-quality implementations often use techniques like randomized pivot selection or "median-of-three" pivot selection to make worst-case behavior unlikely in practice.

## Examples

```js
// A correct, from-scratch Quicksort implementation (recursive, returns a new sorted array)
function quickSort(arr) {
  if (arr.length <= 1) return arr; // base case: 0 or 1 elements are already "sorted"

  const [pivot, ...rest] = arr;
  const left = rest.filter(n => n < pivot);
  const right = rest.filter(n => n >= pivot);

  return [...quickSort(left), pivot, ...quickSort(right)];
}
console.log(quickSort([5, 3, 8, 1, 9, 2])); // [1, 2, 3, 5, 8, 9]
```

```js
// An in-place variant, closer to how it's often taught / interview-asked
function quickSortInPlace(arr, low = 0, high = arr.length - 1) {
  if (low < high) {
    const pivotIndex = partition(arr, low, high);
    quickSortInPlace(arr, low, pivotIndex - 1);
    quickSortInPlace(arr, pivotIndex + 1, high);
  }
  return arr;
}
function partition(arr, low, high) {
  const pivot = arr[high];
  let i = low - 1;
  for (let j = low; j < high; j++) {
    if (arr[j] < pivot) {
      i++;
      [arr[i], arr[j]] = [arr[j], arr[i]]; // swap using destructuring
    }
  }
  [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]]; // move pivot to its final position
  return i + 1;
}
console.log(quickSortInPlace([5, 3, 8, 1, 9, 2])); // [1, 2, 3, 5, 8, 9]
```

```js
// Demonstrating the worst-case scenario: an already-sorted array with a naive "last element" pivot
// causes maximally unbalanced partitions at every step, degrading to O(n^2)
console.log(quickSort([1, 2, 3, 4, 5])); // still correct, but each partition step is maximally lopsided here
```

## Common Pitfalls / Gotchas

- Using array destructuring (`const [pivot, ...rest] = arr`) for simplicity in interviews, but forgetting this approach creates new arrays at every recursive call (not truly "in-place"), which is less memory-efficient than the classic Lomuto/Hoare partition scheme, worth mentioning if asked about space complexity.
- Forgetting quicksort's worst-case time complexity is O(n²), not O(n log n) — this matters specifically for already-sorted or specially-crafted adversarial inputs when using a naive, fixed pivot-selection strategy (like always picking the first or last element).
- Off-by-one errors in the partition function's index bookkeeping — a very common source of bugs when implementing quicksort in-place from memory under interview pressure.
- Confusing quicksort's average-case guarantees with a *stable*-sort guarantee — quicksort, as classically implemented, is **not** stable (equal elements are not guaranteed to retain their original relative order), unlike, say, a well-implemented merge sort or JavaScript's native `Array.prototype.sort()` (which is required to be stable per the ES2019 spec, though it isn't necessarily implemented as quicksort internally).

## Interview Questions & Answers

**Q: Walk through how quicksort works, step by step.**
A: Pick a pivot element from the array. Partition the remaining elements into "less than pivot" and "greater than or equal to pivot" groups, placing the pivot in its final sorted position between them. Recursively apply the same pivot-and-partition process to each of the two sub-arrays, until every sub-array has 0 or 1 elements (the base case), at which point the whole array is sorted.

**Q: What is quicksort's average-case and worst-case time complexity, and when does the worst case occur?**
A: Average case is O(n log n) due to (on average) roughly balanced partitions at each recursive level. Worst case is O(n²), occurring when pivot selection repeatedly produces maximally unbalanced partitions — e.g., naively picking the first or last element as pivot on an already-sorted (or reverse-sorted) array. Randomized or median-of-three pivot selection strategies mitigate this risk in practice.

**Q: Is JavaScript's built-in `Array.prototype.sort()` guaranteed to be quicksort internally?**
A: No — the ECMAScript spec doesn't mandate a specific sorting algorithm, only that the result is a stable sort (since ES2019) given a valid comparator. Different engines are free to implement `sort()` using whatever algorithm achieves that guarantee efficiently (V8, for instance, uses a variant combining insertion sort for small arrays and Timsort-like techniques for larger ones, not classic quicksort).

## Related Topics
- [array-methods.md](./array-methods.md)
- [arrays.md](./arrays.md)
- [call-stack-and-memory-heap.md](./call-stack-and-memory-heap.md)
