# Function vs Object

In JavaScript, every function *is* an object — specifically, a special kind of object that is **callable** (has an internal `[[Call]]` method, and, for non-arrow functions, an internal `[[Construct]]` method enabling `new`). `typeof` distinguishes them for convenience (`typeof functionValue === 'function'`, `typeof plainObject === 'object'`), but under the hood, a function object still has a prototype, can hold its own properties, and participates in the prototype chain exactly like any other object — the "function" categorization is really about *behavior* (callability), layered on top of the same underlying object system.

This means you can attach arbitrary properties to a function, just as you would to a plain object (`fn.customProp = 'value'`), and this is exactly how features like a function's `.name`, `.length`, and `.prototype` work — they're just properties living on the function object, some set automatically by the engine, others settable by you. Historically, this is also how "static" state was attached to constructor functions before `class` syntax introduced dedicated `static` members.

The practical distinction that matters for everyday code isn't "is this technically an object" (everything non-primitive is) but rather "can I call this with `()`" — a plain object literal (`{}`) cannot be invoked, while a function (even one with extra custom properties attached) can. Recognizing that a function is simultaneously a value, a callable object, and (for non-arrow functions) a potential constructor is a useful mental model for a lot of JS's more advanced behavior (higher-order functions, `.bind()`, prototype-based inheritance).

## Examples

```js
// A function is an object: it can hold its own properties
function greet() { console.log('hi'); }
greet.usedCount = 0;
greet.usedCount++;
console.log(typeof greet);      // "function"
console.log(greet.usedCount);   // 1
console.log(greet instanceof Object); // true — functions ARE objects
```

```js
// Objects cannot be called; functions can
const plainObject = { run: 'not a function itself' };
// plainObject(); // TypeError: plainObject is not a function

function callableThing() { return 'called!'; }
console.log(callableThing()); // "called!" — has an internal [[Call]] behavior objects lack
```

```js
// Both share the same prototype-chain machinery under the hood
function Foo() {}
const fooInstance = new Foo();
console.log(Object.getPrototypeOf(fooInstance) === Foo.prototype); // true
console.log(Object.getPrototypeOf(Foo) === Function.prototype);    // true — Foo itself is an object too
console.log(Object.getPrototypeOf(Function.prototype) === Object.prototype); // true — chain bottoms out at Object
```

## Common Pitfalls / Gotchas

- Assuming `typeof` returning `"function"` means something fundamentally different from `"object"` at the engine level — it's the same underlying object system; `"function"` is just `typeof`'s special-cased label for anything callable.
- Forgetting that attaching properties directly to a function (rather than its `.prototype`) creates a property on the function *itself*, shared across all uses of that function reference, not per-instance state (that's what `.prototype` or constructor-assigned `this.prop` is for).
- Believing arrow functions are "less of an object" than regular functions — they're still objects (with prototype-chain properties like `.call`/`.apply`.bind`), they simply lack a `.prototype` property and `[[Construct]]` behavior (can't be used with `new`).
- Using `typeof` to distinguish arrays/objects/functions cleanly — it correctly separates `"function"` out, but everything else non-callable (arrays, plain objects, dates, etc.) is lumped together as `"object"`.

## Interview Questions & Answers

**Q: Is a function an object in JavaScript?**
A: Yes — every function is a specialized kind of object: one with an internal `[[Call]]` capability (making it invokable), and, for non-arrow functions, `[[Construct]]` (making it usable with `new`). It still has a prototype chain, can carry its own properties, and is `instanceof Object`.

**Q: What practically distinguishes a function from a plain object, if both are objects under the hood?**
A: Callability. A function can be invoked directly with `()`; a plain object cannot (attempting to call one throws `TypeError: ... is not a function`). Functions also have special properties like `.length`, `.name`, and (for non-arrow functions) `.prototype`, which plain objects don't have by default.

**Q: Why does `typeof` have a distinct `"function"` category instead of just reporting `"object"` for everything non-primitive?**
A: Because callability is such a fundamental, frequently-checked behavioral distinction (e.g., checking whether a value can be invoked as a callback) that the spec special-cases it in `typeof` for convenience, even though functions remain objects in every other structural sense (prototype chain, property storage, `instanceof Object`).

## Related Topics
- [functions.md](./functions.md)
- [objects.md](./objects.md)
- [prototype.md](./prototype.md)
- [types-in-javascript.md](./types-in-javascript.md)
