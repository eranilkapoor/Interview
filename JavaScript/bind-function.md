# Function.prototype.bind()

`.bind()` is a method on every function (via `Function.prototype`) that returns a **brand-new function** with `this` permanently fixed to whatever value you specify, and optionally with some leading arguments pre-filled as well: `const boundFn = fn.bind(thisArg, presetArg1, presetArg2)`. Unlike `.call()`/`.apply()`, `.bind()` does **not** invoke the function immediately — it hands back a new function to be called whenever you're ready, which is exactly why it's the tool of choice for creating callbacks that need a fixed `this` (event handlers, `setTimeout` callbacks, class methods passed as props).

Once a function is bound, its `this` is locked in permanently — calling `.call()`, `.apply()`, or even `.bind()` again on the already-bound function cannot override the original bound `this` (though additional `.bind()` calls can still append more preset arguments ahead of the previously bound ones). This is different from `.call()`/`.apply()`, whose explicit `this` only applies for that single invocation.

`.bind()` is also the mechanism most commonly used for partial application in JavaScript (see [partial-application.md](./partial-application.md)) — passing extra arguments to `.bind()` beyond `thisArg` pre-fills those parameters permanently in the returned function, which only needs the remaining arguments when eventually called.

## Examples

```js
// Basic bind(): fixing `this` for later invocation
const person = { name: 'Anil Kapoor', display() { console.log(this.name); } };
const displayLater = person.display.bind(person);
setTimeout(displayLater, 100); // "Anil Kapoor" — this stays bound to `person`, even later
```

```js
// Once bound, this cannot be overridden by call/apply, or even re-bind
function show() { console.log(this.value); }
const boundToA = show.bind({ value: 'A' });
boundToA.call({ value: 'B' }); // "A" — call() cannot override an already-bound this
const reBound = boundToA.bind({ value: 'C' });
reBound(); // "A" — re-binding also can't override the original binding
```

```js
// bind() for partial application: pre-filling leading arguments
function multiply(a, b) { return a * b; }
const double = multiply.bind(null, 2); // `this` unused; `a` fixed to 2
console.log(double(5)); // 10

// Common real-world use: fixing `this` for a class method passed as a callback
class Toggle {
  constructor() {
    this.on = false;
    this.handleClick = this.handleClick.bind(this); // preserves `this` when used as a handler
  }
  handleClick() { this.on = !this.on; }
}
```

## Common Pitfalls / Gotchas

- Forgetting `.bind()` returns a *new* function rather than modifying the original — the original function is left completely untouched and can still be called/bound differently elsewhere.
- Calling `.bind()` repeatedly inside a render/loop (common in older React class components) — each call creates a brand-new function instance, which can cause unnecessary re-renders in frameworks that rely on reference equality; bind once (e.g., in a constructor) instead.
- Assuming a bound arrow function's `this` can be changed — arrow functions have no `this` of their own to bind in the first place; calling `.bind()` on an arrow function has no effect on its `this` (though it can still be used to preset arguments).
- Confusing `.bind()`'s "invoke later" behavior with `.call()`/`.apply()`'s "invoke now" behavior — mixing these up is a common junior-level mistake when trying to fix a `this` bug.

## Interview Questions & Answers

**Q: What's the fundamental difference between `.bind()` and `.call()`/`.apply()`?**
A: `.call()` and `.apply()` invoke the function immediately with the specified `this`. `.bind()` does not invoke anything — it returns a new function with `this` (and optionally some leading arguments) permanently fixed, to be called later, as many times as needed.

**Q: Can you override a bound function's `this` by later calling `.call()` on it?**
A: No — once a function's `this` is bound via `.bind()`, it cannot be overridden by `.call()`, `.apply()`, or a subsequent `.bind()` call; the original bound `this` always wins. Only the additional arguments passed to a subsequent `.bind()` call get appended to the already-preset ones.

**Q: Give a practical example of when you'd need `.bind()` in a class.**
A: When passing a class method as a callback (e.g., an event handler: `button.addEventListener('click', this.handleClick)`), the method loses its `this` binding to the instance because it's invoked as a plain function call by the event system. Binding it in the constructor (`this.handleClick = this.handleClick.bind(this)`) ensures `this` inside `handleClick` always refers to the instance, regardless of how it's later called.

**Q: How does `.bind()` support partial application?**
A: Any arguments passed to `.bind()` after the `thisArg` are permanently pre-filled into the returned function, which then only needs the remaining arguments supplied when it's eventually called — e.g., `multiply.bind(null, 2)` creates a "double" function needing just one more argument.

## Related Topics
- [call-function.md](./call-function.md)
- [apply-function.md](./apply-function.md)
- [this-keyword.md](./this-keyword.md)
- [partial-application.md](./partial-application.md)
- [arrow-function.md](./arrow-function.md)
