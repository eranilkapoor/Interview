# Stack Overflow & Memory Leaks

A **stack overflow** occurs when the call stack grows beyond its (engine-specific but always finite) maximum size — almost always caused by recursion that either has no base case, or whose base case is never actually reached due to a logic error. Each recursive call pushes a new stack frame; without a correct terminating condition, this continues until the engine throws a `RangeError: Maximum call stack size exceeded`, protecting the process from consuming unbounded stack memory (see [call-stack-and-memory-heap.md](./call-stack-and-memory-heap.md)).

A **memory leak**, in a garbage-collected language like JavaScript, doesn't mean memory is literally lost or corrupted the way it can be in manually-memory-managed languages — it means an object remains *unintentionally reachable* (via some live reference chain) long after it's actually needed, preventing the garbage collector from ever reclaiming it (see [garbage-collection.md](./garbage-collection.md)). Over time, accumulating enough unintentionally-retained objects causes memory usage to grow continuously, eventually degrading performance or crashing the process/tab.

The classic sources of memory leaks in JavaScript: **accidental global variables** (assigning to an undeclared identifier in non-strict mode attaches it to the global object, keeping it alive for the entire program's lifetime — see [global-variables.md](./global-variables.md)); **forgotten event listeners/timers** (a `setInterval` or event listener that references large data and is never cleared/removed keeps that data reachable indefinitely); **closures capturing more than intended** (a long-lived closure holding a reference to a large object it no longer actually needs); and **detached DOM references** (JavaScript code holding a reference to a DOM node that's been removed from the document, preventing that node's associated memory from being freed even though it's no longer visually part of the page).

## Examples

```js
// Stack overflow: recursion with no reachable base case
function countDown(n) {
  console.log(n);
  return countDown(n - 1); // never actually stops — no base case check
}
try {
  countDown(5);
} catch (e) {
  console.log(e.message); // "Maximum call stack size exceeded"
}

// The fix: a proper, reachable base case
function countDownFixed(n) {
  if (n <= 0) return; // base case
  console.log(n);
  return countDownFixed(n - 1);
}
countDownFixed(3); // 3 2 1 — terminates correctly
```

```js
// Memory leak via a forgotten interval holding a reference to large data
function startLeakyProcess() {
  const bigData = new Array(1_000_000).fill('leaked');
  setInterval(() => {
    console.log(bigData.length); // this interval NEVER gets cleared — bigData stays reachable forever
  }, 5000);
}
// Fix: keep a reference to the interval and clear it when it's no longer needed
function startFixedProcess() {
  const bigData = new Array(1_000_000).fill('ok');
  const intervalId = setInterval(() => console.log(bigData.length), 5000);
  // later, when done: clearInterval(intervalId);
  return intervalId;
}
```

```js
// Memory leak via accidental global variable (non-strict mode)
function leaky() {
  accumulatedResults = []; // missing let/const/var — creates an implicit global
  accumulatedResults.push(new Array(100000).fill('x'));
}
leaky(); leaky(); leaky(); // each call grows a GLOBAL array that's never released
console.log(typeof accumulatedResults, accumulatedResults.length); // "object" 3
// Fix: always declare variables explicitly, and use strict mode to catch this as an error
```

## Common Pitfalls / Gotchas

- Writing recursive functions without carefully verifying the base case is actually reachable for all valid inputs — an off-by-one error in the base-case condition is a common, subtle cause of stack overflows.
- Setting up `setInterval`/event listeners without ever calling the corresponding `clearInterval`/`removeEventListener` when they're no longer needed — one of the single most common real-world sources of JavaScript memory leaks, especially in long-running single-page applications.
- Storing DOM node references in a long-lived JavaScript data structure (a cache, a global array) after those nodes have been removed from the document — the nodes remain reachable (and thus un-collectible) purely because of that stray reference.
- Assuming "memory leak" bugs will show up quickly in testing — they often only become visible after the application has been running for an extended period (accumulating enough leaked references), making them notoriously hard to catch without dedicated memory-profiling tools.

## Interview Questions & Answers

**Q: What causes a stack overflow, and how do you fix it?**
A: Recursion (directly or indirectly, via mutual recursion) that keeps pushing new stack frames without ever reaching a terminating base case, exhausting the call stack's fixed size limit and throwing a `RangeError`. The fix is ensuring the function has a correct, genuinely reachable base case for every valid input, or converting deep recursion into an iterative approach if recursion depth could legitimately exceed the stack's practical limits.

**Q: What does "memory leak" mean in a garbage-collected language like JavaScript, given the GC is automatic?**
A: It means an object remains unintentionally *reachable* through some live reference chain (a forgotten timer, an uncleaned event listener, an overly-retentive closure, an accidental global) long after the program actually needs it — the garbage collector correctly refuses to collect anything still reachable, so the "leak" is really a reachability bug, not a failure of the GC itself.

**Q: Name three common real-world causes of memory leaks in browser-based JavaScript applications.**
A: (1) Event listeners or `setInterval`/`setTimeout` timers that are never removed/cleared, especially ones referencing large data or DOM elements. (2) Accidental global variables (via missing declaration keywords in non-strict mode) that persist for the entire page's lifetime. (3) Detached DOM node references — JavaScript code holding onto a reference to a DOM element after it's been removed from the document, preventing its memory (and anything it references) from being reclaimed.

## Related Topics
- [call-stack-and-memory-heap.md](./call-stack-and-memory-heap.md)
- [garbage-collection.md](./garbage-collection.md)
- [global-variables.md](./global-variables.md)
- [closures.md](./closures.md)
- [weak-set-weak-map.md](./weak-set-weak-map.md)
