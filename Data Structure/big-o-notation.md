# Big-O Notation

Big-O notation describes the *upper bound* on how an algorithm's running time (or memory usage) grows as the size of its input, `n`, grows toward infinity. It answers one specific question: "if I double the input size, roughly how much worse does this get?" — not "how many milliseconds will this take on my laptop." Because it discards machine-specific constants (CPU speed, language overhead, cache behavior) and focuses purely on the *rate of growth*, Big-O lets you compare two algorithms' scalability independent of hardware.

You derive an algorithm's Big-O by counting the number of elementary operations as a function of `n`, then keeping only the fastest-growing term and dropping constant factors and lower-order terms. For example, an algorithm that does `3n² + 5n + 100` operations is `O(n²)`: as `n` grows large, the `n²` term dominates so completely that the `5n` and `100` become irrelevant, and the constant `3` doesn't change which algorithm "wins" as input grows — it only shifts a fixed multiplier. This is why `O(n)` code that does 1000 operations per element is still, asymptotically, better than `O(n²)` code once `n` is large enough, even though the `O(n)` version looks "slower" on paper for small inputs.

By convention, when people say an algorithm "is O(n²)" without qualification, they usually mean its *worst-case* time complexity — the input arrangement that makes the algorithm do the most work (e.g., a reverse-sorted array for insertion sort). Worst-case is the standard because it's a guarantee: it bounds how bad things can get regardless of input, which matters far more for reliability (SLAs, real-time systems, security against adversarial input) than an average-case number that could still spike badly on some inputs. Big-O is technically only an *upper bound* (an algorithm that's `O(n²)` is also technically `O(n³)`, `O(n⁴)`, etc.), but in practice people use it to mean the *tightest* upper bound that applies — see `asymptotic-notations.md` for the full family of notations (Ω for lower bound, Θ for tight bound) that make this precise.

Complexity classes are typically ordered, from best to worst for large `n`: `O(1)` (constant) < `O(log n)` (logarithmic) < `O(n)` (linear) < `O(n log n)` (linearithmic) < `O(n²)` (quadratic) < `O(2ⁿ)` (exponential) < `O(n!)` (factorial). Recognizing which class a piece of code falls into — usually by counting nested loops over the input, or recognizing a "halving" pattern that signals logarithmic behavior — is the single most tested skill in algorithm interviews.

## Examples

```js
// O(1) — constant time: accessing an array index or object key
// does the same fixed amount of work regardless of array size.
function firstElement(arr) {
  return arr[0]; // O(1)
}

// O(log n) — logarithmic: binary search halves the search space
// on every iteration, so the number of steps grows with log2(n).
function binarySearch(sortedArr, target) {
  let lo = 0, hi = sortedArr.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (sortedArr[mid] === target) return mid;
    if (sortedArr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1; // e.g. 1,000,000 elements -> at most ~20 comparisons
}
```

```js
// O(n) — linear: one pass over every element.
function sum(arr) {
  let total = 0;
  for (const x of arr) total += x; // n iterations
  return total;
}

// O(n log n) — linearithmic: the complexity of any comparison-based
// sort's optimal case (merge sort, heap sort, well-implemented quicksort).
function mergeSort(arr) {
  if (arr.length <= 1) return arr;
  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));   // T(n/2)
  const right = mergeSort(arr.slice(mid));     // T(n/2)
  return merge(left, right);                   // O(n) merge step
}
function merge(a, b) {
  const result = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    result.push(a[i] <= b[j] ? a[i++] : b[j++]);
  }
  return result.concat(a.slice(i), b.slice(j));
}
// Recurrence T(n) = 2T(n/2) + O(n) solves to O(n log n) by the Master Theorem.
```

```js
// O(n^2) — quadratic: a nested loop comparing every pair of elements.
function hasDuplicatePair(arr) {
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j]) return true; // n*(n-1)/2 comparisons -> O(n^2)
    }
  }
  return false;
}

// O(2^n) — exponential: naive recursive Fibonacci re-solves the same
// subproblems repeatedly, so the call tree branches in two at every level.
function fibNaive(n) {
  if (n <= 1) return n;
  return fibNaive(n - 1) + fibNaive(n - 2); // 2 recursive calls per call
}
```

## Common Pitfalls / Gotchas

- Confusing "Big-O" with "the exact runtime." `O(n)` code with a huge constant factor can easily be slower in practice than `O(n log n)` code for realistic input sizes — Big-O only tells you about the growth trend as `n → ∞`, not which is faster at `n = 100`.
- Forgetting that array/string methods hide their own complexity: `Array.prototype.includes()`, `indexOf()`, `slice()`, and `shift()`/`unshift()` are all `O(n)`, not `O(1)` — calling them inside a loop silently turns an apparently `O(n)` algorithm into `O(n²)`.
- Treating "worst case" and "the only case" as the same thing. Quicksort is `O(n log n)` on average but `O(n²)` in the worst case (e.g., already-sorted input with a naive pivot choice) — always be ready to state which case you're describing.
- Dropping constants incorrectly when they matter for a decision. `O(1)` extra space with a constant of "one million array allocations" can genuinely be worse in practice than an `O(n)` solution — Big-O is a tool for asymptotic reasoning, not a substitute for actually profiling when constants are large.
- Miscounting nested loops that don't both run to `n`. A loop nested inside another where the inner loop's bound shrinks each time (like the pair-comparison example above) is still `O(n²)`, but a loop where the inner loop only runs a constant number of times regardless of `n` is `O(n)`, not `O(n²)`.

## Interview Questions & Answers

**Q: What does it mean for an algorithm to be O(n log n), and can you name an algorithm that achieves it?**
A: It means the running time grows proportionally to `n` multiplied by `log n` as input size increases. Merge sort achieves this: it recursively splits the array in half (`log n` levels of recursion) and does `O(n)` work merging at each level, giving a total of `O(n log n)`. This is also the proven lower bound for any comparison-based sorting algorithm — you cannot comparison-sort faster than `O(n log n)` in the general case.

**Q: Is O(1) always faster than O(n)?**
A: Not necessarily in absolute terms for small or fixed input sizes — an `O(1)` operation with an enormous constant factor could take longer than an `O(n)` operation with a tiny constant, for realistic `n`. Big-O describes asymptotic growth as `n` approaches infinity, not a guarantee about any specific input size. That said, for large enough `n`, an `O(n)` algorithm will always eventually overtake an `O(1)` one in cost, by definition.

**Q: Given this function, what is its time complexity and why?**
```js
function printPairs(arr) {
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length; j++) {
      console.log(arr[i], arr[j]);
    }
  }
}
```
A: `O(n²)`. The outer loop runs `n` times, and for each outer iteration the inner loop also runs `n` times fully (not shrinking, unlike the "avoid duplicate pairs" example), giving exactly `n * n = n²` total iterations of the print statement.

**Q: Why is worst-case complexity the default convention instead of average-case?**
A: Worst-case gives a hard upper bound that holds for *any* input, including adversarial or pathological ones, which is critical for reliability guarantees, real-time systems, and security (an attacker could deliberately construct worst-case input, e.g., to trigger algorithmic-complexity denial-of-service). Average-case requires assumptions about the input distribution that may not hold in production, whereas worst-case makes no such assumption.

**Q: How would you determine the Big-O of a piece of code that has two separate (not nested) loops followed by a nested loop?**
A: Add the complexities of sequential blocks and take the dominant term. Two separate `O(n)` loops sum to `O(n) + O(n) = O(2n)`, which simplifies to `O(n)`. If a nested `O(n²)` loop follows, the total is `O(n) + O(n²)`, which simplifies to `O(n²)` since it dominates for large `n` — you always keep only the fastest-growing term across the whole function.

## Related Topics

- [asymptotic-notations.md](./asymptotic-notations.md)
- [time-complexity.md](./time-complexity.md)
- [space-complexity.md](./space-complexity.md)
- [sorting-algorithms.md](./sorting-algorithms.md)
- [searching-algorithms.md](./searching-algorithms.md)
- [recursion.md](./recursion.md)
