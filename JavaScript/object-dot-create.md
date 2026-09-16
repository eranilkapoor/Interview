# Object.create()

`Object.create(proto, [propertiesObject])` creates a **new object** whose prototype is explicitly set to `proto` — the object (or `null`) you pass in. This gives you direct, precise control over an object's prototype at creation time, which is a lower-level, more explicit alternative to using `new` with a constructor function/class (where the prototype linkage happens implicitly as part of the `new` machinery). It's the clearest way to demonstrate that JavaScript's inheritance is fundamentally about linking objects to objects, with no class/constructor required at all.

Passing `null` as the prototype (`Object.create(null)`) produces an object with **no prototype whatsoever** — it doesn't inherit `toString()`, `hasOwnProperty()`, or anything else from `Object.prototype`. This is occasionally used deliberately for objects meant to act as pure, bare dictionaries/maps, immune to prototype-pollution concerns (where a malicious or accidental property like `__proto__` or `constructor` set on a normal object could interfere with expectations) — though modern code more often reaches for a genuine `Map` for that use case instead.

The optional second argument lets you supply property descriptors directly at creation time (in the same shape `Object.defineProperties()` expects), letting you create an object with a custom prototype *and* precisely configured properties (custom `writable`/`enumerable`/`configurable` flags, or getters/setters) in one call — useful for library/framework internals that need this level of control.

## Examples

```js
// Basic Object.create(): explicit prototype linkage, no constructor needed
const animal = {
  speak() { return `${this.name} makes a sound`; }
};
const dog = Object.create(animal);
dog.name = 'Rex';
console.log(dog.speak());                          // "Rex makes a sound"
console.log(Object.getPrototypeOf(dog) === animal); // true
```

```js
// Object.create(null): a prototype-less "bare" object
const bareDict = Object.create(null);
bareDict.key = 'value';
console.log(bareDict.key);          // "value"
console.log(bareDict.toString);      // undefined — no Object.prototype methods inherited
console.log(typeof bareDict.hasOwnProperty); // "undefined"
```

```js
// Object.create() with property descriptors supplied directly
const point = Object.create(Object.prototype, {
  x: { value: 10, writable: false, enumerable: true },
  y: { value: 20, writable: false, enumerable: true }
});
console.log(point.x, point.y); // 10 20
point.x = 999; // fails silently (or throws in strict mode) — not writable
console.log(point.x); // 10
```

## Common Pitfalls / Gotchas

- Forgetting `Object.create(null)` objects lack even basic methods like `.hasOwnProperty()` — you must call it as `Object.prototype.hasOwnProperty.call(bareDict, key)` instead of `bareDict.hasOwnProperty(key)`.
- Assuming `Object.create(proto)` copies `proto`'s own properties onto the new object — it doesn't; it only sets up the prototype *link*, so the new object inherits access to `proto`'s properties via the chain, but doesn't have independent copies of them.
- Confusing `Object.create(proto)` with `Object.assign({}, proto)` — the former sets up live prototypal inheritance (changes to `proto` later are reflected through the chain); the latter performs a one-time shallow copy of `proto`'s own enumerable properties, with no ongoing link.
- Using `Object.create()`'s property-descriptor argument without realizing descriptors default to `writable: false, enumerable: false, configurable: false` when not explicitly specified — different defaults than plain object-literal properties.

## Interview Questions & Answers

**Q: What does `Object.create(proto)` do, and how is it different from using `new` with a constructor function?**
A: It creates a new, empty object whose prototype is explicitly set to `proto`, with no constructor function or `this`-initialization logic involved at all — pure prototype linkage. `new Constructor()` also sets up prototype linkage (to `Constructor.prototype`), but additionally runs the constructor function's body with `this` bound to the new object, potentially adding its own instance properties in the process.

**Q: What happens when you call `Object.create(null)`, and why might you use it?**
A: It creates an object with absolutely no prototype — it doesn't inherit anything from `Object.prototype`, including `.toString()`, `.hasOwnProperty()`, etc. This is occasionally used to create a "clean," pollution-immune dictionary object, safe from any interference by inherited or prototype-chain properties (like `__proto__` or `constructor`), though a `Map` is more commonly used for that purpose in modern code.

**Q: How would you use `Object.create()` to set up an inheritance relationship equivalent to `class Dog extends Animal`?**
A: `Dog.prototype = Object.create(Animal.prototype);` (followed by resetting `Dog.prototype.constructor = Dog`) — this was the standard pre-ES2015 pattern for linking a "subclass" constructor function's prototype to its "parent," achieving the same prototypal inheritance relationship that `class ... extends` now sets up automatically.

## Related Topics
- [prototype.md](./prototype.md)
- [prototype-inheritence.md](./prototype-inheritence.md)
- [objects-in-javascript.md](./objects-in-javascript.md)
- [new-keyword.md](./new-keyword.md)
