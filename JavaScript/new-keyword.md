# The `new` Keyword

The `new` operator invokes a function as a **constructor**, creating a new object and running the function with `this` bound to that new object. Precisely, `new Fn(args)` performs four steps: (1) create a brand-new, empty object; (2) link that object's internal prototype to `Fn.prototype` (so it can access inherited methods); (3) call `Fn` with `this` set to the new object and the given arguments; (4) if `Fn` doesn't explicitly return an object of its own, return the newly created object (if `Fn` *does* return an object explicitly, that returned object is used instead, overriding the newly created one — a rarely-used but real edge case).

Both regular functions and `class` declarations can be used with `new` — in fact, `class` syntax is largely sugar over the same prototype-based construction mechanism function constructors have always used, with additional restrictions (a `class` *must* be called with `new`; calling it without throws a `TypeError`, whereas a plain function constructor called without `new` just silently runs as a regular function call with the wrong `this`, a classic historical footgun).

`new.target` is a meta-property, available inside any function, that lets code detect whether it was invoked via `new` (it holds a reference to the constructor being invoked) or as a plain function call (where it's `undefined`) — useful for writing constructor functions that guard against being called without `new`.

## Examples

```js
// new performs 4 steps: create object, link prototype, call with this, return object
function Person(name) {
  this.name = name; // `this` is the newly created object
}
Person.prototype.greet = function () { return `Hi, I'm ${this.name}`; };

const p = new Person('Anil');
console.log(p.name);        // "Anil"
console.log(p.greet());     // "Hi, I'm Anil"
console.log(p instanceof Person); // true — prototype correctly linked
```

```js
// Forgetting `new` on a plain function constructor — classic historical bug
function Car(model) {
  this.model = model; // `this` is NOT a new object without `new`!
}
const c = Car('Tesla'); // no `new` — this is undefined (strict) or global (non-strict)
console.log(c); // undefined — Car() returned nothing; `this.model` assignment went astray
```

```js
// class throws if called without `new`; new.target detects invocation style
class Animal {
  constructor(name) { this.name = name; }
}
// Animal('Dog'); // TypeError: Class constructor Animal cannot be invoked without 'new'

function Guarded() {
  if (!new.target) {
    throw new Error('Guarded() must be called with new');
  }
  this.ok = true;
}
new Guarded(); // works
// Guarded(); // throws the custom error
```

## Common Pitfalls / Gotchas

- Forgetting `new` when calling a function-based constructor — unlike `class`, this doesn't throw; it just silently runs the function as a plain call, leaving `this` wrong (and typically leaving the intended "instance" as `undefined` since nothing was returned).
- Assuming `class` constructors behave like function constructors when called without `new` — they explicitly throw `TypeError`, a deliberate safety improvement over the historical function-constructor footgun.
- Explicitly returning a primitive value from a constructor function and expecting it to override the new object — returning a primitive is ignored; only returning an *object* from the constructor overrides the newly created instance.
- Using arrow functions as constructors — `new someArrowFn()` throws `TypeError`, since arrow functions have no `[[Construct]]` behavior at all.

## Interview Questions & Answers

**Q: Walk through exactly what happens when you call `new Fn(args)`.**
A: (1) A new, empty object is created. (2) That object's internal prototype is set to `Fn.prototype`. (3) `Fn` is invoked with `this` bound to the new object and the given arguments. (4) If `Fn` doesn't return an object explicitly, the new object from step 1 is returned as the result of the `new` expression; if `Fn` does return an object, that object is returned instead.

**Q: What happens if you call a constructor function without `new`? How does `class` differ?**
A: Without `new`, a plain function constructor is just invoked as a regular function call — `this` won't be a new object (it's `undefined` in strict mode or the global object otherwise), typically causing bugs like assigning properties to the wrong object or the global scope, with no error thrown. `class` constructors are stricter: calling a class without `new` throws a `TypeError` immediately, catching the mistake right away.

**Q: What is `new.target`, and what's it used for?**
A: A meta-property available inside any function, holding a reference to the constructor invoked via `new` (or `undefined` if the function was called without `new`). It lets a function detect and guard against being called incorrectly without `new`, throwing a clear error instead of silently misbehaving.

**Q: If a constructor function explicitly returns an object, what happens to the newly created instance?**
A: It's discarded — the explicitly returned object becomes the result of the `new` expression instead. This only applies to returned *objects*; returning a primitive value (string, number, etc.) from a constructor is ignored, and the newly created instance is returned as normal.

## Related Topics
- [classes.md](./classes.md)
- [prototype.md](./prototype.md)
- [this-keyword.md](./this-keyword.md)
- [function-invocation.md](./function-invocation.md)
- [object-oriented-programing.md](./object-oriented-programing.md)
