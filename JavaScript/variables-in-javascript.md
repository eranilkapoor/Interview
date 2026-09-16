# Variables in JavaScript

A variable is a named container that holds a reference to a value in memory. JavaScript provides three keywords for declaring variables: `var` (the original, function-scoped declaration), and `let`/`const` (block-scoped, introduced in ES2015). Choosing the right one affects scoping, hoisting behavior, and mutability guarantees, and is one of the most frequently tested fundamentals in interviews.

`var` declarations are hoisted to the top of their enclosing function (or global scope) and initialized with `undefined`, meaning they're accessible (though `undefined`) before the line where they're declared. They can also be redeclared without error. `let` and `const` are also hoisted, but they remain in a "temporal dead zone" (TDZ) from the start of the block until their declaration line is executed — accessing them before that point throws a `ReferenceError` rather than silently returning `undefined`. `const` additionally requires an initializer and disallows reassignment of the binding (though the underlying object/array it points to can still be mutated).

Naming rules: variable names can contain letters, digits, `_`, and `$`, cannot start with a digit, and cannot be reserved keywords. JavaScript is case-sensitive, so `myVar` and `myvar` are different variables. Modern style overwhelmingly favors `const` by default, `let` when reassignment is needed, and avoids `var` entirely to sidestep hoisting/scoping surprises.

## Examples

```js
// var vs let: hoisting and scope leakage out of blocks
if (true) {
  var x = 'var value';
  let y = 'let value';
}
console.log(x); // "var value" — leaked out of the block
console.log(typeof y); // "undefined" — y is not defined, ReferenceError if accessed directly
```

```js
// Temporal Dead Zone (TDZ) with let/const
console.log(typeof a); // "undefined" (var is hoisted & initialized)
var a = 1;

console.log(typeof b); // ReferenceError: Cannot access 'b' before initialization
let b = 2;
```

```js
// const prevents reassignment of the binding, not deep mutation
const user = { name: 'Anil' };
user.name = 'Kapoor'; // allowed — mutating the object, not reassigning the binding
console.log(user.name); // "Kapoor"

user = {}; // TypeError: Assignment to constant variable.
```

## Common Pitfalls / Gotchas

- Assuming `const` makes an object immutable — it only prevents reassigning the variable binding; nested properties remain mutable (use `Object.freeze` for shallow immutability).
- Redeclaring `var` in the same scope silently overwrites the previous declaration with no error, unlike `let`/`const`, which throw `SyntaxError: Identifier 'x' has already been declared`.
- Forgetting that `var` inside a loop shares one binding across all iterations, causing classic closure bugs (see [closures.md](./closures.md)), while `let` creates a fresh binding per iteration.
- Accessing a `let`/`const` variable before its declaration and expecting `undefined` like `var` — you get a `ReferenceError` from the TDZ instead.

## Interview Questions & Answers

**Q: What are the differences between `var`, `let`, and `const`?**
A: `var` is function-scoped, hoisted and initialized to `undefined`, and can be redeclared. `let` and `const` are block-scoped, hoisted into a Temporal Dead Zone (accessing before declaration throws), and cannot be redeclared in the same scope. `const` additionally forbids reassigning the binding after initialization (but doesn't freeze the value itself).

**Q: Can you reassign a `const` object's properties?**
A: Yes. `const` only locks the variable binding, not the referenced value. `const obj = {}` lets you do `obj.prop = 1`, but `obj = {}` (rebinding) throws a `TypeError`. To prevent property mutation too, use `Object.freeze(obj)` (shallow) or a deep-freeze utility.

**Q: What is the Temporal Dead Zone?**
A: The span of code between entering a scope and the point where a `let`/`const`/`class` declaration is actually executed. The binding exists (it's hoisted) but is uninitialized, so any reference to it before its declaration line throws a `ReferenceError` instead of returning `undefined`. This is why TDZ is considered safer than `var`'s silent `undefined`.

**Q: Why does `var` inside a `for` loop combined with `setTimeout` often produce unexpected output?**
A: Because `var` is function-scoped, all loop iterations share the *same* variable binding. By the time an async callback (like `setTimeout`) runs, the loop has finished and the shared variable holds its final value. `let` fixes this by creating a new binding per iteration, so each closure captures its own value.

## Related Topics
- [let-and-const.md](./let-and-const.md)
- [hoisting.md](./hoisting.md)
- [block-scope.md](./block-scope.md)
- [closures.md](./closures.md)
- [global-variables.md](./global-variables.md)
