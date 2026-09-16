# Composition vs Inheritance

Inheritance and composition are two different strategies for reusing behavior across objects. **Inheritance** models an "is-a" relationship: a subclass *is a* specialized version of its parent, automatically gaining (and optionally overriding) everything the parent defines, via the prototype chain (`class ... extends`). **Composition** instead builds objects by *combining* smaller, focused, independent pieces of behavior — a "has-a" or "can-do" relationship: an object *has a* logger, or *can* fly, by holding a reference to (or being assembled from) separate objects/functions that provide that capability, rather than inheriting it from a shared ancestor.

The well-known software design guidance "favor composition over inheritance" reflects real, repeatedly-observed problems with deep or overly broad inheritance hierarchies: tight coupling between parent and child (a change to a base class can unexpectedly break every subclass), the fragility of needing to guess at design time exactly how a class might need to be extended in the future, and the "diamond problem" / rigid single-parent limitation of most class-based inheritance models. Composition avoids these by keeping behaviors as small, independent, swappable units that can be combined in different ways for different objects, without forcing a strict hierarchical relationship between them.

JavaScript makes composition especially natural because functions are first-class and objects are just flexible collections of properties: you can compose behavior via **mixins** (functions that take a class/object and return an augmented version of it, or `Object.assign()` used to merge multiple behavior objects onto a prototype), via **dependency injection** (passing in collaborator objects/functions rather than inheriting their behavior), or simply by having an object hold references to other objects that provide the functionality it needs.

## Examples

```js
// Inheritance: rigid "is-a" hierarchy — awkward once behaviors don't cleanly nest
class Bird { fly() { return 'flying'; } }
class Penguin extends Bird {
  fly() { throw new Error('Penguins cannot fly!'); } // forced to override/break the parent's contract
}
```

```js
// Composition: flexible "has-a"/"can-do" — combine only the behaviors that fit
const canFly = (obj) => ({ ...obj, fly: () => 'flying' });
const canSwim = (obj) => ({ ...obj, swim: () => 'swimming' });

const duck = canSwim(canFly({ name: 'Duck' }));   // gets both behaviors
const penguin = canSwim({ name: 'Penguin' });      // only gets swimming — no awkward override needed

console.log(duck.fly(), duck.swim());       // "flying" "swimming"
console.log(penguin.swim());                 // "swimming"
console.log(typeof penguin.fly);             // "undefined" — never had it, no contract to violate
```

```js
// Mixins via Object.assign — composing multiple independent behaviors onto a class
const Serializable = { toJSON() { return JSON.stringify(this); } };
const Comparable = { equals(other) { return this.id === other.id; } };

class Product {
  constructor(id, name) { this.id = id; this.name = name; }
}
Object.assign(Product.prototype, Serializable, Comparable); // compose behaviors in

const p1 = new Product(1, 'Widget');
const p2 = new Product(1, 'Widget V2');
console.log(p1.toJSON());      // '{"id":1,"name":"Widget"}'
console.log(p1.equals(p2));    // true — composed-in behavior, no inheritance hierarchy needed
```

## Common Pitfalls / Gotchas

- Forcing an inheritance hierarchy onto behaviors that don't cleanly nest (the classic "Penguin is a Bird, but Birds fly and Penguins can't" problem) — a sign composition would model the domain more accurately.
- Overusing mixins to the point where it's unclear which "composed-in" object a given method actually came from — document or structure mixins clearly to keep behavior traceable.
- Assuming composition means "no reuse of structure at all" — composition still promotes significant reuse; it just reuses *behavior* by combining independent pieces rather than by inheriting from a shared rigid ancestor.
- Believing "favor composition over inheritance" means inheritance should never be used — inheritance is still the right tool for genuine, stable "is-a" relationships (e.g., `HTMLButtonElement extends HTMLElement`); the guidance is about not defaulting to inheritance reflexively for every reuse need.

## Interview Questions & Answers

**Q: What's the practical difference between inheritance and composition?**
A: Inheritance models an "is-a" relationship — a subclass automatically gets (and can override) everything from its parent via the prototype chain. Composition models a "has-a"/"can-do" relationship — an object gains capabilities by combining/holding references to separate, independent pieces of behavior, without a rigid hierarchical link to where those pieces came from.

**Q: Why is "favor composition over inheritance" common advice, and give an example of the problem it addresses.**
A: Deep or poorly-fitting inheritance hierarchies create tight coupling and force awkward workarounds when a subclass doesn't actually fit its parent's full contract — the classic example: `Penguin extends Bird` where `Bird` has a `fly()` method, forcing `Penguin` to either implement a nonsensical flying behavior or throw an error overriding it. Composition avoids this by only combining the specific behaviors (`canSwim`, not `canFly`) that actually apply to a given object.

**Q: How would you implement shared behavior across unrelated classes in JavaScript without inheritance?**
A: Via mixins — plain objects containing methods, merged onto a target prototype with `Object.assign(TargetClass.prototype, MixinA, MixinB)` — or by composing smaller functions/objects together directly (functional composition, or objects holding references to collaborator objects that provide needed functionality), rather than establishing a formal `extends` relationship.

## Related Topics
- [inheritence.md](./inheritence.md)
- [prototype-inheritence.md](./prototype-inheritence.md)
- [object-oriented-programing.md](./object-oriented-programing.md)
- [functional-programing.md](./functional-programing.md)
