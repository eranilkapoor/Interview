# Dynamic Scope

Dynamic scope is an alternative scoping model (used by languages like older Lisp dialects, Bash, and Perl's `local`) where a variable's accessibility and value are determined by the **call stack at runtime** — specifically, by which function called which — rather than by where the code is textually written. Under dynamic scoping, a function can access variables from whichever function happens to have called it, even if that calling function isn't lexically related to it at all.

JavaScript does **not** use dynamic scoping for variables — it is lexically (statically) scoped, meaning a function's accessible variables are fixed by its nesting in the source code at definition time (see [lexical-scope.md](./lexical-scope.md)). This distinction is a common interview conceptual-comparison question: candidates are asked to explain dynamic scope specifically to demonstrate they understand *why* JavaScript's actual behavior (lexical) is different, and what would break if JS worked the other way.

That said, JavaScript does have one well-known behavior that superficially resembles dynamic scoping: the `this` keyword in regular (non-arrow) functions. `this` is resolved based on how/where a function is *called* (the call site), not where it's defined — which is dynamic in spirit, even though it's a special, singular mechanism (not the general variable-scoping model) layered on top of an otherwise fully lexically-scoped language.

## Examples

```js
// Lexical scope (how JavaScript actually works): variables are NOT dynamically scoped
const x = 'global x';
function readX() {
  console.log(x); // ALWAYS looks up x from where readX is defined, i.e., the global scope
}
function callerWithDifferentX() {
  const x = 'local to caller';
  readX(); // still logs "global x" — the caller's local `x` is invisible to readX
}
callerWithDifferentX(); // "global x"
```

```js
// Pseudocode illustrating what DYNAMIC scope would look like (JS does NOT behave this way)
// function readX() { console.log(x); }
// function callerWithDifferentX() {
//   let x = 'local to caller';
//   readX(); // in a dynamically-scoped language, this would print "local to caller"
// }
```

```js
// The one JS mechanism that behaves "dynamically": `this`
function whoCalledMe() {
  console.log(this.name);
}
const objA = { name: 'A', run: whoCalledMe };
const objB = { name: 'B', run: whoCalledMe };
objA.run(); // "A" — `this` depends on the CALL SITE, not where whoCalledMe was defined
objB.run(); // "B"
```

## Common Pitfalls / Gotchas

- Confusing `this`'s call-site-dependent behavior with the language having dynamic *variable* scoping in general — only `this` (and `arguments`, `super`, `new.target` in regular functions) behaves this way; ordinary variable lookup is always lexical.
- Assuming a function can "reach into" its caller's local variables — this is impossible in JavaScript; only dynamically scoped languages allow that kind of lookup.
- Mixing up dynamic scope with dynamic *typing* — completely unrelated concepts; dynamic scope is about *where* variables resolve, dynamic typing is about *when* types are checked.

## Interview Questions & Answers

**Q: What is dynamic scope, and does JavaScript use it?**
A: Dynamic scope resolves a variable based on the runtime call stack — which function called the current one — rather than the code's textual structure. JavaScript does not use dynamic scoping for variables; it's lexically scoped, meaning a function's accessible variables are fixed by where it's defined in the source, never by who calls it.

**Q: JavaScript's `this` is sometimes described as "dynamic" — how does that relate to (or differ from) dynamic scope?**
A: `this` genuinely is resolved based on the call site (how a function is invoked), which is conceptually similar to dynamic scoping's "depends on the caller" idea. But this is a special-cased mechanism specific to `this` (and a few related implicit bindings), not a general dynamic-scoping model for all variables — ordinary variable lookups in JS remain purely lexical regardless of `this`'s behavior.

**Q: Give an example distinguishing lexical from dynamic scope conceptually.**
A: If function `f` references variable `x`, and `f` is called from inside function `g`, which has its own local `x`: under lexical scoping (JavaScript), `f` resolves `x` based on where `f` was *defined*, completely ignoring `g`'s local `x`. Under dynamic scoping, `f` would instead resolve `x` by looking up the call stack and finding `g`'s local `x`, since `g` is the caller.

## Related Topics
- [lexical-scope.md](./lexical-scope.md)
- [scope-chain.md](./scope-chain.md)
- [this-keyword.md](./this-keyword.md)
- [function-invocation.md](./function-invocation.md)
