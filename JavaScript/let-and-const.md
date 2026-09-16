# let & const

`let` and `const` are the block-scoped variable declaration keywords introduced in ES2015 (ES6) to replace the many pitfalls of `var`. Both are scoped to the nearest enclosing block (`{ ... }` — including `if`, `for`, and bare blocks), rather than the nearest enclosing function, which matches how most other C-family languages behave and matches programmer intuition far better than `var`'s function scoping.

`let` is used when a variable's value needs to change after initialization (loop counters, accumulators, reassigned state). `const` is used when the binding should never be reassigned — which, in well-written modern code, is the vast majority of variables. Importantly, `const` protects the *binding*, not the *value*: `const arr = [1,2,3]; arr.push(4);` is perfectly legal because `arr` still refers to the same array object; only `arr = otherArray` would throw.

Both `let` and `const` are hoisted to the top of their block but remain uninitialized until their declaration executes — this window is called the Temporal Dead Zone (TDZ), and referencing the variable during it throws a `ReferenceError`. This is stricter (and safer) than `var`'s hoisting, which silently yields `undefined`. Neither `let` nor `const` can be redeclared in the same scope, unlike `var`.

## Examples

```js
// Block scoping in action
{
  let a = 1;
  const b = 2;
  console.log(a, b); // 1 2
}
console.log(typeof a); // "undefined" — a and b don't exist outside the block
```

```js
// const with objects/arrays: binding is locked, contents are not
const config = { retries: 3 };
config.retries = 5;      // OK — mutating a property
console.log(config);     // { retries: 5 }
// config = {};           // TypeError: Assignment to constant variable.
```

```js
// let fixes the classic loop-closure bug that var has
const fns = [];
for (let i = 0; i < 3; i++) {
  fns.push(() => console.log(i));
}
fns.forEach(fn => fn()); // 0 1 2 — each iteration captured its own `i`
```

## Common Pitfalls / Gotchas

- Expecting `const` to make objects immutable — it doesn't; use `Object.freeze()` for shallow immutability or a structural clone/immutable library for deep immutability.
- Declaring a `let`/`const` loop variable and being surprised that (unlike `var`) each iteration gets a fresh binding — this is actually the fix, not the bug, but it trips people used to `var`.
- Trying to declare a `const` without an initializer (`const x;`) — this is a `SyntaxError`; `const` must be initialized at declaration.
- Shadowing an outer `let`/`const` with the same name inside a nested block and being confused about which one a given line refers to.

## Interview Questions & Answers

**Q: When would you choose `let` over `const`, and vice versa?**
A: Default to `const` for anything that isn't reassigned after initialization — it communicates intent and prevents accidental reassignment bugs. Use `let` only when the variable genuinely needs to be reassigned, such as loop counters, accumulators, or state that changes over the life of a function.

**Q: Does `const` make an array or object deeply immutable?**
A: No. `const` only prevents reassigning the variable itself. The object or array it points to can still be mutated (pushing to an array, changing a property). To prevent mutation, use `Object.freeze()` (shallow — nested objects are still mutable) or a deep-freeze/immutable-data approach.

**Q: What happens if you access a `let` variable before its declaration line?**
A: You get a `ReferenceError: Cannot access 'x' before initialization` because the variable is hoisted to the top of the block but sits in the Temporal Dead Zone until its declaration executes — unlike `var`, which would silently return `undefined`.

**Q: Can you redeclare a `let` variable in the same scope?**
A: No — `SyntaxError: Identifier 'x' has already been declared`. This is different from `var`, which permits silent redeclaration in the same scope.

## Related Topics
- [variables-in-javascript.md](./variables-in-javascript.md)
- [block-scope.md](./block-scope.md)
- [hoisting.md](./hoisting.md)
- [immutability.md](./immutability.md)
- [closures.md](./closures.md)
