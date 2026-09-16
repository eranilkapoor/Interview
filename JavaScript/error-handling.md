# Error Handling

JavaScript signals problems by **throwing** an error — either automatically (a runtime error like calling a method on `undefined`, or a `SyntaxError` during parsing) or deliberately, via `throw new Error('message')`. Thrown errors propagate up the call stack until they're caught by a `try...catch` block or, if none exists, crash the program (in Node) or get logged to the console as an uncaught exception (in browsers). The built-in `Error` object (and its subclasses: `TypeError`, `RangeError`, `ReferenceError`, `SyntaxError`, and custom classes extending `Error`) carries a `.message` and `.stack` (a trace of the call stack at the point the error was created), which is invaluable for debugging.

`try...catch...finally` is the core synchronous error-handling construct: code in `try` runs normally; if it throws, control jumps to `catch` (optionally binding the error to a variable — in modern JS, the binding itself is optional: `catch {}` without a parameter is valid); `finally` runs regardless of whether an error occurred, useful for cleanup (closing a connection, hiding a loading spinner) that must happen either way.

Asynchronous error handling has different mechanics depending on style: a plain `try...catch` does **not** catch errors thrown inside a callback passed to `setTimeout` or similar (since the callback runs in a completely separate turn of the event loop, after the original `try` block has already exited). Promises propagate rejections through `.catch()` (or the second argument to `.then()`), and `async`/`await` lets you use ordinary `try...catch` around `await` expressions, since an awaited rejected Promise is converted into a thrown exception at that point — one of `async`/`await`'s biggest ergonomic wins over raw Promise chains or callbacks.

## Examples

```js
// Basic try/catch/finally with a custom error
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}
function validateAge(age) {
  if (age < 0) throw new ValidationError('Age cannot be negative');
  return age;
}
try {
  validateAge(-5);
} catch (err) {
  console.log(err.name, ':', err.message); // "ValidationError : Age cannot be negative"
} finally {
  console.log('Validation attempt complete'); // always runs
}
```

```js
// try/catch does NOT catch errors from async callbacks (different event-loop turn)
try {
  setTimeout(() => { throw new Error('boom'); }, 0);
} catch (e) {
  console.log('never reached'); // this catch does not run
}
// Uncaught Error: boom (crashes/logs separately, outside the try block's scope)
```

```js
// async/await lets you use try/catch for asynchronous errors naturally
async function fetchUser(id) {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.log('Failed to fetch user:', err.message);
    return null;
  }
}
```

## Common Pitfalls / Gotchas

- Expecting a synchronous `try...catch` to catch an error thrown inside a `setTimeout` callback, a Promise `.then()` handler, or an event listener — it won't, because those callbacks execute in a separate turn of the event loop, after the original `try` block has already finished.
- Forgetting to `.catch()` a rejected Promise (or wrap an `await` in `try...catch`) — leads to an "unhandled promise rejection," which crashes newer Node.js versions by default and is silently logged (or ignored) in some browser contexts.
- Throwing non-`Error` values (`throw 'a string'`, `throw 42`) — legal in JS, but loses the useful `.stack` trace and `.message`/`.name` structure that `Error` (and its subclasses) provide, making debugging much harder.
- Overusing `try...catch` around large blocks of code, obscuring exactly which line failed — prefer catching around the smallest reasonable unit of risky code, or add context to the caught error before rethrowing.

## Interview Questions & Answers

**Q: Why doesn't a `try...catch` around a `setTimeout` call catch errors thrown inside its callback?**
A: The callback executes asynchronously, in a completely separate event-loop turn, after the original synchronous `try` block has already finished executing and been popped off the call stack. Error propagation up the call stack only works within a single, ongoing synchronous execution; it can't reach back into a `try` block that has already exited.

**Q: How does `async`/`await` change how you handle errors from asynchronous operations, compared to raw Promises?**
A: With raw Promises, you handle rejections via `.catch()` (or the second `.then()` argument) chained onto the Promise. With `async`/`await`, an awaited Promise that rejects is converted into a thrown exception at that `await` point, letting you use a standard, synchronous-style `try...catch` block around it — unifying error handling for sync and async code into one familiar construct.

**Q: What's the difference between the built-in `Error`, `TypeError`, and `RangeError`?**
A: `Error` is the base class for all runtime errors. `TypeError` is thrown when a value isn't of the expected type for an operation (e.g., calling a non-function, or accessing a property on `null`/`undefined`). `RangeError` is thrown when a numeric value is outside an allowed range (e.g., an invalid array length, or exceeding the call stack size — "Maximum call stack size exceeded" is a `RangeError`).

**Q: What happens if a Promise rejects and nothing calls `.catch()` on it?**
A: It becomes an "unhandled promise rejection." In modern Node.js, this crashes the process by default (configurable); in browsers, it typically logs a warning to the console but doesn't halt execution. Either way, silently swallowing errors this way is a common source of hard-to-diagnose bugs, so always attach error handling to any Promise chain that can reject.

## Related Topics
- [promises.md](./promises.md)
- [async-await.md](./async-await.md)
- [call-stack-and-memory-heap.md](./call-stack-and-memory-heap.md)
- [stack-overflow-memory-leaks.md](./stack-overflow-memory-leaks.md)
