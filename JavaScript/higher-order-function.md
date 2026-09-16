# Higher-Order Functions

A higher-order function is a function that either accepts one or more functions as arguments, returns a function as its result, or both. This is possible because JavaScript treats functions as first-class values — they can be passed around and manipulated just like any other data (see [functions.md](./functions.md)). Higher-order functions are the foundation of functional-programming style in JavaScript and underpin most of the standard array methods (`map`, `filter`, `reduce`, `forEach`, `sort` with a comparator).

Higher-order functions enable powerful patterns: **abstraction of control flow** (e.g., `array.map(fn)` abstracts away manual loop iteration, letting you focus purely on the transformation logic), **function factories** (a function that returns a new, customized function, like `makeMultiplier(3)` returning a function that always multiplies by 3), **decorators/wrappers** (a function that takes another function and returns an enhanced version of it — adding logging, memoization, or timing without modifying the original), and **composition** (combining several small, single-purpose functions into a larger pipeline — see [compose.md](./compose.md) and [pipe.md](./pipe.md)).

Callbacks (see [callbacks.md](./callbacks.md)) are simply the most common everyday use of higher-order functions — any time you pass a function as an argument for another function to invoke later, you're using this pattern, whether it's synchronous (`array.forEach(cb)`) or asynchronous (`setTimeout(cb, 1000)`, `promise.then(cb)`).

## Examples

```js
// A function that ACCEPTS a function — classic array method usage
const numbers = [1, 2, 3, 4, 5];
const evens = numbers.filter(n => n % 2 === 0); // filter takes a function argument
console.log(evens); // [2, 4]
```

```js
// A function that RETURNS a function — a function factory
function makeMultiplier(factor) {
  return function (n) {
    return n * factor;
  };
}
const double = makeMultiplier(2);
const triple = makeMultiplier(3);
console.log(double(5), triple(5)); // 10 15
```

```js
// A decorator: a higher-order function wrapping another function to add behavior
function withLogging(fn) {
  return function (...args) {
    console.log(`Calling ${fn.name} with`, args);
    const result = fn(...args);
    console.log(`Result:`, result);
    return result;
  };
}
function add(a, b) { return a + b; }
const loggedAdd = withLogging(add);
loggedAdd(2, 3); // logs the call, then the result, then returns 5
```

## Common Pitfalls / Gotchas

- Forgetting that higher-order array methods like `map`/`filter` are less efficient than a single manual loop when chaining several of them, since each call produces an intermediate array — usually a non-issue, but relevant for very large datasets/hot paths.
- Losing `this` context when passing a method as a callback to a higher-order function without binding it (`array.forEach(obj.method)` loses `obj` as `this` inside `method`) — see [this-keyword.md](./this-keyword.md).
- Assuming every function that merely "uses" a callback internally (like `array.forEach`) also *returns* a function — higher-order simply means accepting and/or returning a function, not both are required simultaneously.
- Overusing decorators/wrapping patterns to the point where debugging stack traces become hard to follow, since the actual error might occur several layers of wrapped functions deep.

## Interview Questions & Answers

**Q: What makes a function a "higher-order function"?**
A: It either takes one or more functions as arguments, returns a function, or both. This is possible in JavaScript because functions are first-class values, meaning they can be passed around and returned exactly like any other value (numbers, strings, objects).

**Q: Give an example of a higher-order function you use regularly, and explain what makes it "higher-order."**
A: `Array.prototype.map(fn)` — it's higher-order because it accepts a function (`fn`) as an argument and invokes it internally for each element, abstracting away the manual loop mechanics and letting the caller focus purely on the per-element transformation.

**Q: How would you write a higher-order function that memoizes (caches) the result of any single-argument function?**
```js
function memoize(fn) {
  const cache = new Map();
  return function (arg) {
    if (cache.has(arg)) return cache.get(arg);
    const result = fn(arg);
    cache.set(arg, result);
    return result;
  };
}
```
A: `memoize` is higher-order on both ends: it accepts a function (`fn`) and returns a new function that wraps it with caching logic, transparent to the caller.

**Q: What's the relationship between higher-order functions and closures?**
A: They're complementary: a higher-order function that *returns* a new function almost always relies on a closure to give that returned function access to variables from the outer (factory) function's scope — e.g., `makeMultiplier(factor)` needs a closure over `factor` for the returned function to remember it.

## Related Topics
- [functions.md](./functions.md)
- [closures.md](./closures.md)
- [callbacks.md](./callbacks.md)
- [compose.md](./compose.md)
- [pipe.md](./pipe.md)
- [functional-programing.md](./functional-programing.md)
- [array-methods.md](./array-methods.md)
