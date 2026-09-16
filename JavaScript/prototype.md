# Prototype

Every JavaScript object has an internal link to another object called its **prototype** (accessible via `Object.getPrototypeOf(obj)`, or the deprecated `obj.__proto__`), from which it inherits properties and methods it doesn't have directly. When you access a property on an object, the engine first checks the object's own properties; if not found, it walks up to the object's prototype, then that prototype's prototype, and so on, until it finds the property or reaches the end of the chain (`null`) — this chain of linked objects is the **prototype chain**, and this lookup mechanism is JavaScript's actual inheritance model, distinct from (though often obscured by) classical class-based inheritance in other languages.

Every function has a special `.prototype` property (distinct from the function's own prototype, which is `Function.prototype`) — this is the object that becomes the prototype of any instance created by calling that function with `new`. This is how constructor functions historically implemented shared, memory-efficient methods: define a method once on `Constructor.prototype`, and every instance created via `new Constructor()` shares that same single method (via the prototype chain lookup) rather than each instance carrying its own separate copy.

`class` syntax (ES2015) doesn't replace this mechanism — it's built directly on top of it: methods defined inside a `class` body are automatically placed on the class's `.prototype`, exactly as if you'd assigned them manually to a constructor function's `.prototype` the old way. Understanding prototypes deeply means recognizing that `class`, `extends`, and even plain object literals are all just different syntactic entry points into this one underlying prototype-chain mechanism.

## Examples

```js
// A constructor function's .prototype is shared by all its instances
function Dog(name) { this.name = name; }
Dog.prototype.bark = function () { return `${this.name} says woof!`; };

const rex = new Dog('Rex');
const fido = new Dog('Fido');
console.log(rex.bark());  // "Rex says woof!"
console.log(fido.bark()); // "Fido says woof!"
console.log(rex.bark === fido.bark); // true — same shared function, not duplicated per instance
```

```js
// The prototype chain in action: lookup walks upward until found
console.log(rex.hasOwnProperty('name'));  // true — own property
console.log(rex.hasOwnProperty('bark'));  // false — inherited via the prototype chain
console.log(Object.getPrototypeOf(rex) === Dog.prototype); // true
console.log(Object.getPrototypeOf(Dog.prototype) === Object.prototype); // true — chain continues
console.log(Object.getPrototypeOf(Object.prototype)); // null — end of the chain
```

```js
// class syntax is sugar over the exact same prototype mechanism
class Cat {
  constructor(name) { this.name = name; }
  meow() { return `${this.name} says meow!`; }
}
const whiskers = new Cat('Whiskers');
console.log(typeof Cat.prototype.meow); // "function" — the method lives on the prototype, same as before
console.log(Object.getPrototypeOf(whiskers) === Cat.prototype); // true
```

## Common Pitfalls / Gotchas

- Confusing a function's `.prototype` property (the object future instances will inherit from) with the function's *own* prototype (`Function.prototype`, from which the function itself inherits `.call`/`.apply`/`.bind`) — these are two entirely different things.
- Directly modifying a shared built-in prototype (`Array.prototype.myMethod = ...`) — this affects *every* array in the entire program (including third-party library code), a dangerous practice known as "monkey-patching" that can cause subtle, hard-to-trace bugs.
- Assuming each object instance carries its own independent copy of a prototype method — it doesn't; all instances share the exact same function reference via the chain, which is precisely what makes prototype-based methods memory-efficient.
- Using `obj.__proto__` directly in modern code — it's a legacy accessor; prefer `Object.getPrototypeOf()`/`Object.setPrototypeOf()` for reading/writing an object's prototype.

## Interview Questions & Answers

**Q: What is the prototype chain, and how does property lookup use it?**
A: It's the chain of linked objects formed by each object's internal prototype reference. When you access a property, the engine checks the object's own properties first; if absent, it looks at the object's prototype, then that prototype's prototype, and so on, until the property is found or the chain ends at `null` (at which point the access returns `undefined`, or a `ReferenceError`/`TypeError` if used inappropriately).

**Q: What's the difference between a function's `.prototype` property and the function's own prototype?**
A: `Constructor.prototype` is the object that instances created via `new Constructor()` will link to as *their* prototype. The function itself (like any object) also has its own prototype, `Function.prototype`, from which it inherits methods like `.call`, `.apply`, `.bind` — these are two unrelated relationships that happen to share the word "prototype."

**Q: Why is defining a method on a constructor's `.prototype` more efficient than defining it inside the constructor function body (e.g., `this.method = function(){}`)?**
A: A method on `.prototype` is created once and shared, via the prototype chain, by every instance. A method assigned inside the constructor body (`this.method = ...`) is a completely new function object created fresh for every single instance, wasting memory when you have many instances that all need the identical behavior.

**Q: Is `class` a fundamentally different inheritance mechanism from prototype-based inheritance?**
A: No — `class` syntax is syntactic sugar over the exact same prototype mechanism. Methods defined in a class body are placed on the class's `.prototype`, and `extends` sets up the same prototype-chain linkage you could otherwise configure manually with `Object.setPrototypeOf()` or `Object.create()`.

## Related Topics
- [prototype-inheritence.md](./prototype-inheritence.md)
- [classes.md](./classes.md)
- [new-keyword.md](./new-keyword.md)
- [object-dot-create.md](./object-dot-create.md)
- [inheritence.md](./inheritence.md)
