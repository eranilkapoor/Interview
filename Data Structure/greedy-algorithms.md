# Greedy Algorithms

A greedy algorithm builds a solution one step at a time, at every step making the choice that looks best *right now* — locally optimal — and never revisiting or reconsidering that choice later. This is what makes greedy algorithms fast (usually a single pass after a sort, O(n log n) overall) and simple to implement compared to exhaustively exploring alternatives. The catch is that a greedy strategy only produces a *globally* optimal answer when the problem itself has two specific properties: the **greedy-choice property** (a locally optimal choice at each step is always part of *some* globally optimal solution — you never need to undo it) and **optimal substructure** (once you fix that greedy choice, the remaining problem is a smaller instance of the same problem).

When both properties hold, greedy is not just fast — it's provably correct, typically shown with an "exchange argument" (assume some optimal solution differs from the greedy choice, then show swapping in the greedy choice doesn't make it worse). Activity selection — given a set of activities each with a start and end time, choose the maximum number that don't overlap — is the textbook example: always picking the remaining activity with the *earliest end time* is provably part of an optimal schedule, because finishing earliest leaves the most room for everything that comes after.

The equally important half of understanding greedy is knowing when it **fails** — and the standard counterexample is coin change with arbitrary denominations. Greedy (always take the largest coin that fits) gives the optimal answer for "canonical" coin systems like US currency (1, 5, 10, 25), but for a denomination set like `[1, 3, 4]` making change for 6, greedy picks 4 + 1 + 1 (3 coins) while the true optimum is 3 + 3 (2 coins) — the greedy choice at the first step (take the 4) actively excludes reaching the better answer. This is precisely the case where dynamic programming — which explores the full decision space and caches subproblem results rather than committing irrevocably to one choice — is required; see [dynamic-programming.md](./dynamic-programming.md).

## Examples

```js
// Greedy activity selection: maximize the number of non-overlapping activities.
// Sorting by END time (not start time — that's the classic mistake) and always keeping
// the earliest-ending compatible activity is provably optimal (exchange argument).
function activitySelection(activities) {
  const sorted = [...activities].sort((a, b) => a.end - b.end);
  const selected = [sorted[0]];
  let lastEnd = sorted[0].end;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start >= lastEnd) {   // compatible: doesn't overlap the last selected activity
      selected.push(sorted[i]);
      lastEnd = sorted[i].end;
    }
  }
  return selected;
}

const activities = [
  { name: 'A', start: 1, end: 4 }, { name: 'B', start: 3, end: 5 },
  { name: 'C', start: 0, end: 6 }, { name: 'D', start: 5, end: 7 },
  { name: 'E', start: 8, end: 9 },
];
activitySelection(activities); // A(1-4), D(5-7), E(8-9) — 3 activities, none overlapping
```

```js
// Greedy coin change — correct ONLY for a canonical denomination system (like US coins),
// where always taking the largest coin that fits is guaranteed optimal.
function greedyCoinChange(denominations, amount) {
  const coins = [...denominations].sort((a, b) => b - a); // largest first
  const used = [];
  let remaining = amount;

  for (const coin of coins) {
    while (remaining >= coin) {
      used.push(coin);
      remaining -= coin;
    }
  }
  return remaining === 0 ? used : null; // null: couldn't make exact change with this set
}

greedyCoinChange([25, 10, 5, 1], 63); // [25, 25, 10, 1, 1, 1] — 6 coins, optimal for US coins
```

```js
// Where greedy FAILS: a non-canonical denomination system.
// Greedy takes the biggest coin first and never reconsiders — even when that choice
// forecloses a better overall answer. This is exactly why DP (which explores every
// combination via memoized subproblems) exists for the general coin change problem.
greedyCoinChange([4, 3, 1], 6);
// Greedy: takes 4 first (largest ≤ 6), then remaining=2, takes 1, 1 → [4, 1, 1] = 3 coins.
// Optimal: 3 + 3 = 2 coins. Greedy's first choice (the 4) actively prevents reaching it.
// The general (non-canonical) coin change problem needs DP — see dynamic-programming.md.
```

## Common Pitfalls / Gotchas

- Assuming greedy is always "the simple, obviously fine" approach — it's only *correct* when the problem provably has the greedy-choice property and optimal substructure; otherwise it silently produces a wrong (suboptimal) answer with no error or warning.
- Sorting activity selection by **start** time instead of **end** time — a very common mistake that breaks the algorithm's correctness (starting earliest says nothing about how much room you leave for later activities).
- Assuming greedy coin change generalizes to arbitrary denominations — it only works for canonical coin systems; for general denominations, use DP (tabulated minimum-coins-to-make-amount) instead.
- Confusing "greedy runs fast" with "greedy is correct" — greedy's speed advantage over DP/backtracking is real, but it's irrelevant if the answer it produces isn't actually optimal for your specific problem.
- Not verifying the exchange-argument proof (even informally) before assuming a new problem is greedy-solvable — plenty of problems *look* like activity selection or coin change but subtly lack the greedy-choice property.

## Interview Questions & Answers

**Q: What two properties must a problem have for a greedy algorithm to guarantee an optimal solution?**
A: The greedy-choice property (a locally optimal choice made at each step is always safely part of *some* globally optimal solution, so you never need to backtrack on it) and optimal substructure (after making that choice, what remains is a smaller instance of the same problem). Both must hold — greedy-choice property alone doesn't guarantee the remaining subproblem behaves the same way.

**Q: Why is sorting by end time (not start time) essential for activity selection?**
A: Picking the activity that finishes earliest — among all that are still compatible — leaves the maximum possible remaining time for scheduling everything after it, which is exactly what an exchange argument formalizes: any optimal schedule can be transformed to start with the earliest-finishing activity without reducing the count. Sorting by start time provides no such guarantee — an activity that starts early but runs very long can block far more of the timeline than a short one.

**Q: When does greedy coin change fail, and what's the fix?**
A: It fails for non-canonical denomination sets — e.g. `[1, 3, 4]` making 6: greedy takes 4 then 1+1 (3 coins) instead of the optimal 3+3 (2 coins), because committing to the largest coin first forecloses a better combination. The fix is dynamic programming: build a table of the minimum coins needed for every amount from 0 up to the target, using previously computed smaller amounts — this explores the full decision space instead of committing irrevocably at each step.

**Q: Give a real-world example of a correct greedy algorithm beyond coin change and activity selection.**
A: Huffman coding (building an optimal prefix-free binary code by always merging the two lowest-frequency nodes) and Dijkstra's shortest path (always finalizing the closest unvisited vertex next) are both provably correct greedy algorithms — each relies on a proof that the locally optimal choice can't be improved on by revisiting it later, given the specific structure of the problem (non-negative weights, for Dijkstra).

**Q: What's the time complexity of the activity selection algorithm, and where does it come from?**
A: O(n log n), dominated entirely by the initial sort; the single pass that follows to select compatible activities is O(n). This is the typical shape of a greedy algorithm — sort once by the criterion that makes the greedy choice well-defined, then do a linear scan making that choice at each step.

## Related Topics

- [dynamic-programming.md](./dynamic-programming.md)
- [divide-and-conquer.md](./divide-and-conquer.md)
- [minimum-spanning-tree.md](./minimum-spanning-tree.md)
- [big-o-notation.md](./big-o-notation.md)
</content>
</invoke>
