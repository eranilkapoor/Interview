# Function.prototype.call()

`.call()` is a method available on every function (inherited from `Function.prototype`) that invokes the function **immediately**, letting you explicitly specify what `this` should be inside it, plus any arguments to pass, listed individually: `fn.call(thisArg, arg1, arg2, ...)`. It's one of the three explicit-binding tools JavaScript provides for controlling `this` (alongside `.apply()` and `.bind()`), and is especially useful for "borrowing" a method defined on one object/prototype and running it against a different object.

The key distinction between `.call()` and `.apply()` is purely how arguments are passed: `.call()` takes them as a comma-separated list (`fn.call(ctx, a, b, c)`), while `.apply()` takes them as a single array (`fn.apply(ctx, [a, b, c])`) — otherwise they behave identically. Both differ from `.bind()` in that `.call()`/`.apply()` invoke the function right away, whereas `.bind()` returns a *new function* with the binding baked in, to be called later.

A classic use case for `.call()` is invoking an array-like object's method that it doesn't natively have — e.g., borrowing `Array.prototype.slice.call(arrayLikeObject)` to convert an array-like (like the old `arguments` object, or a DOM `NodeList`) into a real array, a common pre-ES2015 idiom now mostly superseded by `Array.from()` and the spread operator.

## Examples

```js
// Explicitly setting `this` via call()
const person = { name: 'Anil Kapoor', display() { console.log(this.name); } };
person.display();           // "Anil Kapoor" — this === person
person.display.call();      // undefined (strict) / global object's name (non-strict)

const other = { name: 'Sunita Kapoor' };
person.display.call(other); // "Sunita Kapoor" — this === other
```

```js
// Passing arguments individually with call()
function introduce(greeting, punctuation) {
  console.log(`${greeting}, I'm ${this.name}${punctuation}`);
}
const user = { name: 'Lakshya' };
introduce.call(user, 'Hi', '!'); // "Hi, I'm Lakshya!"
```

```js
// Method borrowing: using Array.prototype methods on an array-like object
function sumArgs() {
  return Array.prototype.slice.call(arguments).reduce((a, b) => a + b, 0);
}
console.log(sumArgs(1, 2, 3)); // 6 — `arguments` isn't a real array, but slice.call works on it
```

## Common Pitfalls / Gotchas

- Confusing `.call()`'s argument style with `.apply()`'s — `.call()` takes a comma-separated argument list; passing an array by mistake (`fn.call(ctx, [a, b])`) sends the whole array as a single first argument, not spread as separate ones.
- Calling `.call()` with `undefined`/`null` as the context in non-strict mode and being surprised `this` becomes the global object instead — in strict mode (default in modules/classes), it correctly stays `undefined`/`null`.
- Assuming `.call()` permanently changes the function's `this` — it doesn't; it only affects that one specific invocation, unlike `.bind()`, which creates a new function with a permanently fixed `this`.
- Using `.call()` inside performance-critical hot paths at scale without benchmarking — historically `.call()`/`.apply()` carried a small performance overhead versus direct invocation, though modern engines have optimized this considerably.

## Interview Questions & Answers

**Q: What does `Function.prototype.call()` do, and how do you pass arguments with it?**
A: It invokes the function immediately with an explicitly specified `this` value, passing any additional arguments individually, comma-separated: `fn.call(thisArg, arg1, arg2)`.

**Q: What's the difference between `.call()` and `.apply()`?**
A: They behave identically except for how arguments are supplied: `.call()` takes them as a comma-separated list, `.apply()` takes them as a single array (or array-like). Everything else — immediate invocation, explicit `this` binding — is the same.

**Q: How would you use `.call()` to "borrow" an array method for an array-like object like `arguments`?**
A: `Array.prototype.slice.call(arguments)` invokes `Array.prototype.slice` with `this` set to the `arguments` object, letting it operate on it as if it were an array and returning a genuine array copy — despite `arguments` itself lacking the `.slice` method natively. (Modern code typically prefers `Array.from(arguments)` or `[...arguments]`/rest parameters instead.)

**Q: If you call `fn.call()` with no arguments at all, what is `this` inside `fn`?**
A: In strict mode, `this` is `undefined`. In non-strict (sloppy) mode, `this` defaults to the global object, since omitting or passing `undefined`/`null` as the context falls back to the global object under legacy semantics.

## Related Topics
- [this-keyword.md](./this-keyword.md)
- [apply-function.md](./apply-function.md)
- [bind-function.md](./bind-function.md)
- [function-invocation.md](./function-invocation.md)
