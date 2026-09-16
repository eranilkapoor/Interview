# Lexical Scope

Lexical scope (also called static scope) means that a variable's accessibility is determined by *where it is written in the source code* — specifically, by its physical nesting within functions and blocks — rather than by how or where the code is later called at runtime. When the JavaScript engine parses your source code, it determines, once and for all at that point, exactly which outer scopes a given nested function can "see," regardless of what happens dynamically during execution.

This is the mechanism that makes closures possible: a nested function permanently retains access to the variables of its enclosing (lexically surrounding) functions, because that access was baked in based on source-code structure, not the call stack at the time it's eventually invoked. Lexical scoping is why an inner function can be passed around, returned, and called from a completely different context, and still see the variables from where it was *defined*.

JavaScript is lexically scoped, in contrast to dynamic scoping (where a variable's accessibility depends on the *call stack* at runtime instead — see [dynamic-scope.md](./dynamic-scope.md)), which is a real (if uncommon) scoping model in some other languages/contexts. Understanding lexical scope precisely is essential for understanding the scope chain, closures, and — via lexical `this` — arrow functions.

## Examples

```js
// Lexical scope: determined by where code is written, not where it's called
function outer() {
  const message = 'from outer';
  function inner() {
    console.log(message); // finds `message` via its lexical (written) position inside outer
  }
  return inner;
}
const fn = outer();
fn(); // "from outer" — still works, even called far from where it was defined
```

```js
// Lexical scope is fixed at write-time, unaffected by the call site
const value = 'global';
function readValue() {
  console.log(value); // always looks up `value` from where readValue is DEFINED
}
function wrapper() {
  const value = 'local to wrapper';
  readValue(); // still logs "global" — readValue's lexical scope doesn't change based on caller
}
wrapper(); // "global"
```

```js
// Nested lexical scopes chain outward
function level1() {
  const a = 1;
  function level2() {
    const b = 2;
    function level3() {
      console.log(a, b); // both accessible via the lexical scope chain
    }
    level3();
  }
  level2();
}
level1(); // 1 2
```

## Common Pitfalls / Gotchas

- Confusing lexical scope with dynamic ("who called me") behavior — a function's variable lookups never depend on its caller's local variables, only on its own textual nesting at definition time.
- Assuming moving a function definition around (e.g., copying it into another module) preserves the same lexical bindings automatically — it depends on new surrounding code where it's redefined, not the old location.
- Forgetting that lexical scope is what enables closures — without lexical scoping, returned inner functions couldn't retain access to their outer function's variables after that outer function has returned.
- Mixing up lexical scope with lexical `this` in arrow functions — lexical scope is about variable lookup generally; lexical `this` is a specific application of the same underlying principle to the `this` keyword.

## Interview Questions & Answers

**Q: What does "lexical scope" mean, and how does it differ conceptually from dynamic scope?**
A: Lexical scope means a variable's visibility is fixed by where it's textually written in the source code (which function/block it's nested inside), determined at parse time. Dynamic scope (rare in mainstream languages) would instead resolve a variable based on the chain of function *calls* at runtime — i.e., who called the current function — rather than where the code was written. JavaScript uses lexical scoping.

**Q: How does lexical scope enable closures?**
A: Because scope is determined by where a function is *defined*, a nested function permanently "remembers" access to its enclosing function's variables via the scope chain, even after the enclosing function has finished executing and been popped off the call stack. This retained access — fixed at definition time regardless of later call context — is exactly what a closure is.

**Q: Give an example of how lexical scope explains arrow functions' behavior with `this`.**
A: Because arrow functions have no `this` of their own, they resolve `this` lexically — the same mechanism used for variable lookup — by looking at the enclosing scope's `this` at the point the arrow function was *defined*, not at the point it's later called. This is a direct application of lexical scoping to the `this` keyword specifically.

## Related Topics
- [scope-chain.md](./scope-chain.md)
- [closures.md](./closures.md)
- [dynamic-scope.md](./dynamic-scope.md)
- [lexical-environment.md](./lexical-environment.md)
- [arrow-function.md](./arrow-function.md)
