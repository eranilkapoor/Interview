# Classes

`class` (ES2015/ES6) is syntax for defining a blueprint for creating objects with shared behavior, built entirely on top of JavaScript's existing prototype mechanism (see [prototype.md](./prototype.md)) — it does not introduce a new inheritance model, just a cleaner, more familiar (Java/C++-like) syntax for the same underlying prototypal behavior. A class is declared with the `class` keyword and a `constructor()` method, which runs automatically every time a new instance is created via `new ClassName()`. If you don't define a constructor yourself, JavaScript provides an implicit, empty one automatically.

Methods defined inside a class body (other than the constructor) are placed on the class's `.prototype`, shared by every instance — calling them requires an actual instance (`new ClassName()`); calling a class without `new` throws a `TypeError`, unlike old-style constructor functions, which historically failed silently and incorrectly instead. **Static methods/properties** (declared with the `static` keyword) belong to the class itself, not to instances — you call them as `ClassName.staticMethod()`, never on an instance; they're commonly used for utility/factory functions related to the class but not tied to any particular instance's state. **Getters and setters** (`get prop()`/`set prop(value)`) let you define computed properties that read/write like plain fields but run custom logic.

Class declarations do **not** support hoisting the way function declarations do — referencing a class before its declaration line throws a `ReferenceError` (they're hoisted into a Temporal Dead Zone, just like `let`/`const`). Every class body implicitly runs in **strict mode**, regardless of whether `'use strict'` is present, which closes off several classic JavaScript footguns (like implicit global creation) automatically within class code.

## Examples

```js
// Basic class: constructor, instance method, static method
class Greeter {
  constructor() {
    console.log('I am a constructor method');
  }
  print() {
    console.log('I am a normal (prototype) method');
  }
  static hello() {
    console.log('I am a static method — called on the class itself');
  }
}
const g = new Greeter();       // "I am a constructor method"
g.print();                       // "I am a normal (prototype) method"
Greeter.hello();                 // "I am a static method — called on the class itself"
// g.hello(); // TypeError: g.hello is not a function — static methods aren't on instances
```

```js
// Inheritance with extends and super
class A {
  constructor() { console.log('A constructor'); }
  print() { console.log('A.print()'); }
  static hello() { console.log('A.hello() static'); }
}
class B extends A {
  constructor() {
    super(); // must call before using `this`; runs A's constructor
    console.log('B constructor');
  }
  newPrint() {
    A.hello(); // static methods are called on the class explicitly, not inherited onto instances the same way
  }
}
const b = new B(); // "A constructor" then "B constructor"
b.newPrint();        // "A.hello() static"
b.print();           // "A.print()" — inherited instance method
```

```js
// Getters/setters and private fields (ES2022) in a class
class Temperature {
  #celsius;
  constructor(celsius) { this.#celsius = celsius; }
  get fahrenheit() { return this.#celsius * 9 / 5 + 32; }
  set fahrenheit(f) { this.#celsius = (f - 32) * 5 / 9; }
}
const t = new Temperature(25);
console.log(t.fahrenheit); // 77
t.fahrenheit = 32;
console.log(t.fahrenheit); // 32
```

## Common Pitfalls / Gotchas

- Calling a class without `new` (`Greeter()`) — throws `TypeError: Class constructor Greeter cannot be invoked without 'new'`, a deliberate safety improvement over legacy function constructors, which silently misbehave instead.
- Forgetting `super()` in a derived class's constructor before touching `this` — throws a `ReferenceError`, since `this` isn't initialized in a subclass until the parent constructor runs.
- Trying to call a static method on an instance (`instance.staticMethod()`) — static members belong to the class itself, not to instances, and are simply not found there.
- Assuming classes support hoisting like function declarations — they don't; referencing a class before its declaration throws a `ReferenceError` (Temporal Dead Zone), same as `let`/`const`.
- Forgetting class bodies are always strict mode, even without an explicit `'use strict'` directive — legacy sloppy-mode behaviors (like implicit global creation) are disabled automatically inside class code.

## Interview Questions & Answers

**Q: Is `class` a new inheritance mechanism, or syntax sugar over something that already existed?**
A: Syntax sugar. `class` is built entirely on top of JavaScript's existing prototype-based inheritance — methods defined in a class body are placed on the class's `.prototype`, and `extends` sets up the same prototype-chain linkage that could previously only be configured manually via constructor functions and `Object.create()`.

**Q: What's the difference between a static method and an instance method?**
A: An instance method (defined normally in the class body) lives on the class's `.prototype` and is called on an *instance* (`instance.method()`), typically operating on that instance's own data via `this`. A static method (declared with `static`) belongs to the *class itself*, called as `ClassName.method()`, and cannot access instance-specific `this` data — it's used for utility/factory logic related to the class as a whole.

**Q: Why does calling a class without `new` throw an error, while an old-style constructor function called without `new` doesn't?**
A: `class` constructors have a dedicated internal check requiring invocation via `new`, throwing a `TypeError` immediately if violated — a deliberate design improvement. Legacy constructor functions have no such check; calling them without `new` just runs them as an ordinary function call, silently leaving `this` bound incorrectly (often to `undefined` or the global object) instead of erroring.

**Q: Do class declarations get hoisted the same way function declarations do?**
A: No — while they are technically hoisted (the binding exists from the start of the scope), they remain in the Temporal Dead Zone until the class declaration line actually executes, just like `let`/`const`. Referencing a class before that point throws a `ReferenceError`, unlike a hoisted function declaration, which is fully usable immediately.

## Related Topics
- [prototype.md](./prototype.md)
- [inheritence.md](./inheritence.md)
- [object-oriented-programing.md](./object-oriented-programing.md)
- [private-vs-public.md](./private-vs-public.md)
- [new-keyword.md](./new-keyword.md)
