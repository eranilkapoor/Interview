# Execution Context

An execution context is the abstract environment in which JavaScript code is evaluated and run — it bundles together everything the engine needs to execute a chunk of code: the current value of `this`, the Variable/Lexical Environments (holding all accessible variable and function bindings), and a reference to the outer environment for scope-chain lookups. There are three kinds: the **Global Execution Context** (created once, when the script first runs), **Function Execution Contexts** (a new one created every time any function is called), and **Eval Execution Contexts** (created for code run via `eval()`, rarely used in modern code).

Execution contexts are managed on the **call stack**: whenever a function is called, a new execution context is pushed onto the stack and becomes the "currently running" context; when that function returns, its context is popped off, and control resumes in whatever context is now on top. This push/pop, Last-In-First-Out behavior is exactly what implements JavaScript's synchronous, single-threaded call semantics (see [call-stack-and-memory-heap.md](./call-stack-and-memory-heap.md)).

Each execution context goes through two conceptual phases: a **creation phase** (hoisting — the engine scans the code, sets up the Variable Environment with `var`/function declarations, sets up the Lexical Environment for `let`/`const` in the Temporal Dead Zone, and determines `this`) and an **execution phase** (the engine actually runs the code line by line, assigning real values as it goes). This two-phase model is the precise mechanistic explanation for hoisting.

## Examples

```js
// Global execution context is created first; function calls push new contexts
console.log('global context'); // running in the Global Execution Context

function outer() {
  console.log('outer context pushed'); // new Function Execution Context
  function inner() {
    console.log('inner context pushed, on top of outer'); // another new context
  }
  inner();
  console.log('back in outer context'); // inner's context has been popped
}
outer();
console.log('back in global context'); // outer's context has been popped
```

```js
// Creation phase vs execution phase, observable through hoisting
console.log(typeof hoistedVar);   // "undefined" — creation phase already ran
console.log(hoistedFn());          // "I work!" — fully hoisted with its body
var hoistedVar = 'assigned in execution phase';
function hoistedFn() { return 'I work!'; }
```

```js
// this is bound per execution context, based on how the function is invoked
const obj = {
  name: 'context demo',
  show() {
    console.log(this.name); // `this` resolved fresh for THIS execution context
  }
};
obj.show(); // "context demo"
```

## Common Pitfalls / Gotchas

- Assuming there's only one execution context alive at a time — many exist simultaneously on the call stack (one per active, not-yet-returned function call), with only the topmost one actively executing.
- Forgetting the two-phase model (creation, then execution) — this is exactly why hoisting exists and why referencing a `var` before its line yields `undefined` instead of throwing.
- Believing execution contexts persist after a function returns — a function's execution context is popped off the call stack and (absent a closure retaining its Lexical Environment) becomes eligible for garbage collection.
- Conflating "execution context" with just "scope" — an execution context includes `this` binding, the call/return mechanics on the call stack, and the environments, not merely a name-to-value lookup table.

## Interview Questions & Answers

**Q: What are the three types of execution context in JavaScript?**
A: Global Execution Context (one per program/script, created first), Function Execution Context (one created for every function call), and Eval Execution Context (created for code executed via `eval()`, rare in practice).

**Q: What happens during the "creation phase" of an execution context, before any code actually runs?**
A: The engine determines the value of `this` for that context, sets up the Variable Environment (hoisting `var` declarations as `undefined` and fully hoisting function declarations with their bodies attached), and sets up the Lexical Environment for `let`/`const`/`class` bindings (left uninitialized in the Temporal Dead Zone until their actual declaration line executes).

**Q: How does the call stack relate to execution contexts?**
A: The call stack is a Last-In-First-Out structure that tracks which execution contexts are currently active. Calling a function pushes a new execution context onto the stack; returning from that function pops it off, resuming whatever context is now on top. A "stack overflow" happens when this stack grows unbounded, typically from runaway recursion with no base case.

## Related Topics
- [call-stack-and-memory-heap.md](./call-stack-and-memory-heap.md)
- [variable-environment.md](./variable-environment.md)
- [hoisting.md](./hoisting.md)
- [this-keyword.md](./this-keyword.md)
