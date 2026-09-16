# Prototypal Inheritance

Prototypal inheritance is JavaScript's actual, native inheritance mechanism: an object inherits behavior by being directly linked to another **object** (its prototype), rather than by being stamped from an abstract class blueprint (as in classical, class-based inheritance). When a property or method is accessed and not found on the object itself, the lookup automatically continues up the prototype chain — this single mechanism *is* how JavaScript implements what other languages need a separate, distinct "inheritance" construct for.

There are two common ways to set up prototypal inheritance directly: `Object.create(protoObject)` creates a new object whose prototype is explicitly `protoObject`, and `class ... extends ParentClass` (ES2015+) sets up the child class's `.prototype` to inherit from the parent class's `.prototype` automatically, while also wiring up `super()` (to call the parent constructor) and `super.method()` (to call an overridden parent method) for you. Before `class` syntax existed, this same relationship was configured manually via `Child.prototype = Object.create(Parent.prototype)` — a pattern still worth recognizing in older/legacy code.

Because prototypal inheritance links *objects* to *objects* (not just classes to classes), it's more flexible than rigid classical inheritance — you can create one-off objects that inherit from any other specific object at will, use `Object.create(null)` to make an object with *no* prototype at all (useful for genuinely bare dictionaries, safe from prototype-pollution concerns), or dynamically alter an object's prototype at runtime with `Object.setPrototypeOf()` (though this is rare and generally discouraged for performance/clarity reasons).

## Examples

```js
// Manual prototypal inheritance via Object.create() — pre-class-syntax approach
const animal = {
  speak() { return `${this.name} makes a sound`; }
};
const dog = Object.create(animal); // dog's prototype is `animal`
dog.name = 'Rex';
console.log(dog.speak()); // "Rex makes a sound" — inherited via the prototype link
console.log(Object.getPrototypeOf(dog) === animal); // true
```

```js
// The equivalent using class + extends, with super
class Animal {
  constructor(name) { this.name = name; }
  speak() { return `${this.name} makes a sound`; }
}
class Dog extends Animal {
  speak() {
    return `${super.speak()} — specifically, a bark!`; // calls the parent's method
  }
}
const rex = new Dog('Rex');
console.log(rex.speak()); // "Rex makes a sound — specifically, a bark!"
console.log(rex instanceof Animal); // true — inheritance chain preserved
```

```js
// The pre-ES2015 manual pattern for setting up class-like inheritance
function Animal(name) { this.name = name; }
Animal.prototype.speak = function () { return `${this.name} makes a sound`; };

function Dog(name) { Animal.call(this, name); } // "super constructor" call
Dog.prototype = Object.create(Animal.prototype); // set up prototype chain
Dog.prototype.constructor = Dog; // fix the constructor reference

const fido = new Dog('Fido');
console.log(fido.speak()); // "Fido makes a sound" — inherited the old-fashioned way
```

## Common Pitfalls / Gotchas

- Setting `Child.prototype = Parent.prototype` directly (instead of `Object.create(Parent.prototype)`) — this makes both share the *exact same* prototype object, so modifying `Child.prototype` accidentally also mutates `Parent.prototype`.
- Forgetting to call `super()` in a derived class's constructor before accessing `this` — this throws a `ReferenceError`, since a subclass's `this` isn't initialized until the parent constructor runs via `super()`.
- Assuming `Object.create(null)` objects behave like normal objects — they have no prototype at all, so they lack even basic inherited methods like `.toString()` or `.hasOwnProperty()` (you'd need `Object.prototype.hasOwnProperty.call(obj, key)` instead).
- Confusing prototypal inheritance's object-to-object linking with classical inheritance's class-to-class relationship — in JS, even without any `class` syntax at all, you can set up equivalent inheritance directly between plain objects.

## Interview Questions & Answers

**Q: What is prototypal inheritance, and how does it differ from classical inheritance?**
A: Prototypal inheritance links an object directly to another object (its prototype) for inherited behavior, resolved dynamically at property-lookup time via the prototype chain. Classical inheritance (Java, C++) instead defines behavior via fixed, compile-time class hierarchies, from which instances are stamped. JavaScript's `class` syntax provides a classical-looking syntax but is implemented entirely via the same underlying prototypal mechanism.

**Q: How would you set up prototypal inheritance between two objects without using `class`?**
A: `const child = Object.create(parentObject);` — this creates a new object whose prototype is `parentObject`, so `child` inherits any properties/methods it doesn't have directly from `parentObject` via the prototype chain.

**Q: Why must `super()` be called before using `this` in a derived class's constructor?**
A: In `class` semantics, a derived class doesn't have its own initialized `this` until the parent class's constructor (`super()`) has run and set it up. Accessing `this` before that call throws a `ReferenceError`, because there's genuinely no valid `this` binding yet.

## Related Topics
- [prototype.md](./prototype.md)
- [inheritence.md](./inheritence.md)
- [classes.md](./classes.md)
- [object-dot-create.md](./object-dot-create.md)
- [composition-vs-inheritence.md](./composition-vs-inheritence.md)
