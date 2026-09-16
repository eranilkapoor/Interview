# Access Modifiers (public, private, protected)

Access modifiers control the visibility of a class member (field or method) from outside the class: `public` (the default — accessible from anywhere), `private` (accessible only from within the declaring class itself), and `protected` (accessible from the declaring class and any of its subclasses, but not from outside that class hierarchy). Writing no modifier at all is equivalent to explicitly writing `public`. These modifiers are a **compile-time-only** concept — like every other TypeScript type annotation, they're fully erased when compiled to JavaScript, meaning a `private` field is not actually inaccessible at runtime; nothing stops external code compiled separately, or code that bypasses the type checker (e.g., via bracket-notation access or a `// @ts-ignore`), from reaching in and reading or mutating it.

This runtime-vs-compile-time gap is precisely why TypeScript also supports JavaScript's **native `#private` fields** (ECMAScript private fields, prefixed with `#`), which are enforced by the JavaScript engine itself at runtime, not just by the compiler — accessing a `#field` from outside the class is a genuine runtime `SyntaxError`, not merely a type error you could route around. For code that genuinely needs enforced privacy (not just documentation-level intent), native `#private` fields are the stronger guarantee; TypeScript's `private` keyword is mainly valuable for expressing and checking intent during development, plus enabling better tooling (autocomplete correctly hides `private` members from external code).

`protected` is specifically useful for base-class implementation details that subclasses need to build on but that external consumers shouldn't touch directly — a common pattern is a `protected` field set in a base constructor, with `public` getter methods exposed selectively by subclasses if external read access is ever needed. TypeScript also supports `protected` and `private` *constructors*, which prevent a class from being instantiated directly from outside (or outside its hierarchy) — a technique used to enforce factory-method-only or singleton instantiation patterns.

Access modifiers combine naturally with parameter properties (`constructor(private name: string)`) and with `readonly` (`private readonly id: string`), letting a single concise declaration express visibility, mutability, and automatic field assignment together.

## Examples

```ts
// public (default), private, and protected
class BankAccount {
  public owner: string;           // accessible anywhere (default, explicit here for clarity)
  private balance: number;        // only accessible within BankAccount itself
  protected accountType: string;  // accessible within BankAccount and its subclasses

  constructor(owner: string, balance: number) {
    this.owner = owner;
    this.balance = balance;
    this.accountType = "generic";
  }

  getBalance(): number {
    return this.balance; // OK — accessed from within the declaring class
  }
}
const acc = new BankAccount("Anil", 1000);
// acc.balance; // Compile error: 'balance' is private
```

```ts
// protected — accessible in subclasses, not from outside the hierarchy
class SavingsAccount extends BankAccount {
  describe(): string {
    return `${this.accountType} account`; // OK — protected, accessible in subclass
  }
}
// new SavingsAccount("Anil", 500).accountType; // Compile error — protected, not accessible externally
```

```ts
// Native #private fields — real runtime enforcement, unlike the `private` keyword
class Counter {
  #count = 0; // truly private at runtime, enforced by the JS engine itself
  increment(): number { return ++this.#count; }
}
const counter = new Counter();
counter.increment();
// counter.#count; // SyntaxError at compile AND runtime — not just a type error
```

## Common Pitfalls / Gotchas

- Believing TypeScript's `private` keyword provides real runtime privacy — it's erased at compile time; the resulting JavaScript field is just a normal, fully accessible property, unlike native `#private` fields which are genuinely enforced by the JS engine.
- Forgetting that `protected` members are accessible in subclasses but not from *outside* the class hierarchy at all — a common mix-up is expecting `protected` to behave like `public` for any "related" code, when it's actually scoped strictly to the class and its descendants.
- Mixing TypeScript's `private` keyword and native `#private` fields inconsistently within the same codebase without a clear convention — they behave differently (compile-time-only vs. runtime-enforced) and this can create false confidence about actual data protection.
- Trying to access a `private`/`protected` member via bracket notation (`obj["privateField"]`) to work around the compile-time restriction — TypeScript may still flag this in some configurations, but even where it doesn't, it defeats the intent of the modifier entirely and signals a design problem rather than a legitimate use case.

## Interview Questions & Answers

**Q: What's the difference between `private` and `protected` in TypeScript?**
A: `private` restricts access to only the declaring class itself — not even subclasses can access it. `protected` allows access from the declaring class and any of its subclasses, but still blocks access from completely outside the class hierarchy.

**Q: Does TypeScript's `private` keyword provide real privacy at runtime?**
A: No — it's a compile-time-only check, fully erased when compiled to JavaScript. The resulting field is a normal, fully accessible JavaScript property at runtime. For genuine runtime-enforced privacy, use native ECMAScript `#private` fields instead, which the JavaScript engine itself blocks external access to.

**Q: When would you use a `private` constructor?**
A: To prevent a class from being instantiated directly from outside (e.g., only via a static factory method, or to enforce a singleton pattern) — a `private` constructor means `new MyClass()` is only allowed from within the class itself (typically inside a `static` method that then returns the instance).

**Q: What's the practical difference between TypeScript's `private` keyword and native `#private` class fields?**
A: TypeScript's `private` is a compile-time-only annotation, erased in the emitted JavaScript with no runtime enforcement — it mainly documents intent and improves tooling/autocomplete. Native `#private` fields are enforced by the JavaScript engine itself at runtime; accessing one from outside the class throws a real `SyntaxError`, giving genuine, unbypassable encapsulation.

## Related Topics
- [classes-in-typescript.md](./classes-in-typescript.md)
- [readonly-properties.md](./readonly-properties.md)
- [abstract-classes.md](./abstract-classes.md)
- [interfaces-vs-abstract-classes.md](./interfaces-vs-abstract-classes.md)
- [structural-typing.md](./structural-typing.md)
