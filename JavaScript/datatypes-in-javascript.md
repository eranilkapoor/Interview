# Data Types in JavaScript

JavaScript values fall into two broad categories: **primitive types** and **object (reference) types**. There are seven primitive types as of modern ECMAScript: `string`, `number`, `boolean`, `undefined`, `null`, `symbol` (ES2015), and `bigint` (ES2020). Everything else — plain objects, arrays, functions, dates, maps, sets, regular expressions — is an object, a reference type.

The distinction matters most for *assignment and comparison semantics*. Primitives are compared and copied **by value**: assigning a primitive to a new variable copies the value, and two primitives with the same content are `===` equal. Objects are compared and copied **by reference**: assigning an object to a new variable copies a reference to the same underlying object, and two distinct objects with identical contents are *not* `===` equal (they're different objects in memory) — see [pass-by-value.md](./pass-by-value.md) and [pass-by-reference.md](./pass-by-reference.md).

JavaScript is dynamically typed: a variable itself has no fixed type — it's just a binding that can point to a value of any type at any point, and the type is determined at runtime by whatever value currently occupies it. The `typeof` operator inspects a value's type at runtime, though it has a few historical quirks (notably `typeof null === 'object'`, a long-standing bug preserved for backward compatibility).

## Examples

```js
// The seven primitive types
console.log(typeof 'hello');     // "string"
console.log(typeof 42);          // "number"
console.log(typeof true);        // "boolean"
console.log(typeof undefined);   // "undefined"
console.log(typeof null);        // "object" (historical quirk!)
console.log(typeof Symbol());    // "symbol"
console.log(typeof 10n);         // "bigint"
```

```js
// Objects are reference types — everything non-primitive
console.log(typeof {});          // "object"
console.log(typeof []);          // "object" (arrays are objects)
console.log(typeof function(){});// "function" (a callable object)
console.log(typeof new Date());  // "object"
```

```js
// Value vs reference semantics
let a = 10;
let b = a; // copies the value
b = 20;
console.log(a); // 10 — unaffected

let obj1 = { x: 10 };
let obj2 = obj1; // copies the reference
obj2.x = 20;
console.log(obj1.x); // 20 — same underlying object
```

## Common Pitfalls / Gotchas

- Using `typeof null` and expecting `"null"` — it returns `"object"` due to a bug baked into the original 1995 implementation that can never be fixed without breaking the web.
- Using `typeof` to distinguish arrays from plain objects — both report `"object"`; use `Array.isArray()` instead.
- Assuming primitive wrapper objects (`new String('x')`, `new Number(5)`) behave like their primitive counterparts — they are objects (`typeof` returns `"object"`) and can produce surprising results in comparisons (`new String('x') === 'x'` is `false`).
- Forgetting `NaN` is of type `"number"` and that `NaN !== NaN` — use `Number.isNaN()` to check for it reliably.

## Interview Questions & Answers

**Q: How many primitive types does JavaScript have, and what are they?**
A: Seven: `string`, `number`, `boolean`, `undefined`, `null`, `symbol`, and `bigint`. Everything else (objects, arrays, functions, dates, etc.) is a reference type built on top of `object`.

**Q: Why does `typeof null` return `"object"`?**
A: It's a legacy bug from JavaScript's original implementation in 1995: values were internally tagged with a type, and `null`'s tag happened to be the same as objects'. It's kept for backward compatibility — fixing it would break countless existing scripts that rely on (or work around) this behavior.

**Q: How do you reliably check if a value is an array?**
A: `Array.isArray(value)`, not `typeof value === 'array'` (which doesn't exist) and not `value instanceof Array` (which fails across different execution contexts/iframes/realms because each realm has its own `Array` constructor).

**Q: What's the practical difference between primitive and reference types when passed to a function?**
A: Primitives are passed by value — the function gets a copy, and reassigning the parameter inside the function doesn't affect the caller's variable. Objects are passed by reference (the reference itself is copied) — mutating the object's properties inside the function is visible to the caller, but reassigning the parameter to a *new* object is not.

## Related Topics
- [primitive-types.md](./primitive-types.md)
- [types-in-javascript.md](./types-in-javascript.md)
- [type-coercion.md](./type-coercion.md)
- [pass-by-value.md](./pass-by-value.md)
- [pass-by-reference.md](./pass-by-reference.md)
