# Interfaces vs Abstract Classes

Interfaces and abstract classes both describe a contract a concrete implementation must satisfy, which makes it easy to conflate them — but they differ in a fundamental way: an interface is a **pure compile-time construct with zero runtime footprint and zero implementation**, while an abstract class is a **real runtime class that can carry actual, shared, inherited implementation** alongside members it requires subclasses to fill in. Choosing between them is really choosing between "just describe a shape, structurally" and "provide real shared code plus a required contract, through actual class inheritance."

Because interfaces are erased entirely at compile time, they support multiple inheritance-like composition trivially — a class can `implement` any number of interfaces at once, since there's no actual behavior or state being merged, just type-shape requirements being checked. Abstract classes, like all TypeScript/JavaScript classes, only support **single inheritance** — a class can `extend` only one class (abstract or not) at a time, though it can additionally `implement` multiple interfaces alongside that one `extends`. This is often the deciding factor in practice: if a type needs to compose several independent contracts, interfaces are the only option; if you need one specific piece of shared, inherited behavior, an abstract class is appropriate, but you only get to use that mechanism once per class.

Interfaces support declaration merging and can describe non-class things too (function types, object literals, index signatures); abstract classes cannot merge and are only usable as an actual class-inheritance base. Interfaces also carry no `instanceof`-checkable runtime identity (you cannot do `value instanceof SomeInterface`), while an abstract class does provide real runtime typing — `value instanceof AbstractBase` works, because the abstract class exists as an actual constructor function/class in the emitted JavaScript, unlike an interface.

As a practical guideline: default to interfaces for describing pure contracts/shapes, especially anything you want multiple unrelated classes to implement, or that needs to be genuinely open to extension/augmentation by consumers. Reach for an abstract class specifically when you have real shared implementation logic you want every subclass to inherit for free, alongside a small number of "must be implemented per-subclass" hooks — the Template Method pattern being the canonical use case.

## Examples

```ts
// Interface: pure contract, zero implementation, supports multiple implementation at once
interface Flyable { fly(): void; }
interface Swimmable { swim(): void; }
class Duck implements Flyable, Swimmable { // implementing BOTH — no problem for interfaces
  fly() { console.log("Flying"); }
  swim() { console.log("Swimming"); }
}
```

```ts
// Abstract class: real shared implementation + a required per-subclass hook — single inheritance only
abstract class Employee {
  constructor(protected name: string) {}
  abstract calculatePay(): number; // required, no default makes sense across all employee types
  printPaySlip(): string { // shared, inherited implementation, free for every subclass
    return `${this.name}: $${this.calculatePay()}`;
  }
}
class SalariedEmployee extends Employee {
  constructor(name: string, private salary: number) { super(name); }
  calculatePay(): number { return this.salary / 12; }
}
// class Bad extends Employee, OtherClass {} // Not valid — only single inheritance allowed
```

```ts
// instanceof works for an abstract class (real runtime construct) but not for an interface (erased)
console.log(new SalariedEmployee("Anil", 60000) instanceof Employee); // true
// console.log(new Duck() instanceof Flyable); // Compile error — interfaces have no runtime existence
```

## Common Pitfalls / Gotchas

- Trying to use `instanceof` with an interface — interfaces are fully erased at compile time and have no runtime representation, so `value instanceof SomeInterface` is not valid; only classes (including abstract ones) support `instanceof`.
- Reaching for an abstract class purely to describe a contract with no shared implementation at all — an interface is lighter-weight, supports multiple implementation, and avoids locking consumers into a single-inheritance hierarchy for no real benefit.
- Trying to `extend` more than one abstract class — TypeScript/JavaScript classes only support single inheritance; if you need to combine several independent capabilities, interfaces (via multiple `implements`) are the only option.
- Assuming an abstract class's abstract methods behave like interface members for compatibility purposes — a class doesn't need to formally `extend` an abstract class to satisfy an interface's shape (structural typing still applies to interfaces), but it does need to `extend` an abstract class specifically to gain its shared implementation and to be checked against its abstract member requirements.

## Interview Questions & Answers

**Q: What's the core difference between an interface and an abstract class?**
A: An interface is a pure compile-time contract with zero implementation and zero runtime footprint — it's fully erased. An abstract class is a real class that exists at runtime, can provide actual shared, inherited implementation for some members, and requires subclasses to implement any members explicitly marked `abstract`.

**Q: Can a class implement multiple interfaces? Can it extend multiple abstract classes?**
A: A class can `implement` any number of interfaces at once, since interfaces carry no actual behavior to merge — just shape requirements to satisfy. A class can only `extend` a single class (abstract or concrete) at a time, since TypeScript/JavaScript classes support only single inheritance; multiple interface implementation is the mechanism for combining several independent contracts.

**Q: When would you choose an abstract class over an interface?**
A: When you have real, shared implementation logic that every subclass should inherit for free, combined with a smaller set of members that must vary per subclass and therefore can't have one universal default — the Template Method pattern (a base class providing an overall algorithm skeleton via concrete methods, with a few `abstract` "hook" methods for subclass-specific steps) is the textbook case.

**Q: Does `instanceof` work with interfaces the way it does with abstract classes?**
A: No — interfaces have no runtime representation at all (fully erased at compile time), so `instanceof` cannot be used with them. Abstract classes are real classes in the compiled JavaScript output, so `instanceof AbstractBase` works normally, correctly identifying instances of any concrete subclass.

## Related Topics
- [interfaces.md](./interfaces.md)
- [abstract-classes.md](./abstract-classes.md)
- [classes-in-typescript.md](./classes-in-typescript.md)
- [structural-typing.md](./structural-typing.md)
- [access-modifiers.md](./access-modifiers.md)
