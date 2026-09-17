# Stacks

A stack is a linear data structure that enforces Last-In-First-Out (LIFO) ordering: the only element you can inspect or remove is the one most recently added. It exposes a narrow interface — `push` (add to the top), `pop` (remove and return the top), and `peek`/`top` (inspect the top without removing it) — and deliberately does *not* support arbitrary access, which is the point: restricting access patterns is what makes every operation O(1) and what makes the structure the right tool for problems that are naturally "undo the most recent thing" or "process in reverse order of arrival."

A stack can be backed by either an array or a linked list, and both give O(1) push/pop/peek in the typical case. An array-backed stack pushes/pops at the *end* of the array (not the front), which is O(1) amortized — the same amortized-doubling behavior as a dynamic array's `push`, since a stack never needs to shift elements the way `unshift`/`shift` would. A linked-list-backed stack pushes/pops at the *head* of the list, which is strictly O(1) (no shifting, no resizing) but carries per-node pointer overhead and worse cache locality than the array version. In JavaScript, `Array.prototype.push`/`pop` already give you an array-backed stack directly.

Stacks are the structure underlying the **call stack**: every function call pushes a new stack frame (holding local variables, the return address, and saved registers), and returning pops that frame off — which is precisely why deep unbounded recursion throws a `RangeError: Maximum call stack size exceeded` in JS (or a native "stack overflow") rather than degrading gracefully: the call stack has a fixed maximum size, and pushing past it is a hard error, not a slowdown. This connects stacks directly to how recursion is implemented at the hardware/runtime level, and why any recursive algorithm can, in principle, be rewritten iteratively using an explicit stack to simulate the same call-and-return behavior.

Classic use cases beyond the call stack include: **undo/redo** functionality (push each action, pop to undo), **expression evaluation and parsing** (matching brackets, evaluating postfix/infix expressions, and the shunting-yard algorithm for converting infix to postfix), **depth-first search** (DFS) over graphs/trees using either the implicit call stack via recursion or an explicit stack iteratively, and **backtracking algorithms** where you push a choice, explore, and pop it to try the next alternative.

## Examples

```js
// A Stack class backed by an array — push/pop/peek all O(1)
class Stack {
  constructor() {
    this._items = [];
  }

  push(value) {
    this._items.push(value); // O(1) amortized
  }

  pop() {
    if (this.isEmpty()) throw new Error('Stack is empty');
    return this._items.pop(); // O(1) — removes from the end, no shifting
  }

  peek() {
    if (this.isEmpty()) throw new Error('Stack is empty');
    return this._items[this._items.length - 1]; // O(1)
  }

  isEmpty() {
    return this._items.length === 0;
  }

  get size() {
    return this._items.length;
  }
}

const s = new Stack();
s.push(1);
s.push(2);
s.push(3);
console.log(s.pop());  // 3 — most recently pushed comes out first (LIFO)
console.log(s.peek()); // 2
console.log(s.size);   // 2
```
Time: push/pop/peek/isEmpty all O(1) amortized (push can occasionally be O(n) on a resize, same as any dynamic array). Space: O(n) for n elements.

```js
// Valid parentheses matching — classic interview question
function isValid(str) {
  const stack = [];
  const pairs = { ')': '(', ']': '[', '}': '{' };

  for (const char of str) {
    if (char === '(' || char === '[' || char === '{') {
      stack.push(char); // opening bracket: remember it
    } else if (char in pairs) {
      const top = stack.pop(); // closing bracket: must match the most recent opener
      if (top !== pairs[char]) return false; // wrong type, or stack was empty (top === undefined)
    }
  }

  return stack.length === 0; // no unmatched openers left over
}

console.log(isValid('{[()()]}')); // true
console.log(isValid('{[(])}'));   // false — brackets cross instead of nesting
console.log(isValid('(('));       // false — unmatched opener
```
Time: O(n) — one pass through the string, each character pushed/popped at most once. Space: O(n) worst case (all opening brackets, e.g. `"((((("`).

```js
// Evaluating a postfix (Reverse Polish Notation) expression using a stack
function evalPostfix(tokens) {
  const stack = [];
  const ops = {
    '+': (a, b) => a + b,
    '-': (a, b) => a - b,
    '*': (a, b) => a * b,
    '/': (a, b) => a / b,
  };

  for (const token of tokens) {
    if (token in ops) {
      const b = stack.pop(); // second operand was pushed last
      const a = stack.pop(); // first operand
      stack.push(ops[token](a, b));
    } else {
      stack.push(Number(token));
    }
  }

  return stack.pop(); // the final result is the only value left
}

// "3 4 + 2 *" means (3 + 4) * 2
console.log(evalPostfix(['3', '4', '+', '2', '*'])); // 14
```
Time: O(n) — one pass over the tokens, each pushed/popped a constant number of times. Space: O(n) worst case for the operand stack.

## Common Pitfalls / Gotchas

- Popping from an empty stack without checking first — `array.pop()` on an empty array silently returns `undefined` rather than throwing, which can mask bugs (e.g., in the valid-parentheses problem, an unmatched closing bracket pops `undefined` and must be explicitly treated as a mismatch, not ignored).
- Implementing a stack with `unshift`/`shift` (front-of-array) instead of `push`/`pop` (end-of-array) — this silently turns every O(1) operation into O(n) because the front of a JS array requires shifting all other elements.
- Confusing stack (LIFO) with queue (FIFO) semantics when translating a recursive algorithm into an iterative one — using a queue instead of a stack for iterative DFS turns it into BFS, visiting nodes in the wrong order.
- Forgetting that recursion depth is bounded by the call stack's size — a recursive solution that's correct in principle can blow the stack on large inputs where an equivalent explicit-stack iterative version would not (since heap-allocated data structures aren't bound by the same fixed limit as the call stack).
- In bracket-matching problems, forgetting to check that the stack is empty *at the end* — a string like `"(()"` has balanced-looking pairs at each step but leaves an unmatched opener, which only shows up if you verify `stack.length === 0` after the loop.

## Interview Questions & Answers

**Q: Given a string of brackets, determine if it's validly matched and nested. Walk through your approach.**
A: Push each opening bracket onto a stack. On each closing bracket, pop the stack and check that it matches the corresponding opening type — if it doesn't match (or the stack is empty, meaning there was nothing to match against), the string is invalid. After processing the whole string, the stack must be empty; if any openers remain unmatched, it's invalid. This works because a stack naturally enforces "the most recently opened bracket must be the next one closed," which is exactly the nesting rule. O(n) time, O(n) worst-case space.

**Q: How does the call stack relate to recursion, and why does deep recursion cause a stack overflow?**
A: Every function call pushes a new frame onto the call stack holding its local variables and return address; returning pops that frame. Recursive calls keep pushing new frames without popping until a base case is hit, so recursion depth is directly bounded by the call stack's fixed maximum size. If recursion goes deeper than that limit before hitting a base case, the runtime throws a stack overflow error rather than allocating more space, because the call stack (unlike heap memory) has a fixed, comparatively small size.

**Q: Implement a stack using only two queues, or explain conceptually how you'd do it.**
A: One common approach: maintain two queues, `q1` and `q2`. To push, enqueue onto `q2`, then dequeue everything from `q1` into `q2`, then swap the names of `q1` and `q2` — this keeps the most recently pushed element at the front of `q1`. To pop, just dequeue from `q1`. This makes push O(n) and pop O(1) (or you can invert which operation is expensive) — the point of the exercise is demonstrating that LIFO behavior can be simulated on top of FIFO primitives, at the cost of moving the O(n) work to one side.

**Q: What's the time complexity of push and pop on an array-backed stack, and are there any caveats?**
A: Both are O(1) amortized when implemented at the *end* of the array (JS `push`/`pop`), because appending/removing the last element never requires shifting other elements. The caveat is the same amortized-doubling caveat as any dynamic array: an individual push that triggers a backing-array resize costs O(n) for that one call, but this happens exponentially rarely, so the amortized cost averages to O(1) over a sequence of operations.

**Q: How would you evaluate a postfix (Reverse Polish Notation) expression like "3 4 + 2 *"?**
A: Scan the tokens left to right. Push numbers onto a stack. When you hit an operator, pop the top two values (the second-popped is the left operand, the first-popped is the right operand, since it was pushed more recently), apply the operator, and push the result back. After processing every token, the single value remaining on the stack is the answer. This works in one O(n) pass because postfix notation guarantees operands always precede their operator, so a stack naturally accumulates exactly the operands each operator needs.

## Related Topics

- [queues.md](./queues.md)
- [linked-lists.md](./linked-lists.md)
- [arrays.md](./arrays.md)
- [recursion.md](./recursion.md)
- [graphs.md](./graphs.md)
- [time-complexity.md](./time-complexity.md)
