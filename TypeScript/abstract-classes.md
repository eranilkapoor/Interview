# Abstract Classes

An abstract class, declared with the `abstract` keyword, is a class that **cannot be instantiated directly** — it exists purely to be extended by concrete subclasses, and typically defines a mix of fully-implemented shared behavior plus one or more `abstract` methods (declared with a signature but no body) that every subclass is required to implement. `abstract class Shape { abstract area(): number; describe(): string { return `Area: ${this.area()}`; } }` provides `describe()` as ready-to-use shared logic while forcing every concrete subclass to supply its own `area()` implementation, since there's no single sensible default across all shapes.

This is fundamentally different from just adding a runtime check that throws in a base method — `abstract` is enforced by the **compiler**, at compile time: attempting `new Shape()` directly is a compile error (`Cannot create an instance of an abstract class`), and a concrete subclass that fails to implement an inherited `abstract` method is also a compile error. It's simultaneously a runtime construct (an actual `class` exists in the compiled JavaScript, since `abstract` classes still support real inheritance, `instanceof` checks, and shared method implementations) and a compile-time contract (the abstractness itself, and the requirement to implement abstract members, are erased/checked only by TypeScript, not enforced by JavaScript at runtime).

Abstract classes sit in a specific niche between interfaces and fully concrete classes: use an interface when you only need to describe a shape/contract with no shared implementation at all (pure structural typing, no `new` semantics needed); use an abstract class when you want to provide genuine shared, inherited implementation *alongside* a required contract for the parts that must vary per subclass — something interfaces cannot do, since interface members can never carry an implementation body.

Abstract classes can also declare abstract properties (not just methods), abstract constructors are not directly expressible (there is no such thing as an "abstract constructor" you call — instantiation itself is what's blocked), and a class hierarchy can mix regular and abstract methods freely, with `abstract` methods acting as the required "hooks" a subclass must fill in — a pattern closely related to the classic Template Method design pattern.

## Examples

```ts
// Abstract class with shared implementation plus a required abstract method
abstract class Shape {
  abstract area(): number; // no body — every subclass MUST implement this

  describe(): string { // shared, concrete implementation, inherited as-is
    return `This shape has an area of ${this.area()}`;
  }
}
// const s = new Shape(); // Compile error: Cannot create an instance of an abstract class

class Circle extends Shape {
  constructor(private radius: number) { super(); }
  area(): number { return Math.PI * this.radius ** 2; } // required implementation
}
const c = new Circle(5);
console.log(c.describe()); // "This shape has an area of 78.5398..."
```

```ts
// Compile error if a subclass forgets to implement an abstract member
abstract class Repository<T> {
  abstract findById(id: string): T | undefined;
  abstract save(item: T): void;

  exists(id: string): boolean { // shared logic, built on the abstract methods
    return this.findById(id) !== undefined;
  }
}
// class UserRepository extends Repository<User> {
//   findById(id: string) { return undefined; }
//   // Compile error: non-abstract class 'UserRepository' does not implement 'save'
// }
```

```ts
// Abstract properties, not just methods
abstract class Employee {
  abstract readonly role: string;
  greet(): string { return `Hi, I'm a ${this.role}.`; }
}
class Engineer extends Employee {
  readonly role = "Engineer";
}
console.log(new Engineer().greet()); // "Hi, I'm a Engineer."
```

## Common Pitfalls / Gotchas

- Trying to instantiate an abstract class directly (`new Shape()`) — this is always a compile error, regardless of whether every abstract member happens to have been given a default elsewhere; abstract classes are only ever usable through a concrete subclass.
- Forgetting that abstract classes are enforced only at compile time, not runtime — the `abstract` keyword and its checks are erased when compiled to JavaScript; nothing in raw compiled JS prevents constructing an abstract-origin class object through unusual means (e.g., dynamically bypassing type checking), though this is rare in practice.
- Confusing an abstract class's "cannot instantiate directly" restriction with `private`/`protected` constructors, which are a different technique for restricting instantiation (used for factory or singleton patterns), not for requiring subclass-specific behavior.
- Overusing abstract classes where a plain interface (with no shared implementation needed) or plain composition (passing in behavior as a parameter/callback rather than requiring inheritance) would be simpler and avoid coupling subclasses to a rigid inheritance hierarchy.

## Interview Questions & Answers

**Q: What is an abstract class, and how is it different from a regular class?**
A: A class marked `abstract` cannot be instantiated directly with `new` — it can only be used as a base class for other classes to extend. It typically declares one or more `abstract` methods/properties (signature only, no implementation) that every concrete subclass is required to implement, alongside any regular, fully-implemented methods that get inherited as-is.

**Q: What happens if a subclass doesn't implement all of an abstract class's abstract members?**
A: It's a compile-time error — TypeScript requires every abstract member to be implemented by the first non-abstract class in the inheritance chain. A subclass can itself remain `abstract` and defer implementation further down the hierarchy, but any concrete (non-abstract) class must implement everything.

**Q: Why would you use an abstract class instead of an interface?**
A: When you need to provide genuine shared implementation (real method bodies with logic) alongside a contract for members that must vary per subclass — interfaces can only describe a shape/contract with no implementation at all, while an abstract class can mix concrete, inherited behavior with required abstract "hooks" that subclasses must fill in.

**Q: Is the `abstract` keyword enforced at runtime, or only at compile time?**
A: Only at compile time — like nearly all TypeScript-specific syntax, it's checked by the compiler and then erased; the emitted JavaScript class has no special "abstract" runtime marker or enforcement of its own (though the class itself and any inheritance still function normally at runtime).

## Related Topics
- [classes-in-typescript.md](./classes-in-typescript.md)
- [interfaces-vs-abstract-classes.md](./interfaces-vs-abstract-classes.md)
- [interfaces.md](./interfaces.md)
- [access-modifiers.md](./access-modifiers.md)
- [structural-typing.md](./structural-typing.md)
