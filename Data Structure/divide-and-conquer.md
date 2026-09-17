# Divide and Conquer

Divide and conquer is an algorithmic paradigm built on three steps applied recursively: **divide** the problem into smaller subproblems of the same type, **conquer** each subproblem by solving it recursively (with a base case that solves trivially small subproblems directly), and **combine** the subproblem solutions into a solution for the original problem. Merge sort is the canonical example: divide an array in half, recursively sort each half, then combine (merge) the two sorted halves into one sorted array.

What distinguishes divide and conquer from dynamic programming is that its subproblems are **independent** — solving the left half of an array shares no data or overlap with solving the right half, so there's nothing to cache or reuse between them. This independence is exactly what makes the paradigm easy to reason about with recurrence relations: merge sort's work per level is O(n) (the merge step), and there are O(log n) levels (each halving the problem size), giving the classic T(n) = 2T(n/2) + O(n) recurrence that resolves to O(n log n) by the Master Theorem. Contrast this with DP problems like Fibonacci, where `fib(n-1)` and `fib(n-2)` both recursively need `fib(n-3)` — that overlap is what makes memoization valuable, and it's precisely what divide-and-conquer subproblems don't have.

Beyond sorting, divide and conquer shows up in binary search (divide the search space in half each time, discarding the irrelevant half — no combine step needed since only one half is ever explored), fast exponentiation (computing `x^n` by recursively computing `x^(n/2)` and squaring, turning O(n) multiplications into O(log n)), and classic problems like the closest-pair-of-points and Strassen's matrix multiplication. The combine step is often the most algorithmically interesting part — in merge sort it's a full linear-time merge; in binary search there effectively isn't one, because dividing already tells you which half to discard.

## Examples

```js
// Merge sort: the textbook divide-and-conquer algorithm.
// Divide: split the array in half. Conquer: recursively sort each half.
// Combine: merge the two sorted halves into one sorted result — O(n) per merge.
function mergeSort(arr) {
  if (arr.length <= 1) return arr; // base case: an array of 0 or 1 elements is already sorted

  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));   // conquer: recursively sort left half
  const right = mergeSort(arr.slice(mid));     // conquer: recursively sort right half
  return merge(left, right);                    // combine
}

function merge(left, right) {
  const result = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    // "<=" (not "<") keeps the sort stable: equal elements from `left` win ties
    if (left[i] <= right[j]) result.push(left[i++]);
    else result.push(right[j++]);
  }
  while (i < left.length) result.push(left[i++]);
  while (j < right.length) result.push(right[j++]);
  return result;
}

mergeSort([5, 2, 8, 1, 9, 3]); // [1, 2, 3, 5, 8, 9]
```

```js
// Fast exponentiation via divide and conquer: compute x^n in O(log n) multiplications
// instead of the naive O(n) — by halving the exponent and squaring the result.
function power(x, n) {
  if (n === 0) return 1;                    // base case: x^0 = 1
  if (n < 0) return 1 / power(x, -n);       // handle negative exponents

  const half = power(x, Math.floor(n / 2)); // divide: solve x^(n/2)
  const squared = half * half;              // combine: (x^(n/2))^2 = x^n (for even n)
  return n % 2 === 0 ? squared : squared * x; // odd n needs one extra factor of x
}

power(2, 10); // 1024, computed in ~4 recursive calls instead of 10 multiplications
```

```js
// Binary search as divide and conquer with NO combine step: dividing the array in
// half already tells you which half (if any) to recurse into, so there's nothing
// left to merge — the "conquer" result on the correct half IS the final answer.
function binarySearch(sortedArr, target, lo = 0, hi = sortedArr.length - 1) {
  if (lo > hi) return -1; // base case: search space exhausted, not found

  const mid = lo + Math.floor((hi - lo) / 2); // divide
  if (sortedArr[mid] === target) return mid;
  return sortedArr[mid] < target
    ? binarySearch(sortedArr, target, mid + 1, hi)  // conquer: recurse right half
    : binarySearch(sortedArr, target, lo, mid - 1); // conquer: recurse left half
}

binarySearch([1, 3, 5, 7, 9, 11], 7); // 3
```

## Common Pitfalls / Gotchas

- Confusing divide-and-conquer with dynamic programming — if you notice the recursive subproblems overlap (the same smaller input gets solved multiple times), you're in DP territory and need memoization/tabulation, not plain divide-and-conquer.
- Merge sort's `merge` step allocates new arrays at every level, giving O(n) *extra* space (and O(n log n) total allocation across all levels) — not in-place, unlike quicksort.
- Off-by-one errors in computing `mid` or the recursive bounds (`lo`/`hi`) — always double check the base case and that each recursive call strictly shrinks the range.
- Assuming divide-and-conquer is always faster — for small inputs, the recursive overhead (function calls, array slicing) can make it slower than a simple O(n²) algorithm like insertion sort; production sort implementations often switch to insertion sort below a small size threshold (e.g., ~10-20 elements).
- Using `.slice()` repeatedly for the divide step (as in the merge sort example above) is simple to read but creates many intermediate arrays — a production-grade implementation would sort in-place using index ranges into a single array to avoid that overhead.

## Interview Questions & Answers

**Q: What are the three steps of divide and conquer, and how does merge sort implement each?**
A: Divide: split the array into two halves. Conquer: recursively apply merge sort to each half until the base case (array of length ≤ 1) is reached. Combine: merge the two now-sorted halves into a single sorted array in O(n) by repeatedly taking the smaller of the two halves' current fronts.

**Q: How do you derive merge sort's O(n log n) time complexity?**
A: The recurrence is T(n) = 2T(n/2) + O(n): two recursive calls on half-sized inputs, plus O(n) work to merge. The recursion tree has O(log n) levels (each level halves the size until reaching 1), and the total work done *at* each level is O(n) (all the merges at that level touch every element exactly once combined). O(n) work × O(log n) levels = O(n log n). This matches the Master Theorem's case where the work per level is uniform across all levels.

**Q: What's the fundamental difference between divide-and-conquer and dynamic programming?**
A: Both recursively break a problem into subproblems, but divide-and-conquer's subproblems are independent — they share no overlapping sub-subproblems, so nothing needs to be cached. DP's subproblems overlap (the same smaller input recurs across different branches of the recursion), so naive recursion redoes identical work repeatedly; DP avoids that with memoization (top-down) or tabulation (bottom-up).

**Q: Why is merge sort stable, and why might that matter?**
A: It's stable because the merge step, when elements from `left` and `right` are equal, always takes the element from `left` first (`if (left[i] <= right[j])`), preserving their original relative order. This matters when sorting objects by one field while wanting to preserve existing order for ties on a secondary field — e.g., sorting orders by date after they were already sorted by customer name; a stable sort keeps same-date orders in customer-name order.

**Q: How does binary search fit the divide-and-conquer pattern despite having no explicit "combine" step?**
A: The divide step (comparing the target to the middle element) directly determines which half could possibly contain the answer, so only one recursive call is ever made (not two, unlike merge sort) — the other half is simply discarded. Since only one subproblem is solved and its result already *is* the answer to the original problem, there's nothing to combine; this is why binary search is O(log n) rather than O(n log n) — there's exactly one recursive branch per level instead of two.

## Related Topics

- [recursion.md](./recursion.md)
- [dynamic-programming.md](./dynamic-programming.md)
- [sorting-algorithms.md](./sorting-algorithms.md)
- [searching-algorithms.md](./searching-algorithms.md)
- [big-o-notation.md](./big-o-notation.md)
</content>
</invoke>
<parameter name="file_path">D:\Learning-Projects\Interview\Data Structure\dynamic-programming.md