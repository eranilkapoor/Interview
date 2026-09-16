# The `this` Keyword

`this` is a special keyword available inside every function that refers to the object the function is currently executing in the context of — its value is determined **dynamically, by how the function is called** (the call site), not by where the function is defined (with the notable exception of arrow functions, which ignore this rule entirely and inherit `this` lexically from their enclosing scope instead).

The concrete value of `this` follows a set of resolution rules, generally checked in this priority order: (1) if the function is called with `new` (constructor invocation), `this` is the newly created object; (2) if called via `.call()`/`.apply()`/`.bind()` with an explicit context, `this` is exactly that context; (3) if called as a method on an object (`obj.method()`), `this` is that object; (4) if called as a plain, unqualified function (`fn()`), `this` is `undefined` in strict mode, or the global object in non-strict (legacy) mode. Arrow functions never follow these rules — they simply reuse whatever `this` is active in the surrounding lexical scope at the time they were defined.

Because `this` binding depends on the call site, extracting a method from its object and calling it separately (e.g., passing it as a callback) is one of the most common sources of `this`-related bugs in JavaScript — the extracted function is now invoked as a plain function call, losing its original object context, unless explicitly re-bound with `.bind()` or wrapped in an arrow function.

## Examples

```js
// this depends on HOW a function is called, not where it's defined
function whoAmI() { console.log(this); }
whoAmI(); // undefined (strict mode) / globalThis (non-strict)

const obj1 = { name: 'Sunita', whoAmI };
obj1.whoAmI(); // this === obj1

const extracted = obj1.whoAmI;
extracted(); // this is back to undefined/global — the object context was lost
```

```js
// Arrow functions ignore call-site rules; they inherit `this` lexically
const timer = {
  seconds: 0,
  start() {
    setInterval(() => {
      this.seconds++; // `this` is `timer`, inherited from start()'s lexical scope
    }, 1000);
  }
};
// timer.start(); // this.seconds increments correctly every second
```

```js
// Explicitly controlling this with call/apply/bind
function introduce() { console.log(`I am ${this.name}`); }
const person = { name: 'Anil' };
introduce.call(person);  // "I am Anil"
introduce.apply(person); // "I am Anil"
const bound = introduce.bind(person);
bound();                   // "I am Anil"
```

## Common Pitfalls / Gotchas

- Passing an object method as a callback (`setTimeout(obj.method, 1000)`) without binding — `this` inside `method` will not be `obj` when the callback eventually runs.
- Using a regular function (not an arrow function) for a callback inside a class method or object method where you need `this` to refer to the enclosing instance — the callback gets its own `this` based on how/if it's called (often `undefined`), not the surrounding method's `this`.
- Assuming arrow functions used as object literal *methods* will correctly refer to the object — they won't; an arrow function defined directly as a property in an object literal captures the *enclosing* scope's `this` at definition time, not the object being defined.
- Forgetting `this` inside a regular function called with no receiver defaults to the global object in non-strict mode (a legacy footgun), rather than throwing or being `undefined` — always use strict mode (default in modules/classes) to avoid this.

## Interview Questions & Answers

**Q: How is the value of `this` determined inside a regular JavaScript function?**
A: By the call site — how the function is actually invoked — following priority rules: `new` binding (constructor call) > explicit binding (`call`/`apply`/`bind`) > implicit binding (called as `obj.method()`) > default binding (plain function call, `undefined` in strict mode or the global object otherwise).

**Q: Why do arrow functions behave differently with `this` compared to regular functions?**
A: Arrow functions have no `this` binding of their own at all — they don't participate in the usual call-site resolution rules. Instead, they capture (inherit) `this` lexically from whatever scope encloses them at the point they're defined, which is why they're commonly used to preserve an outer `this` inside callbacks.

**Q: If you extract a method from an object and call it standalone, why does `this` change, and how do you fix it?**
A: `this` is resolved at the call site, and calling the extracted function as `fn()` (a plain function call) no longer has `obj` as the receiver — so `this` reverts to `undefined`/global. Fix it with `fn.bind(obj)`, by calling it as `obj.fn()` directly, or by wrapping the call in an arrow function that closes over `obj`.

**Q: What is `this` inside a class method, and how does it differ if the method is called without its instance (e.g., passed as an event handler)?**
A: Inside a class, `this` refers to the instance when the method is called as `instance.method()`. If the method is extracted and called without the instance as receiver (e.g., `element.addEventListener('click', instance.method)`), `this` loses its binding to the instance for the same reason as any other extracted method — fix with `.bind(this)` (often done in the constructor) or by defining the method as a bound arrow-function class field.

## Related Topics
- [function-invocation.md](./function-invocation.md)
- [arrow-function.md](./arrow-function.md)
- [call-function.md](./call-function.md)
- [apply-function.md](./apply-function.md)
- [bind-function.md](./bind-function.md)
- [new-keyword.md](./new-keyword.md)
