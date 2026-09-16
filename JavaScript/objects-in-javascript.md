# Objects in JavaScript

Beyond the basic mechanics of creating and accessing objects (see [objects.md](./objects.md)), it's worth understanding the deeper property model JavaScript objects use internally: every property isn't just a simple key-value pair — it's backed by a **property descriptor** that controls its behavior. A data property descriptor has `value`, `writable` (can it be reassigned?), `enumerable` (does it show up in `for...in`/`Object.keys()`?), and `configurable` (can it be deleted or have its descriptor changed?). An accessor property descriptor instead has `get`/`set` functions (computed properties) rather than a plain `value`. `Object.defineProperty()` lets you create properties with fine-grained control over these flags, which plain object-literal syntax doesn't expose directly (literal properties default to `writable: true, enumerable: true, configurable: true`).

This descriptor model is what powers getters/setters (`get prop() {}`/`set prop(v) {}` inside object literals or classes — computed, on-access properties that look like plain fields to the caller but run custom logic), and it's the underlying mechanism behind `Object.freeze()` (which flips `writable`/`configurable` to `false` on every own property) and non-enumerable properties (used, for instance, on many built-in methods so they don't clutter `for...in`/`Object.keys()` output).

Objects in JavaScript are also fundamentally **dynamic**: properties can be added, removed (`delete obj.prop`), or reassigned at any point after creation (unless explicitly restricted via `Object.freeze`/`Object.seal`/non-writable descriptors) — there's no fixed "shape" enforced by the language itself the way there is in statically-typed languages (TypeScript can enforce shape at compile time, but that's a separate, erased-at-runtime layer).

## Examples

```js
// Getters and setters — computed properties that look like plain fields
const temperature = {
  _celsius: 0,
  get fahrenheit() { return this._celsius * 9 / 5 + 32; },
  set fahrenheit(f) { this._celsius = (f - 32) * 5 / 9; }
};
temperature._celsius = 25;
console.log(temperature.fahrenheit); // 77 — computed on access, not stored directly
temperature.fahrenheit = 98.6;
console.log(temperature._celsius.toFixed(1)); // 37.0 — setter converted and stored it
```

```js
// Object.defineProperty for fine-grained control (non-enumerable, non-writable)
const obj = {};
Object.defineProperty(obj, 'id', {
  value: 42,
  writable: false,   // can't be reassigned
  enumerable: false, // won't show up in Object.keys()/for...in
  configurable: false // can't be deleted or redefined
});
console.log(obj.id);           // 42
obj.id = 100;                   // silently fails (or throws in strict mode)
console.log(Object.keys(obj)); // [] — 'id' is hidden from enumeration
```

```js
// Objects are dynamic — shape can change freely (unless explicitly restricted)
const user = { name: 'Anil' };
user.age = 30;        // adding a new property
delete user.name;     // removing an existing property
console.log(user);    // { age: 30 }

const locked = Object.freeze({ x: 1 });
locked.x = 2;           // fails silently (non-strict) or throws (strict)
locked.y = 3;           // adding new properties also fails once frozen
console.log(locked);   // { x: 1 }
```

## Common Pitfalls / Gotchas

- Assuming all object properties behave identically — getters/setters and non-enumerable/non-writable properties (set via `Object.defineProperty`) can behave very differently from a plain data property created via literal syntax, even though they often look the same when accessed.
- Forgetting `Object.freeze()` only affects the object's own top-level properties (shallow) — nested objects remain fully mutable unless separately frozen.
- Iterating with `for...in`/`Object.keys()` and assuming every property will show up — non-enumerable properties (common on some built-ins, and definable via `Object.defineProperty`) are intentionally excluded from those enumeration methods.
- Believing TypeScript's declared object "shape" is enforced at runtime — it's purely a compile-time check; a runtime object can still gain/lose properties freely regardless of what its TypeScript type says, unless you add explicit runtime validation.

## Interview Questions & Answers

**Q: What is a property descriptor, and what four attributes does a data property have?**
A: The internal metadata controlling how a property behaves: `value` (the actual stored value), `writable` (can it be reassigned?), `enumerable` (does it appear in `for...in`/`Object.keys()`?), and `configurable` (can it be deleted or have its descriptor changed?). Object-literal properties default to all three flags being `true`; `Object.defineProperty()` lets you set them explicitly.

**Q: How do getters/setters differ from a plain object property?**
A: A plain property stores a static value directly. A getter/setter defines functions that run custom logic whenever the property is read (`get`) or assigned (`set`), letting you compute a derived value on access or validate/transform a value on assignment, while still looking like an ordinary property to the code using it (`obj.prop`, not `obj.prop()`).

**Q: Why might you make a property non-enumerable using `Object.defineProperty`?**
A: To hide internal/implementation-detail properties from casual enumeration (`for...in`, `Object.keys()`, `JSON.stringify()`) without making them fully inaccessible — useful for metadata or helper properties that shouldn't clutter normal iteration or serialization of an object's "real" data.

## Related Topics
- [objects.md](./objects.md)
- [prototype.md](./prototype.md)
- [immutability.md](./immutability.md)
- [private-vs-public.md](./private-vs-public.md)
