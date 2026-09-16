# Classes in TypeScript

TypeScript extends JavaScript's `class` syntax with type annotations on fields, constructor parameters, and methods, plus several compile-time-only features (access modifiers, `abstract`, `readonly`, parameter properties) layered on top of the same runtime class semantics JavaScript already has. A TypeScript class still compiles down to a regular JavaScript class (or, with older targets, an ES5-style prototype-based constructor function) — nothing about how classes *work* at runtime changes; TypeScript only adds compile-time checking and some syntactic conveniences around declaring them.

Fields are declared with an optional type annotation (`name: string;`), and can be initialized inline or in the constructor; under `strictPropertyInitialization` (part of `strict` mode), TypeScript requires every non-optional field to be definitely assigned by the end of the constructor, catching a class instance that could otherwise end up with an unexpectedly `undefined` property. A major TypeScript-only convenience is **parameter properties**: prefixing a constructor parameter with an access modifier (`constructor(private name: string)`) automatically declares a matching class field and assigns it from the parameter in one step, eliminating the boilerplate of declaring the field separately and writing `this.name = name;` by hand.

Classes support the same OOP mechanics familiar from other languages — inheritance via `extends` and `super()`, method overriding, and (since TypeScript 4.3) explicit `override` keyword checking, which flags an error if a method marked `override` doesn't actually override anything in the parent class (catching typos or a renamed parent method that silently orphans a child override). Static members (`static`), getters/setters (`get`/`set`), and index signatures on classes all work as in JavaScript, with full type checking layered on top.

Because TypeScript is structurally typed, a class's *instances* are compatible with any interface or object type whose shape they satisfy, with no `implements` required for that compatibility — but a class can still explicitly declare `implements SomeInterface` to get an immediate, precise compile error at the class declaration if it's missing a required member (see [interfaces.md](./interfaces.md) and [structural-typing.md](./structural-typing.md)).

## Examples

```ts
// Fields, constructor, and strictPropertyInitialization enforcement
class Account {
  balance: number;         // must be definitely assigned by end of constructor under `strict`
  readonly ownerId: string;

  constructor(ownerId: string, initialBalance: number) {
    this.ownerId = ownerId;
    this.balance = initialBalance;
  }

  deposit(amount: number): void {
    this.balance += amount;
  }
}
```

```ts
// Parameter properties — declares AND assigns a field in one step
class User {
  constructor(
    public id: number,
    private email: string,
    readonly createdAt: Date = new Date()
  ) {}
  // no need to manually write: this.id = id; this.email = email; etc.
}
const user = new User(1, "anil@example.com");
console.log(user.id); // OK — public
// console.log(user.email); // Compile error — private
```

```ts
// Inheritance, super(), and the `override` keyword for safety
class Animal {
  constructor(protected name: string) {}
  speak(): string { return `${this.name} makes a sound.`; }
}
class Dog extends Animal {
  constructor(name: string, private breed: string) {
    super(name);
  }
  override speak(): string { // `override` catches a typo'd/renamed parent method at compile time
    return `${this.name} (${this.breed}) barks.`;
  }
}
```

## Common Pitfalls / Gotchas

- Forgetting to call `super()` before accessing `this` in a derived class's constructor — this is a hard requirement (enforced by JavaScript itself, not just TypeScript) whenever a class `extends` another.
- Declaring a field without initializing it and without a definite-assignment marker under `strictPropertyInitialization` — this is a compile error by design (`Property 'x' has no initializer`); either initialize it inline, assign it in the constructor, mark it optional (`x?: string`), or use the definite assignment assertion (`x!: string`) if you truly initialize it elsewhere.
- Using `override` inconsistently — without `noImplicitOverride` enabled in `tsconfig.json`, TypeScript won't actually require the `override` keyword on methods that do override a parent method, so its safety benefit depends on the flag being turned on.
- Mixing up parameter properties' implicit field declaration with regular constructor parameters — forgetting the access modifier (`private`/`public`/`protected`/`readonly`) on a constructor parameter means it's just a regular parameter, not an automatically-declared class field.

## Interview Questions & Answers

**Q: What are TypeScript "parameter properties," and what problem do they solve?**
A: A shorthand where prefixing a constructor parameter with an access modifier (`public`, `private`, `protected`, or `readonly`) automatically both declares a matching class field and assigns it from that parameter — eliminating the usual boilerplate of declaring the field separately and manually writing `this.field = field;` in the constructor body.

**Q: What does `strictPropertyInitialization` enforce, and why is it valuable?**
A: It requires every non-optional class field to be definitely assigned a value by the end of the constructor (either via inline initialization or an assignment in the constructor body). It catches a real class of bugs where an instance ends up with an unexpectedly `undefined` field that the type system otherwise claims is always defined.

**Q: What does the `override` keyword do, and what does `noImplicitOverride` add to it?**
A: `override`, placed before a method in a derived class, signals intent to override a parent method and causes a compile error if no matching method actually exists on the parent (catching a typo or a since-renamed/removed parent method). `noImplicitOverride` (a `tsconfig.json` flag) makes the *absence* of `override` an error too, whenever a method does in fact override a parent method — requiring every override to be explicitly and correctly marked.

**Q: Does a TypeScript class need to `implement` an interface to satisfy it elsewhere in the code?**
A: No — because of structural typing, any class instance whose shape matches the interface satisfies it regardless of an explicit `implements` clause. `implements` is optional but useful because it produces an immediate, clear compile error right at the class declaration if a required member is missing, rather than a less obvious error somewhere the class is later used.

## Related Topics
- [access-modifiers.md](./access-modifiers.md)
- [readonly-properties.md](./readonly-properties.md)
- [abstract-classes.md](./abstract-classes.md)
- [interfaces.md](./interfaces.md)
- [strict-mode.md](./strict-mode.md)
