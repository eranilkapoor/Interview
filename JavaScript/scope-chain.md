# Scope Chain

The scope chain is the mechanism JavaScript uses to resolve a variable reference: when code inside a function or block references an identifier, the engine looks it up in the current scope first; if not found, it walks *outward* through each enclosing (lexically surrounding) scope, one level at a time, until it either finds the binding or reaches the global scope with no match, at which point it throws a `ReferenceError`. This outward-only, one-directional lookup path is the scope chain — implemented internally as a chain of Lexical Environments, each pointing to its outer one.

Crucially, the scope chain is determined by *where a function is defined* in the source (lexical scoping), not by where it's called from — a function's scope chain is fixed the moment it's created and never changes based on the call stack. This is why a deeply nested function can reach all the way out to variables declared in its enclosing functions and the global scope, but the reverse is never true: an outer scope can never see into an inner scope's variables.

A related, historically dangerous behavior is variable leakage: in non-strict mode, assigning to an undeclared identifier doesn't throw a `ReferenceError` — instead of failing the lookup, JavaScript creates a new property on the global object as a side effect, effectively "leaking" a variable into the outermost scope. Strict mode disables this, turning it into a thrown error instead (see [global-variables.md](./global-variables.md)).

## Examples

```js
// Nested scopes chained together — inner scopes see outer variables
function level1() {
  const a = 'level1';
  function level2() {
    const b = 'level2';
    function level3() {
      console.log(a, b); // walks the chain: level3 -> level2 -> level1
    }
    level3();
  }
  level2();
}
level1(); // "level1 level2"
```

```js
// The scope chain is fixed by definition location, not call location
function makeLogger() {
  const prefix = '[LOG]';
  return function (msg) {
    console.log(prefix, msg); // always resolves `prefix` from where this fn was DEFINED
  };
}
function elsewhere() {
  const prefix = 'not this one';
  const log = makeLogger();
  log('hello'); // "[LOG] hello" — uses makeLogger's prefix, not elsewhere's
}
elsewhere();
```

```js
// Implicit global creation via scope-chain lookup failure (non-strict mode)
function leaky() {
  accidental = 'leaked!'; // no declaration; assignment still succeeds
}
leaky();
console.log(accidental); // "leaked!" — created on the global object as a side effect
```

## Common Pitfalls / Gotchas

- Assuming the scope chain depends on the call stack (who calls whom) — it doesn't; it's fixed by lexical nesting at definition time, unrelated to the sequence of function calls at runtime.
- Forgetting outer scopes can never access inner scopes' variables — lookups only travel outward, never inward, so a global-scope reference to a function-local variable will always fail.
- Relying on implicit global creation instead of properly declaring variables — always use strict mode (default in modules/classes) to convert this silent bug into a loud, catchable error.
- Believing shadowing "merges" bindings — a variable declared in an inner scope with the same name as an outer one completely shadows the outer one within that inner scope; the outer variable is simply unreachable from there, not altered.

## Interview Questions & Answers

**Q: What is the scope chain, and how does variable lookup use it?**
A: It's the ordered sequence of nested (lexical) scopes an identifier lookup traverses, starting from the current scope and moving outward through each enclosing scope until the identifier is found or the global scope is exhausted (throwing `ReferenceError`). It's implemented as a chain of Lexical Environments, each holding a reference to its outer Lexical Environment.

**Q: Is the scope chain determined by where a function is called, or where it's defined?**
A: Where it's defined — JavaScript uses lexical (static) scoping, so a function's scope chain is fixed at creation time based on its textual nesting in the source, and it never changes depending on the call site or call stack.

**Q: What happens if you assign to an undeclared variable inside a function, and how does strict mode change that?**
A: In non-strict mode, the scope-chain lookup for the assignment target fails to find any existing binding, and JavaScript falls back to creating a new property on the global object — an "implicit global." In strict mode, this fallback is disabled, and the same code throws a `ReferenceError: x is not defined` instead, catching what's almost always a bug (a missing declaration keyword).

## Related Topics
- [lexical-scope.md](./lexical-scope.md)
- [lexical-environment.md](./lexical-environment.md)
- [closures.md](./closures.md)
- [global-variables.md](./global-variables.md)
- [dynamic-scope.md](./dynamic-scope.md)
