# Sorting Algorithms

Sorting rearranges a collection into a defined order (typically ascending), and while JavaScript's built-in `Array.prototype.sort()` handles most real-world cases, understanding how the classic algorithms work — and *why* they have the time/space/stability characteristics they do — is a staple of technical interviews because it tests recursion, in-place mutation, and complexity analysis all at once. **Quicksort** and **mergesort** are the two most commonly implemented from scratch: both are O(n log n) on average and both use a divide-and-conquer structure, but they differ in exactly the ways that make for good interview follow-ups.

Quicksort picks a **pivot**, **partitions** the array so everything smaller than the pivot ends up to its left and everything larger to its right (with the pivot landing in its final sorted position), then recursively sorts each side. It's typically implemented **in-place** (O(log n) space for the recursion stack, not counting the array itself) but is **unstable** — the partitioning swaps can reorder equal elements relative to each other. Its average case is O(n log n), but a poor pivot choice (e.g., always picking the last element on an already-sorted or reverse-sorted array) degrades it to O(n²) worst case; randomized or median-of-three pivot selection mitigates this in practice.

Mergesort recursively splits the array in half, sorts each half, then **merges** the two sorted halves back together in linear time. It's **stable** (a careful merge step preserves the relative order of equal elements) and has a *guaranteed* O(n log n) in every case — no pathological input degrades it — but requires O(n) auxiliary space for the merge step, so it's not in-place. This tradeoff — quicksort's speed and low memory footprint vs. mergesort's stability and worst-case guarantee — is exactly the kind of decision real sorting library implementations make (e.g., many languages use a hybrid: quicksort-like for primitives, mergesort-like/Timsort for objects where stability matters).

## Examples

```js
// Quicksort — in-place, Lomuto partition scheme. Average O(n log n), worst O(n^2).
function quickSort(arr, lo = 0, hi = arr.length - 1) {
  if (lo < hi) {
    const pivotIndex = partition(arr, lo, hi);
    quickSort(arr, lo, pivotIndex - 1);  // recursively sort left of pivot
    quickSort(arr, pivotIndex + 1, hi);  // recursively sort right of pivot
  }
  return arr;
}

function partition(arr, lo, hi) {
  const pivot = arr[hi];       // choose last element as pivot
  let i = lo - 1;              // boundary of "elements known to be <= pivot"

  for (let j = lo; j < hi; j++) {
    if (arr[j] <= pivot) {
      i++;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  [arr[i + 1], arr[hi]] = [arr[hi], arr[i + 1]]; // place pivot in its final sorted position
  return i + 1;
}

quickSort([5, 2, 8, 1, 9, 3]); // [1, 2, 3, 5, 8, 9] — sorted in place
```

```js
// Mergesort — not in-place, but stable and O(n log n) guaranteed in every case.
function mergeSort(arr) {
  if (arr.length <= 1) return arr;
  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  return merge(left, right);
}

function merge(left, right) {
  const result = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    // "<=" keeps ties resolved in favor of `left`, which is what makes this STABLE
    if (left[i] <= right[j]) result.push(left[i++]);
    else result.push(right[j++]);
  }
  return result.concat(left.slice(i)).concat(right.slice(j));
}

mergeSort([5, 2, 8, 1, 9, 3]); // [1, 2, 3, 5, 8, 9] — new sorted array, original untouched
```

```js
// Demonstrating stability concretely: sorting objects by `score` only, where insertion
// order should be preserved for ties. Mergesort preserves it; a naive unstable sort might not.
const players = [
  { name: 'A', score: 10 }, { name: 'B', score: 5 },
  { name: 'C', score: 10 }, { name: 'D', score: 5 },
];
const sorted = mergeSort(players.map(p => p)).sort; // conceptually: sort by score
// A properly stable sort-by-score keeps A before C (both score 10, A was first)
// and B before D (both score 5, B was first) — this guarantee is what "stable" means.
```

## Common Pitfalls / Gotchas

- Assuming quicksort is always O(n log n) — its worst case is O(n²), which naive pivot choice (always the first or last element) triggers on already-sorted or reverse-sorted input; randomized pivot selection or median-of-three avoids this in practice.
- Forgetting mergesort needs O(n) extra space for the merge step — for very large arrays where memory is tight, that can matter even though the time complexity looks identical to quicksort's average case.
- Assuming quicksort is stable because it's a "normal" comparison sort — it isn't; the partition step's swaps can reorder equal elements, which matters when sorting by one field while needing to preserve existing order on ties.
- Using `<` instead of `<=` in a merge/comparison step and inadvertently breaking stability, or vice versa introducing unnecessary swaps.
- Reaching for a hand-rolled sort in production code instead of the built-in `Array.prototype.sort()` (which is stable per spec since ES2019, and highly optimized) — hand-rolled implementations are for learning and interviews, not for replacing a well-tested standard library sort.

## Complexity Comparison

| Algorithm | Best | Average | Worst | Space | Stable | In-Place |
|---|---|---|---|---|---|---|
| Quicksort | O(n log n) | O(n log n) | O(n²) | O(log n) | No | Yes |
| Mergesort | O(n log n) | O(n log n) | O(n log n) | O(n) | Yes | No |
| Heap Sort | O(n log n) | O(n log n) | O(n log n) | O(1) | No | Yes |
| Insertion Sort | O(n) | O(n²) | O(n²) | O(1) | Yes | Yes |
| Bubble Sort | O(n) | O(n²) | O(n²) | O(1) | Yes | Yes |

## Interview Questions & Answers

**Q: Why is quicksort usually faster than mergesort in practice, despite having the same average-case big-O?**
A: Quicksort sorts in-place with better cache locality (it works within contiguous regions of the same array, minimizing memory allocation), while mergesort allocates new arrays at every level of recursion, adding real allocation and garbage-collection overhead even though the asymptotic complexity is the same. Quicksort's constant factor is typically smaller in practice, which is why most general-purpose sort implementations historically favored quicksort variants for primitive/unboxed data where stability doesn't matter.

**Q: How do you avoid quicksort's O(n²) worst case in practice?**
A: Use randomized pivot selection (pick a random element and swap it to the partition position before partitioning) so that no specific input pattern (like already-sorted data) can reliably trigger worst-case behavior — this makes O(n²) astronomically unlikely rather than impossible. Median-of-three (comparing the first, middle, and last elements and using their median as pivot) is a cheaper heuristic that also avoids the common already-sorted worst case. A guaranteed O(n log n) worst case requires median-of-medians pivot selection, which has a higher constant factor and is rarely used in practice.

**Q: When does stability actually matter when sorting?**
A: Whenever you're sorting by one key but want to preserve existing order among elements that tie on that key — e.g., a list of orders already sorted by date, now being sorted by customer name: a stable sort keeps same-customer orders in date order; an unstable sort might scramble them. It also matters for multi-pass sorting strategies (sort by secondary key first, then stably sort by primary key) which only work correctly with a stable sort.

**Q: Why does mergesort suit linked lists or external (disk-based) sorting particularly well?**
A: Mergesort's merge step only ever needs sequential access to two sorted runs (peek/advance the front of each), never random access — this maps naturally onto a linked list (no O(n) slicing needed, just pointer manipulation) and onto external sorting (where data doesn't fit in memory and must be read/written in sequential chunks from disk, which is far cheaper than random access). Quicksort's partitioning, by contrast, benefits heavily from random access into a contiguous array, which linked lists and disk storage don't provide efficiently.

**Q: What's the time complexity of `Array.prototype.sort()` in JavaScript, and is it stable?**
A: Modern engines (V8/Node, and per the ECMAScript spec since ES2019) guarantee `sort()` is stable, and it typically runs in O(n log n) — V8 specifically uses TimSort (a hybrid of merge sort and insertion sort, adaptive to already-sorted runs) for arrays above a small size threshold, and a simpler insertion sort below it, since insertion sort's low constant factor beats O(n log n) algorithms' overhead on small inputs.

## Related Topics

- [divide-and-conquer.md](./divide-and-conquer.md)
- [searching-algorithms.md](./searching-algorithms.md)
- [big-o-notation.md](./big-o-notation.md)
- [space-complexity.md](./space-complexity.md)
- [heaps.md](./heaps.md)
</content>
</invoke>
