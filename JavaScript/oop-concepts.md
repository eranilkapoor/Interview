# OOP Concepts (Four Pillars)

The four traditional pillars of Object-Oriented Programming — **encapsulation**, **abstraction**, **inheritance**, and **polymorphism** — describe a set of design goals for organizing code around objects, all of which JavaScript supports, albeit via its own prototype-based mechanisms rather than classical class-based ones (see [object-oriented-programing.md](./object-oriented-programing.md) for that broader distinction). Understanding each pillar with concrete JS syntax is a standard interview checklist.

**Encapsulation** means bundling an object's data and the methods that operate on it together, and controlling/hiding direct access to internal state where appropriate. JavaScript offers several levels of enforcement: convention only (a leading underscore, `_privateLookingField`, purely a signal, not actually enforced), closures (genuinely private state, accessible only through returned methods), and native private class fields (`#field`, ES2022 — enforced by the engine, not just convention). **Abstraction** means exposing a simple, well-defined interface while hiding the complexity of the underlying implementation — e.g., calling `array.sort()` without needing to know or care which sorting algorithm it uses internally.

**Inheritance** lets one object or class acquire (and optionally extend/override) the properties and methods of another, avoiding duplicated logic — implemented via the prototype chain (`Object.create`, or `class ... extends`). **Polymorphism** means objects of different underlying types can be used through a common interface, each responding to the same method call according to its own specific behavior — most visibly demonstrated when several subclasses override the same method name inherited from a shared parent, and calling that method on each produces different, type-appropriate results.

## Examples

```js
// Encapsulation via closures (fully private, not just convention) vs private class fields
function makeAccount(initialBalance) {
  let balance = initialBalance; // truly private — no external access at all
  return {
    deposit(amount) { balance += amount; return balance; },
    getBalance() { return balance; }
  };
}
const acc = makeAccount(100);
console.log(acc.getBalance()); // 100
console.log(acc.balance);       // undefined — inaccessible from outside
```

```js
// Abstraction: simple public method hides internal complexity
class ShoppingCart {
  #items = [];
  addItem(item) { this.#items.push(item); }
  getTotal() { // caller doesn't need to know HOW the total is computed
    return this.#items.reduce((sum, item) => sum + item.price, 0);
  }
}
const cart = new ShoppingCart();
cart.addItem({ price: 10 });
cart.addItem({ price: 25 });
console.log(cart.getTotal()); // 35
```

```js
// Inheritance and polymorphism together
class Employee {
  constructor(name) { this.name = name; }
  describe() { return `${this.name} is an employee`; } // to be overridden
}
class Manager extends Employee {
  describe() { return `${this.name} is a manager`; } // polymorphic override
}
class Engineer extends Employee {
  describe() { return `${this.name} is an engineer`; }
}
[new Manager('Anil'), new Engineer('Sunita')].forEach(e => console.log(e.describe()));
// "Anil is a manager"  "Sunita is an engineer" — same method call, different behavior per subclass
```

## Common Pitfalls / Gotchas

- Relying on a leading underscore (`_privateField`) for "encapsulation" and believing it's actually enforced — it's purely a naming convention signaling intent; the property remains fully accessible and mutable from outside.
- Assuming abstraction means "hide everything" — good abstraction exposes exactly what's needed for the caller's purposes, no more and no less; over-hiding can make an API harder to use effectively (too opaque) just as easily as under-hiding makes it fragile (too exposed).
- Confusing inheritance with composition, and reaching for `extends` by default — inheritance implies an "is-a" relationship (`Manager` is-an `Employee`); when the relationship is really "has-a" (a `Car` has-an `Engine`), composition is usually the better, more flexible fit.
- Believing polymorphism requires classes/inheritance specifically — duck-typing (any object with a matching method shape, regardless of its actual prototype chain) achieves a similar "same interface, different behavior" effect without formal class relationships.

## Interview Questions & Answers

**Q: How would you implement true (enforced) encapsulation in JavaScript, as opposed to convention-based encapsulation?**
A: Use closures (variables in an outer function's scope, only reachable through returned methods) or native private class fields (`#field`, ES2022), both of which the engine actually enforces — unlike a leading-underscore naming convention, which is just a hint to other developers and provides no real access restriction.

**Q: Give an example of polymorphism in JavaScript that doesn't rely on classical inheritance.**
A: Duck-typing: if multiple unrelated objects each implement a `.speak()` method, code that calls `animal.speak()` works polymorphically across all of them, regardless of whether they share a common parent class or prototype — JavaScript doesn't require a formal inheritance relationship for polymorphic behavior, only a matching method shape.

**Q: What's the practical difference between abstraction and encapsulation, since they're often confused?**
A: Encapsulation is about *bundling* data and behavior together and *restricting* direct access to internal state. Abstraction is about *simplifying* the exposed interface, hiding implementation complexity regardless of whether that internal state is technically "private" — a class could have completely public properties (poor encapsulation) while still offering a clean abstracted interface via its methods, and vice versa.

## Related Topics
- [object-oriented-programing.md](./object-oriented-programing.md)
- [private-vs-public.md](./private-vs-public.md)
- [inheritence.md](./inheritence.md)
- [classes.md](./classes.md)
- [prototype-inheritence.md](./prototype-inheritence.md)
