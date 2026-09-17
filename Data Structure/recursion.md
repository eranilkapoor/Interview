# Recursion

Recursion is a technique where a function solves a problem by calling itself on a smaller version of the same problem, until it reaches a **base case** simple enough to answer directly without further recursive calls. Every recursive function needs exactly those two pieces: at least one base case that terminates the recursion, and a recursive case that reduces the problem toward that base case with each call. Miss the base case, or fail to actually move toward it (e.g., calling with the same or a larger input), and the function recurses forever — or, in practice, until it exhausts the call stack and throws a `RangeError: Maximum call stack size exceeded`.

Mechanically, each recursive call pushes a new **stack frame** onto the call stack — a record of that call's local variables, parameters, and the point execution should return to. This is why recursion depth is bounded by available stack space (a few thousand to tens of thousands of frames in most JS engines, browser/Node-dependent) and why deeply recursive solutions to problems with large inputs (e.g., naively recursing over a 100,000-element array) can blow the stack where an iterative loop wouldn't. Understanding this stack mechanism is also what makes tree and graph recursion (DFS) intuitive: the call stack itself acts as the "path back" from a leaf to the root, without you having to manage that path explicitly.

A special case, **tail recursion**, occurs when the recursive call is the very last operation in a function — nothing left to do with its result except return it directly. In languages that guarantee **tail-call optimization (TCO)**, the engine can reuse the current stack frame for the recursive call instead of pushing a new one, turning tail recursion into something that runs in constant stack space, just like a loop. TCO is part of the ES2015 (ES6) specification, but — and this is a common interview trap — **no major JavaScript engine actually implements it** (V8/Chrome/Node included, aside from a brief, since-reverted Safari/JavaScriptCore attempt). So writing "tail-recursive" JS code does *not* protect you from stack overflows in practice; if depth is a real concern, convert to an explicit loop or trampoline instead.

## Examples

```js
// Classic recursion: factorial. Base case n <= 1, recursive case n * factorial(n-1).
function factorial(n) {
  if (n < 0) throw new RangeError('factorial is undefined for negative numbers');
  if (n <= 1) return 1;               // base case
  return n * factorial(n - 1);        // recursive case: moves toward the base case
}
factorial(5); // 5 * 4 * 3 * 2 * 1 = 120
```

```js
// Naive recursive Fibonacci — correct, but exponential O(2^n) because fib(k) gets
// recomputed many times across overlapping calls (fib(5) calls fib(3) twice, etc.).
// This is the canonical motivation for memoization — see dynamic-programming.md.
function fib(n) {
  if (n <= 1) return n;               // base cases: fib(0) = 0, fib(1) = 1
  return fib(n - 1) + fib(n - 2);     // recursive case
}
fib(10); // 55
```

```js
// "Tail-recursive" factorial using an accumulator — the recursive call is the LAST
// thing the function does, with nothing pending afterward. This is what TCO would
// optimize into a loop IF JS engines implemented it (they don't, in practice — V8/Node
// included), so this still risks a stack overflow for very large n despite the style.
function factorialTail(n, accumulator = 1) {
  if (n <= 1) return accumulator;
  return factorialTail(n - 1, n * accumulator); // tail call: nothing left to do after it
}
factorialTail(5); // 120

// The genuinely stack-safe version in real JS: an explicit loop.
function factorialIterative(n) {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}
```

## Common Pitfalls / Gotchas

- Forgetting or misplacing the base case, causing infinite recursion until the call stack overflows — always write and check the base case *before* the recursive case.
- Writing a recursive case that doesn't actually shrink the problem toward the base case (e.g., calling `f(n)` again instead of `f(n-1)`), which causes infinite recursion even with a base case present.
- Assuming JavaScript optimizes tail calls because the ES2015 spec allows it — no major engine (V8/Node/Chrome, current Safari) actually implements TCO, so "tail-recursive" style code can still overflow the stack on deep inputs.
- Using naive (non-memoized) recursion on problems with overlapping subproblems (like Fibonacci) and being surprised by exponential blowup — check whether subproblems repeat before assuming plain recursion is fast enough.
- Recursing over large flat structures (e.g., a huge array or a long linked list) where an equivalent iterative loop would be both faster (no per-call overhead) and immune to stack-depth limits.

## Interview Questions & Answers

**Q: What two things does every correct recursive function need?**
A: A base case (or cases) that returns a result directly without recursing, and a recursive case that calls itself on a strictly smaller/simpler version of the problem, guaranteed to progress toward a base case. Without the first, recursion never stops; without the second, it stops "in theory" but never reaches the base case in practice.

**Q: What is tail recursion, and does JavaScript optimize it?**
A: Tail recursion is when the recursive call is the last action a function performs, with nothing left to compute after it returns — no pending multiplication, addition, etc. The ES2015 spec permits engines to implement proper tail calls (reusing the current stack frame instead of pushing a new one, giving O(1) stack space), but in practice no major JS engine does this today (V8, and therefore Chrome and Node, never implemented it; Safari's early implementation was removed). So tail-recursive JS code still consumes O(n) stack frames and can overflow on deep recursion.

**Q: Why does naive recursive Fibonacci run in exponential time?**
A: `fib(n)` makes two recursive calls, `fib(n-1)` and `fib(n-2)`, and those calls' subtrees overlap heavily — e.g. `fib(n-2)` is recomputed independently inside both the `fib(n-1)` and `fib(n-2)` call trees. Without caching, the same subproblems get solved repeatedly, and the total number of calls grows as roughly O(2^n). Memoizing results (storing each `fib(k)` the first time it's computed) collapses this to O(n).

**Q: How does recursion relate to the call stack, and how does that explain "stack overflow"?**
A: Each recursive call pushes a new stack frame holding that call's parameters, local variables, and return address; the frame is popped only when that call returns. Recursion depth is therefore bounded by how many frames the stack can hold — a few thousand to tens of thousands, depending on the engine and available memory. A missing/unreachable base case, or simply a legitimately very deep recursion (e.g., processing a 500,000-node linked list recursively), exhausts that space and throws `RangeError: Maximum call stack size exceeded`.

**Q: When would you prefer an iterative solution over a recursive one in JavaScript?**
A: When input size could be large enough to risk a stack overflow (since JS has no reliable TCO to fall back on), or when the constant overhead of function calls matters for performance-critical code — a loop avoids both. Recursion is still preferable when it makes the algorithm's structure dramatically clearer (tree/graph traversal, divide-and-conquer) and the recursion depth is bounded and small relative to stack limits.

## Related Topics

- [divide-and-conquer.md](./divide-and-conquer.md)
- [dynamic-programming.md](./dynamic-programming.md)
- [stacks.md](./stacks.md)
- [big-o-notation.md](./big-o-notation.md)
- [trees.md](./trees.md)
</content>
</invoke>
