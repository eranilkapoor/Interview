# Lexical Environment

A Lexical Environment is the internal (spec-defined) data structure the JavaScript engine uses to implement scoping: it's essentially a record mapping identifiers (variable/function names) to their values, plus a reference to the *outer* Lexical Environment — the one lexically (textually) surrounding it. Every time a function is called, or a block with `let`/`const`/`class` is entered, a new Lexical Environment is created; the chain of outer references formed by these environments is exactly what implements the scope chain in practice.

The ECMAScript specification splits this concept into an **Environment Record** (the actual key-value store of bindings in the current scope) and a reference to the **outer environment**. When code looks up a variable, the engine checks the current Environment Record first; if not found, it follows the outer reference to the next Lexical Environment out, and so on, until it either finds the binding or runs out of environments (throwing a `ReferenceError`). This chain of Lexical Environments *is* the scope chain — they're really the same mechanism described from two angles (the spec's internal model vs. the observable behavior).

A closure, concretely, is a function bundled together with a reference to the Lexical Environment(s) that were in scope when it was created. As long as any live function retains a reference to a Lexical Environment, that environment (and the variables within it) cannot be garbage collected — which is both what makes closures work and, if misused, a potential source of memory retention/leaks.

## Examples

```js
// Each function call creates a new Lexical Environment
function outer() {
  let x = 10; // lives in outer's Lexical Environment
  function inner() {
    let y = 20; // lives in inner's own Lexical Environment
    console.log(x + y); // inner's environment has no `x`; found via outer reference chain
  }
  inner();
}
outer(); // 30
```

```js
// A returned closure keeps its defining Lexical Environment alive
function makeAdder(a) {
  return function (b) {
    return a + b; // `a` is resolved from the outer Lexical Environment, kept alive by this closure
  };
}
const add5 = makeAdder(5);
console.log(add5(3)); // 8 — outer's environment (containing `a = 5`) still exists
```

```js
// Block statements create their own Lexical Environment for let/const (but not var)
{
  let blockVar = 'block environment';
  {
    console.log(blockVar); // found by walking out to the enclosing block's environment
  }
}
```

## Common Pitfalls / Gotchas

- Conflating "Lexical Environment" (the spec-level mechanism) with "closure" (the observable behavior it produces) — they're related but not identical; a closure is a function *plus* a retained reference to Lexical Environment(s).
- Assuming every block creates a Lexical Environment for `var` too — `var` bindings live in the nearest function/global Environment Record, not in block-level ones, which is exactly why `var` isn't block-scoped.
- Forgetting that retaining a reference to an inner function (e.g., in a long-lived event listener or cache) keeps its entire Lexical Environment chain alive, potentially retaining large outer-scope variables in memory longer than expected.
- Believing each *iteration* of a loop shares one Lexical Environment when using `let` — the spec actually creates a fresh Lexical Environment per iteration for `let`, which is precisely why closures inside `let`-based loops each capture a distinct value.

## Interview Questions & Answers

**Q: What is a Lexical Environment, in spec terms?**
A: An internal structure consisting of an Environment Record (the bindings — variable/function names to values — declared in the current scope) and a reference to the outer Lexical Environment. It's created for every function call and for every block that introduces `let`/`const`/`class` bindings, and chains of these outer references implement the scope chain.

**Q: How does a Lexical Environment relate to a closure?**
A: A closure is precisely a function combined with a persistent reference to the Lexical Environment(s) active when it was created. Even after the outer function that created that environment has returned, the environment survives (isn't garbage collected) as long as some live function retains a reference to it — which is exactly why closures continue to have access to "their" outer variables indefinitely.

**Q: Does a `for` loop using `let` create one Lexical Environment for the whole loop, or one per iteration?**
A: One per iteration. The specification creates a fresh Lexical Environment (and copies the loop variable's current value into it) for each iteration when using `let`, which is why each closure created inside such a loop captures a distinct value rather than sharing one final value, unlike `var`, which uses a single shared binding.

## Related Topics
- [scope-chain.md](./scope-chain.md)
- [lexical-scope.md](./lexical-scope.md)
- [closures.md](./closures.md)
- [execuation-context.md](./execuation-context.md)
- [variable-environment.md](./variable-environment.md)
