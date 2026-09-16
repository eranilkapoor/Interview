# Garbage Collection

Garbage collection (GC) is the automatic process by which the JavaScript engine reclaims memory that's no longer reachable/usable by the running program, so developers don't need to manually allocate and free memory (unlike languages like C/C++). The engine periodically identifies objects that can no longer be accessed by any live reference chain from the "roots" (global object, currently executing functions' local variables, etc.) and frees the memory they occupy, making it available for reuse.

Modern JavaScript engines use a **mark-and-sweep** algorithm (replacing an older, more naive "reference-counting" approach that couldn't correctly handle circular references — two objects referencing each other but otherwise unreachable would leak forever under pure reference counting). Mark-and-sweep works by starting from a set of root references, traversing (marking) every object reachable from those roots, and then sweeping away (freeing) anything left unmarked — meaning genuinely unreachable objects, even if they reference each other in a cycle, are correctly identified and collected, since reachability (not internal reference counts) is what determines eligibility.

Garbage collection is **automatic and non-deterministic** — you cannot force it to run at a specific time (there's no reliable manual "free this now" in standard JavaScript), and you generally shouldn't try to micromanage it. What you *can* control is avoiding patterns that unintentionally keep objects reachable longer than intended — "memory leaks" in JS specifically mean *unintentionally retained reachability*, not literal memory corruption; see [stack-overflow-memory-leaks.md](./stack-overflow-memory-leaks.md) for the common patterns that cause this, and [weak-set-weak-map.md](./weak-set-weak-map.md) for a language feature specifically designed to avoid it in certain cases.

## Examples

```js
// Once nothing references an object, it becomes eligible for garbage collection
let user = { name: 'Anil' }; // reachable — referenced by `user`
user = null;                   // the object is now unreachable (assuming nothing else refs it)
// The engine will eventually reclaim its memory — you can't observe or force exactly when
```

```js
// Why mark-and-sweep handles circular references correctly (reference counting alone could not)
function createCycle() {
  const a = {};
  const b = {};
  a.ref = b; // a references b
  b.ref = a; // b references a — a cycle
  return 'done';
} // once createCycle() returns, neither `a` nor `b` is reachable from any root anymore
createCycle();
// Even though a and b still reference EACH OTHER, mark-and-sweep correctly identifies
// them as unreachable from the roots and collects them; naive reference counting
// would have seen each object's count as 1 (from the other) and never freed them.
```

```js
// A closure keeps its outer scope's variables reachable for as long as the closure exists
function makeHolder() {
  let bigData = new Array(1_000_000).fill('x'); // large allocation
  return function () {
    return bigData.length; // closure keeps `bigData` reachable indefinitely
  };
}
const getLength = makeHolder();
console.log(getLength()); // 1000000 — bigData still alive because getLength references it
// Setting getLength = null would make bigData unreachable and eligible for GC
```

## Common Pitfalls / Gotchas

- Believing you can force garbage collection on demand in standard JavaScript — there's no reliable, standardized manual GC trigger (Node.js exposes `--expose-gc` for debugging/testing purposes only, not for production code reliance).
- Assuming setting a variable to `null` immediately frees its memory — it only removes *that specific reference*; if the object is still reachable via some other reference, it remains alive regardless.
- Forgetting long-lived closures (event listeners, caches, timers) can keep large outer-scope variables reachable far longer than intended, effectively causing a memory leak even though nothing is technically "broken" — the reachability is simply unintentional.
- Confusing "memory leak" in JavaScript with the C/C++ sense (forgetting to `free()` allocated memory) — in JS, a "leak" specifically means an object remains unintentionally *reachable*, preventing the (fully automatic) garbage collector from ever being able to reclaim it.

## Interview Questions & Answers

**Q: How does mark-and-sweep garbage collection work, and what problem did it solve compared to reference counting?**
A: Starting from a set of root references (global scope, currently active function call stacks), the engine traverses and "marks" every object reachable from those roots, then "sweeps" (frees) everything left unmarked. This correctly handles circular references — two objects referencing only each other, but unreachable from any root, are still correctly identified as collectible — which naive reference counting (tracking how many references point to an object) cannot do, since each object in the cycle would show a non-zero count from the other, never reaching zero.

**Q: Can you manually trigger garbage collection in JavaScript?**
A: Not reliably or portably in standard JavaScript — there's no guaranteed manual "free this now" API. Some environments expose debugging-only flags (like Node's `--expose-gc`), but production code should never depend on controlling GC timing directly; instead, focus on not unintentionally keeping objects reachable longer than necessary.

**Q: How can a closure cause a memory leak, even though closures are a normal, intended language feature?**
A: If a closure captures (references) a large object from its outer scope, that object remains reachable — and therefore un-collectible — for as long as the closure itself is reachable. If that closure is stored somewhere long-lived (a global event listener, a cache, a timer callback) longer than actually needed, the captured object is retained in memory far longer than intended, which is the practical meaning of a "leak" in a garbage-collected language.

## Related Topics
- [stack-overflow-memory-leaks.md](./stack-overflow-memory-leaks.md)
- [closures.md](./closures.md)
- [weak-set-weak-map.md](./weak-set-weak-map.md)
- [call-stack-and-memory-heap.md](./call-stack-and-memory-heap.md)
