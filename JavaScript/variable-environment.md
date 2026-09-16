# Variable Environment

The Variable Environment is the part of an execution context that holds bindings created by `var` declarations and function declarations within that context. Whenever a function is invoked, the engine creates a new execution context, and as part of setting it up, it establishes both a **Lexical Environment** (holding `let`/`const`/`class` bindings and providing the scope-chain reference) and this Variable Environment (historically, in older spec versions, `var` and function bindings lived in what was simply called the "Variable Environment," conceptually distinct from block-scoped bindings).

In practice, "variable environment" is most useful as a way to talk about *where a `var` declaration actually lives*: no matter how deeply nested inside `if`/`for`/`while` blocks a `var` statement appears, its binding is hoisted all the way up to the Variable Environment of the nearest enclosing function (or the global execution context, if there's no enclosing function) — never to some inner block. This is the mechanistic explanation for why `var` is function-scoped rather than block-scoped.

During the creation phase of an execution context (before any code actually runs), the engine scans the function body, hoists all `var` declarations into the Variable Environment initialized to `undefined`, and hoists all function declarations with their actual function bodies already attached (fully usable immediately) — this is the concrete mechanism behind [hoisting.md](./hoisting.md).

## Examples

```js
// var's binding lives in the function's Variable Environment, regardless of block nesting
function example() {
  console.log(isValid); // undefined — hoisted, but not yet assigned
  if (true) {
    var isValid = true; // still lands in example()'s Variable Environment, not the if-block
  }
  console.log(isValid); // true
}
example();
```

```js
// Function declarations are fully hoisted into the Variable Environment, body included
function outer() {
  console.log(inner()); // works — inner's full definition is already in the Variable Environment
  function inner() {
    return 'hoisted with full body';
  }
}
outer(); // "hoisted with full body"
```

```js
// Global var declarations become part of the global execution context's Variable Environment
var globalCount = 0;
function increment() {
  globalCount++; // reads/writes the global Variable Environment's binding
}
increment();
console.log(globalCount); // 1
console.log(typeof window !== 'undefined' ? window.globalCount : globalCount); // 1 (in browsers, attached to window)
```

## Common Pitfalls / Gotchas

- Assuming `var` inside a block gets its own scoped binding — it's actually hoisted to the nearest function's (or global) Variable Environment, ignoring block boundaries entirely.
- Forgetting that function declarations are hoisted with their entire body already attached (fully callable before their line in the code), unlike `var`, which is hoisted only as an `undefined` placeholder.
- Confusing "Variable Environment" (a spec-internal concept mostly relevant to `var`/function declarations) with the "Lexical Environment" (which handles `let`/`const`/`class` and defines the scope chain) — modern engines/specs actually track these together, but the conceptual distinction still explains `var`'s different hoisting/scoping behavior.

## Interview Questions & Answers

**Q: What lives in a function's Variable Environment, and how does that explain `var`'s scoping behavior?**
A: `var` declarations and function declarations within that execution context. Because a `var` statement's binding always lands in the *function's* (or global) Variable Environment — never a block's — `var` behaves as function-scoped rather than block-scoped, regardless of how deeply nested inside `if`/`for`/`while` blocks it's written.

**Q: How does the Variable Environment relate to hoisting?**
A: During the "creation phase" of an execution context (before line-by-line execution begins), the engine scans the code and populates the Variable Environment: `var` names get bindings initialized to `undefined`, and function declarations get bindings pointing to their fully-formed function object immediately. This pre-population is exactly what makes hoisting observable — you can reference a `var` (getting `undefined`) or call a hoisted function declaration before its line in the source.

**Q: If you declare the same `var` name in multiple nested blocks of one function, how many bindings exist?**
A: Just one — all of those `var` statements refer to the exact same binding in the function's single Variable Environment; each subsequent `var x = ...` simply reassigns that one binding rather than creating a distinct variable per block.

## Related Topics
- [execuation-context.md](./execuation-context.md)
- [hoisting.md](./hoisting.md)
- [lexical-environment.md](./lexical-environment.md)
- [function-scope.md](./function-scope.md)
