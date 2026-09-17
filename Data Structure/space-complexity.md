# Space Complexity

Space complexity measures how much memory an algorithm needs as a function of input size `n`, and like time complexity it's expressed using asymptotic notation (`O(1)`, `O(n)`, `O(n²)`, etc.). Total space complexity includes both the space taken by the input itself and any *additional* memory the algorithm allocates while running; in practice, interviewers almost always care about **auxiliary space** — the extra memory used beyond the input — because the input's footprint is a given, not something the algorithm's design controls.

A key distinction is **in-place** versus **out-of-place** (not-in-place) algorithms. An in-place algorithm transforms the input using only `O(1)` (or sometimes `O(log n)`, for recursive in-place algorithms) auxiliary space — it mutates the original structure rather than building a new one. An out-of-place algorithm allocates new memory proportional to the input to produce its result, typically `O(n)`. Neither is universally "better": in-place algorithms save memory but mutate the caller's data (which may be undesirable if the original is needed elsewhere) and can be harder to implement correctly (e.g., in-place array reversal must carefully swap without an intermediate copy); out-of-place algorithms are often simpler and leave the original untouched, at the cost of extra memory.

Recursion has a specific, often-overlooked space cost: every recursive call pushes a new stack frame (containing local variables, parameters, and the return address) onto the call stack, and that frame isn't popped until the call returns. This means a recursive algorithm's space complexity includes `O(depth of recursion)` **call-stack space**, even if it allocates no other data structures. A recursive function that recurses to depth `n` — like an unoptimized recursive factorial or a naive tree traversal on a maximally unbalanced tree — has `O(n)` space complexity from the stack alone, whereas an equivalent iterative version using a simple loop and a few variables would be `O(1)`. This is precisely why deep, unbounded recursion risks a stack overflow, and why converting recursion to iteration (often using an explicit heap-allocated stack, which trades call-stack space for heap space but avoids the fixed stack-size limit) is a common technique for handling very large or adversarially deep inputs. See `recursion.md` for more on the recursion/iteration tradeoff.

The classic space-complexity comparison in sorting is heapsort versus mergesort: both run in `O(n log n)` time, but heapsort sorts **in-place** using only `O(1)` auxiliary space (it repeatedly extracts the max from a heap built directly within the input array), while standard mergesort is **out-of-place**, needing `O(n)` auxiliary space for the temporary arrays used during each merge step. This is a real, practical tradeoff engineers make: mergesort is stable (preserves the relative order of equal elements) and has more predictable cache/performance behavior, while heapsort trades that away for a much smaller memory footprint — relevant when sorting huge datasets with limited RAM.

## Examples

```js
// O(1) auxiliary space: in-place array reversal.
// No new data structure proportional to n is allocated -- just two pointers.
function reverseInPlace(arr) {
  let left = 0, right = arr.length - 1;
  while (left < right) {
    [arr[left], arr[right]] = [arr[right], arr[left]]; // swap, no extra array
    left++;
    right--;
  }
  return arr; // mutates and returns the original array
}
```

```js
// O(n) auxiliary space: out-of-place reversal (builds a brand-new array).
function reverseCopy(arr) {
  const result = new Array(arr.length); // n extra slots allocated
  for (let i = 0; i < arr.length; i++) {
    result[arr.length - 1 - i] = arr[i];
  }
  return result; // original arr is untouched
}
```

```js
// Recursion's hidden call-stack cost: O(n) space, not O(1),
// even though no explicit array/object is allocated.
function sumRecursive(arr, i = 0) {
  if (i === arr.length) return 0;      // base case
  return arr[i] + sumRecursive(arr, i + 1); // each call waits on the stack
}
// n nested calls are alive simultaneously at the deepest point -> O(n) stack space.

// The iterative equivalent uses O(1) space: no growing call stack.
function sumIterative(arr) {
  let total = 0;
  for (const x of arr) total += x; // one stack frame reused, O(1) space
  return total;
}
```

## Common Pitfalls / Gotchas

- Forgetting to count call-stack space for recursive solutions. A recursive function with no explicit auxiliary data structures can still be `O(n)` space (or worse, `O(n)` for each of `O(n)` parallel branches in an unmemoized exponential recursion) purely from stack frames — always ask "how deep does this recurse?" not just "what does it allocate?"
- Assuming "in-place" means zero extra memory in all cases. In-place recursive algorithms (like quicksort, which partitions the array in-place but still recurses) have `O(log n)` *auxiliary* space from the call stack even though no new array is built — "in-place" technically tolerates `O(log n)` stack space by convention, not strictly `O(1)`.
- Confusing input space with auxiliary space when stating complexity. If a problem says "return a new array of squares," the output array itself is `O(n)` and arguably unavoidable — the meaningful comparison between two solutions is their *additional* space beyond input and required output, not total space including things you must return.
- Ignoring memoization's space cost when praising its time savings. Converting exponential recursion (like naive Fibonacci) to `O(n)` time via memoization trades that time savings for `O(n)` additional space to store the memo table — it's a real tradeoff, not a free win, and should be stated as such.
- Treating string/array slicing as free. `arr.slice()`, `str.substring()`, and similar operations allocate new memory proportional to the slice length — using them repeatedly inside a recursive or loop-based algorithm (e.g., `mergeSort` using `arr.slice()` at each recursive call) adds real auxiliary space beyond just the call stack.

## Interview Questions & Answers

**Q: What's the difference between auxiliary space and total space complexity?**
A: Total space complexity counts all memory the algorithm uses, including the space taken by the input itself. Auxiliary space counts only the *extra* memory used beyond the input — temporary variables, additional data structures, and (for recursive algorithms) call-stack frames. Interview and design discussions almost always mean auxiliary space when they say "space complexity," since the input's memory footprint isn't something the algorithm's design affects.

**Q: Why does recursion have O(depth) space complexity even if the function doesn't allocate any arrays or objects?**
A: Every recursive call adds a new stack frame to the call stack, holding that call's local variables, parameters, and return address, and that frame stays allocated until the call returns. If a function recurses to a maximum depth of `d` before hitting its base case, up to `d` stack frames exist simultaneously at the deepest point, giving `O(d)` space purely from call-stack bookkeeping — independent of whatever other data structures the function does or doesn't create.

**Q: Compare the space complexity of heapsort and mergesort, given that both run in O(n log n) time.**
A: Heapsort sorts in-place using `O(1)` auxiliary space — it repeatedly swaps the max element to the end of the array within a heap structure built directly over the input array, needing no separate output buffer. Mergesort is not in-place in its standard implementation: each merge step needs a temporary array to merge two sorted halves into, giving `O(n)` auxiliary space overall. They have identical time complexity, so the choice between them often comes down to this space tradeoff, plus stability (mergesort is stable, heapsort is not) and cache-locality behavior.

**Q: How would you reduce a recursive algorithm's space usage from O(n) to O(1)?**
A: Convert it to an iterative version using a simple loop with a fixed number of variables, if the recursion is tail-recursive or otherwise expressible with an accumulator pattern — this eliminates the growing call stack entirely (JavaScript engines don't reliably implement tail-call optimization, so this conversion is done manually, not left to the compiler). If the recursion genuinely needs to track nested state that can't collapse into a few variables (e.g., tree traversal), you can convert it to an iterative form using an explicit stack data structure allocated on the heap — this doesn't reduce the space complexity itself (still `O(n)` or `O(depth)`) but avoids the fixed-size call stack limit, preventing a stack overflow on very deep inputs.

**Q: What's the space complexity of memoized Fibonacci compared to naive recursive Fibonacci, and is memoization "free"?**
A: Naive recursive Fibonacci has `O(n)` space from call-stack depth alone (the deepest branch of recursion goes `n` levels down), despite `O(2ⁿ)` time. Memoized Fibonacci also uses `O(n)` space — `O(n)` for the memo table (cache of previously computed results) plus `O(n)` for the call stack — but drops time complexity to `O(n)`. So memoization here doesn't cost extra space asymptotically (both are `O(n)`) while dramatically improving time — but that's not true in general; memoization always adds space proportional to the number of distinct subproblems cached, which can matter when subproblems are numerous or individually large.

## Related Topics

- [time-complexity.md](./time-complexity.md)
- [big-o-notation.md](./big-o-notation.md)
- [asymptotic-notations.md](./asymptotic-notations.md)
- [recursion.md](./recursion.md)
- [sorting-algorithms.md](./sorting-algorithms.md)
- [dynamic-programming.md](./dynamic-programming.md)
