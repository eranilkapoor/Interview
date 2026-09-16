# Function.prototype.apply()

`.apply()` is a method on every function (via `Function.prototype`) that invokes the function immediately with an explicitly specified `this` value, exactly like `.call()` — the only difference is how arguments are supplied: `.apply()` takes them as a **single array (or array-like object)**, `fn.apply(thisArg, [arg1, arg2, arg3])`, rather than as a comma-separated list. This makes `.apply()` the natural choice whenever your arguments already exist as an array and you don't want to manually spread or list them out.

Before the spread operator (`...`) existed, `.apply()` was the standard way to call a function with an array's contents as individual arguments — most famously `Math.max.apply(null, numbersArray)`, since `Math.max` expects individual numeric arguments, not an array. This pattern is largely superseded in modern code by `Math.max(...numbersArray)`, but understanding `.apply()` remains an important interview fundamental, and it still appears in older codebases and certain library internals.

Note that when the first argument to `.apply()` (the `this` value) is irrelevant to the function being called — as with `Math.max`, a static utility that doesn't reference `this` — it's conventional to pass `null` (or `undefined`) explicitly, since the function doesn't use its context at all.

## Examples

```js
// apply() vs call(): same explicit-this behavior, different argument format
const person = { name: 'Anil Kapoor', display() { console.log(this.name); } };
const other = { name: 'Sunita Kapoor' };
person.display.apply(other); // "Sunita Kapoor" — no extra arguments needed here
```

```js
// The classic pre-spread use case: spreading an array as individual arguments
const numbers = [1, 5, 3, 9, 2];
console.log(Math.max.apply(null, numbers)); // 9 — `this` irrelevant to Math.max, so null
console.log(Math.min.apply(null, numbers)); // 1

// Modern equivalent using spread:
console.log(Math.max(...numbers)); // 9
```

```js
// apply() with an array of arguments for a custom function
function introduce(greeting, name) {
  console.log(`${greeting}, ${name}! (this.owner = ${this.owner})`);
}
const context = { owner: 'system' };
introduce.apply(context, ['Hello', 'Anil']); // "Hello, Anil! (this.owner = system)"
```

## Common Pitfalls / Gotchas

- Passing individual arguments to `.apply()` instead of an array — `.apply()` requires the second parameter to be an array (or array-like); passing loose comma-separated values is what `.call()` is for, not `.apply()`.
- Forgetting `.apply()` accepts array-*like* objects too (anything with a `.length` and indexed properties, like `arguments`), not strictly `Array` instances.
- Continuing to reach for `.apply()` for "spread an array into arguments" in modern code, when the spread operator (`fn(...arr)`) is now simpler and equally performant — `.apply()` is mostly relevant now for legacy code or when you also need to set a custom `this`.
- Using `.apply(null, args)` and forgetting strict mode keeps `this` as `null` inside the function, while non-strict mode would silently substitute the global object — relevant if the called function actually reads `this` for something.

## Interview Questions & Answers

**Q: What's the difference between `.call()` and `.apply()`?**
A: Both invoke a function immediately with an explicit `this` value; they differ only in how additional arguments are passed — `.call()` takes them individually (comma-separated), `.apply()` takes them as a single array or array-like object.

**Q: Before the spread operator existed, how would you call `Math.max` with the contents of an array?**
A: `Math.max.apply(null, arrayOfNumbers)` — `.apply()` spreads the array's elements into individual arguments for `Math.max`, which doesn't accept a single array argument directly. `null` is passed as the `this` value since `Math.max` doesn't use `this`.

**Q: Can `.apply()` be used with array-like objects that aren't true arrays?**
A: Yes — it accepts anything with a numeric `.length` property and indexed elements, such as the `arguments` object or a DOM `NodeList`, not strictly `Array` instances.

## Related Topics
- [call-function.md](./call-function.md)
- [bind-function.md](./bind-function.md)
- [this-keyword.md](./this-keyword.md)
- [spread-operator.md](./spread-operator.md)
- [rest-parameter.md](./rest-parameter.md)
