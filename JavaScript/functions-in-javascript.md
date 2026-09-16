# Types of Functions in JavaScript

Beyond the general concept of a function (see [functions.md](./functions.md)), JavaScript supports several distinct *forms* of function syntax, each with different hoisting rules, `this`-binding behavior, and typical use cases. Recognizing which form is which — and knowing the practical consequences of choosing one over another — is a frequent interview checkpoint.

**Function declaration**: `function foo() {}` — hoisted entirely (both the name and body), so it's callable anywhere in its scope, even before the line where it's written. **Function expression**: `const foo = function() {}` — only the variable is hoisted (per `var`/`let`/`const` rules); the function itself isn't usable until the assignment executes. A **named function expression** (`const foo = function bar() {}`) gives the function an internal name (`bar`) usable for recursion within its own body, without polluting the outer scope with that name. **Arrow function**: `const foo = () => {}` — has no own `this`, `arguments`, `super`, or `new.target`; always inherits these lexically; cannot be used as a constructor. **Method shorthand** (inside object/class literals): `{ foo() {} }` — behaves like a regular function but with concise syntax and, notably, cannot be used as a generator/constructor without the `*`/other markers. **IIFE** (Immediately Invoked Function Expression): defined and called in one expression, used to create an isolated scope immediately (see [iife.md](./iife.md)). **Generator functions** (`function* foo() {}`) and **async functions** (`async function foo() {}`) add special control-flow behavior on top of the base forms.

Choosing between these isn't just stylistic: arrow functions are unsuitable as object methods that need dynamic `this` (they'd silently capture the surrounding scope's `this` instead of the calling object), while regular functions/methods are unsuitable when you specifically want to preserve an enclosing `this` without manual `.bind()` (arrow functions solve that exact problem, e.g., inside class methods used as event handlers).

## Examples

```js
// Function declaration vs expression — hoisting difference
console.log(declared()); // "declared works!" — hoisted, callable early
function declared() { return 'declared works!'; }

try {
  console.log(expressed()); // TypeError: expressed is not a function (it's undefined at this point)
} catch (e) { console.log(e.message); }
var expressed = function () { return 'expressed works!'; };
```

```js
// Named function expression enables self-reference for recursion
const factorial = function fact(n) {
  return n <= 1 ? 1 : n * fact(n - 1); // 'fact' usable internally, not visible outside
};
console.log(factorial(5)); // 120
console.log(typeof fact);  // "undefined" — not leaked to outer scope
```

```js
// Arrow function vs regular method for `this` binding
const timer = {
  seconds: 0,
  startRegular() {
    setInterval(function () {
      this.seconds++; // `this` here is NOT `timer` (undefined/global in non-strict mode) — bug!
    }, 1000);
  },
  startArrow() {
    setInterval(() => {
      this.seconds++; // `this` is lexically `timer` — correct
    }, 1000);
  }
};
```

## Common Pitfalls / Gotchas

- Using an arrow function as an object method that needs `this` to refer to the object — arrow functions ignore the call-site entirely and use the enclosing lexical `this`, which is usually not what's intended for methods.
- Assuming a function expression is hoisted the same way as a declaration — only the *variable* is hoisted; calling it before the assignment throws.
- Forgetting a named function expression's internal name isn't accessible outside the expression — it exists only within the function's own body, useful purely for self-referential recursion.
- Using arrow functions as constructors (`new SomeArrowFn()`) — throws a `TypeError`, since arrow functions have no `[[Construct]]` internal method.

## Interview Questions & Answers

**Q: What's the practical difference between a function declaration and a function expression?**
A: Declarations are hoisted completely and callable anywhere in their scope. Expressions are only hoisted as an uninitialized/`undefined` variable binding — the function itself only becomes callable once the assignment line executes.

**Q: Why can't arrow functions be used as object methods when the method needs `this` to refer to the object?**
A: Arrow functions don't create their own `this` binding — they capture `this` lexically from the surrounding scope at definition time, which for a top-level object literal method is typically the outer scope's `this`, not the object itself. Regular functions/method shorthand correctly bind `this` to whatever object the method is called on.

**Q: What's a named function expression, and why would you use one over an anonymous one?**
A: It's a function expression with an internal name (`const f = function inner() {...}`), where `inner` is usable for self-reference/recursion inside the function body but invisible outside it. It's useful for recursive functions assigned to a variable that might later be reassigned — using the internal name for recursive calls avoids depending on the outer (potentially reassigned) variable.

## Related Topics
- [functions.md](./functions.md)
- [arrow-function.md](./arrow-function.md)
- [iife.md](./iife.md)
- [this-keyword.md](./this-keyword.md)
- [hoisting.md](./hoisting.md)
