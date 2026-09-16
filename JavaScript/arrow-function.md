# Arrow Functions

Arrow functions (ES2015) are a concise syntax for writing function expressions: `(a, b) => a + b` instead of `function(a, b) { return a + b; }`. Beyond brevity, their defining semantic feature is that they have **no own binding** for `this`, `arguments`, `super`, or `new.target` — they inherit all of these lexically from the nearest enclosing non-arrow function (or the module/global scope if there is none), which is fundamentally different from how regular functions determine `this` (dynamically, based on how they're called).

Syntactically, arrow functions support several shorthand forms: a single parameter can skip parentheses (`x => x * 2`), a single expression body implicitly returns its value (`x => x * 2`), while a block body (`x => { return x * 2; }`) requires an explicit `return`. Returning an object literal directly from a concise body requires wrapping it in parentheses (`x => ({ value: x })`), since a bare `{` after `=>` is parsed as the start of a block body, not an object literal.

Arrow functions **cannot** be used as constructors (`new arrowFn()` throws `TypeError`), have no `prototype` property, and cannot be used as generator functions. They're ideal for short callbacks, array method transformations, and any context where you specifically want to preserve the enclosing `this` (a common historical need before arrow functions existed, previously solved with `.bind(this)` or a `var self = this;` workaround).

## Examples

```js
// Concise body (implicit return) vs block body (explicit return)
const double = x => x * 2;
const doubleVerbose = x => { return x * 2; };
console.log(double(5), doubleVerbose(5)); // 10 10

// Returning an object literal from a concise body needs parentheses
const makePoint = (x, y) => ({ x, y });
console.log(makePoint(1, 2)); // { x: 1, y: 2 }
```

```js
// Lexical `this`: arrow functions inherit `this` from their enclosing scope
function Counter() {
  this.count = 0;
  setInterval(() => {
    this.count++; // `this` is the Counter instance, inherited lexically
    console.log(this.count);
  }, 1000);
}
new Counter(); // logs 1, 2, 3, ... correctly
```

```js
// Arrow functions cannot be constructors and have no `arguments`
const Broken = () => {};
// new Broken(); // TypeError: Broken is not a constructor

function regular(...args) { console.log(args); }
regular(1, 2, 3); // [1, 2, 3] — regular function has arguments/rest available

const arrowNoArgs = () => {
  // console.log(arguments); // ReferenceError, or refers to an outer function's arguments
};
```

## Common Pitfalls / Gotchas

- Using an arrow function as an object method when `this` needs to refer to the object — it will instead capture the enclosing scope's `this`, not the object it's attached to.
- Trying to use `new` with an arrow function — throws `TypeError: ... is not a constructor`.
- Assuming arrow functions have their own `arguments` object — they don't; referencing `arguments` inside one falls through to an outer function's `arguments` (or throws if there's no enclosing function).
- Forgetting the parentheses-around-object-literal rule (`() => ({})` vs `() => {}`) — the latter is parsed as an empty function body, not an object, and silently returns `undefined`.

## Interview Questions & Answers

**Q: How does `this` inside an arrow function differ from `this` inside a regular function?**
A: A regular function's `this` is determined dynamically by its call site (who called it, or explicit `.call`/`.apply`/`.bind`). An arrow function has no own `this` at all — it's resolved lexically, meaning it simply uses whatever `this` is in scope where the arrow function was *defined*, regardless of how it's later called.

**Q: Why can't arrow functions be used as constructors?**
A: Arrow functions lack the internal `[[Construct]]` method that the `new` operator requires, and they have no `prototype` property to attach instance methods to. This is intentional — they're designed purely as lightweight function values, not object blueprints.

**Q: What's a classic real-world use case where switching a callback from a regular function to an arrow function fixes a bug?**
A: Inside a class method that sets up an event listener or timer callback intending to reference the instance's `this` — a regular function callback would get its own `this` (often `undefined` in strict mode, or the global object otherwise) when invoked by the browser/timer, whereas an arrow function correctly inherits the class method's `this`, referring to the instance as intended.

**Q: How do you return an object literal directly from an arrow function's concise body?**
A: Wrap it in parentheses: `() => ({ key: 'value' })`. Without the parentheses, `{` immediately after `=>` is interpreted as the start of a block statement body, not an object literal, and the function would return `undefined`.

## Related Topics
- [functions-in-javascript.md](./functions-in-javascript.md)
- [this-keyword.md](./this-keyword.md)
- [lexical-scope.md](./lexical-scope.md)
- [bind-function.md](./bind-function.md)
