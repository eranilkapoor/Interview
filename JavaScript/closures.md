# Closures

A closure is a function bundled together with references to its surrounding (lexical) scope — meaning it retains access to the variables of the function it was defined inside, even after that outer function has finished executing and would otherwise have had its execution context popped off the call stack and discarded. In practice: "a function having access to the parent scope, even after the parent function has closed" — the inner function *closes over* the outer variables it references.

Closures are not a special, opt-in feature — every function in JavaScript forms a closure over its lexical environment, whether or not that fact is ever exploited. They become *observable* (and useful) specifically when an inner function is returned from, or otherwise escapes, its outer function — at that point, the only reason the outer function's variables continue to exist is that the returned inner function still references them. This is the mechanism behind data privacy/encapsulation patterns (module pattern, private counters), memoization/caching, and function factories like `makeAdder(5)` that "pre-configure" a function with a baked-in value.

Closures are also the precise explanation for one of the most common interview trick questions: the "loop + `var` + `setTimeout`" bug, where all callbacks log the same final value because they share one `var` binding, versus `let`, which gives each iteration (and thus each closure) an independent binding. Understanding closures deeply requires connecting them to lexical scope, the scope chain, and Lexical Environments — closures are the *consequence* of those mechanisms, not a separate one.

## Examples

```js
// Classic closure: the returned function retains access to displayName's scope
function displayName(name) {
  const greeting = 'Hello, ' + name + ' Welcome ';
  return function sayName() {
    console.log(greeting); // closes over `greeting` from the enclosing scope
  };
}
const sayMyName = displayName('Anil');
sayMyName(); // "Hello, Anil Welcome " — works even though displayName already returned
```

```js
// Practical use: a private counter via closure (data encapsulation)
function createCounter() {
  let count = 0; // fully private — no external access except via returned methods
  return {
    increment() { return ++count; },
    decrement() { return --count; },
    value() { return count; }
  };
}
const counter = createCounter();
counter.increment();
counter.increment();
console.log(counter.value()); // 2
console.log(counter.count);   // undefined — genuinely private
```

```js
// The classic var vs let loop-closure interview question
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log('var:', i), 10); // "var: 3" x3 — one shared binding
}
for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log('let:', j), 10); // "let: 0" "let: 1" "let: 2" — separate bindings
}
```

## Common Pitfalls / Gotchas

- The `var`-in-a-loop closure bug — all callbacks share the loop's single `var` binding, so by the time any of them run, the loop has finished and they all see its final value; use `let` (a new binding per iteration) to fix it.
- Assuming closures copy the *value* of a captured variable at creation time — they don't; they capture a live reference to the variable itself, so if the outer variable changes later, the closure sees the updated value, not a frozen snapshot.
- Creating unintentional memory retention by holding onto closures (e.g., long-lived event listeners or caches) that reference large objects in their outer scope — those objects can't be garbage collected as long as the closure is reachable.
- Overusing closures for private state instead of proper class fields or module scoping where either would be clearer — closures are powerful but can make debugging harder if internal state isn't easily inspectable.

## Interview Questions & Answers

**Q: What is a closure, in your own words?**
A: A closure is the combination of a function and a persistent reference to the lexical scope it was defined within. It lets an inner function continue accessing its outer function's variables even after the outer function has already returned and its execution context has been removed from the call stack.

**Q: Why does the classic `for (var i ...) { setTimeout(() => console.log(i)) }` log the same final value for every callback, and how does switching to `let` fix it?**
A: `var` is function-scoped, so all iterations of the loop share exactly one binding for `i`. Every closure created inside the loop captures a reference to that *same* binding, and by the time any `setTimeout` callback actually runs (asynchronously, after the loop has already finished), `i` holds its final post-loop value. `let` creates a brand-new binding for each iteration, so each closure captures its own independent value instead.

**Q: How would you use a closure to create a function with "private" state that can't be accessed or modified directly from outside?**
A: Define the state as a local variable inside an outer function, and return inner function(s) that reference (close over) that variable. Since the variable lives only in the outer function's Lexical Environment, and that environment is only reachable through the returned functions, there's no way for outside code to read or write it except through the API you deliberately expose.

**Q: Do closures capture variable values or variable references?**
A: References (live bindings), not snapshots of values at creation time. If the outer variable is reassigned after the closure is created but before it's called, the closure will observe the updated value — this is precisely why the `var` loop bug happens, and why each `let` iteration needs its own separate binding to behave "correctly."

## Related Topics
- [lexical-scope.md](./lexical-scope.md)
- [scope-chain.md](./scope-chain.md)
- [lexical-environment.md](./lexical-environment.md)
- [higher-order-function.md](./higher-order-function.md)
- [iife.md](./iife.md)
- [garbage-collection.md](./garbage-collection.md)
