# Dynamic Programming

Dynamic programming (DP) solves problems by breaking them into subproblems, just like divide and conquer — but it applies specifically when those subproblems **overlap** (the same smaller subproblem is needed by multiple different branches of the recursion) and the problem has **optimal substructure** (an optimal solution to the whole problem can be built from optimal solutions to its subproblems). The canonical illustration is naive recursive Fibonacci: computing `fib(5)` requires `fib(4)` and `fib(3)`, but `fib(4)` *also* requires `fib(3)` — so plain recursion solves `fib(3)` (and progressively smaller values) an exponentially growing number of times. DP eliminates that redundant work by solving each distinct subproblem exactly once and reusing the result.

There are two equivalent ways to apply DP. **Memoization** (top-down) keeps the natural recursive structure but adds a cache (an object, `Map`, or array) that stores each subproblem's result the first time it's computed, so any later call with the same input returns instantly instead of recomputing. **Tabulation** (bottom-up) inverts the approach: it builds a table iteratively, starting from the smallest subproblems (base cases) and working up to the target, so that by the time a larger subproblem needs a smaller one, it's already sitting in the table. Memoization is usually easier to derive directly from a recursive brute-force solution; tabulation avoids recursion's call-stack overhead entirely and is often more memory-efficient because you can discard rows/values you no longer need.

0/1 knapsack — given items with weights and values and a capacity, choose a subset (each item taken entirely or not at all) that maximizes total value without exceeding capacity — is the standard problem for tabulated DP because it makes both properties concrete: the optimal solution for capacity `w` using the first `i` items depends only on optimal solutions for smaller `i` and `w` (optimal substructure), and those smaller subproblems get reused across many different `(i, w)` combinations (overlapping subproblems). It also cleanly demonstrates why greedy fails here (picking items by best value/weight ratio can waste capacity, since you can't take a fractional item) where DP, by exploring the full "take it or don't" decision space, does not.

## Examples

```js
// Memoized (top-down) Fibonacci — the classic first DP example. The recursive
// structure is unchanged from naive recursion; only the cache is new.
function fib(n, memo = new Map()) {
  if (n <= 1) return n;                 // base cases: fib(0)=0, fib(1)=1
  if (memo.has(n)) return memo.get(n);  // overlapping subproblem already solved — reuse it

  const result = fib(n - 1, memo) + fib(n - 2, memo);
  memo.set(n, result);
  return result;
}
fib(50); // 12586269025 — instant; naive recursion would take exponential time here
```

```js
// Tabulated (bottom-up) Fibonacci — no recursion at all, just an iterative table
// build-up from the base cases. O(n) time, O(1) extra space (only need the last two).
function fibTabulated(n) {
  if (n <= 1) return n;
  let prev2 = 0, prev1 = 1; // fib(0), fib(1)
  for (let i = 2; i <= n; i++) {
    const current = prev1 + prev2;
    prev2 = prev1;
    prev1 = current;
  }
  return prev1;
}
fibTabulated(50); // 12586269025
```

```js
// Tabulated 0/1 knapsack: dp[i][w] = best value achievable using the first i items
// with capacity w. Optimal substructure: dp[i][w] depends only on dp[i-1][...].
// Overlapping subproblems: dp[i-1][w] is reused across many different w and later i.
function knapsack(capacity, weights, values) {
  const n = weights.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let w = 0; w <= capacity; w++) {
      if (weights[i - 1] <= w) {
        // choice: skip item i-1 (dp[i-1][w]) vs take it (its value + best for remaining capacity)
        dp[i][w] = Math.max(
          values[i - 1] + dp[i - 1][w - weights[i - 1]],
          dp[i - 1][w]
        );
      } else {
        dp[i][w] = dp[i - 1][w]; // item doesn't fit — can't take it
      }
    }
  }
  return dp[n][capacity];
}

const weights = [1, 3, 4, 5];
const values = [1, 4, 5, 7];
knapsack(7, weights, values); // 9 — items with weight 3 and 4 (values 4 + 5)
```

## Common Pitfalls / Gotchas

- Applying DP to a problem without overlapping subproblems — if the recursive subproblems never repeat (like merge sort's two independent halves), memoization adds cache overhead for zero benefit; that's plain divide and conquer, not DP.
- Forgetting the base case(s) in the memo/table, causing incorrect results or infinite recursion in the top-down version.
- Using recursive memoization on inputs large enough to overflow the call stack (JS has no reliable tail-call optimization — see [recursion.md](./recursion.md)) — tabulation avoids this entirely since it's iterative.
- Reaching for greedy on a problem that actually needs DP (like 0/1 knapsack) — greedy's locally-best choice (highest value/weight ratio) can lock in a suboptimal total because, unlike fractional knapsack, you can't take a partial item to use leftover capacity.
- Not recognizing that memoization needs the cache key to capture *all* varying parameters — memoizing a function with multiple arguments (e.g., knapsack's `(i, w)`) requires a composite key or nested structure, not just a single value.

## Interview Questions & Answers

**Q: What two properties must a problem have for dynamic programming to apply?**
A: Optimal substructure (an optimal solution to the problem can be constructed from optimal solutions to its subproblems) and overlapping subproblems (the same subproblems recur multiple times during a naive recursive solution, rather than each being solved exactly once as in divide and conquer). Without overlap, there's nothing for memoization/tabulation to save you from recomputing.

**Q: What's the difference between memoization and tabulation?**
A: Memoization is top-down: you keep the natural recursive formulation and add a cache that stores each subproblem's answer the first time it's computed, short-circuiting repeat calls. Tabulation is bottom-up: you iteratively fill a table starting from the base cases up to the target, with no recursion at all. Memoization is usually easier to write directly from a brute-force recursive solution; tabulation avoids call-stack depth limits and often allows further space optimization (e.g., keeping only the last row/two values instead of the whole table).

**Q: Why does greedy fail on 0/1 knapsack, and how does DP fix it?**
A: Greedy (always take the item with the best value-to-weight ratio that still fits) can leave unused capacity that a different combination could have filled more valuably, because unlike the *fractional* knapsack problem, you can't take a partial item to exactly use up remaining space — one wrong early commitment can lock out the true optimum. DP instead considers, for every item, both "include it" and "exclude it" as it builds up `dp[i][w]`, so it evaluates the full space of valid combinations without needing to backtrack, guaranteeing the actual optimum.

**Q: What's the time and space complexity of the tabulated 0/1 knapsack solution above, and how could you optimize its space?**
A: O(n × capacity) time and O(n × capacity) space for the 2D table, where n is the number of items. Since `dp[i][w]` only ever depends on row `i-1`, you can collapse the table to a single 1D array of size `capacity + 1` and iterate the capacity loop *backward* (from `capacity` down to `weights[i-1]`) when updating in place — this reduces space to O(capacity) while preserving correctness (iterating backward prevents using an item's own row-`i` update before its row-`i-1` value is read).

**Q: Why is naive recursive Fibonacci exponential, and how much does memoization improve it?**
A: Without caching, `fib(n)` branches into `fib(n-1)` and `fib(n-2)`, and this recursion tree has roughly 2^n nodes because the same smaller values (`fib(n-3)`, `fib(n-4)`, ...) are recomputed independently down every branch that reaches them — O(2^n) time. Memoizing collapses this to O(n) time (and O(n) space for the cache) because each distinct value from `fib(0)` to `fib(n)` is computed exactly once; every subsequent request for it is an O(1) cache lookup.

**Q: How would you reconstruct *which* items were chosen in the knapsack solution, not just the max value?**
A: Walk the filled `dp` table backward from `dp[n][capacity]`: at each step, if `dp[i][w] !== dp[i-1][w]`, item `i-1` was included — record it and move to `dp[i-1][w - weights[i-1]]`; otherwise item `i-1` was excluded — move to `dp[i-1][w]` unchanged. Repeat until `i` reaches 0; the recorded items are the optimal subset.

## Related Topics

- [recursion.md](./recursion.md)
- [divide-and-conquer.md](./divide-and-conquer.md)
- [greedy-algorithms.md](./greedy-algorithms.md)
- [big-o-notation.md](./big-o-notation.md)
- [space-complexity.md](./space-complexity.md)
</content>
</invoke>
