# Loops in JavaScript

Loops let a program execute a block of code repeatedly. JavaScript offers several loop constructs, each suited to different scenarios: `for` (classic counter-based iteration), `while` (repeat while a condition holds, checked before each iteration), `do...while` (like `while`, but checked after — guaranteeing at least one execution), `for...in` (iterates over an object's *enumerable property keys*, including inherited ones), and `for...of` (ES2015; iterates over the *values* produced by any iterable — arrays, strings, Maps, Sets, generators).

Choosing the right loop is a common interview and code-review topic. `for...in` is almost never the right tool for arrays because it iterates over all enumerable keys (including inherited ones and, for arrays, potentially added custom properties) as strings, in an order that isn't guaranteed to match numeric index order across all engines. `for...of` is the modern, idiomatic choice for iterating array/iterable *values*, and pairs well with destructuring (`for (const [key, value] of map)`).

Array iteration methods (`forEach`, `map`, `filter`, `reduce`) are often preferred over manual loops in modern code because they're more declarative, but they have real trade-offs: `forEach`/`map`/`filter` cannot be stopped early (no `break`) the way a `for`/`for...of` loop can, and `await` inside a `forEach` callback doesn't pause the outer function the way it does inside a `for...of` loop — a subtle async gotcha worth knowing.

## Examples

```js
// for...in vs for...of — keys vs values, and inherited properties
const arr = ['a', 'b', 'c'];
for (const index in arr) {
  console.log(index); // "0" "1" "2" (strings!)
}
for (const value of arr) {
  console.log(value); // "a" "b" "c"
}
```

```js
// break works in for...of but NOT inside forEach
const nums = [1, 2, 3, 4, 5];
for (const n of nums) {
  if (n === 3) break; // stops the loop entirely
  console.log(n); // 1 2
}

// nums.forEach(n => { if (n === 3) break; }); // SyntaxError: Illegal break statement
```

```js
// await inside for...of pauses correctly; inside forEach it does NOT
async function processSequentially(items) {
  for (const item of items) {
    await delay(100); // this actually waits before the next iteration
    console.log(item);
  }
}

async function processBroken(items) {
  items.forEach(async (item) => {
    await delay(100); // forEach doesn't wait for this — all fire nearly simultaneously
    console.log(item);
  });
}
function delay(ms) { return new Promise(res => setTimeout(res, ms)); }
```

## Common Pitfalls / Gotchas

- Using `for...in` to iterate arrays — it yields string keys (including any custom/inherited enumerable properties), not guaranteed numeric order across all engines/edge cases, and is meant for plain objects, not arrays.
- Expecting `break`/`continue` to work inside `forEach`, `map`, or `filter` callbacks — they don't; use a real loop (`for`, `for...of`, `while`) when early exit is needed.
- Using `async` callbacks with `forEach` and expecting sequential `await` behavior — `forEach` ignores the returned promises entirely and doesn't wait between iterations; use a `for...of` loop for sequential async iteration.
- Declaring the loop variable with `var` in a `for` loop that creates closures (e.g., attaching event handlers in a loop) — all closures share the same binding; use `let` instead.

## Interview Questions & Answers

**Q: What's the difference between `for...in` and `for...of`?**
A: `for...in` iterates over an object's enumerable property *keys* (as strings), including inherited ones from the prototype chain. `for...of` iterates over the *values* produced by any iterable (arrays, strings, Maps, Sets, generators) via the iterator protocol. For arrays, `for...of` is almost always what you want.

**Q: Why can't you use `break` inside `Array.prototype.forEach`?**
A: `forEach` is a higher-order function that invokes your callback for every element; `break`/`continue` are statements tied to actual loop constructs (`for`, `while`, `for...of`), not to function calls. To exit early, use a `for...of` loop, a plain `for` loop, or methods like `some`/`every`/`find` that inherently support short-circuiting.

**Q: Why does `await` inside a `forEach` callback not pause the outer function?**
A: `forEach` calls the callback for each element but ignores whatever the callback returns (including a Promise) and doesn't await it — it just keeps calling the next iteration immediately. Since the callback is `async`, it returns a Promise instantly and `forEach` moves on to the next element without waiting, so all the async operations effectively run concurrently and unordered rather than sequentially.

**Q: When would you choose `do...while` over `while`?**
A: When the loop body must execute at least once regardless of the condition — `do...while` checks the condition *after* the first execution, whereas `while` checks it *before*, potentially skipping the body entirely if the condition starts false.

## Related Topics
- [iterators.md](./iterators.md)
- [generators.md](./generators.md)
- [array-methods.md](./array-methods.md)
- [async-await.md](./async-await.md)
