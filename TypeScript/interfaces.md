# Interfaces

An `interface` declares the shape of an object — the set of properties and methods it must have, along with their types — without providing any implementation. It's a pure compile-time construct: interfaces are completely erased by the compiler and leave no trace in the emitted JavaScript. You use an interface to describe a contract ("anything passed here must have a `name: string` and an `age: number`") that any structurally-matching object, plain literal, or class instance can satisfy, per TypeScript's structural type system.

Interfaces support optional properties (`age?: number`), readonly properties (`readonly id: number`), method signatures, index signatures, and can extend one or more other interfaces (`interface Admin extends User { permissions: string[] }`), combining and building up shapes hierarchically. A class can explicitly declare that it implements an interface (`class Employee implements User`), which makes the compiler check that the class satisfies every member of the interface — but as covered in structural typing, this declaration is optional for compatibility purposes; it mainly buys you an immediate, clear compile error at the class declaration itself if a member is missing, rather than a confusing error somewhere far away where the class is later used.

A distinguishing, TypeScript-specific feature of interfaces (not shared by type aliases) is **declaration merging**: if you declare the same-named interface more than once in the same scope, TypeScript automatically merges all the declarations into one combined interface with every member from each. This is intentionally exploited by libraries to let consumers augment built-in or third-party types (for example, extending Express's `Request` interface with a custom `user` property, or extending the global `Window` interface) — see [module-augmentation.md](./module-augmentation.md).

Interfaces are generally the recommended default for describing the shape of objects and classes specifically because of this extensibility (merging and `extends`), clean error messages, and slightly better performance in very large, deeply-nested type-checking scenarios historically observed in the TypeScript compiler — though in most everyday code, the choice between an interface and an equivalent type alias for an object shape is largely stylistic; see [interfaces-vs-type-aliases.md](./interfaces-vs-type-aliases.md) for the concrete differences.

## Examples

```ts
// Basic interface with optional and readonly members
interface User {
  readonly id: number;
  name: string;
  email?: string;
}

const user: User = { id: 1, name: "Anil" }; // email omitted — fine, it's optional
// user.id = 2; // Compile error: readonly property
```

```ts
// Extending interfaces — builds up a shape hierarchically
interface Animal {
  name: string;
}
interface Dog extends Animal {
  breed: string;
}
const rex: Dog = { name: "Rex", breed: "Labrador" };
```

```ts
// A class explicitly implementing an interface — compiler checks it satisfies every member
interface Serializable {
  serialize(): string;
}
class Invoice implements Serializable {
  constructor(private amount: number) {}
  serialize(): string {
    return JSON.stringify({ amount: this.amount });
  }
}

// Declaration merging — the two declarations combine automatically
interface Config {
  env: string;
}
interface Config {
  debug: boolean;
}
const cfg: Config = { env: "prod", debug: false }; // requires members from BOTH declarations
```

## Common Pitfalls / Gotchas

- Forgetting that `implements` is only a compile-time check on the class declaration itself — it doesn't change runtime behavior, and structural compatibility elsewhere doesn't require `implements` at all.
- Relying on declaration merging accidentally (e.g., two unrelated interfaces with the same name in the same scope colliding and silently combining) instead of intentionally (as with module augmentation) — this can produce confusing "member is missing" errors far from where the interfaces were declared.
- Trying to use `interface` for a union, intersection, tuple, or primitive alias — interfaces can only describe object/function shapes; use a `type` alias for anything else.
- Forgetting an interface itself carries no runtime representation — you cannot do `value instanceof SomeInterface` (only classes support `instanceof`); use a type guard or check for specific properties instead.

## Interview Questions & Answers

**Q: What is an interface used for in TypeScript, and does it produce any runtime code?**
A: It declares the shape (properties, methods, index signatures) an object or class must conform to. It's a pure compile-time construct — fully erased during compilation, producing zero runtime JavaScript output.

**Q: What is declaration merging, and how does it apply to interfaces specifically?**
A: If the same interface name is declared more than once in the same scope, TypeScript automatically merges all declarations' members into a single combined interface. This is unique to interfaces (type aliases cannot do this) and is exploited deliberately to let consumers extend third-party or global types, like augmenting Express's `Request` interface.

**Q: Does a class need to explicitly `implements` an interface to be used wherever that interface is expected?**
A: No — TypeScript's structural typing means any class instance (or plain object) with a compatible shape satisfies the interface regardless of an explicit `implements` clause. `implements` is optional but valuable because it gives an immediate, precise compile error right at the class declaration if a required member is missing, rather than a less clear error somewhere the class is later used.

**Q: Can an interface extend multiple other interfaces at once?**
A: Yes — `interface C extends A, B { ... }` combines the members of both `A` and `B` into `C`'s required shape, along with any members `C` adds itself.

## Related Topics
- [type-aliases.md](./type-aliases.md)
- [interfaces-vs-type-aliases.md](./interfaces-vs-type-aliases.md)
- [structural-typing.md](./structural-typing.md)
- [classes-in-typescript.md](./classes-in-typescript.md)
- [module-augmentation.md](./module-augmentation.md)
