# Asymptotic Notations

Asymptotic notation is the mathematical vocabulary used to describe how a function's growth rate behaves as its input approaches infinity, and in algorithm analysis that function is almost always "number of operations as a function of input size `n`." There are three notations that matter for interviews, and each answers a different question: Big-O (`O`) bounds the growth from *above* (worst case / upper bound), Big-Omega (`Ω`) bounds it from *below* (best case / lower bound), and Big-Theta (`Θ`) bounds it *tightly* from both sides simultaneously (the function's true asymptotic rate, when upper and lower bounds coincide).

Formally: `f(n) = O(g(n))` if there exist positive constants `c` and `n₀` such that `f(n) ≤ c · g(n)` for all `n ≥ n₀` — in plain terms, past some threshold input size, `g(n)` (scaled by a constant) is always at least as large as `f(n)`. `f(n) = Ω(g(n))` is the mirror image: there exist constants `c, n₀` such that `f(n) ≥ c · g(n)` for all `n ≥ n₀` — `g(n)` is a lower bound on `f(n)`'s growth. `f(n) = Θ(g(n))` holds precisely when both conditions hold simultaneously — there exist `c₁, c₂, n₀` such that `c₁ · g(n) ≤ f(n) ≤ c₂ · g(n)` for all `n ≥ n₀`. `Θ` is the strongest, most informative statement: it says `f(n)` grows at *exactly* the rate of `g(n)`, not merely no-faster-than or no-slower-than.

These notations describe bounds on a function, and that function can represent the best case, worst case, or average case of an algorithm — the notation and the case are two independent axes, a distinction that trips people up constantly. For example, linear search has a best case of `Ω(1)` (the target is the first element — you get lucky immediately) and a worst case of `O(n)` (the target is last or absent — you must scan everything). Because its best and worst cases genuinely differ, linear search has no single `Θ` bound over all inputs; you'd instead say its worst-case complexity is `Θ(n)` (tight, because there really is an input, e.g., "target absent," that forces exactly `n` comparisons) even though `O(n)` is the more commonly quoted headline number.

Insertion sort demonstrates the same distinction cleanly: on an already-sorted array, it does `Θ(n)` work (one pass, no shifting needed) — that's its best case, tight. On a reverse-sorted array, it does `Θ(n²)` work (every element shifts all the way to the front) — that's its worst case, also tight. So insertion sort's overall worst-case complexity is correctly stated as `Θ(n²)` (not just `O(n²)`), because `n²` growth is both an upper *and* a lower bound on that specific case — there's no algorithm-level trick that makes the reverse-sorted case faster than quadratic. Quicksort, by contrast, has average/best-case `Θ(n log n)` but worst-case `Θ(n²)` (degenerate pivot selection on already-sorted input) — you must always specify *which case* you're bounding before quoting a notation.

## Examples

```js
// f(n) = 3n + 7 is Θ(n): it is both O(n) and Ω(n).
// Upper bound proof sketch: 3n + 7 <= 4n for all n >= 7  -> O(n), c=4, n0=7
// Lower bound proof sketch: 3n + 7 >= 3n for all n >= 0   -> Omega(n), c=3, n0=0
// Both hold simultaneously, so f(n) = Theta(n).
function linearWork(arr) {
  let touched = 0;
  for (const x of arr) touched++; // exactly n operations, plus constant overhead
  return touched;
}
```

```js
// Linear search: best case Omega(1), worst case O(n) -- no single Theta(n)
// bound describes ALL inputs, only the worst-case slice of inputs.
function linearSearch(arr, target) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === target) return i; // best case: i = 0, Omega(1)
  }
  return -1; // worst case: target missing, scanned all n, O(n) / Theta(n) for this case
}
```

```js
// Insertion sort: best case Theta(n) (already sorted, inner loop never shifts),
// worst case Theta(n^2) (reverse sorted, every element shifts to index 0).
function insertionSort(arr) {
  for (let i = 1; i < arr.length; i++) {
    const key = arr[i];
    let j = i - 1;
    while (j >= 0 && arr[j] > key) { // never executes on sorted input -> Theta(n) best case
      arr[j + 1] = arr[j];
      j--;
    }
    arr[j + 1] = key;
  }
  return arr;
}
```

## Common Pitfalls / Gotchas

- Using "Big-O" as a catch-all synonym for "complexity" when a tighter or different notation is actually being described. Saying "insertion sort is O(n) best case" is technically true (O is only an upper bound, and n² is also technically O(n²) which is ≥ n) but imprecise — `Θ(n)` is the correct, informative statement for that case.
- Conflating the *notation* (O, Ω, Θ) with the *case* (best, worst, average). An algorithm's worst case can itself be described tightly with Θ (e.g., "worst-case Θ(n²)") — these are two orthogonal concepts, not alternatives to choose between.
- Assuming every function has a Θ bound. A function whose growth genuinely differs across inputs of the same size `n` (like linear search's best vs. worst case) has no single Θ that covers *all* size-`n` inputs — Θ only applies once you've fixed which case (or which specific function) you're analyzing.
- Forgetting that Ω describes a lower bound on growth, not "a good thing." `Ω(n²)` means an algorithm needs *at least* quadratic work in some scenario — it's a floor, and for an algorithm's inherent lower bound (not just one case), it's often used to prove no faster algorithm can possibly exist (e.g., comparison sorting is `Ω(n log n)` in the worst case, an information-theoretic limit, not an implementation detail).

## Interview Questions & Answers

**Q: What's the difference between O, Ω, and Θ?**
A: `O(g(n))` is an upper bound — the function grows no faster than `g(n)`. `Ω(g(n))` is a lower bound — the function grows no slower than `g(n)`. `Θ(g(n))` requires both simultaneously — the function's growth rate matches `g(n)` exactly, sandwiched between two constant multiples of it. `Θ` is a strictly stronger and more precise claim than either `O` or `Ω` alone.

**Q: Give the formal definition of f(n) = O(g(n)).**
A: There exist positive constants `c` and `n₀` such that `0 ≤ f(n) ≤ c · g(n)` for all `n ≥ n₀`. Intuitively, once `n` is large enough, some constant multiple of `g(n)` always dominates `f(n)`.

**Q: Why do people say "quicksort is O(n log n)" when its worst case is actually Θ(n²)?**
A: This is technically a common looseness in everyday speech — people are referring to quicksort's average/expected-case behavior, `Θ(n log n)`, not its absolute worst case. Strictly, quicksort's worst-case bound is `Θ(n²)` (or you could correctly, if uselessly, say it's `O(n²)`). A precise answer distinguishes "average-case Θ(n log n)" from "worst-case Θ(n²)" rather than quoting a single unqualified number.

**Q: Can an algorithm's best case and worst case have different Big-O classes? Give an example.**
A: Yes. Linear search is `Ω(1)` best case (target found immediately) and `O(n)` / `Θ(n)` worst case (target absent, full scan required). Insertion sort is `Θ(n)` best case (sorted input) and `Θ(n²)` worst case (reverse-sorted input). Whenever best and worst cases differ, there's no single `Θ` bound that describes the algorithm across *all* inputs — only within a specified case.

**Q: Why is comparison-based sorting said to have a lower bound of Ω(n log n)?**
A: This is an information-theoretic argument, not implementation-specific: a comparison sort's decision process can be modeled as a binary decision tree with at least `n!` possible leaves (one per permutation of the input), and a binary tree with `n!` leaves needs a depth of at least `log₂(n!)`, which is `Θ(n log n)` by Stirling's approximation. This proves *no* comparison-based sort can beat `n log n` in the worst case, which is why merge sort and heap sort (`Θ(n log n)`) are considered asymptotically optimal comparison sorts.

## Related Topics

- [big-o-notation.md](./big-o-notation.md)
- [time-complexity.md](./time-complexity.md)
- [space-complexity.md](./space-complexity.md)
- [sorting-algorithms.md](./sorting-algorithms.md)
- [searching-algorithms.md](./searching-algorithms.md)
