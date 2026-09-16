# Types in JavaScript

"Types" in JavaScript is a broader umbrella than just the seven primitive data types — it includes how the language classifies and treats values structurally (primitive vs object), how it converts between them (type coercion), and how loosely or strictly it enforces type expectations (dynamic typing, with optional static-typing overlays like TypeScript or Flow). Understanding "types" holistically means understanding the interplay of `typeof`, `instanceof`, coercion rules, and the primitive/object split all at once.

At the language level, every value belongs to exactly one of the primitive types (`string`, `number`, `boolean`, `undefined`, `null`, `symbol`, `bigint`) or is an object. But "type" in a broader sense also covers *behavioral* categories: is this value truthy or falsy? Is it iterable? Is it callable (a function)? Is it thenable (has a `.then()` method, making it promise-like)? JavaScript code frequently branches on these behavioral categories rather than strict class identity, which is part of what makes the language flexible but also prone to subtle bugs when assumptions about a value's shape turn out wrong at runtime.

Because JavaScript has no compile-time type checker built in, catching type-related bugs is either a runtime concern (defensive checks, unit tests) or delegated to a superset language like TypeScript, which adds a static type system that is erased before the code actually runs. This is an important interview distinction: TypeScript's types provide compile-time safety and tooling but have *zero* runtime effect — you can't "check a TypeScript type" at runtime because it no longer exists after transpilation.

## Examples

```js
// Behavioral "type" checks beyond typeof
function describe(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'function') return 'function';
  if (typeof value === 'object') return 'object';
  return typeof value;
}
console.log(describe([1,2,3]));   // "array"
console.log(describe(null));      // "null"
console.log(describe(() => {}));  // "function"
```

```js
// instanceof checks the prototype chain, not a "type" per se
class Animal {}
class Dog extends Animal {}
const d = new Dog();
console.log(d instanceof Dog);    // true
console.log(d instanceof Animal); // true — Dog's prototype chain includes Animal
console.log(d instanceof Object); // true — everything (but null) inherits from Object
```

```js
// "Thenable" duck-typing — Promise.resolve() treats anything with .then() as promise-like
const thenable = { then(resolve) { resolve('done'); } };
Promise.resolve(thenable).then(console.log); // "done"
```

## Common Pitfalls / Gotchas

- Using `typeof` for anything beyond primitives + function detection — for arrays, dates, and custom classes, `typeof` just says `"object"`, which is rarely useful on its own.
- Relying on `instanceof` across different realms (iframes, worker contexts, vm modules in Node) — each realm has its own global constructors, so an array created in one iframe fails `instanceof Array` in another.
- Believing TypeScript types provide runtime safety — they're fully erased at compile time; a bad value from an API response can still violate a TypeScript type at runtime with no error thrown.
- Confusing "falsy" with `false` — `0`, `''`, `null`, `undefined`, `NaN`, and `false` are all falsy, which is a much larger set than people initially assume, especially when checking for "empty" values.

## Interview Questions & Answers

**Q: What tools does JavaScript give you to determine a value's type at runtime?**
A: `typeof` (for primitives and functions), `instanceof` (checks the prototype chain for objects), `Array.isArray()` (specifically for arrays), and duck-typing (checking for the presence of expected methods/properties, e.g., checking for `.then` to treat something as promise-like).

**Q: Does TypeScript change JavaScript's runtime type behavior?**
A: No. TypeScript's type system exists purely at compile/build time for developer tooling and safety; it's stripped away entirely during transpilation, and the emitted JavaScript has exactly the same dynamic, runtime type behavior as hand-written JS.

**Q: What does "falsy" mean and which values are falsy in JavaScript?**
A: A falsy value is one that coerces to `false` in a boolean context (like an `if` condition). The falsy values are: `false`, `0`, `-0`, `0n` (BigInt zero), `''` (empty string), `null`, `undefined`, and `NaN`. Everything else, including all objects and arrays (even empty ones, `[]` and `{}`), is truthy.

## Related Topics
- [datatypes-in-javascript.md](./datatypes-in-javascript.md)
- [primitive-types.md](./primitive-types.md)
- [type-coercion.md](./type-coercion.md)
- [dynamic-typed.md](./dynamic-typed.md)
- [static-typed.md](./static-typed.md)
