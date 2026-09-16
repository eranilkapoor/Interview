# Compiler

A compiler is a program that translates source code written in one language into another form — typically a lower-level representation like machine code, bytecode, or (in JavaScript's ecosystem specifically) into a different flavor/version of JavaScript itself. Compilation is traditionally contrasted with interpretation (see [interpreter.md](./interpreter.md)): a traditional ahead-of-time (AOT) compiler translates the entire program into a final executable *before* it ever runs, whereas an interpreter translates and executes more incrementally, without necessarily producing a separate standalone output file.

In the JavaScript world, "compiler" shows up in a few distinct, easily-conflated contexts. **Babel** is a JavaScript-to-JavaScript compiler (a "transpiler"): it takes modern syntax (like optional chaining, or even experimental proposals) and compiles it down into an older, more widely-supported syntax, so code written with the latest features can still run in environments/browsers that don't natively support them yet. **TypeScript's compiler (`tsc`)** compiles TypeScript source (JS syntax plus type annotations) down into plain JavaScript, stripping all type information in the process since JavaScript itself has no runtime concept of TypeScript's types. Inside the JS **engine** itself, a **JIT (Just-In-Time) compiler** (see [jit-compiler.md](./jit-compiler.md)) compiles frequently-executed bytecode into optimized native machine code *while the program is running*, a hybrid strategy distinct from both traditional AOT compilation and pure interpretation.

Understanding which "compiler" a given conversation is referring to — a build-time source-to-source tool like Babel/tsc, versus an engine-internal, runtime JIT compiler — is important for giving a precise answer in interviews, since they solve entirely different problems (source compatibility/tooling vs runtime execution speed) despite sharing the same general term.

## Examples

```js
// Babel-style transpilation: modern syntax IN, older-compatible syntax OUT (conceptual)
// Input (modern):
const greet = (name = 'World') => `Hello, ${name}!`;

// Conceptual Babel output (compiled to older, widely-supported syntax):
// var greet = function (name) {
//   if (name === undefined) name = 'World';
//   return 'Hello, ' + name + '!';
// };
```

```ts
// TypeScript compiler (tsc): types checked and then STRIPPED at compile time
function add(a: number, b: number): number {
  return a + b;
}
// Compiled JavaScript output (types are gone — pure runtime behavior remains):
// function add(a, b) { return a + b; }
```

```js
// A tiny illustrative "compiler" — translating simple math expressions into a different form
function compileToPostfix(expr) {
  // Drastically simplified illustration of "compiling" infix to postfix notation
  return expr.split(' ').reduce((stack, token) => {
    if (!isNaN(token)) stack.push(token);
    else { const b = stack.pop(), a = stack.pop(); stack.push(`${a} ${b} ${token}`); }
    return stack;
  }, []).join('');
}
console.log(compileToPostfix('3 4 +')); // demonstrates translating one representation into another
```

## Common Pitfalls / Gotchas

- Assuming "compiler" always means "produces machine code" — in the JavaScript ecosystem, tools like Babel and `tsc` are compilers that produce *other JavaScript*, not machine code at all; this "transpiler" usage is extremely common and worth distinguishing from AOT/JIT compilation to actual machine instructions.
- Confusing build-time compilation (Babel, `tsc` — run once, before deployment, producing a distributable JS file) with the JS engine's internal JIT compilation (happens continuously, at runtime, while the program executes) — they solve entirely different problems.
- Believing TypeScript's compiler provides any runtime type-checking — it only checks types at compile time and then discards them entirely; the emitted JavaScript has no residual type information or runtime type enforcement.
- Assuming compiled output is always human-readable or 1:1 structurally similar to the source — heavily optimized/minified compiler output (from bundlers, JIT-compiled machine code) can look nothing like the original source.

## Interview Questions & Answers

**Q: What's the difference between a "compiler" like Babel and the JIT compiler inside a JavaScript engine?**
A: Babel is a build-time, source-to-source compiler (a "transpiler") that runs once, ahead of deployment, converting modern JavaScript syntax into older, more widely-compatible JavaScript syntax — its output is still JavaScript source code. A JIT compiler runs *inside* the JS engine, *while the program executes*, translating frequently-run bytecode into optimized native machine code on the fly — a completely different stage and purpose, despite both being called "compilers."

**Q: Does the TypeScript compiler affect how code behaves at runtime?**
A: No — `tsc` only performs compile-time type checking and then strips all type annotations away, emitting plain JavaScript with exactly the same runtime behavior as if it had been written directly in JavaScript without any types at all. TypeScript's value is entirely in development-time safety and tooling, not runtime behavior.

**Q: Why would a project use Babel even if every target browser already supports the newest JavaScript syntax being written?**
A: Beyond raw syntax compatibility, Babel is often still used for compiling experimental/proposal-stage syntax (not yet standardized or supported anywhere natively), for JSX (used in React, which isn't valid JavaScript syntax at all without compilation), and to guarantee consistent behavior across a wider range of environments than the primary development target, including older or less common runtimes.

## Related Topics
- [interpreter.md](./interpreter.md)
- [jit-compiler.md](./jit-compiler.md)
- [aot-compiler.md](./aot-compiler.md)
- [javascript-engine.md](./javascript-engine.md)
