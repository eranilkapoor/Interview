# Object-Oriented Programming (OOP)

Object-Oriented Programming is a paradigm that organizes code around **objects** — bundles of related data (properties) and behavior (methods) — rather than around a sequence of instructions or purely functional transformations. JavaScript's OOP model is fundamentally **prototype-based**, which is meaningfully different from the **class-based** OOP found in languages like Java or C++: instead of objects being instances stamped from a rigid class blueprint, JavaScript objects link directly to other objects (their "prototype") to inherit behavior, and `class` syntax (ES2015) is ultimately just cleaner syntax layered on top of this same underlying prototype mechanism.

The four traditional pillars of OOP — encapsulation, abstraction, inheritance, and polymorphism — all have concrete JavaScript expressions. **Encapsulation** bundles data and the methods that operate on it together, optionally hiding internal details (via closures, or native private fields `#field` in classes). **Abstraction** exposes only the necessary interface, hiding implementation complexity behind simple method calls. **Inheritance** lets one object/class reuse and extend another's behavior (via the prototype chain, or `class ... extends`). **Polymorphism** lets different object types respond to the same method call in their own way (e.g., multiple classes each implementing their own `speak()` method, called uniformly).

JavaScript's OOP is frequently discussed alongside its alternative, functional programming (see [functional-programing.md](./functional-programing.md)) — the language fully supports both, and idiomatic modern JavaScript often blends them: classes/objects for modeling stateful domain entities, paired with pure functions for the logic that processes their data. Understanding that "OOP" in JS specifically means *prototypal* OOP (not classical OOP with true, rigid classes) is one of the highest-value distinctions for a JS-specific interview.

## Examples

```js
// Prototype-based "class" via a constructor function (pre-ES2015, still valid)
function Animal(name) {
  this.name = name; // encapsulated instance data
}
Animal.prototype.speak = function () { // shared behavior via the prototype
  return `${this.name} makes a sound`;
};
const dog = new Animal('Rex');
console.log(dog.speak()); // "Rex makes a sound"
```

```js
// The same idea using modern class syntax — sugar over the same prototype mechanism
class Shape {
  constructor(name) { this.name = name; }
  area() { return 0; } // to be overridden — abstraction/polymorphism
}
class Circle extends Shape {
  constructor(radius) { super('circle'); this.radius = radius; }
  area() { return Math.PI * this.radius ** 2; } // polymorphic override
}
class Square extends Shape {
  constructor(side) { super('square'); this.side = side; }
  area() { return this.side ** 2; }
}
[new Circle(2), new Square(3)].forEach(shape => {
  console.log(`${shape.name}: ${shape.area().toFixed(2)}`); // polymorphism: same call, different behavior
});
```

```js
// Encapsulation with private fields (ES2022)
class BankAccount {
  #balance = 0; // truly private — inaccessible outside the class
  deposit(amount) { this.#balance += amount; return this.#balance; }
  getBalance() { return this.#balance; }
}
const acc = new BankAccount();
acc.deposit(100);
console.log(acc.getBalance()); // 100
// console.log(acc.#balance); // SyntaxError — cannot access private field from outside
```

## Common Pitfalls / Gotchas

- Assuming JavaScript `class` works exactly like classical (Java/C++-style) classes — under the hood it's still prototype-based; there's no true "class blueprint" separate from an actual live prototype object.
- Believing inheritance always requires `class`/`extends` — the underlying mechanism (linking one object's prototype to another) predates `class` syntax and can be done directly with `Object.create()` or by manually setting `Object.setPrototypeOf()`.
- Overusing deep inheritance hierarchies — favoring composition (combining smaller, focused objects/behaviors) over long chains of `extends` is generally considered better OOP practice, even in classical OOP languages, and doubly so in JS given prototype-chain lookup cost and rigidity.
- Forgetting `this` binding issues when passing class methods as callbacks — since JS's `this` is determined by the call site, not by class membership (see [this-keyword.md](./this-keyword.md)).

## Interview Questions & Answers

**Q: What's the difference between class-based OOP and JavaScript's prototype-based OOP?**
A: Class-based languages (Java, C++) define a rigid, compile-time blueprint (the class) from which objects are instantiated. JavaScript is prototype-based: objects inherit directly from other live objects via the prototype chain; `class` syntax (ES2015) is syntactic sugar over this same prototype mechanism, not a fundamentally different underlying model.

**Q: Explain the four pillars of OOP with a JavaScript-specific example each.**
A: Encapsulation — bundling data/behavior together, optionally hiding internals with closures or `#privateFields`. Abstraction — exposing a simple public method (`account.deposit()`) while hiding internal complexity. Inheritance — `class Dog extends Animal` reusing/extending shared behavior via the prototype chain. Polymorphism — multiple subclasses each overriding a method (like `area()`) so the same call produces type-appropriate behavior.

**Q: Why might composition be preferred over deep class inheritance hierarchies?**
A: Deep inheritance chains create tight coupling between parent and child classes, make behavior harder to trace (a method could be defined several levels up an unfamiliar hierarchy), and are more rigid to change. Composition — building objects by combining smaller, focused pieces of behavior — tends to be more flexible and easier to reason about, a preference summarized as "favor composition over inheritance."

## Related Topics
- [oop-concepts.md](./oop-concepts.md)
- [classes.md](./classes.md)
- [prototype.md](./prototype.md)
- [prototype-inheritence.md](./prototype-inheritence.md)
- [composition-vs-inheritence.md](./composition-vs-inheritence.md)
- [functional-programing.md](./functional-programing.md)
