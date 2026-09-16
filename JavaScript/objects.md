# Objects

An object in JavaScript is a collection of key-value pairs (properties), where each key is a string or `Symbol`, and each value can be any type — including another object or a function. Objects are the language's core reference type (see [datatypes-in-javascript.md](./datatypes-in-javascript.md)) and the foundation almost everything else is built on: arrays, functions, dates, Maps, and Sets are all specialized kinds of objects under the hood.

Objects can be created several ways: object literal syntax (`{ key: value }`, by far the most common), the `new Object()` constructor (rarely used directly), `Object.create(proto)` (creating an object with a specific prototype, see [object-dot-create.md](./object-dot-create.md)), and constructor functions or `class` combined with `new`. Properties can be accessed via dot notation (`obj.key`, when the key is a valid identifier) or bracket notation (`obj['key']` or `obj[dynamicKeyVariable]`, necessary when the key is computed at runtime or isn't a valid identifier, like `obj['first-name']`).

Every object (except those explicitly created with `Object.create(null)`) has an internal link to a **prototype** object, from which it inherits properties/methods it doesn't have directly — this prototype chain is what makes `obj.toString()` work even though you never defined `toString` on `obj` yourself (see [prototype.md](./prototype.md)). The `Object` global provides many essential utility methods: `Object.keys()`/`Object.values()`/`Object.entries()` (extracting an object's own enumerable properties), `Object.assign()` (shallow-merging objects), `Object.freeze()`/`Object.seal()` (restricting mutability), and `Object.create()` (custom prototype linkage).

## Examples

```js
// Creating and accessing objects, dot vs bracket notation
const user = {
  name: 'Anil',
  'favorite-color': 'blue', // not a valid identifier — needs bracket notation to access
  greet() { return `Hi, I'm ${this.name}`; }
};
console.log(user.name);               // "Anil" — dot notation
console.log(user['favorite-color']);  // "blue" — bracket notation required here
const key = 'name';
console.log(user[key]);               // "Anil" — dynamic key via bracket notation
console.log(user.greet());            // "Hi, I'm Anil"
```

```js
// Object utility methods
const config = { theme: 'dark', retries: 3 };
console.log(Object.keys(config));   // ["theme", "retries"]
console.log(Object.values(config)); // ["dark", 3]
console.log(Object.entries(config)); // [["theme","dark"], ["retries",3]]

const merged = Object.assign({}, config, { retries: 5 }); // shallow merge, override
console.log(merged); // { theme: 'dark', retries: 5 }
```

```js
// Every object inherits from a prototype by default
const plain = {};
console.log(plain.toString()); // "[object Object]" — inherited from Object.prototype
console.log(Object.getPrototypeOf(plain) === Object.prototype); // true

const noProto = Object.create(null); // explicitly no prototype
console.log(noProto.toString); // undefined — nothing to inherit from
```

## Common Pitfalls / Gotchas

- Forgetting bracket notation is required for property keys that aren't valid identifiers (containing hyphens, starting with digits, or determined dynamically at runtime).
- Assuming `Object.assign()`/spread produce a deep copy — both are shallow; nested objects remain shared references between source and target.
- Comparing two objects with `===` and expecting content equality — object comparison checks reference identity, not structural equality; `{a:1} === {a:1}` is `false` even though they "look the same."
- Iterating an object's properties with `for...in` without filtering — it also walks up the prototype chain, picking up inherited enumerable properties unless you guard with `Object.prototype.hasOwnProperty.call(obj, key)` or use `Object.keys()` instead, which only returns own properties.

## Interview Questions & Answers

**Q: What are the different ways to create an object in JavaScript?**
A: Object literals (`{}`), the `Object()` constructor, `Object.create(proto)` for explicit prototype control, and constructor functions or `class` combined with `new`. Object literals are the overwhelmingly common choice for plain data objects.

**Q: How do you check if two objects are structurally equal (same keys/values), given `===` only checks reference identity?**
A: There's no built-in deep-equality operator; you'd write/use a deep comparison function (recursively comparing keys and values), use `JSON.stringify()` comparison as a rough (imperfect — key order matters, functions/undefined are dropped) shortcut, or rely on a library like Lodash's `isEqual()`.

**Q: What's the difference between `Object.keys()` and a `for...in` loop over an object?**
A: `Object.keys()` returns only the object's *own* enumerable string-keyed property names, as an array. `for...in` iterates over *all* enumerable properties, including those inherited via the prototype chain, which is why `for...in` on arrays/objects is often guarded with `hasOwnProperty` checks to avoid accidentally processing inherited properties.

## Related Topics
- [objects-in-javascript.md](./objects-in-javascript.md)
- [prototype.md](./prototype.md)
- [object-dot-create.md](./object-dot-create.md)
- [pass-by-reference.md](./pass-by-reference.md)
- [destructuring-assignment.md](./destructuring-assignment.md)
