# JavaScript Statements

A statement is an instruction that the JavaScript engine executes to perform an action — declaring a variable, branching with a condition, looping, or returning from a function. A JavaScript program is essentially a sequence of statements executed in order (modulo control-flow statements that alter that order). This is distinct from an *expression*, which evaluates to a value; many statements *contain* expressions (e.g., an `if` statement's condition), but the statement itself is the complete instruction.

Statements are generally categorized into: declaration statements (`var`, `let`, `const`, `function`, `class`), control-flow statements (`if...else`, `switch`), looping statements (`for`, `while`, `do...while`, `for...in`, `for...of`), jump statements (`break`, `continue`, `return`, `throw`), and the exception-handling statement (`try...catch...finally`). Blocks (`{ ... }`) group multiple statements into one and establish block scope for `let`/`const`/`class` declared within them.

Each statement typically ends with a semicolon, though JavaScript's Automatic Semicolon Insertion (ASI) will insert one automatically in many cases at a line break. Relying on ASI is a common source of subtle bugs (e.g., `return` followed by a value on the next line), so most style guides recommend writing semicolons explicitly rather than depending on the parser's inference rules.

## Examples

```js
// Declaration + control-flow + loop statements together
let total = 0;
for (let i = 1; i <= 5; i++) {
  if (i % 2 === 0) {
    total += i;
  }
}
console.log(total); // 6 (2 + 4)
```

```js
// switch statement (a control-flow statement with fall-through by default)
function dayType(day) {
  switch (day) {
    case 'Sat':
    case 'Sun':
      return 'weekend';
    default:
      return 'weekday';
  }
}
console.log(dayType('Sun'), dayType('Mon')); // "weekend weekday"
```

```js
// try/catch/finally — exception-handling statement
function parseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (err) {
    console.log('Invalid JSON:', err.message);
    return null;
  } finally {
    console.log('Parse attempt finished');
  }
}
parseJSON('{bad}');
```

## Common Pitfalls / Gotchas

- Forgetting `break` in a `switch` statement, causing unintended fall-through to the next case.
- Relying on ASI when a statement starts with `(`, `[`, `` ` ``, `+`, or `-` on the next line — the parser may merge it with the previous line instead of starting a new statement.
- Confusing an expression statement (e.g., `foo();`) with a declaration statement — only the latter introduces a new binding.
- Using `var` inside blocks (`if`, `for`) expecting block scoping — `var` ignores block boundaries and attaches to the nearest function/global scope.

## Interview Questions & Answers

**Q: What's the difference between a statement and an expression in JavaScript?**
A: An expression evaluates to a single value (`2 + 2`, `a && b`, a function call). A statement is a complete instruction that performs an action and doesn't itself have to produce a usable value (`if`, `for`, a variable declaration). Many statements embed expressions inside them.

**Q: Why is fall-through in `switch` considered risky, and how do you avoid it?**
A: Without an explicit `break` (or `return`), execution continues into the next `case` block regardless of whether its condition matches, which is rarely the intended behavior. You avoid it by always including `break`/`return` in each case, or intentionally grouping cases (like `case 'Sat': case 'Sun':`) when shared behavior is desired.

**Q: What does ASI do and why do many style guides ask for explicit semicolons anyway?**
A: ASI automatically inserts semicolons at certain line breaks so that omitted semicolons don't always cause syntax errors. It's not adopted universally as "safe" because certain patterns (a line starting with `(`, `[`, or a template literal) get merged with the previous statement instead of being treated as new, causing hard-to-spot bugs — hence the preference for explicit semicolons.

## Related Topics
- [basic-of-javascript.md](./basic-of-javascript.md)
- [loops-in-javascript.md](./loops-in-javascript.md)
- [error-handling.md](./error-handling.md)
- [block-scope.md](./block-scope.md)
