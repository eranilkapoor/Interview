# Block Scope

Block scope means a variable declared inside a pair of curly braces (`{ }`) — whether an `if` statement, a loop body, or a standalone bare block — is only accessible within that block and any nested blocks inside it. `let`, `const`, and `class` declarations (ES2015) are block-scoped. `var` and function declarations are not truly block-scoped in the same way — `var` is function-scoped (see [function-scope.md](./function-scope.md)), and function declarations inside blocks have historically inconsistent, engine-dependent hoisting behavior (block-scoped in strict mode per the spec, but with legacy quirks in non-strict mode).

Block scoping brings JavaScript's variable rules in line with most other mainstream languages (C, Java, Python-ish indentation-based scoping conceptually, etc.), and fixes several long-standing `var`-related footguns — most famously, the loop-variable-in-closures bug, where `let` in a `for` loop header creates a *new* binding for each iteration, while `var` shares a single binding across all iterations.

Blocks don't need to be attached to a control-flow statement to create scope — a bare `{ ... }` on its own is valid JavaScript and creates a genuine block scope, occasionally used deliberately to limit a temporary variable's lifetime without needing a function or loop.

## Examples

```js
// let/const respect block boundaries; var does not
{
  let blockScoped = 'only here';
  var functionOrGlobalScoped = 'leaks out';
}
console.log(typeof blockScoped);          // "undefined"
console.log(functionOrGlobalScoped);      // "leaks out" — var ignored the block
```

```js
// The classic loop-closure difference between let and var
const varFns = [];
for (var i = 0; i < 3; i++) {
  varFns.push(() => console.log('var:', i));
}
varFns.forEach(fn => fn()); // "var: 3" "var: 3" "var: 3" — shared binding, final value

const letFns = [];
for (let j = 0; j < 3; j++) {
  letFns.push(() => console.log('let:', j));
}
letFns.forEach(fn => fn()); // "let: 0" "let: 1" "let: 2" — new binding per iteration
```

```js
// A bare block can scope a temporary variable deliberately
{
  const temp = computeExpensiveValue();
  console.log(temp);
}
// `temp` is unreachable and eligible for garbage collection past this point
function computeExpensiveValue() { return 42; }
```

## Common Pitfalls / Gotchas

- Expecting `var` to respect block boundaries like `let`/`const` — it doesn't; it's function-scoped and leaks past `if`/`for`/`while`/bare blocks.
- Being surprised that `let i` in a `for` loop header still lets `i` be referenced inside the loop body (it's visible inside the loop's block) but not after the loop ends — each iteration gets a fresh copy, and the last one goes out of scope once the loop finishes.
- Declaring a function inside a block in non-strict mode and relying on it being visible outside the block — behavior here varies across engines/modes; strict mode (default in modules/classes) makes function declarations properly block-scoped, matching `let`/`const`.
- Shadowing an outer `let` with an inner block's `let` of the same name and being confused about which is referenced inside a nested block — the innermost declaration always wins within its own scope.

## Interview Questions & Answers

**Q: What's the core difference between block scope and function scope, and which keywords use which?**
A: Block scope confines a variable to the nearest enclosing `{ }` (any block, not just functions); function scope confines it to the nearest enclosing function (or global, if none). `let`, `const`, and `class` are block-scoped; `var` is function-scoped.

**Q: Why does using `let` instead of `var` in a `for` loop fix closure-related bugs?**
A: With `var`, there is only one shared binding for the loop variable across all iterations, so any closures created inside the loop all reference the same final value once the loop finishes. With `let`, the loop mechanism creates a *new*, independent binding for each iteration, so each closure captures its own iteration's value correctly.

**Q: Can you create block scope without using an `if`, `for`, or `while` statement?**
A: Yes — a bare block, just `{ ... }` on its own with no attached control-flow keyword, is valid syntax and creates its own scope for any `let`/`const`/`class` declared inside it.

## Related Topics
- [function-scope.md](./function-scope.md)
- [let-and-const.md](./let-and-const.md)
- [closures.md](./closures.md)
- [scope-chain.md](./scope-chain.md)
