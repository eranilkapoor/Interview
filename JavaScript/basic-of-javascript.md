# Basics of JavaScript

The basics of JavaScript cover the smallest building blocks every program is made of: values, variables, expressions, statements, and the operators/keywords that combine them. Every JavaScript program — from a two-line script to a million-line application — is fundamentally a sequence of statements that the engine parses into an Abstract Syntax Tree (AST) and then executes top to bottom (subject to control-flow constructs like loops, conditionals, and function calls).

A JavaScript program is composed of *expressions* (things that produce a value, like `2 + 2` or `foo()`) and *statements* (complete instructions, like `if (...) { ... }` or `let x = 5;`). Variables (declared with `var`, `let`, or `const`) are named references to values stored in memory. Values in JS are either *primitives* (string, number, boolean, null, undefined, symbol, bigint) or *objects* (including arrays and functions, which are specialized objects).

Comments (`//` single-line, `/* */` multi-line), semicolons (mostly optional due to Automatic Semicolon Insertion, but recommended for clarity), and whitespace/formatting round out the syntax basics. Beyond syntax, understanding *execution order*, *scope*, and *type coercion* early on prevents a large share of beginner bugs, because JavaScript is forgiving about implicit conversions and flexible about scoping rules in ways that surprise newcomers coming from stricter languages.

## Examples

```js
// Variables, expressions, and statements
let firstName = 'Anil';       // declaration + assignment statement
const greeting = 'Hello, ' + firstName; // expression (string concatenation)
console.log(greeting);        // statement: function call — "Hello, Anil"
```

```js
// Basic control flow
function classify(n) {
  if (n % 2 === 0) {
    return 'even';
  } else {
    return 'odd';
  }
}
console.log(classify(4), classify(7)); // "even odd"
```

```js
// Primitive vs object basics
const a = 5;             // primitive number
const b = { value: 5 };  // object
console.log(typeof a, typeof b); // "number object"
```

## Common Pitfalls / Gotchas

- Relying on Automatic Semicolon Insertion (ASI) everywhere — it has edge cases (e.g., a line starting with `(` or `[` can merge with the previous line) that cause subtle bugs.
- Forgetting that `==` performs type coercion while `===` does not — leading to surprising comparisons like `'5' == 5` being `true`.
- Not understanding that `console.log` output can be misleading for objects that mutate after logging (some consoles show a live reference, not a snapshot).
- Mixing `var`, `let`, and `const` without understanding their different scoping rules (function vs block scope).

## Interview Questions & Answers

**Q: What are the basic building blocks of a JavaScript program?**
A: Values and types (primitives and objects), variables (`var`/`let`/`const`), operators, expressions, statements, and functions. The engine parses these into an AST and executes them according to the language's control-flow and scoping rules.

**Q: What is Automatic Semicolon Insertion (ASI) and why can it be risky?**
A: ASI is the parser's rule for inserting semicolons at line breaks when a statement would otherwise be invalid. It's risky because it doesn't always insert where a human expects — for example, a `return` followed by a newline and then a value gets ASI-terminated as `return;`, silently returning `undefined` instead of the intended value.

**Q: What's the difference between an expression and a statement?**
A: An expression produces a value (`2 + 2`, `x++`, a function call). A statement is an instruction that performs an action and may or may not produce a value directly (`if`, `for`, variable declarations). Some constructs, like arrow function bodies, distinguish between "expression bodies" and "block bodies" based on this exact distinction.

## Related Topics
- [variables-in-javascript.md](./variables-in-javascript.md)
- [operators-in-javascript.md](./operators-in-javascript.md)
- [javascript-statements.md](./javascript-statements.md)
- [datatypes-in-javascript.md](./datatypes-in-javascript.md)
