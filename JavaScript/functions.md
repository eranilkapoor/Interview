# Functions

A function is a reusable block of code designed to perform a specific task, optionally accepting input (parameters) and producing output (a return value). Functions are JavaScript's primary mechanism for abstraction and code reuse, and — critically — they are **first-class citizens**: functions can be assigned to variables, stored in data structures, passed as arguments to other functions, and returned from other functions, exactly like any other value (string, number, object).

JavaScript supports several ways to define a function: function declarations (`function foo() {}`), function expressions (`const foo = function() {}`), arrow functions (`const foo = () => {}`), and methods defined inside object/class literals. Each has different hoisting behavior, different handling of `this`, and different suitability depending on context (see [functions-in-javascript.md](./functions-in-javascript.md) for a full breakdown of the varieties and their distinctions).

Every function is itself an object under the hood (of type `"function"`, a callable object), which is why functions can have properties, and why constructs like `.call()`, `.apply()`, `.bind()`, and reading `.length`/`.name` work — these are all inherited from `Function.prototype`. Functions being first-class values is the foundation for higher-order functions, callbacks, closures, and the entire functional-programming style available in JavaScript.

## Examples

```js
// Function declaration — hoisted, usable before its definition line
console.log(add(2, 3)); // 5
function add(a, b) {
  return a + b;
}
```

```js
// Functions as first-class values: stored, passed, and returned
const operations = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
};
function calculate(op, a, b) {
  return operations[op](a, b); // function retrieved from an object and invoked
}
console.log(calculate('add', 5, 3)); // 8

function makeMultiplier(factor) {
  return function (n) { return n * factor; }; // returning a function
}
const triple = makeMultiplier(3);
console.log(triple(7)); // 21
```

```js
// Functions are objects — they can carry their own properties
function greet() { console.log('hi'); }
greet.usageCount = 0;
greet.usageCount++;
console.log(greet.usageCount, greet.name, greet.length); // 1 "greet" 0
```

## Common Pitfalls / Gotchas

- Forgetting function declarations are fully hoisted (usable before their definition appears in the file), while function expressions and arrow functions are not — only the variable binding is hoisted (as `undefined`, or left in the TDZ for `let`/`const`).
- Assuming all function types handle `this` the same way — regular functions get their own `this` determined by how they're called; arrow functions inherit `this` lexically from their enclosing scope.
- Ignoring a function's `.length` property assumption — it counts only parameters *before* the first default value or rest parameter, which can be surprising (`function f(a, b = 1, ...c) {}` has `.length === 1`).
- Naming a function parameter the same as an outer variable and assuming it's the same binding — parameters always create a new, local binding that shadows outer scope.

## Interview Questions & Answers

**Q: What does it mean for functions to be "first-class citizens" in JavaScript?**
A: Functions can be treated like any other value — assigned to variables, stored in arrays/objects, passed as arguments to other functions, and returned as the result of another function — without any special syntax. This is the foundation for callbacks, higher-order functions, and functional programming patterns in JS.

**Q: What are the main ways to define a function in JavaScript, and how do they differ in hoisting?**
A: Function declarations (`function foo(){}`) are fully hoisted — callable before their line of definition. Function expressions (`const foo = function(){}`) and arrow functions (`const foo = () => {}`) are not hoisted in the same way — only the variable declaration is hoisted (per `var`/`let`/`const` rules), so calling them before the assignment line throws (`TypeError` for `var`-declared ones since they're `undefined` at that point, or a `ReferenceError` from the TDZ for `let`/`const`).

**Q: Why is a function considered an "object" in JavaScript?**
A: Functions are callable objects — they have a prototype (`Function.prototype`), can have their own properties, and support standard object operations, which is what makes methods like `.call()`, `.apply()`, `.bind()` and properties like `.length`/`.name` possible.

## Related Topics
- [functions-in-javascript.md](./functions-in-javascript.md)
- [arrow-function.md](./arrow-function.md)
- [higher-order-function.md](./higher-order-function.md)
- [hoisting.md](./hoisting.md)
- [closures.md](./closures.md)
