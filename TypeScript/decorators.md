# Decorators

A decorator is a special kind of declaration that can be attached to a class, method, accessor, property, or parameter using `@expression` syntax, letting you observe, modify, or replace that declaration's behavior in a reusable, declarative way — for example, `@log` above a method to automatically log every call, or `@Injectable()` above a class in a dependency-injection framework like Angular or NestJS to register it with a DI container. Under the hood, a decorator is just a function that receives information about the thing it's decorating and can return a replacement, a modification, or nothing at all.

TypeScript's decorator story currently spans **two distinct, non-interchangeable implementations**, and knowing the difference is a genuinely important, frequently-tested interview point. The original implementation — enabled via the `experimentalDecorators` compiler flag, predating and inspiring the eventual JavaScript standard — is what frameworks like Angular and older NestJS/TypeORM versions were built around; its decorator functions receive arguments like `(target, propertyKey, descriptor)` and behave somewhat differently for classes vs. members. The newer implementation is the **TC39 Stage 3 decorators proposal**, now natively supported by TypeScript (5.0+) without any experimental flag, matching the shape decorators are expected to eventually have as a standard, native JavaScript (not just TypeScript) feature — its decorator functions receive a `(value, context)` pair, with `context` providing structured metadata (kind, name, `addInitializer`, etc.) instead of the older positional-argument style.

These two systems are **not source-compatible** — a decorator written for `experimentalDecorators` will not work correctly under the new standard decorators, and vice versa, because the function signatures and semantics genuinely differ (e.g., legacy parameter decorators have no standard-decorators equivalent at all, since the TC39 proposal doesn't include parameter decorators). This means the specific decorator syntax and behavior you'll encounter depends entirely on a project's `tsconfig.json` and which decorator-consuming libraries it uses — many major frameworks (Angular, NestJS, TypeORM) still default to `experimentalDecorators` as of TypeScript 5.x, since the ecosystem's migration to the new standard is still in progress.

Common practical use cases across both systems include dependency injection (registering/resolving class instances), logging/tracing (wrapping a method to log calls or timing), validation (checking a property's value against rules), memoization (caching a method's results), and ORM/serialization metadata (marking which class properties map to database columns or JSON keys) — decorators are fundamentally a metaprogramming tool for attaching reusable, declarative cross-cutting behavior to declarations without modifying their core implementation.

## Examples

```ts
// Legacy experimentalDecorators (tsconfig: "experimentalDecorators": true) — method decorator
function Log(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  descriptor.value = function (...args: any[]) {
    console.log(`Calling ${propertyKey} with`, args);
    return original.apply(this, args);
  };
}

class Calculator {
  @Log
  add(a: number, b: number): number {
    return a + b;
  }
}
new Calculator().add(2, 3); // logs "Calling add with [2, 3]" then returns 5
```

```ts
// Legacy class decorator — a simplified Angular-style @Injectable pattern
function Injectable(): ClassDecorator {
  return (target) => {
    (target as any).__injectable = true;
  };
}
@Injectable()
class UserService {
  getUsers() { return ["Anil", "Priya"]; }
}
```

```ts
// New TC39 Stage 3 decorators (no flag needed, TS 5.0+) — (value, context) signature
function logMethod(value: Function, context: ClassMethodDecoratorContext) {
  return function (this: any, ...args: any[]) {
    console.log(`Calling ${String(context.name)}`);
    return value.apply(this, args);
  };
}

class Greeter {
  @logMethod
  greet(name: string) {
    return `Hello, ${name}`;
  }
}
new Greeter().greet("Anil"); // logs "Calling greet" then returns "Hello, Anil"
```

## Common Pitfalls / Gotchas

- Mixing legacy `experimentalDecorators` code with the new TC39 standard decorators in the same project without realizing they're incompatible syntaxes/runtime semantics — a decorator written for one system will not behave correctly (and often won't even compile) under the other.
- Assuming decorators from a framework like Angular will "just work" once `experimentalDecorators` is turned off — most major frameworks (Angular, NestJS, TypeORM) still rely on the legacy system as of TypeScript 5.x, and switching decorator systems is a real migration, not a flag flip.
- Forgetting that the TC39 standard decorators proposal does **not** include parameter decorators — a common legacy pattern (e.g., decorating a constructor parameter for DI metadata) has no direct equivalent under the new standard and typically requires a different approach (often via `addInitializer` or class-level metadata instead).
- Overusing decorators for logic that would be clearer as a plain function call or composition — decorators add "magic" indirection that can make control flow harder to trace; they're most valuable for genuinely cross-cutting, declarative concerns (DI registration, ORM metadata) rather than as a general code-organization tool.

## Interview Questions & Answers

**Q: What are the two decorator implementations TypeScript supports, and are they interchangeable?**
A: The legacy `experimentalDecorators` implementation (enabled via a `tsconfig.json` flag, predating and inspiring the eventual JS standard) and the newer TC39 Stage 3 standard decorators (natively supported since TypeScript 5.0, no flag needed). They are not interchangeable — their decorator function signatures and behavior genuinely differ, so code written for one does not work under the other.

**Q: What's a key structural difference between how legacy and standard decorators receive information about what they're decorating?**
A: Legacy decorators receive positional arguments that vary by decorator kind (e.g., `(target, propertyKey, descriptor)` for a method decorator). Standard (TC39) decorators receive a uniform `(value, context)` pair, where `context` is a structured object carrying metadata like the member's kind and name, plus utilities like `addInitializer`.

**Q: Why do major frameworks like Angular and NestJS still often default to `experimentalDecorators`?**
A: Because they were built around the legacy decorator system (including patterns like parameter decorators for dependency injection, which the new TC39 standard doesn't support at all), and migrating a large, established framework's public decorator API to the new standard is a significant breaking change that the ecosystem has been migrating toward gradually rather than all at once.

**Q: Give a practical example of what a decorator is commonly used for in real projects.**
A: Dependency injection — a class decorator like `@Injectable()` registers a class with a DI container so it can be automatically constructed and injected elsewhere; or ORM entity mapping — property decorators like `@Column()` mark which class fields correspond to database table columns, letting an ORM generate queries and mappings from decorated class metadata instead of hand-written config.

## Related Topics
- [classes-in-typescript.md](./classes-in-typescript.md)
- [access-modifiers.md](./access-modifiers.md)
- [tsconfig.md](./tsconfig.md)
- [strict-mode.md](./strict-mode.md)
- [compiling-typescript.md](./compiling-typescript.md)
