# Writing Optimized JavaScript Code

Writing performant JavaScript means understanding which patterns help (or actively hinder) the engine's ability to execute code quickly — particularly its JIT compiler's ability to optimize "hot" (frequently executed) code paths into fast machine code (see [jit-compiler.md](./jit-compiler.md)). Several long-standing, well-documented JavaScript features are specifically known to be difficult or impossible for engines to optimize well, and are generally recommended against in performance-sensitive code: `eval()` (executes arbitrary string code, forcing the engine to abandon many optimizations since it can't statically analyze what that code will do), `with` (a deprecated statement that dynamically alters the scope chain, making variable lookups ambiguous and un-optimizable — disallowed entirely in strict mode), `delete` (removing a property from an object can force the engine to de-optimize that object's internal representation, since V8 and similar engines rely on consistent object "shapes" for fast property access), `for...in` (iterating object properties, including inherited ones, is generally slower than more targeted alternatives like `Object.keys()` combined with a `for` loop, or `for...of` for arrays), and excessive reliance on the `arguments` object (which has different, harder-to-optimize semantics than modern rest parameters in some engines/scenarios).

Beyond avoiding these specific footguns, broader optimization principles apply: keeping object "shapes" consistent (creating objects with the same set of properties in the same order lets the engine use faster, monomorphic property-access optimizations, rather than falling back to slower, polymorphic lookups); avoiding unnecessary object/array allocation inside hot loops (each allocation has a real cost, and excessive short-lived allocation increases garbage-collection pressure); and using appropriate data structures (`Map`/`Set` for genuinely key/uniqueness-oriented needs, rather than repeatedly scanning arrays with `indexOf`/`includes` in a hot loop).

It's worth balancing this advice with pragmatism: premature micro-optimization at the expense of code clarity is a well-known anti-pattern. Most real-world JavaScript performance problems come from algorithmic issues (unnecessary O(n²) logic, redundant work, layout thrashing in the DOM) rather than from missing out on JIT-level micro-optimizations — profile first, then optimize the parts that actually matter.

## Examples

```js
// Avoid `delete` in hot code paths — it can de-optimize an object's internal shape
const point = { x: 1, y: 2 };
delete point.y; // can force the engine to switch this object to a slower internal representation
// Prefer setting to undefined (if the key must remain) or restructuring data to avoid deletion entirely
point.y = undefined; // often faster than delete, when semantically acceptable
```

```js
// Consistent object "shapes" enable faster property access (monomorphic optimization)
function makePointFast(x, y) { return { x, y }; }       // always created with x, then y — consistent shape
function makePointSlow(x, y) {
  const p = {};
  if (x) p.x = x; // properties added conditionally — inconsistent shapes across calls
  if (y) p.y = y;
  return p;
}
```

```js
// for...in vs Object.keys() + for...of for objects — avoid for...in on arrays entirely
const config = { retries: 3, timeout: 1000 };
for (const key in config) { /* also walks the prototype chain — use hasOwnProperty or Object.keys */ }

for (const key of Object.keys(config)) {
  console.log(key, config[key]); // only own enumerable keys — clearer intent, no prototype-chain surprises
}

// Avoid for...in on arrays specifically — use for...of or standard array methods instead
const arr = [10, 20, 30];
for (const value of arr) { console.log(value); } // idiomatic and fast
```

## Common Pitfalls / Gotchas

- Micro-optimizing code that isn't actually a performance bottleneck — always profile (e.g., with browser DevTools' Performance tab, or Node's `--prof`) before investing effort in engine-level optimizations; algorithmic issues usually dominate real-world performance problems.
- Using `eval()` for convenience (e.g., dynamically evaluating a small expression) without recognizing it disables a wide range of engine optimizations for the surrounding code, not just the evaluated string itself.
- Creating objects with inconsistent property sets/order across many calls in a hot path, unknowingly triggering slower polymorphic property-access code paths in the engine.
- Assuming these guidelines apply uniformly and permanently — JIT engines evolve continuously, and specific micro-optimization advice can become outdated as engines improve; the broader principles (avoid unnecessary allocation, avoid genuinely pathological constructs like `eval`/`with`) remain more durable than precise numbers.

## Interview Questions & Answers

**Q: Why are `eval()` and `with` discouraged for performance-sensitive JavaScript code?**
A: Both introduce dynamic, statically-unanalyzable behavior that forces the JIT compiler to abandon many of its usual optimizations for the surrounding code — `eval()` because it can execute arbitrary code the engine can't inspect ahead of time, and `with` because it dynamically alters the scope chain in a way that makes variable resolution ambiguous at compile time. `with` is disallowed entirely in strict mode for exactly this (and related) reasons.

**Q: What does it mean for an object to have a consistent "shape," and why does that matter for performance?**
A: Modern JS engines (like V8) optimize property access by tracking an object's "shape" (the set and order of its properties) and generating fast, specialized code paths for objects sharing the same shape ("monomorphic" access). Objects created inconsistently (different properties added conditionally, or in different orders across calls) end up with varying shapes, forcing the engine to fall back to slower, more general ("polymorphic" or "megamorphic") property-access code.

**Q: Should you always prioritize micro-optimizations like avoiding `for...in` over code readability?**
A: No — profile first. Most real-world performance issues stem from algorithmic inefficiencies or unnecessary work (not engine-level micro-optimization opportunities), and premature optimization at the cost of clarity is a well-known anti-pattern. That said, some guidance (avoiding genuinely pathological constructs like `eval`, being mindful of object shape consistency in demonstrably hot paths) is cheap to follow and rarely hurts readability meaningfully.

## Related Topics
- [jit-compiler.md](./jit-compiler.md)
- [javascript-engine.md](./javascript-engine.md)
- [garbage-collection.md](./garbage-collection.md)
- [array-methods.md](./array-methods.md)
