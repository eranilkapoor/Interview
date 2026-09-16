# Inheritance

Inheritance is an OOP mechanism that lets one object or class reuse and extend the properties and behavior of another, avoiding duplicated logic and expressing "is-a" relationships (a `Dog` is an `Animal`). In JavaScript, inheritance is always ultimately implemented through the prototype chain (see [prototype-inheritence.md](./prototype-inheritence.md)) — whether you write it using modern `class ... extends` syntax, older constructor-function patterns, or direct `Object.create()` calls, the underlying mechanism resolving inherited property/method lookups is exactly the same.

`class ... extends ParentClass` is the idiomatic modern way to set up inheritance: the child class's instances gain access to everything defined on the parent class's prototype, `super(args)` inside the child's constructor invokes the parent's constructor (mandatory before using `this` in the child), and `super.methodName()` lets a child method call the parent's version of an overridden method — enabling the child to *extend* rather than fully *replace* inherited behavior. A child class can override any parent method simply by redefining a method with the same name, which is the basis for polymorphism (see [oop-concepts.md](./oop-concepts.md)).

While inheritance is powerful for expressing genuine "is-a" hierarchies with shared behavior, overusing it — especially building deep multi-level class hierarchies — is widely considered a design smell in both classical and prototypal OOP. Composition (building objects out of smaller, focused pieces of reusable behavior, combined rather than inherited) is often the more flexible, maintainable choice when the relationship is really "has-a" or "can-do," rather than a strict "is-a" (see [composition-vs-inheritence.md](./composition-vs-inheritence.md)).

## Examples

```js
// Single-level inheritance with method overriding and super
class Vehicle {
  constructor(make) { this.make = make; }
  describe() { return `A vehicle made by ${this.make}`; }
}
class Car extends Vehicle {
  constructor(make, doors) {
    super(make); // must call before using `this`
    this.doors = doors;
  }
  describe() {
    return `${super.describe()}, specifically a car with ${this.doors} doors`; // extends parent behavior
  }
}
const car = new Car('Toyota', 4);
console.log(car.describe()); // "A vehicle made by Toyota, specifically a car with 4 doors"
console.log(car instanceof Vehicle); // true
```

```js
// Multi-level inheritance chain
class Animal {
  speak() { return 'Some sound'; }
}
class Dog extends Animal {
  speak() { return 'Woof'; }
}
class Puppy extends Dog {
  speak() { return `${super.speak()} (but tiny and squeaky)`; }
}
console.log(new Puppy().speak()); // "Woof (but tiny and squeaky)"
console.log(new Puppy() instanceof Animal); // true — inheritance chain spans multiple levels
```

```js
// Overriding without calling super — fully replacing parent behavior
class Shape {
  area() { throw new Error('Not implemented'); } // meant to be overridden
}
class Rectangle extends Shape {
  constructor(w, h) { super(); this.w = w; this.h = h; }
  area() { return this.w * this.h; } // completely replaces the parent's implementation
}
console.log(new Rectangle(3, 4).area()); // 12
```

## Common Pitfalls / Gotchas

- Forgetting `super()` in a derived class constructor before accessing `this` — throws a `ReferenceError`, since the subclass's `this` isn't initialized until the parent constructor runs.
- Building deep inheritance hierarchies (many levels of `extends`) — this tightly couples classes together and makes behavior hard to trace, since a method could be inherited from several levels up; favor composition when the relationship isn't a clean "is-a."
- Overriding a method and forgetting to call `super.method()` when you meant to *extend* (not replace) the parent's behavior — the parent's logic is simply skipped entirely unless explicitly invoked.
- Assuming inheritance is the only way to share behavior between objects — mixins (composing multiple small pieces of behavior via `Object.assign()` onto a prototype, or delegation) and pure functions applied to different object types can achieve reuse without a formal inheritance relationship.

## Interview Questions & Answers

**Q: How does `class ... extends` implement inheritance under the hood?**
A: It sets up the child class's `.prototype` to have the parent class's `.prototype` as its own prototype, so instances of the child inherit methods defined on the parent via the standard prototype chain lookup. `super()` and `super.method()` are syntax for explicitly invoking the parent's constructor/methods within that same chain.

**Q: What happens if a subclass overrides a method without calling `super.method()` inside the override?**
A: The parent's version of that method is never invoked automatically — the override completely replaces the inherited behavior for that method name, unless the child explicitly calls `super.method()` somewhere within its own implementation to layer on top of (rather than replace) the parent's logic.

**Q: When would you prefer composition over inheritance?**
A: When the relationship between two pieces of behavior/data is "has-a" or "can-do" rather than a true "is-a" — e.g., a `Car` *has an* `Engine` rather than *is an* `Engine`. Composition avoids the rigidity and tight coupling of deep class hierarchies, letting you mix and match smaller, focused behaviors more flexibly.

## Related Topics
- [prototype-inheritence.md](./prototype-inheritence.md)
- [composition-vs-inheritence.md](./composition-vs-inheritence.md)
- [classes.md](./classes.md)
- [oop-concepts.md](./oop-concepts.md)
